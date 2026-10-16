import { profile, experience, projects, skills, education, certifications, certificates, projectBlurb } from "./content.js";
import { answer, fallback } from "./ask.js";

const COMMANDS = {
  help: () => [
    "Commands: about, experience, projects, project <name>, skills, education, contact, links, resume, theme, clear, exit",
    "Or just type naturally:",
    "  who is he / tell me about him / about",
    "  gitstart   (company — typos like gittsrat work too)",
    "  optibus    (project name)",
    "  has he done SRE work?",
  ].join("\n"),
  about: () => `${profile.name}, ${profile.title}, ${profile.location}\n\n${profile.intro}`,
  whoami: () => COMMANDS.about(),
  experience: () => experience.map((e) => `${e.start} to ${e.end}  ${e.role}, ${e.company}`).join("\n"),
  projects: () => projects.map((p) => `${p.name.padEnd(32)} ${p.where}${p.dates ? ", " + p.dates : ""}`).join("\n") + "\n\nType 'project <name>' for details, or just the name.",
  skills: () => Object.entries(skills).map(([k, v]) => `${k}: ${v.join(", ")}`).join("\n"),
  education: () => [...education.map((e) => `${e.degree}, ${e.school} (${e.end})`), ...certifications, "", "Certificates:", ...certificates.map((c) => `  ${c.title}`)].join("\n"),
  contact: () => `email     ${profile.email}\nphone     ${profile.phone}\nlinkedin  ${profile.links.linkedin}\ngithub    ${profile.links.github}`,
  links: () => Object.entries(profile.links).map(([k, v]) => `${k.padEnd(11)}${v}`).join("\n"),
  resume: () => { location.href = "/Resume/"; return "Opening the resume..."; },
  theme: () => { document.getElementById("theme").click(); return "Theme switched."; },
  ls: () => "about  experience  projects  skills  education  contact  links  resume",
  sudo: () => "Nice try.",
};

const CMD_NAMES = Object.keys(COMMANDS).concat("ask", "project", "clear", "exit", "help");

const findProject = (q) => {
  if (!q) return null;
  const n = q.toLowerCase().trim();
  return projects.find((p) => p.name.toLowerCase() === n)
    || projects.find((p) => p.name.toLowerCase().includes(n))
    || projects.find((p) => n.includes(p.name.toLowerCase().split(/\s+/)[0]) && p.name.split(/\s+/)[0].length > 3);
};

const formatProject = (p) => projectBlurb(p).replace(/ · /g, "\n");

const dist = (a, b) => {
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

const closestCommand = (word) => {
  if (!word || word.length < 2) return null;
  let best = null, bestD = 3;
  for (const c of CMD_NAMES) {
    const d = dist(word, c);
    if (d > 0 && d < bestD) { best = c; bestD = d; }
  }
  return best;
};

const looksLikeQuestion = (raw) =>
  /\?$/.test(raw)
  || /\s/.test(raw)
  || /^(who|what|when|where|why|how|is|are|does|do|can|tell|show|has|have)/i.test(raw);

// Shared by the modal terminal and the inline ask widget.
export async function runCommand(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const [cmd, ...rest] = trimmed.split(/\s+/);
  const name = cmd.toLowerCase();
  const arg = rest.join(" ");

  if (name === "ask") {
    if (!arg) return "Usage: ask <question> — or just type the question without 'ask'.";
    const r = await answer(arg);
    return r ? `${r.text}\n  (from: ${r.ref})` : fallback;
  }
  if (name === "project") {
    const p = arg && findProject(arg);
    if (!p) return "Usage: project <name>, for example: project optibus — or type the name alone.";
    return formatProject(p);
  }
  if (COMMANDS[name]) return COMMANDS[name]();

  // Typo'd command: "projet", "experince", "contcat"
  if (!arg && !looksLikeQuestion(trimmed)) {
    const near = closestCommand(name);
    if (near) return `No command '${cmd}'. Did you mean '${near}'? Type help for the list, or ask a question.`;
  }

  // Bare project name: "optibus", "docsum", "menolife"
  const asProject = findProject(trimmed) || (!arg ? findProject(name) : null);
  if (asProject && (trimmed.length <= asProject.name.length + 4 || !looksLikeQuestion(trimmed))) {
    return formatProject(asProject);
  }

  const r = await answer(trimmed);
  if (r) return `${r.text}\n  (from: ${r.ref})`;

  // Never frame a failed question as a missing shell command.
  if (looksLikeQuestion(trimmed) || arg) return fallback;
  const near = closestCommand(name);
  if (near) return `No command '${cmd}'. Did you mean '${near}'? Or ask a question about his work.`;
  return fallback;
}

export function initTerminal() {
  const dlg = document.getElementById("term");
  const out = document.getElementById("term-out");
  const input = document.getElementById("term-in");
  const history = [];
  let pos = 0;

  const print = (text, cls) => {
    const line = document.createElement("div");
    if (cls) line.className = cls;
    line.textContent = text;
    out.append(line);
    out.scrollTop = out.scrollHeight;
  };
  const open = () => {
    if (!dlg.open) dlg.showModal();
    if (!out.childElementCount) print("Type 'help', a project name, or just ask a question.");
    input.focus();
  };

  document.getElementById("term-open").addEventListener("click", open);
  document.getElementById("term-close").addEventListener("click", () => dlg.close());
  document.addEventListener("keydown", (e) => {
    const typing = /INPUT|TEXTAREA/.test(document.activeElement?.tagName);
    if (e.key === "`" && !typing) { e.preventDefault(); open(); }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp" && history.length) { pos = Math.max(0, pos - 1); input.value = history[pos]; e.preventDefault(); }
    if (e.key === "ArrowDown") { pos = Math.min(history.length, pos + 1); input.value = history[pos] ?? ""; e.preventDefault(); }
    if (e.key === "Tab") {
      e.preventDefault();
      const hit = CMD_NAMES.filter((c) => c.startsWith(input.value.toLowerCase()));
      if (hit.length === 1) input.value = hit[0] + " ";
      else if (hit.length > 1) print(hit.join("  "));
    }
  });

  document.getElementById("term-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const raw = input.value.trim();
    input.value = "";
    if (!raw) return;
    history.push(raw); pos = history.length;
    print(`$ ${raw}`, "cmd");
    const name = raw.split(/\s+/)[0].toLowerCase();
    if (name === "clear") return out.replaceChildren();
    if (name === "exit") return dlg.close();
    print(await runCommand(raw));
  });
}
