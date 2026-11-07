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
  await F.setDoc(ref, { name, score, updatedAt: F.serverTimestamp() });
  return { improved: true, best: score };
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
