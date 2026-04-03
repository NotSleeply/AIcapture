/**
 * 截图编辑工具箱
 * 支持工具：画笔、箭头、矩形框、文字标注、马赛克、模糊、裁剪
 * 快捷操作：撤销/重做
 */
import { $, initCanvas, setCursor, setStatus } from './tools/editorUtils.js';

// ===== 状态管理 =====
const state = {
    currentTool: 'pen',       // 当前工具
    strokeColor: '#ff0000',   // 画笔颜色
    strokeWidth: 4,           // 线宽
    isDrawing: false,         // 是否正在绘制
    startX: 0,
    startY: 0,
    history: [],              // 历史记录栈（用于撤销）
    redoStack: [],            // 重做栈
    maxHistory: 30,           // 最大历史记录数
    originalImage: null,      // 原始图片对象
    imageLoaded: false,       // 图片是否加载完成
    canvasScale: 1,           // 画布缩放比例
    canvasOffsetX: 0,         // 画布偏移量 X
    canvasOffsetY: 0,         // 画布偏移量 Y
};

// ===== DOM 引用 =====
const mainCanvas = $('mainCanvas');
const drawCanvas = $('drawCanvas');
const mainCtx = mainCanvas.getContext('2d');
const drawCtx = drawCanvas.getContext('2d');

let textOverlay = null;
let textInput = null;

// ===== 初始化 =====
document.addEventListener('DOMContentLoaded', async () => {
    // 获取文字输入层引用
    textOverlay = $('textOverlay');
    textInput = $('textInput');
    
    // 初始化画布并加载图片数据
    await initEditor();
    
    // 绑定事件
    bindToolbarEvents();
    bindCanvasEvents();
    bindKeyboardEvents();
    bindTextEvents();

    // 更新状态栏
    if (state.imageLoaded) {
        setStatus(`图片已加载 - ${mainCanvas.width} x ${mainCanvas.height}`);
        $('imageInfo').textContent = `${mainCanvas.width} × ${mainCanvas.height}`;
    }
});

async function initEditor() {
    try {
        const data = await window.myAPI.getImageData();
        if (!data || !data.success || !data.imageDataUrl) {
            throw new Error(data?.error || '无法获取截图数据');
        }

        // 加载图片
        const img = new Image();
        img.onload = () => {
            state.originalImage = img;

            // 计算合适的显示尺寸
            const container = $('canvasContainer');
            const containerW = container.clientWidth - 20;
            const containerH = container.clientHeight - 20;

            let displayWidth = img.naturalWidth;
            let displayHeight = img.naturalHeight;

            // 缩放以适应容器
            const scale = Math.min(containerW / displayWidth, containerH / displayHeight, 1);
            
            // 设置画布尺寸为原始尺寸
            mainCanvas.width = img.naturalWidth;
            mainCanvas.height = img.naturalHeight;
            drawCanvas.width = img.naturalWidth;
            drawCanvas.height = img.naturalHeight;

            // 绘制原图到主画布
            mainCtx.drawImage(img, 0, 0);
            
            // 应用缩放和偏移到CSS
            applyCanvasTransform(scale);

            state.canvasScale = scale;
            state.imageLoaded = true;

            // 保存初始状态到历史
            saveHistory();
        };
        
        img.onerror = () => throw new Error('图片加载失败');
        img.src = data.imageDataUrl;
    } catch (err) {
        console.error('初始化编辑器失败:', err);
        setStatus('错误: ' + err.message);
    }
}

function applyCanvasTransform(scale) {
    const transform = `translate(-50%, -50%) scale(${scale})`;
    mainCanvas.style.transform = transform;
    drawCanvas.style.transform = transform;
}

// ===== 工具栏事件绑定 =====
function bindToolbarEvents() {
    // 工具选择按钮
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
        btn.addEventListener('click', () => selectTool(btn.dataset.tool));
    });

    // 颜色选择
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.strokeColor = btn.dataset.color;
        });
    });

    // 线宽选择
    $('strokeWidth').addEventListener('change', (e) => {
        state.strokeWidth = parseInt(e.target.value);
    });

    // 撤销/重做
    $('undoBtn').addEventListener('click', undo);
    $('redoBtn').addEventListener('click', redo);

    // 完成和跳过
    $('confirmBtn').addEventListener('click', confirmEdit);
    $('skipBtn').addEventListener('click', skipEdit);
}

function selectTool(tool) {
    state.currentTool = tool;
    
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.tool-btn[data-tool="${tool}"]`)?.classList.add('active');

    // 根据工具切换光标
    const cursorMap = {
        pen: 'cursor-pen',
        arrow: 'cursor-arrow',
        rect: 'cursor-rect',
        text: 'cursor-text',
        mosaic: 'cursor-mosaic',
        blur: 'cursor-blur',
        crop: 'cursor-crop'
    };

    drawCanvas.className = cursorMap[tool] || '';

    // 显示/隐藏颜色/线宽选择器
    const showStyle = ['pen', 'arrow', 'rect', 'text'].includes(tool);
    $('colorPickerGroup').style.display = showStyle ? '' : 'none';
    $('sizePickerGroup').style.display = showStyle ? '' : 'none';

    setStatus(`当前工具: ${getToolName(tool)}`);
}

function getToolName(tool) {
    const names = { pen: '画笔', arrow: '箭头', rect: '矩形框', text: '文字标注', mosaic: '马赛克', blur: '模糊', crop: '裁剪' };
    return names[tool] || tool;
}

// ===== 画布事件绑定 =====
function bindCanvasEvents() {
    // 鼠标事件
    drawCanvas.addEventListener('mousedown', handleMouseDown);
    drawCanvas.addEventListener('mousemove', handleMouseMove);
    drawCanvas.addEventListener('mouseup', handleMouseUp);
    drawCanvas.addEventListener('mouseleave', handleMouseUp);

    // 触摸支持
    drawCanvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    drawCanvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    drawCanvas.addEventListener('touchend', handleTouchEnd);
}

function getCanvasCoords(e) {
    const rect = drawCanvas.getBoundingClientRect();
    const scaleX = drawCanvas.width / rect.width / state.canvasScale;
    const scaleY = drawCanvas.height / rect.height / state.canvasScale;
    
    return {
        x: (e.clientX - rect.left - rect.width/2 + drawCanvas.width * state.canvasScale /2) * scaleX,
        y: (e.clientY - rect.top - rect.height/2 + drawCanvas.height * state.canvasScale /2) * scaleY
    };
}

// ===== 鼠标/触摸处理函数 =====
function handleMouseDown(e) {
    if (!state.imageLoaded) return;
    
    const coords = getCanvasCoords(e);
    state.isDrawing = true;
    state.startX = coords.x;
    state.startY = coords.y;

    switch (state.currentTool) {
        case 'pen':
            startPenPath(coords.x, coords.y);
            break;
        case 'mosaic':
        case 'blur':
            startPrivacyTool(coords.x, coords.y);
            break;
        case 'crop':
            startCrop(coords.x, coords.y);
            break;
        case 'text':
            showTextInput(coords.x, coords.y);
            break;
    }
}

function handleMouseMove(e) {
    if (!state.isDrawing || !state.imageLoaded) return;
    
    const coords = getCanvasCoords(e);

    switch (state.currentTool) {
        case 'pen':
            continuePenPath(coords.x, coords.y);
            break;
        case 'arrow':
            previewArrow(coords.x, coords.y);
            break;
        case 'rect':
            previewRect(coords.x, coords.y);
            break;
        case 'mosaic':
            applyMosaic(coords.x, coords.y);
            break;
        case 'blur':
            applyBlur(coords.x, coords.y);
            break;
        case 'crop':
            updateCropSelection(coords.x, coords.y);
            break;
    }
}

function handleMouseUp(e) {
    if (!state.isDrawing || !state.imageLoaded) return;
    state.isDrawing = false;

    switch (state.currentTool) {
        case 'pen':
            endPenPath();
            break;
        case 'arrow':
            finalizeArrow(e ? getCanvasCoords(e) : { x: state.startX, y: state.startY });
            break;
        case 'rect':
            finalizeRect(e ? getCanvasCoords(e) : { x: state.startX, y: state.startY });
            break;
        case 'mosaic':
        case 'blur':
            endPrivacyTool();
            break;
        case 'crop':
            finalizeCrop();
            break;
    }
}

function handleTouchStart(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
    }
}

function handleTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
    }
}

function handleTouchEnd(e) {
    handleMouseUp(null);
}

// ===== 画笔工具 =====
let penPoints = [];

function startPenPath(x, y) {
    penPoints = [{ x, y }];
    drawCtx.beginPath();
    drawCtx.moveTo(x, y);
    drawCtx.strokeStyle = state.strokeColor;
    drawCtx.lineWidth = state.strokeWidth;
    drawCtx.lineCap = 'round';
    drawCtx.lineJoin = 'round';
}

function continuePenPath(x, y) {
    penPoints.push({ x, y });
    drawCtx.lineTo(x, y);
    drawCtx.stroke();
    drawCtx.beginPath();
    drawCtx.moveTo(x, y);
}

function endPenPath() {
    if (penPoints.length > 0) {
        // 将绘图内容合并到主画布
        commitDrawToMain();
        penPoints = [];
    }
}

// ===== 箭头工具 =====
function previewArrow(endX, endY) {
    clearDrawCanvas();
    drawArrow(drawCtx, state.startX, state.startY, endX, endY, state.strokeColor, state.strokeWidth);
}

function finalizeArrow(coords) {
    clearDrawCanvas();
    drawArrow(mainCtx, state.startX, state.startY, coords.x, coords.y, state.strokeColor, state.strokeWidth);
    saveHistory();
}

// ===== 矩形框工具 =====
function previewRect(endX, endY) {
    clearDrawCanvas();
    drawRect(drawCtx, state.startX, state.startY, endX - state.startX, endY - state.startY, state.strokeColor, state.strokeWidth);
}

function finalizeRect(coords) {
    clearDrawCanvas();
    drawRect(mainCtx, state.startX, state.startY, coords.x - state.startX, coords.y - state.startY, state.strokeColor, state.strokeWidth);
    saveHistory();
}

// ===== 文字工具 =====
function showTextInput(x, y) {
    state.isDrawing = false; // 文字输入不需要拖拽
    
    // 将画布坐标转换为屏幕坐标
    const rect = drawCanvas.getBoundingClientRect();
    const screenX = rect.left + (x * rect.width / drawCanvas.width) - rect.width/2 + window.innerWidth/2;
    const screenY = rect.top + (y * rect.height / drawCanvas.height) - rect.height/2 + window.innerHeight/2;
    
    textOverlay.style.display = 'block';
    textOverlay.style.left = screenX + 'px';
    textOverlay.style.top = screenY + 'px';
    textInput.style.color = state.strokeColor;
    textInput.style.fontSize = Math.max(14, state.strokeWidth * 4) + 'px';
    textInput.dataset.posX = x;
    textInput.dataset.posY = y;
    textInput.value = '';
    textInput.focus();
}

function bindTextEvents() {
    textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && textInput.value.trim()) {
            commitText();
        } else if (e.key === 'Escape') {
            hideTextInput();
        }
    });

    // 点击其他区域关闭文字输入
    drawCanvas.addEventListener('mousedown', () => {
        if (textOverlay.style.display !== 'none') {
            hideTextInput();
        }
    });
}

function commitText() {
    const x = parseFloat(textInput.dataset.posX);
    const y = parseFloat(textInput.dataset.posY);
    const text = textInput.value.trim();
    
    if (text && !isNaN(x)) {
        mainCtx.font = `${Math.max(14, state.strokeWidth * 4)}px "Microsoft YaHei", sans-serif`;
        mainCtx.fillStyle = state.strokeColor;
        mainCtx.textBaseline = 'top';
        
        // 添加文字背景提高可读性
        const metrics = mainCtx.measureText(text);
        mainCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        mainCtx.fillRect(x, y - 2, metrics.width + 8, parseInt(mainCtx.font) + 6);
        
        mainCtx.fillStyle = state.strokeColor;
        mainCtx.fillText(text, x + 4, y);
        
        saveHistory();
    }
    hideTextInput();
}

function hideTextInput() {
    textOverlay.style.display = 'none';
    textInput.blur();
}

// ===== 马赛克/模糊工具（隐私保护）=====

function startPrivacyTool(x, y) {
    applyPrivacyEffect(x, y);
}

function applyMosaic(x, y) {
    applyPrivacyEffect(x, y);
}

function applyBlur(x, y) {
    applyPrivacyEffect(x, y);
}

function applyPrivacyEffect(x, y) {
    const size = Math.max(10, state.strokeWidth * 3);
    const halfSize = size / 2;
    
    // 从主画布获取图像数据进行处理
    const sx = Math.max(0, Math.floor(x - halfSize));
    const sy = Math.max(0, Math.floor(y - halfSize));
    const sw = Math.min(size, mainCanvas.width - sx);
    const sh = Math.min(size, mainCanvas.height - sy);
    
    if (sw <= 0 || sh <= 0) return;
    
    let imageData;
    
    if (state.currentTool === 'mosaic') {
        imageData = applyMosaicEffect(sx, sy, sw, sh, size);
    } else {
        imageData = applyGaussianBlur(sx, sy, sw, sh, state.strokeWidth * 2);
    }
    
    mainCtx.putImageData(imageData, sx, sy);
}

function endPrivacyTool() {
    saveHistory();
}

// 马赛克效果：将像素块取平均色
function applyMosaicEffect(x, y, w, h, blockSize) {
    const sourceData = mainCtx.getImageData(x, y, w, h);
    const output = new ImageData(w, h);
    const data = sourceData.data;
    const out = output.data;
    
    for (let by = 0; by < h; by += blockSize) {
        for (let bx = 0; bx < w; bx += blockSize) {
            // 计算块的平均颜色
            let r = 0, g = 0, b = 0, count = 0;
            
            for (let py = by; py < Math.min(by + blockSize, h); py++) {
                for (let px = bx; px < Math.min(bx + blockSize, w); px++) {
                    const idx = (py * w + px) * 4;
                    r += data[idx];
                    g += data[idx + 1];
                    b += data[idx + 2];
                    count++;
                }
            }
            
            r = Math.round(r / count);
            g = Math.round(g / count);
            b = Math.round(b / count);
            
            // 填充整个块
            for (let py = by; py < Math.min(by + blockSize, h); py++) {
                for (let px = bx; px < Math.min(bx + blockSize, w); px++) {
                    const idx = (py * w + px) * 4;
                    out[idx] = r;
                    out[idx + 1] = g;
                    out[idx + 2] = b;
                    out[idx + 3] = 255;
                }
            }
        }
    }
    
    return output;
}

// 高斯模糊效果（简化版）
function applyGaussianBlur(x, y, w, h, radius) {
    radius = Math.max(1, Math.floor(radius));
    const sourceData = mainCtx.getImageData(x, y, w, h);
    const data = sourceData.data;
    const output = new ImageData(w, h);
    const out = output.data;
    
    // 水平方向模糊
    const temp = new Uint8ClampedArray(data);
    for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
            let r = 0, g = 0, b = 0, count = 0;
            for (let dx = -radius; dx <= radius; dx++) {
                const nx = px + dx;
                if (nx >= 0 && nx < w) {
                    const idx = (py * w + nx) * 4;
                    r += temp[idx];
                    g += temp[idx + 1];
                    b += temp[idx + 2];
                    count++;
                }
            }
            const idx = (py * w + px) * 4;
            out[idx] = r / count;
            out[idx + 1] = g / count;
            out[idx + 2] = b / count;
            out[idx + 3] = 255;
        }
    }
    
    // 垂直方向模糊
    const tempV = new Uint8ClampedArray(out);
    for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
            let r = 0, g = 0, b = 0, count = 0;
            for (let dy = -radius; dy <= radius; dy++) {
                const ny = py + dy;
                if (ny >= 0 && ny < h) {
                    const idx = (ny * w + px) * 4;
                    r += tempV[idx];
                    g += tempV[idx + 1];
                    b += tempV[idx + 2];
                    count++;
                }
            }
            const idx = (py * w + px) * 4;
            out[idx] = r / count;
            out[idx + 1] = g / count;
            out[idx + 2] = b / count;
        }
    }
    
    return output;
}

// ===== 裁剪工具 =====
let cropData = null;

function startCrop(x, y) {
    cropData = { startX: x, startY: x, currentX: x, currentY: y };
    // 这里可以添加裁剪UI反馈，暂时简化处理
    setStatus(`裁剪起点: (${Math.round(x)}, ${Math.round(y)}) - 拖动选择区域`);
}

function updateCropSelection(endX, endY) {
    if (cropData) {
        cropData.currentX = endX;
        cropData.currentY = endY;
        // 可以在这里更新裁剪选区预览
    }
}

function finalizeCrop() {
    if (!cropData) return;
    
    const x = Math.min(cropData.startX, cropData.currentX);
    const y = Math.min(cropData.startY, cropData.currentY);
    const width = Math.abs(cropData.currentX - cropData.startX);
    const height = Math.abs(cropData.currentY - cropData.startY);
    
    if (width < 5 || height < 5) {
        setStatus('裁剪区域太小，请重新选择');
        cropData = null;
        return;
    }
    
    // 执行裁剪
    const croppedData = mainCtx.getImageData(x, y, width, height);
    
    // 重置画布大小
    mainCanvas.width = width;
    mainCanvas.height = height;
    drawCanvas.width = width;
    drawCanvas.height = height;
    
    mainCtx.putImageData(croppedData, 0, 0);
    
    // 更新状态
    $('imageInfo').textContent = `${width} × ${height}`;
    setStatus(`已裁剪至 ${width} × ${height}`);
    
    cropData = null;
    saveHistory();
}

// ===== 绘图辅助函数 =====
function drawArrow(ctx, fromX, fromY, toX, toY, color, width) {
    const headLength = Math.max(12, width * 3);
    const angle = Math.atan2(toY - fromY, toX - fromX);
    
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // 箭杆线
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
    
    // 箭头
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
        toX - headLength * Math.cos(angle - Math.PI / 6),
        toY - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
        toX - headLength * Math.cos(angle + Math.PI / 6),
        toY - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
}

function drawRect(ctx, x, y, w, h, color, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeRect(x, y, w, h);
}

function clearDrawCanvas() {
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
}

function commitDrawToMain() {
    mainCtx.drawImage(drawCanvas, 0, 0);
    clearDrawCanvas();
    saveHistory();
}

// ===== 历史记录（撤销/重做）=====
function saveHistory() {
    // 保存当前画布状态
    const imageData = mainCtx.getImageData(0, 0, mainCanvas.width, mainCanvas.height);
    state.history.push({
        imageData: imageData,
        width: mainCanvas.width,
        height: mainCanvas.height
    });
    
    // 清空重做栈
    state.redoStack = [];
    
    // 限制历史记录数量
    if (state.history.length > state.maxHistory) {
        state.history.shift();
    }
    
    updateHistoryButtons();
}

function undo() {
    if (state.history.length <= 1) return; // 至少保留一个
    
    // 当前状态放入重做栈
    const current = state.history.pop();
    state.redoStack.push(current);
    
    // 恢复上一个状态
    restoreFromHistory(state.history[state.history.length - 1]);
    updateHistoryButtons();
    setStatus('已撤销');
}

function redo() {
    if (state.redoStack.length === 0) return;
    
    const next = state.redoStack.pop();
    state.history.push(next);
    
    restoreFromHistory(next);
    updateHistoryButtons();
    setStatus('已重做');
}

function restoreFromHistory(historyEntry) {
    // 如果画布尺寸变了需要调整
    if (mainCanvas.width !== historyEntry.width || mainCanvas.height !== historyEntry.height) {
        mainCanvas.width = historyEntry.width;
        mainCanvas.height = historyEntry.height;
        drawCanvas.width = historyEntry.width;
        drawCanvas.height = historyEntry.height;
    }
    mainCtx.putImageData(historyEntry.imageData, 0, 0);
    clearDrawCanvas();
    $('imageInfo').textContent = `${historyEntry.width} × ${historyEntry.height}`;
}

function updateHistoryButtons() {
    $('undoBtn').disabled = state.history.length <= 1;
    $('redoBtn').disabled = state.redoStack.length === 0;
}

// ===== 键盘快捷键 =====
function bindKeyboardEvents() {
    document.addEventListener('keydown', (e) => {
        // 忽略文字输入时的快捷键
        if (document.activeElement === textInput) return;

        // Ctrl+Z 撤销
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
        }
        // Ctrl+Y 或 Ctrl+Shift+Z 重做
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
            e.preventDefault();
            redo();
        }
        // 工具快捷键
        const toolKeys = { p: 'pen', a: 'arrow', r: 'rect', t: 'text', m: 'mosaic', b: 'blur', c: 'crop' };
        if (toolKeys[e.key.toLowerCase()] && !e.ctrlKey && !e.metaKey) {
            selectTool(toolKeys[e.key.toLowerCase()]);
        }
        // Enter 确认
        if (e.key === 'Enter') {
            confirmEdit();
        }
        // Escape 跳过
        if (e.key === 'Escape') {
            skipEdit();
        }
    });
}

// ===== 完成与跳过 =====
async function confirmEdit() {
    // 将最终编辑结果保存为图片
    try {
        const editedDataURL = mainCanvas.toDataURL('image/png');
        
        // 通过 IPC 发送编辑后的图片给主进程
        const result = await window.myAPI.saveEditedImage(editedDataURL);
        
        if (result.success) {
            // 关闭编辑窗口，继续打开AI分析窗口
            window.myAPI.closeEditor(true);
        } else {
            alert('保存编辑结果失败: ' + (result.error || '未知错误'));
        }
    } catch (err) {
        console.error('确认编辑失败:', err);
        alert('操作失败: ' + err.message);
    }
}

async function skipEdit() {
    // 不保存编辑，直接使用原图进入AI分析
    window.myAPI.closeEditor(false);
}
