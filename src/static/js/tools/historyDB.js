/**
 * 截图历史与本地图库
 * 基于 IndexedDB 存储，支持大容量图片存储
 * 
 * 功能：
 * - 自动保存历史截图（可配置保留天数/数量）
 * - 支持标签/搜索，快速找回之前的截图
 * - 可查看、删除、重新分析历史截图
 */

const DB_NAME = 'AICaptureHistory';
const DB_VERSION = 1;
const STORE_NAME = 'screenshots';

// 默认配置
const DEFAULT_CONFIG = {
    maxCount: 100,          // 最大保存数量
    maxDays: 30,            // 最大保留天数
    autoSave: true,         // 是否自动保存
};

class HistoryDatabase {
    constructor() {
        this._db = null;
        this._config = { ...DEFAULT_CONFIG };
        this._loadConfig();
    }

    /**
     * 初始化数据库
     */
    async init() {
        if (this._db) return this._db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // 创建截图存储对象
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                    
                    // 创建索引
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    store.createIndex('tags', 'tags', { unique: false, multiEntry: true });
                    store.createIndex('hasAnalysis', 'hasAnalysis', { unique: false });
                }
            };

            request.onsuccess = (event) => {
                this._db = event.target.result;
                
                this._db.onversionchange = () => {
                    this._db.close();
                };
                
                console.log('[HistoryDB] 数据库初始化成功');
                resolve(this._db);
            };

            request.onerror = (event) => {
                console.error('[HistoryDB] 数据库打开失败:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * 保存截图记录
     */
    async saveScreenshot(data) {
        const db = await this.init();
        
        const record = {
            imageDataUrl: data.imageDataUrl || null,
            imagePath: data.imagePath || null,
            thumbnailDataUrl: this._generateThumbnail(data.imageDataUrl),
            timestamp: Date.now(),
            tags: data.tags || [],
            analysisResult: data.analysisResult || null,
            chatHistory: data.chatHistory || [],
            width: data.width || 0,
            height: data.height || 0,
            note: data.note || '',  // 用户备注
        };

        return new Promise((resolve, reject) => {
            const tx = db.transaction([STORE_NAME], 'readwrite');
            const store = tx.objectStore(STORE_NAME);

            const request = store.add(record);

            request.onsuccess = () => {
                console.log('[HistoryDB] 截图已保存:', request.result);
                resolve({ success: true, id: request.result });
                
                // 自动清理超限数据
                this.autoClean();
            };

            request.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * 获取所有截图历史（按时间倒序）
     */
    async getAll(options = {}) {
        const db = await this.init();
        const { limit, offset = 0, tag } = options;

        return new Promise((resolve, reject) => {
            const tx = db.transaction([STORE_NAME], 'readonly');
            const store = tx.objectStore(STORE_NAME);
            
            let request;
            if (tag) {
                const index = store.index('tags');
                request = index.getAll(tag);
            } else {
                request = store.getAll();
            }

            request.onsuccess = () => {
                let records = request.result || [];
                // 按时间倒序排列
                records.sort((a, b) => b.timestamp - a.timestamp);
                
                // 分页
                if (offset > 0) records = records.slice(offset);
                if (limit && limit > 0) records = records.slice(0, limit);
                
                resolve(records);
            };

            request.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * 获取单条记录
     */
    async get(id) {
        const db = await this.init();

        return new Promise((resolve, reject) => {
            const tx = db.transaction([STORE_NAME], 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * 更新记录（标签、备注等）
     */
    async update(id, updates) {
        const db = await this.init();

        return new Promise((resolve, reject) => {
            const tx = db.transaction([STORE_NAME], 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            
            const getRequest = store.get(id);
            getRequest.onsuccess = () => {
                const record = getRequest.result;
                if (!record) {
                    reject(new Error('记录不存在'));
                    return;
                }

                Object.assign(record, updates, { updatedAt: Date.now() });

                const putRequest = store.put(record);
                putRequest.onsuccess = () => resolve(putRequest.result);
                putRequest.onerror = (event) => reject(event.target.error);
            };
            getRequest.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * 删除单条或多条记录
     */
    async remove(ids) {
        const db = await this.init();
        const idArray = Array.isArray(ids) ? ids : [ids];

        return new Promise((resolve, reject) => {
            const tx = db.transaction([STORE_NAME], 'readwrite');
            const store = tx.objectStore(STORE_NAME);

            let completed = 0;
            let errors = [];

            for (const id of idArray) {
                const req = store.delete(id);
                req.onsuccess = () => completed++;
                req.onerror = (e) => errors.push(e.target.error);
            }

            tx.oncomplete = () => {
                if (errors.length > 0) {
                    reject(errors[0]);
                } else {
                    resolve({ deleted: completed });
                }
            };
            tx.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * 搜索截图（按标签或备注关键词）
     */
    async search(keyword) {
        const allRecords = await this.getAll();
        const kw = keyword.toLowerCase().trim();

        if (!kw) return allRecords;

        return allRecords.filter(r => {
            // 搜索标签
            if (r.tags?.some(t => t.toLowerCase().includes(kw))) return true;
            // 搜索备注
            if (r.note?.toLowerCase().includes(kw)) return true;
            // 搜索分析结果文本
            if (r.analysisResult?.toLowerCase().includes(kw)) return true;
            return false;
        });
    }

    /**
     * 获取统计信息
     */
    async getStats() {
        const allRecords = await this.getAll();
        const now = Date.now();
        const dayMs = 24 * 60 * 60 * 1000;

        let totalSizeEstimate = 0;
        let todayCount = 0;
        let weekCount = 0;
        let withAnalysis = 0;
        const allTags = new Set();

        for (const r of allRecords) {
            totalSizeEstimate += (r.imageDataUrl?.length || 0) / 1024; // KB估算

            if ((now - r.timestamp) < dayMs) todayCount++;
            if ((now - r.timestamp) < 7 * dayMs) weekCount++;
            if (r.analysisResult) withAnalysis++;

            r.tags?.forEach(t => allTags.add(t));
        }

        return {
            totalRecords: allRecords.length,
            totalSizeKB: Math.round(totalSizeEstimate),
            todayCount,
            weekCount,
            withAnalysis,
            uniqueTags: Array.from(allTags),
        };
    }

    /**
     * 清理过期数据
     */
    async cleanExpired() {
        const config = this._config;
        const cutoffTime = Date.now() - config.maxDays * 24 * 60 * 60 * 1000;

        const expired = await this.getAll(); // 已经是按时间排序的
        const toRemove = [];

        for (let i = 0; i < expired.length; i++) {
            const isExpired = expired[i].timestamp < cutoffTime;
            const isOverLimit = i >= config.maxCount;

            if (isExpired || isOverLimit) {
                toRemove.push(expired[i].id);
            } else {
                break; // 后面的都是更新的了（已排序）
            }
        }

        if (toRemove.length > 0) {
            await this.remove(toRemove);
            console.log(`[HistoryDB] 已清理 ${toRemove.length} 条过期记录`);
        }
    }

    async autoClean() {
        try {
            await this.cleanExpired();
        } catch (e) {
            console.warn('[HistoryDB] 自动清理失败:', e);
        }
    }

    /** 清空所有数据 */
    async clearAll() {
        const db = await this.init();

        return new Promise((resolve, reject) => {
            const tx = db.transaction([STORE_NAME], 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const req = store.clear();

            req.onsuccess = () => resolve(true);
            req.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * 生成缩略图（降低质量以节省存储空间）
     */
    _generateThumbnail(dataUrl) {
        if (!dataUrl) return null;

        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxSize = 200; // 缩略图最大边长
                
                let w = img.naturalWidth;
                let h = img.naturalHeight;
                
                if (w > maxSize || h > maxSize) {
                    const ratio = Math.min(maxSize / w, maxSize / h);
                    w = Math.round(w * ratio);
                    h = Math.round(h * ratio);
                }

                canvas.width = w;
                canvas.height = h;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                
                // 较低质量的 JPEG 缩略图
                resolve(canvas.toDataURL('image/jpeg', 0.6));
            };
            img.onerror = () => resolve(null);
            img.src = dataUrl;
        });
    }

    _loadConfig() {
        try {
            const saved = JSON.parse(localStorage.getItem('aicapture_history_config'));
            if (saved) Object.assign(this._config, saved);
        } catch (e) {}
    }

    saveConfig(config) {
        Object.assign(this._config, config);
        localStorage.setItem('aicapture_history_config', JSON.stringify(this._config));
        this.autoClean();
    }
}

// 全局单例
export const historyDB = new HistoryDatabase();
export default historyDB;
