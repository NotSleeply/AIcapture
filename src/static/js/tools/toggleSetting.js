/**
 * 通用设置切换函数
 * @param {Object} options - 配置对象
 * @param {HTMLElement} options.inputElement - 复选框元素
 * @param {HTMLElement} options.labelElement - 标签元素(可选)
 * @param {string} options.storageName - localStorage中的键名
 * @param {string} options.ipcEventName - IPC通信的事件名称
 * @param {function} options.onToggle - 切换后的回调函数(可选)
 * @returns {Function} 可直接用于事件监听的处理函数
 */
export function toggleSetting(options) {
  // 返回一个可以直接用于事件监听的函数
  return function (event) {
    const { inputElement, labelElement, storageName, ipcEventName, onToggle } =
      options;

    // 当点击的是label时，阻止默认行为以避免重复触发
    if (labelElement && event.target === labelElement) {
      event.preventDefault();
    }

    // 切换复选框状态
    const newState = !inputElement.hasAttribute("checked");

    if (newState) {
      inputElement.setAttribute("checked", true);
      localStorage[storageName] = "1";
    } else {
      inputElement.removeAttribute("checked");
      localStorage[storageName] = "0";
    }

    // 获取新状态的数值表示
    const newStateValue = +localStorage[storageName];

    // 通知主进程状态变化
    if (window.ipcRenderer && ipcEventName) {
      window.ipcRenderer.send(ipcEventName, newStateValue);
    }

    // 执行回调
    if (typeof onToggle === "function") {
      onToggle(newStateValue);
    }

    return newStateValue;
  };
}
