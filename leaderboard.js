// 線上排行榜：Firebase Firestore。
// apiKey 改回 'YOUR...' 開頭時，會改用這台瀏覽器裡的假資料，方便離線測畫面。

const firebaseConfig = {
  apiKey: "AIzaSyDsOnmUUptftW6Cy12WiuHdGLYP3reDHtY",
  authDomain: "xiake-arcade.firebaseapp.com",
  projectId: "xiake-arcade",
  storageBucket: "xiake-arcade.firebasestorage.app",
  messagingSenderId: "139763164258",
  appId: "1:139763164258:web:7e58df75678ec69d009d3b",
  measurementId: "G-0EG8R4FFYB"
};

export const isMock = firebaseConfig.apiKey.startsWith('YOUR');
const isAsc = game => game.startsWith('mines-');      // 踩地雷比秒數，越小越好
const better = (game, a, b) => (isAsc(game) ? a < b : a > b);

// 名字規則要跟 Firestore 安全規則一致；文件 ID 不能有 /
export function cleanName(raw) {
  const name = String(raw ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (name.length < 1 || name.length > 12) return { error: '名字要 1 到 12 個字' };
  if (/[\/<>"'&]/.test(name) || name === '.' || name === '..') return { error: '名字不能有 / < > " \' & 這些符號' };
  return { name };
}

/* ---------- Firebase：用到才載入，沒填設定時完全不連線 ---------- */
let fb = null;
async function firestore() {
  if (fb) return fb;
  const [{ initializeApp }, F] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js')
  ]);
  fb = { F, db: F.getFirestore(initializeApp(firebaseConfig)) };
  return fb;
}

/* ---------- 本機假資料 ---------- */
const mock = {
  read() { try { return JSON.parse(localStorage.getItem('arcade.mockboard')) || {}; } catch (e) { return {}; } },
  write(d) { try { localStorage.setItem('arcade.mockboard', JSON.stringify(d)); } catch (e) {} }
};

// 只有破自己紀錄才寫入；回傳 { improved, best }
export async function submitScore(game, name, score) {
  if (isMock) {
    const d = mock.read(), board = d[game] || (d[game] = {}), prev = board[name];
    if (prev != null && !better(game, score, prev)) return { improved: false, best: prev };
    board[name] = score; mock.write(d);
    return { improved: true, best: score };
  }
  const { F, db } = await firestore();
  const ref = F.doc(db, 'leaderboards', game, 'entries', name);
  const old = await F.getDoc(ref);
  if (old.exists() && !better(game, score, old.data().score)) return { improved: false, best: old.data().score };
  const top = (await getBoard(game, 1))[0];                  // 寫入前的第一名
  await F.setDoc(ref, { name, score, updatedAt: F.serverTimestamp() });
  if (!top || better(game, score, top.score))                // 成為新第一名才發動態
    F.addDoc(F.collection(db, 'feed'), {
      game, name, score, prev: top && top.name !== name ? top.name : '', at: F.serverTimestamp()
    }).catch(e => console.warn('動態寫入失敗', e));           // 動態失敗不影響存分數
  return { improved: true, best: score };
}

/* ---------- 後台遊玩紀錄：每局都記，跟排行榜分開，只寫不讀（到 Firebase Console 看）*/
function deviceId() {
  try {
    let id = localStorage.getItem('arcade.device');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('arcade.device', id); }
    return id;
  } catch (e) { return 'unknown'; }
}
export async function logPlay(game, name, score) {
  const row = { game, score, name: name || null, device: deviceId() };
  try {
    if (isMock) {
      let list = [];
      try { list = JSON.parse(localStorage.getItem('arcade.mockplays')) || []; } catch (e) {}
      list.push({ ...row, at: new Date().toISOString() });
      localStorage.setItem('arcade.mockplays', JSON.stringify(list.slice(-500)));
      return;
    }
    const { F, db } = await firestore();
    await F.addDoc(F.collection(db, 'plays'), { ...row, at: F.serverTimestamp() });
  } catch (e) { console.warn('遊玩紀錄寫入失敗', e); }
}

// 即時監看第一名：cb({ name, score, at } | null)，只回報伺服器確認過的資料（離線快取、自己尚未送達的寫入都跳過）
export async function watchTop(game, cb, onErr) {
  const { F, db } = await firestore();
  const q = F.query(F.collection(db, 'leaderboards', game, 'entries'),
                    F.orderBy('score', isAsc(game) ? 'asc' : 'desc'), F.limit(1));
  return F.onSnapshot(q, { includeMetadataChanges: true }, snap => {
    if (snap.metadata.hasPendingWrites || snap.metadata.fromCache) return;
    const d = snap.docs[0]?.data();
    cb(d ? { name: d.name, score: d.score, at: d.updatedAt?.toMillis() ?? null } : null);
  }, onErr);
}

// 最新 6 筆動態（有人成為新第一名時寫入 feed 集合）
export async function watchFeed(cb, onErr) {
  const { F, db } = await firestore();
  const q = F.query(F.collection(db, 'feed'), F.orderBy('at', 'desc'), F.limit(6));
  return F.onSnapshot(q, snap => cb(snap.docs.map(d => {
    const x = d.data(); return { ...x, at: x.at?.toMillis() ?? Date.now() };
  })), onErr);
}

// 最新消息：news 集合，一個版本一筆，最新的排前面。只能在 Firebase 後台編輯
const MOCK_NEWS = [
  { version: '1.3', date: '2026-11-14', items: [
    { tag: 'new',  group: '夜市夾娃娃', game: 'claw', text: '升級成 3D 機台，搖桿移動、按鈕下爪，急停可以「甩爪」把娃娃撥到洞口。' },
    { tag: 'fix',  group: '大廳', text: '最新動態改為保存在線上，重新整理後「打敗 xxx」不會消失。' } ] },
  { version: '1.2', date: '2026-11-12', items: [
    { tag: 'new',  group: '新遊戲', game: 'pachinko', text: '夜市彈珠台：用拉的發射，底部八個凹槽計分，大當たり期間分數 ×3。' },
    { tag: 'tune', group: '跳格子', game: 'hop', text: '前期速度調慢，比較容易上手。' } ] }
];
export async function getNews(n = 20) {
  if (isMock) return MOCK_NEWS.slice(0, n);
  const { F, db } = await firestore();
  const q = F.query(F.collection(db, 'news'), F.orderBy('date', 'desc'), F.limit(n));
  return (await F.getDocs(q)).docs.map(d => {
    const x = d.data(), t = x.date?.toDate?.() ?? new Date(x.date);
    return { version: x.version || d.id, date: t.toLocaleDateString('sv-SE'), items: x.items || [] };   // sv-SE = 本地時區的 YYYY-MM-DD
  });
}

// 前 n 名：[{ name, score }]
export async function getBoard(game, n = 20) {
  if (isMock) {
    return Object.entries(mock.read()[game] || {})
      .map(([name, score]) => ({ name, score }))
      .sort((a, b) => (isAsc(game) ? a.score - b.score : b.score - a.score))
      .slice(0, n);
  }
  const { F, db } = await firestore();
  const q = F.query(F.collection(db, 'leaderboards', game, 'entries'),
                    F.orderBy('score', isAsc(game) ? 'asc' : 'desc'), F.limit(n));
  return (await F.getDocs(q)).docs.map(d => ({ name: d.data().name, score: d.data().score }));
}
