/**
 * Utilitário para normalização de Chave PIX padrão Banco Central (BCB)
 * e geração do payload oficial PIX BR Code (EMVCo) + CRC16-CCITT.
 */

export function normalizarChavePixBCB(chave: string): string {
  const c = String(chave || '').trim();
  if (!c) return '';
  if (c.includes('@')) return c.toLowerCase().trim();

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c);
  if (isUuid) return c.toLowerCase().trim();

  const digitos = c.replace(/\D/g, '');
  if (digitos.length === 14) return digitos;
  if (c.startsWith('+55')) return `+${digitos}`;
  if (digitos.length === 10) return `+55${digitos}`;

  if (digitos.length === 11) {
    if (c.includes('.') && c.includes('-')) return digitos;
    if (digitos.charAt(2) === '9') return `+55${digitos}`;
    return digitos;
  }

  return c;
}

export function normalizarTextoPix(texto: string, maxLen: number): string {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, maxLen);
}

function tlv(id: string, valor: string): string {
  const len = String(valor.length).padStart(2, '0');
  return `${id}${len}${valor}`;
}

function calcularCrc16Ccitt(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i += 1) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j += 1) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function gerarPixCopiaCola(params: {
  chave: string;
  nomeRecebedor: string;
  cidade: string;
  valor?: number;
  txid?: string;
}): string {
  const chaveLimpa = normalizarChavePixBCB(params.chave);
  if (!chaveLimpa) return '';

  const nome = normalizarTextoPix(params.nomeRecebedor || 'DEPOSITO', 25) || 'DEPOSITO';
  const cidade = normalizarTextoPix(params.cidade || 'SALVADOR', 15) || 'SALVADOR';
  const txidLimpo =
    String(params.txid || '***')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9*]/g, '')
      .slice(0, 25) || '***';

  const merchantAccountInfo = tlv('00', 'br.gov.bcb.pix') + tlv('01', chaveLimpa);
  const valorNum = Number(params.valor) || 0;
  const campoValor = valorNum > 0 ? tlv('54', valorNum.toFixed(2)) : '';
  const additionalData = tlv('05', txidLimpo);

  const semCrc =
    tlv('00', '01') +
    tlv('26', merchantAccountInfo) +
    tlv('52', '0000') +
    tlv('53', '986') +
    campoValor +
    tlv('58', 'BR') +
    tlv('59', nome) +
    tlv('60', cidade) +
    tlv('62', additionalData) +
    '6304';

  return semCrc + calcularCrc16Ccitt(semCrc);
}
