import { formatAIMessage } from "./tools/formatAIMessage.js";
import { analyzeImage as aiAnalyzeImage, sendFollowup as aiSendFollowup, DEFAULT_IMAGE_PROMPT } from "./tools/aiClient.js";

// 辅助函数
function $(id) { return document.getElementById(id); }

// 元素引用
const chatMessages = $('chatMessages');
const userInput = $('userInput');
const sendButton = $('sendButton');
const btnClose = $('btnClose');

// 状态变量
let imagePath = null;
let imageBase64 = null; // 保存图片base64数据
let chatHistory = [];   // 对话历史
let isProcessing = false;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    window.myAPI.getImageData().then(data => {
        if (data && data.success) {
            if (data.imagePath) {
                imagePath = data.imagePath;
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
    });
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
