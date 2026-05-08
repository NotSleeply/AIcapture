/**
 * 滚动截图工具
 * 支持对长网页/长文档进行垂直滚动拼接截图
 * 
 * 实现方式：
 * - 通过 desktopCapturer 获取屏幕内容
 * - 模拟键盘滚动，逐屏截取
 * - 将多张截图在渲染进程中的 Canvas 中拼接成一张完整的长图
 */

const { desktopCapturer, screen, ipcMain } = require('electron');
const { nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { format } = require('url');

class ScrollCapture {
    static isCapturing = false;

    /**
     * 执行滚动截图
     */
    static async capture(mainWindow, imgDir) {
        if (this.isCapturing) {
            return { success: false, error: '正在进行截图，请等待完成' };
        }

        this.isCapturing = true;
        
        try {
            const result = await this._doCapture(mainWindow, imgDir);
            return result;
        } finally {
            this.isCapturing = false;
        }
    }

    static async _doCapture(mainWindow, imgDir) {
        const scrollDelay = 350;
        const maxScrolls = 30;
        const screenshots = [];
        let prevImageDataHash = null;
        let stableCount = 0;
        const stableThreshold = 2;

        // 隐藏主窗口避免干扰
        const wasVisible = mainWindow?.isVisible();
        if (wasVisible) mainWindow.hide();
        await this._sleep(300);

        // 获取主屏幕尺寸
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width: displayW, height: displayH } = primaryDisplay.bounds || primaryDisplay.workArea || { width: 1920, height: 1080 };

        for (let i = 0; i < maxScrolls; i++) {
            // 截屏
            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: { width: Math.round(displayW), height: Math.round(displayH) },
            });

            const mainScreenSource = sources.find(s =>
                s.id === `screen:${primaryDisplay.id}` || s.id.includes(':0:')
            ) || sources[0];

            if (!mainScreenSource?.thumbnail) break;

            const screenshot = nativeImage.createFromBitmap(
                mainScreenSource.thumbnail.toBitmap(),
                { width: displayW, height: displayH }
            );

            const pngBuffer = screenshot.toPNG();

            // 简单的哈希比较检测是否到达底部（只检查部分像素）
            const dataHash = this._quickHash(pngBuffer);

            if (prevImageDataHash !== null && Math.abs(dataHash - prevImageDataHash) < 500) {
                stableCount++;
                if (stableCount >= stableThreshold) {
                    console.log('[ScrollCapture] 到达页面底部');
                    break;
                }
            } else {
                stableCount = 0;
            }
            prevImageDataHash = dataHash;

            // 存储 base64 数据用于后续拼接
            screenshots.push(`data:image/png;base64,${pngBuffer.toString('base64')}`);

            // 滚动
            this._simulateScroll();
            await this._sleep(scrollDelay);
        }

        if (wasVisible) mainWindow.show();

        if (screenshots.length === 0) {
            return { success: false, error: '未能获取任何截图' };
        }

        if (screenshots.length === 1) {
            // 单张图直接保存
            const ts = Date.now();
            const fp = path.join(imgDir, `scroll_${ts}.png`);
            fs.writeFileSync(fp, Buffer.from(screenshots[0].split(',')[1], 'base64'));
            return { success: true, imagePath: fp };
        }

        // 多张图需要在渲染进程中拼接 - 创建临时窗口处理
        const mergeResult = await this._mergeInRenderer(mainWindow, screenshots, imgDir);
        return mergeResult;
    }

    /**
     * 在隐藏的渲染窗口中完成图像拼接
     */
    static async _mergeInRenderer(mainWindow, screenshotsDataUrls, imgDir) {
        return new Promise((resolve, reject) => {
            const { BrowserWindow } = require('electron');

            const mergeWindow = new BrowserWindow({
                show: false,
                webPreferences: {
                    nodeIntegration: true,
                    contextIsolation: false,
                },
                width: 100,
                height: 100,
            });

            const mergeHTML = `
<!DOCTYPE html>
<html><body style="margin:0;padding:0;overflow:hidden">
<canvas id="c" style="display:none"></canvas>
<script>
const imgs = ${JSON.stringify(screenshotsDataUrls)};
(async () => {
    try {
        const images = await Promise.all(imgs.map(src => new Promise((res, rej) => {
            const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src;
        })));
        
        const W = images[0].naturalWidth;
        let totalH = 0;
        // 计算总高度（含重叠检测）
        const overlap = Math.floor(images[0].naturalHeight * 0.08); // 8% 重叠
        for (let j = 0; j < images.length; j++) {
            totalH += images[j].naturalHeight;
            if (j > 0) totalH -= overlap;
        }
        
        const canvas = document.getElementById('c');
        canvas.width = W;
        canvas.height = totalH;
        const ctx = canvas.getContext('2d');
        
        let offsetY = 0;
        ctx.drawImage(images[0], 0, 0);
        offsetY = images[0].naturalHeight;
        
        for (let k = 1; k < images.length; k++) {
            ctx.drawImage(images[k], 0, offsetY - overlap);
            offsetY += images[k].naturalHeight - overlap;
        }
        
        canvas.toBlob(blob => {
            const reader = new FileReader();
            reader.onload = () => window.__result = reader.result.split(',')[1];
            reader.readAsDataURL(blob);
            window.__done = true;
        }, 'image/png');
    } catch(e) { window.__error = e.message; window.__done = true; }
})();
</script></body></html>`;
            
            mergeWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(mergeHTML)}`);

            // 等待合并完成
            const checkDone = setInterval(() => {
                mergeWindow.webContents.executeJavaScript('window.__done').then(done => {
                    if (!done) return;
                    
                    clearInterval(checkDone);
                    
                    mergeWindow.webContents.executeJavaScript('window.__error').then(err => {
                        if (err) {
                            mergeWindow.close();
                            reject(new Error(err));
                        }
                        
                        mergeWindow.webContents.executeJavaScript('window.__result').then(base64Data => {
                            const ts = Date.now();
                            const fp = path.join(imgDir, `scroll_${ts}.png`);
                            
                            try {
                                fs.writeFileSync(fp, Buffer.from(base64Data, 'base64'));
                                mergeWindow.close();
                                resolve({ success: true, imagePath: fp });
                            } catch(e) {
                                mergeWindow.close();
                                reject(e);
                            }
                        });
                    });
                }).catch(() => {});
            }, 200);

            // 超时保护
            setTimeout(() => {
                clearInterval(checkDone);
                mergeWindow.close();
                reject(new Error('图片合并超时'));
            }, 60000);
        });
    }

    static _simulateScroll() {
        try {
            const { execSync } = require('child_process');
            execSync(
                'powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(\'{PGDN}\')"',
                { timeout: 2000 }
            );
        } catch (e) {
            // 忽略错误
        }
    }

    static _quickHash(buffer) {
        // 快速采样哈希用于变化检测（只采样部分字节）
        let hash = 0;
        const step = Math.max(1, Math.floor(buffer.length / 1000));
        for (let i = 0; i < buffer.length; i += step) {
            hash = ((hash << 5) - hash + buffer[i]) | 0;
        }
        return hash >>> 0;
    }

    static _sleep(ms) {
        return new Promise(r => setTimeout(r, ms));
    }

    /**
     * 注册 IPC 处理器（供主进程调用）
     */
    static registerIPC(mainWindow, imgDir) {
        ipcMain.handle('start-scroll-capture', async (event, options) => {
            return this.capture(mainWindow, imgDir, options);
        });
    }
}

module.exports = ScrollCapture;
