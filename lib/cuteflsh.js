/*
 * cute-fish.js — Q 版圓滾滾 3D 魚（程式產生，不需要外部模型或圖片）
 * 適用 three.js r128 以上（用到 MeshPhysicalMaterial 的 clearcoat）。
 *
 * 用法：
 *   先載入 three.min.js，再載入這個檔案（或直接貼進遊戲的 script 裡）
 *   const fish = createCuteFish(THREE, { color: '#19a8f0' });
 *   scene.add(fish);
 *   // 每一幀：
 *   fish.userData.update(timeInSeconds, { speed: 1 });
 *   // 同一種魚要很多隻：先建一隻當範本，其他用 createCuteFish.clone(範本)，共用幾何與材質
 *
 * 座標：魚頭朝 +x、上方 +y；身體半徑約 1（全長約 2.6）。用 fish.scale 調大小。
 * 選項（都可省略）：
 *   color     身體主色            預設 '#19a8f0'
 *   belly     肚子顏色            預設 '#ffffff'
 *   fin       鰭的顏色            預設依主色變亮
 *   eye       眼睛深色            預設 '#0c2466'
 *   blush     腮紅                預設 true
 *   bubbles   背上的水珠突起數量    預設 26（0 = 不要）
 *   detail    'high' | 'low'      預設 'high'（low 給一次要放很多隻的遊戲用）
 *   seed      水珠位置的亂數種子    預設 7
 *   envIntensity 環境反射強度      預設 0.55
 */
(function (root) {
  function createCuteFish(THREE, opts) {
    opts = opts || {};
    const LOW = opts.detail === 'low';
    const lin = (c) => new THREE.Color(c).convertSRGBToLinear();
    const base = lin(opts.color || '#19a8f0');
    const finCol = opts.fin ? lin(opts.fin) : base.clone().lerp(lin('#ffffff'), 0.1);
    const belly = lin(opts.belly || '#ffffff');
    const deep = base.clone().multiplyScalar(0.62);
    const rnd = ((s) => () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; })(opts.seed == null ? 7 : opts.seed);
    const canvasTex = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; };
    const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const ENV = opts.envIntensity == null ? 0.55 : opts.envIntensity;   // 環境反射強度，太強會讓顏色變淡
    const glossy = (color, o) => new THREE.MeshPhysicalMaterial(Object.assign({ color, roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.14, envMapIntensity: ENV }, o || {}));

    const fish = new THREE.Group();
    fish.name = 'CuteFish';
    const bodyG = new THREE.Group(); bodyG.name = 'bodyG'; fish.add(bodyG);
    const SX = 1, SY = 0.94, SZ = 0.9;                              // 身體略扁的圓球
    // 身體表面一點（方向 d 是單位向量）：回傳位置與法線
    const surface = (d, lift) => {
      const n = new THREE.Vector3(d.x / SX, d.y / SY, d.z / SZ).normalize();
      const p = new THREE.Vector3(d.x * SX, d.y * SY, d.z * SZ);
      return { p: p.addScaledVector(n, lift || 0), n };
    };
    const orient = (obj, n, up) => { const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), n, up || new THREE.Vector3(0, 1, 0)); obj.quaternion.setFromRotationMatrix(m); obj.rotateY(Math.PI); };  // 讓物件的 +z 朝向法線

    /* ---------- 身體：頂點顏色做出藍背白肚 ---------- */
    const bodyGeo = new THREE.SphereGeometry(1, LOW ? 28 : 64, LOW ? 20 : 48);
    const pos = bodyGeo.attributes.position, cols = new Float32Array(pos.count * 3), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const white = 1 - smooth(-0.42, -0.16, y - 0.28 * Math.max(0, x));   // 下半部和下巴是白色，越前面白得越高
      c.copy(base).lerp(deep, smooth(0.35, 1, y) * 0.55).lerp(belly, white);
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    bodyGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    bodyGeo.scale(SX, SY, SZ);
    const body = new THREE.Mesh(bodyGeo, glossy(0xffffff, { vertexColors: true, roughness: 0.25 }));
    body.name = 'body'; bodyG.add(body);

    /* ---------- 鰭：共用的放射紋理 ---------- */
    const ribTex = canvasTex(256, 256, (g) => {
      g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2; g.strokeStyle = i % 2 ? 'rgba(10,50,110,.28)' : 'rgba(255,255,255,.55)'; g.lineWidth = i % 2 ? 3 : 4; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.cos(a) * 180, 128 - Math.sin(a) * 180); g.stroke(); }
      const r = g.createRadialGradient(128, 128, 0, 128, 128, 128); r.addColorStop(0, 'rgba(10,60,120,.18)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 256, 256);
    });
    ribTex.wrapS = ribTex.wrapT = THREE.ClampToEdgeWrapping;
    const FIN_SPAN = 1.6;                                           // 形狀座標 ±0.8 對應整張紋理
    ribTex.repeat.set(1 / FIN_SPAN, 1 / FIN_SPAN); ribTex.offset.set(0.5, 0.5);
    const finMat = glossy(finCol, { map: ribTex, roughness: 0.35, transparent: true, opacity: 0.96, side: THREE.DoubleSide });
    const extrude = (shape, depth, bevel) => { const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: LOW ? 1 : 3, curveSegments: LOW ? 8 : 20 }); g.translate(0, 0, -depth / 2); return g; };

    // 尾鰭：兩片圓潤的尾葉，從原點往 -x 長
    const tailShape = new THREE.Shape();
    tailShape.moveTo(0, 0.14);
    tailShape.bezierCurveTo(-0.18, 0.3, -0.42, 0.62, -0.66, 0.6);
    tailShape.bezierCurveTo(-0.78, 0.58, -0.72, 0.28, -0.5, 0.05);
    tailShape.bezierCurveTo(-0.46, 0.0, -0.46, -0.02, -0.5, -0.06);
    tailShape.bezierCurveTo(-0.72, -0.28, -0.76, -0.56, -0.62, -0.56);
    tailShape.bezierCurveTo(-0.4, -0.58, -0.18, -0.3, 0, -0.14);
    tailShape.lineTo(0, 0.14);
    const tail = new THREE.Group(); tail.name = 'tail'; tail.position.set(-0.86, 0.02, 0); tail.scale.setScalar(1.25); bodyG.add(tail);
    const tailMesh = new THREE.Mesh(extrude(tailShape, 0.05, 0.035), finMat); tailMesh.position.x = 0.05; tail.add(tailMesh);

    // 背鰭：往後傾的圓弧
    const dorsalShape = new THREE.Shape();
    dorsalShape.moveTo(0.32, 0);
    dorsalShape.bezierCurveTo(0.3, 0.3, 0.08, 0.6, -0.12, 0.58);
    dorsalShape.bezierCurveTo(-0.26, 0.56, -0.3, 0.36, -0.42, 0.06);
    dorsalShape.lineTo(-0.44, -0.1); dorsalShape.lineTo(0.32, -0.1); dorsalShape.lineTo(0.32, 0);
    const dorsal = new THREE.Mesh(extrude(dorsalShape, 0.07, 0.04), finMat); dorsal.name = 'dorsal';
    dorsal.position.set(-0.05, SY * 0.86, 0); bodyG.add(dorsal);

    // 胸鰭與腹鰭：貝殼狀的扇形，邊緣有波浪
    const fanShape = (r, a0, a1, waves) => {
      const s = new THREE.Shape(); s.moveTo(0, 0); const N = waves * 6;
      for (let i = 0; i <= N; i++) { const a = a0 + (a1 - a0) * (i / N), rr = r * (0.9 + 0.1 * Math.abs(Math.cos((i / N) * waves * Math.PI))); s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
      s.lineTo(0, 0); return s;
    };
    const pecGeo = extrude(fanShape(0.36, Math.PI * 0.72, Math.PI * 1.28, 4), 0.035, 0.025);
    const fins = [];
    const addFin = (geo, dir, tilt, name, scale) => {
      const { p, n } = surface(new THREE.Vector3(dir[0], dir[1], dir[2]).normalize(), -0.02);
      const pivot = new THREE.Group(); pivot.position.copy(p); bodyG.add(pivot);
      const m = new THREE.Mesh(geo, finMat); m.scale.setScalar(scale || 1);
      pivot.rotation.set(0, Math.sign(n.z) * tilt, 0); pivot.add(m);
      pivot.userData.side = Math.sign(n.z) || 1; pivot.name = name; fins.push(pivot); return pivot;
    };
    addFin(pecGeo, [0.2, -0.28, 0.94], 0.5, 'pectoralL');
    addFin(pecGeo, [0.2, -0.28, -0.94], 0.5, 'pectoralR');
    const ventGeo = extrude(fanShape(0.22, Math.PI * 0.8, Math.PI * 1.3, 3), 0.03, 0.02);
    const vL = addFin(ventGeo, [-0.15, -0.9, 0.42], 0.3, 'ventralL'); vL.rotation.x = 0.5;
    const vR = addFin(ventGeo, [-0.15, -0.9, -0.42], 0.3, 'ventralR'); vR.rotation.x = -0.5;

    /* ---------- 眼睛：玻璃感的半球＋虹膜貼圖＋高光 ---------- */
    const eyeTex = canvasTex(256, 256, (g) => {
      const eyeDeep = '#' + lin(opts.eye || '#0c2466').convertLinearToSRGB().getHexString();
      g.fillStyle = '#d8efff'; g.beginPath(); g.arc(128, 128, 128, 0, 7); g.fill();               // 外圈淡藍白邊
      g.fillStyle = eyeDeep; g.beginPath(); g.arc(128, 128, 112, 0, 7); g.fill();
      const lower = g.createRadialGradient(128, 196, 10, 128, 170, 110); lower.addColorStop(0, 'rgba(90,170,255,.95)'); lower.addColorStop(1, 'rgba(90,170,255,0)');
      g.fillStyle = lower; g.beginPath(); g.arc(128, 128, 108, 0, 7); g.fill();                     // 下半部亮藍反光
      g.fillStyle = '#040a22'; g.beginPath(); g.arc(128, 120, 62, 0, 7); g.fill();                 // 瞳孔
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(92, 82, 30, 26, -0.4, 0, 7); g.fill();     // 大高光
      g.beginPath(); g.arc(160, 166, 11, 0, 7); g.fill();                                           // 小高光
    });
    const eyeGeo = new THREE.SphereGeometry(1, LOW ? 16 : 32, LOW ? 8 : 16, 0, Math.PI * 2, 0, Math.PI / 2);
    { const p = eyeGeo.attributes.position, uv = eyeGeo.attributes.uv; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * 0.5 + 0.5, 0.5 - p.getZ(i) * 0.5); eyeGeo.rotateX(Math.PI / 2); eyeGeo.scale(1, 1, 0.45); }   // 半球朝 +z，貼圖用平面投影
    const eyeMat = glossy(0xffffff, { map: eyeTex, roughness: 0.08, clearcoatRoughness: 0.03 });
    const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eyes = [];
    [1, -1].forEach((s) => {
      const { p, n } = surface(new THREE.Vector3(0.72, 0.14, 0.62 * s).normalize(), -0.04);
      const eg = new THREE.Group(); eg.name = 'eye'; eg.position.copy(p); orient(eg, n); bodyG.add(eg);
      const ball = new THREE.Mesh(eyeGeo, eyeMat); ball.scale.setScalar(0.29); eg.add(ball);
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), glintMat); glint.position.set(-0.08, 0.1, 0.125); glint.scale.set(1, 0.85, 0.4); eg.add(glint);
      // 眉毛：眼睛上方一小條隆起
      const bd = surface(new THREE.Vector3(0.6, 0.48, 0.52 * s).normalize(), -0.01);
      const brow = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), glossy(base.clone().lerp(lin('#ffffff'), 0.18)));
      brow.position.copy(bd.p); orient(brow, bd.n); brow.scale.set(0.11, 0.035, 0.04); brow.rotateZ(-0.25 * s); bodyG.add(brow);
      eyes.push(eg);
      // 腮紅
      if (opts.blush !== false) {
        const bt = blushTex || (blushTex = canvasTex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,110,130,.75)'); r.addColorStop(1, 'rgba(255,110,130,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }));
        const bl = surface(new THREE.Vector3(0.6, -0.12, 0.8 * s).normalize(), 0.012);
        const m = new THREE.Mesh(new THREE.CircleGeometry(0.16, 20), new THREE.MeshBasicMaterial({ map: bt, transparent: true, depthWrite: false }));
        m.position.copy(bl.p); orient(m, bl.n); m.scale.set(1.25, 0.8, 1); bodyG.add(m);
      }
    });
    var blushTex;

    /* ---------- 嘴巴：白色小鼓包＋紅色張嘴 ---------- */
    const mouthDir = surface(new THREE.Vector3(0.97, -0.2, 0).normalize(), -0.02);
    const mouth = new THREE.Group(); mouth.name = 'mouth'; mouth.position.copy(mouthDir.p); orient(mouth, mouthDir.n); bodyG.add(mouth);
    const white = glossy(lin('#ffffff'), { roughness: 0.3 });
    [-1, 1].forEach((s) => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), white); m.position.set(0.075 * s, 0.025, 0.02); m.scale.set(0.1, 0.065, 0.06); mouth.add(m); });
    const lip = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), glossy(lin('#e2474b'), { roughness: 0.4 }));
    lip.position.set(0, -0.01, 0.03); lip.scale.set(0.075, 0.095, 0.035); mouth.add(lip);
    const tongue = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), glossy(lin('#ff8a9a'), { roughness: 0.5 }));
    tongue.position.set(0, -0.065, 0.05); tongue.scale.set(0.042, 0.025, 0.015); mouth.add(tongue);

    /* ---------- 背上的水珠突起 ---------- */
    const dropMat = glossy(base.clone().lerp(lin('#bff0ff'), 0.14), { roughness: 0.1, clearcoatRoughness: 0.05 });
    const dropGeo = new THREE.SphereGeometry(1, LOW ? 10 : 16, LOW ? 8 : 12);
    const N = opts.bubbles == null ? 26 : opts.bubbles;
    let placed = 0, tries = 0;
    while (placed < N && tries++ < N * 40) {
      const d = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1); if (d.lengthSq() > 1 || d.lengthSq() < 0.05) continue; d.normalize();
      if (d.x > 0.15 || d.y < -0.15 || Math.abs(d.z) < 0.22 || d.x < -0.85) continue;           // 只放在後半身、上半部、避開背鰭那條線
      const { p, n } = surface(d, -0.015), r = 0.035 + rnd() * 0.06;
      const m = new THREE.Mesh(dropGeo, dropMat); m.position.copy(p); orient(m, n); m.scale.set(r * 0.8, r * 1.25, r * 0.45); bodyG.add(m); placed++;
    }
    // 額頭上的一顆
    { const { p, n } = surface(new THREE.Vector3(0.62, 0.66, 0.12).normalize(), -0.01); const m = new THREE.Mesh(dropGeo, dropMat); m.position.copy(p); orient(m, n); m.scale.set(0.07, 0.05, 0.03); bodyG.add(m); }

    bindUpdate(fish, rnd());
    return fish;
  }
  /* ---------- 動畫：用名字找零件，所以 clone 出來的魚也能動 ---------- */
  function bindUpdate(fish, r) {
    const find = (n) => fish.getObjectByName(n), bodyG = find('bodyG'), tail = find('tail'), dorsal = find('dorsal'), mouth = find('mouth');
    const eyes = [], fins = [];
    fish.traverse((o) => { if (o.name === 'eye') eyes.push(o); if (/^(pectoral|ventral)/.test(o.name)) fins.push(o); });
    let blinkAt = 2 + (r == null ? Math.random() : r) * 2, last = null, phase = (r == null ? Math.random() : r) * 6, spS = 1;
    fish.userData.update = function (t, o) {
      o = o || {}; const dt = last == null ? 0 : Math.min(0.1, Math.max(0, t - last)); last = t;
      // 速度平滑過渡，擺尾的「相位」用累加的，速度改變時尾巴不會跳動
      spS += ((o.speed == null ? 1 : o.speed) - spS) * Math.min(1, dt * 4);
      const sp = spS, k = 0.6 + sp * 0.4; phase += dt * (4 + sp * 4);
      tail.rotation.y = Math.sin(phase) * (0.12 + sp * 0.16);
      bodyG.rotation.y = Math.sin(phase + 1.2) * 0.03 * k;
      bodyG.position.y = Math.sin(t * 1.6) * 0.05;
      fins.forEach((f, i) => { f.children[0].rotation.y = Math.sin(t * 6 + i) * 0.25 * f.userData.side; });
      dorsal.rotation.x = Math.sin(t * 2.2) * 0.05;
      // 眨眼：每 3–5 秒一次
      if (t > blinkAt) blinkAt = t + 3 + Math.random() * 2;
      const b = blinkAt - t < 0.14 ? Math.abs(Math.sin(((blinkAt - t) / 0.14) * Math.PI)) : 0;
      eyes.forEach((e) => { e.scale.y = 1 - b * 0.9; });
      mouth.scale.y = 1 + Math.sin(t * 3) * 0.08;
    };
    fish.userData.update(0);
    return fish;
  }
  // 複製一條魚：幾何與材質共用，一次要放很多隻時用這個，比每次 createCuteFish 快很多
  createCuteFish.clone = function (src) { const f = src.clone(true); f.userData = {}; return bindUpdate(f); };
  root.createCuteFish = createCuteFish;
  if (typeof module !== 'undefined' && module.exports) module.exports = createCuteFish;
})(typeof window !== 'undefined' ? window : globalThis);