const { contextBridge, ipcRenderer } = require('electron');

// 编辑器窗口专用 preload 脚本
// 暴露给渲染进程的API
contextBridge.exposeInMainWorld('myAPI', {
    // 获取截图数据
    getImageData: async () => {
        return await ipcRenderer.invoke('get-image-data');
    },
    
    // 保存编辑后的图片
    saveEditedImage: async (dataURL) => {
        return await ipcRenderer.invoke('save-edited-image', dataURL);
    },
    
    // 关闭编辑器（hasEdited: 是否进行了编辑）
    closeEditor: (hasEdited) => {
        ipcRenderer.send('close-editor', hasEdited);
    }
});
