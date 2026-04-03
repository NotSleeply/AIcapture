import { formatAIMessage } from "./tools/formatAIMessage.js";
import { analyzeImage as aiAnalyzeImage, sendFollowup as aiSendFollowup, DEFAULT_IMAGE_PROMPT } from "./tools/aiClient.js";
import OCRManager from "./tools/ocrEngine.js";
import { ExportUtils, CodeCopyManager } from "./tools/exportUtils.js";
import promptTemplates from "./tools/promptTemplates.js";

// 辅助函数
function $(id) { return document.getElementById(id); }

// 元素引用
const chatMessages = $('chatMessages');
const userInput = $('userInput');
const sendButton = $('sendButton');
const btnClose = $('btnClose');

// OCR 元素引用
const btnOCR = $('btnOCR');
const ocrResultPanel = $('ocrResultPanel');
const ocrResultText = $('ocrResultText');
const ocrConfidence = $('ocrConfidence');
const btnCopyOCR = $('btnCopyOCR');
const btnSendToAI = $('btnSendToAI');
const ocrProgress = $('ocrProgress');
const ocrProgressBar = $('ocrProgressBar');

// 状态变量
let imagePath = null;
let imageBase64 = null; // 保存图片base64数据
let chatHistory = [];   // 对话历史
let isProcessing = false;
let currentImageDataUrl = null; // 保存截图dataURL用于导出

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    window.myAPI.getImageData().then(data => {
        if (data && data.success) {
            if (data.imagePath) {
                imagePath = data.imagePath;
                currentImageDataUrl = data.imageDataUrl; // 保存用于导出
                // 自动开始分析
                setTimeout(() => {
                    handleImageAnalysis(DEFAULT_IMAGE_PROMPT);
                }, 500);
            } else {
                addMessage('未收到有效的图片数据', 'ai');
            }
        } else {
            addMessage('获取图片数据失败: ' + (data?.error || '未知错误'), 'ai');
        }
    }).catch(err => {
        console.error('获取图片数据时出错:', err);
        addMessage('获取图片数据时出错: ' + err.message, 'ai');
    });

    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleUserInput();
        }
    });
    sendButton.addEventListener('click', handleUserInput);
    btnClose.addEventListener('click', () => {
        window.myAPI.closeDialog();
        OCRManager.terminate(); // 清理OCR资源
    });
    
    // OCR 事件绑定
    btnOCR?.addEventListener('click', handleOCR);
    btnCopyOCR?.addEventListener('click', copyOCRResult);
    btnSendToAI?.addEventListener('click', sendOCRToAI);

    // 导出功能事件绑定
    $('btnExportMD')?.addEventListener('click', () => handleExport('markdown'));
    $('btnExportTXT')?.addEventListener('click', () => handleExport('txt'));
    $('btnExportImg')?.addEventListener('click', () => handleExport('image'));

    // 模板选择器
    const templateSelect = $('templateSelect');
    if (templateSelect) {
        initTemplateSelector(templateSelect);
        templateSelect.addEventListener('change', onTemplateChange);
    }

    // 初始化代码复制功能
    CodeCopyManager.init();

    // 监听消息变化以刷新复制按钮
    const observer = new MutationObserver(() => CodeCopyManager.refresh());
    observer.observe(chatMessages, { childList: true, subtree: true });
});

// 处理用户输入
async function handleUserInput() {
    const text = userInput.value.trim();
    if (!text || isProcessing) return;

    addMessage(text, 'user');
    userInput.value = '';

    if (imageBase64) {
        await handleFollowup(text);
    } else {
        await handleImageAnalysis(text);
    }
}

/**
 * 分析图片 - 前端直接调用AI API
 */
async function handleImageAnalysis(prompt) {
    if (isProcessing) return;
    isProcessing = true;

    try {
        addLoadingMessage();

        if (!imagePath) {
            throw new Error('没有有效的图片路径');
        }

        // 读取图片为Base64
        imageBase64 = await readFileAsBase64(imagePath);

        // 直接调用AI客户端分析图片
        const result = await aiAnalyzeImage(imageBase64, prompt);

        removeLoadingMessage();

        // 保存到历史
        chatHistory.push({ role: 'assistant', content: result });

        addMessage(result, 'ai');

    } catch (error) {
        console.error('图像分析出错:', error);
        removeLoadingMessage();
        addMessage(`图像分析失败: ${error.message}`, 'ai');
    } finally {
        isProcessing = false;
    }
}

/**
 * 后续追问 - 前端直接调用AI API
 */
async function handleFollowup(question) {
    if (isProcessing) return;
    isProcessing = true;

    try {
        addLoadingMessage();

        // 调用AI客户端发送追问（带图片上下文）
        const result = await aiSendFollowup(question, imageBase64, chatHistory);

        removeLoadingMessage();

        // 更新历史
        chatHistory.push({ role: 'user', content: question });
        chatHistory.push({ role: 'assistant', content: result });

        addMessage(result, 'ai');

    } catch (error) {
        console.error('追问处理出错:', error);
        removeLoadingMessage();

        let msg = '问题处理失败，请重试';
        if (error.message.includes('API Key') || error.message.includes('配置')) {
            msg = '请先在主窗口设置中正确配置API Key和选择AI提供商';
        }
        addMessage(msg, 'ai');
    } finally {
        isProcessing = false;
    }
}

// ===== UI 辅助函数 =====

function addMessage(text, sender) {
    const div = document.createElement('div');
    div.className = `message ${sender}-message`;
    div.innerHTML = sender === 'ai' ? formatAIMessage(text) : escapeHtml(text);
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // 记录到对话历史（用于导出）
    if (sender === 'user') {
        chatHistory.push({ role: 'user', content: text });
    }
}

function addLoadingMessage() {
    const div = document.createElement('div');
    div.id = 'loadingIndicator';
    div.className = 'message ai-message loading-message';
    div.innerHTML = '<span class="loading-dots"><span></span><span></span><span></span> 正在思考...</span>';
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function removeLoadingMessage() {
    const el = document.getElementById('loadingIndicator');
    if (el) el.remove();
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

async function readFileAsBase64(filePath) {
    try {
        const result = await window.myAPI.readFileAsBase64(filePath);
        if (!result.success) throw new Error(result.error || '读取文件失败');
        return result.data;
    } catch (err) {
        throw new Error('读取图片文件失败: ' + err.message);
    }
}

// ===== OCR 功能实现 =====

let ocrResultCache = null; // 缓存最近一次OCR结果

/**
 * 执行 OCR 识别
 */
async function handleOCR() {
    if (!imageBase64) {
        addMessage('请先等待图片加载完成', 'ai');
        return;
    }

    try {
        // 显示进度
        btnOCR.disabled = true;
        ocrProgress.style.display = 'block';
        ocrResultPanel.style.display = 'none';
        ocrProgressBar.value = 0;

        const result = await OCRManager.recognize(
            `data:image/png;base64,${imageBase64}`,
            (progress, status) => {
                ocrProgressBar.value = progress;
            }
        );

        ocrResultCache = result;

        // 显示结果
        ocrProgress.style.display = 'none';
        ocrResultPanel.style.display = 'block';
        ocrResultText.textContent = result.text;
        
        // 置信度百分比显示
        const confPercent = Math.round(result.confidence * 100);
        ocrConfidence.textContent = `置信度: ${confPercent}%`;
        
        // 根据置信度设置颜色
        if (confPercent >= 80) {
            ocrConfidence.className = 'ocr-confidence high';
        } else if (confPercent >= 50) {
            ocrConfidence.className = 'ocr-confidence medium';
        } else {
            ocrConfidence.className = 'ocr-confidence low';
        }

        console.log('[OCR] 识别完成，置信度:', confPercent + '%');
        
    } catch (error) {
        console.error('OCR识别失败:', error);
        addMessage(`OCR识别失败: ${error.message}`, 'ai');
        ocrProgress.style.display = 'none';
    } finally {
        btnOCR.disabled = false;
    }
}

/**
 * 一键复制 OCR 结果
 */
function copyOCRResult() {
    if (!ocrResultCache?.text) {
        alert('没有可复制的文字内容');
        return;
    }

    navigator.clipboard.writeText(ocrResultCache.text).then(() => {
        // 临时改变按钮文字提示
        const origText = btnCopyOCR.textContent;
        btnCopyOCR.textContent = '已复制!';
        setTimeout(() => { btnCopyOCR.textContent = origText; }, 1500);
    }).catch(err => {
        // 降级方案：使用传统方法复制
        const textarea = document.createElement('textarea');
        textarea.value = ocrResultCache.text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('已复制到剪贴板');
    });
}

/**
 * 将 OCR 文字发送给 AI 分析
 */
function sendOCRToAI() {
    if (!ocrResultCache?.text) {
        alert('没有可发送的文字内容');
        return;
    }

    // 将OCR结果填入输入框并自动发送
    userInput.value = `请分析以下从截图中提取出的文字内容：\n\n${ocrResultCache.text}`;
    handleUserInput();
}

// ===== 导出功能 =====

function handleExport(formatType) {
    try {
        switch (formatType) {
            case 'markdown':
                ExportUtils.exportAsMarkdown(chatHistory, currentImageDataUrl);
                break;
            case 'txt':
                ExportUtils.exportAsTXT(chatHistory);
                break;
            case 'image':
                ExportUtils.exportAsImage(chatMessages, 'ai-analysis.png');
                break;
        }
        addMessage(`已导出为 ${formatType.toUpperCase()} 格式`, 'ai');
    } catch (error) {
        console.error('导出失败:', error);
        addMessage(`导出失败: ${error.message}`, 'ai');
    }
}

// ===== 模板管理 =====

function initTemplateSelector(selectElement) {
    const templates = promptTemplates.getAll();
    
    selectElement.innerHTML = '';
    templates.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = `${t.icon || ''} ${t.name}`;
        opt.dataset.prompt = t.prompt;
        
        // 标记内置模板不可编辑
        if (t.isBuiltIn) {
            opt.dataset.builtIn = 'true';
        }
        
        selectElement.appendChild(opt);
    });

    // 添加管理入口
    const manageOpt = document.createElement('option');
    manageOpt.value = '__manage__';
    manageOpt.textContent = '⚙️ 管理模板...';
    selectElement.appendChild(manageOpt);
}

function onTemplateChange(e) {
    const val = e.target.value;

    if (val === '__manage__') {
        openTemplateManagerModal();
        e.target.selectedIndex = 0; // 重置选择
        return;
    }

    if (!val) return; // 通用分析（空值）

    const template = promptTemplates.get(val);
    if (template?.prompt) {
        userInput.value = template.prompt;
        userInput.focus();
    }
}

function openTemplateManagerModal() {
    const modal = $('templateManagerModal');
    if (!modal) return;

    modal.style.display = 'flex';
    renderTemplateList();
}

function closeTemplateManagerModal() {
    const modal = $('templateManagerModal');
    if (modal) modal.style.display = 'none';

    // 隐藏编辑器区域
    $('templateEditor').style.display = 'none';
}

function renderTemplateList() {
    const listEl = $('templateList');
    if (!listEl) return;

    const templates = promptTemplates.getAll();
    
    listEl.innerHTML = templates.map(t => `
        <div class="template-item" data-id="${t.id}">
            <span class="template-icon">${t.icon || '📝'}</span>
            <div class="template-info">
                <span class="template-name">${escapeHtml(t.name)}</span>
                <span class="template-preview">${escapeHtml((t.prompt || '').substring(0, 60))}...</span>
            </div>
            <div class="template-actions">
                ${!t.isBuiltIn ? `
                    <button class="btn-xs btn-default tmpl-edit-btn" data-id="${t.id}">编辑</button>
                    <button class="btn-xs btn-negative tmpl-del-btn" data-id="${t.id}">删除</button>
                ` : '<span class="builtin-tag">内置</span>'}
                <button class="btn-xs btn-primary tmpl-use-btn" data-id="${t.id}" data-prompt="${encodeURIComponent(t.prompt)}">使用</button>
            </div>
        </div>
    `).join('');

    // 绑定事件
    listEl.querySelectorAll('.tmpl-use-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            userInput.value = decodeURIComponent(btn.dataset.prompt);
            handleUserInput();
            closeTemplateManagerModal();
        });
    });

    listEl.querySelectorAll('.tmpl-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => startEditTemplate(btn.dataset.id));
    });

    listEl.querySelectorAll('.tmpl-del-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (confirm('确定要删除这个模板吗？')) {
                promptTemplates.remove(btn.dataset.id);
                renderTemplateList();
                initTemplateSelect($('templateSelect'));
            }
        });
    });
}

let editingTemplateId = null;

function startEditTemplate(id) {
    const editor = $('templateEditor');
    const template = promptTemplates.get(id);

    editor.style.display = 'block';
    editingTemplateId = id;
    
    $('tmplName').value = template?.name || '';
    $('tmplPrompt').value = template?.prompt || '';
}

$('closeTemplateModal')?.addEventListener('click', closeTemplateManagerModal);
$('btnSaveTemplate')?.addEventListener('click', saveCurrentTemplate);
$('btnCancelEdit')?.addEventListener('click', () => {
    $('templateEditor').style.display = 'none';
});

function saveCurrentTemplate() {
    const name = $('tmplName').value.trim();
    const prompt = $('tmplPrompt').value.trim();

    if (!name || !prompt) { alert('请填写模板名称和提示词'); return; }

    try {
        if (editingTemplateId) {
            promptTemplates.update(editingTemplateId, { name, prompt });
        } else {
            promptTemplates.add({ name, prompt });
        }

        renderTemplateList();
        initTemplateSelect($('templateSelect'));
        $('templateEditor').style.display = 'none';
        editingTemplateId = null;
    } catch (err) {
        alert(err.message);
    }
}
