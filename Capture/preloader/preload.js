const { contextBridge, ipcRenderer } = require('electron');

// 暴露给渲染进程的API
contextBridge.exposeInMainWorld('myAPI', {
    version: process.version,
    cutScreen: () => {
        ipcRenderer.send('cut-screen');
    },
    // 对话窗口相关API
    getImageData: async () => {
        return await ipcRenderer.invoke('get-image-data');
    },
    saveImage: async (base64Data) => {
        return await ipcRenderer.invoke('save-image', base64Data);
    },
    closeDialog: () => {
        ipcRenderer.send('close-dialog');
    },
    // 新增：读取文件为Base64
    readFileAsBase64: async (filePath) => {
        return await ipcRenderer.invoke('read-file-as-base64', filePath);
    }
});

// 暴露ipcRenderer给渲染进程
contextBridge.exposeInMainWorld('ipcRenderer', {
    on: (channel, func) => {
        // 白名单通道
        const validChannels = ['popup-tips', 'has-click-cut', 'update-hide-status', 'scroll-capture-status'];
        if (validChannels.includes(channel)) {
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
    send: (channel, data) => {
        // 白名单通道
        const validChannels = [
            'cut-screen', 
            'setCaptureKey', 
            'setShowKey', 
            'launch', 
            'is-hide-windows',
            'insert-canvas',
            'linux-clipboard',
            'trigger-capture',
            "set-ai-analysis",
            'close-dialog',
            'scroll-capture'
        ];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    }
});