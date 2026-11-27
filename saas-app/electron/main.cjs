const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    title: 'Gestão de Negócios 360°',
    icon: path.join(__dirname, '../build/icon.ico'),
    autoHideMenuBar: true,
    backgroundColor: '#0b1120',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.maximize();
  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));

  // Permitir Web Serial (Porta COM) e Web Bluetooth para impressoras térmicas no app Windows (.exe)
  const ses = mainWindow.webContents.session;
  ses.setPermissionCheckHandler((_wc, permission) => {
    if (permission === 'serial' || permission === 'bluetooth' || permission === 'hid') {
      return true;
    }
    return true;
  });
  ses.setDevicePermissionHandler((details) => {
    if (details.deviceType === 'serial' || details.deviceType === 'bluetooth' || details.deviceType === 'hid') {
      return true;
    }
    return false;
  });
  let serialPortTryIdx = 0;
  ses.on('select-serial-port', (event, portList, _wc, callback) => {
    event.preventDefault();
    if (portList && portList.length > 0) {
      const idx = serialPortTryIdx % portList.length;
      serialPortTryIdx += 1;
      callback(portList[idx].portId);
    } else {
      callback('');
    }
  });
  let btSelectTimer = null;
  mainWindow.webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
    event.preventDefault();
    if (deviceList && deviceList.length > 0) {
      const printer =
        deviceList.find((d) => /pos|mpt|print|thermal|rpp|elgin|bematech|xprinter|af72|bt/i.test(d.deviceName || ''));
      if (printer) {
        if (btSelectTimer) {
          clearTimeout(btSelectTimer);
          btSelectTimer = null;
        }
        callback(printer.deviceId);
        return;
      }
    }
    if (!btSelectTimer) {
      btSelectTimer = setTimeout(() => {
        btSelectTimer = null;
        if (deviceList && deviceList.length > 0) {
          callback(deviceList[0].deviceId);
        } else {
          callback('');
        }
      }, 4500);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
