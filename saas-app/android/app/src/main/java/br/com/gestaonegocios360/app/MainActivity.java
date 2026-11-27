package br.com.gestaonegocios360.app;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
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
import java.util.Set;
import java.util.UUID;
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
                socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
                socket.connect();
                OutputStream os = socket.getOutputStream();
                byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
                os.write(bytes);
                os.flush();
                Thread.sleep(250);
                res.put("ok", true);
                res.put("msg", "Impresso com sucesso!");
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
