// Fails if sw.js precaches a file that doesn't exist (a typo there breaks offline install).
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const block = sw.match(/const SHELL = \[([\s\S]*?)\];/);
if (!block) { console.error("Couldn't find the SHELL list in sw.js"); process.exit(1); }
const files = [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const missing = files.filter((f) => f !== "./" && !fs.existsSync(path.join(root, f)));
if (missing.length) { console.error("sw.js precaches missing files:\n  " + missing.join("\n  ")); process.exit(1); }
console.log("sw.js SHELL: all " + files.length + " entries exist.");
