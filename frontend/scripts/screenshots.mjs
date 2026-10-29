// Drives the real app in headless Chrome over the DevTools protocol (no dependency; Node 22+ has WebSocket) and saves
// screenshots of the key screens, going through the flow with real clicks against the running backend:
//   terminal 1: backend on :8080      terminal 2: cd frontend && npm run dev
//   node scripts/screenshots.mjs [outDir]       (CHROME=/path/to/chrome, APP=http://127.0.0.1:5173)
// It also asserts a few things on the page (text present, no console errors), so it doubles as a browser smoke test.

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const APP = process.env.APP ?? "http://127.0.0.1:5173";
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = process.argv[2] ?? "/tmp/gs/shots";
const PORT = 9333;
mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [`--headless=new`, `--remote-debugging-port=${PORT}`, `--user-data-dir=/tmp/gs-chrome-profile`, "--hide-scrollbars", "--no-first-run", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let target;
for (let i = 0; i < 50 && !target; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    target = list.find((t) => t.type === "page");
  } catch {
    await sleep(200);
  }
}
if (!target) throw new Error("Chrome did not start");

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
const consoleErrors = [];
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.method === "Runtime.exceptionThrown") consoleErrors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
  else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(" "));
};
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, (msg) => (msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result)));
    ws.send(JSON.stringify({ id: n, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? "evaluate failed");
  return r.result.value;
};

let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
  if (!ok) failures += 1;
};

await send("Runtime.enable");
await send("Page.enable");

async function view(width, height) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
}
async function go(hash) {
  await evaluate(`location.hash = ${JSON.stringify(hash)}; 0`);
  await sleep(900);
}
const bodyText = () => evaluate("document.body.innerText.toLowerCase()");
async function waitText(text, timeout = 8000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if ((await bodyText()).includes(text.toLowerCase())) return true;
    await sleep(200);
  }
  return false;
}
const click = (selector, text) =>
  evaluate(`(() => { const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => !${JSON.stringify(text)} || e.innerText.includes(${JSON.stringify(text)})); if (!el) return false; el.click(); return true; })()`);
async function shot(name, { full = false } = {}) {
  let clip;
  if (full) {
    const h = await evaluate("Math.max(document.documentElement.scrollHeight, document.querySelector('.app > main, .flow-main')?.scrollHeight ?? 0) + 40");
    const w = await evaluate("window.innerWidth");
    clip = { x: 0, y: 0, width: w, height: Math.min(h, 6000), scale: 1 };
  }
  const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: full, ...(clip ? { clip } : {}) });
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, "base64"));
}

// the flow frame scrolls inside a fixed-height phone: make it tall enough to show a whole screen
const PHONE = [430, 1500];
await view(...PHONE);
await send("Page.navigate", { url: `${APP}/#/login` });
await sleep(1000);
await evaluate("sessionStorage.clear(); localStorage.clear(); 0");

// ---- manual path (real clicks): firm -> parcels -> documents ----
await go("/verde/agro");
await shot("00-intro");
await go("/verde/agro/firma");
check(await waitText("Legume Bărăgan Demo SRL"), "firm: the signed-in company is preloaded");
check(await waitText("Your consents"), "firm: company loaded from /api/farms");
check((await bodyText()).includes("Your company is an SME".toLowerCase()), "firm: SME status in plain words");
await evaluate(`document.querySelectorAll('input[role=switch]')[0].click(); 0`);
await sleep(300);
await shot("01-firma", { full: true });
await go("/verde/agro/unde");
check(await waitText("Your parcels"), "parcels: list");
check((await evaluate("document.querySelectorAll('.map-box path.leaflet-interactive').length")) >= 3, "parcels: Leaflet polygons from GeoJSON");
await shot("02-unde", { full: true });
await go("/verde/agro/documente");
await waitText("Offer");
await shot("03-documente", { full: true });
// The category comes from the offer upload (classify); a file cannot be picked here, so set it as the upload would.
await evaluate(`const f = JSON.parse(sessionStorage.getItem("gs.flow") || "{}"); f.moduleId = "irigatii"; sessionStorage.setItem("gs.flow", JSON.stringify(f)); location.reload(); 0`);
await sleep(1500);
await go("/verde/agro/intrebari");
check(await waitText("A few questions"), "questions: screen");
await sleep(600);
check((await bodyText()).includes("filled in from APIA".toLowerCase()) || (await bodyText()).includes("filled in from Open Banking".toLowerCase()), "questions: prefilled from APIA / Open Banking");
await shot("04-intrebari", { full: true });

// ---- demo path: category card button -> analysis -> offers -> changes -> request -> dossier ----
await go("/verde/agro/documente");
await waitText("Or start a demo dossier");
check(await click("button", "Legume Bărăgan"), "documents: demo button");
check(await waitText("by choosing the green credit"), "offers: reached by itself after the demo button");
check(await waitText("by choosing the green credit"), "offers: big message");
await shot("07-oferte", { full: true });
const offers = await bodyText();
check(!/\bF[1-6]\b|InvestEU|DSCR|DNSH|risk cost|cost of capital|\bfunds?\b|guarantee fund/i.test(offers), "offers: no funds / DSCR / interest breakdown for the SME");
check(offers.includes("No mortgage, thanks to a European guarantee".toLowerCase()), "offers: collateral wording");
check((await evaluate("document.querySelectorAll('.repay-bar').length")) === 12, "offers: repayment chart with 12 bars");
await go("/verde/agro/schimbari");
check(await waitText("What we propose"), "changes: upgrade shown");
await shot("08-schimbari", { full: true });
await go("/verde/agro/cerere");
check(await waitText("I accept the proposed changes"), "request: upgrade acceptance for the green variant");
await shot("09-cerere", { full: true });
await evaluate(`document.querySelector('.accept-row input').click(); 0`);
await sleep(200);
check(await click("button.btn--block", "Send the application to the bank"), "request: submit");
check(await waitText("The application is with the bank"), "dossier: TRIMIS after submit");
await shot("10-dosar-trimis", { full: true });

// ---- officer zone: full page on a desktop viewport ----
await view(1280, 1000);
await click(".role-switch a", "Officer");
await sleep(1500);
check(await waitText("Green credit dossier"), "officer: dossier page");
await sleep(800);
await shot("11-ofiter-dosar", { full: true });
check((await bodyText()).includes("EIF InvestEU".toLowerCase()), "officer: fund shown");
check(await click("button", "Approve"), "officer: Approve");
await sleep(1200);
check((await bodyText()).includes("Download the PDF report".toLowerCase()), "officer: approved, PDF link");
check(await click("button", "Simulate 12 months"), "officer: Simulate 12 months");
check(await waitText("The result after 12 months"), "officer: monitoring result");
await shot("12-ofiter-dupa-aprobare", { full: true });
await go("/ofiter");
await sleep(1000);
await shot("13-ofiter-home", { full: true });

// ---- back to the SME: the approved dossier ----
await view(...PHONE);
await go("/verde/agro/dosar");
check(await waitText("Your application has been approved"), "dossier: APROBAT/MONITORIZARE visible to the SME");
await shot("14-dosar-aprobat", { full: true });

// ---- failure paths ----
await go("/verde/agro/analiza");
await evaluate("sessionStorage.setItem('gs.flow', JSON.stringify({...JSON.parse(sessionStorage.getItem('gs.flow')), runId: 'run_000000000000'})); sessionStorage.setItem('gs.runId','run_000000000000'); location.reload(); 0");
await sleep(1500);
await go("/verde/agro/oferte");
check(await waitText("does not exist") || (await bodyText()).includes("That did not work".toLowerCase()), "offers: unknown dossier shows the API error");
await shot("15-eroare-dosar");

console.log(consoleErrors.length ? `console errors:\n${consoleErrors.slice(0, 8).join("\n")}` : "no console errors");
check(consoleErrors.length === 0, "no console errors");
console.log(`screenshots in ${OUT}`);
ws.close();
chrome.kill();
process.exit(failures ? 1 : 0);
