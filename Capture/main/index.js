const {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
} = require("electron");
const { format } = require("url");
const path = require("path");
const captureWin = require("./capture");
const funLog = require("./tools/log");
const startCapture = require("./tools/startCapture");
const Screenshots = require("electron-screenshots");
const buildImg = require("./tools/buildImg");
const imgDir = path.join(__dirname, "../img");

// ====== 单实例锁：防止重复启动 ======
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  // 已有实例在运行，直接退出
  console.log('[AIcapture] 检测到已有运行中的实例，自动退出。');
  app.quit();
} else {
  // 当第二个实例尝试启动时，聚焦已有窗口
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });
}

// 初设化
init();


const winURL = format({
  protocol: "file",
  slashes: true,
  pathname: path.join(__dirname, "../renderer/index.html"),
});

let win = null;
let tray = null;

let windowOption = {
  width: 500,
  minWidth: 500,
  height: 300,
  minHeight: 300,
  useContentSize: true,
  autoHideMenuBar: true,
  center: true,
  title: "截图工具",
  webPreferences: {
    devTools: true,
    nodeIntegration: false,
    contextIsolation: true,
    preload: path.join(__dirname, "../preloader/preload.js"),
  },
};

function createWindow() {
  win = new BrowserWindow(windowOption);
  win.loadURL(winURL);

  // 开发环境下打开开发者工具
  if (process.env.NODE_ENV === "development") {
    win.webContents.openDevTools();
  }
  // 处理窗口关闭事件 - 只隐藏窗口，不退出应用
  win.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      win.hide();
      return false;
    }
  });

  win.on("closed", () => {
    win = null;
  });
}
// 创建托盘图标
function createTray() {
  // 加载托盘图标
  const iconPath = path.join(__dirname, "../static/icons/icon.ico");
  const trayIcon = nativeImage.createFromPath(iconPath);

  // 创建托盘实例
  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));
  tray.setToolTip("截图工具");

  // 创建托盘菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "开始截图",
      click: () => {
        if (!global.screenshots) {
          global.screenshots = new Screenshots();
        }
        startCapture(win, global.screenshots);
      },
    },
    { type: "separator" },
    {
      label: "退出",
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  // 设置托盘菜单
  tray.setContextMenu(contextMenu);

  // 点击托盘图标显示/隐藏窗口
  tray.on("click", () => {
    if (win) {
      if (win.isVisible()) {
        win.hide();
      } else {
        win.show();
      }
    } else {
      createWindow();
    }
  });
}

app.on("ready", () => {
  createWindow();
  createTray();
  captureWin(win,imgDir);

  // 注册IPC事件处理
  ipcMain.on("launch", (event, status) => {
    app.setLoginItemSettings({
      openAtLogin: !!status,
    });
  });

  ipcMain.on("is-hide-windows", (event, status) => {
    // 将隐藏窗口状态传递给capture模块
    if (win) {
      win.webContents.send("update-hide-status", status);
    }
  });
});

app.on("window-all-closed", () => {
  if (!tray) {
    app.quit();
  }
});
app.on("activate", () => {
  if (win === null) {
    createWindow();
  }
});

// 应用退出前清理托盘图标
app.on("before-quit", () => {
  app.isQuitting = true;
  if (tray) {
    tray.destroy();
    tray = null;
  }
});


function init() {
  funLog();
  buildImg(imgDir);
}