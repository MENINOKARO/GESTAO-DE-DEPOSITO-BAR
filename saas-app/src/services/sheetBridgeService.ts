export const DEFAULT_GAS_WEBAPP_URL =
  'https://script.google.com/macros/s/AKfycbzsVlZgA_M9Xqf_VCmA57XHH3iEa_YHOo0-qfSNvl3F5Xrtiuf-9QJ_sm97atoPureH/exec';

export type SheetSyncAction =
  | 'PING'
  | 'SYNC_SUPABASE_TO_SHEET'
  | 'SYNC_SHEET_TO_SUPABASE'
  | 'SYNC_BIDIRECTIONAL'
  | 'INSTALAR_GATILHO';

const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

async function enviarPostBridge(
  webappUrl: string,
  empresaId: string,
  action: SheetSyncAction
): Promise<boolean> {
  const url = String(webappUrl || '').trim();
  if (!url || !url.startsWith('http')) return false;

  try {
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        action,
        empresa_id: empresaId,
        origem: 'WEB_SAAS_360',
        ts: new Date().toISOString()
      })
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Dispara sincronização não-bloqueante em segundo plano (com debounce de 900ms)
 * logo após qualquer mutação realizada no novo painel Web/App.
 */
export function dispararSyncPlanilhaBackground(
  webappUrl: string,
  empresaId: string,
  action: 'SYNC_SUPABASE_TO_SHEET' | 'SYNC_BIDIRECTIONAL' = 'SYNC_SUPABASE_TO_SHEET'
): void {
  const url = String(webappUrl || '').trim();
  if (!url || !url.startsWith('http') || !empresaId) return;

  const key = `${empresaId}:${action}`;
  const timerAnterior = debounceTimers.get(key);
  if (timerAnterior) clearTimeout(timerAnterior);

  const timer = setTimeout(() => {
    debounceTimers.delete(key);
    void enviarPostBridge(url, empresaId, action);
  }, 250);

  debounceTimers.set(key, timer);
}

/**
 * Dispara sincronização imediata (usada pelo botão manual Sincronizar).
 */
export async function dispararSyncPlanilhaImediata(
  webappUrl: string,
  empresaId: string,
  action: 'SYNC_SUPABASE_TO_SHEET' | 'SYNC_BIDIRECTIONAL' = 'SYNC_BIDIRECTIONAL'
): Promise<boolean> {
  return enviarPostBridge(webappUrl, empresaId, action);
}
