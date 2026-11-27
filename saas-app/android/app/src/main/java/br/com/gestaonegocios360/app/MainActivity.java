package br.com.gestaonegocios360.app;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.BluetoothSocket;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.io.OutputStream;
import java.lang.reflect.Method;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private static final int REQ_BT_PERM = 4012;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().addJavascriptInterface(new AndroidThermalBridge(), "AndroidThermalBridge");
        }
    }

    private boolean ensureBtPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                        this,
                        new String[]{Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN},
                        REQ_BT_PERM
                );
                return false;
            }
        }
        return true;
    }

    public class AndroidThermalBridge {
        @JavascriptInterface
        public String listPairedPrinters() {
            JSONObject res = new JSONObject();
            try {
                if (!ensureBtPermission()) {
                    res.put("ok", false);
                    res.put("msg", "Permissão Bluetooth solicitada. Aceite no celular e toque em Conectar Bluetooth novamente.");
                    return res.toString();
                }
                BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
                if (adapter == null) {
                    res.put("ok", false);
                    res.put("msg", "Bluetooth não disponível neste aparelho.");
                    return res.toString();
                }
                if (!adapter.isEnabled()) {
                    res.put("ok", false);
                    res.put("msg", "Ligue o Bluetooth do celular e pareie a impressora (PIN 0000).");
                    return res.toString();
                }
                Set<BluetoothDevice> bonded = adapter.getBondedDevices();
                JSONArray arr = new JSONArray();
                if (bonded != null) {
                    for (BluetoothDevice dev : bonded) {
                        JSONObject item = new JSONObject();
                        item.put("name", dev.getName() != null ? dev.getName() : "Dispositivo Bluetooth");
                        item.put("address", dev.getAddress());
                        arr.put(item);
                    }
                }
                res.put("ok", true);
                res.put("devices", arr);
            } catch (Exception e) {
                try {
                    res.put("ok", false);
                    res.put("msg", e.getMessage() != null ? e.getMessage() : "Erro ao listar Bluetooth.");
                } catch (Exception ignored) {}
            }
            return res.toString();
        }

        private BluetoothSocket connectRfcommWithFallback(BluetoothDevice device) throws Exception {
            Exception lastErr = null;
            BluetoothSocket sock = null;
            // 1. Secure SPP
            try {
                sock = device.createRfcommSocketToServiceRecord(SPP_UUID);
                sock.connect();
                return sock;
            } catch (Exception e) {
                lastErr = e;
                try { if (sock != null) sock.close(); } catch (Exception ignored) {}
            }
            // 2. Insecure SPP
            try {
                sock = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID);
                sock.connect();
                return sock;
            } catch (Exception e) {
                lastErr = e;
                try { if (sock != null) sock.close(); } catch (Exception ignored) {}
            }
            // 3. Reflection createRfcommSocket(1) — padrão RawBT para impressoras térmicas
            try {
                Method m = device.getClass().getMethod("createRfcommSocket", int.class);
                sock = (BluetoothSocket) m.invoke(device, 1);
                sock.connect();
                return sock;
            } catch (Exception e) {
                lastErr = e;
                try { if (sock != null) sock.close(); } catch (Exception ignored) {}
            }
            // 4. Reflection createInsecureRfcommSocket(1)
            try {
                Method m = device.getClass().getMethod("createInsecureRfcommSocket", int.class);
                sock = (BluetoothSocket) m.invoke(device, 1);
                sock.connect();
                return sock;
            } catch (Exception e) {
                lastErr = e;
                try { if (sock != null) sock.close(); } catch (Exception ignored) {}
            }
            throw (lastErr != null ? lastErr : new Exception("Falha na conexão RFCOMM."));
        }

        private String printViaBleGatt(BluetoothDevice device, byte[] bytes) {
            final CountDownLatch latch = new CountDownLatch(1);
            final AtomicBoolean ok = new AtomicBoolean(false);
            final AtomicReference<String> msg = new AtomicReference<>("Timeout na conexão BLE.");
            final AtomicReference<BluetoothGatt> gattRef = new AtomicReference<>(null);

            BluetoothGattCallback cb = new BluetoothGattCallback() {
                @Override
                public void onConnectionStateChange(BluetoothGatt gatt, int status, int newState) {
                    if (newState == BluetoothProfile.STATE_CONNECTED) {
                        gatt.discoverServices();
                    } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                        if (!ok.get()) {
                            msg.compareAndSet("Timeout na conexão BLE.", "BLE desconectado (status " + status + ").");
                            latch.countDown();
                        }
                    }
                }

                @Override
                public void onServicesDiscovered(BluetoothGatt gatt, int status) {
                    if (status != BluetoothGatt.GATT_SUCCESS) {
                        msg.set("Falha ao descobrir serviços BLE (" + status + ").");
                        latch.countDown();
                        return;
                    }
                    BluetoothGattCharacteristic target = null;
                    for (BluetoothGattService svc : gatt.getServices()) {
                        for (BluetoothGattCharacteristic ch : svc.getCharacteristics()) {
                            int props = ch.getProperties();
                            if ((props & (BluetoothGattCharacteristic.PROPERTY_WRITE | BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE)) != 0) {
                                target = ch;
                                break;
                            }
                        }
                        if (target != null) break;
                    }
                    if (target == null) {
                        msg.set("Nenhuma característica de escrita BLE encontrada.");
                        latch.countDown();
                        return;
                    }
                    try {
                        int writeType = (target.getProperties() & BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE) != 0
                                ? BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
                                : BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT;
                        target.setWriteType(writeType);
                        int chunkSize = 20;
                        for (int offset = 0; offset < bytes.length; offset += chunkSize) {
                            int len = Math.min(chunkSize, bytes.length - offset);
                            byte[] chunk = new byte[len];
                            System.arraycopy(bytes, offset, chunk, 0, len);
                            target.setValue(chunk);
                            gatt.writeCharacteristic(target);
                            Thread.sleep(20);
                        }
                        Thread.sleep(300);
                        ok.set(true);
                        msg.set("Impresso via BLE com sucesso!");
                    } catch (Exception e) {
                        msg.set(e.getMessage() != null ? e.getMessage() : "Erro ao enviar dados BLE.");
                    } finally {
                        latch.countDown();
                    }
                }
            };

            try {
                BluetoothGatt gatt = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                        ? device.connectGatt(MainActivity.this, false, cb, BluetoothDevice.TRANSPORT_LE)
                        : device.connectGatt(MainActivity.this, false, cb);
                gattRef.set(gatt);
                latch.await(10, TimeUnit.SECONDS);
            } catch (Exception e) {
                msg.set(e.getMessage() != null ? e.getMessage() : "Erro BLE.");
            } finally {
                BluetoothGatt g = gattRef.get();
                if (g != null) {
                    try { g.disconnect(); g.close(); } catch (Exception ignored) {}
                }
            }
            return ok.get() ? null : msg.get();
        }

        @JavascriptInterface
        public String printBase64(String address, String base64Data) {
            JSONObject res = new JSONObject();
            BluetoothSocket socket = null;
            try {
                if (!ensureBtPermission()) {
                    res.put("ok", false);
                    res.put("msg", "Permissão Bluetooth necessária.");
                    return res.toString();
                }
                BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
                if (adapter == null || !adapter.isEnabled()) {
                    res.put("ok", false);
                    res.put("msg", "Bluetooth desligado.");
                    return res.toString();
                }
                BluetoothDevice device = adapter.getRemoteDevice(address);
                adapter.cancelDiscovery();
                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);

                try {
                    socket = connectRfcommWithFallback(device);
                    OutputStream os = socket.getOutputStream();
                    int chunk = 512;
                    for (int offset = 0; offset < bytes.length; offset += chunk) {
                        int len = Math.min(chunk, bytes.length - offset);
                        os.write(bytes, offset, len);
                        os.flush();
                        Thread.sleep(15);
                    }
                    Thread.sleep(500);
                    res.put("ok", true);
                    res.put("msg", "Impresso com sucesso!");
                } catch (Exception rfcommErr) {
                    String bleErr = printViaBleGatt(device, bytes);
                    if (bleErr == null) {
                        res.put("ok", true);
                        res.put("msg", "Impresso via BLE com sucesso!");
                    } else {
                        res.put("ok", false);
                        res.put("msg", (rfcommErr.getMessage() != null ? rfcommErr.getMessage() : "RFCOMM falhou") + " | BLE: " + bleErr);
                    }
                }
            } catch (Exception e) {
                try {
                    res.put("ok", false);
                    res.put("msg", e.getMessage() != null ? e.getMessage() : "Falha ao imprimir via Bluetooth.");
                } catch (Exception ignored) {}
            } finally {
                if (socket != null) {
                    try {
                        socket.close();
                    } catch (Exception ignored) {}
                }
            }
            return res.toString();
        }
    }
}
