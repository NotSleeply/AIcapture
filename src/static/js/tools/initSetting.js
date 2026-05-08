import { toggleSetting } from "./toggleSetting.js";

/**
 * 初始化设置项
 * @param {Object} options - 配置项
 * @param {HTMLElement} options.inputElement - 复选框元素
 * @param {HTMLElement} options.labelElement - 标签元素
 * @param {string} options.storageName - localStorage中的键名
 * @param {string} options.ipcEventName - IPC通信的事件名称
 * @param {number} options.defaultValue - 默认值(0或1)
 * @param {Object} options.messages - 显示的消息对象，包含 {enabled, disabled} 属性
 * @param {function} options.onUpdate - 更新全局变量的回调函数
 */
function initSetting(options) {
  const {
    inputElement,
    labelElement,
    storageName,
    ipcEventName,
    defaultValue = 0,
    onUpdate,
  } = options;

  // 从localStorage读取设置，使用默认值
  const storageValue = localStorage[storageName] || String(defaultValue);

  // 更新全局状态变量(如果提供了回调)
  if (typeof onUpdate === "function") {
    onUpdate(+storageValue);
  }

  // 根据保存的值设置复选框状态
  if (+storageValue === 1) {
    inputElement.setAttribute("checked", true);
  } else {
    inputElement.removeAttribute("checked");
  }

  // 初始时通知主进程当前设置
  ipcRenderer.send(ipcEventName, +storageValue);

  // 创建事件处理函数
  const handleToggle = toggleSetting({
    inputElement: inputElement,
    labelElement: labelElement,
    storageName: storageName,
    ipcEventName: ipcEventName,
    onToggle: (newValue) => {
      // 更新全局变量
      if (typeof onUpdate === "function") {
        onUpdate(newValue);
      }
    },
  });

  // 为复选框和标签添加统一的事件处理
  inputElement.addEventListener("click", handleToggle);
  labelElement.addEventListener("click", handleToggle);
}


export { initSetting };