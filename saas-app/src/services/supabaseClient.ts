import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseRuntimeConfig {
  url: string;
  anonKey: string;
}

const STORAGE_KEY_CFG = 'gn360_supabase_cfg';

export function getSupabaseConfig(): SupabaseRuntimeConfig {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

  if (envUrl && envKey) {
    return { url: envUrl.replace(/\/+$/, ''), anonKey: envKey };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY_CFG);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SupabaseRuntimeConfig>;
      return {
        url: String(parsed.url || '').trim().replace(/\/+$/, ''),
        anonKey: String(parsed.anonKey || '').trim()
      };
    }
  } catch {
    // ignore storage errors
  }

  return { url: '', anonKey: '' };
}

export function saveSupabaseConfig(cfg: SupabaseRuntimeConfig): void {
  const urlLimpa = String(cfg.url || '').trim().replace(/\/+$/, '');
  const keyLimpa = String(cfg.anonKey || '').trim();
  if (!urlLimpa && !keyLimpa) {
    localStorage.removeItem(STORAGE_KEY_CFG);
    cachedClient = null;
    cachedKeySignature = '';
    return;
  }
  localStorage.setItem(STORAGE_KEY_CFG, JSON.stringify({ url: urlLimpa, anonKey: keyLimpa }));
  cachedClient = null;
  cachedKeySignature = '';
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseConfig();
  return Boolean(url && url.startsWith('https://') && anonKey && anonKey.length > 20);
}

let cachedClient: SupabaseClient | null = null;
let cachedKeySignature = '';
let activeSessionToken = '';
let activeEmpresaHeader = '';

export function setSupabaseTenantHeaders(sessionToken: string, empresaId: string): void {
  if (activeSessionToken !== sessionToken || activeEmpresaHeader !== empresaId) {
    activeSessionToken = sessionToken;
    activeEmpresaHeader = empresaId;
    cachedClient = null;
    cachedKeySignature = '';
  }
}

export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) return null;

  const signature = `${url}|${anonKey}|${activeSessionToken}|${activeEmpresaHeader}`;
  if (cachedClient && cachedKeySignature === signature) {
    return cachedClient;
  }

  const headers: Record<string, string> = {};
  if (activeSessionToken) headers['x-session-token'] = activeSessionToken;
  if (activeEmpresaHeader) headers['x-empresa-id'] = activeEmpresaHeader;

  cachedClient = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers
    }
  });
  cachedKeySignature = signature;
  return cachedClient;
}

export async function testarConexaoSupabaseReal(): Promise<{ ok: boolean; msg: string }> {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) {
    return {
      ok: false,
      msg: 'Informe a URL do projeto Supabase e a Anon Key pública.'
    };
  }
  if (anonKey.startsWith('sb_secret_') || anonKey.includes('service_role')) {
    return {
      ok: false,
      msg: 'Por segurança, utilize a Anon Key pública (nunca a Secret/Service Key) no front-end.'
    };
  }
  const client = getSupabaseClient();
  if (!client) {
    return { ok: false, msg: 'Cliente Supabase não pôde ser inicializado.' };
  }

  try {
    const { error } = await client.rpc('rpc_verificar_setup_inicial', { p_empresa_id: null });
    if (error) {
      if (error.message.toLowerCase().includes('could not find the function') || error.code === 'PGRST202') {
        return {
          ok: false,
          msg: 'Conectou ao Supabase, mas o schema SaaS v2 ainda não foi executado no SQL Editor.'
        };
      }
      return { ok: false, msg: `Falha ao consultar Supabase: ${error.message}` };
    }
    return { ok: true, msg: 'Conectado ao Supabase com schema multi-tenant ativo!' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, msg: `Erro de rede/DNS ao conectar no Supabase: ${msg}` };
  }
}
