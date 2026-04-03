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
const ScrollCapture = require("./tools/scrollCapture");

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
  let editorWindow = null; // 编辑器窗口引用
  let galleryWindow = null; // 图库窗口引用
  let currentImageBuffer = null; // 临时保存当前截图数据
  let currentImagePath = null; // 临时保存当前截图路径
  let editedImagePath = null; // 编辑后的图片路径
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
    // 创建并显示编辑器窗口（在AI分析前）
    if (global.enableAIAnalysis) {
      createEditorWindow();
    }

    // 通知渲染进程截图已完成
    mainWindow.webContents.send("popup-tips");

    // 恢复点击状态
    mainWindow.webContents.send("has-click-cut", false);
  });

  // 创建编辑器窗口（截图后、AI分析前的编辑层）
  function createEditorWindow() {
    if (editorWindow) {
      editorWindow.close();
      editorWindow = null;
    }

    editorWindow = new BrowserWindow({
      width: 1000,
      height: 750,
      minWidth: 800,
      minHeight: 600,
      title: "截图编辑",
      autoHideMenuBar: true,
      resizable: true,
      frame: false,
      alwaysOnTop: true,
      webPreferences: {
        devTools: true,
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "../preloader/preloadEditor.js"),
      },
    });

    const editorURL = format({
      protocol: "file",
      slashes: true,
      pathname: path.join(__dirname, "../renderer/editor.html"),
    });

    editorWindow.loadURL(editorURL);

    if (process.env.NODE_ENV === "development") {
      editorWindow.webContents.openDevTools();
    }

    editorWindow.on("closed", () => {
      editorWindow = null;
    });
  }

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

  // 获取图像数据（支持编辑后的图片）
  ipcMain.handle("get-image-data", () => {
    const imagePathToUse = editedImagePath && fs.existsSync(editedImagePath) ? editedImagePath : currentImagePath;
    
    if (currentImageBuffer && imagePathToUse) {
      try {
        let imageBuffer = currentImageBuffer;
        
        // 如果有编辑后图片，读取编辑后的
        if (editedImagePath && fs.existsSync(editedImagePath)) {
          try {
            imageBuffer = fs.readFileSync(editedImagePath);
          } catch (e) {
            console.error("读取编辑后图片失败，使用原图:", e);
          }
        }

        const nImage = nativeImage.createFromBuffer(imageBuffer);
        const dataURL = nImage.toPNG
          ? "data:image/png;base64," + nImage.toPNG().toString("base64")
          : nImage.toDataURL();

        return {
          success: true,
          imageDataUrl: dataURL,
          imagePath: imagePathToUse,
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

  // ===== 编辑器相关 IPC 处理 =====

  // 保存编辑后的图片
  ipcMain.handle("save-edited-image", async (event, dataURL) => {
    try {
      // 从 dataURL 提取 base64 数据
      const base64Data = dataURL.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      // 生成新文件名保存编辑后图片
      const timestamp = new Date().getTime();
      const filename = `edited_${timestamp}.png`;
      editedImagePath = path.join(imgDir, filename);

      fs.writeFileSync(editedImagePath, buffer);

      return {
        success: true,
        filePath: editedImagePath,
        imagePath: editedImagePath,
      };
    } catch (error) {
      console.error("保存编辑图片失败:", error);
      return { success: false, error: error.message };
    }
  });

  // 关闭编辑器窗口并决定是否进入AI分析
  ipcMain.on("close-editor", (event, hasEdited) => {
    if (editorWindow) {
      editorWindow.close();
      editorWindow = null;
    }

    // 如果用户进行了编辑，使用编辑后的图片路径；否则使用原图
    if (hasEdited && editedImagePath && fs.existsSync(editedImagePath)) {
      currentImagePath = editedImagePath;
      // 更新 imageBuffer 以便导出等操作使用
      try {
        currentImageBuffer = fs.readFileSync(editedImagePath);
      } catch (e) {
        console.error("读取编辑后图片失败:", e);
      }
    }

    // 打开AI分析对话框
    if (global.enableAIAnalysis) {
      createDialogWindow();
    }
  });

  // ===== 图库相关 =====

  // 打开图库窗口
  ipcMain.on("open-gallery", () => {
    createGalleryWindow();
  });

  function createGalleryWindow() {
    if (galleryWindow) {
      galleryWindow.focus();
      return;
    }

    galleryWindow = new BrowserWindow({
      width: 1000,
      height: 700,
      minWidth: 700,
      minHeight: 500,
      title: "截图历史 - AIcapture",
      autoHideMenuBar: true,
      resizable: true,
      frame: false,
      webPreferences: {
        devTools: true,
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "../preloader/preload.js"),
      },
    });

    const galleryURL = format({
      protocol: "file",
      slashes: true,
      pathname: path.join(__dirname, "../renderer/gallery.html"),
    });

    galleryWindow.loadURL(galleryURL);

    if (process.env.NODE_ENV === "development") {
      galleryWindow.webContents.openDevTools();
    }

    galleryWindow.on("closed", () => { galleryWindow = null; });
  }
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

  // 滚动截图
  ipcMain.on("scroll-capture", async () => {
    try {
      mainWindow.webContents.send('scroll-capture-status', { status: 'started', message: '正在准备滚动截图...' });
      
      const result = await ScrollCapture.capture(mainWindow, imgDir);
      
      if (result.success) {
        // 将结果设置为当前截图并打开编辑器/AI分析
        currentImagePath = result.imagePath;
        if (fs.existsSync(result.imagePath)) {
          currentImageBuffer = fs.readFileSync(result.imagePath);
        }
        
        mainWindow.webContents.send('scroll-capture-status', { 
          status: 'completed', 
          message: `滚动截图完成! 共截取长图`,
          imagePath: result.imagePath 
        });
        
        // 自动进入编辑流程
        if (global.enableAIAnalysis) {
          createEditorWindow();
        }
        mainWindow.webContents.send("popup-tips");
      } else {
        mainWindow.webContents.send('scroll-capture-status', { status: 'error', message: result.error });
      }
    } catch (error) {
      console.error('滚动截图失败:', error);
      mainWindow.webContents.send('scroll-capture-status', { status: 'error', message: error.message });
    }
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
    if (editorWindow) {
      editorWindow.close();
    }

    // 清理缓存文件
    try {
      if (currentImagePath && fs.existsSync(currentImagePath)) {
        fs.unlinkSync(currentImagePath);
      }
      if (editedImagePath && fs.existsSync(editedImagePath)) {
        fs.unlinkSync(editedImagePath);
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
