/**
 * 显示指定的面板，隐藏其他面板
 * @param {HTMLElement} activeButton - 当前激活的按钮
 * @param {HTMLElement} activePanel - 当前要显示的面板
 * @param {Array} allPanels - 所有面板的配置数据
 */
export function showPanel(activeButton, activePanel, allPanels) {
  // 移除所有按钮的active类
  allPanels.forEach(({ button }) => {
    button.classList.remove("active");
  });

  // 隐藏所有面板
  allPanels.forEach(({ panel }) => {
    panel.classList.remove("visible");
  });

  // 激活当前按钮和面板
  activeButton.classList.add("active");
  activePanel.classList.add("visible");
}
