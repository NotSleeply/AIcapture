import { parseShortcut } from "./tools/parseShortcut.js";
import { initSetting } from "./tools/initSetting.js";
import { setupPanelSwitching } from "./tools/setupPanelSwitching.js";
import { AI_PROVIDERS, getAIConfig, saveAIConfig, testConnection } from "./tools/aiClient.js";

function $(id) {
  return document.getElementById(id);
}
const btnCapture = $("btnCapture");
const captureKeyBox = $("captureKeyBox");
const showKeyBox = $("showKeyBox");
const btnSetCaptureKey = $("btnSetCaptureKey");
const btnDelCaptureKey = $("btnDelCaptureKey");
const hideInput = $("hideInput");
const hideLabel = $("hideLabel");
const toolInput = $("toolInput");
const toolLabel = $("toolLabel");
const tipsWrap = $("tipsWrap");
const tipsContent = $("tipsContent");

// AI配置相关元素
const providerSelect = $("providerSelect");
const apiKeyInput = $("apiKeyInput");
const baseUrlInput = $("baseUrlInput");
const modelIdInput = $("modelIdInput");
const btnSaveConfig = $("btnSaveConfig");
const btnTestConnection = $("btnTestConnection");
const toggleApiKeyVisibility = $("toggleApiKeyVisibility");
const saveStatus = $("saveStatus");
const providerHint = $("providerHint");
const baseUrlHint = $("baseUrlHint");
const baseUrlItem = $("baseUrlItem");
const modelIdItem = $("modelIdItem");

console.log("测试测试myAPI::", myAPI.version);

// 初始化状态变量
let captureKey = localStorage.captureKey || "Alt + S";
let showKey = localStorage.showKey || "无显示快捷键";
let shortKey = "";
let split = "";
let hasClickCut = false;
let keyKind = 0;
let hideWindows = +localStorage.hideInput;
let enableAIAnalysis = +localStorage.toolInput || 1;

// 保存默认快捷键到localStorage
if (!localStorage.captureKey) {
  localStorage.captureKey = captureKey;
  // 发送到主进程
  ipcRenderer.send("setCaptureKey", captureKey);
}
// 页面加载完成后显示快捷键
document.addEventListener("DOMContentLoaded", () => {
  updateShortcutDisplay();
  // 初始化隐藏窗口设置
  initSetting({
    inputElement: hideInput,
    labelElement: hideLabel,
    storageName: "hideInput",
    ipcEventName: "is-hide-windows",
    defaultValue: 0,
    onUpdate: (value) => {
      hideWindows = value;
    },
  });

  // 初始化AI分析工具设置
  initSetting({
    inputElement: toolInput,
    labelElement: toolLabel,
    storageName: "toolInput",
    ipcEventName: "set-ai-analysis",
    defaultValue: 1,
    onUpdate: (value) => {
      enableAIAnalysis = value;
    },
  });
  setupPanelSwitching();

  // ===== 初始化AI配置面板 =====
  initAIConfig();
});
// 更新UI显示快捷键
function updateShortcutDisplay() {
  if (captureKeyBox) {
    captureKeyBox.innerHTML = captureKey;
  }
  if (showKeyBox) {
    showKeyBox.innerHTML = showKey;
  }
}
// 截图按钮事件
btnCapture.addEventListener(
  "click",
  () => {
    // 防止快速点击截图按钮
    if (hasClickCut) {
      return;
    }
    hasClickCut = true;

    myAPI.cutScreen();
  },
  false
);
// 截图完成显示提示弹层
ipcRenderer.on("popup-tips", () => {
  tipsWrap.style.display = "block";
  tipsContent.innerHTML = "截图已添到剪切板";
  setTimeout(() => {
    tipsWrap.style.display = "none";
  }, 2000);
});
ipcRenderer.on("has-click-cut", (event, status) => {
  hasClickCut = status;
});
// 截图快捷键
btnSetCaptureKey.addEventListener(
  "click",
  () => {
    showKeyBox.style.background = "transparent";
    showKeyBox.style.color = "#333";
    captureKeyBox.style.background = "#6F9AEF";
    captureKeyBox.style.color = "#fff";
    captureKeyBox.innerHTML = "输入截图快捷键";
    showKeyBox.innerHTML = showKey ? showKey : "无显示快捷键";
    shortKey = "";
    split = "";
    keyKind = 1;
  },
  false
);
btnDelCaptureKey.addEventListener(
  "click",
  () => {
    captureKeyBox.style.background = "transparent";
    captureKeyBox.style.color = "#333";
    captureKeyBox.innerHTML = "无截图快捷键";
    captureKey = "";
    keyKind = 0;
    localStorage.captureKey = "";
    ipcRenderer.send("setCaptureKey", captureKey);
  },
  false
);
// 监听键盘事件
document.addEventListener(
  "keydown",
  (event) => {
    if (keyKind) {
      const keyname = parseShortcut(event);
      if (!keyname) {
        alert(
          "快捷键只允许输入Alt、Control、Shift、Command、数字和字母，请重新设置！"
        );
        return;
      }

      shortKey += split + keyname;
      split = " + ";

      if (keyKind === 1) {
        captureKeyBox.innerHTML = shortKey;
        captureKey = shortKey;
      } else if (keyKind === 2) {
        showKeyBox.innerHTML = shortKey;
        showKey = shortKey;
      }
    }
  },
  false
);

// ===== AI 配置面板功能 =====

/**
 * 初始化AI配置面板 - 从localStorage读取并填充
 */
function initAIConfig() {
  const savedConfig = getAIConfig();

  // 填充已保存的值
  if (providerSelect) providerSelect.value = savedConfig.provider || 'deepseek';
  if (apiKeyInput) apiKeyInput.value = savedConfig.apiKey || '';
  if (baseUrlInput) baseUrlInput.value = savedConfig.baseUrl || '';
  if (modelIdInput) modelIdInput.value = savedConfig.modelId || '';

  // 更新UI提示
  updateProviderUI(savedConfig.provider);

  // 绑定事件
  bindAIConfigEvents();
}

/**
 * 根据选择的提供商更新UI提示信息
 */
function updateProviderUI(providerId) {
  const provider = AI_PROVIDERS[providerId];
  if (!provider) return;

  if (providerHint) {
    providerHint.textContent = provider.hint || '';
  }
  if (baseUrlHint && baseUrlInput) {
    baseUrlHint.textContent = provider.baseUrlPlaceholder || '';
    baseUrlInput.placeholder = provider.baseUrlPlaceholder || '';
  }
  if (apiKeyInput) {
    apiKeyInput.placeholder = provider.keyHint || '输入您的API Key';
  }

  // 豆包需要显示模型ID选项
  if (modelIdItem) {
    modelIdItem.style.display = providerId === 'doubao' ? 'flex' : 'none';
  }
}

/**
 * 绑定AI配置相关的事件监听
 */
function bindAIConfigEvents() {
  // 提供商切换
  if (providerSelect) {
    providerSelect.addEventListener('change', () => {
      updateProviderUI(providerSelect.value);
    });
  }

  // 显示/隐藏API Key
  if (toggleApiKeyVisibility && apiKeyInput) {
    toggleApiKeyVisibility.addEventListener('click', () => {
      const isPassword = apiKeyInput.type === 'password';
      apiKeyInput.type = isPassword ? 'text' : 'password';
      toggleApiKeyVisibility.querySelector('.icon').className =
        isPassword ? 'icon icon-eye-off' : 'icon icon-eye';
    });
  }

  // 保存配置
  if (btnSaveConfig) {
    btnSaveConfig.addEventListener('click', () => handleSaveConfig());
  }

  // 测试连接
  if (btnTestConnection) {
    btnTestConnection.addEventListener('click', () => handleTestConnection());
  }

  // 输入框支持文本选择
  [apiKeyInput, baseUrlInput, modelIdInput].forEach(el => {
    if (el) {
      el.style.cursor = 'text';
      el.style.webkitUserSelect = 'text';
      el.style.userSelect = 'text';
    }
  });
}

/**
 * 处理保存配置
 */
async function handleSaveConfig() {
  if (!saveStatus) return;

  try {
    showSaveStatus('保存中...', 'loading');

    const config = {
      provider: providerSelect?.value || 'deepseek',
      apiKey: apiKeyInput?.value?.trim() || '',
      baseUrl: baseUrlInput?.value?.trim() || '',
      modelId: modelIdInput?.value?.trim() || '',
    };

    saveAIConfig(config);

    // 同时通知主进程更新（如果需要的话）
    // ipcRenderer.send('update-ai-config', config);

    showSaveStatus('已保存', 'success');

    setTimeout(() => { if (saveStatus) saveStatus.textContent = ''; }, 2000);
  } catch (err) {
    console.error('保存配置失败:', err);
    showSaveStatus('保存失败: ' + err.message, 'error');
  }
}

/**
 * 处理测试连接
 */
async function handleTestConnection() {
  if (!saveStatus || !btnTestConnection) return;

  try {
    // 先保存当前配置
    await handleSaveConfig();

    btnTestConnection.disabled = true;
    btnTestConnection.textContent = '测试中...';
    showSaveStatus('正在测试连接...', 'loading');

    const result = await testConnection();

    btnTestConnection.disabled = false;
    btnTestConnection.textContent = '测试连接';

    showSaveStatus(result.success ? result.message : result.message,
      result.success ? 'success' : 'error');

  } catch (err) {
    btnTestConnection.disabled = false;
    btnTestConnection.textContent = '测试连接';
    showSaveStatus('测试失败: ' + err.message, 'error');
  }
}

/**
 * 显示保存状态
 */
function showSaveStatus(text, type) {
  if (!saveStatus) return;
  saveStatus.textContent = text;
  saveStatus.className = 'save-status ' + (type || '');
}
