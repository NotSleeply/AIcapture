/**
 * 截图历史图库页面逻辑
 */

import historyDB from './tools/historyDB.js';

function $(id) { return document.getElementById(id); }

// 状态
let currentPage = 1;
const pageSize = 24;
let allRecords = [];
let filteredRecords = [];
let currentPreviewId = null;

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    await historyDB.init();
    await loadRecords();
    bindEvents();
});

async function loadRecords() {
    const grid = $('galleryGrid');
    const emptyState = $('emptyState');
    const loadingState = $('loadingState');

    loadingState.style.display = 'block';
    emptyState.style.display = 'none';

    try {
        allRecords = await historyDB.getAll();
        filteredRecords = [...allRecords];
        
        loadingState.style.display = 'none';
        updateStats();
        renderGrid();
    } catch (err) {
        console.error('加载记录失败:', err);
        loadingState.innerHTML = '<p style="color:#f56c6c">加载失败: ' + err.message + '</p>';
    }
}

function renderGrid() {
    const grid = $('galleryGrid');
    const emptyState = $('emptyState');

    // 清除旧内容（保留空状态元素）
    Array.from(grid.children).forEach(child => {
        if (child.id !== 'emptyState' && child.id !== 'loadingState') child.remove();
    });

    if (filteredRecords.length === 0) {
        emptyState.style.display = 'block';
        $('pagination').innerHTML = '';
        return;
    }

    emptyState.style.display = 'none';

    // 分页
    const start = (currentPage - 1) * pageSize;
    const pageRecords = filteredRecords.slice(start, start + pageSize);

    // 渲染卡片
    pageRecords.forEach(record => {
        const card = createCard(record);
        grid.insertBefore(card, emptyState);
    });

    renderPagination();
}

function createCard(record) {
    const div = document.createElement('div');
    div.className = 'gallery-item' + (record.analysisResult ? ' gallery-item-analyzed' : '');
    div.dataset.id = record.id;

    const timeStr = formatTime(record.timestamp);
    const thumbSrc = record.thumbnailDataUrl || record.imageDataUrl || '';
    
    let tagsHtml = '';
    if (record.tags?.length > 0) {
        tagsHtml = `<div class="gallery-item-tags">${record.tags.map(t => `<span class="tag-badge">#${t}</span>`).join('')}</div>`;
    }

    div.innerHTML = `
        <img class="gallery-item-thumb" src="${thumbSrc}" alt="截图缩略图"
             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect fill=%22%23eee%22 width=%22100%25%22 height=%22100%25/%22><text x=%2250%%22 y=%2250%%22 fill=%22%23999%22 text-anchor=%22middle%22 dy=%22.3em%22>无预览</text></svg>'">
        <div class="gallery-item-info">
            <span class="gallery-item-time">${timeStr}</span>
            <span class="gallery-item-note">${record.note || '无备注'}</span>
            ${tagsHtml}
        </div>`;

    div.addEventListener('click', () => openPreview(record));
    return div;
}

function openPreview(record) {
    currentPreviewId = record.id;
    const modal = $('previewModal');
    
    $('previewImage').src = record.imageDataUrl || record.thumbnailDataUrl || '';
    $('previewMeta').textContent = `${formatTime(record.timestamp)} | ${record.width}x${record.height}`;
    $('noteInput').value = record.note || '';
    
    // 标签
    const tagsEl = $('previewTags');
    if (record.tags?.length > 0) {
        tagsEl.innerHTML = record.tags.map(t => `<span class="tag-badge">#${t}</span>`).join('');
    } else {
        tagsEl.innerHTML = '<span style="color:#999;font-size:12px">暂无标签</span>';
    }

    modal.style.display = 'flex';
}

function closePreview() {
    $('previewModal').style.display = 'none';
    currentPreviewId = null;
}

function updateStats() {
    const stats = await historyDB.getStats().catch(() => ({ totalRecords: allRecords.length }));
    $('totalStats').textContent = `共 ${allRecords.length} 条记录 · 约 ${(stats.totalSizeKB / 1024).toFixed(1)} MB`;
}

function renderPagination() {
    const totalPages = Math.ceil(filteredRecords.length / pageSize);
    const pagination = $('pagination');

    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    let html = '';
    
    html += `<button class="page-btn" onclick="goPage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>上一页</button>`;
    
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || Math.abs(i - currentPage) <= 1) {
            html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`;
        } else if (
            (html.lastIndexOf('...') === -1 || !html.endsWith('<button class=')) &&
            i !== currentPage - 1 && i !== currentPage + 1
        ) {
            html += `<button class="page-btn" disabled>...</button>`;
        }
    }
    
    html += `<button class="page-btn" onclick="goPage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}>下一页</button>`;
    
    pagination.innerHTML = html;
}

window.goPage = function(page) {
    const totalPages = Math.ceil(filteredRecords.length / pageSize);
    if (page < 1 || page > totalPages) return;
    currentPage = page;
    renderGrid();
};

function bindEvents() {
    // 搜索
    $('searchInput').addEventListener('input', debounce(async (e) => {
        const kw = e.target.value.trim();
        filteredRecords = kw ? await historyDB.search(kw) : [...allRecords];
        applyFilter($('filterSelect').value);
        currentPage = 1;
        renderGrid();
    }, 300));

    // 过滤
    $('filterSelect').addEventListener('change', (e) => {
        applyFilter(e.target.value);
        currentPage = 1;
        renderGrid();
    });

    // 预览弹窗操作
    $('previewClose').addEventListener('click', closePreview);
    $('btnSaveNote').addEventListener('click', async () => {
        if (!currentPreviewId) return;
        const note = $('noteInput').value.trim();
        await historyDB.update(currentPreviewId, { note });
        alert('备注已保存');
        await loadRecords();
    });
    $('btnDeleteRecord').addEventListener('click', async () => {
        if (!currentPreviewId) return;
        if (!confirm('确定要删除这条记录吗？')) return;
        await historyDB.remove(currentPreviewId);
        closePreview();
        await loadRecords();
    });
    $('btnReanalyze').addEventListener('click', () => {
        if (!currentPreviewId) return;
        // TODO: 实现重新分析功能
        alert('重新分析功能：将在新窗口中使用此图片进行AI分析（待实现完整集成）');
    });
    $('btnExport').addEventListener('click', () => {
        if (!currentPreviewId) return;
        // TODO: 导出单条记录
        alert('导出功能开发中...');
    });

    // 设置
    $('btnSettings').addEventListener('click', () => {
        $('settingsModal').style.display = 'flex';
        loadSettingsUI();
    });
    $('closeSettingsModal').addEventListener('click', () => {
        $('settingsModal').style.display = 'none';
    });
    $('btnSaveSettings').addEventListener('click', saveSettings);

    // 清空
    $('btnClearAll').addEventListener('click', async () => {
        if (!confirm('确定要清空所有历史记录？此操作不可恢复！')) return;
        await historyDB.clearAll();
        await loadRecords();
    });

    // 点击遮罩关闭
    ['previewModal', 'settingsModal'].forEach(id => {
        $(id)?.addEventListener('click', (e) => {
            if (e.target === $(id)) $(id).style.display = 'none';
        });
    });
}

function applyFilter(filterType) {
    const base = filteredRecords.length > 0 ? filteredRecords : allRecords;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    switch (filterType) {
        case 'today':
            filteredRecords = base.filter(r => now - r.timestamp < dayMs);
            break;
        case 'week':
            filteredRecords = base.filter(r => now - r.timestamp < 7 * dayMs);
            break;
        case 'analyzed':
            filteredRecords = base.filter(r => r.analysisResult);
            break;
        default:
            filteredRecords = base;
    }
}

function loadSettingsUI() {
    const config = historyDB._config;
    $('settingMaxCount').value = config.maxCount;
    $('settingMaxDays').value = config.maxDays;
    $('settingAutoSave').checked = config.autoSave;
}

async function saveSettings() {
    historyDB.saveConfig({
        maxCount: parseInt($('settingMaxCount').value) || 100,
        maxDays: parseInt($('settingMaxDays').value) || 30,
        autoSave: $('settingAutoSave').checked,
    });
    alert('设置已保存');
    $('settingsModal').style.display = 'none';
}

function formatTime(timestamp) {
    const d = new Date(timestamp);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function debounce(fn, delay) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}
