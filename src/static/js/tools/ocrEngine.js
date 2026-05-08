/**
 * OCR 文字提取工具
 * 使用 Tesseract.js 进行纯前端离线 OCR
 * 
 * 功能：
 * - 截图后自动/手动识别文字
 * - 支持一键复制识别结果
 * - 可直接将识别文字发送给 AI
 */

import Tesseract from 'tesseract.js';

// ===== 配置 =====
const CONFIG = {
    // 默认语言（支持中英文）
    languages: ['chi_sim', 'eng'],
    // 识别配置
    workerOptions: {
        logger: (m) => {
            if (m.status === 'recognizing text') {
                const progress = Math.round(m.progress * 100);
                OCRManager._onProgress?.(progress, `正在识别文字... ${progress}%`);
            }
        },
    },
    // 初始化超时时间 (ms)
    initTimeout: 30000,
};

class OCRManager {
    static _worker = null;
    static _isInitializing = false;
    static _onProgress = null;

    /**
     * 初始化 OCR Worker（懒加载，首次使用时调用）
     */
    static async initialize() {
        if (this._worker) return this._worker;
        if (this._isInitializing) {
            // 等待正在进行的初始化完成
            await new Promise(resolve => {
                const check = setInterval(() => {
                    if (!this._isInitializing) { clearInterval(check); resolve(); }
                }, 200);
            });
            return this._worker;
        }

        this._isInitializing = true;
        
        try {
            this._worker = await Tesseract.createWorker(
                CONFIG.languages.join('+'),
                undefined,
                CONFIG.workerOptions
            );
            
            this._isInitializing = false;
            console.log('[OCR] 初始化成功');
            return this._worker;
        } catch (error) {
            this._isInitializing = false;
            console.error('[OCR] 初始化失败:', error);
            throw new Error('OCR 引擎初始化失败: ' + error.message);
        }
    }

    /**
     * 从图片路径或 base64 数据进行 OCR 识别
     * @param {string} imageSource - 图片的 base64 data URL 或文件路径对应的 base64 数据
     * @param {function} [progressCallback] - 进度回调函数 (progressPercent, statusText)
     * @returns {Promise<{text: string, confidence: number, words: Array}>}
     */
    static async recognize(imageSource, progressCallback) {
        try {
            this._onProgress = progressCallback || null;
            
            // 确保 worker 已初始化
            const worker = await this.initialize();

            // 执行识别
            const result = await worker.recognize(imageSource);

            // 解析结果
            return {
                text: result.data.text.trim(),
                confidence: result.data.confidence / 100, // 归一化为 0-1
                words: result.data.words.map(w => ({
                    text: w.text,
                    confidence: w.confidence / 100,
                    bbox: w.bbox, // 边界框信息
                })),
                lines: result.data.lines.map(l => l.text),
                paragraphs: result.data.paragraphs.map(p => p.text),
                raw: result.data,
            };
        } catch (error) {
            console.error('[OCR] 识别失败:', error);
            throw new Error('OCR 识别失败: ' + error.message);
        } finally {
            this._onProgress = null;
        }
    }

    /**
     * 仅从图片中提取文字（简化版，返回纯文本）
     * @param {string} imageSource - 图片数据
     * @returns {Promise<string>} 识别出的文字
     */
    static async extractText(imageSource, progressCallback) {
        const result = await this.recognize(imageSource, progressCallback);
        return result.text;
    }

    /**
     * 销毁 OCR Worker（释放资源）
     */
    static async terminate() {
        if (this._worker) {
            await this._worker.terminate();
            this._worker = null;
            console.log('[OCR] Worker 已终止');
        }
    }
}

export default OCRManager;
