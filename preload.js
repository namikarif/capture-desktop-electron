const {contextBridge, ipcRenderer} = require('electron');

contextBridge.exposeInMainWorld("electron", {
    getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),
    onPowerEvent: (callback) => ipcRenderer.on("power-event", (_, event) => callback(event)),
    getUniqueId: () => ipcRenderer.invoke("get-unique-id"),
});
