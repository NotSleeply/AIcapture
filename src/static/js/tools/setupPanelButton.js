import { showPanel } from "./showPanel.js";
/**
 * 为单个面板按钮设置点击事件
 * @param {HTMLElement} button - 按钮元素
 * @param {HTMLElement} panel - 对应的面板元素
 * @param {Array} allPanels - 所有面板的配置数据
 */
export function setupPanelButton(button, panel, allPanels) {
  button.addEventListener("click", function () {
    showPanel(button, panel, allPanels);
  });
}
