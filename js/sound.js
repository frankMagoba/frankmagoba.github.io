// Small synthesised sound cues, off until the visitor turns them on. No audio files:
// every cue is built from oscillators and filtered noise with the Web Audio API.

let ctx = null, out = null, noiseBuf = null, on = false;

function start() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  out = ctx.createGain(); out.gain.value = 0.5; out.connect(ctx.destination);
  // one second of white noise, reused by every click and key tick
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

function env(g, t, peak, dur) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

// A pitched note; `glide` multiplies the pitch by the end of the note.
function tone(freq, { at = 0, dur = 0.12, type = "sine", gain = 0.12, glide = 0 } = {}) {
  const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (glide) o.frequency.exponentialRampToValueAtTime(freq * glide, t + dur);
  env(g, t, gain, dur);
  o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
}

// A burst of band-passed noise: clicks, ticks, whooshes.
function hiss({ at = 0, dur = 0.03, gain = 0.1, freq = 3000, q = 1 } = {}) {
  const t = ctx.currentTime + at, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q;
  env(g, t, gain, dur);
  s.connect(f).connect(g).connect(out); s.start(t, Math.random() * 0.9); s.stop(t + dur + 0.05);
}

const CUES = {
  on: () => { tone(587.33, { dur: 0.14, gain: 0.08 }); tone(880, { at: 0.08, dur: 0.22, gain: 0.07 }); },
  key: () => hiss({ dur: 0.018, gain: 0.05, freq: 3500 + Math.random() * 1500, q: 4 }),
  click: () => { hiss({ dur: 0.025, gain: 0.12, freq: 2200, q: 2 }); tone(1400, { dur: 0.03, type: "square", gain: 0.015 }); },
  open: () => { hiss({ dur: 0.12, gain: 0.05, freq: 1200, q: 0.7 }); tone(330, { dur: 0.18, type: "triangle", gain: 0.06, glide: 1.5 }); },
  close: () => tone(495, { dur: 0.15, type: "triangle", gain: 0.05, glide: 0.66 }),
  flip: () => { hiss({ dur: 0.14, gain: 0.1, freq: 2400, q: 0.7 }); tone(392, { at: 0.05, dur: 0.12, type: "triangle", gain: 0.03, glide: 1.5 }); },
  plug: () => { hiss({ dur: 0.04, gain: 0.3, freq: 3200, q: 2 }); hiss({ at: 0.025, dur: 0.07, gain: 0.15, freq: 900 }); },
  unlock: () => { hiss({ dur: 0.05, gain: 0.25, freq: 2600, q: 3 }); [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, { at: 0.08 + i * 0.09, dur: 0.3, type: "triangle", gain: 0.07 })); },
  deny: () => tone(150, { dur: 0.16, type: "square", gain: 0.04, glide: 0.7 }),
  ship: () => { tone(659.25, { dur: 0.12, type: "triangle", gain: 0.06 }); tone(987.77, { at: 0.09, dur: 0.24, type: "triangle", gain: 0.06 }); },
  boot: () => [261.63, 392, 523.25, 783.99].forEach((f, i) => tone(f, { at: i * 0.07, dur: 0.5, type: "triangle", gain: 0.05 })),
};

export const sound = {
  get on() { return on; },
  set(v) {
    on = !!v;
    if (on) { start(); if (ctx?.state === "suspended") ctx.resume(); }
  },
  play(name) {
    if (!on || !ctx || !CUES[name]) return;
    try { CUES[name](); } catch { /* sound is optional */ }
  },
};

// Hooks the page up: the toggle, clicks, typing, the terminal dialog and typed-out answers.
// Listens from outside, so the ask widget and terminal don't need to know about sound.
export function wireSound(toggle) {
  if (!(window.AudioContext || window.webkitAudioContext)) { toggle.hidden = true; return; }
  const set = (v, cue) => {
    sound.set(v);
    toggle.setAttribute("aria-pressed", String(v));
    try { localStorage.setItem("sound", v ? "1" : "0"); } catch {}
    if (cue) sound.play("on");
  };
  toggle.addEventListener("click", () => set(toggle.getAttribute("aria-pressed") !== "true", true));

  // Browsers only start audio after a gesture, so a remembered "on" waits for the first one.
  let want = false;
  try { want = localStorage.getItem("sound") === "1"; } catch {}
  if (want) {
    toggle.setAttribute("aria-pressed", "true");
    const go = (e) => {
      removeEventListener("pointerdown", go, true); removeEventListener("keydown", go, true);
      if (e.target.closest?.("#sound")) return; // the toggle's own click handles it
      set(true, false);
    };
    addEventListener("pointerdown", go, true); addEventListener("keydown", go, true);
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("button, a, summary") && !e.target.closest("#sound")) sound.play("click");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key?.length === 1 && /INPUT|TEXTAREA/.test(e.target.tagName)) sound.play("key");
  });

  const term = document.getElementById("term");
  if (term) new MutationObserver(() => sound.play(term.open ? "open" : "close")).observe(term, { attributes: true, attributeFilter: ["open"] });

  // Typed-out answers tick as they print, at most every 45 ms.
  let last = 0;
  const tick = () => { const t = performance.now(); if (t - last > 45) { last = t; sound.play("key"); } };
  for (const log of document.querySelectorAll(".aterm-log, .term-out")) {
    new MutationObserver(tick).observe(log, { childList: true, subtree: true, characterData: true });
  }
}
