import { answer, keywordAnswer } from "../js/ask.js";
import { runCommand } from "../js/terminal.js";

const cases = [
  "who is he",
  "tell me about him",
  "about",
  "gitstart",
  "gittsrat?",
  "optibus",
  "help",
  "has he done SRE work?",
];

let failed = 0;
for (const q of cases) {
  const viaAsk = await answer(q);
  const viaCmd = await runCommand(q);
  const ok = q === "help"
    ? /Commands:/.test(viaCmd)
    : !!(viaAsk?.text) && !/Nothing on this page/.test(viaCmd);
  console.log(ok ? "OK " : "FAIL", JSON.stringify(q));
  if (!ok) {
    failed++;
    console.log("  ask:", viaAsk?.text?.slice(0, 120) || null);
    console.log("  cmd:", String(viaCmd).slice(0, 120));
  } else if (q !== "help") {
    console.log("  ->", (viaAsk?.ref || ""), (viaAsk?.text || viaCmd).slice(0, 90) + "...");
  }
}
process.exit(failed ? 1 : 0);
