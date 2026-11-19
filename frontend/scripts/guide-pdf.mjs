// Turns ../DEVELOPER_GUIDE.md into ../DEVELOPER_GUIDE.pdf
// Run from the frontend folder:   npm run guide:pdf
// How: Markdown -> styled HTML (marked) -> PDF (Microsoft Edge or Chrome in headless mode)
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { marked } from "marked";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const input = join(root, "DEVELOPER_GUIDE.md");
const output = join(root, "DEVELOPER_GUIDE.pdf");

// GitHub-style heading ids so the table-of-contents links work in the PDF
const slug = (s) =>
  s.toLowerCase().replace(/<[^>]+>/g, "").replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s/g, "-");
const renderer = new marked.Renderer();
renderer.heading = (text, level, raw) => `<h${level} id="${slug(raw)}">${text}</h${level}>\n`;

let body = marked.parse(readFileSync(input, "utf8").replace(/^# .*\n/, ""), { renderer, gfm: true });
// Box-drawing diagrams must not wrap
body = body.replace(/<pre><code([^>]*)>([\s\S]*?)<\/code><\/pre>/g, (m, attrs, code) =>
  /[┌└│─▶◀]/.test(code) ? `<pre class="diagram"><code${attrs}>${code}</code></pre>` : m);

const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

const html = `<!doctype html><html><head><meta charset="utf-8"><title>B2 Developer Guide</title><style>
  @page { size: A4; margin: 16mm 14mm 18mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: "Segoe UI", system-ui, sans-serif; font-size: 10.5pt; line-height: 1.55; color: #1f2333; margin: 0; }
  .cover { height: 250mm; display: flex; flex-direction: column; justify-content: center; padding: 0 12mm; color: #fff;
    background: linear-gradient(135deg, #2e1065 0%, #3730a3 50%, #0e7490 100%); border-radius: 6mm; page-break-after: always; }
  .logo { width: 30mm; height: 30mm; border-radius: 8mm; display: grid; place-items: center; font-size: 34pt; font-weight: 800;
    letter-spacing: -2px; background: linear-gradient(135deg, #a855f7, #6366f1, #06b6d4); box-shadow: 0 8px 30px rgba(0,0,0,.35); margin-bottom: 10mm; }
  .cover h1 { font-size: 36pt; margin: 0 0 4mm; letter-spacing: -1px; }
  .cover p { font-size: 13pt; opacity: .9; margin: 0 0 2mm; max-width: 150mm; }
  .cover .meta { margin-top: 14mm; font-size: 10.5pt; opacity: .8; }
  .tags { margin-top: 8mm; display: flex; gap: 3mm; flex-wrap: wrap; }
  .tags span { border: 1px solid rgba(255,255,255,.4); border-radius: 99px; padding: 1mm 4mm; font-size: 9.5pt; }
  h2 { font-size: 17pt; color: #3730a3; border-bottom: 2.5px solid #a5b4fc; padding-bottom: 2mm; margin: 0 0 4mm; page-break-before: always; }
  h2#contents { page-break-before: avoid; }
  h3 { font-size: 12.5pt; color: #4c1d95; margin: 6mm 0 2mm; page-break-after: avoid; }
  p { margin: 0 0 2.5mm; } ul, ol { margin: 1mm 0 3mm; padding-left: 6mm; } li { margin: .8mm 0; }
  a { color: #4338ca; text-decoration: none; } strong { color: #111827; }
  hr { border: none; border-top: 1px dashed #c7d2fe; margin: 5mm 0; }
  blockquote { margin: 3mm 0; padding: 2.5mm 4mm; background: #eef2ff; border-left: 4px solid #6366f1; border-radius: 0 2mm 2mm 0; color: #312e81; }
  blockquote p { margin: 0; }
  code { font-family: Consolas, "Cascadia Code", monospace; font-size: 9pt; background: #f1f0ff; color: #5b21b6; padding: .3mm 1.2mm; border-radius: 1mm; }
  pre { background: #0f1222; color: #e2e8f0; padding: 3.5mm 4mm; border-radius: 2.5mm; font-size: 8.6pt; line-height: 1.45;
    white-space: pre-wrap; word-break: break-word; page-break-inside: avoid; }
  pre.diagram { white-space: pre; word-break: normal; font-size: 7.1pt; line-height: 1.25; overflow: hidden; }
  pre code { background: none; color: inherit; padding: 0; font-size: inherit; }
  table { width: 100%; border-collapse: collapse; margin: 2mm 0 4mm; font-size: 9.3pt; }
  tr { page-break-inside: avoid; }
  th { background: #3730a3; color: #fff; text-align: left; padding: 1.8mm 2.5mm; }
  td { padding: 1.6mm 2.5mm; border-bottom: 1px solid #e5e7f0; vertical-align: top; }
  tr:nth-child(even) td { background: #f7f7fd; }
  td code, th code { font-size: 8.5pt; }
</style></head><body>
  <section class="cover">
    <div class="logo">B2</div>
    <h1>B2 Developer Guide</h1>
    <p>A private, ChatGPT-style AI chatbot that runs on my own PC: React interface, Python server, web search and my own versioned AI model on Ollama.</p>
    <p>What was built, step by step, and how to set it up, run it, change it and upgrade it.</p>
    <div class="tags"><span>Ollama</span><span>Qwen3 4B</span><span>Python</span><span>React + Vite</span><span>Bootstrap</span><span>RAG web search</span><span>Modelfile versions</span></div>
    <div class="meta">Built by Anubhav &nbsp;·&nbsp; ${today}</div>
  </section>
  ${body}
</body></html>`;

const tmp = mkdtempSync(join(tmpdir(), "b2-guide-"));
const htmlPath = join(tmp, "guide.html");
writeFileSync(htmlPath, html);

const browsers = [
  join(process.env["ProgramFiles(x86)"] ?? "", "Microsoft/Edge/Application/msedge.exe"),
  join(process.env.ProgramFiles ?? "", "Microsoft/Edge/Application/msedge.exe"),
  join(process.env.ProgramFiles ?? "", "Google/Chrome/Application/chrome.exe"),
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
];
const browser = browsers.find((b) => b && existsSync(b));
if (!browser) throw new Error("Edge or Chrome not found. Open the HTML and print to PDF: " + htmlPath);

execFileSync(browser, [
  "--headless=new", "--disable-gpu", "--no-pdf-header-footer",
  `--user-data-dir=${join(tmp, "profile")}`, `--print-to-pdf=${output}`, pathToFileURL(htmlPath).href,
], { stdio: "ignore" });
console.log("PDF written:", output);
