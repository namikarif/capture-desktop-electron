const {app, BrowserWindow, ipcMain, desktopCapturer, powerMonitor, screen} = require('electron');
const path = require('path');
const { execSync } = require("child_process");
const os = require("os");

let mainWindow;

const getUniqueId = () => {
    try {
        if (os.platform() === "win32") {
            return execSync("wmic csproduct get uuid").toString().split("\n")[1].trim();
        } else if (os.platform() === "linux") {
            return execSync("cat /var/lib/dbus/machine-id").toString().trim();
        } else if (os.platform() === "darwin") {
            return execSync("ioreg -l | grep IOPlatformSerialNumber").toString().split('"')[3].trim();
        }
    } catch (error) {
        console.error("Error fetching system ID:", error);
        return null;
    }
};

function createWindow() {
    const {width, height} = screen.getPrimaryDisplay().workAreaSize;

    mainWindow = new BrowserWindow({
        width,
        height,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        }
    });

    mainWindow.loadFile('index.html');

    mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('get-desktop-sources', async () => {
    return await desktopCapturer.getSources({types: ['screen']});
});

powerMonitor.on("shutdown", () => {
    mainWindow?.webContents.send("power-event", "shutdown");
});

powerMonitor.on("lock-screen", () => {
    mainWindow?.webContents.send("power-event", "lock");
});

powerMonitor.on("unlock-screen", () => {
    mainWindow?.webContents.send("power-event", "unlock");
});

powerMonitor.on("resume", () => {
    mainWindow?.webContents.send("power-event", "resume");
});

ipcMain.handle("get-unique-id", async () => {
    return getUniqueId();
});
