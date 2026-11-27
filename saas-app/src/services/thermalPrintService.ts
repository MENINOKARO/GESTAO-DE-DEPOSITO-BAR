import type { DeliveryPedido, Empresa, RelatorioGerado } from '../types/domain';
import { formatarDataHoraBr, formatarMoeda } from '../utils/formatters';

export type LarguraBobinaTermica = '58mm' | '80mm';

const KEY_LARGURA_PREFIX = 'gn360_termica_largura_';
const KEY_AUTOPRINT_PREFIX = 'gn360_auto_print_delivery_';

export function getLarguraTermicaEmpresa(empresaId: string): LarguraBobinaTermica {
  try {
    const v = localStorage.getItem(KEY_LARGURA_PREFIX + empresaId);
    return v === '58mm' ? '58mm' : '80mm';
  } catch {
    return '80mm';
  }
}

export function setLarguraTermicaEmpresa(empresaId: string, largura: LarguraBobinaTermica): void {
  try {
    localStorage.setItem(KEY_LARGURA_PREFIX + empresaId, largura);
  } catch {
    // ignore
  }
}

export function getAutoPrintDeliveryEmpresa(empresaId: string): boolean {
  try {
    return localStorage.getItem(KEY_AUTOPRINT_PREFIX + empresaId) === '1';
  } catch {
    return false;
  }
}

export function setAutoPrintDeliveryEmpresa(empresaId: string, ativo: boolean): void {
  try {
    if (ativo) {
      localStorage.setItem(KEY_AUTOPRINT_PREFIX + empresaId, '1');
    } else {
      localStorage.removeItem(KEY_AUTOPRINT_PREFIX + empresaId);
    }
  } catch {
    // ignore
  }
}

function escHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export interface PrintPreviewPayload {
  titulo: string;
  htmlBody: string;
  textoLimpo: string;
  largura: LarguraBobinaTermica;
}

export function buildCupomDocHtml(htmlBody: string, largura: LarguraBobinaTermica = '80mm'): string {
  const widthCss = largura === '58mm' ? '54mm' : '74mm';
  const pageSize = largura === '58mm' ? '58mm auto' : '80mm auto';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Cupom Térmico</title>
<style>
  @page { size: ${pageSize}; margin: 2mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0 auto;
    padding: 4mm;
    width: ${widthCss};
    font-family: 'Courier New', Courier, monospace;
    font-size: ${largura === '58mm' ? '11px' : '12px'};
    line-height: 1.35;
    color: #000;
    background: #fff;
  }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  .sep { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; gap: 6px; }
  .big { font-size: ${largura === '58mm' ? '13px' : '15px'}; font-weight: 700; }
</style>
</head>
<body>
${htmlBody}
</body>
</html>`;
}

export function imprimirViaIframeOculto(htmlBody: string, largura: LarguraBobinaTermica = '80mm'): void {
  const docHtml = buildCupomDocHtml(htmlBody, largura);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '1px';
  iframe.style.height = '1px';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }

  doc.open();
  doc.write(docHtml);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 2500);
    }
  }, 250);
}

export function imprimirHtmlTermico(
  htmlBody: string,
  largura: LarguraBobinaTermica = '80mm',
  titulo = 'Cupom Térmico',
  textoLimpo = ''
): void {
  const textoFinal =
    textoLimpo ||
    htmlBody
      .replace(/<div class="sep"><\/div>/g, '\n--------------------------------\n')
      .replace(/<\/div>/g, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

  if (typeof window !== 'undefined') {
    const ev = new CustomEvent<PrintPreviewPayload>('gn360:print-preview', {
      cancelable: true,
      detail: { titulo, htmlBody, textoLimpo: textoFinal, largura }
    });
    const naoCancelado = window.dispatchEvent(ev);
    if (!naoCancelado) return;
  }

  imprimirViaIframeOculto(htmlBody, largura);
}

// ====================================================================
// IMPRESSORA TÉRMICA BLUETOOTH / SERIAL DIRETA (ESC/POS)
// ====================================================================

interface BtCharLike {
  writeValue: (data: BufferSource) => Promise<void>;
}
interface SerialPortLike {
  open: (opts: { baudRate: number }) => Promise<void>;
  close?: () => Promise<void>;
  writable?: WritableStream<Uint8Array> | null;
}

interface AndroidThermalBridgeLike {
  listPairedPrinters: () => string;
  printBase64: (address: string, base64Data: string) => string;
}

const KEY_ANDROID_BT_ADDR = 'gn360_android_bt_addr';
const KEY_ANDROID_BT_NAME = 'gn360_android_bt_name';
const KEY_SERIAL_SAVED = 'gn360_serial_saved';
const KEY_SERIAL_BAUD = 'gn360_serial_baud';

function getAndroidBridge(): AndroidThermalBridgeLike | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AndroidThermalBridge?: AndroidThermalBridgeLike };
  return w.AndroidThermalBridge || null;
}

function getSavedAndroidPrinter(): { address: string; name: string } | null {
  try {
    const address = localStorage.getItem(KEY_ANDROID_BT_ADDR) || '';
    const name = localStorage.getItem(KEY_ANDROID_BT_NAME) || '';
    return address ? { address, name } : null;
  } catch {
    return null;
  }
}

function hasSavedSerialPrinter(): boolean {
  try {
    return (
      typeof navigator !== 'undefined' &&
      'serial' in navigator &&
      localStorage.getItem(KEY_SERIAL_SAVED) === '1'
    );
  } catch {
    return false;
  }
}

let btCharacteristic: BtCharLike | null = null;
let btDeviceName = '';
let serialPort: SerialPortLike | null = null;
let serialBaudRate = 9600;
let serialCloseTimer: ReturnType<typeof setTimeout> | null = null;

function clearSerialReleaseTimer(): void {
  if (serialCloseTimer) {
    clearTimeout(serialCloseTimer);
    serialCloseTimer = null;
  }
}

async function closePortSafely(port: SerialPortLike | null): Promise<void> {
  clearSerialReleaseTimer();
  if (!port?.close) return;
  try {
    await port.close();
  } catch {
    // ignore
  }
}

function scheduleSerialRelease(port: SerialPortLike): void {
  clearSerialReleaseTimer();
  serialCloseTimer = setTimeout(() => {
    serialCloseTimer = null;
    if (serialPort === port) {
      void closePortSafely(port);
    }
  }, 1500);
}

async function openPortWithBaud(port: SerialPortLike, preferredBaud = 9600): Promise<number | null> {
  if (port.writable) return preferredBaud;
  const bauds = Array.from(new Set([preferredBaud, 9600, 115200, 38400]));
  for (const baudRate of bauds) {
    try {
      await port.open({ baudRate });
      return baudRate;
    } catch (e) {
      const em = e instanceof Error ? e.message : '';
      if (/already open/i.test(em)) return baudRate;
    }
  }
  return null;
}

async function writeBytesToPort(port: SerialPortLike, bytes: Uint8Array, timeoutMs = 4000): Promise<void> {
  if (!port.writable) {
    throw new Error('Porta COM não está aberta para escrita.');
  }
  if (port.writable.locked) {
    throw new Error('A porta COM travou (provável porta de Entrada do Bluetooth).');
  }
  const writer = port.writable.getWriter();
  try {
    await Promise.race([
      writer.write(bytes),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Tempo esgotado ao enviar para a porta COM')), timeoutMs)
      )
    ]);
  } finally {
    try {
      writer.releaseLock();
    } catch {
      // ignore
    }
  }
}

export function getStatusImpressoraBluetooth(): { conectada: boolean; nome: string } {
  const androidDev = getAndroidBridge() ? getSavedAndroidPrinter() : null;
  if (androidDev) return { conectada: true, nome: androidDev.name || androidDev.address };
  if (btCharacteristic) return { conectada: true, nome: btDeviceName || 'Bluetooth BLE' };
  if (serialPort || hasSavedSerialPrinter()) {
    return { conectada: true, nome: 'Bluetooth / Porta COM (Sob Demanda)' };
  }
  return { conectada: false, nome: '' };
}

export async function desconectarImpressoraTermica(): Promise<void> {
  btCharacteristic = null;
  btDeviceName = '';
  try {
    localStorage.removeItem(KEY_ANDROID_BT_ADDR);
    localStorage.removeItem(KEY_ANDROID_BT_NAME);
    localStorage.removeItem(KEY_SERIAL_SAVED);
    localStorage.removeItem(KEY_SERIAL_BAUD);
  } catch {
    // ignore
  }
  const p = serialPort;
  serialPort = null;
  await closePortSafely(p);
}

export async function conectarImpressoraBluetooth(): Promise<{ ok: boolean; msg: string }> {
  const androidBridge = getAndroidBridge();
  if (androidBridge) {
    try {
      const parsed = JSON.parse(androidBridge.listPairedPrinters()) as {
        ok: boolean;
        msg?: string;
        devices?: Array<{ name: string; address: string }>;
      };
      if (!parsed.ok) {
        return { ok: false, msg: parsed.msg || 'Não foi possível acessar o Bluetooth do Android.' };
      }
      const devs = parsed.devices || [];
      if (devs.length === 0) {
        return {
          ok: false,
          msg: 'Nenhuma impressora pareada encontrada no Bluetooth do celular. Pareie a Printer_AF72 nas configurações do Android (PIN 0000) e tente novamente.'
        };
      }
      const escolhida =
        devs.find((d) => /printer|pos|mpt|af72|rpp|elgin|bematech|xprinter|thermal|bt/i.test(d.name)) ||
        devs[0];
      localStorage.setItem(KEY_ANDROID_BT_ADDR, escolhida.address);
      localStorage.setItem(KEY_ANDROID_BT_NAME, escolhida.name);
      return {
        ok: true,
        msg: `Impressora "${escolhida.name}" conectada nativamente via Bluetooth Android!`
      };
    } catch (err) {
      return {
        ok: false,
        msg: err instanceof Error ? err.message : 'Erro ao conectar Bluetooth no Android.'
      };
    }
  }

  const nav = navigator as unknown as {
    bluetooth?: {
      requestDevice: (opts: unknown) => Promise<{
        name?: string;
        gatt?: {
          connect: () => Promise<{
            getPrimaryServices: () => Promise<
              Array<{
                getCharacteristics: () => Promise<
                  Array<{ properties: { write?: boolean; writeWithoutResponse?: boolean }; writeValue: (d: BufferSource) => Promise<void> }>
                >;
              }>
            >;
          }>;
        };
      }>;
    };
  };
  if (!nav.bluetooth) {
    return {
      ok: false,
      msg: 'Web Bluetooth não disponível neste navegador. Use Chrome/Edge ou conecte via Porta COM (Serial).'
    };
  }
  try {
    const dev = await nav.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [
        '000018f0-0000-1000-8000-00805f9b34fb',
        '0000ff00-0000-1000-8000-00805f9b34fb',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455',
        'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
      ]
    });
    const server = await dev.gatt?.connect();
    if (!server) return { ok: false, msg: 'Não foi possível conectar ao GATT da impressora.' };
    const services = await server.getPrimaryServices();
    for (const svc of services) {
      const chars = await svc.getCharacteristics();
      const writable = chars.find((c) => c.properties.write || c.properties.writeWithoutResponse);
      if (writable) {
        btCharacteristic = writable;
        btDeviceName = dev.name || 'Térmica Bluetooth';
        return { ok: true, msg: `Impressora "${btDeviceName}" conectada via Bluetooth!` };
      }
    }
    return { ok: false, msg: 'Impressora pareada, mas nenhuma característica de escrita ESC/POS foi encontrada. Tente via Porta COM (Serial).' };
  } catch (err) {
    const raw = err instanceof Error ? err.message : '';
    if (/cancel/i.test(raw) || /NotFoundError/i.test(raw)) {
      return {
        ok: false,
        msg: 'Seleção Bluetooth cancelada ou indisponível neste navegador embutido. Se sua térmica usa Bluetooth Clássico (SPP), abra http://localhost:5173 no Chrome/Edge e use "Porta COM (Serial)", ou instale-a nas Impressoras do Windows.'
      };
    }
    return { ok: false, msg: raw || 'Conexão Bluetooth cancelada.' };
  }
}

export async function conectarImpressoraSerialCom(): Promise<{ ok: boolean; msg: string }> {
  const nav = navigator as unknown as {
    serial?: {
      requestPort: () => Promise<SerialPortLike>;
      getPorts?: () => Promise<SerialPortLike[]>;
    };
  };
  if (!nav.serial) {
    return { ok: false, msg: 'Web Serial não disponível neste navegador. Use Chrome, Edge ou o app Windows (.exe).' };
  }
  const isElectron = typeof navigator !== 'undefined' && /Electron/i.test(navigator.userAgent);
  const maxTentativas = isElectron ? 2 : 1;
  let lastErr: unknown = null;

  for (let tentativa = 0; tentativa < maxTentativas; tentativa++) {
    let port: SerialPortLike | null = null;
    try {
      port = await nav.serial.requestPort();
      const baud = await openPortWithBaud(port, serialBaudRate);
      if (!baud) {
        await closePortSafely(port);
        lastErr = new Error('Não foi possível abrir esta porta COM.');
        continue;
      }
      // Sonda silenciosa (ESC @) para validar se a porta aceita escrita real (evita porta de Entrada no Windows)
      await writeBytesToPort(port, new Uint8Array([0x1b, 0x40]), 3500);
      serialPort = port;
      serialBaudRate = baud;
      try {
        localStorage.setItem(KEY_SERIAL_SAVED, '1');
        localStorage.setItem(KEY_SERIAL_BAUD, String(baud));
      } catch {
        // ignore
      }
      // Libera a porta após 1.5s para permitir multiconexão alternada com o celular
      scheduleSerialRelease(port);
      return { ok: true, msg: 'Impressora conectada via Porta COM (modo multiconexão sob demanda)!' };
    } catch (err) {
      await closePortSafely(port);
      lastErr = err;
      const raw = err instanceof Error ? err.message : '';
      if (/cancel|No port selected/i.test(raw)) {
        return {
          ok: false,
          msg: 'Nenhuma porta COM selecionada. Se estiver no navegador embutido do editor, abra http://localhost:5173 no Chrome/Edge para escolher a porta COM da impressora.'
        };
      }
    }
  }

  const rawErr = lastErr instanceof Error ? lastErr.message : '';
  if (/Failed to open serial port|travou|Tempo esgotado/i.test(rawErr)) {
    return {
      ok: false,
      msg: 'Não foi possível comunicar com a porta COM. Verifique se a impressora está ligada e não está sendo usada pelo celular no momento.'
    };
  }
  return { ok: false, msg: rawErr || 'Falha ao conectar Porta COM.' };
}

async function enviarEscPosDireto(textoLimpo: string, largura: LarguraBobinaTermica = '80mm'): Promise<{ ok: boolean; msg?: string }> {
  const escInit = new Uint8Array([0x1b, 0x40]);
  const escEnd =
    largura === '58mm'
      ? new Uint8Array([0x0d, 0x0a, 0x0d, 0x0a, 0x0d, 0x0a])
      : new Uint8Array([0x0d, 0x0a, 0x0d, 0x0a, 0x0d, 0x0a, 0x1d, 0x56, 0x42, 0x00]);
  const semAcentos = textoLimpo
    .replace(/[\u00A0\u202F\u2007\u200B]/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\r?\n/g, '\r\n')
    .replace(/[^\x20-\x7E\r\n]/g, '');
  const bodyBytes = new TextEncoder().encode(semAcentos + '\r\n');
  const full = new Uint8Array(escInit.length + bodyBytes.length + escEnd.length);
  full.set(escInit, 0);
  full.set(bodyBytes, escInit.length);
  full.set(escEnd, escInit.length + bodyBytes.length);

  try {
    const androidBridge = getAndroidBridge();
    const androidSaved = androidBridge ? getSavedAndroidPrinter() : null;
    if (androidBridge && androidSaved) {
      let bin = '';
      for (let i = 0; i < full.length; i++) bin += String.fromCharCode(full[i]);
      const b64 = btoa(bin);
      const parsed = JSON.parse(androidBridge.printBase64(androidSaved.address, b64)) as {
        ok: boolean;
        msg?: string;
      };
      return { ok: Boolean(parsed.ok), msg: parsed.msg };
    }
    if (btCharacteristic) {
      for (let i = 0; i < full.length; i += 100) {
        await btCharacteristic.writeValue(full.slice(i, i + 100));
      }
      return { ok: true };
    }
    if (serialPort || hasSavedSerialPrinter()) {
      clearSerialReleaseTimer();
      let port = serialPort;
      if (!port) {
        const nav = navigator as unknown as { serial?: { getPorts?: () => Promise<SerialPortLike[]> } };
        const ports = nav.serial?.getPorts ? await nav.serial.getPorts() : [];
        if (ports.length > 0) {
          port = ports[ports.length - 1];
          serialPort = port;
        }
      }
      if (!port) {
        return { ok: false, msg: 'Porta COM salva não encontrada. Clique em Porta COM (Serial) para autorizar novamente.' };
      }
      const savedBaud = Number(localStorage.getItem(KEY_SERIAL_BAUD) || serialBaudRate || 9600);
      const openedBaud = await openPortWithBaud(port, savedBaud);
      if (!openedBaud) {
        return {
          ok: false,
          msg: 'Não foi possível abrir a porta COM (verifique se a impressora está ligada ou sendo usada no celular).'
        };
      }
      try {
        await writeBytesToPort(port, full, 4000);
      } finally {
        scheduleSerialRelease(port);
      }
      return { ok: true };
    }
    return { ok: false, msg: 'Nenhuma impressora Bluetooth/Serial conectada.' };
  } catch (err) {
    return {
      ok: false,
      msg: err instanceof Error ? err.message : 'Falha ao enviar dados para a impressora.'
    };
  }
}

export async function testarImpressaoTermica(
  empresaNome: string,
  largura: LarguraBobinaTermica = '80mm'
): Promise<{ ok: boolean; msg: string }> {
  const sep = largura === '58mm' ? '--------------------------------' : '------------------------------------------';
  const texto = [
    empresaNome || 'MK Gestao de Negocios 360',
    sep,
    'TESTE DE IMPRESSAO TERMICA',
    `Data: ${new Date().toLocaleString('pt-BR')}`,
    `Bobina: ${largura}`,
    sep,
    'Impressao OK!',
    ''
  ].join('\n');

  const bt = getStatusImpressoraBluetooth();
  if (bt.conectada) {
    const res = await enviarEscPosDireto(texto, largura);
    if (res.ok) {
      return { ok: true, msg: 'Teste enviado para a impressora térmica com sucesso!' };
    }
    return {
      ok: false,
      msg: `Falha ao imprimir na porta conectada (${res.msg || 'erro'}). Se for Bluetooth no Windows, clique em Desconectar e tente a outra porta COM.`
    };
  }

  imprimirHtmlTermico(
    `<div class="center bold big">${escHtml(empresaNome || 'MK Gestão 360°')}</div><div class="sep"></div><div class="center bold">TESTE DE IMPRESSÃO TÉRMICA</div><div class="center">${escHtml(new Date().toLocaleString('pt-BR'))}</div><div class="sep"></div><div class="center">Impressão OK!</div>`,
    largura,
    'Teste de Impressão Térmica',
    texto
  );
  return { ok: true, msg: 'Pré-visualização de teste aberta.' };
}

export function imprimirCupomTermicoDelivery(
  pedido: DeliveryPedido,
  empresa: Pick<Empresa, 'id' | 'nome' | 'telefone' | 'cidade' | 'chave_pix'>,
  largura?: LarguraBobinaTermica
): void {
  const lar = largura || getLarguraTermicaEmpresa(empresa.id);
  const btStatus = getStatusImpressoraBluetooth();
  const linhaSep = lar === '58mm' ? '--------------------------------' : '------------------------------------------';
  const linhasItens = (pedido.itens || [])
    .map((it) => `${it.quantidade}x ${it.produto_nome} - ${formatarMoeda(it.subtotal || it.quantidade * it.preco_unitario)}`)
    .join('\n');
  const txt = [
    empresa.nome || 'MK Gestao 360',
    empresa.telefone || '',
    linhaSep,
    `PEDIDO DELIVERY #${pedido.pedido || pedido.id.slice(-6)}`,
    formatarDataHoraBr(pedido.data_hora),
    linhaSep,
    `Cliente: ${pedido.cliente}`,
    pedido.telefone ? `Tel: ${pedido.telefone}` : '',
    pedido.endereco ? `End: ${pedido.endereco}` : '',
    linhaSep,
    linhasItens,
    linhaSep,
    `Subtotal: ${formatarMoeda(pedido.valor_produtos)}`,
    `Taxa Entrega: ${formatarMoeda(pedido.taxa_entrega)}`,
    `TOTAL: ${formatarMoeda(pedido.total)}`,
    `Pagamento: ${pedido.forma_pagamento}`,
    pedido.observacoes ? `Obs: ${pedido.observacoes}` : '',
    linhaSep,
    'MK Gestao de Negocios 360'
  ]
    .filter(Boolean)
    .join('\n');

  const itensHtml = (pedido.itens || [])
    .map(
      (it) =>
        `<div class="row"><span>${it.quantidade}x ${escHtml(it.produto_nome)}</span><span>${escHtml(
          formatarMoeda(it.subtotal || it.quantidade * it.preco_unitario)
        )}</span></div>`
    )
    .join('');

  const html = `
    <div class="center bold big">${escHtml(empresa.nome || 'MK Gestão 360°')}</div>
    ${empresa.telefone ? `<div class="center">${escHtml(empresa.telefone)}</div>` : ''}
    ${empresa.cidade ? `<div class="center">${escHtml(empresa.cidade)}</div>` : ''}
    <div class="sep"></div>
    <div class="center bold">PEDIDO DELIVERY #${escHtml(pedido.pedido || pedido.id.slice(-6))}</div>
    <div class="center">${escHtml(formatarDataHoraBr(pedido.data_hora))}</div>
    <div class="sep"></div>
    <div><span class="bold">Cliente:</span> ${escHtml(pedido.cliente)}</div>
    ${pedido.telefone ? `<div><span class="bold">Tel:</span> ${escHtml(pedido.telefone)}</div>` : ''}
    ${pedido.endereco ? `<div><span class="bold">End:</span> ${escHtml(pedido.endereco)}</div>` : ''}
    ${pedido.entregador ? `<div><span class="bold">Entregador:</span> ${escHtml(pedido.entregador)}</div>` : ''}
    <div class="sep"></div>
    <div class="bold">ITENS DO PEDIDO</div>
    ${itensHtml || '<div>Sem itens detalhados</div>'}
    <div class="sep"></div>
    <div class="row"><span>Subtotal:</span><span>${escHtml(formatarMoeda(pedido.valor_produtos))}</span></div>
    <div class="row"><span>Taxa Entrega:</span><span>${escHtml(formatarMoeda(pedido.taxa_entrega))}</span></div>
    <div class="row big"><span>TOTAL:</span><span>${escHtml(formatarMoeda(pedido.total))}</span></div>
    <div class="sep"></div>
    <div><span class="bold">Pagamento:</span> ${escHtml(pedido.forma_pagamento)}</div>
    ${pedido.observacoes ? `<div><span class="bold">Obs:</span> ${escHtml(pedido.observacoes)}</div>` : ''}
    ${empresa.chave_pix && String(pedido.forma_pagamento).toUpperCase().includes('PIX') ? `<div><span class="bold">PIX:</span> ${escHtml(empresa.chave_pix)}</div>` : ''}
    <div class="sep"></div>
    <div class="center">MK Gestão de Negócios 360°</div>
  `;

  if (btStatus.conectada) {
    void enviarEscPosDireto(txt, lar).then((res) => {
      if (!res.ok) {
        imprimirHtmlTermico(html, lar, `Pedido Delivery #${pedido.pedido || pedido.id.slice(-6)}`, txt);
      }
    });
    return;
  }

  imprimirHtmlTermico(html, lar, `Pedido Delivery #${pedido.pedido || pedido.id.slice(-6)}`, txt);
}

export function imprimirCupomTermicoComanda(
  dados: {
    pedido: string;
    cliente: string;
    itens: Array<{ produto_nome: string; quantidade: number; preco_unitario: number; subtotal: number }>;
    totalComanda: number;
    taxaServico10: number;
    valorPagoAgora: number;
    saldoRestante: number;
    formaPagamento: string;
    vendedorNome?: string;
    parcial: boolean;
  },
  empresa: Pick<Empresa, 'id' | 'nome' | 'telefone' | 'cidade' | 'chave_pix'>,
  largura?: LarguraBobinaTermica
): void {
  const lar = largura || getLarguraTermicaEmpresa(empresa.id);
  const btStatus = getStatusImpressoraBluetooth();
  const linhaSep = lar === '58mm' ? '--------------------------------' : '------------------------------------------';

  const txt = [
    empresa.nome || 'MK Gestao 360',
    empresa.telefone || '',
    linhaSep,
    `COMANDA #${dados.pedido} (${dados.parcial ? 'PGTO PARCIAL' : 'QUITADA'})`,
    formatarDataHoraBr(new Date().toISOString()),
    `Cliente: ${dados.cliente}`,
    dados.vendedorNome ? `Atendente: ${dados.vendedorNome}` : '',
    linhaSep,
    ...dados.itens.map((it) => `${it.quantidade}x ${it.produto_nome} - ${formatarMoeda(it.subtotal)}`),
    linhaSep,
    `Total Comanda: ${formatarMoeda(dados.totalComanda)}`,
    dados.taxaServico10 > 0 ? `Taxa Servico (10%): ${formatarMoeda(dados.taxaServico10)}` : '',
    `VALOR PAGO AGORA: ${formatarMoeda(dados.valorPagoAgora)}`,
    dados.saldoRestante > 0 ? `Saldo Restante: ${formatarMoeda(dados.saldoRestante)}` : '',
    `Pagamento: ${dados.formaPagamento}`,
    linhaSep,
    'MK Gestao de Negocios 360'
  ]
    .filter(Boolean)
    .join('\n');

  const itensHtml = dados.itens
    .map(
      (it) =>
        `<div class="row"><span>${it.quantidade}x ${escHtml(it.produto_nome)}</span><span>${escHtml(
          formatarMoeda(it.subtotal)
        )}</span></div>`
    )
    .join('');

  const html = `
    <div class="center bold big">${escHtml(empresa.nome || 'MK Gestão 360°')}</div>
    ${empresa.telefone ? `<div class="center">${escHtml(empresa.telefone)}</div>` : ''}
    ${empresa.cidade ? `<div class="center">${escHtml(empresa.cidade)}</div>` : ''}
    <div class="sep"></div>
    <div class="center bold">COMANDA #${escHtml(dados.pedido)} (${dados.parcial ? 'PGTO PARCIAL' : 'QUITADA'})</div>
    <div class="center">${escHtml(formatarDataHoraBr(new Date().toISOString()))}</div>
    <div class="sep"></div>
    <div><span class="bold">Cliente:</span> ${escHtml(dados.cliente)}</div>
    ${dados.vendedorNome ? `<div><span class="bold">Atendente:</span> ${escHtml(dados.vendedorNome)}</div>` : ''}
    <div class="sep"></div>
    <div class="bold">ITENS</div>
    ${itensHtml || '<div>Sem itens</div>'}
    <div class="sep"></div>
    <div class="row"><span>Total Comanda:</span><span>${escHtml(formatarMoeda(dados.totalComanda))}</span></div>
    ${dados.taxaServico10 > 0 ? `<div class="row"><span>Taxa Serviço (10%):</span><span>${escHtml(formatarMoeda(dados.taxaServico10))}</span></div>` : ''}
    <div class="row big"><span>PAGO AGORA:</span><span>${escHtml(formatarMoeda(dados.valorPagoAgora))}</span></div>
    ${dados.saldoRestante > 0 ? `<div class="row"><span>Saldo Restante:</span><span>${escHtml(formatarMoeda(dados.saldoRestante))}</span></div>` : ''}
    <div class="sep"></div>
    <div><span class="bold">Pagamento:</span> ${escHtml(dados.formaPagamento)}</div>
    ${empresa.chave_pix && String(dados.formaPagamento).toUpperCase().includes('PIX') ? `<div><span class="bold">PIX:</span> ${escHtml(empresa.chave_pix)}</div>` : ''}
    <div class="sep"></div>
    <div class="center">MK Gestão de Negócios 360°</div>
  `;

  if (btStatus.conectada) {
    void enviarEscPosDireto(txt, lar).then((res) => {
      if (!res.ok) {
        imprimirHtmlTermico(html, lar, `Comanda #${dados.pedido}`, txt);
      }
    });
    return;
  }

  imprimirHtmlTermico(html, lar, `Comanda #${dados.pedido}`, txt);
}

export function imprimirRelatorioTermico(
  relatorio: RelatorioGerado,
  empresa: Pick<Empresa, 'id' | 'nome'>,
  largura?: LarguraBobinaTermica
): void {
  const lar = largura || getLarguraTermicaEmpresa(empresa.id);
  const resumoHtml = (relatorio.resumo || [])
    .map(
      (r) =>
        `<div class="row"><span>${escHtml(r.label)}:</span><span class="bold">${escHtml(r.valor)}</span></div>`
    )
    .join('');

  const linhasHtml = (relatorio.linhas || [])
    .map((linha) => {
      const cols = relatorio.colunas || [];
      const principal = escHtml(linha[0] ?? '');
      const resto = linha
        .slice(1)
        .map((val, idx) => `${escHtml(cols[idx + 1] || '')}: ${escHtml(val)}`)
        .join(' | ');
      return `<div style="margin-bottom:4px"><div class="bold">${principal}</div>${resto ? `<div style="font-size:10px">${resto}</div>` : ''}</div>`;
    })
    .join('');

  const html = `
    <div class="center bold big">${escHtml(empresa.nome || 'MK Gestão 360°')}</div>
    <div class="center bold">${escHtml(relatorio.titulo)}</div>
    <div class="center">${escHtml(relatorio.periodoLabel)}</div>
    <div class="center">${escHtml(formatarDataHoraBr(new Date().toISOString()))}</div>
    <div class="sep"></div>
    ${resumoHtml ? `<div class="bold">RESUMO</div>${resumoHtml}<div class="sep"></div>` : ''}
    <div class="bold">DETALHAMENTO (${(relatorio.linhas || []).length})</div>
    ${linhasHtml || '<div>Sem registros no período.</div>'}
    <div class="sep"></div>
    <div class="center">MK Gestão de Negócios 360°</div>
  `;

  imprimirHtmlTermico(html, lar);
}
