// 解析快捷键
function parseShortcut(event) {
  const code = event.keyCode;
  let keyname = "";

  // 判断是否为修饰键
  if (code === 16 || code === 17 || code === 18 || code === 91) {
    keyname = event.key;
    if (code === 91) keyname = "Cmd"; // Mac系统的metaKey键
  } else if ((code >= 48 && code <= 57) || (code >= 65 && code <= 90)) {
    keyname = String.fromCharCode(code); // 数字和字母
  } else {
    return null; // 非法键
  }

  return keyname;
}

export { parseShortcut };