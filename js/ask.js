// Answers only from content.js: FAQ shortcuts (written from those facts) plus
// keyword/semantic search over experience, projects, skills and profile text.
import { faq, buildChunks, projects, projectBlurb } from "./content.js";

const chunks = buildChunks();
const STOP = new Set("a an the is are was were does do did he his him her she they franklin what which who how has have of in on at to for and or with about any can me my you your tell show please".split(" "));
const tokens = (s) => s.toLowerCase().replace(/[^a-z0-9+#.\- ]/g, " ").split(/\s+/).filter((t) => t && !STOP.has(t) && t.length > 1);
const esc = (k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function normalizeQuestion(q) {
  return q
    .trim()
    .replace(/^[>$]\s*/, "")
    .replace(/^(please\s+)?(tell|show|give)\s+(me\s+)?(about\s+|more\s+(on|about)\s+)?/i, "")
    .replace(/\?+$/, "")
    .trim();
}

function scoreFaq(question) {
  const raw = question.toLowerCase();
  const norm = normalizeQuestion(question).toLowerCase();
  let best = null, bestScore = 0;
  for (const f of faq) {
    const s = f.k.reduce((n, k) => {
      const re = new RegExp(`\\b${esc(k)}\\b`);
      return n + (re.test(raw) || re.test(norm) ? 2 : 0);
    }, 0);
    if (s > bestScore) { best = { text: f.a, ref: f.q }; bestScore = s; }
  }
  // Need at least one real keyword hit so a lone common word doesn't win.
  return bestScore >= 2 ? { hit: best, score: bestScore } : { hit: null, score: 0 };
}

function scoreProject(question) {
  const raw = question.toLowerCase();
  const norm = normalizeQuestion(question).toLowerCase();
  let best = null, bestScore = 0;
  for (const p of projects) {
    const name = p.name.toLowerCase();
    const words = name.replace(/[()]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !["open", "source", "and", "the"].includes(w));
    const full = raw.includes(name) || norm.includes(name);
    const partial = words.some((w) => new RegExp(`\\b${esc(w)}\\b`).test(raw) || new RegExp(`\\b${esc(w)}\\b`).test(norm));
    if (!full && !partial) continue;
    // Prefer the canonical project blurb over a loose FAQ paraphrase.
    const score = full ? 10 : 7;
    if (score > bestScore) {
      best = { text: projectBlurb(p), ref: `${p.name} (${p.where})` };
      bestScore = score;
    }
  }
  return { hit: best, score: bestScore };
}

function scoreChunks(question) {
  const qt = tokens(normalizeQuestion(question) || question);
  if (!qt.length) return { hit: null, score: 0 };
  let best = null, bestScore = 0;
  for (const c of chunks) {
    const ct = new Set(tokens(c.text + " " + c.ref));
    const s = qt.reduce((n, t) => n + (ct.has(t) ? 1 : 0), 0);
    if (s > bestScore) { best = c; bestScore = s; }
  }
  // Require enough overlap so one shared token doesn't return an unrelated bullet.
  return bestScore >= 2 ? { hit: best, score: bestScore } : { hit: null, score: 0 };
}

export function keywordAnswer(question) {
  const project = scoreProject(question);
  const faqHit = scoreFaq(question);
  const chunk = scoreChunks(question);
  // Project name wins (exact page copy). Then FAQ shortcuts. Then densest source chunk.
  const ranked = [project, faqHit, chunk].filter((x) => x.hit).sort((a, b) => b.score - a.score);
  return ranked[0]?.hit || null;
}

let embedder = null, vectors = null;
export async function loadSemantic(onStatus = () => {}) {
  if (embedder) return;
  onStatus("Downloading a small model (about 23 MB, cached after the first time)...");
  const { pipeline } = await import("https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2");
  embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  const out = await embedder(chunks.map((c) => c.text), { pooling: "mean", normalize: true });
  vectors = out.tolist();
  onStatus("Smart search is on.");
}
export const semanticReady = () => !!embedder;

export async function semanticAnswer(question) {
  const [q] = (await embedder([normalizeQuestion(question) || question], { pooling: "mean", normalize: true })).tolist();
  let best = -1, idx = 0;
  vectors.forEach((v, i) => { const s = v.reduce((n, x, j) => n + x * q[j], 0); if (s > best) { best = s; idx = i; } });
  // Slightly stricter so weak semantic hits don't invent a wrong emphasis.
  return best > 0.35 ? chunks[idx] : null;
}

export async function answer(question) {
  // Keyword/project match first — those quote the page. Semantic is a fallback only.
  const keyed = keywordAnswer(question);
  if (keyed) return keyed;
  if (embedder) {
    try { const r = await semanticAnswer(question); if (r) return r; } catch { /* fall through */ }
  }
  return null;
}

export const fallback = "Nothing on this page matches that closely enough. Try a project name from the grid (optibus, sway, docsum, alaan), ask about backend / SRE / mobile / AI, type help, or email franklinmagoba4@gmail.com.";
