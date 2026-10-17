// Живой фон: по два варианта на тему. Рисуется, только когда своя картинка не выбрана.
//   neon:  0 — «Горизонт», 1 — «Соты», 2 — «Гиперпрыжок»
//   glass: 0 — «Пятна»,    1 — «Шёлк»
//   calm:  0 — «Точки»,    1 — «Созвездия»
//   cards: 0 — «Полёт», 1 — «Масти», 2 — «Веер»
(() => {
  const cv = document.getElementById('fx');
  const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let W = 0, H = 0, theme = '', variant = 0, key = '', enabled = false, raf = 0, last = 0, t = 0;
  let col = { accent: [250, 30, 78], text: [236, 233, 245], bg: [11, 10, 16] };
  // pres — «присутствие» курсора: плавно растёт, когда мышь на странице, и плавно гаснет, когда ушла
  const mouse = { x: 0, y: 0, sx: 0, sy: 0, inside: false, pres: 0 };
  let parts = [], blobs = [], hexes = [], pulses = [], nextPulse = 0, stars = [], warp = [], deck = [], fans = [], dust = [];
  let K = 1;                 // масштаб холста (для быстрых преобразований)
  let sprites = {};          // заранее нарисованные карты и масти

  const hex = h => {
    h = (h || '').trim().replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return isNaN(n) ? [255, 255, 255] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n);
  const hasMouse = () => mouse.pres > .01;

  function resize() {
    W = innerWidth; H = innerHeight;
    const dpr = devicePixelRatio || 1;
    // «Пятна» рисуются в низком разрешении — они всё равно размытые, а нагрузка меньше
    const k = key === 'glass0' ? 0.25 : key === 'glass1' ? Math.min(dpr, 1.5) : Math.min(dpr, 2);
    cv.width = Math.max(1, Math.round(W * k));
    cv.height = Math.max(1, Math.round(H * k));
    ctx.setTransform(k, 0, 0, k, 0, 0);
    K = k;
    init();
  }

  function init() {
    parts = []; blobs = []; hexes = []; pulses = []; stars = []; warp = []; deck = []; fans = []; dust = []; sprites = {};
    if (key === 'neon0') {
      for (let i = 0; i < 70; i++) parts.push(spark(true));
    } else if (key === 'neon1') {
      const s = 30, hw = Math.sqrt(3) * s, vh = 1.5 * s;
      for (let r = -1, y = 0; y < H + s * 2; r++, y = r * vh) {
        for (let x = (r & 1) ? hw / 2 : 0; x < W + hw; x += hw) hexes.push({ x, y, e: 0 });
      }
      nextPulse = 0;
    } else if (key === 'neon2') {
      for (let i = 0; i < 560; i++) warp.push(warpStar(Math.random()));
    } else if (key === 'cards0') {
      const n = Math.max(14, Math.min(40, Math.round(W * H / 55000)));
      for (let i = 0; i < n; i++) deck.push(flyCard(true));
      deck.sort((a, b) => a.z - b.z);
    } else if (key === 'cards2') {
      // четыре веера в углах: нижние раскрываются вверх, верхние — вниз
      const m = Math.min(W, H);
      fans = [
        { x: W * .07, y: H + m * .06, rot: .32, ph: 0 },
        { x: W * .93, y: H + m * .06, rot: -.32, ph: 1.7 },
        { x: W * .05, y: -m * .06, rot: Math.PI - .4, ph: 3.1 },
        { x: W * .95, y: -m * .06, rot: Math.PI + .4, ph: 4.6 }
      ].map(f => ({ ...f, n: 7, suit: Math.random() * 4 | 0, rank: RANKS[Math.random() * RANKS.length | 0], open: 0 }));
      for (let i = 0; i < 70; i++) dust.push(goldDust(true));
    } else if (key === 'glass0') {
      const pal = [col.accent, [106, 76, 255], [47, 168, 255], [255, 79, 154], [60, 44, 150]];
      pal.forEach((c, i) => blobs.push({
        c, cx: .2 + Math.random() * .6, cy: .2 + Math.random() * .6,
        rx: .18 + Math.random() * .2, ry: .15 + Math.random() * .2,
        sp: .05 + Math.random() * .07, ph: i * 1.7, r: .32 + Math.random() * .16
      }));
    } else if (key === 'calm1') {
      const n = Math.round(W * H / 13000);
      for (let i = 0; i < n; i++) stars.push({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - .5) * 9, vy: (Math.random() - .5) * 9
      });
    }
  }
  function warpStar(z) {
    return { x: (Math.random() * 2 - 1) * 1.6, y: (Math.random() * 2 - 1) * 1.6, z, a: Math.random() < .22 };
  }
  // ---------- общее для темы «Карты» ----------
  const SUITS = ['♠', '♥', '♣', '♦'];
  const RANKS = ['A', 'K', 'Q', 'J', '10', '9', '7'];
  const INK = [28, 26, 34];
  const SYM = '"Segoe UI Symbol", "Noto Sans Symbols 2", "DejaVu Sans", serif';
  const isRed = i => i === 1 || i === 3;
  const lighten = c => c.map(v => Math.round(v + (255 - v) * .45));
  function roundRect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  const CW = 64, CH = 90, SS = 2;   // размер карты-спрайта и его чёткость
  function cardFace(suit, rank) {
    const id = 'f' + suit + rank;
    if (sprites[id]) return sprites[id];
    const c = document.createElement('canvas'); c.width = CW * SS; c.height = CH * SS;
    const g = c.getContext('2d'); g.scale(SS, SS);
    roundRect(g, .5, .5, CW - 1, CH - 1, 6);
    g.fillStyle = rgba(col.tile, 1); g.fill();
    g.strokeStyle = rgba(col.accent, .75); g.lineWidth = 1; g.stroke();
    roundRect(g, 3, 3, CW - 6, CH - 6, 4);
    g.strokeStyle = rgba(col.accent, .22); g.stroke();
    // чёрные масти — золото, красные — светлое золото
    const ink = isRed(suit) ? rgba(lighten(col.accent), 1) : rgba(col.accent, 1);
    g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `700 13px "Playfair Display", Georgia, serif`; g.fillText(rank, 10, 11);
    g.font = `11px ${SYM}`; g.fillText(SUITS[suit], 10, 24);
    g.save(); g.translate(CW, CH); g.rotate(Math.PI);
    g.font = `700 13px "Playfair Display", Georgia, serif`; g.fillText(rank, 10, 11);
    g.font = `11px ${SYM}`; g.fillText(SUITS[suit], 10, 24);
    g.restore();
    g.font = `34px ${SYM}`; g.fillText(SUITS[suit], CW / 2, CH / 2 + 1);
    return (sprites[id] = c);
  }
  function cardBack() {
    if (sprites.back) return sprites.back;
    const c = document.createElement('canvas'); c.width = CW * SS; c.height = CH * SS;
    const g = c.getContext('2d'); g.scale(SS, SS);
    roundRect(g, .5, .5, CW - 1, CH - 1, 6);
    g.fillStyle = rgba(col.tile, 1); g.fill();
    g.strokeStyle = rgba(col.accent, .75); g.lineWidth = 1; g.stroke();
    roundRect(g, 4, 4, CW - 8, CH - 8, 4);
    g.fillStyle = rgba(col.bg, 1); g.fill();
    g.strokeStyle = rgba(col.accent, .6); g.stroke();
    g.save(); g.clip();
    g.strokeStyle = rgba(col.accent, .35); g.lineWidth = 1;
    for (let i = -CH; i < CW + CH; i += 7) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + CH, CH); g.stroke();
      g.beginPath(); g.moveTo(i + CH, 0); g.lineTo(i, CH); g.stroke();
    }
    g.restore();
    return (sprites.back = c);
  }
  function suitGlyph(suit, color) {
    const id = 's' + suit + color;
    if (sprites[id]) return sprites[id];
    const c = document.createElement('canvas'); c.width = c.height = 48;
    const g = c.getContext('2d');
    g.fillStyle = color === 'red' ? rgba(col.accent, 1) : color === 'light' ? rgba(lighten(col.accent), 1) : rgba(col.text, 1);
    g.font = `34px ${SYM}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(SUITS[suit], 24, 26);
    return (sprites[id] = c);
  }
  function flyCard(anyY) {
    return {
      x: Math.random() * W, y: anyY ? Math.random() * H : -120 - Math.random() * 200,
      z: .45 + Math.random() * .55, rot: Math.random() * 6.28, vr: (Math.random() - .5) * .7,
      fl: Math.random() * 6.28, vf: .35 + Math.random() * .8, vy: 16 + Math.random() * 24,
      ph: Math.random() * 6.28, suit: Math.random() * 4 | 0, rank: RANKS[Math.random() * RANKS.length | 0]
    };
  }

  function goldDust(anyY) {
    return { x: Math.random() * W, y: anyY ? Math.random() * H : H + 10, r: .6 + Math.random() * 1.6, v: 6 + Math.random() * 16, ph: Math.random() * 6.28 };
  }

  // ---------- Карты 3: веера из карт ----------
  function cardsFan(dt) {
    ctx.clearRect(0, 0, W, H);
    const back = cardBack();
    const sc = Math.min(W, H) / 900 * 2.1;            // размер карт подстраивается под окно
    for (const f of fans) {
      let near = 0;
      if (hasMouse()) near = Math.max(0, 1 - Math.hypot(mouse.sx - f.x, mouse.sy - f.y) / (Math.min(W, H) * .55)) * mouse.pres;
      f.open += (near - f.open) * Math.min(1, dt * 3);
      const spread = .1 + .07 * Math.sin(t * .45 + f.ph) + f.open * .12;   // угол между картами
      for (let i = 0; i < f.n; i++) {
        const top = i === f.n - 1;
        const a = f.rot + (i - (f.n - 1) / 2) * spread;
        let img = back, sx = 1;
        if (top) {
          // верхняя карта иногда переворачивается лицом
          const fl = Math.cos(t * .35 + f.ph);
          sx = Math.max(.05, Math.abs(fl));
          if (fl < 0) img = cardFace(f.suit, f.rank);
          else if (sx < .1) { f.suit = Math.random() * 4 | 0; f.rank = RANKS[Math.random() * RANKS.length | 0]; }
        }
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(a);
        ctx.translate(0, -f.open * 14 * sc);            // при приближении курсора веер приподнимается
        ctx.scale(sc * sx, sc);
        ctx.globalAlpha = .38 + f.open * .4;
        ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 10;
        ctx.drawImage(img, -CW / 2, -CH * 1.05, CW, CH);
        ctx.restore();
      }
    }
    // золотая пыль
    for (const d of dust) {
      d.y -= d.v * dt;
      d.x += Math.sin(t * .6 + d.ph) * 6 * dt;
      if (d.y < -10) Object.assign(d, goldDust(false));
      ctx.globalAlpha = .15 + .45 * (.5 + .5 * Math.sin(t * 2.2 + d.ph * 3));
      ctx.fillStyle = rgba(col.accent, 1);
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- Карты 1: летящие карты ----------
  function cardsFly(dt) {
    ctx.clearRect(0, 0, W, H);
    const back = cardBack();
    for (const c of deck) {
      c.y += c.vy * c.z * dt;
      c.x += Math.sin(t * .5 + c.ph) * 14 * dt;
      c.rot += c.vr * dt;
      c.fl += c.vf * dt;
      if (hasMouse()) {
        const dx = c.x - mouse.sx, dy = c.y - mouse.sy, d = Math.hypot(dx, dy);
        if (d < 190 && d > 1) {
          const f = (190 - d) * 2.4 * dt * mouse.pres;
          c.x += dx / d * f; c.y += dy / d * f; c.rot += f * .004 * Math.sign(dx);
        }
      }
      if (c.y > H + 140) { Object.assign(c, flyCard(false), { z: c.z }); continue; }
      const f = Math.cos(c.fl);
      const img = f >= 0 ? cardFace(c.suit, c.rank) : back;
      const s = c.z * 1.25;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.rot);
      ctx.scale(Math.max(.05, Math.abs(f)) * s, s);
      ctx.globalAlpha = .18 + c.z * .5;
      ctx.drawImage(img, -CW / 2, -CH / 2, CW, CH);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- Карты 2: узор из мастей с волной ----------
  function cardsSuits() {
    ctx.clearRect(0, 0, W, H);
    const sp = 56, R = 220, sz = 26;
    let row = 0;
    for (let y = sp / 2; y < H + sp; y += sp * .866, row++) {
      let col_ = 0;
      for (let x = (row & 1) ? sp : sp / 2; x < W + sp; x += sp, col_++) {
        const suit = (col_ + row * 2) % 4;
        const w = Math.sin(x * .006 + y * .004 - t * .8);
        const flip = Math.cos(x * .004 - t * .55 + y * .003);
        let near = 0;
        if (hasMouse()) near = Math.max(0, 1 - Math.hypot(x - mouse.sx, y - mouse.sy) / R) * mouse.pres;
        const sc = (.75 + w * .2 + near * .7);
        const a = Math.min(1, .1 + (w + 1) * .07 + near * .75);
        const img = suitGlyph(suit, near > .05 ? (isRed(suit) ? 'light' : 'red') : 'cream');
        ctx.globalAlpha = a;
        ctx.setTransform(K * sc * Math.max(.1, Math.abs(flip)), 0, 0, K * sc, K * x, K * y);
        ctx.drawImage(img, -sz / 2, -sz / 2, sz, sz);
      }
    }
    ctx.setTransform(K, 0, 0, K, 0, 0);
    ctx.globalAlpha = 1;
  }

  function spark(anyY) {
    const hz = H * .6;
    return {
      x: Math.random() * W, y: anyY ? Math.random() * hz : hz + Math.random() * 40,
      s: 1 + Math.random() * 2.2, v: 8 + Math.random() * 26, ph: Math.random() * 6.28,
      a: Math.random() < .25
    };
  }

  // ---------- Неон 1: ретро-горизонт ----------
  function neonHorizon(dt) {
    ctx.clearRect(0, 0, W, H);
    const hz = H * .6;
    const vx = W / 2 + (mouse.sx / W - .5) * -70 * mouse.pres;

    const sr = Math.min(W, H) * .2;
    ctx.save();
    ctx.beginPath(); ctx.arc(vx, hz, sr, Math.PI, 0); ctx.closePath(); ctx.clip();
    const g = ctx.createLinearGradient(0, hz - sr, 0, hz);
    g.addColorStop(0, rgba(col.accent, .55)); g.addColorStop(1, rgba(col.accent, .08));
    ctx.fillStyle = g; ctx.fillRect(vx - sr, hz - sr, sr * 2, sr);
    ctx.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 9; k++) {
      const p = ((k + t * .25) % 9) / 9;
      ctx.fillRect(vx - sr, hz - sr * (1 - p), sr * 2, 1 + p * 7);
    }
    ctx.restore();

    const hg = ctx.createLinearGradient(0, hz - 60, 0, hz + 60);
    hg.addColorStop(0, rgba(col.accent, 0)); hg.addColorStop(.5, rgba(col.accent, .18)); hg.addColorStop(1, rgba(col.accent, 0));
    ctx.fillStyle = hg; ctx.fillRect(0, hz - 60, W, 120);
    ctx.fillStyle = rgba(col.accent, .7); ctx.fillRect(0, hz, W, 1);

    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(col.accent, .2);
    ctx.beginPath();
    for (let i = -40; i <= 40; i++) {
      ctx.moveTo(vx + i * W * .006, hz);
      ctx.lineTo(vx + i * W * .09, H);
    }
    ctx.stroke();
    const off = (t * .55) % 1;
    for (let n = 0; n < 26; n++) {
      const z = n + 1 - off;
      const y = hz + (H - hz) * (.55 / z);
      if (y > H || y < hz) continue;
      ctx.fillStyle = rgba(col.accent, Math.min(.45, (y - hz) / (H - hz) * .9));
      ctx.fillRect(0, y, W, 1);
    }

    for (const p of parts) {
      p.y -= p.v * dt;
      if (p.y < -10) Object.assign(p, spark(false));
      const fade = Math.min(1, p.y / (hz * .5));
      ctx.fillStyle = rgba(p.a ? col.accent : col.text, (.25 + .25 * Math.sin(t * 3 + p.ph)) * fade);
      ctx.fillRect(p.x + Math.sin(t + p.ph) * 6, p.y, p.s, p.s);
    }

    const sy = (t * 70) % (H + 300) - 150;
    const sg = ctx.createLinearGradient(0, sy - 90, 0, sy + 30);
    sg.addColorStop(0, rgba(col.text, 0)); sg.addColorStop(.75, rgba(col.text, .045)); sg.addColorStop(1, rgba(col.text, 0));
    ctx.fillStyle = sg; ctx.fillRect(0, sy - 90, W, 120);
  }

  // ---------- Неон 2: соты с энергетическими волнами ----------
  function neonHex() {
    ctx.clearRect(0, 0, W, H);
    if (t > nextPulse) {
      pulses.push({ x: Math.random() * W, y: Math.random() * H, t0: t });
      nextPulse = t + 1.6 + Math.random() * 1.8;
    }
    pulses = pulses.filter(p => t - p.t0 < 4.5);
    const s = 30, R = s - 3;
    ctx.lineWidth = 1.2;
    for (const h of hexes) {
      let e = 0;
      for (const p of pulses) {
        const age = t - p.t0, r = age * 260;
        const d = Math.hypot(h.x - p.x, h.y - p.y);
        const k = (d - r) / 46;
        e += Math.exp(-k * k) * Math.max(0, 1 - age / 4.5);
      }
      if (hasMouse()) e += Math.max(0, 1 - Math.hypot(h.x - mouse.sx, h.y - mouse.sy) / 170) * .9 * mouse.pres;
      e = Math.min(1, e);
      h.e += (e - h.e) * .25;
      const a = .045 + h.e * .55;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = Math.PI / 3 * i + Math.PI / 6;
        const px = h.x + R * Math.cos(ang), py = h.y + R * Math.sin(ang);
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
      if (h.e > .05) { ctx.fillStyle = rgba(col.accent, h.e * .13); ctx.fill(); }
      ctx.strokeStyle = h.e > .05 ? rgba(col.accent, a) : rgba(col.text, a);
      ctx.stroke();
    }
    // мягкое свечение сверху, как у остальной темы
    const g = ctx.createRadialGradient(W / 2, -H * .2, 0, W / 2, -H * .2, H * .9);
    g.addColorStop(0, rgba(col.accent, .12)); g.addColorStop(1, rgba(col.accent, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  // ---------- Неон 3: гиперпрыжок ----------
  function neonWarp(dt) {
    ctx.clearRect(0, 0, W, H);
    // крейсерская скорость + «рывок» раз в 12 секунд (плавно разгоняется и тормозит)
    const cyc = t % 12;
    const boost = cyc > 9 ? Math.sin((cyc - 9) / 3 * Math.PI) : 0;
    const speed = .1 + boost * boost * .75;
    const cx = W / 2 + (mouse.sx - W / 2) * .18 * mouse.pres;
    const cy = H * .46 + (mouse.sy - H * .46) * .18 * mouse.pres;
    const f = Math.min(W, H) * .55;

    // свечение в точке схода
    const gr = Math.min(W, H) * (.35 + boost * .15);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, gr);
    g.addColorStop(0, rgba(col.accent, .16 + boost * .14)); g.addColorStop(1, rgba(col.accent, 0));
    ctx.fillStyle = g; ctx.fillRect(cx - gr, cy - gr, gr * 2, gr * 2);

    ctx.lineCap = 'round';
    for (const s of warp) {
      s.z -= speed * dt;
      if (s.z <= .02) { Object.assign(s, warpStar(1)); continue; }
      const trail = Math.min(.45, speed * (.45 + boost * .6));
      const zt = Math.min(1, s.z + trail);
      const x1 = cx + s.x / s.z * f, y1 = cy + s.y / s.z * f;
      const x0 = cx + s.x / zt * f, y0 = cy + s.y / zt * f;
      if (x1 < -50 || x1 > W + 50 || y1 < -50 || y1 > H + 50) { Object.assign(s, warpStar(1)); continue; }
      const near = 1 - s.z;
      ctx.strokeStyle = rgba(s.a ? col.accent : col.text, Math.min(.95, near * 1.1 + .08));
      ctx.lineWidth = .8 + near * 2.6 + boost;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
    // лёгкое затемнение по краям, чтобы плитки читались
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .75);
    v.addColorStop(0, rgba(col.bg, 0)); v.addColorStop(1, rgba(col.bg, .4));
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }

  // ---------- Стекло 1: перетекающие пятна ----------
  function glassBlobs() {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = rgba(col.bg, 1);
    ctx.fillRect(0, 0, W, H);
    const M = Math.max(W, H);
    const draw = (x, y, R, c, a) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, rgba(c, a)); g.addColorStop(.55, rgba(c, a * .35)); g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g; ctx.fillRect(x - R, y - R, R * 2, R * 2);
    };
    ctx.globalCompositeOperation = 'screen';
    for (const b of blobs) {
      const x = W * (b.cx + b.rx * Math.sin(t * b.sp + b.ph));
      const y = H * (b.cy + b.ry * Math.cos(t * b.sp * .8 + b.ph * 1.3));
      draw(x, y, M * b.r * (1 + .08 * Math.sin(t * .3 + b.ph)), b.c, .55);
    }
    if (hasMouse()) draw(mouse.sx, mouse.sy, M * .16, col.accent, .35 * mouse.pres);
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------- Стекло 2: шёлковые ленты ----------
  function glassSilk() {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = rgba(col.bg, 1);
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'screen';
    const ribbons = [
      { c: col.accent, y: .3, a1: .09, f1: .0021, s1: .32, a2: .05, f2: .0047, s2: .21, ph: 0 },
      { c: [120, 90, 255], y: .55, a1: .11, f1: .0017, s1: .26, a2: .04, f2: .0053, s2: .3, ph: 2 },
      { c: [60, 180, 255], y: .78, a1: .08, f1: .0025, s1: .37, a2: .05, f2: .0039, s2: .18, ph: 4 }
    ];
    ctx.lineWidth = 1.6;
    for (const rb of ribbons) {
      for (let j = 0; j < 22; j++) {
        const fade = Math.sin(j / 21 * Math.PI);
        ctx.strokeStyle = rgba(rb.c, .08 + fade * .46);
        ctx.beginPath();
        for (let x = -60; x <= W + 60; x += 24) {
          let y = H * rb.y
            + Math.sin(x * rb.f1 + t * rb.s1 + rb.ph + j * .06) * H * rb.a1
            + Math.sin(x * rb.f2 - t * rb.s2 + j * .11) * H * rb.a2
            + j * 5;
          if (hasMouse()) {
            const k = (x - mouse.sx) / 220;
            y += Math.exp(-k * k) * (mouse.sy - y) * .25 * mouse.pres;
          }
          x === -60 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------- Тишина 1: волна по сетке точек ----------
  function calmDots() {
    ctx.clearRect(0, 0, W, H);
    const sp = 30, R = 190;
    for (let y = sp / 2; y < H; y += sp) {
      for (let x = sp / 2; x < W; x += sp) {
        const w = Math.sin(x * .007 + t * .5) * Math.cos(y * .009 - t * .35);
        const dx = x - mouse.sx, dy = y - mouse.sy;
        const near = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / R) * mouse.pres;
        const r = .9 + (w + 1) * .35 + near * 1.8;
        const a = .07 + (w + 1) * .06 + near * .55;
        ctx.fillStyle = near > .02 ? rgba(col.accent, a) : rgba(col.text, a);
        ctx.beginPath();
        ctx.arc(x + near * dx * -.08, y + w * 3 + near * dy * -.08, r, 0, 6.283);
        ctx.fill();
      }
    }
  }

  // ---------- Тишина 2: созвездия ----------
  function calmStars(dt) {
    ctx.clearRect(0, 0, W, H);
    const L = 130, LM = 190;
    for (const p of stars) {
      if (hasMouse()) {
        const dx = mouse.sx - p.x, dy = mouse.sy - p.y, d = Math.hypot(dx, dy);
        if (d < LM && d > 1) { p.vx += dx / d * 6 * dt * mouse.pres; p.vy += dy / d * 6 * dt * mouse.pres; }
      }
      p.vx *= .995; p.vy *= .995;
      const sp = Math.hypot(p.vx, p.vy);
      if (sp < 2) { p.vx += (Math.random() - .5) * .6; p.vy += (Math.random() - .5) * .6; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.x < -20) p.x = W + 20; else if (p.x > W + 20) p.x = -20;
      if (p.y < -20) p.y = H + 20; else if (p.y > H + 20) p.y = -20;
    }
    ctx.lineWidth = 1;
    for (let i = 0; i < stars.length; i++) {
      const a = stars[i];
      for (let j = i + 1; j < stars.length; j++) {
        const b = stars[j];
        const dx = a.x - b.x; if (dx > L || dx < -L) continue;
        const dy = a.y - b.y; if (dy > L || dy < -L) continue;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > L) continue;
        const mx = (a.x + b.x) / 2 - mouse.sx, my = (a.y + b.y) / 2 - mouse.sy;
        const near = Math.max(0, 1 - Math.sqrt(mx * mx + my * my) / LM) * mouse.pres;
        const alpha = (1 - d / L) * (.13 + near * .6);
        ctx.strokeStyle = near > .05 ? rgba(col.accent, alpha) : rgba(col.text, alpha);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    for (const p of stars) {
      const near = hasMouse() ? Math.max(0, 1 - Math.hypot(p.x - mouse.sx, p.y - mouse.sy) / LM) * mouse.pres : 0;
      ctx.fillStyle = near > .05 ? rgba(col.accent, .4 + near * .5) : rgba(col.text, .3);
      ctx.beginPath(); ctx.arc(p.x, p.y, 1.3 + near * 1.4, 0, 6.283); ctx.fill();
    }
  }

  const DRAW = { cards0: cardsFly, cards1: cardsSuits, cards2: cardsFan, neon0: neonHorizon, neon1: neonHex, neon2: neonWarp, glass0: glassBlobs, glass1: glassSilk, calm0: calmDots, calm1: calmStars };

  function frame(now) {
    // «Стеклу» хватает 30 кадров: движение медленное, а размытие панелей пересчитывается реже
    if (theme === 'glass' && last && now - last < 30) { raf = requestAnimationFrame(frame); return; }
    const dt = Math.min(.05, (now - last) / 1000 || 0);
    last = now; t += dt;
    const k = 1 - Math.pow(.92, dt * 60);          // одинаковая плавность при любой частоте кадров
    mouse.sx += (mouse.x - mouse.sx) * k;
    mouse.sy += (mouse.y - mouse.sy) * k;
    mouse.pres += ((mouse.inside ? 1 : 0) - mouse.pres) * (1 - Math.pow(.95, dt * 60));
    (DRAW[key] || calmDots)(dt);
    raf = reduce.matches ? 0 : requestAnimationFrame(frame);
  }
  function start() {
    cancelAnimationFrame(raf);
    if (!enabled || document.hidden) { raf = 0; return; }
    last = 0;
    raf = requestAnimationFrame(frame);
  }

  window.FX = {
    set(newTheme, on, newVariant) {
      const prev = col;
      col = { accent: hex(cssVar('--accent')), text: hex(cssVar('--text')), bg: hex(cssVar('--bg')), tile: hex(cssVar('--tile')) };
      if (prev.accent + '' !== col.accent + '' || prev.tile + '' !== col.tile + '' || prev.text + '' !== col.text + '') sprites = {};   // цвета поменялись — перерисуем карты
      theme = newTheme;
      variant = Math.max(0, newVariant | 0);
      const newKey = theme + variant;
      const changed = newKey !== key;
      key = newKey;
      if (changed) resize();
      else if (key === 'glass0' && blobs[0]) blobs[0].c = col.accent;
      if (on !== enabled || changed) { enabled = on; start(); }
      if (!on) ctx.clearRect(0, 0, W, H);
    }
  };

  addEventListener('resize', () => { if (key) resize(); });
  addEventListener('mousemove', e => {
    mouse.x = e.clientX; mouse.y = e.clientY;
    // курсора давно не было — эффект почти погас, можно незаметно перенести точку к курсору
    if (mouse.pres < .02) { mouse.sx = e.clientX; mouse.sy = e.clientY; }
    mouse.inside = true;
  });
  // курсор ушёл со страницы: точка остаётся на месте, а влияние плавно гаснет
  document.documentElement.addEventListener('mouseleave', () => { mouse.inside = false; });
  addEventListener('blur', () => { mouse.inside = false; });
  document.addEventListener('visibilitychange', start);
})();
