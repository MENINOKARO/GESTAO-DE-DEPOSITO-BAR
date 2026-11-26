const MESES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro'
];

export function formatarMoeda(valor: number): string {
  return (Number(valor) || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

export function formatarDataHoraBr(iso?: string): string {
  if (!iso) return '--';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return String(iso);
  return dt.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatarDataBr(isoOuYmd?: string): string {
  if (!isoOuYmd) return '--';
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOuYmd)) {
    const [ano, mes, dia] = isoOuYmd.split('-');
    return `${dia}/${mes}/${ano}`;
  }
  const dt = new Date(isoOuYmd);
  if (Number.isNaN(dt.getTime())) return String(isoOuYmd);
  return dt.toLocaleDateString('pt-BR');
}

export function obterSubpastaMesAtual(refDate: Date = new Date()): string {
  const mesIdx = refDate.getMonth();
  const mesNum = String(mesIdx + 1).padStart(2, '0');
  const mesNome = MESES_PT[mesIdx] || 'Mês';
  const ano = refDate.getFullYear();
  return `${mesNum} - ${mesNome} ${ano}`;
}

export function obterSubpastaMesDeYmd(mesYm?: string): string {
  if (!mesYm || !/^\d{4}-\d{2}$/.test(mesYm)) {
    return obterSubpastaMesAtual();
  }
  const [ano, mesStr] = mesYm.split('-');
  const mesIdx = Math.max(0, Math.min(11, parseInt(mesStr, 10) - 1));
  return `${mesStr} - ${MESES_PT[mesIdx]} ${ano}`;
}

export function gerarId(prefixo: string): string {
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  const ts = Date.now().toString(36).toUpperCase();
  return `${prefixo}-${ts}-${rand}`;
}

/**
 * SHA-256 compatível com Google Apps Script (`gerarHashSenha`) e PostgreSQL (`pgcrypto` digest).
 */
export async function sha256Hex(texto: string): Promise<string> {
  const bytes = new TextEncoder().encode(String(texto));
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return String(texto);
}

export function formatarTelefoneBr(valor: string): string {
  const digits = String(valor || '').replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function formatarCpfCnpjBr(valor: string): string {
  const digits = String(valor || '').replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 11) {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function formatarCidadeUf(valor: string): string {
  const preps = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);
  const partes = String(valor || '').split('/');
  const cidadeFmt = partes[0]
    .split(' ')
    .map((p, idx) => {
      if (!p) return '';
      const lower = p.toLowerCase();
      if (idx > 0 && preps.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
  if (partes.length === 1) return cidadeFmt;
  const ufFmt = partes.slice(1).join('/').toUpperCase();
  return `${cidadeFmt}/${ufFmt}`;
}

export function formatarTextoInicialMaiuscula(valor: string): string {
  const preps = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);
  return String(valor || '')
    .split(' ')
    .map((p, idx) => {
      if (!p) return '';
      const lower = p.toLowerCase();
      if (idx > 0 && preps.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}
