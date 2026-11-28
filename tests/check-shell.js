// Fails if sw.js precaches a file that doesn't exist (a typo there breaks offline install),
// or if a module in js/ isn't precached (the app would break offline).
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const block = sw.match(/const SHELL = \[([\s\S]*?)\];/);
if (!block) { console.error("Couldn't find the SHELL list in sw.js"); process.exit(1); }
const files = [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const missing = files.filter((f) => f !== "./" && !fs.existsSync(path.join(root, f)));
if (missing.length) { console.error("sw.js precaches missing files:\n  " + missing.join("\n  ")); process.exit(1); }

// And the other way round: every module the app loads has to be precached, or it breaks offline.
const listed = new Set(files.map((f) => f.replace(/^\.\//, "")));
const modules = fs.readdirSync(path.join(root, "js"), { recursive: true })
  .map((f) => "js/" + String(f).split(path.sep).join("/"))
  .filter((f) => f.endsWith(".js"));
const unlisted = modules.filter((f) => !listed.has(f));
if (unlisted.length) { console.error("sw.js doesn't precache these modules:\n  " + unlisted.join("\n  ")); process.exit(1); }
console.log("sw.js SHELL: all " + files.length + " entries exist, and all " + modules.length + " modules are listed.");
