// Builds the folder GitHub Pages serves: only the app's own files, with the version stamped into the
// service worker (so every deploy is a new version, and open apps offer "Reload") and into the page.
//   node build-site.js <out dir> <version>
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const [outArg, version] = process.argv.slice(2);
const fail = (msg) => { console.error(msg); process.exit(1); };
if (!outArg || !version) fail("usage: node build-site.js <out dir> <version>");
if (!/^tangent-[\w.-]+$/.test(version)) fail("version must look like tangent-<something>, got " + version);
const out = path.resolve(outArg);

const FILES = ["index.html", "styles.css", "sw.js", "manifest.webmanifest"];
const DIRS = ["js", "icons", "fonts"];
// Tooling that lives next to the app but isn't part of it.
const SKIP = new Set(["package.json"]);

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
let copied = 0;
for (const f of FILES) {
  if (!fs.existsSync(path.join(root, f))) continue;
  fs.copyFileSync(path.join(root, f), path.join(out, f));
  copied++;
}
for (const d of DIRS) {
  const src = path.join(root, d);
  if (!fs.existsSync(src)) continue;
  fs.cpSync(src, path.join(out, d), { recursive: true, filter: (p) => !SKIP.has(path.basename(p)) && !path.basename(p).startsWith(".") });
  copied++;
}

const swPath = path.join(out, "sw.js");
const sw = fs.readFileSync(swPath, "utf8");
const marker = 'const VERSION = "tangent-dev";';
if (sw.split(marker).length !== 2) fail("sw.js must contain exactly one " + marker);
fs.writeFileSync(swPath, sw.replace(marker, 'const VERSION = "' + version + '";'));

// The page shows the same version in Settings.
const htmlPath = path.join(out, "index.html");
const html = fs.readFileSync(htmlPath, "utf8");
const meta = '<meta name="version" content="tangent-dev">';
if (html.split(meta).length !== 2) fail("index.html must contain exactly one " + meta);
fs.writeFileSync(htmlPath, html.replace(meta, '<meta name="version" content="' + version + '">'));

// Everything the service worker precaches has to be in the site, or installing it fails.
const block = sw.match(/const SHELL = \[([\s\S]*?)\];/);
if (!block) fail("Couldn't find the SHELL list in sw.js");
const missing = [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]).filter((f) => f !== "./" && !fs.existsSync(path.join(out, f)));
if (missing.length) fail("The site is missing files sw.js precaches:\n  " + missing.join("\n  "));

console.log("Built " + path.relative(process.cwd(), out) + " (" + copied + " entries) as " + version);
