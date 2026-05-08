/**
 * 编辑器工具函数
 */

// DOM 元素选择器快捷方式
export function $(id) {
    return document.getElementById(id);
}

// 初始化画布
export function initCanvas(mainCanvas, drawCanvas, imageSrc) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            mainCanvas.width = img.naturalWidth;
            mainCanvas.height = img.naturalHeight;
            drawCanvas.width = img.naturalWidth;
            drawCanvas.height = img.naturalHeight;
            
            const ctx = mainCanvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = reject;
        img.src = imageSrc;
    });
}

// 设置光标样式
export function setCursor(canvas, cursorClass) {
    canvas.className = cursorClass || '';
}

// 更新状态栏文字
export function setStatus(text) {
    const el = document.getElementById('statusText');
    if (el) el.textContent = text;
}
