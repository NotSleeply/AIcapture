const path = require("path");
const { execSync } = require("child_process");
const { app } = require("electron");
const { captureSelectedRegion } = require("./tools/captureScreen");
const { analyzeImage, loadAIConfig } = require("./tools/aiClient");

const imgDir = path.join(__dirname, "../img");
const CAPTURE_DELAY_MS = 300;
const JPEG_QUALITY = 92;

app.on("window-all-closed", () => {
  // Keep the process alive after the temporary selector window closes.
  // The CLI flow exits explicitly after screenshot analysis completes.
});

function ensureUtf8Console() {
  if (process.platform !== "win32") return;

  try {
    const output = execSync("chcp", {
      stdio: ["ignore", "pipe", "ignore"],
    }).toString();
    const match = output.match(/:\s*(\d+)/);
    const codePage = match ? Number(match[1]) : null;

    if (codePage !== 65001) {
      execSync("chcp 65001", { stdio: "ignore" });
    }
  } catch {
    console.warn(
      "[AIcapture] Unable to set console code page to UTF-8. If output is garbled, run `chcp 65001`.",
    );
  }
}

async function main() {
  ensureUtf8Console();
  const config = loadAIConfig();

  console.log("[AIcapture] Select a screenshot region...");
  const screenshot = await captureSelectedRegion({
    imgDir,
    delayMs: CAPTURE_DELAY_MS,
    jpegQuality: JPEG_QUALITY,
  });

  console.log(`[AIcapture] Screenshot saved: ${screenshot.imagePath}`);
  console.log("[AIcapture] Sending screenshot to AI...");

  const answer = await analyzeImage({
    base64Image: screenshot.base64,
    mimeType: screenshot.mimeType,
    config,
  });

  console.log("\n===== AI Analysis =====\n");
  console.log(answer.trim());
}

app
  .whenReady()
  .then(main)
  .then(() => {
    app.exit(0);
  })
  .catch((error) => {
    console.error(`\n[AIcapture] Failed: ${error.message}`);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    app.exit(1);
  });
