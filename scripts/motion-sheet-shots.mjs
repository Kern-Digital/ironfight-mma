// Sichtprüfung der Sheet-Choreografie (Motion-System, 2026-09-04).
//
// Fährt auf /dev/motion-sheet den Kartei-Stapel ab — Übungs-Detail öffnen,
// Technik davor, Technik schließen, Detail schließen, wieder öffnen — und
// legt pro Zustand einen Screenshot ab. Drei Läufe: Desktop (Maus), Handy
// (Touch, 390×844) und prefers-reduced-motion. Am Ende steht pro Lauf, ob
// nach dem Wiederöffnen genau EIN Dialog offen ist (die Technik darf nicht
// mehr davor stehen) und ob die Konsole Fehler gemeldet hat.
//
// Aufruf:  node scripts/motion-sheet-shots.mjs [url] [ausgabeordner]
// Default: http://localhost:3000/dev/motion-sheet → tmp/motion-shots/
// (dev-Server muss laufen; Playwright-Chromium ist als devDependency da)

import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const URL = process.argv[2] ?? "http://localhost:3000/dev/motion-sheet";
const OUT = process.argv[3] ?? path.join(process.cwd(), "tmp", "motion-shots");
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(name, viewport, opts = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport,
    hasTouch: !!opts.touch,
    isMobile: !!opts.touch,
    colorScheme: "dark",
    reducedMotion: opts.reduced ? "reduce" : "no-preference",
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(URL, { waitUntil: "networkidle" });
  const shot = (tag) =>
    page.screenshot({ path: path.join(OUT, `${name}-${tag}.png`) });

  await page.getByTestId("sheet-open").click();
  await sleep(120);
  await shot("1-open-mid");
  await sleep(700);
  await shot("2-open-settled");

  // Technik davor — das Detail stellt sich hinten an
  await page.getByRole("button", { name: /Ansehen/ }).first().click();
  await sleep(90);
  await shot("3-stack-mid-a");
  await sleep(120);
  await shot("4-stack-mid-b");
  await sleep(700);
  await shot("5-stack-settled");

  // Technik schließen → Detail kommt zurück
  const technik = page.getByRole("dialog", { name: /^Technik/ });
  await technik.getByRole("button", { name: "Schließen" }).last().click();
  await sleep(90);
  await shot("6-unstack-mid-a");
  await sleep(140);
  await shot("7-unstack-mid-b");
  await sleep(700);
  await shot("8-unstack-settled");

  // Detail schließen — muss AUSFAHREN, nicht wegblinken
  const detail = page.getByRole("dialog", { name: /^Details zu/ });
  await detail.getByRole("button", { name: "Schließen" }).last().click();
  await sleep(110);
  await shot("9-close-mid");
  await sleep(600);
  await shot("10-closed");

  // Wieder öffnen: die Technik darf NICHT mehr davor stehen
  await page.getByTestId("sheet-open").click();
  await sleep(700);
  await shot("11-reopen");
  const dialogs = await page.getByRole("dialog").count();

  await browser.close();
  const ok = dialogs === 1 && errors.length === 0;
  console.log(
    `${ok ? "OK " : "FEHLER"} ${name}: Dialoge nach Wiederöffnen = ${dialogs}; Konsole: ${errors.length ? errors.join(" | ") : "sauber"}`,
  );
  return ok;
}

const ergebnisse = [
  await run("desktop", { width: 1280, height: 800 }),
  await run("mobile", { width: 390, height: 844 }, { touch: true }),
  await run("reduced", { width: 1280, height: 800 }, { reduced: true }),
];
console.log("Screenshots in", OUT);
process.exit(ergebnisse.every(Boolean) ? 0 : 1);
