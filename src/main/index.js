const path = require("path");
const { app } = require("electron");
const { capturePrimaryScreen } = require("./tools/captureScreen");
const { analyzeImage, loadAIConfig } = require("./tools/aiClient");

const imgDir = path.join(__dirname, "../img");
const CAPTURE_DELAY_MS = 300;
const JPEG_QUALITY = 92;

async function main() {
  const config = loadAIConfig();

  console.log("[AIcapture] Capturing primary screen...");
  const screenshot = await capturePrimaryScreen({
    imgDir,
    delayMs: CAPTURE_DELAY_MS,
    jpegQuality: JPEG_QUALITY,
  });

  console.log(`[AIcapture] Screenshot saved: ${screenshot.imagePath}`);
  console.log("[AIcapture] Sending screenshot to AI...");

  const answer = await analyzeImage({
    base64Image: screenshot.base64,
    mimeType: screenshot.mimeType,
    prompt: config.prompt,
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
