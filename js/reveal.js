// Content fades up as it scrolls into view, a few items at a time; [data-count] numbers count up.

const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export function countUp(node) {
  const to = +node.dataset.count, suffix = node.dataset.suffix || "";
  if (still()) { node.textContent = to + suffix; return; }
  const t0 = performance.now(), dur = 1100;
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur);
    node.textContent = Math.round(to * (1 - (1 - k) ** 3)) + suffix;
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function reveal(nodes) {
  if (still() || !("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver((entries) => {
    let n = 0;
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      e.target.style.transitionDelay = `${Math.min(n++, 5) * 70}ms`;
      e.target.classList.add("in");
    }
  }, { rootMargin: "0px 0px -8% 0px" });
  for (const node of nodes) {
    if (node.getBoundingClientRect().top < innerHeight) continue; // already on screen: leave it be
    node.classList.add("rv");
    io.observe(node);
  }
}
