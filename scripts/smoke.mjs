// Schneller WebGL-Smoke-Test fuer die DeepFight-Helix.
//
// Portiert aus dem Prototyp D:\DeepFight-Helix (Runde 11). Prueft in ~20 s, ob
// die Szene ueberhaupt rendert — das faengt Fehler ab, die weder `tsc --noEmit`
// noch `next build` sehen koennen: fehlende GLSL-Uniforms, Shader-Kompilier-
// fehler, leere Canvas, weggebrochene Draw Calls.
//
// Ziel ist die dev-only Route /dev/helix (rendert FightDnaHelix mit einem
// deterministischen Mock-Profil, ohne Firebase-Login).
//
// Aufruf:  node scripts/smoke.mjs [url]
// Default: http://localhost:3000/dev/helix  (dev-Server muss laufen)
//
// Exit-Code 0 = bestanden, 1 = durchgefallen (Grund steht in der Ausgabe).
//
// Drei dokumentierte Messfallen (1+2 aus dem Prototyp, 3 neu bei der
// Integration gefunden — sie erklaert die "Szene mountet nicht"-Fehlschlaege
// des Prototyps ab dem 2026-08-26):
//   1. Pixel NIE via drawImage(canvas) auslesen — der WebGL-Kontext laeuft ohne
//      preserveDrawingBuffer, sein Framebuffer ist ausserhalb des Render-Frames
//      leer. Stattdessen Kompositor-Screenshot des Browsers.
//   2. Stats ueber mehrere Samples maximieren — ein einzelnes Sample im
//      frameloop="demand"-Renderloop kann aus einer Ruhephase stammen.
//   3. Headless-Chrome produziert ohne Frame-Verbraucher KEINE Compositor-
//      Frames → requestAnimationFrame steht still → die Demand-Renderloop
//      rendert nie. Ein laufender Page.startScreencast (mit Frame-Acks) treibt
//      die Frames an; ohne ihn liefert die Szene 0 Draw Calls und 0 Samples,
//      obwohl sie voellig gesund ist.

import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const URL_UNDER_TEST = process.argv[2] ?? "http://localhost:3000/dev/helix";
const DEBUG_PORT = 9333;
const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  `${process.env.LOCALAPPDATA ?? ""}\\Google\\Chrome\\Application\\chrome.exe`,
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class Cdp {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
    this.handlers = new Map();
  }
  async open() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) pending?.reject(new Error(message.error.message));
        else pending?.resolve(message.result);
        return;
      }
      for (const handler of this.handlers.get(message.method) ?? []) handler(message.params);
    });
    this.socket.addEventListener("close", ({ code, reason }) => {
      const error = new Error(`Chrome-DevTools-Verbindung geschlossen (${code}${reason ? `: ${reason}` : ""}).`);
      for (const pending of this.pending.values()) pending.reject(error);
      this.pending.clear();
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, handler) {
    this.handlers.set(method, [...(this.handlers.get(method) ?? []), handler]);
  }
  close() {
    try { this.socket.close(); } catch { /* egal */ }
  }
}

async function evaluate(client, expression) {
  const response = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result?.value;
}

const failures = [];
const notes = [];
let chrome;
let profileDir;
let client;

try {
  const { existsSync } = await import("node:fs");
  const chromePath = CHROME_CANDIDATES.find((candidate) => candidate && existsSync(candidate));
  if (!chromePath) throw new Error("Chrome nicht gefunden — Pfad in CHROME_CANDIDATES ergaenzen.");

  profileDir = await mkdtemp(path.join(tmpdir(), "deepfight-smoke-"));
  chrome = spawn(chromePath, [
    "--headless=new",
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profileDir}`,
    "--window-size=1280,900",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "about:blank",
  ], { stdio: "ignore" });

  let target = null;
  for (let attempt = 0; attempt < 40 && !target; attempt += 1) {
    await sleep(500);
    try {
      const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      const targets = await response.json();
      target = targets.find((item) => item.type === "page");
    } catch { /* Chrome noch nicht bereit */ }
  }
  if (!target) throw new Error("Chrome-DevTools-Endpunkt nicht erreichbar.");

  client = new Cdp(target.webSocketDebuggerUrl);
  await client.open();

  const consoleErrors = [];
  client.on("Runtime.consoleAPICalled", (params) => {
    if (params.type !== "error" && params.type !== "warning") return;
    const text = (params.args ?? []).map((arg) => arg.value ?? arg.description ?? "").join(" ");
    if (text) consoleErrors.push(text);
  });
  client.on("Runtime.exceptionThrown", (params) => {
    consoleErrors.push(params.exceptionDetails?.text ?? "Unbehandelte Ausnahme");
  });

  await client.send("Runtime.enable");
  await client.send("Page.enable");
  await client.send("Log.enable");
  await client.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
  });
  client.on("Log.entryAdded", (params) => {
    const text = params.entry?.text ?? "";
    if (params.entry?.level === "error" || /shader|glsl|webgl/i.test(text)) consoleErrors.push(text);
  });

  const loaded = new Promise((resolve) => client.on("Page.loadEventFired", resolve));
  const targetUrl = new URL(URL_UNDER_TEST);
  targetUrl.searchParams.set("renderer", "webgl");
  await client.send("Page.navigate", { url: targetUrl.toString() });
  await loaded;
  await evaluate(client, `document.querySelector('section[aria-label="DeepFight-Helix"]')?.scrollIntoView({block:'start'}); true`);

  // Frame-Antrieb starten, siehe Messfalle 3 im Dateikopf.
  client.on("Page.screencastFrame", (params) => {
    client.send("Page.screencastFrameAck", { sessionId: params.sessionId }).catch(() => {});
  });
  await client.send("Page.startScreencast", { format: "jpeg", quality: 30, everyNthFrame: 1 });

  // Auf die Szene warten: der lazy geladene Three.js-Chunk kompiliert beim
  // ersten Aufruf nach einem Dev-Server-Start on demand — das kann deutlich
  // laenger dauern als ein warmer Aufruf.
  let mounted = false;
  for (let attempt = 0; attempt < 90 && !mounted; attempt += 1) {
    mounted = await evaluate(client, `!!document.querySelector("[data-deepfight-webgl] canvas")`);
    if (!mounted) await sleep(500);
  }
  if (!mounted) notes.push("Canvas nach 45 s Wartezeit nicht erschienen — Checks laufen trotzdem.");

  // Stats-Event mitschneiden (kommt alle ~750 ms aus HelixScene); Maximum ueber
  // mehrere Samples, siehe Messfalle 2 im Dateikopf.
  await evaluate(client, `
    window.__smokeStats = [];
    window.addEventListener("deepfight-helix-stats", (event) => { window.__smokeStats.push(event.detail); });
    true;
  `);

  await sleep(8000);

  const samples = (await evaluate(client, "window.__smokeStats")) ?? [];
  const stats = samples.length
    ? {
        calls: Math.max(...samples.map((item) => item.calls ?? 0)),
        points: Math.max(...samples.map((item) => item.points ?? 0)),
        fps: Math.max(...samples.map((item) => item.fps ?? 0)),
        count: samples.length,
      }
    : null;
  const canvasInfo = await evaluate(client, `
    (() => {
      const canvas = document.querySelector("[data-deepfight-webgl] canvas");
      if (!canvas) return { present: false };
      const context = canvas.getContext("webgl2") || canvas.getContext("webgl");
      return {
        present: true,
        width: canvas.width,
        height: canvas.height,
        contextLost: context ? context.isContextLost() : true,
      };
    })()
  `);

  // Nicht-leere Pixel zaehlen: ein Canvas ohne Inhalt ist der klassische
  // Fehlerfall bei einem kaputten Shader. Kompositor-Screenshot statt
  // drawImage, siehe Messfalle 1 im Dateikopf.
  const clip = await evaluate(client, `
    (() => {
      const canvas = document.querySelector("[data-deepfight-webgl] canvas");
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scale: 1 };
    })()
  `);
  // SwiftShader liefert gelegentlich teilkomponierte/leere Frames. Drei
  // Kandidaten aufnehmen (Screencast laeuft dabei weiter) und den mit den
  // meisten sichtbaren Pixeln werten — gleiche Strategie wie die
  // round11-QA-Skripte im Prototyp.
  let pixelInfo = null;
  if (clip) {
    const { default: sharp } = await import("sharp");
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const shot = await client.send("Page.captureScreenshot", { format: "png", clip, captureBeyondViewport: true });
      const buffer = Buffer.from(shot.data, "base64");
      const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      let lit = 0;
      let white = 0;
      const sampled = info.width * info.height;
      for (let i = 0; i < data.length; i += info.channels) {
        const max = Math.max(data[i], data[i + 1], data[i + 2]);
        if (max > 42) lit += 1;
        if (data[i] === 255 && data[i + 1] === 255 && data[i + 2] === 255) white += 1;
      }
      if (!pixelInfo || lit > pixelInfo.lit) pixelInfo = { sampled, lit, white };
      if (attempt < 2) await sleep(400);
    }
  }

  if (!canvasInfo?.present) failures.push("Kein WebGL-Canvas im DOM — Szene wurde nicht gemountet.");
  else if (canvasInfo.contextLost) failures.push("WebGL-Kontext ist verloren.");
  else notes.push(`Canvas ${canvasInfo.width}x${canvasInfo.height}`);

  const shaderErrors = consoleErrors.filter((text) => /shader|glsl|uniform|varying|attribute|program/i.test(text));
  if (shaderErrors.length) failures.push(`Shader-/GLSL-Fehler: ${shaderErrors.slice(0, 3).join(" | ")}`);

  const otherErrors = consoleErrors.filter((text) => !shaderErrors.includes(text));
  if (otherErrors.length) notes.push(`Konsole: ${otherErrors.slice(0, 2).join(" | ")}`);

  if (!stats) {
    failures.push("Kein Stats-Event empfangen — die Render-Schleife laeuft nicht.");
  } else {
    notes.push(`Draw Calls ${stats.calls}, Punkte ${stats.points}, FPS ${stats.fps} (${stats.count} Messungen)`);
    if (stats.calls < 1) failures.push("0 Draw Calls — es wird nichts gezeichnet.");
    if (stats.calls > 8) failures.push(`${stats.calls} Draw Calls — Budget ist 8.`);
    if (stats.points < 1000) failures.push(`Nur ${stats.points} Punkte — erwartet werden Zehntausende.`);
    if (stats.points > 45000) failures.push(`${stats.points} Punkte — Budget ist 45.000.`);
  }

  if (!pixelInfo || pixelInfo.lit < 300) {
    failures.push(`Canvas ist praktisch leer (${pixelInfo?.lit ?? 0} sichtbare Pixel von ${pixelInfo?.sampled ?? 0}).`);
  } else {
    notes.push(`Sichtbare Pixel ${pixelInfo.lit}/${pixelInfo.sampled}, reinweiss ${pixelInfo.white}`);
  }
} catch (error) {
  failures.push(error.message);
} finally {
  client?.close();
  chrome?.kill();
  if (profileDir) await rm(profileDir, { recursive: true, force: true }).catch(() => {});
}

for (const note of notes) console.log(`  ${note}`);
if (failures.length) {
  console.log("\nSMOKE-TEST DURCHGEFALLEN:");
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
console.log("\nSMOKE-TEST BESTANDEN");
