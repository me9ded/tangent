// @ts-check
const { defineConfig, devices } = require("@playwright/test");

const PORT = 4173;

module.exports = defineConfig({
  testDir: ".",
  testMatch: "*.spec.js",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  // A stuck browser should fail the run, not hold CI for hours.
  globalTimeout: 10 * 60 * 1000,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    // Most tests don't want the service worker in the way; the offline spec turns it back on.
    serviceWorkers: "block",
    trace: "retain-on-failure"
  },
  webServer: {
    command: `python3 -m http.server ${PORT} --bind 127.0.0.1`,
    // CI tests the built site (exactly what gets deployed); locally, the repo itself.
    cwd: process.env.SITE_DIR || "..",
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "ignore"
  },
  projects: [
    { name: "android-chromium", use: { ...devices["Pixel 7"] } },
    { name: "iphone-webkit", use: { ...devices["iPhone 14"] } }
  ]
});
