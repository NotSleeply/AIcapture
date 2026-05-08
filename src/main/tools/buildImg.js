const fs = require("fs");
const cleanImg = require("./cleanImg");
function buildImg(imgDir) {
  // 确保 img 目录存在 (相对于主文件夹)
  if (!fs.existsSync(imgDir)) {
    fs.mkdirSync(imgDir, { recursive: true });
  }
  cleanImg(imgDir, { all: true });
}

module.exports = buildImg;
