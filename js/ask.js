// Answers only from content.js: FAQ shortcuts, companies, projects, then chunks.
import { faq, buildChunks, projects, projectBlurb, experience, profile } from "./content.js";

const chunks = buildChunks();
const STOP = new Set("a an the is are was were does do did his her she they what which how has have of in on at to for and or with any can me my you your please".split(" "));
const tokens = (s) => s.toLowerCase().replace(/[^a-z0-9+#.\- ]/g, " ").split(/\s+/).filter((t) => t && !STOP.has(t) && t.length > 1);
const esc = (k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const aboutAnswer = () => ({
  text: `${profile.name}, ${profile.title}, ${profile.location}. ${profile.tagline} ${profile.intro}`,
  ref: "About",
});

export function normalizeQuestion(q) {
  return q
    .trim()
    .replace(/^[>$]\s*/, "")
    .replace(/^(please\s+)?(tell|show|give)\s+(me\s+)?(about\s+|more\s+(on|about)\s+)?/i, "")
    .replace(/\?+$/, "")
    .trim();
}

const dist = (a, b) => {
  a = a.toLowerCase(); b = b.toLowerCase();
  if (!a || !b) return 99;
  if (Math.abs(a.length - b.length) > 2) return 99;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
};

// "who is he", "tell me about him", "about franklin", bare "about"
function scoreAbout(question) {
  const raw = question.toLowerCase().trim();
  const norm = normalizeQuestion(question).toLowerCase();
  const identity =
    /^(who\s+(is|are)\s+(he|franklin|franklin\s+magoba)|who\s+is\s+this|about(\s+him|\s+franklin|\s+franklin\s+magoba)?|tell\s+me\s+about\s+(him|franklin|franklin\s+magoba)|introduce\s+(him|yourself)|whoami)$/i.test(raw)
    || /^(him|franklin|franklin\s+magoba)$/i.test(norm);
  return identity ? { hit: aboutAnswer(), score: 12 } : { hit: null, score: 0 };
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
    const fuzzy = words.some((w) => w.length > 4 && (dist(norm, w) <= 2 || dist(raw.replace(/\?$/, ""), w) <= 2));
    if (!full && !partial && !fuzzy) continue;
    const score = full ? 10 : partial ? 7 : 5;
    if (score > bestScore) {
      best = { text: projectBlurb(p), ref: `${p.name} (${p.where})` };
      bestScore = score;
    }
  }
  return { hit: best, score: bestScore };
}

// "gitstart", "gittsrat", "afterquery", "bright coders"
function scoreCompany(question) {
  const raw = question.toLowerCase().replace(/[?!.]+$/g, "").trim();
  const norm = normalizeQuestion(question).toLowerCase();
  const needle = (norm || raw).replace(/\s+/g, " ");
  const companies = [...new Set(experience.map((e) => e.company))];
  let best = null, bestScore = 0;

  for (const company of companies) {
    const full = company.toLowerCase();
    const short = full.replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim();
    const key = short.split(/[\s,]+/)[0]; // gitstart, afterquery, bright, ...
    const aliases = [full, short, key].filter((s) => s && s.length > 2);
    const compact = (s) => s.replace(/\s/g, "");
    const hit = aliases.some((a) => raw.includes(a) || needle.includes(a) || needle === a)
      || aliases.some((a) => {
        if (a.length < 5) return false;
        const d = dist(compact(needle), compact(a));
        // Allow one more edit on longer names so "gittsrat" still finds GitStart.
        return d <= (a.length >= 7 ? 3 : 2);
      });
    if (!hit) continue;

    const roles = experience.filter((e) => e.company === company);
    const text = roles.map((e) => {
      const head = `${e.role} at ${e.company} (${e.start} to ${e.end}, ${e.type}).`;
      return [head, ...e.points].join(" ");
    }).join(" ");
    const score = 9;
    if (score > bestScore) {
      best = { text, ref: company };
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
    const hay = (c.text + " " + c.ref).toLowerCase();
    const ct = new Set(tokens(hay));
    let s = qt.reduce((n, t) => n + (ct.has(t) ? 1 : 0), 0);
    // One distinctive token (nestjs, optibus, kubernetes) is enough if it appears as a whole word.
    if (s === 0 && qt.length === 1 && qt[0].length > 4) {
      const t = qt[0];
      if (new RegExp(`\\b${esc(t)}\\b`).test(hay)) s = 2;
    }
    if (s > bestScore) { best = c; bestScore = s; }
  }
  return bestScore >= 2 ? { hit: best, score: bestScore } : { hit: null, score: 0 };
}

export function keywordAnswer(question) {
  const ranked = [
    scoreAbout(question),
    scoreProject(question),
    scoreCompany(question),
    scoreFaq(question),
    scoreChunks(question),
  ].filter((x) => x.hit).sort((a, b) => b.score - a.score);
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
  return best > 0.35 ? chunks[idx] : null;
}

export async function answer(question) {
  const keyed = keywordAnswer(question);
  if (keyed) return keyed;
  if (embedder) {
    try { const r = await semanticAnswer(question); if (r) return r; } catch { /* fall through */ }
  }
  return null;
}

export const fallback = "Nothing on this page matches that closely enough. Try about, a company (gitstart), a project name (optibus, sway), backend / SRE / mobile / AI, or email franklinmagoba4@gmail.com.";
