import fs from "node:fs";
import path from "node:path";
import {
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  nativeImage,
  screen,
} from "electron";

export type CaptureOptions = {
  imgDir: string;
  delayMs?: number;
  jpegQuality?: number;
};

export type CaptureResult = {
  imagePath: string;
  base64: string;
  mimeType: "image/jpeg";
  width: number;
  height: number;
};

type SelectionRegion = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function findPrimaryScreenSource(
  sources: Electron.DesktopCapturerSource[],
  primaryDisplay: Electron.Display,
): Electron.DesktopCapturerSource {
  const displayId = String(primaryDisplay.id);

  return (
    sources.find((source) => String(source.display_id) === displayId) ||
    sources.find((source) => source.id === `screen:${displayId}:0`) ||
    sources.find((source) => source.id.startsWith(`screen:${displayId}:`)) ||
    sources[0]
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildSelectorHtml(channel: string): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      cursor: crosshair;
      user-select: none;
      background: rgba(0, 0, 0, 0.18);
      font-family: "Segoe UI", Arial, sans-serif;
    }
    #hint {
      position: fixed;
      top: 18px;
      left: 50%;
      transform: translateX(-50%);
      padding: 8px 12px;
      border-radius: 4px;
      color: #fff;
      background: rgba(0, 0, 0, 0.62);
      font-size: 13px;
      letter-spacing: 0;
      pointer-events: none;
    }
    #selection {
      position: fixed;
      display: none;
      border: 2px solid #31d0ff;
      background: rgba(49, 208, 255, 0.14);
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.28);
      box-sizing: border-box;
    }
    #size {
      position: absolute;
      right: 0;
      bottom: -26px;
      padding: 3px 6px;
      color: #fff;
      background: rgba(0, 0, 0, 0.72);
      font-size: 12px;
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <div id="hint">拖拽选择截图范围，Esc 取消</div>
  <div id="selection"><span id="size"></span></div>
  <script>
    const { ipcRenderer } = require("electron");
    const channel = ${JSON.stringify(channel)};
    const selection = document.getElementById("selection");
    const size = document.getElementById("size");
    let isDragging = false;
    let startX = 0;
    let startY = 0;

    function updateSelection(currentX, currentY) {
      const x = Math.min(startX, currentX);
      const y = Math.min(startY, currentY);
      const width = Math.abs(currentX - startX);
      const height = Math.abs(currentY - startY);

      selection.style.display = "block";
      selection.style.left = x + "px";
      selection.style.top = y + "px";
      selection.style.width = width + "px";
      selection.style.height = height + "px";
      size.textContent = Math.round(width) + " x " + Math.round(height);

      return { x, y, width, height };
    }

    window.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      ipcRenderer.send(channel, { cancelled: true });
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        ipcRenderer.send(channel, { cancelled: true });
      }
    });

    window.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      isDragging = true;
      startX = event.clientX;
      startY = event.clientY;
      updateSelection(startX, startY);
    });

    window.addEventListener("mousemove", (event) => {
      if (!isDragging) return;
      updateSelection(event.clientX, event.clientY);
    });

    window.addEventListener("mouseup", (event) => {
      if (!isDragging || event.button !== 0) return;
      isDragging = false;
      const region = updateSelection(event.clientX, event.clientY);

      if (region.width < 4 || region.height < 4) {
        ipcRenderer.send(channel, { cancelled: true });
        return;
      }

      ipcRenderer.send(channel, { region });
    });
  </script>
</body>
</html>`;
}

function selectRegion(display: Electron.Display): Promise<SelectionRegion> {
  const channel = `capture-region-${Date.now()}-${Math.random()}`;
  const { bounds } = display;

  return new Promise((resolve, reject) => {
    let finished = false;
    const selectorWindow = new BrowserWindow({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      hasShadow: false,
      title: "选择截图范围",
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    function cleanup(): void {
      ipcMain.removeListener(channel, handleSelection);
    }

    function finish(error: Error | null, region?: SelectionRegion): void {
      if (finished) return;
      finished = true;
      cleanup();

      if (!selectorWindow.isDestroyed()) {
        selectorWindow.close();
      }

      if (error) {
        reject(error);
        return;
      }
      resolve(region as SelectionRegion);
    }

    function handleSelection(
      _event: Electron.IpcMainEvent,
      payload: { cancelled?: boolean; region?: SelectionRegion },
    ): void {
      if (payload?.cancelled) {
        finish(new Error("已取消截图选择"));
        return;
      }

      if (!payload?.region) {
        finish(new Error("未获取到有效截图范围"));
        return;
      }

      finish(null, payload.region);
    }

    ipcMain.on(channel, handleSelection);

    selectorWindow.on("closed", () => {
      if (!finished) {
        finish(new Error("已取消截图选择"));
      }
    });

    selectorWindow.setAlwaysOnTop(true, "screen-saver");
    selectorWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(buildSelectorHtml(channel))}`,
    );
    selectorWindow.focus();
  });
}

async function captureDisplay(
  display: Electron.Display,
): Promise<Electron.NativeImage> {
  const { bounds } = display;
  const scaleFactor = display.scaleFactor || 1;
  const thumbnailSize = {
    width: Math.ceil(bounds.width * scaleFactor),
    height: Math.ceil(bounds.height * scaleFactor),
  };

  const sources = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize,
  });

  const source = findPrimaryScreenSource(sources, display);
  if (!source || !source.thumbnail || source.thumbnail.isEmpty()) {
    throw new Error("未能获取屏幕截图，请检查系统截图权限");
  }

  return nativeImage.createFromBuffer(source.thumbnail.toPNG());
}

export async function captureSelectedRegion(
  options: CaptureOptions,
): Promise<CaptureResult> {
  const { imgDir, delayMs = 150, jpegQuality = 92 } = options;

  if (!imgDir) {
    throw new Error("imgDir is required");
  }

  ensureDir(imgDir);

  const targetDisplay = screen.getDisplayNearestPoint(
    screen.getCursorScreenPoint(),
  );
  const region = await selectRegion(targetDisplay);

  if (delayMs > 0) {
    await sleep(delayMs);
  }

  const image = await captureDisplay(targetDisplay);
  const imageSize = image.getSize();
  const scaleX = imageSize.width / targetDisplay.bounds.width;
  const scaleY = imageSize.height / targetDisplay.bounds.height;
  const cropX = clamp(Math.round(region.x * scaleX), 0, imageSize.width - 1);
  const cropY = clamp(Math.round(region.y * scaleY), 0, imageSize.height - 1);
  const cropWidth = clamp(
    Math.round(region.width * scaleX),
    1,
    imageSize.width - cropX,
  );
  const cropHeight = clamp(
    Math.round(region.height * scaleY),
    1,
    imageSize.height - cropY,
  );
  const croppedImage = image.crop({
    x: cropX,
    y: cropY,
    width: cropWidth,
    height: cropHeight,
  });
  const quality = Math.max(1, Math.min(100, Number(jpegQuality) || 92));
  const buffer = croppedImage.toJPEG(quality);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const imagePath = path.join(imgDir, `screenshot_${timestamp}.jpg`);

  fs.writeFileSync(imagePath, buffer);

  return {
    imagePath,
    base64: buffer.toString("base64"),
    mimeType: "image/jpeg",
    width: croppedImage.getSize().width,
    height: croppedImage.getSize().height,
  };
}
