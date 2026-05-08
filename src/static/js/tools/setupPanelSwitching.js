import { showPanel } from "./showPanel.js";
import { setupPanelButton } from "./setupPanelButton.js";
/**
 * 初始化面板切换功能
 * 管理侧边栏按钮和对应内容面板的切换显示
 * @returns {void}
 */
export function setupPanelSwitching() {
  const btnConfig = document.getElementById("btnConfig");
  const btnKeyboard = document.getElementById("btnKeyboard");
  const btnAbout = document.getElementById("btnAbout");
  const configBox = document.getElementById("configBox");
  const keyboardBox = document.getElementById("keyboardBox");
  const aboutBox = document.getElementById("aboutBox");

  // 面板配置数据，包含按钮和对应的面板元素
  const panels = [
    { button: btnConfig, panel: configBox },
    { button: btnKeyboard, panel: keyboardBox },
    { button: btnAbout, panel: aboutBox },
  ];

  // 为每个按钮添加点击事件处理
  panels.forEach(({ button, panel }) => {
    setupPanelButton(button, panel, panels);
  });

  // 默认显示配置面板
  showPanel(btnConfig, configBox, panels);
}