/**
 * 导出工具集
 * 
 * 功能：
 * 1. AI对话导出为 Markdown / TXT / 图片（带截图+对话）
 * 2. 代码块一键复制
 */

// ===== 对话导出功能 =====

class ExportUtils {
    /**
     * 导出为 Markdown 格式
     * @param {Array} chatHistory - [{role: 'user'|'ai', content: string}]
     * @param {string} [imageDataUrl] - 截图的 dataURL
     * @param {string} [title] - 标题
     */
    static exportAsMarkdown(chatHistory, imageDataUrl = null, title = 'AIcapture 分析报告') {
        let md = `# ${title}\n\n`;
        md += `> 导出时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
        
        // 如果有截图，添加图片引用（Markdown不支持内嵌base64，保存为文件引用）
        if (imageDataUrl) {
            md += `## 原始截图\n\n![截图](screenshot.png)\n\n---\n\n`;
        }
        
        md += `## AI 对话记录\n\n`;
        
        for (const msg of chatHistory) {
            const roleLabel = msg.role === 'user' ? '**用户**' : '**AI**';
            const roleName = msg.role === 'user' ? 'user' : 'assistant';
            
            md += `### ${roleLabel}\n\n`;
            md += `${msg.content}\n\n`;
            md += `---\n\n`;
        }

        this._downloadFile(md, 'ai-analysis.md', 'text/markdown');
    }

    /**
     * 导出为纯文本格式
     * @param {Array} chatHistory - 对话历史
     * @param {string} [title] - 标题
     */
    static exportAsTXT(chatHistory, title = 'AIcapture 分析报告') {
        let text = `${title}\n${'='.repeat(title.length + 10)}\n\n`;
        text += `导出时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
        
        text += `AI 对话记录:\n${'─'.repeat(40)}\n\n`;
        
        for (const msg of chatHistory) {
            const label = msg.role === 'user' ? '[ 用户 ]' : '[ AI   ]';
            text += `${label}\n`;
            text += this._stripHtml(msg.content);
            text += `\n${'─'.repeat(40)}\n\n`;
        }

        this._downloadFile(text, 'ai-analysis.txt', 'text/plain');
    }

    /**
     * 导出为图片（使用 html2canvas 方式，渲染整个对话区域为图片）
     * @param {HTMLElement} element - 要导出的DOM元素（通常是聊天消息容器）
     * @param {string} [filename] - 文件名
     */
    static async exportAsImage(element, filename = 'ai-analysis.png') {
        if (!element) {
            throw new Error('没有可导出的内容');
        }
        
        try {
            // 使用 Canvas API 手动绘制内容到图片
            const canvas = await this._elementToCanvas(element);
            
            if (!canvas) {
                throw new Error('无法生成图片');
            }

            canvas.toBlob((blob) => {
                if (!blob) throw new Error('Blob 转换失败');
                
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 'image/png', 1.0);

        } catch (error) {
            console.error('导出图片失败:', error);
            throw error;
        }
    }

    /**
     * 将 DOM 元素转换为 Canvas（简化实现）
     */
    static async _elementToCanvas(element) {
        return new Promise((resolve) => {
            // 创建一个离屏canvas来绘制元素
            const rect = element.getBoundingClientRect();
            const scale = window.devicePixelRatio || 1;
            
            // 使用 foreignObject SVG 方法将 HTML 渲染到 canvas
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = rect.width * scale;
            canvas.height = rect.height * scale;
            
            ctx.scale(scale, scale);
            
            const svgData = `
                <svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}">
                    <foreignObject width="100%" height="100%">
                        <div xmlns="http://www.w3.org/1999/xhtml">
                            ${element.outerHTML}
                        </div>
                    </foreignObject>
                </svg>`;
            
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            
            const img = new Image();
            img.onload = () => {
                ctx.fillStyle = '#f9f9f9'; // 背景色
                ctx.fillRect(0, 0, rect.width, rect.height);
                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(url);
                resolve(canvas);
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                // 降级方案：返回空白canvas
                resolve(canvas);
            };
            img.src = url;
        });
    }

    /**
     * 触发下载
     */
    static _downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType; charset='utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * 移除HTML标签，保留纯文本
     */
    static _stripHtml(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    }
}

// ===== 代码块一键复制 =====

class CodeCopyManager {
    static init() {
        // 使用事件委托，处理动态生成的代码块的复制按钮
        document.addEventListener('click', (e) => {
            if (e.target.closest('.code-copy-btn')) {
                this.handleCopy(e.target.closest('.code-copy-btn'));
            }
        });

        // 初始化已有代码块
        this.addCopyButtonsToExistingBlocks();
    }

    /**
     * 为现有的代码块添加复制按钮
     */
    static addCopyButtonsToExistingBlocks() {
        const codeBlocks = document.querySelectorAll('.code-block:not(.has-copy-btn)');
        codeBlocks.forEach(block => {
            this._addCopyButton(block);
            block.classList.add('has-copy-btn');
        });
    }

    /**
     * 给单个代码块添加复制按钮
     */
    static _addCopyButton(codeBlock) {
        if (!codeBlock || codeBlock.querySelector('.code-copy-btn')) return;

        const btn = document.createElement('button');
        btn.className = 'code-copy-btn';
        btn.title = '复制代码';
        btn.innerHTML = '<span>📋</span>';
        
        // 设置按钮样式
        Object.assign(btn.style, {
            position: 'absolute',
            top: '6px',
            right: '6px',
            padding: '4px 8px',
            fontSize: '11px',
            background: '#e8eaed',
            border: '1px solid #dadce0',
            borderRadius: '4px',
            cursor: 'pointer',
            opacity: '0.7',
            transition: 'opacity 0.15s',
            zIndex: 10,
        });

        btn.onmouseenter = () => btn.style.opacity = '1';
        btn.onmouseleave = () => btn.style.opacity = '0.7';

        codeBlock.style.position = 'relative';
        codeBlock.appendChild(btn);
    }

    /**
     * 处理复制操作
     */
    static handleCopy(button) {
        const codeBlock = button.closest('.code-block');
        if (!codeBlock) return;

        const codeText = codeBlock.textContent.replace(/📋|复制成功!|复制失败/g, '').trim();

        navigator.clipboard.writeText(codeText).then(() => {
            button.innerHTML = '<span style="color:#67c23a">✓</span>';
            setTimeout(() => { button.innerHTML = '<span>📋</span>'; }, 2000);
        }).catch(() => {
            // 降级方案
            const textarea = document.createElement('textarea');
            textarea.value = codeText;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            button.innerHTML = '<span style="color:#67c23a">✓</span>';
            setTimeout(() => { button.innerHTML = '<span>📋</span>'; }, 2000);
        });
    }

    /**
     * 在新消息添加后调用此方法刷新复制按钮
     */
    static refresh() {
        this.addCopyButtonsToExistingBlocks();
    }
}

export { ExportUtils, CodeCopyManager };
