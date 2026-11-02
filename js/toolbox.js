// "Tools of the trade": skills as bubbles in glass bins, on one canvas with a small 2D physics sim
// (Verlet circles, bin walls as segments). Drag a bubble into another bin, shake them all, put them
// back, or tap one to read where it was used. The loop runs only while the canvas is on screen and
// something is moving. With reduced motion the bubbles settle once and nothing moves untouched.

const SANS = '"SF Pro Text", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';
const G = 0.32, DAMP = 0.992, WALL = 3, BASE_FS = 13;

const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const mix = (hex, to, k) => {
  const a = parseInt(hex.slice(1), 16), b = parseInt(to.slice(1), 16);
  const ch = (s) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
};

export function mountToolbox(canvas, { groups, onPick, still }) {
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, dpr = 1, bins = [], bubbles = [], grabbed = null, raf = 0, visible = false, calm = 0;
  const ptr = { x: 0, y: 0, vx: 0, vy: 0, ox: 0, oy: 0, downX: 0, downY: 0, downT: 0, id: null };

  // ---- layout: bins in a row on wide screens, a grid on narrow ones ----
  function layout() {
    const r = canvas.getBoundingClientRect();
    W = r.width; dpr = Math.min(devicePixelRatio || 1, 2);
    const cols = W >= 900 ? groups.length : W >= 520 ? 3 : 2, rows = Math.ceil(groups.length / cols);
    // the canvas sets its own height from its row count, so CSS breakpoints can't disagree with it
    H = rows === 1 ? Math.round(Math.min(520, Math.max(440, W * 0.4))) : rows === 2 ? 820 : 1000;
    if (Math.round(r.height) !== H) canvas.style.height = `${H}px`;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const cellW = W / cols, cellH = H / rows;
    bins = groups.map((g, i) => {
      const cx = cellW * (i % cols + 0.5), row = Math.floor(i / cols);
      const wTop = Math.min(cellW * 0.88, 240), wBot = wTop * 0.76;
      const top = row * cellH + cellH * 0.1, bottom = (row + 1) * cellH - 54;
      const l = [cx - wTop / 2, top], bl = [cx - wBot / 2, bottom], br = [cx + wBot / 2, bottom], rt = [cx + wTop / 2, top];
      return { g, cx, top, bottom, wTop, wBot, segs: [[l, bl], [bl, br], [br, rt]], count: 0 };
    });
    size();
    fill();
  }

  // Bubbles fit their labels; one shared scale makes sure the fullest bin still holds all of its skills.
  function size() {
    const raw = groups.map((g, gi) => g.skills.map(([label, note]) => {
      ctx.font = `600 ${BASE_FS}px ${SANS}`;
      let lines = [label];
      if (label.includes(" ") && ctx.measureText(label).width > 84) {
        const words = label.split(" ");
        let best = 1, bestW = Infinity;
        for (let k = 1; k < words.length; k++) {
          const w = Math.max(ctx.measureText(words.slice(0, k).join(" ")).width, ctx.measureText(words.slice(k).join(" ")).width);
          if (w < bestW) { bestW = w; best = k; }
        }
        lines = [words.slice(0, best).join(" "), words.slice(best).join(" ")];
      }
      const w = Math.max(...lines.map((l) => ctx.measureText(l).width));
      return { label, note, gi, home: gi, lines, r0: Math.max(w / 2 + 8, lines.length * BASE_FS * 0.62 + 9, 19) };
    }));
    let s = 1.15;
    raw.forEach((list, gi) => {
      const b = bins[gi], area = ((b.wTop + b.wBot) / 2) * (b.bottom - b.top);
      const need = list.reduce((a, x) => a + Math.PI * x.r0 * x.r0, 0) * 1.25;
      s = Math.min(s, Math.sqrt((area * 0.62) / need));
    });
    bubbles = raw.flat().map((x) => ({ ...x, r: Math.min(x.r0 * s, bins[x.gi].wBot / 2 - 4), fs: Math.max(8.5, BASE_FS * s), x: 0, y: 0, px: 0, py: 0 }));
  }

  // Stack each bin from the bottom, then let it settle before the first frame.
  function fill() {
    for (const [gi, b] of bins.entries()) {
      let y = b.bottom - WALL, rowH = 0, x = null;
      for (const p of bubbles.filter((p) => p.home === gi)) {
        const half = (b.wBot + (b.wTop - b.wBot) * ((b.bottom - y) / (b.bottom - b.top))) / 2 - WALL;
        if (x === null || x + p.r > b.cx + half) { y -= rowH; rowH = 0; x = b.cx - half; }
        p.x = p.px = x + p.r; p.y = p.py = y - p.r;
        x += p.r * 2; rowH = Math.max(rowH, p.r * 2);
      }
    }
    for (let i = 0; i < 400; i++) step();
    for (const p of bubbles) { p.px = p.x; p.py = p.y; }
  }

  // ---- physics ----
  function step() {
    for (const p of bubbles) {
      if (p === grabbed) continue;
      let vx = (p.x - p.px) * DAMP, vy = (p.y - p.py) * DAMP;
      const cap = p.r * 0.8, v = Math.hypot(vx, vy);
      if (v > cap) { vx *= cap / v; vy *= cap / v; }
      p.px = p.x; p.py = p.y;
      p.x += vx; p.y += vy + G;
    }
    for (let k = 0; k < 3; k++) { collideBubbles(); collideWalls(); }
  }

  function collideBubbles() {
    for (let i = 0; i < bubbles.length; i++) {
      const a = bubbles[i];
      for (let j = i + 1; j < bubbles.length; j++) {
        const b = bubbles[j], dx = b.x - a.x, dy = b.y - a.y, min = a.r + b.r, d2 = dx * dx + dy * dy;
        if (d2 >= min * min || d2 === 0) continue;
        const d = Math.sqrt(d2), push = (min - d) / d;
        const wa = a === grabbed ? 0 : b === grabbed ? 1 : 0.5, wb = 1 - wa;
        a.x -= dx * push * wa; a.y -= dy * push * wa;
        b.x += dx * push * wb; b.y += dy * push * wb;
      }
    }
  }

  function collideWalls() {
    for (const p of bubbles) {
      if (p === grabbed) continue;
      for (const b of bins) for (const [[x1, y1], [x2, y2]] of b.segs) {
        const sx = x2 - x1, sy = y2 - y1, t = Math.max(0, Math.min(1, ((p.x - x1) * sx + (p.y - y1) * sy) / (sx * sx + sy * sy)));
        const cx = x1 + sx * t, cy = y1 + sy * t, dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy), min = p.r + WALL;
        if (d >= min) continue;
        const nx = d ? dx / d : -sy / Math.hypot(sx, sy), ny = d ? dy / d : sx / Math.hypot(sx, sy), pen = min - d;
        p.x += nx * pen; p.y += ny * pen;
        p.px += nx * pen * 0.6; p.py += ny * pen * 0.6; // soaks up most of the bounce
        // balanced on a rim: tip it into whichever side it leans towards
        if (t === 0 && y1 === b.top && Math.abs(p.x - x1) < 2) p.x += p.x < b.cx ? -0.4 : 0.4;
        if (t === 1 && y2 === b.top && Math.abs(p.x - x2) < 2) p.x += p.x > b.cx ? 0.4 : -0.4;
      }
      if (p.x < p.r) { p.x = p.r; p.px = p.x + (p.x - p.px) * 0.3; }
      if (p.x > W - p.r) { p.x = W - p.r; p.px = p.x + (p.x - p.px) * 0.3; }
      if (p.y > H - p.r) { p.y = H - p.r; p.py = p.y + (p.y - p.py) * 0.3; }
    }
  }

  // ---- drawing ----
  function draw() {
    const css = getComputedStyle(document.documentElement);
    const fg = css.getPropertyValue("--text").trim() || "#e9ecea", muted = css.getPropertyValue("--muted").trim() || "#a1a9ad";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (const b of bins) b.count = 0;
    for (const p of bubbles) {
      const b = bins.find((b) => Math.abs(p.x - b.cx) < b.wTop / 2 && p.y > b.top - p.r && p.y < b.bottom);
      if (b) b.count++;
    }
    const outline = (b) => { ctx.beginPath(); ctx.moveTo(b.cx - b.wTop / 2, b.top); ctx.lineTo(b.cx - b.wBot / 2, b.bottom); ctx.lineTo(b.cx + b.wBot / 2, b.bottom); ctx.lineTo(b.cx + b.wTop / 2, b.top); };
    for (const b of bins) {
      outline(b); ctx.closePath();
      const gr = ctx.createLinearGradient(0, b.top, 0, b.bottom);
      gr.addColorStop(0, hexA(b.g.color, 0.02)); gr.addColorStop(1, hexA(b.g.color, 0.14));
      ctx.fillStyle = gr; ctx.fill();
    }
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (const p of bubbles) {
      const c = groups[p.gi].color;
      const gr = ctx.createRadialGradient(p.x - p.r * 0.35, p.y - p.r * 0.4, p.r * 0.1, p.x, p.y, p.r);
      gr.addColorStop(0, mix(c, "#ffffff", 0.4)); gr.addColorStop(0.7, c); gr.addColorStop(1, mix(c, "#000000", 0.2));
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 0.78, -2.6, -1.7); ctx.stroke();
      if (p === grabbed) { ctx.strokeStyle = hexA(c, 0.55); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, p.r + 4, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = "#fff"; ctx.font = `600 ${p.fs}px ${SANS}`;
      const lh = p.fs * 1.1, y0 = p.y - ((p.lines.length - 1) * lh) / 2;
      p.lines.forEach((l, i) => ctx.fillText(l, p.x, y0 + i * lh));
    }
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    for (const b of bins) {
      outline(b); ctx.strokeStyle = hexA(fg.startsWith("#") && fg.length === 7 ? fg : "#e9ecea", 0.3); ctx.lineWidth = 2.5; ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.35)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(b.cx - b.wTop / 2 + 9, b.top + 14); ctx.lineTo(b.cx - b.wBot / 2 + 8, b.bottom - 14); ctx.stroke();
      ctx.strokeStyle = b.g.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(b.cx - b.wTop / 2 - 4, b.top); ctx.lineTo(b.cx + b.wTop / 2 + 4, b.top); ctx.stroke();
      ctx.textBaseline = "top";
      ctx.fillStyle = fg; ctx.font = `600 ${W < 520 ? 13 : 15}px ${SANS}`; ctx.fillText(b.g.name, b.cx, b.bottom + 12);
      ctx.fillStyle = muted; ctx.font = `500 ${W < 520 ? 10.5 : 11.5}px ${MONO}`; ctx.fillText(`${b.count} inside`, b.cx, b.bottom + (W < 520 ? 30 : 33));
      ctx.textBaseline = "middle";
    }
  }

  // ---- loop: runs while on screen and something is moving ----
  function frame() {
    raf = 0;
    step(); draw();
    const moving = grabbed || bubbles.some((p) => Math.abs(p.x - p.px) + Math.abs(p.y - p.py) > 0.06);
    calm = moving ? 0 : calm + 1;
    if (visible && calm < 20) raf = requestAnimationFrame(frame);
  }
  const wake = () => { calm = 0; if (visible && !raf) raf = requestAnimationFrame(frame); };

  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake(); }).observe(canvas);
  let resizeT = 0;
  new ResizeObserver(() => { clearTimeout(resizeT); resizeT = setTimeout(() => { layout(); draw(); }, 120); }).observe(canvas);
  new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // Now and then a bubble hops, so the bins never sit quite still.
  if (!still) setInterval(() => {
    if (!visible || grabbed || document.hidden) return;
    const p = bubbles[Math.floor(Math.random() * bubbles.length)];
    p.py = p.y + 3 + Math.random() * 3; p.px = p.x + (Math.random() - 0.5) * 1.5;
    wake();
  }, 2600);

  // ---- input ----
  const at = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const hit = (x, y) => bubbles.reduce((best, p) => { const d = Math.hypot(p.x - x, p.y - y); return d < p.r && (!best || d < best.d) ? { p, d } : best; }, null)?.p;

  // A finger that lands on a bubble grabs it and stops the page scrolling; anywhere else still scrolls.
  canvas.addEventListener("touchstart", (e) => { const [x, y] = at(e.touches[0]); if (hit(x, y)) e.preventDefault(); }, { passive: false });
  canvas.addEventListener("pointerdown", (e) => {
    const [x, y] = at(e), p = hit(x, y);
    if (!p) { onPick(null); return; }
    grabbed = p; ptr.id = e.pointerId; ptr.ox = p.x - x; ptr.oy = p.y - y;
    ptr.x = ptr.downX = x; ptr.y = ptr.downY = y; ptr.vx = ptr.vy = 0; ptr.downT = performance.now();
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = "grabbing";
    wake();
  });
  canvas.addEventListener("pointermove", (e) => {
    const [x, y] = at(e);
    if (!grabbed || e.pointerId !== ptr.id) { canvas.style.cursor = hit(x, y) ? "grab" : ""; return; }
    ptr.vx = ptr.vx * 0.5 + (x - ptr.x) * 0.5; ptr.vy = ptr.vy * 0.5 + (y - ptr.y) * 0.5;
    ptr.x = x; ptr.y = y;
    grabbed.px = grabbed.x; grabbed.py = grabbed.y;
    grabbed.x = Math.max(grabbed.r, Math.min(W - grabbed.r, x + ptr.ox));
    grabbed.y = Math.max(grabbed.r, Math.min(H - grabbed.r, y + ptr.oy));
    wake();
  });
  const release = (e) => {
    if (!grabbed || e.pointerId !== ptr.id) return;
    const p = grabbed;
    grabbed = null; canvas.style.cursor = "";
    const tap = Math.hypot(ptr.x - ptr.downX, ptr.y - ptr.downY) < 6 && performance.now() - ptr.downT < 400;
    p.px = p.x - ptr.vx; p.py = p.y - ptr.vy; // throw with the pointer's last velocity
    onPick(tap ? p : null);
    wake();
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  layout();
  draw();

  return {
    shake() {
      for (const p of bubbles) { p.py = p.y + 7 + Math.random() * 7; p.px = p.x + (Math.random() - 0.5) * 5; }
      onPick(null); wake();
    },
    tidy() {
      for (const p of bubbles) {
        const b = bins[p.home];
        if (Math.abs(p.x - b.cx) < b.wTop / 2 && p.y > b.top && p.y < b.bottom) continue;
        p.x = p.px = b.cx + (Math.random() - 0.5) * b.wBot * 0.5;
        p.y = p.py = b.top - p.r - Math.random() * 80;
      }
      onPick(null); wake();
    },
  };
}
