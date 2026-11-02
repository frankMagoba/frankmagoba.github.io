// First-visit boot screen: types a short log of what the visitor's browser exposes, then
// slides away to the page. The inline script in index.html decides whether it runs (it adds
// html.booting before first paint, so the page never flashes first). Any key or click skips it.
import { scan, bootLines } from "./visitor.js";
import { sound } from "./sound.js";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Resolves as the screen starts to leave (at once if there is no boot screen).
export function runBoot() {
  const root = document.documentElement, box = document.getElementById("boot");
  if (!root.classList.contains("booting") || !box) { box?.remove(); return Promise.resolve(); }
  const log = box.querySelector(".boot-log");
  root.dataset.boot = "on"; // claims the screen from the inline failsafe

  return new Promise((resolve) => {
    let done = false;
    const finish = async () => {
      if (done) return;
      done = true;
      removeEventListener("keydown", finish, true); removeEventListener("pointerdown", finish, true);
      try { sessionStorage.setItem("booted", "1"); } catch {}
      sound.play("boot");
      box.classList.add("out");
      root.classList.add("enter");
      resolve();
      await wait(750);
      root.classList.remove("booting");
      box.remove();
    };
    addEventListener("keydown", finish, true); addEventListener("pointerdown", finish, true);
    setTimeout(finish, 9000);

    const line = (cls) => { const d = document.createElement("div"); d.className = cls; log.append(d); return d; };
    // paced against the clock, so a slow frame is caught up rather than added on
    const type = async (node, text, ms) => {
      const t0 = performance.now();
      for (let k = 0; k < text.length && !done; await wait(16)) {
        k = Math.min(text.length, Math.floor((performance.now() - t0) / ms));
        node.textContent = text.slice(0, k);
      }
    };

    (async () => {
      const facts = scan();
      const cmd = line("cmd");
      cmd.innerHTML = '<span class="ps1">visitor@frankmagoba:~$</span> ';
      const typed = cmd.appendChild(document.createElement("span"));
      await wait(350);
      await type(typed, "./hello", 55);
      await wait(250);
      await type(line("hd"), "Hello. Here's what your browser just told me:", 14);
      const v = await Promise.race([facts, wait(1500)]);
      if (v) {
        for (const segs of bootLines(v)) {
          if (done) return;
          const d = line("ok");
          for (const s of segs) if (s) d.append(typeof s === "string" ? s : Object.assign(document.createElement("b"), { textContent: s.b }));
          await wait(200);
        }
      }
      if (done) return;
      await wait(200);
      line("end").textContent = "Read locally. None of it left your browser. Starting portfolio";
      await wait(1100);
      finish();
    })();
  });
}
