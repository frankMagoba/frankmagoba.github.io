import { profile, experience, projects, skills, education, certifications, certificates } from "./content.js";
import { answer, fallback } from "./ask.js";

const COMMANDS = {
  help: () => "Commands: about, experience, projects, project <name>, skills, education, contact, links, resume, ask <question>, theme, clear, exit\nAnything else is read as a question.",
  about: () => `${profile.name}, ${profile.title}, ${profile.location}\n\n${profile.intro}`,
  whoami: () => COMMANDS.about(),
  experience: () => experience.map((e) => `${e.start} to ${e.end}  ${e.role}, ${e.company}`).join("\n"),
  projects: () => projects.map((p) => `${p.name.padEnd(32)} ${p.where}${p.dates ? ", " + p.dates : ""}`).join("\n") + "\n\nType 'project <name>' for details.",
  skills: () => Object.entries(skills).map(([k, v]) => `${k}: ${v.join(", ")}`).join("\n"),
  education: () => [...education.map((e) => `${e.degree}, ${e.school} (${e.end})`), ...certifications, "", "Certificates:", ...certificates.map((c) => `  ${c.title}`)].join("\n"),
  contact: () => `email     ${profile.email}\nphone     ${profile.phone}\nlinkedin  ${profile.links.linkedin}\ngithub    ${profile.links.github}`,
  links: () => Object.entries(profile.links).map(([k, v]) => `${k.padEnd(11)}${v}`).join("\n"),
  resume: () => { location.href = "/Resume/"; return "Opening the resume..."; },
  theme: () => { document.getElementById("theme").click(); return "Theme switched."; },
  ls: () => "about  experience  projects  skills  education  contact  links  resume",
  sudo: () => "Nice try.",
};

const findProject = (q) => projects.find((p) => p.name.toLowerCase().includes(q.toLowerCase()));

// Shared by the modal terminal and the inline ask widget.
export async function runCommand(raw) {
  const [cmd, ...rest] = raw.trim().split(/\s+/);
  const name = cmd.toLowerCase();
  const arg = rest.join(" ");
  if (name === "ask") {
    if (!arg) return "Usage: ask <question>";
    const r = await answer(arg);
    return r ? `${r.text}\n  (from: ${r.ref})` : fallback;
  }
  if (name === "project") {
    const p = arg && findProject(arg);
    if (!p) return "Usage: project <name>, for example: project optibus";
    return [`${p.name} (${p.where}${p.dates ? ", " + p.dates : ""})`, p.what, p.role, `stack: ${p.stack.join(", ")}`, ...p.links.map(([l, h]) => `${l}: ${h}`), p.note || ""].filter(Boolean).join("\n");
  }
  if (COMMANDS[name]) return COMMANDS[name]();
  // Anything else is treated as a question.
  const r = await answer(raw);
  return r ? `${r.text}\n  (from: ${r.ref})` : `command not found: ${cmd}. Try 'help', or just ask a question.`;
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
    if (!out.childElementCount) print("Type 'help' to see what's here.");
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
      const hit = Object.keys(COMMANDS).concat("ask", "project", "clear", "exit").filter((c) => c.startsWith(input.value));
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
