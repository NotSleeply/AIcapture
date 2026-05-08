const fs = require("fs");
const path = require("path");

/**
 * 清理指定目录下的所有缓存图片文件
 * @param {string} directory - 需要清理的目录路径
 * @param {object} options - 配置选项
 * @param {boolean} options.all - 是否删除所有文件，默认为false (仅删除图片文件)
 * @param {Array<string>} options.extensions - 文件扩展名列表，默认为['.png', '.jpg', '.jpeg']
 * @param {boolean} options.logResult - 是否记录清理结果，默认为true
 * @returns {number} 清理的文件数量
 */
function cleanImg(directory, options = {}) {
  const {
    all = false,
    extensions = [".png", ".jpg", ".jpeg", ".gif"],
    logResult = true,
  } = options;

  let cleanedCount = 0;

  try {
    if (!fs.existsSync(directory)) {
      if (logResult) {
        console.log(`imgDir Not Live: ${directory}`);
      }
      return cleanedCount;
    }

    const files = fs.readdirSync(directory);
    for (const file of files) {
      const filePath = path.join(directory, file);

      // 检查是否为文件
      if (fs.statSync(filePath).isFile()) {
        // 如果选择删除所有文件或扩展名符合条件
        if (
          all ||
          extensions.some((ext) =>
            file.toLowerCase().endsWith(ext.toLowerCase())
          )
        ) {
          fs.unlinkSync(filePath);
          cleanedCount++;
        }
      }
    }

    if (logResult) {
      console.log(`imgDir ${directory} Clear ${cleanedCount} Files`);
    }
  } catch (err) {
    console.error(`Err Clear Files: ${directory}`, err);
  }

  return cleanedCount;
}

module.exports = cleanImg;
