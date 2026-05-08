const fs = require("fs");
const path = require("path");
const { desktopCapturer, nativeImage, screen } = require("electron");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function findPrimaryScreenSource(sources, primaryDisplay) {
  const displayId = String(primaryDisplay.id);

  return (
    sources.find((source) => String(source.display_id) === displayId) ||
    sources.find((source) => source.id === `screen:${displayId}:0`) ||
    sources.find((source) => source.id.startsWith(`screen:${displayId}:`)) ||
    sources[0]
  );
}

async function capturePrimaryScreen(options = {}) {
  const {
    imgDir,
    delayMs = 300,
    jpegQuality = 92,
  } = options;

  if (!imgDir) {
    throw new Error("imgDir is required");
  }

  ensureDir(imgDir);

  if (delayMs > 0) {
    await sleep(delayMs);
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.size;
  const scaleFactor = primaryDisplay.scaleFactor || 1;
  const thumbnailSize = {
    width: Math.ceil(width * scaleFactor),
    height: Math.ceil(height * scaleFactor),
  };

  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize,
  });

  const source = findPrimaryScreenSource(sources, primaryDisplay);
  if (!source || !source.thumbnail || source.thumbnail.isEmpty()) {
    throw new Error("未能获取屏幕截图，请检查系统截图权限");
  }

  const image = nativeImage.createFromBuffer(source.thumbnail.toPNG());
  const quality = Math.max(1, Math.min(100, Number(jpegQuality) || 92));
  const buffer = image.toJPEG(quality);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const imagePath = path.join(imgDir, `screenshot_${timestamp}.jpg`);

  fs.writeFileSync(imagePath, buffer);

  return {
    imagePath,
    base64: buffer.toString("base64"),
    mimeType: "image/jpeg",
    width: image.getSize().width,
    height: image.getSize().height,
  };
}

module.exports = {
  capturePrimaryScreen,
};

