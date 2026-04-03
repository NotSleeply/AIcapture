/**
 * 自定义 AI 提示词模板管理
 * 
 * 功能：
 * - 预设常用模板（解释代码、翻译文字、总结PPT、解题等）
 * - 用户可添加 / 编辑 / 排序自己的模板
 * - 模板数据持久化到 localStorage
 */

// ===== 默认预设模板 =====
const DEFAULT_TEMPLATES = [
    {
        id: 'default',
        name: '通用分析',
        icon: '🔍',
        prompt: '请详细分析这张截图的内容，包括文字、图像、界面等所有可见信息。',
        isBuiltIn: true,
        order: 0,
    },
    {
        id: 'explain-code',
        name: '解释代码',
        icon: '💻',
        prompt: '请解释这张截图中代码的功能、逻辑和关键步骤，并指出可能存在的问题或优化建议。',
        isBuiltIn: true,
        order: 1,
    },
    {
        id: 'translate-text',
        name: '翻译文字',
        icon: '🌐',
        prompt: '请将这张截图中的文字内容准确翻译成中文（如果是中文则翻译成英文），保持原文格式。',
        isBuiltIn: true,
        order: 2,
    },
    {
        id: 'summarize-ppt',
        name: '总结 PPT/文档',
        icon: '📊',
        prompt: '请总结这份PPT/文档的核心内容、主要观点和关键结论，以结构化的方式呈现。',
        isBuiltIn: true,
        order: 3,
    },
    {
        id: 'solve-problem',
        name: '帮我解题',
        icon: '✏️',
        prompt: '请帮我解答这道题，给出详细的解题思路、步骤和最终答案，如果涉及公式请说明原理。',
        isBuiltIn: true,
        order: 4,
    },
    {
        id: 'extract-info',
        name: '提取信息',
        icon: '📋',
        prompt: '请从这张截图中提取所有有用的信息（文字、数字、表格等），整理为结构化的列表或表格形式。',
        isBuiltIn: true,
        order: 5,
    },
    {
        id: 'compare-review',
        name: '对比/评审',
        icon: '⚖️',
        prompt: '请对截图中的内容进行专业评审或对比分析，列出优缺点、差异点和改进建议。',
        isBuiltIn: true,
        order: 6,
    },
];

const STORAGE_KEY = 'aicapture_prompt_templates';

class PromptTemplateManager {
    constructor() {
        this._templates = null;
    }

    /**
     * 获取所有模板（含用户自定义）
     */
    getAll() {
        if (this._templates) return this._templates;

        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            if (Array.isArray(saved)) {
                // 合并内置模板与用户模板，去重
                const builtInIds = new Set(DEFAULT_TEMPLATES.map(t => t.id));
                const customTemplates = saved.filter(t => !builtInIds.has(t.id));
                this._templates = [...DEFAULT_TEMPLATES, ...customTemplates];
            } else {
                this._templates = [...DEFAULT_TEMPLATES];
            }
        } catch (e) {
            console.warn('[TemplateManager] 加载模板失败，使用默认:', e);
            this._templates = [...DEFAULT_TEMPLATES];
        }

        // 按 order 排序
        this._templates.sort((a, b) => (a.order || 99) - (b.order || 99));
        return this._templates;
    }

    /**
     * 根据 ID 获取单个模板
     */
    get(id) {
        return this.getAll().find(t => t.id === id);
    }

    /**
     * 添加自定义模板
     * @param {object} templateData {name, prompt, icon?}
     */
    add(templateData) {
        const templates = this.getAll();
        const newTemplate = {
            id: 'custom_' + Date.now(),
            name: templateData.name || '新模板',
            prompt: templateData.prompt || '',
            icon: templateData.icon || '📝',
            isBuiltIn: false,
            order: templates.length,
            createdAt: new Date().toISOString(),
        };

        templates.push(newTemplate);
        this._save(templates);
        this._templates = null; // 清缓存
        return newTemplate;
    }

    /**
     * 更新模板
     */
    update(id, updates) {
        const templates = this.getAll();
        const idx = templates.findIndex(t => t.id === id);
        if (idx === -1) throw new Error('模板不存在');
        
        // 不允许修改内置模板的 ID 和 isBuiltIn 属性
        const { id: _, isBuiltIn: __, ...safeUpdates } = updates;
        Object.assign(templates[idx], safeUpdates, { updatedAt: new Date().toISOString() });
        
        this._save(templates);
        this._templates = null;
    }

    /**
     * 删除模板（仅限用户自定义）
     */
    remove(id) {
        const template = this.get(id);
        if (!template) throw new Error('模板不存在');
        if (template.isBuiltIn) throw new Error('无法删除内置模板');

        const templates = this.getAll();
        const filtered = templates.filter(t => t.id !== id);
        this._save(filtered);
        this._templates = null;
    }

    /**
     * 调整模板顺序
     */
    reorder(orderedIds) {
        const templates = this.getAll();
        const ordered = orderedIds.map(id => templates.find(t => t.id === id)).filter(Boolean);
        
        // 追加未在排序列表中的模板
        const remaining = templates.filter(t => !orderedIds.includes(t.id));
        ordered.forEach((t, i) => { t.order = i; });
        remaining.forEach((t, i) => { t.order = ordered.length + i; });

        this._save([...ordered, ...remaining]);
        this._templates = null;
    }

    /**
     * 搜索模板
     */
    search(keyword) {
        const kw = keyword.toLowerCase();
        return this.getAll().filter(
            t => t.name.toLowerCase().includes(kw) || t.prompt.toLowerCase().includes(kw)
        );
    }

    _save(templates) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
        } catch (e) {
            console.error('[TemplateManager] 保存失败:', e);
        }
    }
}

// 全局单例
export const promptTemplates = new PromptTemplateManager();
export default promptTemplates;
