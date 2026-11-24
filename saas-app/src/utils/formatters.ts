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
