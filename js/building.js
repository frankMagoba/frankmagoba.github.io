// "Now building": Keyhold. Drag the vault key into the lock (or just click it, or press Enter) and the
// readout below decrypts from scrambled text into the project's real description. A short drag springs
// back. Screen readers get the real text throughout; the scramble is decoration.
import { sound } from "./sound.js";

const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const CIPHER = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/";
// spaces stay, so the scrambled lines wrap like the real ones
const scramble = (text) => text.replace(/\S/g, () => CIPHER[Math.floor(Math.random() * CIPHER.length)]);
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export function mountBuilding(root, project) {
  const rows = [["what", `${project.what}.`], ["how", `${project.role}.`], ["stack", project.stack.join(" · ")]];
  const gate = root.querySelector(".kh-gate"), key = root.querySelector(".kh-key"), lock = root.querySelector(".kh-lock");
  const status = root.querySelector(".kh-lock .st"), live = root.querySelector(".kh-live"), vault = root.querySelector(".kh-vault");
  const state = vault.querySelector(".kh-state"), relock = root.querySelector(".kh-relock");

  vault.querySelector("dl").innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd><span class="kh-text" aria-hidden="true"></span><span class="sr"></span></dd></div>`).join("");
  const cells = [...vault.querySelectorAll("dd")].map((dd, i) => {
    dd.querySelector(".sr").textContent = rows[i][1];
    return { el: dd.querySelector(".kh-text"), text: rows[i][1] };
  });

  const setStatus = (t) => { status.textContent = t; };
  function lockVault() {
    gate.classList.remove("granted");
    vault.classList.remove("open");
    state.textContent = "locked";
    for (const c of cells) c.el.textContent = scramble(c.text);
    setStatus("Drag to unlock");
    relock.hidden = true;
  }

  // Each character settles left to right over about a second; unsettled ones keep changing.
  function decrypt() {
    vault.classList.add("open");
    state.textContent = "unlocked";
    if (still()) { for (const c of cells) c.el.textContent = c.text; return; }
    const t0 = performance.now(), dur = 1100;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      for (const c of cells) {
        const upto = Math.floor(c.text.length * k);
        c.el.textContent = c.text.slice(0, upto) + scramble(c.text.slice(upto));
      }
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  const setX = (x) => key.style.setProperty("--x", `${x.toFixed(1)}px`);
  // how far the key's middle must travel to reach the lock's slot
  const need = () => Math.max(40, lock.offsetLeft + lock.offsetWidth / 2 - (key.offsetLeft + key.offsetWidth / 2));
  let drag = null, moved = false, timer = 0;

  function grant() {
    gate.classList.remove("reading", "dragging");
    gate.classList.add("granted");
    setX(need() + key.offsetWidth + lock.offsetWidth); // through the slot and out of sight behind the lock
    setStatus("Unlocked");
    live.textContent = "Vault unlocked. Keyhold's details are below.";
    sound.play("unlock");
    decrypt();
    relock.hidden = false;
    // the key comes back in from the left, ready to go again
    timer = setTimeout(() => {
      key.style.transition = "none"; setX(-(key.offsetLeft + key.offsetWidth + 60)); void key.offsetWidth;
      key.style.transition = ""; key.style.removeProperty("--x");
    }, 1600);
  }

  key.addEventListener("pointerdown", (e) => {
    if (e.button) return;
    clearTimeout(timer);
    drag = { x0: e.clientX, x: 0, id: e.pointerId }; moved = false;
    try { key.setPointerCapture(e.pointerId); } catch {}
  });
  key.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const n = need(), x = clamp(e.clientX - drag.x0, 0, n * 1.2);
    if (!moved && x > 6) { moved = true; gate.classList.add("dragging"); }
    if (!moved) return;
    drag.x = x; setX(x);
    const reading = x > n * 0.35;
    gate.classList.toggle("reading", reading);
    if (!gate.classList.contains("granted")) setStatus(reading ? "Decrypting…" : "Drag to unlock");
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const x = drag.x, n = need();
    drag = null;
    gate.classList.remove("dragging", "reading");
    if (!moved) return;
    if (x >= n * 0.85) return grant();
    key.style.removeProperty("--x");
    gate.classList.add("denied"); sound.play("deny");
    if (!gate.classList.contains("granted")) setStatus("All the way in");
    timer = setTimeout(() => { gate.classList.remove("denied"); if (!gate.classList.contains("granted")) setStatus("Drag to unlock"); }, 1400);
  };
  key.addEventListener("pointerup", end);
  key.addEventListener("pointercancel", end);
  // a plain click, tap or Enter slides the key in by itself; the click that ends a drag doesn't
  key.addEventListener("click", () => {
    if (moved) { moved = false; return; }
    clearTimeout(timer);
    if (still()) return grant();
    gate.classList.add("reading"); setStatus("Decrypting…"); setX(need());
    timer = setTimeout(grant, 600);
  });
  relock.addEventListener("click", () => { clearTimeout(timer); key.style.removeProperty("--x"); lockVault(); live.textContent = "Vault locked again."; key.focus(); });

  lockVault();
}
