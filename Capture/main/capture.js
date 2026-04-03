const {
  globalShortcut,
  ipcMain,
  clipboard,
  nativeImage,
  BrowserWindow,
  app,
} = require("electron");
const Screenshots = require("electron-screenshots");
const path = require("path");
const fs = require("fs");
const { format } = require("url");
const startCapture = require("./tools/startCapture");

/**
 * 截图主控制器
 * @param {BrowserWindow} mainWindow - 主窗口引用
 * @param {string} imgDir - 图片保存目录
 */
function captureWin(mainWindow, imgDir) {
  global.IMwindow = mainWindow; // 保存主窗口引用
  global.isCutHideWindows = false; // 默认隐藏设置
  global.enableAIAnalysis = true; // 默认启用AI分析
  let dialogWindow = null; // 对话窗口引用
  let currentImageBuffer = null; // 临时保存当前截图数据
  let currentImagePath = null; // 临时保存当前截图路径
  let cutKey = ""; // 初始化快捷键
  let showKey = ""; // 初始化显示设置

  // 获取本地存储的快捷键，如果没有，则设置默认值
  try {
    // 尝试从本地存储读取自定义快捷键
    if (global.localStorage && global.localStorage.captureKey) {
      cutKey = global.localStorage.captureKey;
    } else {
      // 设置默认快捷键为 Alt+S
      cutKey = "Alt + S";
    }

    if (global.localStorage && global.localStorage.showKey) {
      showKey = global.localStorage.showKey;
    }
  } catch (err) {
    console.log("cutKey set err:", err);
    // 设置默认快捷键为 Alt+S
    cutKey = "Alt + S";
  }

  // 自动注册截图快捷键
  if (cutKey) {
    try {
      globalShortcut.register(cutKey, () => {
        startCapture(mainWindow, screenshots);
      });
    } catch (error) {
      console.error("cutKey set err:", error);
    }
  }

  // 自动注册显示快捷键
  if (showKey) {
    try {
      globalShortcut.register(showKey, () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
          }
        }
      });
      console.log("已注册显示快捷键:", showKey);
    } catch (error) {
      console.error("注册显示快捷键失败:", error);
    }
  }

  // 创建截图实例
  const screenshots = new Screenshots({
    singleInstanceLock: true,
  });

  // 监听截图完成事件
  screenshots.on("ok", (e, buffer, bounds) => {
    // 将截图写入系统剪贴板
    clipboard.writeImage(nativeImage.createFromBuffer(buffer));

    // 保存当前截图的Buffer
    currentImageBuffer = buffer;

    // 生成唯一文件名并保存图片到缓存目录
    const timestamp = new Date().getTime();
    const filename = `screenshot_${timestamp}.jpg`;
    currentImagePath = path.join(imgDir, filename);

    try {
      const nImage = nativeImage.createFromBuffer(buffer);
      const jpegBuffer = nImage.toJPEG(95); // 95%质量

      fs.writeFileSync(currentImagePath, jpegBuffer);
    } catch (err) {
      console.error("Save err dir path:", err);
      // 如果转换失败，尝试保存原始格式
      try {
        fs.writeFileSync(currentImagePath, buffer);
      } catch (fallbackErr) {
        console.error("Save err format:", fallbackErr);
        currentImagePath = null;
      }
    }
    mainWindow.setSkipTaskbar(false);
    // 创建并显示对话窗口
    if (global.enableAIAnalysis) {
      createDialogWindow();
    }

    // 通知渲染进程截图已完成
    mainWindow.webContents.send("popup-tips");

    // 恢复点击状态
    mainWindow.webContents.send("has-click-cut", false);
  });

  // 创建对话窗口
  function createDialogWindow() {
    // 如果已经有对话窗口，就关闭它
    if (dialogWindow) {
      dialogWindow.close();
      dialogWindow = null;
    }

    // 创建新的对话窗口
    dialogWindow = new BrowserWindow({
      width: 920,
      height: 780,
      minWidth: 700,
      minHeight: 550,
      title: "AI分析",
      autoHideMenuBar: true,
      resizable: true,
      frame: false,
      alwaysOnTop: true,
      webPreferences: {
        devTools: true,
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "../preloader/preload.js"),
      },
    });

    // 加载对话窗口的HTML
    const dialogURL = format({
      protocol: "file",
      slashes: true,
      pathname: path.join(__dirname, "../renderer/dialog.html"),
    });

    dialogWindow.loadURL(dialogURL);

    // 如果是开发环境，打开开发者工具
    if (process.env.NODE_ENV === "development") {
      dialogWindow.webContents.openDevTools();
    }

    // 监听窗口关闭事件
    dialogWindow.on("closed", () => {
      dialogWindow = null;
    });
  }

  // 获取图像数据
  ipcMain.handle("get-image-data", () => {
    if (currentImageBuffer && currentImagePath) {
      try {
        // 将Buffer转换为dataURL格式用于预览
        const nImage = nativeImage.createFromBuffer(currentImageBuffer);
        const dataURL = nImage.toPNG
          ? "data:image/png;base64," + nImage.toPNG().toString("base64")
          : nImage.toDataURL();

        return {
          success: true,
          imageDataUrl: dataURL, // 用于预览
          imagePath: currentImagePath, // 本地文件路径
          imageSize: {
            width: nImage.getSize().width,
            height: nImage.getSize().height,
          },
        };
      } catch (error) {
        console.error("转换图像数据失败:", error);
        return { success: false, error: error.message };
      }
    }
    return { success: false, error: "没有可用的图像数据" };
  });

  // 读取文件并返回Buffer
  ipcMain.handle("read-image-file", async (event, filePath) => {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: "文件不存在" };
      }

      const buffer = fs.readFileSync(filePath);

      return {
        success: true,
        data: buffer, // 直接返回二进制数据
        mimeType: "image/png", // 指定MIME类型
      };
    } catch (error) {
      console.error("读取图像文件失败:", error);
      return { success: false, error: error.message };
    }
  });

  // 保留原有的Base64转换方法以保持兼容性
  ipcMain.handle("read-file-as-base64", async (event, filePath) => {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: "文件不存在" };
      }

      const buffer = fs.readFileSync(filePath);
      const base64Data = buffer.toString("base64");

      return {
        success: true,
        data: base64Data,
      };
    } catch (error) {
      console.error("读取文件为Base64失败:", error);
      return { success: false, error: error.message };
    }
  });

  // 保存图像
  ipcMain.handle("save-image", async (event) => {
    try {
      if (!currentImageBuffer) {
        return { success: false, error: "没有可用的图像数据" };
      }

      // 获取用户下载目录
      const { dialog } = require("electron");
      const userPath = app.getPath("downloads");

      // 创建文件名
      const fileName = `Screenshot_${new Date()
        .toISOString()
        .replace(/:/g, "-")
        .replace(/\..+/, "")}.jpg`;

      // 请求用户选择保存路径
      const result = await dialog.showSaveDialog({
        title: "保存截图",
        defaultPath: path.join(userPath, fileName),
        filters: [
          { name: "JPEG图像", extensions: ["jpg", "jpeg"] },
          { name: "所有文件", extensions: ["*"] },
        ],
      });

      if (result.canceled) {
        return { success: false };
      }

      try {
        // 创建nativeImage对象
        const nImage = nativeImage.createFromBuffer(currentImageBuffer);

        // 将图像转换为JPEG格式的Buffer
        const jpegBuffer = nImage.toJPEG(90); // 90%质量

        // 保存JPEG图像
        fs.writeFileSync(result.filePath, jpegBuffer);

        return { success: true, filePath: result.filePath };
      } catch (convError) {
        console.error("转换图像格式失败:", convError);

        // 如果转换失败，尝试直接保存原始Buffer
        fs.writeFileSync(result.filePath, currentImageBuffer);
        return { success: true, filePath: result.filePath };
      }
    } catch (error) {
      console.error("保存图像失败:", error);
      return { success: false, error: error.message };
    }
  });

  // 关闭对话窗口
  ipcMain.on("close-dialog", () => {
    if (dialogWindow) {
      dialogWindow.close();
    }
  });
  // AI 分析设置处理
  ipcMain.on("set-ai-analysis", (event, status) => {
    global.enableAIAnalysis = !!status;
  });

  // 监听截图取消事件
  screenshots.on("cancel", () => {
    // 恢复点击状态
    mainWindow.webContents.send("has-click-cut", false);
  });

  // 监听截图错误事件
  screenshots.on("error", (error) => {
    console.error("截图错误:", error);

    // 恢复主窗口显示
    if (global.isCutHideWindows && mainWindow) {
      mainWindow.show();
    }

    // 恢复点击状态
    mainWindow.webContents.send("has-click-cut", false);
  });

  // 开始截图的IPC处理
  ipcMain.on("cut-screen", () => {
    startCapture(mainWindow, screenshots);
  });

  // 设置截图快捷键
  ipcMain.on("setCaptureKey", (event, key) => {
    try {
      // 注销旧快捷键
      if (cutKey) {
        globalShortcut.unregister(cutKey);
      }

      cutKey = key;

      // 注册新快捷键
      if (key) {
        globalShortcut.register(key, () => {
          startCapture(mainWindow, screenshots);
        });
      }
    } catch (error) {
      console.error("设置快捷键失败:", error);
    }
  });

  // 设置显示快捷键
  ipcMain.on("setShowKey", (event, key) => {
    try {
      // 注销旧快捷键
      if (showKey) {
        globalShortcut.unregister(showKey);
      }

      showKey = key;

      // 注册新快捷键
      if (key) {
        globalShortcut.register(key, () => {
          if (mainWindow) {
            if (mainWindow.isVisible()) {
              mainWindow.hide();
            } else {
              mainWindow.show();
            }
          }
        });
      }
    } catch (error) {
      console.error("设置显示快捷键失败:", error);
    }
  });

  // 设置是否隐藏窗口
  ipcMain.on("is-hide-windows", (event, status) => {
    global.isCutHideWindows = !!status;
  });

  // 清理资源
  mainWindow.on("closed", () => {
    screenshots.removeAllListeners();
    if (dialogWindow) {
      dialogWindow.close();
    }

    // 清理缓存文件
    try {
      if (currentImagePath && fs.existsSync(currentImagePath)) {
        fs.unlinkSync(currentImagePath);
      }
    } catch (err) {
      console.error("清理缓存文件失败:", err);
    }
  });

  // 截图直接插入到主窗口
  ipcMain.on("insert-canvas", () => {
    if (mainWindow) {
      mainWindow.webContents.send("popup-tips");
    }
  });
}

module.exports = captureWin;
