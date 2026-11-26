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
  ses.on('select-serial-port', (event, portList, _wc, callback) => {
    event.preventDefault();
    if (portList && portList.length > 0) {
      const btOrPrinter =
        portList.find((p) => /bluetooth|printer|pos|serial|com/i.test(`${p.displayName || ''} ${p.portName || ''}`)) ||
        portList[0];
      callback(btOrPrinter.portId);
    } else {
      callback('');
    }
  });
  mainWindow.webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
    event.preventDefault();
    if (deviceList && deviceList.length > 0) {
      const printer =
        deviceList.find((d) => /pos|mpt|print|thermal|rpp|elgin|bematech|xprinter|bt/i.test(d.deviceName || '')) ||
        deviceList[0];
      callback(printer.deviceId);
    } else {
      callback('');
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
