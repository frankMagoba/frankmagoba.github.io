// What the visitor's browser says about their device. Read locally: no permission
// prompts and no network requests. Used by the boot screen and the terminal's neofetch.
// Nothing runs at import time, so the Node tests can import terminal.js safely.

const HOME_TZ = "Africa/Nairobi";
const HOME_OFFSET = 180; // Nairobi is UTC+3 all year

const within = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]).catch(() => null);

function osName() {
  const ua = navigator.userAgent;
  if (/iPhone|iPod/.test(ua)) return "iOS";
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "iPadOS";
  if (/Android/.test(ua)) return "Android";
  if (/CrOS/.test(ua)) return "ChromeOS";
  if (/Windows/.test(ua)) return "Windows";
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return "";
}

const BROWSERS = [
  ["Edge", /Edg[A-Za-z]*\/(\d+)/], ["Opera", /OPR\/(\d+)/], ["Samsung Internet", /SamsungBrowser\/(\d+)/],
  ["Firefox", /(?:Firefox|FxiOS)\/(\d+)/], ["Chrome", /(?:Chrome|CriOS)\/(\d+)/], ["Safari", /Version\/(\d+).*Safari/],
];
function browserName() {
  for (const [name, re] of BROWSERS) { const m = navigator.userAgent.match(re); if (m) return `${name} ${m[1]}`; }
  return "";
}

// "ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)" -> "Apple M1"
function gpuName() {
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    if (!gl) return "";
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    let r = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    const angle = r.match(/^ANGLE \((.+)\)$/);
    if (angle) r = angle[1].split(", ")[1] || angle[1];
    r = r.replace(/ANGLE Metal Renderer: /, "").replace(/\(0x[0-9a-f]+\)|\((R|TM)\)/gi, "")
      .replace(/\b(Direct3D|OpenGL|Vulkan|vs_\d).*$/i, "").replace(/\s+/g, " ").trim();
    return r.length < 4 || /^(WebKit WebGL|Generic|Disabled)/i.test(r) ? "" : r;
  } catch { return ""; }
}

// Median frame gap over 20 frames, snapped to a common display rate. 0 if the tab is hidden.
const refreshRate = () => new Promise((done) => {
  const gaps = []; let last = 0;
  const step = (t) => {
    if (last) gaps.push(t - last);
    last = t;
    if (gaps.length < 20) return requestAnimationFrame(step);
    gaps.sort((a, b) => a - b);
    const hz = 1000 / gaps[gaps.length >> 1];
    done([60, 75, 90, 120, 144, 165, 240].reduce((a, b) => (Math.abs(b - hz) < Math.abs(a - hz) ? b : a)));
  };
  requestAnimationFrame(step);
  setTimeout(() => done(0), 1000);
});

const partOfDay = (h) => (h < 5 ? "night" : h < 12 ? "morning" : h < 17 ? "afternoon" : h < 21 ? "evening" : "night");
const clock = (date, timeZone) => date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone });
const hours = (m) => { const h = Math.abs(m) / 60; return `${Number.isInteger(h) ? h : h.toFixed(1)} h`; };

function countVisit() {
  try {
    let n = +(localStorage.getItem("visits") || 0);
    if (!sessionStorage.getItem("visit-counted")) { localStorage.setItem("visits", String(++n)); sessionStorage.setItem("visit-counted", "1"); }
    return Math.max(1, n);
  } catch { return 1; }
}

async function read() {
  const uad = navigator.userAgentData?.getHighEntropyValues
    ? within(navigator.userAgentData.getHighEntropyValues(["platformVersion", "model"]), 500) : null;
  const bat = navigator.getBattery ? within(navigator.getBattery(), 500) : null;
  const [hi, battery, hz] = await Promise.all([uad, bat, refreshRate()]);

  let os = osName();
  const ua = navigator.userAgent;
  if (os === "Android") os += ` ${ua.match(/Android (\d+(?:\.\d+)?)/)?.[1] || ""}`.trimEnd();
  if (/^i(Pad)?OS$/.test(os)) { const m = ua.match(/OS (\d+)_(\d+)/); if (m) os += ` ${m[1]}.${m[2]}`; }
  if (os === "Windows" && hi?.platformVersion) os = parseInt(hi.platformVersion, 10) >= 13 ? "Windows 11" : "Windows 10";

  const now = new Date();
  let tz = "";
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch {}
  let lang = navigator.language || "";
  try { lang = new Intl.DisplayNames(["en"], { type: "language" }).of(lang) || lang; } catch {}
  const dpr = devicePixelRatio || 1;

  return {
    os, model: hi?.model || "", browser: browserName(), gpu: gpuName(),
    cores: navigator.hardwareConcurrency || 0, memory: navigator.deviceMemory || 0,
    screen: `${Math.round(screen.width * dpr)} × ${Math.round(screen.height * dpr)}`, dpr: +dpr.toFixed(2), hz,
    tz, city: /\//.test(tz) && !tz.startsWith("Etc/") ? tz.split("/").pop().replace(/_/g, " ") : "",
    time: clock(now), day: now.toLocaleDateString("en-GB", { weekday: "long" }), part: partOfDay(now.getHours()),
    homeTime: clock(now, HOME_TZ), gap: HOME_OFFSET + now.getTimezoneOffset(), // minutes Nairobi is ahead of the visitor
    lang, dark: matchMedia("(prefers-color-scheme: dark)").matches,
    battery: battery ? { level: Math.round(battery.level * 100), charging: battery.charging } : null,
    visits: countVisit(),
  };
}

let cached;
export const scan = () => (cached ??= read());

const memText = (v) => (v.memory ? (v.memory >= 8 ? "8 GB+ memory" : `${v.memory} GB memory`) : "");
const screenText = (v) => `${v.screen} at ${v.dpr}×${v.hz ? ` · ${v.hz} Hz` : ""}`;
const batteryText = (b) => (b ? (b.charging && b.level >= 99 ? "Plugged in, battery full" : `Battery ${b.level}%, ${b.charging ? "charging" : "not charging"}`) : "");
const nth = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
const homeText = (v) => (v.tz === HOME_TZ ? "Nairobi too? Same city as me"
  : v.gap === 0 ? "Same time as me in Nairobi"
  : `It's ${v.homeTime} for me in Nairobi, ${hours(v.gap)} ${v.gap > 0 ? "ahead of" : "behind"} you`);

// Boot screen lines, as segments: strings print plain, { b } prints bold.
export function bootLines(v) {
  const b = (text) => ({ b: text });
  return [
    [b(v.os || "Unknown system"), ...(v.model ? [" on a ", b(v.model)] : []), ...(v.browser ? [" · ", b(v.browser)] : [])],
    [v.gpu && b(v.gpu), v.cores && `${v.cores} cores`, memText(v)].filter(Boolean).flatMap((s, i) => (i ? [" · ", s] : [s])),
    [b(v.screen), ` screen${screenText(v).slice(v.screen.length)}`],
    [...(v.city ? ["Near ", b(v.city), " by your clock · "] : []), b(v.time), ` on a ${v.day} ${v.part}`],
    [homeText(v)],
    [batteryText(v.battery)],
    [`${v.lang}${v.dark ? ", dark mode" : ""} · ${v.visits > 1 ? `your ${nth(v.visits)} visit` : "your first visit"}`],
  ].filter((segs) => segs.some(Boolean));
}

// neofetch rows: [label, value]
export function fetchRows(v) {
  return [
    ["OS", [v.os, v.model].filter(Boolean).join(" · ") || "Unknown"],
    ["Browser", v.browser || "Unknown"],
    ["GPU", v.gpu || "Not shared by your browser"],
    ["CPU", v.cores ? `${v.cores} logical cores` : "Not shared by your browser"],
    ["Memory", memText(v).replace(/ memory$/, "") || "Not shared by your browser"],
    ["Display", screenText(v)],
    ["Locale", `${v.lang}${v.dark ? ", dark mode" : ""}`],
    ["Clock", [v.tz.replace(/_/g, " "), v.time].filter(Boolean).join(" · ")],
    ["Nairobi", homeText(v)],
    ...(v.battery ? [["Battery", batteryText(v.battery).replace(/^Battery /, "")]] : []),
    ["Uptime", `${Math.round(performance.now() / 1000)} s on this page`],
    ["Visits", String(v.visits)],
  ];
}
