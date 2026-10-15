// Hero monogram: a quiet grid of blocks that settles into "FM" once on load.
// Grew out of the old block-figure animation on this site. Pure CSS transforms,
// one pass, and static when the visitor prefers reduced motion.
const F = ["11111", "10000", "10000", "11110", "10000", "10000", "10000"];
const M = ["10001", "11011", "10101", "10101", "10001", "10001", "10001"];

export function initHero(root) {
  if (!root) return;
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const frag = document.createDocumentFragment();
  for (let r = 0; r < 7; r++) {
    const row = F[r] + "0" + M[r];
    for (let c = 0; c < row.length; c++) {
      const cell = document.createElement("span");
      const on = row[c] === "1";
      cell.className = on ? (c < 5 ? "b on f" : "b on m") : "b";
      if (on && !still) {
        // Blocks drift in from a short distance, staggered along the diagonal.
        const dx = ((c * 37 + r * 11) % 7) - 3;
        const dy = ((c * 13 + r * 29) % 7) - 3;
        cell.style.setProperty("--dx", `${dx * 14}px`);
        cell.style.setProperty("--dy", `${dy * 14}px`);
        cell.style.setProperty("--d", `${(r + c) * 55}ms`);
      }
      frag.append(cell);
    }
  }
  root.append(frag);
  if (!still) requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add("built")));
  else root.classList.add("built", "still");
}
