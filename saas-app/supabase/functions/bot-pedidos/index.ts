import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, apikey'
};

interface CartItemBot {
  produto_id: string;
  produto_nome: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
}

interface BotSessionState {
  etapa: 'ITENS' | 'NOME' | 'ENDERECO' | 'PAGAMENTO' | 'TROCO' | 'CONFIRMAR';
  itens: CartItemBot[];
  cliente?: string;
  telefone?: string;
  endereco?: string;
  forma_pagamento?: string;
  observacoes?: string;
  lastMsgId?: string;
  updatedAt: number;
}

function moeda(v: number): string {
  return `R$ ${(Number(v) || 0).toFixed(2).replace('.', ',')}`;
}

function extrairTextoTelegram(body: Record<string, unknown>): {
  msgId: string;
  chatId: string;
  nome: string;
  telefone: string;
  texto: string;
} | null {
  const msg = (body.message || body.edited_message) as Record<string, unknown> | undefined;
  if (!msg) return null;
  const chat = msg.chat as { id?: number | string; first_name?: string; username?: string } | undefined;
  const from = msg.from as { first_name?: string; username?: string } | undefined;
  if (!chat?.id) return null;
  return {
    msgId: `TG_${String(msg.message_id || '')}`,
    chatId: String(chat.id),
    nome: String(from?.first_name || chat.first_name || from?.username || 'Cliente'),
    telefone: '',
    texto: String(msg.text || '').trim()
  };
}

function extrairTextoEvolution(body: Record<string, unknown>): {
  msgId: string;
  chatId: string;
  nome: string;
  telefone: string;
  texto: string;
} | null {
  const event = String(body.event || '').toLowerCase();
  if (event && !event.includes('messages.upsert')) return null;

  const data = (body.data || body) as Record<string, unknown>;
  const key = data.key as {
    id?: string;
    remoteJid?: string;
    remoteJidAlt?: string;
    senderPn?: string;
    fromMe?: boolean;
  } | undefined;
  if (!key?.remoteJid || key.fromMe) return null;
  if (key.remoteJid.endsWith('@g.us') || key.remoteJid.includes('status@broadcast')) return null;

  const targetJid =
    key.remoteJid.endsWith('@lid') && (key.remoteJidAlt || key.senderPn)
      ? String(key.remoteJidAlt || key.senderPn)
      : key.remoteJid;

  const message = (data.message || {}) as Record<string, unknown>;
  const ext = message.extendedTextMessage as { text?: string } | undefined;
  const texto = String(
    message.conversation || ext?.text || (message as { text?: string }).text || ''
  ).trim();
  if (!texto) return null;

  const telefone = targetJid.replace(/@.*/, '');
  return {
    msgId: `EVO_${String(key.id || '')}`,
    chatId: targetJid,
    nome: String(data.pushName || 'Cliente'),
    telefone,
    texto
  };
}

async function enviarRespostaTelegram(token: string, chatId: string, texto: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: texto })
  });
}

async function enviarRespostaEvolution(
  baseUrl: string,
  instance: string,
  apiKey: string,
  remoteJid: string,
  texto: string
): Promise<void> {
  const url = `${baseUrl.replace(/\/+$/, '')}/message/sendText/${encodeURIComponent(instance)}`;
  const destino = remoteJid.endsWith('@lid') ? remoteJid : remoteJid.replace(/@.*/, '');
  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: apiKey
    },
    body: JSON.stringify({
      number: destino,
      text: texto
    })
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ ok: false, msg: 'Secrets do Supabase ausentes.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const urlObj = new URL(req.url);
    const canal = String(urlObj.searchParams.get('canal') || 'evolution').toLowerCase();
    const empresaId = String(urlObj.searchParams.get('empresa_id') || '').trim();
    if (!empresaId) {
      return new Response(JSON.stringify({ ok: false, msg: 'empresa_id obrigatório na URL do webhook.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const entrada = canal === 'telegram' ? extrairTextoTelegram(body) : extrairTextoEvolution(body);
    if (!entrada || !entrada.texto) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const [{ data: empresa }, { data: produtos }, { data: cfgRows }] = await Promise.all([
      admin.from('empresas').select('*').eq('id', empresaId).maybeSingle(),
      admin.from('produtos').select('*').eq('empresa_id', empresaId).order('nome'),
      admin
        .from('config')
        .select('chave,valor')
        .in('chave', [
          `BOT_STATE_${empresaId}_${entrada.chatId}`,
          `EVO_CFG_${empresaId}`,
          'SAAS_MASTER_CONFIG',
          'WEBAPP_URL'
        ])
    ]);

    if (!empresa || String(empresa.status_assinatura || '').toUpperCase() === 'BLOQUEADO') {
      return new Response(JSON.stringify({ ok: false, msg: 'Empresa inativa ou bloqueada.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const cfgMap = new Map<string, string>();
    for (const r of (cfgRows || []) as Array<{ chave: string; valor: string }>) {
      cfgMap.set(r.chave, r.valor);
    }

    const responder = async (mensagem: string) => {
      if (canal === 'telegram') {
        const tok = String(empresa.telegram_bot_token || '').trim();
        if (tok) await enviarRespostaTelegram(tok, entrada.chatId, mensagem);
      } else {
        const evoRaw = cfgMap.get(`EVO_CFG_${empresaId}`);
        const masterRaw = cfgMap.get('SAAS_MASTER_CONFIG');
        const evo = evoRaw ? (JSON.parse(evoRaw) as Record<string, string>) : {};
        const master = masterRaw ? (JSON.parse(masterRaw) as Record<string, string>) : {};
        const baseUrl = evo.url || master.evolution_api_url || '';
        const instance = String(body.instance || evo.instance || master.evolution_instancia_padrao || '');
        const apiKey = evo.apiKey || master.evolution_api_key || '';
        if (baseUrl && instance && apiKey) {
          await enviarRespostaEvolution(baseUrl, instance, apiKey, entrada.chatId, mensagem);
        }
      }
    };

    const stateKey = `BOT_STATE_${empresaId}_${entrada.chatId}`;
    const msgLockKey = `BOT_MSG_${empresaId}_${entrada.msgId}`;
    const rawState = cfgMap.get(stateKey);
    let state: BotSessionState | null = null;
    if (rawState) {
      try {
        const parsed = JSON.parse(rawState) as BotSessionState;
        if (Date.now() - parsed.updatedAt < 30 * 60 * 1000) state = parsed;
      } catch {
        state = null;
      }
    }

    // Evita processar 2x a mesma mensagem (reenvio de webhook ou clique duplo)
    if (entrada.msgId && entrada.msgId !== 'EVO_' && entrada.msgId !== 'TG_') {
      if (state?.lastMsgId === entrada.msgId) {
        return new Response(JSON.stringify({ ok: true, deduplicated: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const { data: msgJaFoi } = await admin
        .from('config')
        .select('chave')
        .eq('chave', msgLockKey)
        .maybeSingle();
      if (msgJaFoi) {
        return new Response(JSON.stringify({ ok: true, deduplicated: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      await admin.from('config').upsert(
        { chave: msgLockKey, valor: String(Date.now()), updated_at: new Date().toISOString() },
        { onConflict: 'chave' }
      );
    }

    const catalogo = ((produtos || []) as Array<{
      id: string;
      nome: string;
      preco_venda: number;
      estoque_atual: number;
    }>).filter((p) => Number(p.preco_venda) > 0 && Number(p.estoque_atual) > 0);

    const texto = entrada.texto;
    const upper = texto.toUpperCase();

    const salvarEstado = async (st: BotSessionState | null) => {
      if (!st) {
        await admin.from('config').delete().eq('chave', stateKey);
      } else {
        st.updatedAt = Date.now();
        st.lastMsgId = entrada.msgId;
        await admin.from('config').upsert(
          { chave: stateKey, valor: JSON.stringify(st), updated_at: new Date().toISOString() },
          { onConflict: 'chave' }
        );
      }
    };

    const montarCardapio = () => {
      if (catalogo.length === 0) return 'Nenhum produto cadastrado no momento.';
      const lista = catalogo
        .slice(0, 25)
        .map((p, idx) => `${idx + 1}. ${p.nome} — ${moeda(p.preco_venda)}`)
        .join('\n');
      return (
        `🛒 *Cardápio — ${empresa.nome}*\n\n${lista}\n\n` +
        `Digite o *número* do produto (ex.: \`1\` ou \`1 x 2\` para 2 unidades).\n` +
        `Quando terminar de escolher, digite *FINALIZAR* (ou *0* para cancelar).`
      );
    };

    if (upper === 'CANCELAR' || upper === 'SAIR' || texto === '/cancelar') {
      await salvarEstado(null);
      await responder('❌ Atendimento cancelado. Quando quiser pedir, basta mandar um Oi!');
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!state || texto === '/start' || upper === 'OI' || upper === 'OLÁ' || upper === 'OLA' || upper === 'MENU' || upper === 'CARDAPIO' || upper === 'CARDÁPIO') {
      const novoEstado: BotSessionState = {
        etapa: 'ITENS',
        itens: [],
        telefone: entrada.telefone,
        updatedAt: Date.now()
      };
      await salvarEstado(novoEstado);
      await responder(`Olá, ${entrada.nome}! Bem-vindo(a) ao atendimento automático.\n\n${montarCardapio()}`);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (state.etapa === 'ITENS') {
      if (upper === 'FINALIZAR' || upper === 'PRONTO' || upper === 'CONCLUIR') {
        if (state.itens.length === 0) {
          await responder('Seu carrinho ainda está vazio. Escolha pelo menos 1 item pelo número:\n\n' + montarCardapio());
          return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        state.etapa = 'NOME';
        await salvarEstado(state);
        await responder(`Perfeito! Qual é o *seu nome completo* para o pedido? (Ou digite *1* para usar "${entrada.nome}")`);
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const partes = texto
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const adicionados: string[] = [];
      for (const parte of partes) {
        const norm = parte.replace(/\s+/g, '');
        const match = norm.match(/^(\d+)(?:[xX*](\d+))?$/);
        if (!match) {
          await responder('Formato inválido. Digite o número do produto e quantidade (ex.: `5x2`, `5 x 2`, `1, 2x3`) ou digite *FINALIZAR*.');
          return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const idx = Number(match[1]) - 1;
        const qtd = Math.max(1, Number(match[2] || 1));
        const prod = catalogo[idx];
        if (!prod) {
          await responder(`Produto nº ${match[1]} não encontrado no cardápio. Confira os números acima.`);
          return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const existente = state.itens.find((i) => i.produto_id === prod.id);
        if (existente) {
          existente.quantidade += qtd;
          existente.subtotal = existente.quantidade * existente.preco_unitario;
        } else {
          state.itens.push({
            produto_id: prod.id,
            produto_nome: prod.nome,
            quantidade: qtd,
            preco_unitario: Number(prod.preco_venda),
            subtotal: qtd * Number(prod.preco_venda)
          });
        }
        adicionados.push(`*${qtd}x ${prod.nome}* (${moeda(qtd * Number(prod.preco_venda))})`);
      }

      await salvarEstado(state);
      const totalParcial = state.itens.reduce((acc, i) => acc + i.subtotal, 0);
      await responder(
        `✅ Adicionado: ${adicionados.join(', ')}\n` +
          `Subtotal atual: *${moeda(totalParcial)}*\n\n` +
          `Digite outro item (ex.: \`2x1\`) ou digite *FINALIZAR*.`
      );
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (state.etapa === 'NOME') {
      state.cliente = texto === '1' ? entrada.nome : texto;
      state.etapa = 'ENDERECO';
      await salvarEstado(state);
      await responder(`Obrigado, *${state.cliente}*!\nAgora informe o *endereço completo para entrega* (Rua, número, bairro e ponto de referência):`);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (state.etapa === 'ENDERECO') {
      state.endereco = texto;
      state.etapa = 'PAGAMENTO';
      await salvarEstado(state);
      await responder(
        `Endereço anotado!\nQual será a *forma de pagamento*?\n\n` +
          `1 - PIX\n2 - Dinheiro\n3 - Cartão Débito\n4 - Cartão Crédito`
      );
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (state.etapa === 'PAGAMENTO') {
      const mapaPgto: Record<string, string> = {
        '1': 'PIX',
        PIX: 'PIX',
        '2': 'Dinheiro',
        DINHEIRO: 'Dinheiro',
        '3': 'Cartão Débito',
        '4': 'Cartão Crédito'
      };
      const forma = mapaPgto[upper] || mapaPgto[texto] || '';
      if (!forma) {
        await responder('Escolha uma opção válida:\n1 - PIX\n2 - Dinheiro\n3 - Cartão Débito\n4 - Cartão Crédito');
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      state.forma_pagamento = forma;
      if (forma === 'Dinheiro') {
        state.etapa = 'TROCO';
        await salvarEstado(state);
        await responder('Precisa de troco? Se sim, informe para quanto (ex.: `Troco para R$ 100`), ou digite *Não*.');
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      state.etapa = 'CONFIRMAR';
      await salvarEstado(state);
      const total = state.itens.reduce((acc, i) => acc + i.subtotal, 0);
      const resumoItens = state.itens.map((i) => `• ${i.quantidade}x ${i.produto_nome} (${moeda(i.subtotal)})`).join('\n');
      await responder(
        `📋 *Resumo do Pedido*\n\n${resumoItens}\n\n` +
          `👤 Cliente: ${state.cliente}\n📍 Endereço: ${state.endereco}\n💳 Pagamento: ${state.forma_pagamento}\n💰 *Total: ${moeda(total)}*\n\n` +
          `Digite *1* para *CONFIRMAR* ou *2* para *CANCELAR*.`
      );
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (state.etapa === 'TROCO') {
      state.observacoes = upper === 'NAO' || upper === 'NÃO' ? 'Sem troco' : texto;
      state.etapa = 'CONFIRMAR';
      await salvarEstado(state);
      const total = state.itens.reduce((acc, i) => acc + i.subtotal, 0);
      const resumoItens = state.itens.map((i) => `• ${i.quantidade}x ${i.produto_nome} (${moeda(i.subtotal)})`).join('\n');
      await responder(
        `📋 *Resumo do Pedido*\n\n${resumoItens}\n\n` +
          `👤 Cliente: ${state.cliente}\n📍 Endereço: ${state.endereco}\n💵 Pagamento: Dinheiro (${state.observacoes})\n💰 *Total: ${moeda(total)}*\n\n` +
          `Digite *1* para *CONFIRMAR* ou *2* para *CANCELAR*.`
      );
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (state.etapa === 'CONFIRMAR') {
      if (texto === '2') {
        await salvarEstado(null);
        await responder('❌ Pedido cancelado. Mande um Oi quando quiser recomeçar!');
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (texto !== '1' && upper !== 'CONFIRMAR' && upper !== 'SIM') {
        await responder('Digite *1* para CONFIRMAR o pedido ou *2* para CANCELAR.');
        return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Limpa o estado ANTES de gravar para impedir duplicidade caso o cliente mande "1" duas vezes
      await salvarEstado(null);

      const valorProdutos = state.itens.reduce((acc, i) => acc + i.subtotal, 0);
      const { data: ultimosPed } = await admin
        .from('delivery')
        .select('pedido')
        .eq('empresa_id', empresaId);
      let maiorNum = 0;
      for (const r of (ultimosPed || []) as Array<{ pedido?: string }>) {
        const m = String(r.pedido || '').trim().match(/^(\d+)/);
        if (m) maiorNum = Math.max(maiorNum, Number(m[1]) || 0);
      }
      const tagBot = canal === 'telegram' ? 'BOT TG' : 'BOT ZAP';
      const numPedido = `${maiorNum + 1} (${tagBot})`;
      const deliveryId = `DEL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      const agoraIso = new Date().toISOString();

      const { error: delErr } = await admin.from('delivery').insert({
        id: deliveryId,
        empresa_id: empresaId,
        pedido: numPedido,
        cliente: state.cliente || entrada.nome,
        telefone: state.telefone || '',
        endereco: state.endereco || '',
        status: 'PENDENTE',
        valor_produtos: valorProdutos,
        taxa_entrega: 0,
        total: valorProdutos,
        forma_pagamento: state.forma_pagamento || 'Dinheiro',
        entregador: '',
        observacoes: state.observacoes ? String(state.observacoes).trim() : '',
        data_hora: agoraIso
      });
      if (delErr) {
        await responder(`❌ Não foi possível registrar o pedido no sistema: ${delErr.message}`);
        return new Response(JSON.stringify({ ok: false, msg: delErr.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const itensRows = state.itens.map((it, i) => ({
        id: `DIT-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
        delivery_id: deliveryId,
        empresa_id: empresaId,
        pedido: numPedido,
        produto_nome: it.produto_nome,
        quantidade: it.quantidade,
        preco_unitario: it.preco_unitario,
        subtotal: it.subtotal,
        hora: agoraIso
      }));
      if (itensRows.length > 0) {
        const { error: itensErr } = await admin.from('delivery_itens').insert(itensRows);
        if (itensErr) {
          await responder(`⚠️ Pedido criado, mas erro ao gravar itens: ${itensErr.message}`);
        }
      }

      const pixInfo =
        state.forma_pagamento === 'PIX' && empresa.chave_pix
          ? `\n\n💠 Chave PIX da loja: ${empresa.chave_pix}`
          : '';
      await responder(
        `✅ *Pedido #${numPedido} confirmado!*\nJá enviamos para o preparo e impressão.${pixInfo}\nObrigado pela preferência!`
      );

      // Dispara sincronização da planilha sem atrasar a resposta ao cliente
      const webappUrl =
        cfgMap.get('WEBAPP_URL') ||
        (empresaId === 'EMP-MATRIZ-DEFAULT'
          ? 'https://script.google.com/macros/s/AKfycbzsVlZgA_M9Xqf_VCmA57XHH3iEa_YHOo0-qfSNvl3F5Xrtiuf-9QJ_sm97atoPureH/exec'
          : '');
      if (webappUrl && webappUrl.startsWith('http')) {
        void fetch(webappUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'SYNC_SUPABASE_TO_SHEET',
            empresa_id: empresaId,
            origem: 'BOT_PEDIDOS',
            ts: agoraIso
          })
        }).catch(() => null);
      }

      return new Response(JSON.stringify({ ok: true, delivery_id: deliveryId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, msg: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
