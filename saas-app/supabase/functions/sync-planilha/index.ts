import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-token'
};

async function sha256Hex(texto: string): Promise<string> {
  const bytes = new TextEncoder().encode(texto);
  const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ ok: false, msg: 'Secrets do Supabase não configurados no servidor.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const acao = String(body.acao || '').trim();

    // 1) Conectar planilha via Login + Senha (gera/retorna sync_token automaticamente sem copiar do painel)
    if (acao === 'conectar_login') {
      const username = String(body.username || '').trim().toLowerCase();
      const senha = String(body.senha || '').trim();
      if (!username || !senha) {
        return new Response(JSON.stringify({ ok: false, msg: 'Informe usuário e senha.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const senhaHash = await sha256Hex(senha);
      const { data: usr, error: usrErr } = await admin
        .from('usuarios')
        .select('id,empresa_id,grupo_id,perfil,ativo,senha_hash')
        .eq('username', username)
        .maybeSingle();

      if (usrErr || !usr || !usr.ativo || usr.senha_hash !== senhaHash) {
        return new Response(JSON.stringify({ ok: false, msg: 'Usuário ou senha inválidos.' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const tokenKey = `SYNC_TOKEN_${usr.empresa_id}`;
      const { data: existing } = await admin
        .from('config_kv')
        .select('valor')
        .eq('chave', tokenKey)
        .maybeSingle();

      let syncToken = existing?.valor ? String(existing.valor) : '';
      if (!syncToken) {
        syncToken = `SYN-${crypto.randomUUID().replace(/-/g, '').toUpperCase()}`;
        await admin.from('config_kv').upsert({
          chave: tokenKey,
          empresa_id: usr.empresa_id,
          grupo_id: usr.grupo_id,
          valor: syncToken,
          updated_at: new Date().toISOString()
        });
      }

      return new Response(
        JSON.stringify({ ok: true, sync_token: syncToken, empresa_id: usr.empresa_id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2) Demais ações exigem x-sync-token (ou body.sync_token) válido
    const token = String(req.headers.get('x-sync-token') || body.sync_token || '').trim();
    if (!token) {
      return new Response(JSON.stringify({ ok: false, msg: 'sync_token ausente.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: cfgToken } = await admin
      .from('config_kv')
      .select('empresa_id,grupo_id')
      .eq('valor', token)
      .like('chave', 'SYNC_TOKEN_%')
      .maybeSingle();

    if (!cfgToken?.empresa_id) {
      return new Response(JSON.stringify({ ok: false, msg: 'sync_token inválido.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const empresaId = String(cfgToken.empresa_id);
    const { data: empresa } = await admin
      .from('empresas')
      .select('id,nome,status_assinatura,valido_ate')
      .eq('id', empresaId)
      .maybeSingle();

    if (!empresa || String(empresa.status_assinatura || '').toUpperCase() === 'BLOQUEADO') {
      return new Response(JSON.stringify({ ok: false, msg: 'Empresa bloqueada ou aguardando liberação no Master.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3) Pull dos dados espelho da empresa direto do BD
    if (acao === 'pull') {
      const [prod, cli, ven, cai] = await Promise.all([
        admin.from('produtos').select('*').eq('empresa_id', empresaId).order('nome'),
        admin.from('clientes').select('*').eq('empresa_id', empresaId).order('nome'),
        admin.from('vendas').select('*').eq('empresa_id', empresaId).order('data', { ascending: false }).limit(300),
        admin.from('caixa').select('*').eq('empresa_id', empresaId).order('data', { ascending: false }).limit(200)
      ]);
      return new Response(
        JSON.stringify({
          ok: true,
          empresa: { id: empresa.id, nome: empresa.nome },
          produtos: prod.data || [],
          clientes: cli.data || [],
          vendas: ven.data || [],
          caixa: cai.data || []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ ok: false, msg: `Ação desconhecida: ${acao}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, msg: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
