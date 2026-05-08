function startCapture(mainWindow, screenshots) {
  if (global.isCutHideWindows && mainWindow) {
    if (mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
    }
    mainWindow.setSkipTaskbar(true);
    mainWindow.hide();
  }

  // 开始截图
  setTimeout(() => {
    screenshots.startCapture();
  }, 200);
}


module.exports = startCapture;
