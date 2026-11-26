/**
 * ====================================================================
 * CLIENTE SUPABASE & MOTOR DE SINCRONIZAÇÃO BIDIRECIONAL 360°
 * Planilha Google Sheets ↔ Supabase ↔ Painel Web/App ↔ Telegram Bot
 * ====================================================================
 */

const SUPABASE_CONFIG = {
  URL: '', // Lido dinamicamente de ScriptProperties (SUPABASE_URL) ou aba CONFIG
  KEY: ''  // Lido dinamicamente de ScriptProperties (SUPABASE_KEY) ou aba CONFIG
};

const WEBAPP_SYNC_URL_PADRAO =
  'https://script.google.com/macros/s/AKfycbzsVlZgA_M9Xqf_VCmA57XHH3iEa_YHOo0-qfSNvl3F5Xrtiuf-9QJ_sm97atoPureH/exec';

const TABELAS_MULTI_TENANT = [
  'produtos',
  'caixa',
  'vendas',
  'clientes',
  'usuarios',
  'comandas',
  'comanda_itens',
  'delivery',
  'delivery_itens',
  'contas_a_pagar',
  'contas_a_receber',
  'compras',
  'auditoria_logs'
];

// ====================================================================
// ⚙️ CREDENCIAIS & CONTEXTO MULTI-TENANT
// ====================================================================

function obterSupabaseUrl() {
  try {
    const prop = PropertiesService.getScriptProperties().getProperty('SUPABASE_URL');
    if (prop && prop.trim()) return prop.trim().replace(/\/+$/, '');
  } catch (e) {}
  if (typeof getConfig === 'function') {
    const cfg = getConfig('SUPABASE_URL');
    if (cfg && String(cfg).trim()) return String(cfg).trim().replace(/\/+$/, '');
  }
  return SUPABASE_CONFIG.URL;
}

function obterSupabaseKey() {
  try {
    const prop = PropertiesService.getScriptProperties().getProperty('SUPABASE_KEY');
    if (prop && prop.trim()) return prop.trim();
  } catch (e) {}
  if (typeof getConfig === 'function') {
    const cfg = getConfig('SUPABASE_KEY');
    if (cfg && String(cfg).trim()) return String(cfg).trim();
  }
  return '';
}

function configurarCredenciaisSupabaseSeguras(supabaseUrl, supabaseKey) {
  const props = PropertiesService.getScriptProperties();
  if (supabaseUrl && String(supabaseUrl).trim()) {
    props.setProperty('SUPABASE_URL', String(supabaseUrl).trim().replace(/\/+$/, ''));
  }
  if (supabaseKey && String(supabaseKey).trim()) {
    props.setProperty('SUPABASE_KEY', String(supabaseKey).trim());
  }
  return { ok: true, msg: 'Credenciais salvas com segurança em ScriptProperties.' };
}

function obterEmpresaId() {
  try {
    if (typeof getConfig === 'function') {
      const empId = getConfig('EMPRESA_ID');
      if (empId && String(empId).trim()) return String(empId).trim();
    }
  } catch (e) {}
  return 'EMP-MATRIZ-DEFAULT';
}

function obterGrupoId() {
  try {
    if (typeof getConfig === 'function') {
      const grpId = getConfig('GRUPO_ID');
      if (grpId && String(grpId).trim()) return String(grpId).trim();
    }
  } catch (e) {}
  return 'GRP-DEFAULT';
}

function obterWebAppSyncUrl() {
  try {
    if (typeof getConfig === 'function') {
      const urlCfg = getConfig('WEBAPP_URL');
      if (urlCfg && String(urlCfg).trim().startsWith('http')) {
        return String(urlCfg).trim();
      }
    }
  } catch (e) {}
  return WEBAPP_SYNC_URL_PADRAO;
}

function gerarIdDeterministico(prefixo, chave) {
  const base = String(chave || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    base || Utilities.getUuid(),
    Utilities.Charset.UTF_8
  );
  let hex = '';
  for (let i = 0; i < digest.length; i++) {
    const byteHex = (digest[i] & 0xff).toString(16).padStart(2, '0');
    hex += byteHex;
  }
  return `${prefixo}-${hex.slice(0, 12).toUpperCase()}`;
}

function normalizarTextoChave(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toUpperCase()
    .trim();
}

function limparNumero(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') {
    return isNaN(val) || !isFinite(val) ? 0 : val;
  }
  let str = String(val).trim();
  str = str.replace(/[R$\s%]/g, '');
  if (str.includes(',') && str.includes('.')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }
  const n = parseFloat(str);
  return isNaN(n) || !isFinite(n) ? 0 : n;
}

function configurarCredenciaisSupabase(url, key) {
  const urlFinal = (url || SUPABASE_CONFIG.URL).trim().replace(/\/+$/, '');
  const keyFinal = (key || obterSupabaseKey()).trim();

  try {
    PropertiesService.getScriptProperties().setProperties({
      SUPABASE_URL: urlFinal,
      SUPABASE_KEY: keyFinal
    });
  } catch (e) {}

  if (typeof setConfig === 'function') {
    try {
      setConfig('SUPABASE_URL', urlFinal);
      setConfig('SUPABASE_KEY', keyFinal);
    } catch (e) {}
  }
  return { ok: true };
}

// ====================================================================
// 🌐 CLIENTE HTTP POSTGREST (MULTI-TENANT SEGURO)
// ====================================================================

function supabaseRequest(endpoint, method, payload, headersExtras) {
  const empId = obterEmpresaId();
  const metodo = (method || 'GET').toUpperCase();
  const tabName = String(endpoint || '').split('?')[0].split('/')[0].trim();
  const usaEmpresaId = TABELAS_MULTI_TENANT.indexOf(tabName) !== -1;

  let finalEndpoint = endpoint;
  if (usaEmpresaId && metodo === 'GET' && finalEndpoint.indexOf('empresa_id=') === -1) {
    finalEndpoint += (finalEndpoint.indexOf('?') !== -1 ? '&' : '?') + `empresa_id=eq.${encodeURIComponent(empId)}`;
  }

  let payloadFinal = payload;
  if (usaEmpresaId && payload && (metodo === 'POST' || metodo === 'PATCH' || metodo === 'PUT')) {
    if (Array.isArray(payload)) {
      payloadFinal = payload.map(item => {
        if (item && typeof item === 'object') {
          return { ...item, empresa_id: item.empresa_id || empId };
        }
        return item;
      });
    } else if (typeof payload === 'object') {
      payloadFinal = { ...payload, empresa_id: payload.empresa_id || empId };
    }
  }

  const url = `${obterSupabaseUrl()}/rest/v1/${finalEndpoint}`;
  const key = obterSupabaseKey();

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Accept: 'application/json'
  };

  if (headersExtras && typeof headersExtras === 'object') {
    Object.keys(headersExtras).forEach(k => {
      headers[k] = headersExtras[k];
    });
  }

  const options = {
    method: metodo,
    headers: headers,
    muteHttpExceptions: true
  };

  if (payloadFinal && (metodo === 'POST' || metodo === 'PATCH' || metodo === 'PUT')) {
    options.payload = JSON.stringify(payloadFinal);
  }

  const response = UrlFetchApp.fetch(url, options);
  const code = response.getResponseCode();
  const text = response.getContentText();

  if (code >= 200 && code < 300) {
    if (!text || text.trim() === '') return { ok: true, status: code };
    try {
      return JSON.parse(text);
    } catch (e) {
      return { ok: true, text: text, status: code };
    }
  }

  console.error(`Erro Supabase [${code}] ${finalEndpoint}:`, text);
  throw new Error(`Falha Supabase (${code}): ${text}`);
}

function supabaseInsert(tabela, payload) {
  const empId = obterEmpresaId();
  const prepararItem = item => {
    if (!item || typeof item !== 'object') return item;
    const copia = { ...item };
    if (tabela !== 'config' && tabela !== 'estoque' && !copia.id) {
      const prefix = String(tabela).slice(0, 3).toUpperCase();
      copia.id = `${prefix}-GAS-${Utilities.getUuid().slice(0, 10).toUpperCase()}`;
    }
    if (TABELAS_MULTI_TENANT.indexOf(tabela) !== -1 && !copia.empresa_id) {
      copia.empresa_id = empId;
    }
    return copia;
  };

  const payloadFinal = Array.isArray(payload) ? payload.map(prepararItem) : prepararItem(payload);
  const conflictCol = tabela === 'config' ? 'chave' : 'id';
  return supabaseRequest(`${tabela}?on_conflict=${conflictCol}`, 'POST', payloadFinal, {
    Prefer: 'resolution=merge-duplicates'
  });
}

function supabaseUpdate(tabela, payload, filtro) {
  const norm = { ...(payload || {}) };
  if (tabela === 'produtos') {
    if (norm.preco !== undefined && norm.preco_venda === undefined) {
      norm.preco_venda = norm.preco;
      delete norm.preco;
    }
    if (norm.custo !== undefined && norm.custo_medio === undefined) {
      norm.custo_medio = norm.custo;
      delete norm.custo;
    }
    if (norm.atualizado_em !== undefined && norm.updated_at === undefined) {
      norm.updated_at = norm.atualizado_em;
      delete norm.atualizado_em;
    }
  }

  const qs = [];
  if (filtro && typeof filtro === 'object') {
    Object.keys(filtro).forEach(k => {
      if (filtro[k] !== undefined && filtro[k] !== null && String(filtro[k]) !== '') {
        qs.push(`${encodeURIComponent(k)}=eq.${encodeURIComponent(String(filtro[k]))}`);
      }
    });
  }
  const empId = obterEmpresaId();
  if (TABELAS_MULTI_TENANT.indexOf(tabela) !== -1 && (!filtro || !filtro.empresa_id)) {
    qs.push(`empresa_id=eq.${encodeURIComponent(empId)}`);
  }

  const endpoint = qs.length > 0 ? `${tabela}?${qs.join('&')}` : tabela;
  return supabaseRequest(endpoint, 'PATCH', norm);
}

function testarConexaoSupabase() {
  try {
    const res = supabaseRequest('produtos?select=count', 'GET', null, {
      'Range-Unit': 'items',
      Prefer: 'count=exact'
    });
    const msg = '✅ Conexão com Supabase (São Paulo) estabelecida com sucesso!';
    console.log(msg, res);
    if (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getActive()) {
      SpreadsheetApp.getUi().alert(msg);
    }
    return { ok: true, msg: msg };
  } catch (err) {
    const errMsg = '❌ Erro ao conectar ao Supabase: ' + err.message;
    console.error(errMsg);
    if (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getActive()) {
      SpreadsheetApp.getUi().alert(errMsg);
    }
    return { ok: false, msg: errMsg };
  }
}

// ====================================================================
// 🔍 CONSULTA RÁPIDA (PRODUTOS, ESTOQUE & USUÁRIOS)
// ====================================================================

function supabaseBuscarProdutos(termo, limite) {
  try {
    const limit = limite || 50;
    let endpoint = `produtos?select=*&order=nome.asc&limit=${limit}`;
    if (termo && termo.trim()) {
      const termoSanitizado = encodeURIComponent(`*${termo.trim()}*`);
      endpoint = `produtos?select=*&nome=ilike.${termoSanitizado}&order=nome.asc&limit=${limit}`;
    }
    const lista = supabaseRequest(endpoint, 'GET');
    return Array.isArray(lista) ? lista : [];
  } catch (e) {
    console.error('Erro em supabaseBuscarProdutos:', e);
    return [];
  }
}

function supabaseObterProdutoPorNome(nome) {
  try {
    if (!nome) return null;
    const nomeEnc = encodeURIComponent(nome.trim());
    const res = supabaseRequest(`produtos?nome=eq.${nomeEnc}&limit=1`, 'GET');
    return Array.isArray(res) && res.length > 0 ? res[0] : null;
  } catch (e) {
    console.error('Erro em supabaseObterProdutoPorNome:', e);
    return null;
  }
}

function supabaseObterMapaEstoque() {
  const mapa = {};
  try {
    // Fonte oficial: produtos.estoque_atual (multi-tenant por empresa_id)
    const dadosProd = supabaseRequest('produtos?select=nome,estoque_atual', 'GET');
    if (Array.isArray(dadosProd) && dadosProd.length > 0) {
      dadosProd.forEach(r => {
        const nome = String(r.nome || '').trim();
        const qtd = Number(r.estoque_atual) || 0;
        if (nome) {
          mapa[nome.toLowerCase()] = qtd;
          mapa[nome.toUpperCase()] = qtd;
          mapa[normalizarTextoChave(nome)] = qtd;
        }
      });
      return mapa;
    }

    // Fallback secundário apenas se produtos estiver vazio
    const dadosEst = supabaseRequest('estoque?select=produto_nome,quantidade', 'GET');
    if (Array.isArray(dadosEst)) {
      dadosEst.forEach(r => {
        const nome = String(r.produto_nome || '').trim();
        const qtd = Number(r.quantidade) || 0;
        if (nome) {
          mapa[nome.toLowerCase()] = qtd;
          mapa[nome.toUpperCase()] = qtd;
          mapa[normalizarTextoChave(nome)] = qtd;
        }
      });
    }
  } catch (e) {
    console.error('Erro em supabaseObterMapaEstoque:', e);
  }
  return mapa;
}

function supabaseAjustarEstoque(produtoNome, novaQtd, status, obs) {
  try {
    const empId = obterEmpresaId();
    const nomeLimpo = String(produtoNome || '').trim();
    if (!nomeLimpo) return { ok: false, msg: 'Nome do produto vazio.' };
    const qtdFinal = Number(novaQtd) || 0;
    const agoraIso = new Date().toISOString();

    // 1. Atualiza tabela oficial produtos (usada pelo Web/App e Telegram)
    const nomeEnc = encodeURIComponent(nomeLimpo);
    supabaseRequest(`produtos?nome=eq.${nomeEnc}&empresa_id=eq.${encodeURIComponent(empId)}`, 'PATCH', {
      estoque_atual: qtdFinal,
      updated_at: agoraIso
    });

    // 2. Espelho secundário não bloqueante na tabela legada estoque
    try {
      supabaseRequest(`estoque?produto_nome=eq.${nomeEnc}`, 'PATCH', {
        quantidade: qtdFinal,
        status: status || (qtdFinal <= 0 ? '🚫 ESGOTADO' : '🟢 OK'),
        observacao: obs || '',
        updated_at: agoraIso
      });
    } catch (eEst) {}

    return { ok: true };
  } catch (e) {
    console.error('Erro em supabaseAjustarEstoque:', e);
    return { ok: false, msg: e.message };
  }
}

function supabaseObterUsuarioPorTelegramChatId(chatId) {
  try {
    if (!chatId) return null;
    const chatIdNorm = String(chatId).trim().split('.')[0];
    const res = supabaseRequest(
      `usuarios?telegram_chat_id=eq.${encodeURIComponent(chatIdNorm)}&ativo=eq.true&limit=1`,
      'GET'
    );
    return Array.isArray(res) && res.length > 0 ? res[0] : null;
  } catch (e) {
    console.error('Erro em supabaseObterUsuarioPorTelegramChatId:', e);
    return null;
  }
}

// ====================================================================
// 🛠️ UTILITÁRIOS DE DATA, DEDUPLICAÇÃO E LAYOUT DA PLANILHA
// ====================================================================

function parseDataSeguraSheet(valor) {
  if (valor instanceof Date && !isNaN(valor.getTime())) return valor;
  if (typeof valor === 'string' && valor.trim()) {
    const txt = valor.trim();
    const mBr = txt.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (mBr) {
      return new Date(
        Number(mBr[3]),
        Number(mBr[2]) - 1,
        Number(mBr[1]),
        Number(mBr[4] || 0),
        Number(mBr[5] || 0),
        Number(mBr[6] || 0)
      );
    }
    const mIsoDate = txt.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (mIsoDate) {
      return new Date(Number(mIsoDate[1]), Number(mIsoDate[2]) - 1, Number(mIsoDate[3]), 12, 0, 0);
    }
    const dt = new Date(txt);
    if (!isNaN(dt.getTime())) return dt;
  }
  return new Date();
}

function normalizarStatusComandaParaSupabase(statusRaw) {
  const st = normalizarTextoChave(statusRaw);
  if (st === 'PAGA' || st === 'PAGO' || st === 'FECHADA' || st === 'QUITADA' || st === 'CONCLUIDA') {
    return 'PAGA';
  }
  if (st === 'CANCELADA' || st === 'CANCELADO') return 'CANCELADA';
  return 'ABERTA';
}

function normalizarStatusDeliveryParaSupabase(statusRaw) {
  const st = normalizarTextoChave(statusRaw);
  if (st === 'PREPARANDO' || st === 'EM PREPARO' || st === 'SEPARANDO') return 'PREPARANDO';
  if (st === 'EM_ROTA' || st === 'EM ROTA' || st === 'SAIU PARA ENTREGA' || st === 'DESPACHADO') {
    return 'EM_ROTA';
  }
  if (st === 'ENTREGUE' || st === 'FINALIZADO' || st === 'CONCLUIDO' || st === 'PAGO') {
    return 'ENTREGUE';
  }
  if (st === 'CANCELADO' || st === 'CANCELADA') return 'CANCELADO';
  return 'PENDENTE';
}

function normalizarStatusDeliveryParaPlanilha(statusSupa) {
  const st = String(statusSupa || '').toUpperCase().trim();
  if (st === 'PREPARANDO') return 'PREPARANDO';
  if (st === 'EM_ROTA') return 'EM ROTA';
  if (st === 'ENTREGUE') return 'ENTREGUE';
  if (st === 'CANCELADO') return 'CANCELADO';
  return 'PENDENTE';
}

function carregarConjuntoIdsSincronizados(propKey) {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty(propKey);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr.map(String));
    }
  } catch (e) {}
  return new Set();
}

function salvarConjuntoIdsSincronizados(propKey, setIds) {
  try {
    const arr = Array.from(setIds).slice(-600);
    PropertiesService.getScriptProperties().setProperty(propKey, JSON.stringify(arr));
  } catch (e) {}
}

function inserirLinhaNoTopoPlanilha(sh, dados) {
  if (!sh || !dados || !dados.length) return;
  if (typeof inserirLinhaPadronizadaNoTopo === 'function') {
    inserirLinhaPadronizadaNoTopo(sh, dados);
    return;
  }
  sh.insertRowBefore(2);
  sh.getRange(2, 1, 1, dados.length)
    .setValues([dados])
    .setBackground('#ffffff')
    .setFontColor('#000000')
    .setFontWeight('normal');
}

function obterMapaExistentePorTabela(tabela, campos, chaveFn) {
  const mapa = {};
  try {
    const lista = supabaseRequest(`${tabela}?select=${campos}`, 'GET');
    if (Array.isArray(lista)) {
      lista.forEach(item => {
        const k = chaveFn(item);
        if (k) mapa[k] = item;
      });
    }
  } catch (e) {}
  return mapa;
}

function obterFilaIdsPorChave(tabela, campos, chaveFn) {
  const fila = {};
  try {
    const lista = supabaseRequest(`${tabela}?select=${campos}`, 'GET');
    if (Array.isArray(lista)) {
      lista.forEach(item => {
        const k = chaveFn(item);
        if (!k || !item.id) return;
        if (!fila[k]) fila[k] = [];
        fila[k].push(String(item.id));
      });
    }
  } catch (e) {}
  return fila;
}

function pegarProximoIdFila(fila, chave, idsUsadosSet) {
  const arr = fila && fila[chave];
  if (!arr || arr.length === 0) return null;
  while (arr.length > 0) {
    const cand = arr.shift();
    if (cand && (!idsUsadosSet || !idsUsadosSet.has(cand))) {
      if (idsUsadosSet) idsUsadosSet.add(cand);
      return cand;
    }
  }
  return null;
}

// ====================================================================
// 🚀 MIGRAÇÃO / PUSH COMPLETO (PLANILHA ➔ SUPABASE)
// ====================================================================

function migrarTudoPlanilhaParaSupabase(silencioso) {
  const lock = LockService.getScriptLock();
  const acquired = lock.tryLock(25000);
  if (!acquired) {
    return { ok: false, msg: 'Outra sincronização já está em execução no momento.' };
  }

  try {
    const ss = SpreadsheetApp.getActive();
    const empId = obterEmpresaId();
    const grpId = obterGrupoId();
    const webAppUrl = obterWebAppSyncUrl();

    const resumo = {
      config: 0,
      produtos: 0,
      clientes: 0,
      usuarios: 0,
      vendas: 0,
      caixa: 0,
      comandas: 0,
      comandaItens: 0,
      delivery: 0,
      deliveryItens: 0,
      contasPagar: 0,
      contasReceber: 0,
      compras: 0
    };

    // Cache de IDs existentes no Supabase para evitar duplicação e reaproveitar PKs
    const prodSupaPorNome = obterMapaExistentePorTabela('produtos', 'id,nome', p => normalizarTextoChave(p.nome));
    const cliSupaPorNome = obterMapaExistentePorTabela('clientes', 'id,nome', c => normalizarTextoChave(c.nome));
    const cmdSupaPorPedido = obterMapaExistentePorTabela('comandas', 'id,pedido,operador,pago,saldo', c => String(c.pedido || '').trim());
    const delSupaPorPedido = obterMapaExistentePorTabela('delivery', 'id,pedido', d => String(d.pedido || '').trim());

    const filaCmdItens = obterFilaIdsPorChave(
      'comanda_itens',
      'id,comanda_id,produto_nome,quantidade,subtotal',
      it => `${String(it.comanda_id || '')}|${normalizarTextoChave(it.produto_nome)}|${Number(it.quantidade) || 0}|${(Number(it.subtotal) || 0).toFixed(2)}`
    );
    const filaDelItens = obterFilaIdsPorChave(
      'delivery_itens',
      'id,delivery_id,produto_nome,quantidade,subtotal',
      it => `${String(it.delivery_id || '')}|${normalizarTextoChave(it.produto_nome)}|${Number(it.quantidade) || 0}|${(Number(it.subtotal) || 0).toFixed(2)}`
    );
    const mapaVendasPorId = {};
    const filaVendas = obterFilaIdsPorChave(
      'vendas',
      'id,data_hora,produto_nome,quantidade,valor_total,pedido_id,cliente_nome,vendedor',
      v => {
        if (v && v.id) mapaVendasPorId[String(v.id)] = v;
        const ymd = Utilities.formatDate(parseDataSeguraSheet(v.data_hora), 'America/Sao_Paulo', 'yyyy-MM-dd');
        return `${ymd}|${normalizarTextoChave(v.produto_nome)}|${Number(v.quantidade) || 1}|${(Number(v.valor_total) || 0).toFixed(2)}`;
      }
    );
    const filaCaixa = obterFilaIdsPorChave(
      'caixa',
      'id,data_hora,tipo,valor,forma_pagamento,descricao,origem',
      c => {
        const ymd = Utilities.formatDate(parseDataSeguraSheet(c.data_hora), 'America/Sao_Paulo', 'yyyy-MM-dd');
        const t = String(c.tipo || '').toUpperCase() === 'ENTRADA' ? 'ENTRADA' : 'SAIDA';
        return `${ymd}|${t}|${(Number(c.valor) || 0).toFixed(2)}|${normalizarTextoChave(c.forma_pagamento || 'DINHEIRO')}|${normalizarTextoChave(c.descricao || c.origem)}`;
      }
    );
    const filaCompras = obterFilaIdsPorChave(
      'compras',
      'id,data_hora,produto_nome,quantidade,valor_total',
      c => {
        const ymd = Utilities.formatDate(parseDataSeguraSheet(c.data_hora), 'America/Sao_Paulo', 'yyyy-MM-dd');
        return `${ymd}|${normalizarTextoChave(c.produto_nome)}|${Number(c.quantidade) || 1}|${(Number(c.valor_total) || 0).toFixed(2)}`;
      }
    );

    const usrSupaLista = (function () {
      try {
        const u = supabaseRequest('usuarios?select=id,username,nome,email,perfil,senha_hash', 'GET');
        return Array.isArray(u) ? u : [];
      } catch (e) {
        return [];
      }
    })();

    // ------------------------------------------------------------------
    // 1. CONFIG + EMPRESAS
    // ------------------------------------------------------------------
    const cfgSheetMap = {};
    const shConfig = ss.getSheetByName('CONFIG');
    if (shConfig && shConfig.getLastRow() > 1) {
      const dadosCfg = shConfig.getDataRange().getValues();
      const rowsCfg = [];
      const chavesVistas = new Set();

      for (let i = 1; i < dadosCfg.length; i++) {
        const chave = String(dadosCfg[i][0] || '').trim().toUpperCase();
        if (!chave || chavesVistas.has(chave)) continue;
        chavesVistas.add(chave);
        const val = String(dadosCfg[i][1] !== undefined && dadosCfg[i][1] !== null ? dadosCfg[i][1] : '').trim();
        cfgSheetMap[chave] = val;
        rowsCfg.push({
          chave: chave,
          valor: val,
          descricao: String(dadosCfg[i][2] || '').trim(),
          updated_at: new Date().toISOString()
        });
      }

      if (!chavesVistas.has('SPREADSHEET_URL')) {
        rowsCfg.push({
          chave: 'SPREADSHEET_URL',
          valor: ss.getUrl(),
          descricao: 'Planilha Google Oficial conectada',
          updated_at: new Date().toISOString()
        });
      }
      if (!chavesVistas.has('WEBAPP_URL')) {
        rowsCfg.push({
          chave: 'WEBAPP_URL',
          valor: webAppUrl,
          descricao: 'Bridge Apps Script Bidirecional & Telegram Webhook',
          updated_at: new Date().toISOString()
        });
      }

      if (rowsCfg.length > 0) {
        supabaseRequest('config?on_conflict=chave', 'POST', rowsCfg, {
          Prefer: 'resolution=merge-duplicates'
        });
        resumo.config = rowsCfg.length;
      }

      // Espelha os dados oficiais diretamente na tabela empresas
      const patchEmpresa = {
        planilha_espelho_id: ss.getId(),
        updated_at: new Date().toISOString()
      };
      if (cfgSheetMap.NOME_DEPOSITO) patchEmpresa.nome = cfgSheetMap.NOME_DEPOSITO;
      if (cfgSheetMap.DONO) patchEmpresa.dono_nome = cfgSheetMap.DONO;
      if (cfgSheetMap.CNPJ) patchEmpresa.cnpj = cfgSheetMap.CNPJ;
      if (cfgSheetMap.TELEFONE) patchEmpresa.telefone = cfgSheetMap.TELEFONE;
      if (cfgSheetMap.CIDADE) patchEmpresa.cidade = cfgSheetMap.CIDADE;
      if (cfgSheetMap.CHAVE_PIX) patchEmpresa.chave_pix = cfgSheetMap.CHAVE_PIX;
      if (cfgSheetMap.TELEGRAM_BOT_TOKEN) patchEmpresa.telegram_bot_token = cfgSheetMap.TELEGRAM_BOT_TOKEN;
      if (cfgSheetMap.TELEGRAM_DONO_CHAT_ID) patchEmpresa.telegram_chat_id = String(cfgSheetMap.TELEGRAM_DONO_CHAT_ID).split('.')[0];

      try {
        supabaseRequest(`empresas?id=eq.${encodeURIComponent(empId)}`, 'PATCH', patchEmpresa);
      } catch (eEmp) {
        console.warn('Aviso ao atualizar empresas:', eEmp.message);
      }
    }

    // ------------------------------------------------------------------
    // 2. PRODUTOS + ESTOQUE REAL
    // ------------------------------------------------------------------
    const mapaEstoqueSheet = {};
    const shEst = ss.getSheetByName('ESTOQUE');
    if (shEst && shEst.getLastRow() > 1) {
      const dadosEst = shEst.getDataRange().getValues();
      for (let i = 1; i < dadosEst.length; i++) {
        const prodNome = String(dadosEst[i][0] || '').trim();
        if (!prodNome) continue;
        const key = normalizarTextoChave(prodNome);
        const qtd = limparNumero(dadosEst[i][1]);
        const min = limparNumero(dadosEst[i][2]);
        const statusEst = String(dadosEst[i][3] || '').trim();
        const obsEst = String(dadosEst[i][4] || '').trim();
        if (!mapaEstoqueSheet[key]) {
          mapaEstoqueSheet[key] = {
            produto_nome: prodNome,
            quantidade: qtd,
            estoque_minimo: min,
            status: statusEst,
            observacao: obsEst
          };
        } else {
          mapaEstoqueSheet[key].quantidade += qtd;
        }
      }
    }

    const prodIdPorNomeFinal = {};
    const shProd = ss.getSheetByName('PRODUTOS');
    if (shProd && shProd.getLastRow() > 1) {
      const dadosProd = shProd.getDataRange().getValues();
      const rowsProd = [];
      const idsUsados = new Set();

      for (let i = 1; i < dadosProd.length; i++) {
        const nome = String(dadosProd[i][0] || '').trim();
        if (!nome) continue;
        const nomeKey = normalizarTextoChave(nome);
        let idProd = String(dadosProd[i][10] || '').trim();
        if (!idProd && prodSupaPorNome[nomeKey]) {
          idProd = String(prodSupaPorNome[nomeKey].id);
        }
        if (!idProd || idsUsados.has(idProd)) {
          idProd = prodSupaPorNome[nomeKey] ? String(prodSupaPorNome[nomeKey].id) : `PRD-${String(i).padStart(4, '0')}`;
        }
        if (idsUsados.has(idProd)) {
          idProd = gerarIdDeterministico('PRD', nomeKey + '_' + i);
        }
        idsUsados.add(idProd);
        prodIdPorNomeFinal[nomeKey] = idProd;

        const estSheet = mapaEstoqueSheet[nomeKey];
        const qtdFinal = estSheet ? estSheet.quantidade : limparNumero(dadosProd[i][11]);
        const custo = limparNumero(dadosProd[i][6]);
        const preco = limparNumero(dadosProd[i][4]);
        const minEst = limparNumero(dadosProd[i][5]) || (estSheet ? estSheet.estoque_minimo : 5);
        let margemRaw = limparNumero(dadosProd[i][7]);
        if (margemRaw > 0 && margemRaw < 2 && custo > 0 && Math.abs((preco - custo) / custo - margemRaw) < 0.05) {
          margemRaw = Number((margemRaw * 100).toFixed(2));
        }

        rowsProd.push({
          id: idProd,
          empresa_id: empId,
          nome: nome,
          categoria: String(dadosProd[i][1] || 'Geral').trim(),
          marca: String(dadosProd[i][2] || '').trim(),
          volume: String(dadosProd[i][3] || '').trim(),
          preco_venda: preco,
          estoque_minimo: minEst,
          custo_medio: custo,
          margem_pct: margemRaw,
          preco_sugerido: limparNumero(dadosProd[i][8]),
          status_margem: String(dadosProd[i][9] || '🟢 OK').trim(),
          estoque_atual: qtdFinal,
          ativo: true,
          updated_at: new Date().toISOString()
        });
      }

      if (rowsProd.length > 0) {
        for (let b = 0; b < rowsProd.length; b += 100) {
          supabaseRequest('produtos?on_conflict=id', 'POST', rowsProd.slice(b, b + 100), {
            Prefer: 'resolution=merge-duplicates'
          });
        }
        resumo.produtos = rowsProd.length;
      }
    }

    // ------------------------------------------------------------------
    // 3. CLIENTES (COM ID OBRIGATÓRIO — RESOLVE ERRO 23502)
    // ------------------------------------------------------------------
    const shCli = ss.getSheetByName('CLIENTES');
    if (shCli && shCli.getLastRow() > 1) {
      const cliSupaTodos = supabaseRequest('clientes?select=id,nome,telefone&empresa_id=eq.' + encodeURIComponent(empId), 'GET') || [];
      const cliSupaPorTel = {};
      if (Array.isArray(cliSupaTodos)) {
        cliSupaTodos.forEach(c => {
          const td = String(c.telefone || '').replace(/\D/g, '');
          if (td && !cliSupaPorTel[td]) cliSupaPorTel[td] = c;
        });
      }

      const dCli = shCli.getDataRange().getValues();
      const hdrCli = dCli[0].map(h => String(h || '').toUpperCase().trim());
      let idxNome = hdrCli.findIndex(h => h.includes('NOME') || h.includes('CLIENTE'));
      if (idxNome === -1) idxNome = 0;
      let idxTel = hdrCli.findIndex(h => h.includes('TEL') || h.includes('FONE') || h.includes('WHATS'));
      if (idxTel === -1) idxTel = 1;
      let idxEnd = hdrCli.findIndex(h => h.includes('END'));
      if (idxEnd === -1) idxEnd = 2;
      const idxLim = hdrCli.findIndex(h => h.includes('LIMITE'));
      const idxDeb = hdrCli.findIndex(h => h.includes('SALDO') || h.includes('DEVEDOR'));
      const idxStat = hdrCli.findIndex(h => h.includes('STATUS'));
      const idxObs = hdrCli.findIndex(h => h.includes('OBS'));
      const idxRef = hdrCli.findIndex(h => h.includes('REF'));

      const mapaCli = {};
      for (let i = 1; i < dCli.length; i++) {
        const r = dCli[i];
        const nomeCli = String(r[idxNome] || '').trim();
        if (!nomeCli) continue;
        const nomeKey = normalizarTextoChave(nomeCli);
        const telDigitos = String(r[idxTel] || '').replace(/\D/g, '');
        const existente = cliSupaPorNome[nomeKey] || (telDigitos ? cliSupaPorTel[telDigitos] : null);
        const idCli = existente && existente.id ? String(existente.id) : gerarIdDeterministico('CLI', nomeKey);

        const obsParts = [];
        if (idxRef !== -1 && r[idxRef]) obsParts.push(`Ref: ${String(r[idxRef]).trim()}`);
        if (idxObs !== -1 && r[idxObs]) obsParts.push(String(r[idxObs]).trim());
        else if (idxLim === -1 && r[4]) obsParts.push(String(r[4]).trim());

        mapaCli[nomeKey] = {
          id: idCli,
          empresa_id: empId,
          nome: nomeCli,
          telefone: String(r[idxTel] || '').trim(),
          endereco: String(r[idxEnd] || '').trim(),
          limite_fiado: idxLim !== -1 ? limparNumero(r[idxLim]) : 0,
          saldo_devedor: idxDeb !== -1 ? limparNumero(r[idxDeb]) : 0,
          status: idxStat !== -1 && r[idxStat] ? String(r[idxStat]).trim().toUpperCase() : 'ATIVO',
          observacao: obsParts.join(' | '),
          updated_at: new Date().toISOString()
        };
      }

      const rowsCli = Object.values(mapaCli);
      if (rowsCli.length > 0) {
        for (let b = 0; b < rowsCli.length; b += 100) {
          supabaseRequest('clientes?on_conflict=id', 'POST', rowsCli.slice(b, b + 100), {
            Prefer: 'resolution=merge-duplicates'
          });
        }
        resumo.clientes = rowsCli.length;
      }
    }

    // ------------------------------------------------------------------
    // 4. USUARIOS (RESPEITA ADMIN TÉCNICO ÚNICO & UNIQUE(empresa_id, username))
    // ------------------------------------------------------------------
    const shUser = ss.getSheetByName('USUARIOS');
    if (shUser && shUser.getLastRow() > 1) {
      const dadosUser = shUser.getDataRange().getValues();
      const rowsUser = [];
      const usernamesUsados = new Set();
      usrSupaLista.forEach(u => {
        if (u.username) usernamesUsados.add(String(u.username).toLowerCase());
      });

      const usrPorId = {};
      usrSupaLista.forEach(u => {
        usrPorId[String(u.id)] = u;
      });

      for (let i = 1; i < dadosUser.length; i++) {
        const uId = String(dadosUser[i][0] || '').trim();
        if (!uId || uId === 'U-ADMIN-01') continue;

        const nomeU = String(dadosUser[i][1] || uId).trim();
        const emailU = String(dadosUser[i][2] || '').trim().toLowerCase();
        const hashU = String(dadosUser[i][3] || '').trim();
        let perfilU = String(dadosUser[i][4] || 'VENDEDOR').toUpperCase().trim();
        if (perfilU === 'ADMIN') perfilU = 'DONO';
        if (perfilU === 'GERENCIAL') perfilU = 'GERENTE';
        if (['DONO', 'GERENTE', 'VENDEDOR'].indexOf(perfilU) === -1) perfilU = 'VENDEDOR';

        const ativoRaw = String(dadosUser[i][5] || 'SIM').toUpperCase().trim();
        const ativoU = ativoRaw === 'SIM' || ativoRaw === 'TRUE' || ativoRaw === 'ATIVO';
        const chatIdU = String(dadosUser[i][8] || '').trim().split('.')[0];

        const supaExist = usrPorId[uId];
        const supaUsername = supaExist && supaExist.username ? String(supaExist.username).trim() : '';
        const isGenericUsername = !supaUsername || supaUsername.toUpperCase() === uId.toUpperCase();
        let usernameFinal = !isGenericUsername ? supaUsername : '';
        if (!usernameFinal) {
          let base = nomeU
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9._-]/g, '') || (emailU && emailU.split('@')[0]) || uId.toLowerCase();
          if (base === 'admin') base = uId.toLowerCase();
          usernameFinal = base;
          if (usernamesUsados.has(usernameFinal.toLowerCase())) {
            usernameFinal = (emailU && emailU.split('@')[0]) || uId.toLowerCase();
          }
          if (usernamesUsados.has(usernameFinal.toLowerCase())) {
            usernameFinal = uId.toLowerCase();
          }
        }
        usernamesUsados.add(usernameFinal.toLowerCase());

        // Preserva senha_hash mais recente alterada no Painel Web/App se for um hash SHA-256 válido
        const supaHash = supaExist && supaExist.senha_hash ? String(supaExist.senha_hash).trim() : '';
        const senhaHashFinal =
          supaHash && supaHash.length === 64
            ? supaHash
            : hashU || supaHash || '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9';

        rowsUser.push({
          id: uId,
          empresa_id: empId,
          grupo_id: grpId,
          username: usernameFinal,
          nome: nomeU,
          email: emailU,
          senha_hash: senhaHashFinal,
          perfil: perfilU,
          ativo: ativoU,
          telegram_chat_id: chatIdU
        });
      }

      if (rowsUser.length > 0) {
        supabaseRequest('usuarios?on_conflict=id', 'POST', rowsUser, {
          Prefer: 'resolution=merge-duplicates'
        });
        resumo.usuarios = rowsUser.length;
      }
    }

    // ------------------------------------------------------------------
    // 5. VENDAS (HISTÓRICO DA PLANILHA SEM DUPLICIDADE POR LINHA)
    // ------------------------------------------------------------------
    const shVendas = ss.getSheetByName('VENDAS');
    if (shVendas && shVendas.getLastRow() > 1) {
      const dadosV = shVendas.getDataRange().getValues();
      const rowsV = [];
      const idsVUsados = new Set();
      const occV = {};

      for (let i = 1; i < dadosV.length; i++) {
        const prodNome = String(dadosV[i][1] || '').trim();
        if (!prodNome) continue;
        const dt = parseDataSeguraSheet(dadosV[i][0]);
        const ymd = Utilities.formatDate(dt, 'America/Sao_Paulo', 'yyyy-MM-dd');
        const qtd = limparNumero(dadosV[i][2]) || 1;
        const vTotal = limparNumero(dadosV[i][3]);
        const fp = `${ymd}|${normalizarTextoChave(prodNome)}|${qtd}|${vTotal.toFixed(2)}`;
        occV[fp] = (occV[fp] || 0) + 1;

        let idVenda = pegarProximoIdFila(filaVendas, fp, idsVUsados);
        if (!idVenda) {
          idVenda = gerarIdDeterministico('VN-SH', `${fp}#${occV[fp]}`);
          while (idsVUsados.has(idVenda)) {
            occV[fp] += 1;
            idVenda = gerarIdDeterministico('VN-SH', `${fp}#${occV[fp]}`);
          }
          idsVUsados.add(idVenda);
        }

        const vExist = mapaVendasPorId[idVenda];
        const col7 = String(dadosV[i][6] || '').trim();
        const origStr = String(dadosV[i][5] || 'Balcão').trim();
        let pedidoIdFinal = vExist && vExist.pedido_id ? String(vExist.pedido_id) : null;
        if (!pedidoIdFinal && col7) {
          const mCmd = col7.match(/^(?:C-0*|D-0*|#)?(\d+)$/i);
          if (mCmd) {
            pedidoIdFinal = String(Number(mCmd[1]));
          } else if (col7.startsWith('VND-')) {
            pedidoIdFinal = col7;
          }
        }

        rowsV.push({
          id: idVenda,
          empresa_id: empId,
          data_hora: dt.toISOString(),
          produto_id: prodIdPorNomeFinal[normalizarTextoChave(prodNome)] || null,
          produto_nome: prodNome,
          quantidade: qtd,
          valor_unitario: qtd > 0 ? Number((vTotal / qtd).toFixed(2)) : vTotal,
          valor_total: vTotal,
          forma_pagamento: String(dadosV[i][4] || 'Dinheiro').trim(),
          origem: origStr,
          pedido_id: pedidoIdFinal,
          cliente_nome: vExist && vExist.cliente_nome ? String(vExist.cliente_nome) : null,
          vendedor: vExist && vExist.vendedor ? String(vExist.vendedor) : col7
        });
      }
      for (let b = 0; b < rowsV.length; b += 100) {
        supabaseRequest('vendas?on_conflict=id', 'POST', rowsV.slice(b, b + 100), {
          Prefer: 'resolution=merge-duplicates'
        });
      }
      // Remove duplicatas órfãs de vendas que não existem mais na planilha
      Object.keys(filaVendas).forEach(k => {
        const sobras = filaVendas[k] || [];
        sobras.forEach(idOrfao => {
          if (idOrfao && !idsVUsados.has(idOrfao)) {
            try {
              supabaseRequest(`vendas?id=eq.${encodeURIComponent(idOrfao)}`, 'DELETE');
            } catch (eDelV) {}
          }
        });
      });
      resumo.vendas = rowsV.length;
    }

    // ------------------------------------------------------------------
    // 6. CAIXA (HISTÓRICO DA PLANILHA + MAPA DE PAGOS COMANDA)
    // ------------------------------------------------------------------
    const mapaPagosComanda = {};
    const shCaixa = ss.getSheetByName('CAIXA');
    if (shCaixa && shCaixa.getLastRow() > 1) {
      const dadosC = shCaixa.getDataRange().getValues();
      const rowsC = [];
      const idsCUsados = new Set();
      const occC = {};

      for (let i = 1; i < dadosC.length; i++) {
        const tipoRaw = normalizarTextoChave(dadosC[i][1]);
        if (!tipoRaw) continue;
        const dt = parseDataSeguraSheet(dadosC[i][0]);
        const ymd = Utilities.formatDate(dt, 'America/Sao_Paulo', 'yyyy-MM-dd');
        const tipoNorm = tipoRaw === 'ENTRADA' ? 'ENTRADA' : 'SAIDA';
        const val = limparNumero(dadosC[i][2]);
        const origem = String(dadosC[i][4] || 'Balcão').trim();
        const desc = String(dadosC[i][5] || '').trim();

        if (tipoNorm === 'ENTRADA') {
          const textoComanda = `${origem} ${desc}`.toUpperCase();
          if (textoComanda.includes('COMANDA')) {
            const matches = textoComanda.match(/#?(\d+)/g);
            if (matches) {
              matches.forEach(m => {
                const num = m.replace('#', '');
                mapaPagosComanda[num] = (mapaPagosComanda[num] || 0) + val;
              });
            }
          }
        }

        const formaCx = String(dadosC[i][3] || 'Dinheiro').trim();
        const fp = `${ymd}|${tipoNorm}|${val.toFixed(2)}|${normalizarTextoChave(formaCx)}|${normalizarTextoChave(desc || origem)}`;
        occC[fp] = (occC[fp] || 0) + 1;

        let idCx = pegarProximoIdFila(filaCaixa, fp, idsCUsados);
        if (!idCx) {
          idCx = gerarIdDeterministico('CX-SH', `${fp}#${occC[fp]}`);
          while (idsCUsados.has(idCx)) {
            occC[fp] += 1;
            idCx = gerarIdDeterministico('CX-SH', `${fp}#${occC[fp]}`);
          }
          idsCUsados.add(idCx);
        }

        rowsC.push({
          id: idCx,
          empresa_id: empId,
          data_hora: dt.toISOString(),
          tipo: tipoNorm,
          valor: val,
          forma_pagamento: formaCx,
          origem: origem,
          descricao: desc || origem
        });
      }
      for (let b = 0; b < rowsC.length; b += 100) {
        supabaseRequest('caixa?on_conflict=id', 'POST', rowsC.slice(b, b + 100), {
          Prefer: 'resolution=merge-duplicates'
        });
      }
      // Remove duplicatas órfãs de caixa que não existem mais na planilha
      Object.keys(filaCaixa).forEach(k => {
        const sobras = filaCaixa[k] || [];
        sobras.forEach(idOrfao => {
          if (idOrfao && !idsCUsados.has(idOrfao)) {
            try {
              supabaseRequest(`caixa?id=eq.${encodeURIComponent(idOrfao)}`, 'DELETE');
            } catch (eDelCx) {}
          }
        });
      });
      resumo.caixa = rowsC.length;
    }

    // ------------------------------------------------------------------
    // 7. COMANDAS + COMANDA_ITENS (REAPROVEITA IDs PARA ZERO DUPLICIDADE)
    // ------------------------------------------------------------------
    const itensPorPedido = {};
    const shComItens = ss.getSheetByName('COMANDA_ITENS');
    if (shComItens && shComItens.getLastRow() > 1) {
      const dItens = shComItens.getDataRange().getValues();
      for (let i = 1; i < dItens.length; i++) {
        const pedido = String(dItens[i][0] || '').trim();
        const prod = String(dItens[i][1] || '').trim();
        if (!pedido || !prod) continue;
        const qtd = limparNumero(dItens[i][2]) || 1;
        const unit = limparNumero(dItens[i][3]);
        const totalIt = limparNumero(dItens[i][4]) || Number((qtd * unit).toFixed(2));
        if (!itensPorPedido[pedido]) itensPorPedido[pedido] = [];
        itensPorPedido[pedido].push({
          produto: prod,
          qtd: qtd,
          unit: unit,
          subtotal: totalIt
        });
      }
    }

    const shComandas = ss.getSheetByName('COMANDAS');
    if (shComandas && shComandas.getLastRow() > 1) {
      const dCom = shComandas.getDataRange().getValues();
      const mapaComandas = {};
      const rowsComItens = [];
      const idsCmiUsados = new Set();

      for (let i = 1; i < dCom.length; i++) {
        const pedido = String(dCom[i][0] || '').trim();
        if (!pedido) continue;
        const dtAbertura = parseDataSeguraSheet(dCom[i][1]);
        const cliente = String(dCom[i][2] || 'Balcão').trim();
        const origemSheet = String(dCom[i][3] || 'BALCAO').trim();
        const stNorm = normalizarStatusComandaParaSupabase(dCom[i][4]);

        const cmdExist = cmdSupaPorPedido[pedido];
        const pedidoLimpo = pedido.replace(/[^A-Za-z0-9_-]/g, '');
        const cmdId = cmdExist && cmdExist.id ? String(cmdExist.id) : `CMD-SHEET-${pedidoLimpo || i}`;
        const operadorSupa = (cmdExist && cmdExist.operador) ? String(cmdExist.operador) : origemSheet;

        const listaItens = itensPorPedido[pedido] || [];
        const totalCmd = Number(
          listaItens.reduce((acc, it) => acc + Number(it.subtotal || 0), 0).toFixed(2)
        );
        const pedNum = pedido.replace(/\D/g, '');
        const pagoSheet = Number(mapaPagosComanda[pedNum] || 0);
        const pagoSupa = cmdExist && cmdExist.pago !== undefined ? Number(cmdExist.pago || 0) : 0;
        let pagoCmd = stNorm === 'PAGA' ? totalCmd : Math.max(pagoSheet, pagoSupa);
        if (pagoCmd > totalCmd && totalCmd > 0) pagoCmd = totalCmd;
        const saldoCmd = stNorm === 'PAGA' ? 0 : Math.max(0, Number((totalCmd - pagoCmd).toFixed(2)));

        mapaComandas[pedido] = {
          id: cmdId,
          empresa_id: empId,
          pedido: pedido,
          cliente: cliente,
          status: stNorm,
          data_abertura: dtAbertura.toISOString(),
          data_fechamento: stNorm === 'PAGA' ? new Date().toISOString() : null,
          total: totalCmd,
          pago: pagoCmd,
          saldo: saldoCmd,
          operador: operadorSupa,
          updated_at: new Date().toISOString()
        };
      }

      const rowsCom = Object.values(mapaComandas);
      if (rowsCom.length > 0) {
        for (let b = 0; b < rowsCom.length; b += 100) {
          supabaseRequest('comandas?on_conflict=id', 'POST', rowsCom.slice(b, b + 100), {
            Prefer: 'resolution=merge-duplicates'
          });
        }
        resumo.comandas = rowsCom.length;

        rowsCom.forEach(cmd => {
          const its = itensPorPedido[cmd.pedido] || [];
          const pedidoLimpo = cmd.pedido.replace(/[^A-Za-z0-9_-]/g, '');
          its.forEach((it, idx) => {
            const chaveItem = `${cmd.id}|${normalizarTextoChave(it.produto)}|${Number(it.qtd) || 0}|${(Number(it.subtotal) || 0).toFixed(2)}`;
            let itemId = pegarProximoIdFila(filaCmdItens, chaveItem, idsCmiUsados);
            if (!itemId) {
              itemId = `CMI-SHEET-${pedidoLimpo || cmd.id}-${idx + 1}`;
              let seq = idx + 1;
              while (idsCmiUsados.has(itemId)) {
                seq++;
                itemId = `CMI-SHEET-${pedidoLimpo || cmd.id}-${seq}`;
              }
              idsCmiUsados.add(itemId);
            }

            rowsComItens.push({
              id: itemId,
              empresa_id: empId,
              comanda_id: cmd.id,
              pedido: cmd.pedido,
              produto_id: prodIdPorNomeFinal[normalizarTextoChave(it.produto)] || null,
              produto_nome: it.produto,
              quantidade: it.qtd,
              preco_unitario: it.unit,
              subtotal: it.subtotal,
              hora: cmd.data_abertura
            });
          });
        });

        if (rowsComItens.length > 0) {
          for (let b = 0; b < rowsComItens.length; b += 100) {
            supabaseRequest('comanda_itens?on_conflict=id', 'POST', rowsComItens.slice(b, b + 100), {
              Prefer: 'resolution=merge-duplicates'
            });
          }
          resumo.comandaItens = rowsComItens.length;
        }

        // Remove do Supabase quaisquer itens órfãos que foram excluídos da planilha
        try {
          const todosCmiSupa = supabaseRequest('comanda_itens?select=id', 'GET');
          if (Array.isArray(todosCmiSupa)) {
            todosCmiSupa.forEach(row => {
              if (row && row.id && !idsCmiUsados.has(String(row.id))) {
                supabaseRequest(`comanda_itens?id=eq.${encodeURIComponent(String(row.id))}`, 'DELETE');
              }
            });
          }
        } catch (eDelCmi) {}
      }
    }

    // ------------------------------------------------------------------
    // 8. DELIVERY + DELIVERY_ITENS
    // ------------------------------------------------------------------
    const delItensPorPedido = {};
    const shDelItens = ss.getSheetByName('DELIVERY_ITENS');
    if (shDelItens && shDelItens.getLastRow() > 1) {
      const dDelIt = shDelItens.getDataRange().getValues();
      for (let i = 1; i < dDelIt.length; i++) {
        const pedido = String(dDelIt[i][0] || '').trim();
        const prod = String(dDelIt[i][1] || '').trim();
        if (!pedido || !prod) continue;
        const qtd = limparNumero(dDelIt[i][2]) || 1;
        const unit = limparNumero(dDelIt[i][3]);
        const sub = limparNumero(dDelIt[i][4]) || Number((qtd * unit).toFixed(2));
        if (!delItensPorPedido[pedido]) delItensPorPedido[pedido] = [];
        delItensPorPedido[pedido].push({
          produto: prod,
          qtd: qtd,
          unit: unit,
          subtotal: sub
        });
      }
    }

    const shDelivery = ss.getSheetByName('DELIVERY');
    if (shDelivery && shDelivery.getLastRow() > 1) {
      const dDel = shDelivery.getDataRange().getValues();
      const mapaDel = {};
      const rowsDelItens = [];

      for (let i = 1; i < dDel.length; i++) {
        const pedido = String(dDel[i][0] || '').trim();
        if (!pedido) continue;
        const dtDel = parseDataSeguraSheet(dDel[i][1]);
        const cliente = String(dDel[i][2] || 'Consumidor').trim();
        const prodResumo = String(dDel[i][3] || '').trim();
        const qtdResumo = limparNumero(dDel[i][4]) || 1;
        const totalDel = limparNumero(dDel[i][5]);
        const forma = String(dDel[i][6] || 'PIX').trim();
        const stDel = normalizarStatusDeliveryParaSupabase(dDel[i][7]);
        const entregador = String(dDel[i][8] || '').trim();
        const endereco = String(dDel[i][9] || '').trim();
        const idColK = String(dDel[i][10] || '').trim();

        const delExist = delSupaPorPedido[pedido];
        const pedidoLimpo = pedido.replace(/[^A-Za-z0-9_-]/g, '');
        const delId =
          (delExist && delExist.id ? String(delExist.id) : '') ||
          idColK ||
          `DEL-SHEET-${pedidoLimpo || i}`;

        mapaDel[pedido] = {
          id: delId,
          empresa_id: empId,
          pedido: pedido,
          cliente: cliente,
          telefone: '',
          endereco: endereco,
          status: stDel,
          valor_produtos: totalDel,
          taxa_entrega: 0,
          total: totalDel,
          forma_pagamento: forma,
          entregador: entregador,
          observacoes: prodResumo ? `${qtdResumo}x ${prodResumo}` : '',
          data_hora: dtDel.toISOString(),
          updated_at: new Date().toISOString(),
          _prodFallback: prodResumo,
          _qtdFallback: qtdResumo
        };
      }

      const listaDel = Object.values(mapaDel);
      if (listaDel.length > 0) {
        const rowsDel = listaDel.map(d => {
          const copia = { ...d };
          delete copia._prodFallback;
          delete copia._qtdFallback;
          return copia;
        });

        for (let b = 0; b < rowsDel.length; b += 100) {
          supabaseRequest('delivery?on_conflict=id', 'POST', rowsDel.slice(b, b + 100), {
            Prefer: 'resolution=merge-duplicates'
          });
        }
        resumo.delivery = rowsDel.length;

        const idsDliUsados = new Set();
        listaDel.forEach(d => {
          const pedidoLimpo = d.pedido.replace(/[^A-Za-z0-9_-]/g, '');
          const its =
            delItensPorPedido[d.pedido] ||
            (d._prodFallback
              ? [
                  {
                    produto: d._prodFallback,
                    qtd: d._qtdFallback,
                    unit: d._qtdFallback > 0 ? Number((d.total / d._qtdFallback).toFixed(2)) : d.total,
                    subtotal: d.total
                  }
                ]
              : []);

          its.forEach((it, idx) => {
            const chaveDli = `${d.id}|${normalizarTextoChave(it.produto)}|${Number(it.qtd) || 0}|${(Number(it.subtotal) || 0).toFixed(2)}`;
            let idDli = pegarProximoIdFila(filaDelItens, chaveDli, idsDliUsados);
            if (!idDli) {
              idDli = `DLI-SHEET-${pedidoLimpo || d.id}-${idx + 1}`;
              let seqDli = idx + 1;
              while (idsDliUsados.has(idDli)) {
                seqDli++;
                idDli = `DLI-SHEET-${pedidoLimpo || d.id}-${seqDli}`;
              }
              idsDliUsados.add(idDli);
            }

            rowsDelItens.push({
              id: idDli,
              empresa_id: empId,
              delivery_id: d.id,
              pedido: d.pedido,
              produto_nome: it.produto,
              quantidade: it.qtd,
              preco_unitario: it.unit,
              subtotal: it.subtotal,
              hora: d.data_hora
            });
          });
        });

        if (rowsDelItens.length > 0) {
          for (let b = 0; b < rowsDelItens.length; b += 100) {
            supabaseRequest('delivery_itens?on_conflict=id', 'POST', rowsDelItens.slice(b, b + 100), {
              Prefer: 'resolution=merge-duplicates'
            });
          }
          resumo.deliveryItens = rowsDelItens.length;
        }

        try {
          const todosDliSupa = supabaseRequest('delivery_itens?select=id', 'GET');
          if (Array.isArray(todosDliSupa)) {
            todosDliSupa.forEach(row => {
              const rid = String(row && row.id ? row.id : '');
              if (rid && !idsDliUsados.has(rid) && !rid.startsWith('DIT-')) {
                supabaseRequest(`delivery_itens?id=eq.${encodeURIComponent(rid)}`, 'DELETE');
              }
            });
          }
        } catch (eDelDli) {}
      }
    }

    // ------------------------------------------------------------------
    // 9. CONTAS A PAGAR
    // ------------------------------------------------------------------
    const shPag = ss.getSheetByName('CONTAS_A_PAGAR');
    if (shPag && shPag.getLastRow() > 1) {
      const dPag = shPag.getDataRange().getValues();
      const rowsPag = [];
      for (let i = 1; i < dPag.length; i++) {
        const idP = String(dPag[i][0] || `PAG-SHEET-${i + 1}`).trim();
        const forn = String(dPag[i][1] || '').trim();
        const val = limparNumero(dPag[i][2]);
        if (!forn && val <= 0) continue;

        const dtV = dPag[i][4] ? parseDataSeguraSheet(dPag[i][4]) : new Date();
        const ymdV = Utilities.formatDate(dtV, 'America/Sao_Paulo', 'yyyy-MM-dd');
        const formaPagRaw = String(dPag[i][3] || 'Boleto').trim();
        const ehCancPag = formaPagRaw.toUpperCase() === 'CANCELADO' || forn.toUpperCase().includes('[CANCELADA');
        const stRaw = normalizarTextoChave(dPag[i][5]);
        const stNorm = ehCancPag || stRaw === 'PAGO' || stRaw === 'QUITADO' || stRaw === 'PAGA' ? 'PAGO' : 'PENDENTE';
        const dtPgto = dPag[i][6] ? parseDataSeguraSheet(dPag[i][6]).toISOString() : null;

        rowsPag.push({
          id: idP,
          empresa_id: empId,
          descricao: forn || 'Conta a Pagar',
          fornecedor: forn,
          categoria: /^TXE-/i.test(idP) ? 'Taxa de Entrega' : 'Fornecedores',
          valor: val,
          forma_pagamento: ehCancPag ? 'CANCELADO' : formaPagRaw,
          vencimento: ymdV,
          status: stNorm,
          data_pagamento: dtPgto
        });
      }
      if (rowsPag.length > 0) {
        supabaseRequest('contas_a_pagar?on_conflict=id', 'POST', rowsPag, {
          Prefer: 'resolution=merge-duplicates'
        });
        resumo.contasPagar = rowsPag.length;
      }
    }

    // ------------------------------------------------------------------
    // 10. CONTAS A RECEBER (ÍNDICES REAIS A..J, SEM QUEBRAR CHECK STATUS)
    // ------------------------------------------------------------------
    const shRec = ss.getSheetByName('CONTAS_A_RECEBER');
    if (shRec && shRec.getLastRow() > 1) {
      const dRec = shRec.getDataRange().getValues();
      const rowsRec = [];
      for (let i = 1; i < dRec.length; i++) {
        const idR = String(dRec[i][0] || `REC-SHEET-${i + 1}`).trim();
        const origem = String(dRec[i][1] || 'BALCAO').trim();
        const referencia = String(dRec[i][2] || '').trim();
        const cli = String(dRec[i][3] || '').trim();
        if (!cli) continue;

        const valTotal = limparNumero(dRec[i][4]);
        const saldo = limparNumero(dRec[i][6]);
        // Ignora placeholder automático R$ 0,00 gerado ao cadastrar cliente
        if (referencia === 'FIADO_FIXO' && valTotal <= 0 && saldo <= 0) continue;

        const stRaw = normalizarTextoChave(dRec[i][8]);
        const stNorm = stRaw === 'QUITADO' || stRaw === 'PAGO' || saldo <= 0.009 ? 'PAGO' : 'PENDENTE';
        const dtRec = dRec[i][9] ? parseDataSeguraSheet(dRec[i][9]).toISOString() : new Date().toISOString();

        rowsRec.push({
          id: idR,
          empresa_id: empId,
          data: dtRec,
          cliente: cli,
          descricao: `${origem}${referencia ? ' #' + referencia : ''}`,
          valor: saldo > 0 ? saldo : valTotal,
          status: stNorm,
          forma_pagamento: String(dRec[i][7] || 'FIADO').trim(),
          comanda_origem: referencia || idR
        });
      }
      if (rowsRec.length > 0) {
        supabaseRequest('contas_a_receber?on_conflict=id', 'POST', rowsRec, {
          Prefer: 'resolution=merge-duplicates'
        });
        resumo.contasReceber = rowsRec.length;
      }
    }

    // ------------------------------------------------------------------
    // 11. COMPRAS (SEM DUPLICIDADE POR NÚMERO DA LINHA)
    // ------------------------------------------------------------------
    const shCompras = ss.getSheetByName('COMPRAS');
    if (shCompras && shCompras.getLastRow() > 1) {
      const dCmp = shCompras.getDataRange().getValues();
      const rowsCmp = [];
      const idsCmpUsados = new Set();
      const occCmp = {};

      for (let i = 1; i < dCmp.length; i++) {
        const prodNome = String(dCmp[i][1] || '').trim();
        const valTot = limparNumero(dCmp[i][3]);
        if (!prodNome && valTot <= 0) continue;
        const dtCmp = parseDataSeguraSheet(dCmp[i][0]);
        const ymdCmp = Utilities.formatDate(dtCmp, 'America/Sao_Paulo', 'yyyy-MM-dd');
        const qtdCmp = limparNumero(dCmp[i][2]) || 1;
        const custoUnit = qtdCmp > 0 ? Number((valTot / qtdCmp).toFixed(2)) : valTot;
        const prodFinalCmp = prodNome || 'Compra';

        const fpCmp = `${ymdCmp}|${normalizarTextoChave(prodFinalCmp)}|${qtdCmp}|${valTot.toFixed(2)}`;
        occCmp[fpCmp] = (occCmp[fpCmp] || 0) + 1;
        let idCmp = pegarProximoIdFila(filaCompras, fpCmp, idsCmpUsados);
        if (!idCmp) {
          idCmp = gerarIdDeterministico('CMP-SH', `${fpCmp}#${occCmp[fpCmp]}`);
          while (idsCmpUsados.has(idCmp)) {
            occCmp[fpCmp] += 1;
            idCmp = gerarIdDeterministico('CMP-SH', `${fpCmp}#${occCmp[fpCmp]}`);
          }
          idsCmpUsados.add(idCmp);
        }

        const formaSheet = String(dCmp[i][5] || 'Dinheiro').replace(/^[^\wÀ-ÿ]+/, '').trim() || 'Dinheiro';
        const idCprSheet = String(dCmp[i][7] || '').trim();
        let nfUrlSheet = '';
        try {
          const cellNf = shCompras.getRange(i + 1, 9);
          const formulaNf = String(cellNf.getFormula() || '');
          const mUrl = formulaNf.match(/HYPERLINK\s*\(\s*"([^"]+)"/i);
          if (mUrl && mUrl[1]) {
            nfUrlSheet = mUrl[1].trim();
          } else {
            const richNf = cellNf.getRichTextValue();
            if (richNf && richNf.getLinkUrl()) nfUrlSheet = String(richNf.getLinkUrl()).trim();
          }
        } catch (eNf) {}

        const notaFiscalPadrao = `${idCprSheet || idCmp}|${formaSheet}${nfUrlSheet ? '|' + nfUrlSheet : ''}`;

        rowsCmp.push({
          id: idCmp,
          empresa_id: empId,
          data_hora: dtCmp.toISOString(),
          fornecedor: String(dCmp[i][4] || 'Fornecedor').trim(),
          produto_nome: prodFinalCmp,
          quantidade: qtdCmp,
          custo_unitario: custoUnit,
          valor_total: valTot,
          nota_fiscal: notaFiscalPadrao,
          operador: 'Planilha'
        });
      }
      if (rowsCmp.length > 0) {
        for (let b = 0; b < rowsCmp.length; b += 100) {
          supabaseRequest('compras?on_conflict=id', 'POST', rowsCmp.slice(b, b + 100), {
            Prefer: 'resolution=merge-duplicates'
          });
        }
        resumo.compras = rowsCmp.length;
      }
    }

    const msgSucesso =
      `⚡ Sincronização Planilha ➔ Supabase Concluída!\n\n` +
      `⚙️ Config: ${resumo.config}\n` +
      `📦 Produtos: ${resumo.produtos}\n` +
      `👥 Clientes: ${resumo.clientes}\n` +
      `👤 Usuários: ${resumo.usuarios}\n` +
      `🛒 Vendas: ${resumo.vendas}\n` +
      `💵 Caixa: ${resumo.caixa}\n` +
      `🍺 Comandas: ${resumo.comandas} (${resumo.comandaItens} itens)\n` +
      `🚚 Delivery: ${resumo.delivery} (${resumo.deliveryItens} itens)\n` +
      `🪙 Pagar/Receber: ${resumo.contasPagar}/${resumo.contasReceber}\n` +
      `📑 Compras: ${resumo.compras}`;

    console.log(msgSucesso);
    if (!silencioso && typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getActive()) {
      try {
        SpreadsheetApp.getUi().alert('⚡ Migração & Sync Concluído!', msgSucesso, SpreadsheetApp.getUi().ButtonSet.OK);
      } catch (eUi) {}
    }
    return { ok: true, resumo: resumo, msg: msgSucesso };
  } catch (err) {
    const erroMsg = 'Erro durante a migração/sincronização para o Supabase: ' + err.message;
    console.error(erroMsg);
    if (!silencioso && typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getActive()) {
      try {
        SpreadsheetApp.getUi().alert('❌ Erro na Migração', erroMsg, SpreadsheetApp.getUi().ButtonSet.OK);
      } catch (eUi) {}
    }
    return { ok: false, msg: erroMsg };
  } finally {
    let rodarNovamente = false;
    try {
      const props = PropertiesService.getScriptProperties();
      if (props.getProperty('SYNC_SUPABASE_PENDENTE') === 'SIM') {
        props.deleteProperty('SYNC_SUPABASE_PENDENTE');
        rodarNovamente = true;
      }
    } catch (eProp) {}
    try {
      lock.releaseLock();
    } catch (e) {}
    if (rodarNovamente) {
      try {
        sincronizarSupabaseParaPlanilha(true);
      } catch (eRe) {}
    }
  }
}

// ====================================================================
// ⬇️ SINCRONIZAÇÃO REVERSA (SUPABASE ➔ PLANILHA GOOGLE SHEETS)
// ====================================================================

function sincronizarSupabaseParaPlanilha(silencioso) {
  const lock = LockService.getScriptLock();
  const acquired = lock.tryLock(25000);
  if (!acquired) {
    try {
      PropertiesService.getScriptProperties().setProperty('SYNC_SUPABASE_PENDENTE', 'SIM');
    } catch (eProp) {}
    return { ok: false, msg: 'Lock ocupado; sincronização enfileirada.' };
  }

  try {
    const ss = SpreadsheetApp.getActive();
    const empId = obterEmpresaId();
    const atualizados = {
      config: 0,
      produtos: 0,
      clientes: 0,
      comandas: 0,
      delivery: 0,
      vendas: 0,
      caixa: 0,
      financeiro: 0,
      usuarios: 0
    };

    const empRes = supabaseRequest(`empresas?id=eq.${encodeURIComponent(empId)}&limit=1`, 'GET');
    const empresa = Array.isArray(empRes) && empRes.length > 0 ? empRes[0] : null;
    const configsSupa = supabaseRequest('config?select=chave,valor', 'GET') || [];
    const produtosSupa = supabaseRequest('produtos?select=*&order=nome.asc', 'GET') || [];
    const clientesSupa = supabaseRequest('clientes?select=*&order=nome.asc', 'GET') || [];
    const comandasSupa = supabaseRequest('comandas?select=*&order=data_abertura.asc&limit=200', 'GET') || [];
    const cmdItensSupa = supabaseRequest('comanda_itens?select=*', 'GET') || [];
    const deliverySupa = supabaseRequest('delivery?select=*&order=data_hora.asc&limit=200', 'GET') || [];
    const delItensSupa = supabaseRequest('delivery_itens?select=*', 'GET') || [];
    const vendasSupa = supabaseRequest('vendas?select=*&order=data_hora.asc&limit=300', 'GET') || [];
    const caixaSupa = supabaseRequest('caixa?select=*&order=data_hora.asc&limit=300', 'GET') || [];
    const pagarSupa = supabaseRequest('contas_a_pagar?select=*', 'GET') || [];
    const receberSupa = supabaseRequest('contas_a_receber?select=*', 'GET') || [];
    const comprasSupa = supabaseRequest('compras?select=*&order=data_hora.asc&limit=200', 'GET') || [];
    const usuariosSupa = supabaseRequest('usuarios?select=*', 'GET') || [];

    // ------------------------------------------------------------------
    // 1. CONFIG
    // ------------------------------------------------------------------
    const shConfig = ss.getSheetByName('CONFIG');
    if (shConfig) {
      const cfgAplicar = {};
      if (Array.isArray(configsSupa)) {
        configsSupa.forEach(c => {
          const k = String(c.chave || '').trim().toUpperCase();
          if (k) cfgAplicar[k] = String(c.valor ?? '');
        });
      }
      if (empresa) {
        if (empresa.nome) cfgAplicar.NOME_DEPOSITO = empresa.nome;
        if (empresa.dono_nome) cfgAplicar.DONO = empresa.dono_nome;
        if (empresa.cnpj) cfgAplicar.CNPJ = empresa.cnpj;
        if (empresa.telefone) cfgAplicar.TELEFONE = empresa.telefone;
        if (empresa.cidade) cfgAplicar.CIDADE = empresa.cidade;
        if (empresa.chave_pix) cfgAplicar.CHAVE_PIX = empresa.chave_pix;
        if (empresa.telegram_bot_token) cfgAplicar.TELEGRAM_BOT_TOKEN = empresa.telegram_bot_token;
        if (empresa.telegram_chat_id) cfgAplicar.TELEGRAM_DONO_CHAT_ID = empresa.telegram_chat_id;
      }

      const dCfg = shConfig.getDataRange().getValues();
      const linhaPorChave = {};
      for (let i = 1; i < dCfg.length; i++) {
        const k = String(dCfg[i][0] || '').trim().toUpperCase();
        if (k) linhaPorChave[k] = i + 1;
      }
      const chavesSync = [
        'NOME_DEPOSITO',
        'DONO',
        'CNPJ',
        'TELEFONE',
        'CIDADE',
        'CHAVE_PIX',
        'TELEGRAM_BOT_TOKEN',
        'TELEGRAM_DONO_CHAT_ID',
        'DRIVE_URL',
        'AUTO_REFRESH',
        'INTERVALO_REFRESH',
        'BACKUP_AUTO',
        'PERMITIR_ESTOQUE_NEGATIVO',
        'SPREADSHEET_URL',
        'WEBAPP_URL'
      ];
      chavesSync.forEach(ch => {
        if (cfgAplicar[ch] !== undefined && cfgAplicar[ch] !== '') {
          const rowIdx = linhaPorChave[ch];
          if (rowIdx) {
            if (String(dCfg[rowIdx - 1][1] ?? '') !== String(cfgAplicar[ch])) {
              shConfig.getRange(rowIdx, 2).setValue(cfgAplicar[ch]);
              atualizados.config++;
            }
          } else {
            shConfig.appendRow([ch, cfgAplicar[ch], 'Sincronizado via Supabase']);
            atualizados.config++;
          }
        }
      });

      const nomeNegocio = String(cfgAplicar.NOME_DEPOSITO || '').trim();
      if (nomeNegocio && ss.getName() !== nomeNegocio) {
        try {
          ss.rename(nomeNegocio);
        } catch (eRen) {}
      }
    }

    // ------------------------------------------------------------------
    // 2. PRODUTOS & ESTOQUE
    // ------------------------------------------------------------------
    const shProd = ss.getSheetByName('PRODUTOS');
    const shEst = ss.getSheetByName('ESTOQUE');
    if (shProd && Array.isArray(produtosSupa)) {
      const dProd = shProd.getDataRange().getValues();
      const idxPorId = {};
      const idxPorNome = {};
      for (let i = 1; i < dProd.length; i++) {
        const idP = String(dProd[i][10] || '').trim();
        const nomeP = normalizarTextoChave(dProd[i][0]);
        if (idP) idxPorId[idP] = i + 1;
        if (nomeP) idxPorNome[nomeP] = i + 1;
      }

      const dEst = shEst ? shEst.getDataRange().getValues() : [];
      const idxEstPorNome = {};
      for (let i = 1; i < dEst.length; i++) {
        const nomeE = normalizarTextoChave(dEst[i][0]);
        if (nomeE) idxEstPorNome[nomeE] = i + 1;
      }

      produtosSupa.forEach(p => {
        const nomeKey = normalizarTextoChave(p.nome);
        const rowProd = idxPorId[p.id] || idxPorNome[nomeKey];
        const preco = Number(p.preco_venda) || 0;
        const minimo = Number(p.estoque_minimo) || 0;
        const custo = Number(p.custo_medio) || 0;
        const estAtual = Number(p.estoque_atual) || 0;

        if (rowProd) {
          shProd.getRange(rowProd, 1, 1, 7).setValues([[p.nome, p.categoria || 'Geral', p.marca || '', p.volume || '', preco, minimo, custo]]);
          shProd.getRange(rowProd, 11).setValue(p.id);
          shProd.getRange(rowProd, 12).setValue(estAtual);
        } else {
          shProd.appendRow([p.nome, p.categoria || 'Geral', p.marca || '', p.volume || '', preco, minimo, custo, '', '', '', p.id, estAtual]);
          const lr = shProd.getLastRow();
          shProd.getRange(lr, 8).setFormula(`=IF(G${lr}>0; (E${lr}-G${lr})/G${lr}; 0)`);
          shProd.getRange(lr, 9).setFormula(`=G${lr}*(1+H${lr})`);
          shProd.getRange(lr, 10).setFormula(`=IF(E${lr}>=I${lr}; "✅ OK"; "🚨 BAIXA")`);
        }

        if (shEst) {
          const rowEst = idxEstPorNome[nomeKey];
          const statusEst = calcularStatusEstoquePadrao(estAtual, minimo);
          if (rowEst) {
            shEst.getRange(rowEst, 2).setValue(estAtual);
            shEst.getRange(rowEst, 3).setValue(minimo);
            shEst.getRange(rowEst, 4).setValue(statusEst);
          } else {
            shEst.appendRow([p.nome, estAtual, minimo, statusEst, '']);
          }
        }
        atualizados.produtos++;
      });
    }

    // ------------------------------------------------------------------
    // 3. CLIENTES (ATUALIZA TODOS OS CAMPOS, INCLUSIVE LIMITE/STATUS/RENOMEAÇÃO)
    // ------------------------------------------------------------------
    const shCli = ss.getSheetByName('CLIENTES');
    if (shCli && Array.isArray(clientesSupa)) {
      const dCli = shCli.getDataRange().getValues();
      const hdrCli = (dCli[0] || []).map(h => String(h || '').toUpperCase().trim());
      let colNome = hdrCli.findIndex(h => h.includes('NOME') || h.includes('CLIENTE'));
      if (colNome === -1) colNome = 0;
      let colTel = hdrCli.findIndex(h => h.includes('TEL') || h.includes('FONE') || h.includes('WHATS'));
      if (colTel === -1) colTel = 1;
      let colEnd = hdrCli.findIndex(h => h.includes('END'));
      if (colEnd === -1) colEnd = 2;
      const colLim = hdrCli.findIndex(h => h.includes('LIMITE'));
      const colDeb = hdrCli.findIndex(h => h.includes('SALDO') || h.includes('DEVEDOR'));
      const colStat = hdrCli.findIndex(h => h.includes('STATUS'));
      let colObs = hdrCli.findIndex(h => h.includes('OBS'));
      if (colObs === -1 && colLim === -1 && hdrCli.length >= 5) colObs = 4;

      const idxCliPorNome = {};
      const idxCliPorTel = {};
      for (let i = 1; i < dCli.length; i++) {
        const nk = normalizarTextoChave(dCli[i][colNome]);
        if (nk && !idxCliPorNome[nk]) idxCliPorNome[nk] = i + 1;
        const td = String(dCli[i][colTel] || '').replace(/\D/g, '');
        if (td && !idxCliPorTel[td]) idxCliPorTel[td] = i + 1;
      }

      const vistosSupa = {};
      const novosClientes = [];
      clientesSupa.forEach(c => {
        const nk = normalizarTextoChave(c.nome);
        if (!nk || vistosSupa[nk]) return;
        vistosSupa[nk] = true;
        const td = String(c.telefone || '').replace(/\D/g, '');
        const rowC = idxCliPorNome[nk] || (td ? idxCliPorTel[td] : null);
        if (rowC) {
          shCli.getRange(rowC, colNome + 1).setValue(c.nome || '');
          shCli.getRange(rowC, colTel + 1).setValue(c.telefone || '');
          shCli.getRange(rowC, colEnd + 1).setValue(c.endereco || '');
          if (colLim !== -1) shCli.getRange(rowC, colLim + 1).setValue(Number(c.limite_fiado) || 0);
          if (colDeb !== -1) shCli.getRange(rowC, colDeb + 1).setValue(Number(c.saldo_devedor) || 0);
          if (colStat !== -1) shCli.getRange(rowC, colStat + 1).setValue(c.status || 'ATIVO');
          if (colObs !== -1) shCli.getRange(rowC, colObs + 1).setValue(c.observacao || '');
          atualizados.clientes++;
        } else {
          novosClientes.push(c);
        }
      });

      const numCols = Math.max(hdrCli.length, 5);
      novosClientes.forEach(c => {
        const novaLinha = new Array(numCols).fill('');
        novaLinha[colNome] = c.nome || '';
        novaLinha[colTel] = c.telefone || '';
        novaLinha[colEnd] = c.endereco || '';
        if (colLim !== -1) novaLinha[colLim] = Number(c.limite_fiado) || 0;
        if (colDeb !== -1) novaLinha[colDeb] = Number(c.saldo_devedor) || 0;
        if (colStat !== -1) novaLinha[colStat] = c.status || 'ATIVO';
        if (colObs !== -1) novaLinha[colObs] = c.observacao || '';
        inserirLinhaNoTopoPlanilha(shCli, novaLinha);
        atualizados.clientes++;
      });
    }

    // ------------------------------------------------------------------
    // 4. COMANDAS + COMANDA_ITENS (ORIGEM BALCAO / TELEGRAM & PEDIDO NUMÉRICO)
    // ------------------------------------------------------------------
    const shCom = ss.getSheetByName('COMANDAS');
    const shComIt = ss.getSheetByName('COMANDA_ITENS');
    if (shCom && Array.isArray(comandasSupa)) {
      const dCom = shCom.getDataRange().getValues();
      const idxPorPedido = {};
      for (let i = 1; i < dCom.length; i++) {
        const ped = String(dCom[i][0] || '').trim();
        if (ped) idxPorPedido[ped] = i + 1;
      }

      const novasComandas = [];
      comandasSupa.forEach(cmd => {
        const ped = String(cmd.pedido || '').trim();
        if (!ped) return;
        const pedValor = /^\d+$/.test(ped) ? Number(ped) : ped;
        const origemPlan = String(cmd.operador || '').toUpperCase().trim() === 'TELEGRAM' ? 'TELEGRAM' : 'BALCAO';
        const rowC = idxPorPedido[ped];
        if (rowC) {
          const origAtual = String(dCom[rowC - 1][3] || '').toUpperCase().trim();
          if (origAtual !== 'BALCAO' && origAtual !== 'TELEGRAM') {
            shCom.getRange(rowC, 4).setValue(origemPlan);
            atualizados.comandas++;
          }
          if (String(dCom[rowC - 1][4] || '').toUpperCase().trim() !== cmd.status) {
            shCom.getRange(rowC, 5).setValue(cmd.status);
            atualizados.comandas++;
          }
        } else {
          novasComandas.push([
            pedValor,
            parseDataSeguraSheet(cmd.data_abertura),
            cmd.cliente || 'Balcão',
            origemPlan,
            cmd.status || 'ABERTA'
          ]);
        }
      });
      novasComandas.forEach(linha => {
        inserirLinhaNoTopoPlanilha(shCom, linha);
        atualizados.comandas++;
      });
    }

    if (shComIt && Array.isArray(cmdItensSupa)) {
      const syncedCmi = carregarConjuntoIdsSincronizados('SYNCED_CMI_IDS');
      const dCmi = shComIt.getDataRange().getValues();

      // Reconcilia contagens por (pedido|produto|qtd|subtotal) para propagar exclusões/estornos feitos no Painel Web/App
      const supaFreqCmi = {};
      const pedidosNoSupa = new Set();
      if (Array.isArray(comandasSupa)) {
        comandasSupa.forEach(c => {
          const p = String(c.pedido || '').trim();
          if (p) pedidosNoSupa.add(p);
        });
      }
      cmdItensSupa.forEach(it => {
        const pedStr = String(it.pedido || '').trim();
        if (pedStr) pedidosNoSupa.add(pedStr);
        const fp = `${pedStr}|${normalizarTextoChave(it.produto_nome)}|${Number(it.quantidade) || 0}|${Number(it.subtotal) || 0}`;
        supaFreqCmi[fp] = (supaFreqCmi[fp] || 0) + 1;
      });

      const sheetFreqCmi = {};
      for (let i = 1; i < dCmi.length; i++) {
        const pedStr = String(dCmi[i][0] || '').trim();
        if (!pedStr) continue;
        const fp = `${pedStr}|${normalizarTextoChave(dCmi[i][1])}|${Number(dCmi[i][2]) || 0}|${Number(dCmi[i][4]) || 0}`;
        sheetFreqCmi[fp] = (sheetFreqCmi[fp] || 0) + 1;
      }

      // Remove da planilha linhas excedentes (itens que foram excluídos/estornados no Supabase)
      for (let i = dCmi.length - 1; i >= 1; i--) {
        const pedStr = String(dCmi[i][0] || '').trim();
        if (!pedStr || !pedidosNoSupa.has(pedStr)) continue;
        const fp = `${pedStr}|${normalizarTextoChave(dCmi[i][1])}|${Number(dCmi[i][2]) || 0}|${Number(dCmi[i][4]) || 0}`;
        const qtdSheet = sheetFreqCmi[fp] || 0;
        const qtdSupa = supaFreqCmi[fp] || 0;
        if (qtdSheet > qtdSupa) {
          shComIt.deleteRow(i + 1);
          sheetFreqCmi[fp] = qtdSheet - 1;
          atualizados.comandas++;
        }
      }

      let alterouCmi = false;
      cmdItensSupa.forEach(it => {
        const idIt = String(it.id || '');
        const pedStr = String(it.pedido || '').trim();
        const pedItVal = /^\d+$/.test(pedStr) ? Number(pedStr) : it.pedido;
        const fp = `${pedStr}|${normalizarTextoChave(it.produto_nome)}|${Number(it.quantidade) || 0}|${Number(it.subtotal) || 0}`;
        const qtdSheet = sheetFreqCmi[fp] || 0;
        const qtdSupa = supaFreqCmi[fp] || 0;
        if (qtdSheet < qtdSupa) {
          inserirLinhaNoTopoPlanilha(shComIt, [
            pedItVal,
            it.produto_nome,
            Number(it.quantidade) || 1,
            Number(it.preco_unitario) || 0,
            Number(it.subtotal) || 0,
            'SIM'
          ]);
          sheetFreqCmi[fp] = qtdSheet + 1;
          atualizados.comandas++;
        }
        if (idIt) {
          syncedCmi.add(idIt);
          alterouCmi = true;
        }
      });
      if (alterouCmi) salvarConjuntoIdsSincronizados('SYNCED_CMI_IDS', syncedCmi);
    }

    // ------------------------------------------------------------------
    // 5. DELIVERY + DELIVERY_ITENS
    // ------------------------------------------------------------------
    const shDel = ss.getSheetByName('DELIVERY');
    const shDelIt = ss.getSheetByName('DELIVERY_ITENS');
    if (shDel && Array.isArray(deliverySupa)) {
      const dDel = shDel.getDataRange().getValues();
      const idxDelPed = {};
      const idxDelId = {};
      for (let i = 1; i < dDel.length; i++) {
        const ped = String(dDel[i][0] || '').trim();
        const idCol = String(dDel[i][10] || '').trim();
        if (ped) idxDelPed[ped] = i + 1;
        if (idCol) idxDelId[idCol] = i + 1;
      }

      const itensDelPorId = {};
      if (Array.isArray(delItensSupa)) {
        delItensSupa.forEach(it => {
          const did = String(it.delivery_id || '');
          if (!itensDelPorId[did]) itensDelPorId[did] = [];
          itensDelPorId[did].push(it);
        });
      }

      const novosDeliverys = [];
      deliverySupa.forEach(del => {
        const pedStr = String(del.pedido || '').trim();
        const pedDelVal = /^\d+$/.test(pedStr) ? Number(pedStr) : del.pedido;
        const rowD = idxDelId[del.id] || idxDelPed[pedStr];
        const stPlan = normalizarStatusDeliveryParaPlanilha(del.status);
        if (rowD) {
          shDel.getRange(rowD, 6, 1, 4).setValues([[Number(del.total) || 0, del.forma_pagamento || 'PIX', stPlan, del.entregador || '']]);
          shDel.getRange(rowD, 11).setValue(del.id);
          atualizados.delivery++;
        } else {
          const its = itensDelPorId[del.id] || [];
          const resumoProd = its.length > 0 ? its.map(x => `${x.quantidade}x ${x.produto_nome}`).join(', ') : (del.observacoes || 'Pedido');
          const qtdTotal = its.reduce((a, x) => a + (Number(x.quantidade) || 0), 0) || 1;
          novosDeliverys.push([
            pedDelVal,
            parseDataSeguraSheet(del.data_hora),
            del.cliente || 'Consumidor',
            resumoProd,
            qtdTotal,
            Number(del.total) || 0,
            del.forma_pagamento || 'PIX',
            stPlan,
            del.entregador || '',
            del.endereco || '',
            del.id
          ]);
        }
      });
      novosDeliverys.forEach(linha => {
        inserirLinhaNoTopoPlanilha(shDel, linha);
        atualizados.delivery++;
      });
    }

    if (shDelIt && Array.isArray(delItensSupa)) {
      const syncedDli = carregarConjuntoIdsSincronizados('SYNCED_DLI_IDS');
      const dDli = shDelIt.getDataRange().getValues();

      const supaFreqDli = {};
      const pedidosDelNoSupa = new Set();
      if (Array.isArray(deliverySupa)) {
        deliverySupa.forEach(d => {
          const p = String(d.pedido || '').trim();
          if (p) pedidosDelNoSupa.add(p);
        });
      }
      delItensSupa.forEach(it => {
        const pedStr = String(it.pedido || '').trim();
        if (pedStr) pedidosDelNoSupa.add(pedStr);
        const fp = `${pedStr}|${normalizarTextoChave(it.produto_nome)}|${Number(it.quantidade) || 0}`;
        supaFreqDli[fp] = (supaFreqDli[fp] || 0) + 1;
      });

      const sheetFreqDli = {};
      for (let i = 1; i < dDli.length; i++) {
        const pedStr = String(dDli[i][0] || '').trim();
        if (!pedStr) continue;
        const fp = `${pedStr}|${normalizarTextoChave(dDli[i][1])}|${Number(dDli[i][2]) || 0}`;
        sheetFreqDli[fp] = (sheetFreqDli[fp] || 0) + 1;
      }

      for (let i = dDli.length - 1; i >= 1; i--) {
        const pedStr = String(dDli[i][0] || '').trim();
        if (!pedStr || !pedidosDelNoSupa.has(pedStr)) continue;
        const fp = `${pedStr}|${normalizarTextoChave(dDli[i][1])}|${Number(dDli[i][2]) || 0}`;
        const qtdSheet = sheetFreqDli[fp] || 0;
        const qtdSupa = supaFreqDli[fp] || 0;
        if (qtdSheet > qtdSupa) {
          shDelIt.deleteRow(i + 1);
          sheetFreqDli[fp] = qtdSheet - 1;
          atualizados.delivery++;
        }
      }

      let alterouDli = false;
      delItensSupa.forEach(it => {
        const idIt = String(it.id || '');
        const pedStr = String(it.pedido || '').trim();
        const pedDliVal = /^\d+$/.test(pedStr) ? Number(pedStr) : it.pedido;
        const fp = `${pedStr}|${normalizarTextoChave(it.produto_nome)}|${Number(it.quantidade) || 0}`;
        const qtdSheet = sheetFreqDli[fp] || 0;
        const qtdSupa = supaFreqDli[fp] || 0;
        if (qtdSheet < qtdSupa) {
          inserirLinhaNoTopoPlanilha(shDelIt, [
            pedDliVal,
            it.produto_nome,
            Number(it.quantidade) || 1,
            Number(it.preco_unitario) || 0,
            Number(it.subtotal) || 0,
            'SIM'
          ]);
          sheetFreqDli[fp] = qtdSheet + 1;
          atualizados.delivery++;
        }
        if (idIt) {
          syncedDli.add(idIt);
          alterouDli = true;
        }
      });
      if (alterouDli) salvarConjuntoIdsSincronizados('SYNCED_DLI_IDS', syncedDli);
    }

    // ------------------------------------------------------------------
    // 6. VENDAS (APPEND-ONLY DEDUPLICADO PARA LANÇAMENTOS WEB/APP)
    // ------------------------------------------------------------------
    const shVendas = ss.getSheetByName('VENDAS');
    if (shVendas && Array.isArray(vendasSupa)) {
      const syncedVendas = carregarConjuntoIdsSincronizados('SYNCED_VENDAS_IDS');
      const dV = shVendas.getDataRange().getValues();
      const fpVendas = new Set();
      for (let i = 1; i < dV.length; i++) {
        const ymdHm = Utilities.formatDate(parseDataSeguraSheet(dV[i][0]), 'America/Sao_Paulo', 'yyyy-MM-dd HH:mm');
        const refCol = String(dV[i][6] || '').trim();
        fpVendas.add(`${ymdHm}|${normalizarTextoChave(dV[i][1])}|${limparNumero(dV[i][2])}|${limparNumero(dV[i][3]).toFixed(2)}|${refCol}`);
      }
      let alterouV = false;
      vendasSupa.forEach(v => {
        const vid = String(v.id || '');
        if (!vid || vid.startsWith('VN-SHEET-') || vid.startsWith('VN-SH-') || vid.startsWith('VN-GAS-') || syncedVendas.has(vid)) return;
        const dtV = parseDataSeguraSheet(v.data_hora);
        const ymdHm = Utilities.formatDate(dtV, 'America/Sao_Paulo', 'yyyy-MM-dd HH:mm');
        const refCol = formatarIdVendaPlanilha(v.origem || 'Balcão', v.pedido_id || v.vendedor || '', dtV);
        const fp = `${ymdHm}|${normalizarTextoChave(v.produto_nome)}|${Number(v.quantidade) || 0}|${(Number(v.valor_total) || 0).toFixed(2)}|${refCol}`;
        if (!fpVendas.has(fp)) {
          inserirLinhaNoTopoPlanilha(shVendas, [
            dtV,
            v.produto_nome,
            Number(v.quantidade) || 1,
            Number(v.valor_total) || 0,
            v.forma_pagamento || 'Dinheiro',
            v.origem || 'Balcão',
            refCol
          ]);
          fpVendas.add(fp);
          atualizados.vendas++;
        }
        syncedVendas.add(vid);
        alterouV = true;
      });
      if (alterouV) salvarConjuntoIdsSincronizados('SYNCED_VENDAS_IDS', syncedVendas);
    }

    // ------------------------------------------------------------------
    // 7. CAIXA (APPEND-ONLY DEDUPLICADO PARA LANÇAMENTOS WEB/APP)
    // ------------------------------------------------------------------
    const shCaixa = ss.getSheetByName('CAIXA');
    if (shCaixa && Array.isArray(caixaSupa)) {
      const syncedCaixa = carregarConjuntoIdsSincronizados('SYNCED_CAIXA_IDS');
      const dC = shCaixa.getDataRange().getValues();
      const fpCaixa = new Set();
      for (let i = 1; i < dC.length; i++) {
        const ymd = Utilities.formatDate(parseDataSeguraSheet(dC[i][0]), 'America/Sao_Paulo', 'yyyy-MM-dd');
        const tNorm = normalizarTextoChave(dC[i][1]) === 'ENTRADA' ? 'ENTRADA' : 'SAIDA';
        fpCaixa.add(`${ymd}|${tNorm}|${limparNumero(dC[i][2]).toFixed(2)}|${normalizarTextoChave(dC[i][3] || 'DINHEIRO')}|${normalizarTextoChave(dC[i][5] || dC[i][4])}`);
      }
      let alterouC = false;
      caixaSupa.forEach(c => {
        const cid = String(c.id || '');
        if (!cid || cid.startsWith('CX-SHEET-') || cid.startsWith('CX-SH-') || cid.startsWith('CX-GAS-')) return;
        const dtC = parseDataSeguraSheet(c.data_hora);
        const ymd = Utilities.formatDate(dtC, 'America/Sao_Paulo', 'yyyy-MM-dd');
        const tNorm = String(c.tipo || '').toUpperCase() === 'ENTRADA' ? 'ENTRADA' : 'SAIDA';
        const formaC = String(c.forma_pagamento || 'Dinheiro').trim();
        const ehCanceladoC = formaC.toUpperCase() === 'CANCELADO' || String(c.origem || '').toUpperCase() === 'CANCELADO';
        const valorPlanilha = ehCanceladoC ? 0 : (Number(c.valor) || 0);
        const descPlanilha = ehCanceladoC
          ? `[CANCELADA • Valor original R$ ${(Number(c.valor) || 0).toFixed(2)}] ${c.descricao || ''}`
          : (c.descricao || '');

        if (syncedCaixa.has(cid)) {
          // Atualiza FormaPgto caso tenha sido convertida de "Outro" no painel
          if (!ehCanceladoC && formaC.toUpperCase() !== 'OUTRO') {
            for (let r = 1; r < dC.length; r++) {
              const rYmd = Utilities.formatDate(parseDataSeguraSheet(dC[r][0]), 'America/Sao_Paulo', 'yyyy-MM-dd');
              const rVal = limparNumero(dC[r][2]);
              const rForma = normalizarTextoChave(dC[r][3] || '');
              const rDesc = normalizarTextoChave(dC[r][5] || '');
              if (rYmd === ymd && Math.abs(rVal - (Number(c.valor) || 0)) < 0.02 && rForma === 'OUTRO' && rDesc === normalizarTextoChave(c.descricao || '')) {
                shCaixa.getRange(r + 1, 4).setValue(formaC);
                atualizados.caixa++;
                break;
              }
            }
          }
          return;
        }

        const fp = `${ymd}|${tNorm}|${valorPlanilha.toFixed(2)}|${normalizarTextoChave(formaC)}|${normalizarTextoChave(descPlanilha || c.origem)}`;
        if (!fpCaixa.has(fp)) {
          inserirLinhaNoTopoPlanilha(shCaixa, [
            dtC,
            tNorm === 'ENTRADA' ? 'Entrada' : 'Saída',
            valorPlanilha,
            formaC,
            c.origem || 'Balcão',
            descPlanilha
          ]);
          fpCaixa.add(fp);
          atualizados.caixa++;
        }
        syncedCaixa.add(cid);
        alterouC = true;
      });
      if (alterouC) salvarConjuntoIdsSincronizados('SYNCED_CAIXA_IDS', syncedCaixa);
    }

    // ------------------------------------------------------------------
    // 8. CONTAS A PAGAR & RECEBER
    // ------------------------------------------------------------------
    const shPag = ss.getSheetByName('CONTAS_A_PAGAR');
    if (shPag && Array.isArray(pagarSupa)) {
      const dP = shPag.getDataRange().getValues();
      const idxPag = {};
      for (let i = 1; i < dP.length; i++) {
        const idp = String(dP[i][0] || '').trim();
        if (idp) idxPag[idp] = i + 1;
      }
      const novasContasPagar = [];
      pagarSupa.forEach(cp => {
        const rowP = idxPag[cp.id];
        const ehCancCp = String(cp.forma_pagamento || '').toUpperCase() === 'CANCELADO' || String(cp.descricao || '').indexOf('[CANCELADA:') !== -1;
        const nomeFornCp = ehCancCp
          ? (String(cp.descricao || '').indexOf('[CANCELADA:') !== -1 ? cp.descricao : `${cp.fornecedor || cp.descricao || 'Fornecedor'} [CANCELADA]`)
          : (cp.fornecedor || cp.descricao || 'Fornecedor');
        const formaCp = ehCancCp ? 'CANCELADO' : (cp.forma_pagamento || 'Boleto');
        const statusCp = ehCancCp ? 'CANCELADO' : (cp.status || 'PENDENTE');
        const valCp = ehCancCp ? 0 : (Number(cp.valor) || 0);

        if (rowP) {
          shPag.getRange(rowP, 2).setValue(nomeFornCp);
          shPag.getRange(rowP, 3).setValue(valCp);
          shPag.getRange(rowP, 4).setValue(formaCp);
          shPag.getRange(rowP, 5).setValue(parseDataSeguraSheet(cp.vencimento));
          shPag.getRange(rowP, 6).setValue(statusCp);
          shPag.getRange(rowP, 7).setValue(cp.data_pagamento ? parseDataSeguraSheet(cp.data_pagamento) : '');
        } else {
          novasContasPagar.push([
            cp.id,
            nomeFornCp,
            valCp,
            formaCp,
            parseDataSeguraSheet(cp.vencimento),
            statusCp,
            cp.data_pagamento ? parseDataSeguraSheet(cp.data_pagamento) : ''
          ]);
        }
      });
      novasContasPagar.forEach(linha => {
        inserirLinhaNoTopoPlanilha(shPag, linha);
        atualizados.financeiro++;
      });
    }

    const shRec = ss.getSheetByName('CONTAS_A_RECEBER');
    if (shRec && Array.isArray(receberSupa)) {
      const dR = shRec.getDataRange().getValues();
      const idxRec = {};
      for (let i = 1; i < dR.length; i++) {
        const idr = String(dR[i][0] || '').trim();
        if (idr) idxRec[idr] = i + 1;
      }
      const novasContasReceber = [];
      receberSupa.forEach(cr => {
        const rowR = idxRec[cr.id];
        const quitado = cr.status === 'PAGO';
        const txtOrigCr = `${cr.descricao || ''} ${cr.comanda_origem || ''}`.toUpperCase();
        const origCr = txtOrigCr.includes('DELIVERY')
          ? 'DELIVERY'
          : txtOrigCr.includes('COMANDA')
            ? 'COMANDA'
            : 'BALCAO';

        if (rowR) {
          if (String(dR[rowR - 1][1] || '').toUpperCase().trim() === 'WEB_APP') {
            shRec.getRange(rowR, 2).setValue(origCr);
          }
          shRec.getRange(rowR, 7).setValue(quitado ? 0 : Number(cr.valor) || 0);
          shRec.getRange(rowR, 9).setValue(quitado ? 'QUITADO' : 'EM_ABERTO');
          if (quitado && cr.data_pagamento) {
            shRec.getRange(rowR, 6).setValue(Number(dR[rowR - 1][4]) || Number(cr.valor) || 0);
          }
        } else {
          novasContasReceber.push([
            cr.id,
            origCr,
            cr.comanda_origem || cr.id,
            cr.cliente || 'Cliente',
            Number(cr.valor) || 0,
            quitado ? Number(cr.valor) || 0 : 0,
            quitado ? 0 : Number(cr.valor) || 0,
            cr.forma_pagamento || 'FIADO',
            quitado ? 'QUITADO' : 'EM_ABERTO',
            parseDataSeguraSheet(cr.data)
          ]);
        }
      });
      novasContasReceber.forEach(linha => {
        inserirLinhaNoTopoPlanilha(shRec, linha);
        atualizados.financeiro++;
      });
    }

    // ------------------------------------------------------------------
    // 8.1 COMPRAS (SUPABASE ➔ PLANILHA NO TOPO + RELATORIO_COMPRAS)
    // ------------------------------------------------------------------
    const shCompras = ss.getSheetByName('COMPRAS');
    if (shCompras && Array.isArray(comprasSupa)) {
      const syncedCompras = carregarConjuntoIdsSincronizados('SYNCED_COMPRAS_IDS');
      const dCmp = shCompras.getDataRange().getValues();
      const fpCompras = new Set();
      for (let i = 1; i < dCmp.length; i++) {
        const ymd = Utilities.formatDate(parseDataSeguraSheet(dCmp[i][0]), 'America/Sao_Paulo', 'yyyy-MM-dd');
        fpCompras.add(`${ymd}|${normalizarTextoChave(dCmp[i][1])}|${limparNumero(dCmp[i][2])}|${limparNumero(dCmp[i][3]).toFixed(2)}`);
      }
      let alterouCmp = false;
      let inseriuCompraNova = false;
      comprasSupa.forEach(cmp => {
        const cid = String(cmp.id || '');
        if (!cid) return;
        const dtCmp = parseDataSeguraSheet(cmp.data_hora);
        const ymd = Utilities.formatDate(dtCmp, 'America/Sao_Paulo', 'yyyy-MM-dd');
        const qtdC = Number(cmp.quantidade) || 1;
        const valC = Number(cmp.valor_total) || 0;
        const fp = `${ymd}|${normalizarTextoChave(cmp.produto_nome)}|${qtdC}|${valC.toFixed(2)}`;
        const nfParts = String(cmp.nota_fiscal || '').split('|');
        const idCpr = nfParts[0] && /^(CPR|CMP)/i.test(nfParts[0]) ? nfParts[0] : cid.replace(/-\d{1,3}$/, '');
        const formaCpr = nfParts[1] || 'Dinheiro';
        const nfUrl = nfParts[2] && nfParts[2].indexOf('http') === 0 ? nfParts[2] : '';

        if (cid.startsWith('CMP-SH-') || syncedCompras.has(cid)) {
          // Atualiza NF tardia mesmo para compras já sincronizadas anteriormente
          if (nfUrl) {
            for (let r = 1; r < dCmp.length; r++) {
              const rYmd = Utilities.formatDate(parseDataSeguraSheet(dCmp[r][0]), 'America/Sao_Paulo', 'yyyy-MM-dd');
              const rIdCpr = String(dCmp[r][7] || '').trim();
              if (rIdCpr === idCpr && rYmd === ymd) {
                const formulaAtual = String(shCompras.getRange(r + 1, 9).getFormula() || '');
                if (formulaAtual.indexOf(nfUrl) === -1) {
                  shCompras.getRange(r + 1, 9).setFormula(`=HYPERLINK("${nfUrl}";"📎 Ver NF (${idCpr})")`);
                  atualizados.financeiro++;
                }
              }
            }
          }
          return;
        }

        if (!fpCompras.has(fp)) {
          const linkNf = nfUrl || (typeof gerarLinkUploadNF === 'function' ? gerarLinkUploadNF(idCpr) : '');
          const labelNf = nfUrl ? `📎 Ver NF (${idCpr})` : '📎 Enviar NF';
          inserirLinhaNoTopoPlanilha(shCompras, [
            dtCmp,
            cmp.produto_nome,
            qtdC,
            valC,
            cmp.fornecedor || 'Fornecedor',
            formaCpr,
            'ATIVO',
            idCpr,
            linkNf ? `=HYPERLINK("${linkNf}";"${labelNf}")` : '',
            '',
            '',
            cmp.operador || 'WEB',
            dtCmp
          ]);
          fpCompras.add(fp);
          inseriuCompraNova = true;
          atualizados.financeiro++;
        } else if (nfUrl) {
          for (let r = 1; r < dCmp.length; r++) {
            if (String(dCmp[r][7] || '').trim() === idCpr) {
              shCompras.getRange(r + 1, 9).setFormula(`=HYPERLINK("${nfUrl}";"📎 Ver NF (${idCpr})")`);
            }
          }
        }
        syncedCompras.add(cid);
        alterouCmp = true;
      });
      if (alterouCmp) salvarConjuntoIdsSincronizados('SYNCED_COMPRAS_IDS', syncedCompras);
      if (inseriuCompraNova && typeof gerarRelatorioComprasSilencioso === 'function') {
        try { gerarRelatorioComprasSilencioso(); } catch (eRelCmp) {}
      }
    }

    // ------------------------------------------------------------------
    // 9. USUARIOS
    // ------------------------------------------------------------------
    const shUser = ss.getSheetByName('USUARIOS');
    if (shUser && Array.isArray(usuariosSupa)) {
      const dU = shUser.getDataRange().getValues();
      const idxU = {};
      for (let i = 1; i < dU.length; i++) {
        const idu = String(dU[i][0] || '').trim();
        if (idu) idxU[idu] = i + 1;
      }
      usuariosSupa.forEach(u => {
        if (!u.id || u.id === 'U-ADMIN-01' || u.perfil === 'ADMIN') return;
        const rowU = idxU[u.id];
        const ativoTxt = u.ativo !== false ? 'SIM' : 'NÃO';
        if (rowU) {
          shUser.getRange(rowU, 2).setValue(u.nome);
          shUser.getRange(rowU, 3).setValue(u.email || '');
          if (u.senha_hash) shUser.getRange(rowU, 4).setValue(u.senha_hash);
          shUser.getRange(rowU, 5).setValue(u.perfil);
          shUser.getRange(rowU, 6).setValue(ativoTxt);
          if (u.ultimo_acesso) shUser.getRange(rowU, 8).setValue(parseDataSeguraSheet(u.ultimo_acesso));
          if (u.telegram_chat_id) shUser.getRange(rowU, 9).setValue(u.telegram_chat_id);
        } else {
          shUser.appendRow([
            u.id,
            u.nome,
            u.email || '',
            u.senha_hash || '',
            u.perfil || 'VENDEDOR',
            ativoTxt,
            new Date(),
            u.ultimo_acesso ? parseDataSeguraSheet(u.ultimo_acesso) : '',
            u.telegram_chat_id || ''
          ]);
          atualizados.usuarios++;
        }
      });
    }

    // ------------------------------------------------------------------
    // 10. CONFERÊNCIA DE CAIXA & FECHAMENTO FISCAL (AUDITORIA ➔ PLANILHA)
    // ------------------------------------------------------------------
    try {
      const logsAudSupa =
        supabaseRequest(
          'auditoria_logs?select=*&order=data_hora.asc&limit=200',
          'GET'
        ) || [];

      const extrairMoedaLog = (txt, regex) => {
        const m = String(txt || '').match(regex);
        if (!m || !m[1]) return null;
        const raw = String(m[1]).replace(/\u00A0/g, ' ').trim();
        const neg = raw.includes('-');
        const limpo = raw.replace(/[^0-9,.-]/g, '').replace(/-/g, '').replace(/\./g, '').replace(',', '.');
        const num = parseFloat(limpo);
        if (isNaN(num)) return null;
        return neg ? -Math.abs(num) : num;
      };

      if (Array.isArray(logsAudSupa) && logsAudSupa.length > 0) {
        const shConf =
          typeof obterAbaConferenciaCaixa === 'function'
            ? obterAbaConferenciaCaixa(ss)
            : ss.getSheetByName('CONFERENCIA_CAIXA');
        const shFisc =
          typeof obterAbaFechamentoFiscal === 'function'
            ? obterAbaFechamentoFiscal(ss)
            : ss.getSheetByName('FECHAMENTO_FISCAL');

        const protocolosConf = new Set();
        if (shConf && shConf.getLastRow() > 1) {
          const dConf = shConf.getRange(2, 1, shConf.getLastRow() - 1, 1).getValues();
          dConf.forEach(r => {
            const p = String(r[0] || '').trim();
            if (p) protocolosConf.add(p);
          });
        }

        const protocolosFisc = new Set();
        if (shFisc && shFisc.getLastRow() > 1) {
          const dFisc = shFisc.getRange(2, 1, shFisc.getLastRow() - 1, Math.min(shFisc.getLastColumn(), 7)).getValues();
          dFisc.forEach(r => {
            const obsF = String(r[6] || '');
            const mId = obsF.match(/\[([A-Za-z0-9-]+)\]/);
            if (mId && mId[1]) protocolosFisc.add(mId[1]);
          });
        }

        logsAudSupa.forEach(lg => {
          const idLog = String(lg.id || '').trim();
          if (!idLog) return;
          const dtLog = parseDataSeguraSheet(lg.data_hora);
          const det = String(lg.detalhes || '');

          if (lg.acao === 'CONFERENCIA_CAIXA' && shConf && !protocolosConf.has(idLog)) {
            const totalDia = extrairMoedaLog(det, /(?:Total Dia|Sistema):\s*([-\sR$0-9.,]+)/i);
            const entradasVal = extrairMoedaLog(det, /Entradas:\s*([-\sR$0-9.,]+)/i);
            const saidasVal = extrairMoedaLog(det, /Sa[ií]das:\s*([-\sR$0-9.,]+)/i);
            const esperadoVal = extrairMoedaLog(det, /Esperado[^:]*:\s*([-\sR$0-9.,]+)/i);
            const contadoVal = extrairMoedaLog(det, /Contado:\s*([-\sR$0-9.,]+)/i);
            const difVal = extrairMoedaLog(det, /Diferen[cç]a:\s*([-\sR$0-9.,]+)/i);

            const saldoSis = esperadoVal !== null ? esperadoVal : (totalDia !== null ? totalDia : 0);
            const entFinal = entradasVal !== null ? entradasVal : (totalDia !== null ? Math.max(0, totalDia) : Math.max(0, saldoSis));
            const saiFinal = saidasVal !== null ? saidasVal : 0;
            const contFinal = contadoVal !== null ? contadoVal : saldoSis;
            const difFinal = difVal !== null ? difVal : Number((contFinal - saldoSis).toFixed(2));

            const mGestor = det.match(/Gestor:\s*([^|]+)/i);
            const gestorNome = mGestor ? mGestor[1].trim() : 'Admin';
            const autoAprov = /Auto-Aprovado:\s*SIM/i.test(det) || String(lg.usuario || '').toLowerCase() === 'admin';
            const statusConf = autoAprov ? 'APROVADO' : 'AGUARDANDO APROVAÇÃO';

            inserirLinhaNoTopoPlanilha(shConf, [
              idLog,
              dtLog,
              entFinal,
              saiFinal,
              saldoSis,
              contFinal,
              difFinal,
              statusConf,
              lg.usuario || 'Operador',
              gestorNome,
              autoAprov ? dtLog : '',
              det
            ]);
            try {
              shConf.getRange(2, 2).setNumberFormat('dd/MM/yyyy HH:mm:ss');
              shConf.getRange(2, 3, 1, 5).setNumberFormat('R$ #,##0.00');
              if (autoAprov) shConf.getRange(2, 11).setNumberFormat('dd/MM/yyyy HH:mm:ss');
            } catch (eFmtC) {}
            protocolosConf.add(idLog);
            atualizados.financeiro++;
          } else if (lg.acao === 'FECHAMENTO_FISCAL' && shFisc && !protocolosFisc.has(idLog)) {
            const entF = extrairMoedaLog(det, /Entradas:\s*([-\sR$0-9.,]+)/i) || 0;
            const saiF = extrairMoedaLog(det, /Sa[ií]das:\s*([-\sR$0-9.,]+)/i) || 0;
            const salF = extrairMoedaLog(det, /Saldo:\s*([-\sR$0-9.,]+)/i);
            const saldoFinal = salF !== null ? salF : Number((entF - saiF).toFixed(2));
            const dtRefFmt = Utilities.formatDate(dtLog, 'America/Sao_Paulo', 'dd/MM/yyyy');

            inserirLinhaNoTopoPlanilha(shFisc, [
              dtRefFmt,
              entF,
              saiF,
              saldoFinal,
              dtLog,
              lg.usuario || 'Admin',
              `${det} [${idLog}]`
            ]);
            try {
              shFisc.getRange(2, 2, 1, 3).setNumberFormat('R$ #,##0.00');
              shFisc.getRange(2, 5).setNumberFormat('dd/MM/yyyy HH:mm:ss');
            } catch (eFmtF) {}
            protocolosFisc.add(idLog);
            atualizados.financeiro++;
          }
        });
        atualizados.conferenciasPlanilha = shConf ? Math.max(0, shConf.getLastRow() - 1) : 0;
        atualizados.fechamentosPlanilha = shFisc ? Math.max(0, shFisc.getLastRow() - 1) : 0;
      }
    } catch (eAudSync) {
      atualizados.auditoriaErro = eAudSync.message;
      console.warn('Aviso ao sincronizar CONFERENCIA_CAIXA/FECHAMENTO_FISCAL:', eAudSync.message);
    }

    try {
      if (typeof gerarRelatorioFinanceiroCompletoSilencioso === 'function') {
        gerarRelatorioFinanceiroCompletoSilencioso(false);
      }
    } catch (eRelFin) {
      console.warn('Aviso ao atualizar RELATORIO_FINANCEIRO:', eRelFin.message);
    }

    try {
      SpreadsheetApp.flush();
    } catch (eFlush) {}

    const msgRes =
      `⬇️ Sincronização Supabase ➔ Planilha concluída! ` +
      `Config: ${atualizados.config}, Produtos: ${atualizados.produtos}, Clientes: ${atualizados.clientes}, ` +
      `Comandas: ${atualizados.comandas}, Delivery: ${atualizados.delivery}, Vendas: ${atualizados.vendas}, Caixa: ${atualizados.caixa}`;
    console.log(msgRes);

    if (!silencioso && typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getActive()) {
      try {
        SpreadsheetApp.getUi().alert('⬇️ Supabase ➔ Planilha', msgRes, SpreadsheetApp.getUi().ButtonSet.OK);
      } catch (eUi) {}
    }
    return { ok: true, atualizados: atualizados, msg: msgRes };
  } catch (err) {
    console.error('Erro em sincronizarSupabaseParaPlanilha:', err.message);
    if (!silencioso && typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getActive()) {
      try {
        SpreadsheetApp.getUi().alert('❌ Erro na Sincronização', err.message, SpreadsheetApp.getUi().ButtonSet.OK);
      } catch (eUi) {}
    }
    return { ok: false, msg: err.message };
  } finally {
    let rodarNovamente = false;
    try {
      const props = PropertiesService.getScriptProperties();
      if (props.getProperty('SYNC_SUPABASE_PENDENTE') === 'SIM') {
        props.deleteProperty('SYNC_SUPABASE_PENDENTE');
        rodarNovamente = true;
      }
    } catch (eProp) {}
    try {
      lock.releaseLock();
    } catch (e) {}
    if (rodarNovamente) {
      try {
        sincronizarSupabaseParaPlanilha(true);
      } catch (eRe) {}
    }
  }
}

// ====================================================================
// 🔄 ORQUESTRADORES, GATILHO 5 MIN & BRIDGE WEBAPP
// ====================================================================

function sincronizarPlanilhaParaSupabaseSilencioso() {
  try {
    const cache = CacheService.getScriptCache();
    if (cache.get('LOCK_SYNC_SHEET_SUPA')) {
      return { ok: true, ignorado: true, msg: 'Debounced' };
    }
    cache.put('LOCK_SYNC_SHEET_SUPA', '1', 3);
    return migrarTudoPlanilhaParaSupabase(true);
  } catch (e) {
    console.warn('Erro em sincronizarPlanilhaParaSupabaseSilencioso:', e.message);
    return { ok: false, msg: e.message };
  }
}

function sincronizarTudoBidirecional(silencioso) {
  const pullRes = sincronizarSupabaseParaPlanilha(true);
  const pushRes = migrarTudoPlanilhaParaSupabase(true);
  const msgFinal =
    `🔄 Sincronização Bidirecional 360° Concluída!\n\n` +
    `1) Supabase ➔ Planilha: ${pullRes.ok ? 'OK' : pullRes.msg}\n` +
    `2) Planilha ➔ Supabase: ${pushRes.ok ? pushRes.msg : pushRes.msg}`;

  if (!silencioso && typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getActive()) {
    try {
      SpreadsheetApp.getUi().alert('🔄 Sincronização Bidirecional', msgFinal, SpreadsheetApp.getUi().ButtonSet.OK);
    } catch (eUi) {}
  }
  return {
    ok: Boolean(pullRes.ok && pushRes.ok),
    pull: pullRes,
    push: pushRes,
    msg: msgFinal
  };
}

function sincronizarTudoBidirecionalComUi() {
  return sincronizarTudoBidirecional(false);
}

function sincronizarSupabaseParaPlanilhaComUi() {
  return sincronizarSupabaseParaPlanilha(false);
}

function sincronizarAutomaticoSupabase() {
  return sincronizarTudoBidirecional(true);
}

function instalarGatilhoSyncSupabase(silencioso) {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(tr => {
      if (tr.getHandlerFunction() === 'sincronizarAutomaticoSupabase') {
        ScriptApp.deleteTrigger(tr);
      }
    });
    ScriptApp.newTrigger('sincronizarAutomaticoSupabase')
      .timeBased()
      .everyMinutes(5)
      .create();

    const msg = '⏱️ Gatilho de sincronização automática (a cada 5 minutos) ativado com sucesso!';
    if (!silencioso && typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getActive()) {
      try {
        SpreadsheetApp.getUi().alert('✅ Sincronização Automática Ativa', msg, SpreadsheetApp.getUi().ButtonSet.OK);
      } catch (eUi) {}
    }
    return { ok: true, msg: msg };
  } catch (e) {
    const errMsg = 'Erro ao instalar gatilho automático: ' + e.message;
    if (!silencioso && typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getActive()) {
      try {
        SpreadsheetApp.getUi().alert('❌ Erro no Gatilho', errMsg, SpreadsheetApp.getUi().ButtonSet.OK);
      } catch (eUi) {}
    }
    return { ok: false, msg: errMsg };
  }
}

function repararPedidoLegadoPlanilha(dePedido, paraPedido) {
  const deTxt = String(dePedido || '').trim();
  const paraTxt = String(paraPedido || '').trim();
  if (!deTxt || !paraTxt) return { ok: false, msg: 'Informe de/para.' };

  const ss = SpreadsheetApp.getActive();
  const paraVal = /^\d+$/.test(paraTxt) ? Number(paraTxt) : paraTxt;
  let alteracoes = 0;

  const shCom = ss.getSheetByName('COMANDAS');
  if (shCom && shCom.getLastRow() > 1) {
    const dCom = shCom.getDataRange().getValues();
    let jaTemPara = false;
    for (let i = 1; i < dCom.length; i++) {
      if (String(dCom[i][0] || '').trim() === paraTxt) {
        jaTemPara = true;
        shCom.getRange(i + 1, 1).setValue(paraVal);
        const orig = String(dCom[i][3] || '').toUpperCase().trim();
        if (orig !== 'BALCAO' && orig !== 'TELEGRAM') {
          shCom.getRange(i + 1, 4).setValue('BALCAO');
        }
      }
    }
    for (let i = dCom.length - 1; i >= 1; i--) {
      const pedAtual = String(dCom[i][0] || '').trim();
      if (pedAtual === deTxt) {
        if (jaTemPara) {
          shCom.deleteRow(i + 1);
          alteracoes++;
        } else {
          shCom.getRange(i + 1, 1).setValue(paraVal);
          shCom.getRange(i + 1, 4).setValue('BALCAO');
          jaTemPara = true;
          alteracoes += 2;
        }
      }
    }
  }

  const shCmi = ss.getSheetByName('COMANDA_ITENS');
  if (shCmi && shCmi.getLastRow() > 1) {
    const dCmi = shCmi.getDataRange().getValues();
    const vistosPara = new Set();
    for (let i = 1; i < dCmi.length; i++) {
      if (String(dCmi[i][0] || '').trim() === paraTxt) {
        vistosPara.add(`${normalizarTextoChave(dCmi[i][1])}|${Number(dCmi[i][2]) || 0}|${Number(dCmi[i][4]) || 0}`);
      }
    }
    for (let i = dCmi.length - 1; i >= 1; i--) {
      if (String(dCmi[i][0] || '').trim() === deTxt) {
        const fp = `${normalizarTextoChave(dCmi[i][1])}|${Number(dCmi[i][2]) || 0}|${Number(dCmi[i][4]) || 0}`;
        if (vistosPara.has(fp)) {
          shCmi.deleteRow(i + 1);
          alteracoes++;
        } else {
          shCmi.getRange(i + 1, 1).setValue(paraVal);
          vistosPara.add(fp);
          alteracoes++;
        }
      }
    }
  }

  try {
    SpreadsheetApp.flush();
  } catch (e) {}

  return { ok: true, alteracoes: alteracoes, msg: `Reparado ${deTxt} -> ${paraTxt} (${alteracoes} alterações).` };
}

function calcularStatusEstoquePadrao(qtd, minimo) {
  const q = Number(qtd) || 0;
  const m = Number(minimo) || 0;
  if (q <= 0) return '🚫 ESGOTADO';
  if (q < m) return '🔴 Crítico🪫';
  return '🟢   OK   🔋';
}

function formatarIdVendaPlanilha(origem, pedidoId, dt) {
  const orig = normalizarTextoChave(origem);
  const ped = String(pedidoId || '').trim();
  const mNum = ped.match(/^(?:C-0*|D-0*|#)?(\d+)$/i);
  if (orig.includes('COMANDA') && mNum) {
    return 'C-' + String(Number(mNum[1])).padStart(6, '0');
  }
  if (orig.includes('DELIVERY') && mNum) {
    return 'D-' + String(Number(mNum[1])).padStart(6, '0');
  }
  if (ped && !/^(ADMIN|BALCAO|BALCÃO|VENDEDOR|DONO|GERENTE|OPERADOR)$/i.test(ped)) {
    return ped;
  }
  const d = dt instanceof Date && !isNaN(dt.getTime()) ? dt : parseDataSeguraSheet(dt);
  return 'B-' + Utilities.formatDate(d, 'America/Sao_Paulo', 'yyyyMMdd-HHmmss');
}

function corrigirIdsEEstoquePlanilha() {
  const ss = SpreadsheetApp.getActive();
  const alteracoes = [];

  // 1. PADRONIZA ID_VENDA NA ABA VENDAS
  const shVendas = ss.getSheetByName('VENDAS');
  if (shVendas && shVendas.getLastRow() > 1) {
    const dV = shVendas.getDataRange().getValues();
    let vCorrigidos = 0;
    for (let i = 1; i < dV.length; i++) {
      const dtV = parseDataSeguraSheet(dV[i][0]);
      const orig = String(dV[i][5] || 'Balcão').trim();
      const idAtual = String(dV[i][6] || '').trim();
      let idNovo = idAtual;

      const origNorm = normalizarTextoChave(orig);
      if (origNorm.includes('COMANDA')) {
        const mC = idAtual.match(/^(?:C-0*|#)?(\d+)$/i);
        if (mC) idNovo = 'C-' + String(Number(mC[1])).padStart(6, '0');
      } else if (origNorm.includes('DELIVERY')) {
        const mD = idAtual.match(/^(?:D-0*|#)?(\d+)$/i);
        if (mD) {
          idNovo = 'D-' + String(Number(mD[1])).padStart(6, '0');
        } else if (!idAtual || /^(admin|delivery)$/i.test(idAtual)) {
          // Tenta casar com o pedido na aba DELIVERY pelo valor/data
          const shDel = ss.getSheetByName('DELIVERY');
          let pedDel = '';
          if (shDel && shDel.getLastRow() > 1) {
            const dDel = shDel.getDataRange().getValues();
            for (let j = 1; j < dDel.length; j++) {
              const pStr = String(dDel[j][0] || '').trim();
              if (/^\d+$/.test(pStr)) {
                pedDel = pStr;
                break;
              }
            }
          }
          idNovo = pedDel ? 'D-' + String(Number(pedDel)).padStart(6, '0') : 'D-' + Utilities.formatDate(dtV, 'America/Sao_Paulo', 'yyyyMMdd-HHmmss');
        }
      } else {
        if (!idAtual || /^(admin|balcao|balcão|vendedor|dono|gerente)$/i.test(idAtual)) {
          idNovo = 'B-' + Utilities.formatDate(dtV, 'America/Sao_Paulo', 'yyyyMMdd-HHmmss');
        }
      }

      if (idNovo !== idAtual) {
        shVendas.getRange(i + 1, 7).setValue(idNovo);
        vCorrigidos++;
      }
    }
    if (vCorrigidos > 0) alteracoes.push(`VENDAS: ${vCorrigidos} ID(s) padronizado(s) (C-0000XX / D-0000XX / B-YYYYMMDD-HHMMSS)`);
  }

  // 1.5 PADRONIZA IDs GENÉRICOS (PAG-...) EM CONTAS_A_PAGAR PARA AVULSA_000X
  const shPagFix = ss.getSheetByName('CONTAS_A_PAGAR');
  if (shPagFix && shPagFix.getLastRow() > 1) {
    const dPagFix = shPagFix.getDataRange().getValues();
    let maxAv = 0;
    const temAvulsa = new Set();
    for (let i = 1; i < dPagFix.length; i++) {
      const idStr = String(dPagFix[i][0] || '').trim();
      const mAv = idStr.match(/^AVULSA_0*(\d+)$/i);
      if (mAv) {
        maxAv = Math.max(maxAv, Number(mAv[1]));
        temAvulsa.add(idStr);
      }
    }
    let pagCorrigidos = 0;
    for (let i = dPagFix.length - 1; i >= 1; i--) {
      const idAnt = String(dPagFix[i][0] || '').trim();
      if (/^PAG-/i.test(idAnt)) {
        if (temAvulsa.has('AVULSA_0001') && idAnt === 'PAG-MWRQGQDE-COSKU') {
          shPagFix.deleteRow(i + 1);
          pagCorrigidos++;
        } else {
          maxAv++;
          const novoAv = 'AVULSA_' + String(maxAv).padStart(4, '0');
          shPagFix.getRange(i + 1, 1).setValue(novoAv);
          temAvulsa.add(novoAv);
          pagCorrigidos++;
        }
      }
    }
    if (pagCorrigidos > 0) alteracoes.push(`CONTAS_A_PAGAR: ${pagCorrigidos} ID(s) genérico(s) padronizado(s) para AVULSA_000X`);
  }

  // 2. PADRONIZA CONTAS_A_RECEBER (ID CR-0000XX + Referencia C-0000XX + Cabeçalho Data)
  const shRec = ss.getSheetByName('CONTAS_A_RECEBER');
  if (shRec && shRec.getLastRow() > 1) {
    if (!String(shRec.getRange(1, 10).getValue() || '').trim()) {
      shRec.getRange(1, 10).setValue('Data').setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff').setHorizontalAlignment('center');
    }
    const dR = shRec.getDataRange().getValues();
    let maxCr = 0;
    for (let i = 1; i < dR.length; i++) {
      const m = String(dR[i][0] || '').match(/^CR-0*(\d+)$/i);
      if (m) maxCr = Math.max(maxCr, Number(m[1]));
    }
    let rCorrigidos = 0;
    for (let i = 1; i < dR.length; i++) {
      const idAntigo = String(dR[i][0] || '').trim();
      const origAtual = String(dR[i][1] || '').trim();
      const refAtual = String(dR[i][2] || '').trim();
      let idNovo = idAntigo;
      let origNovo = origAtual;
      let refNovo = refAtual;

      if (idAntigo && !/^CR-\d{6}$/i.test(idAntigo)) {
        maxCr++;
        idNovo = 'CR-' + String(maxCr).padStart(6, '0');
      }
      if (/^\d+$/.test(refAtual)) {
        refNovo = 'C-' + String(Number(refAtual)).padStart(6, '0');
        if (origAtual.toUpperCase() === 'BALCAO' || origAtual.toUpperCase() === 'BALCÃO') {
          origNovo = 'COMANDA';
        }
      }
      if (idNovo !== idAntigo || origNovo !== origAtual || refNovo !== refAtual) {
        shRec.getRange(i + 1, 1, 1, 3).setValues([[idNovo, origNovo, refNovo]]);
        rCorrigidos++;
        // Atualiza no Supabase se o ID mudou (remove o REC- antigo para o sync gravar o CR- novo)
        if (idNovo !== idAntigo && idAntigo.startsWith('REC-')) {
          try {
            supabaseRequest(`contas_a_receber?id=eq.${encodeURIComponent(idAntigo)}`, 'DELETE');
          } catch (eDelRec) {}
        }
      }
    }
    if (rCorrigidos > 0) alteracoes.push(`CONTAS_A_RECEBER: ${rCorrigidos} registro(s) padronizado(s) para CR-0000XX / C-0000XX`);
  }

  // 3. GARANTE CABEÇALHO "Descrição" NA ABA CAIXA (F1)
  const shCaixa = ss.getSheetByName('CAIXA');
  if (shCaixa && !String(shCaixa.getRange(1, 6).getValue() || '').trim()) {
    shCaixa.getRange(1, 6).setValue('Descrição').setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff').setHorizontalAlignment('center');
    alteracoes.push('CAIXA: Cabeçalho F1 ("Descrição") restaurado');
  }

  // 4. PADRONIZA STATUS E REMOVE DUPLICATAS NA ABA ESTOQUE
  const shEst = ss.getSheetByName('ESTOQUE');
  if (shEst && shEst.getLastRow() > 1) {
    const dEst = shEst.getDataRange().getValues();
    const vistos = {};
    const linhasLimpas = [];
    let dupRemovidas = 0;
    let statusCorrigidos = 0;

    for (let i = 1; i < dEst.length; i++) {
      const prod = String(dEst[i][0] || '').trim();
      if (!prod) continue;
      const key = normalizarTextoChave(prod);
      const qtd = Number(dEst[i][1]) || 0;
      const min = Number(dEst[i][2]) || 0;
      const statusAtual = String(dEst[i][3] || '').trim();
      const motivo = String(dEst[i][4] || '').trim();
      const statusPadrao = calcularStatusEstoquePadrao(qtd, min);

      if (vistos[key] !== undefined) {
        // Mantém a linha com maior estoque ou com motivo preenchido
        const prevIdx = vistos[key];
        const prevQtd = Number(linhasLimpas[prevIdx][1]) || 0;
        if (qtd > prevQtd || (!linhasLimpas[prevIdx][4] && motivo)) {
          linhasLimpas[prevIdx] = [prod, qtd, min, statusPadrao, motivo];
        }
        dupRemovidas++;
        continue;
      }

      if (statusAtual !== statusPadrao) statusCorrigidos++;
      vistos[key] = linhasLimpas.length;
      linhasLimpas.push([prod, qtd, min, statusPadrao, motivo]);
    }

    // Ordena: com estoque (>0) primeiro, depois ordem alfabética
    linhasLimpas.sort((a, b) => {
      const ha = (Number(a[1]) || 0) > 0 ? 1 : 0;
      const hb = (Number(b[1]) || 0) > 0 ? 1 : 0;
      if (ha !== hb) return hb - ha;
      return String(a[0]).localeCompare(String(b[0]), 'pt-BR');
    });

    const oldRange = shEst.getRange(2, 1, shEst.getLastRow() - 1, Math.max(5, shEst.getLastColumn()));
    oldRange.clearContent();
    if (linhasLimpas.length > 0) {
      shEst
        .getRange(2, 1, linhasLimpas.length, 5)
        .setValues(linhasLimpas)
        .setBackground('#ffffff')
        .setFontColor('#000000')
        .setFontWeight('normal');
    }
    alteracoes.push(`ESTOQUE: ${statusCorrigidos} status padronizado(s) (🚫 ESGOTADO / 🔴 Crítico🪫 / 🟢   OK   🔋) e ${dupRemovidas} duplicata(s) removida(s) (${linhasLimpas.length} itens finais)`);
  }

  try {
    SpreadsheetApp.flush();
  } catch (e) {}

  return { ok: true, alteracoes: alteracoes };
}

function auditarEOrdenarAbasTopo() {
  const ss = SpreadsheetApp.getActive();
  const abasConfig = [
    { nome: 'COMANDAS', tipo: 'DATA_NUM', colData: 1, colNum: 0 },
    { nome: 'COMANDA_ITENS', tipo: 'NUM', colNum: 0 },
    { nome: 'DELIVERY', tipo: 'DATA_NUM', colData: 1, colNum: 0 },
    { nome: 'DELIVERY_ITENS', tipo: 'NUM', colNum: 0 },
    { nome: 'COMPRAS', tipo: 'DATA', colData: 0 },
    { nome: 'VENDAS', tipo: 'DATA', colData: 0 },
    { nome: 'CONTAS_A_PAGAR', tipo: 'DATA', colData: 4 },
    { nome: 'CONTAS_A_RECEBER', tipo: 'DATA', colData: 9 },
    { nome: 'RELATORIO_COMPRAS', tipo: 'DATA', colData: 0 },
    { nome: 'RELATORIO_DE_COMPRAS', tipo: 'DATA', colData: 0 },
    { nome: 'SESSOES', tipo: 'DATA', colData: 2 },
    { nome: 'AUDITORIA_USUARIOS', tipo: 'DATA', colData: 0 },
    { nome: 'CAIXA', tipo: 'DATA', colData: 0 },
    { nome: 'CONFERENCIA_CAIXA', tipo: 'DATA', colData: 1 },
    { nome: 'FECHAMENTO_FISCAL', tipo: 'DATA_FALLBACK', colData: 4, colFallback: 0 },
    { nome: 'LOG_SISTEMA', tipo: 'DATA_HORA', colData: 0, colHora: 1 }
  ];

  const extrairMs = val => {
    if (val instanceof Date && !isNaN(val.getTime())) return val.getTime();
    const s = String(val || '').trim();
    if (!s) return 0;
    const mBr = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (mBr) {
      return new Date(
        Number(mBr[3]),
        Number(mBr[2]) - 1,
        Number(mBr[1]),
        Number(mBr[4] || 0),
        Number(mBr[5] || 0),
        Number(mBr[6] || 0)
      ).getTime();
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };

  const extrairNum = val => {
    const n = Number(String(val || '').replace(/[^0-9.-]/g, ''));
    return isNaN(n) ? 0 : n;
  };

  const relatorio = [];
  const correcoes = [];

  abasConfig.forEach(cfg => {
    const sh = ss.getSheetByName(cfg.nome);
    if (!sh) return;
    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();
    if (lastRow <= 1 || lastCol < 1) {
      relatorio.push({ aba: cfg.nome, linhas: 0, status: 'VAZIA' });
      return;
    }

    // Usa getFormulas + getValues para preservar fórmulas (ex: HYPERLINK em COMPRAS)
    const rangeDados = sh.getRange(2, 1, lastRow - 1, lastCol);
    const vals = rangeDados.getValues();
    const forms = rangeDados.getFormulas();

    const linhasCombinadas = [];
    let vaziasRemovidas = 0;

    for (let i = 0; i < vals.length; i++) {
      const rowV = vals[i];
      const rowF = forms[i];
      const temConteudo = rowV.some(c => String(c || '').trim() !== '');
      if (!temConteudo) {
        vaziasRemovidas++;
        continue;
      }

      // Correção específica de números corrompidos em CONFERENCIA_CAIXA (FECH-LEGADO)
      if (cfg.nome === 'CONFERENCIA_CAIXA' && lastCol >= 5) {
        const entVal = Number(rowV[2]);
        const saiVal = Number(rowV[3]) || 0;
        const salVal = Number(rowV[4]) || 0;
        if (!isNaN(entVal) && Math.abs(entVal) > 1000000) {
          const entCorrigida = Number((salVal + saiVal).toFixed(2));
          rowV[2] = entCorrigida;
          correcoes.push(`CONFERENCIA_CAIXA ${rowV[0]}: Entradas corrompidas (${entVal}) corrigidas para ${entCorrigida}`);
        }
      }

      let chavePrimaria = 0;
      let chaveSecundaria = i;
      if (cfg.tipo === 'DATA') {
        chavePrimaria = extrairMs(rowV[cfg.colData]);
      } else if (cfg.tipo === 'DATA_NUM') {
        chavePrimaria = extrairMs(rowV[cfg.colData]);
        chaveSecundaria = extrairNum(rowV[cfg.colNum]);
      } else if (cfg.tipo === 'NUM') {
        chavePrimaria = extrairNum(rowV[cfg.colNum]);
      } else if (cfg.tipo === 'DATA_FALLBACK') {
        chavePrimaria = extrairMs(rowV[cfg.colData]) || extrairMs(rowV[cfg.colFallback]);
      } else if (cfg.tipo === 'DATA_HORA') {
        const dStr = rowV[cfg.colData] instanceof Date
          ? Utilities.formatDate(rowV[cfg.colData], 'America/Sao_Paulo', 'yyyy-MM-dd')
          : String(rowV[cfg.colData] || '').trim();
        const hStr = rowV[cfg.colHora] instanceof Date
          ? Utilities.formatDate(rowV[cfg.colHora], 'America/Sao_Paulo', 'HH:mm:ss')
          : String(rowV[cfg.colHora] || '00:00:00').trim();
        chavePrimaria = extrairMs(`${dStr}T${hStr}`);
      }

      const rowOut = rowV.map((v, idx) => (rowF[idx] ? rowF[idx] : v));
      linhasCombinadas.push({ rowOut, chavePrimaria, chaveSecundaria, origIdx: i });
    }

    // Ordenação DESC (mais recente na linha 2 -> mais antigo no fim)
    linhasCombinadas.sort((a, b) => {
      if (b.chavePrimaria !== a.chavePrimaria) return b.chavePrimaria - a.chavePrimaria;
      if (b.chaveSecundaria !== a.chaveSecundaria) return b.chaveSecundaria - a.chaveSecundaria;
      return b.origIdx - a.origIdx;
    });

    if (linhasCombinadas.length > 0) {
      const matrizFinal = linhasCombinadas.map(x => x.rowOut);
      // Limpa conteúdo antigo e grava ordenado
      rangeDados.clearContent();
      const targetRange = sh.getRange(2, 1, matrizFinal.length, lastCol);
      targetRange
        .setValues(matrizFinal)
        .setBackground('#ffffff')
        .setFontColor('#000000')
        .setFontWeight('normal');

      if (vaziasRemovidas > 0) {
        correcoes.push(`${cfg.nome}: ${vaziasRemovidas} linha(s) em branco removida(s)`);
      }
    }

    const topoAmostra = linhasCombinadas.length > 0 ? String(linhasCombinadas[0].rowOut[0] || '') : '';
    const topoData = linhasCombinadas.length > 0 && cfg.colData !== undefined
      ? String(linhasCombinadas[0].rowOut[cfg.colData] || '')
      : '';
    relatorio.push({
      aba: cfg.nome,
      linhas: linhasCombinadas.length,
      topoColA: topoAmostra,
      topoData: topoData.slice(0, 24)
    });
  });

  try {
    SpreadsheetApp.flush();
  } catch (e) {}

  return {
    ok: true,
    abasOrdenadas: relatorio.length,
    correcoes: correcoes,
    relatorio: relatorio
  };
}

function analisarNotaFiscalWebApp(payload) {
  try {
    const b64 = String((payload && payload.base64) || '');
    if (!b64) return { ok: false, msg: 'Arquivo em base64 não enviado.' };
    const mime = String((payload && payload.mimeType) || 'image/jpeg');
    const fileName = String((payload && payload.fileName) || 'nota_fiscal.jpg');
    const bytes = Utilities.base64Decode(b64);
    const blob = Utilities.newBlob(bytes, mime, fileName);

    if (typeof analisarNotaFiscalComIA !== 'function') {
      return { ok: false, msg: 'Motor analisarNotaFiscalComIA não disponível.' };
    }
    const res = analisarNotaFiscalComIA(blob);
    if (!res || !res.sucesso) {
      return { ok: false, msg: (res && res.msg) || 'Não foi possível ler os dados da nota fiscal.' };
    }

    const prodsDb = typeof obterListaNomesProdutosCadastrados === 'function' ? obterListaNomesProdutosCadastrados() : [];
    const itensMapeados = Array.isArray(res.itens)
      ? res.itens.map(it => {
          const nomeMatch =
            typeof encontrarMelhorProdutoCorrespondente === 'function'
              ? encontrarMelhorProdutoCorrespondente(it.produto || '', prodsDb)
              : it.produto || '';
          const qtd = Number(it.qtd) || 1;
          const unit = Number(it.unit) || (qtd > 0 ? Number(it.total || 0) / qtd : 0);
          return {
            produto_lido: it.produto || '',
            produto_sugerido: nomeMatch,
            qtd: qtd,
            unit: Number(unit.toFixed(2)),
            total: Number((Number(it.total) || qtd * unit).toFixed(2))
          };
        })
      : [];

    return {
      ok: true,
      fornecedor: res.fornecedor || '',
      numero_nf: res.numero_nf || '',
      chave_acesso: res.chave_acesso || '',
      data_emissao: res.data_emissao || '',
      forma_pagamento: res.forma_pagamento || '',
      valor_total: Number(res.valor_total) || 0,
      observacao: res.observacao || '',
      itens: itensMapeados
    };
  } catch (err) {
    return { ok: false, msg: 'Erro ao analisar NF: ' + err.message };
  }
}

function uploadNotaFiscalWebApp(payload) {
  try {
    const idCompra = String((payload && payload.idCompra) || '').trim();
    const b64 = String((payload && payload.base64) || '');
    if (!idCompra || !b64) {
      return { ok: false, msg: 'Informe idCompra e o arquivo em base64.' };
    }
    const mime = String((payload && payload.mimeType) || 'image/jpeg');
    const fileName = String((payload && payload.fileName) || `NF_${idCompra}.jpg`);
    const bytes = Utilities.base64Decode(b64);
    const blob = Utilities.newBlob(bytes, mime, fileName);

    let fileId = '';
    if (typeof uploadNotaFiscal === 'function') {
      fileId = uploadNotaFiscal(idCompra, blob);
    } else {
      const file = DriveApp.createFile(blob);
      file.setName(`NF_${idCompra}`);
      fileId = file.getId();
    }

    const fileUrl = `https://drive.google.com/file/d/${fileId}/view`;
    const ss = SpreadsheetApp.getActive();
    const shCompras = ss.getSheetByName('COMPRAS');
    if (shCompras && shCompras.getLastRow() > 1) {
      const dCmp = shCompras.getDataRange().getValues();
      for (let i = 1; i < dCmp.length; i++) {
        if (String(dCmp[i][7] || '').trim() === idCompra) {
          shCompras.getRange(i + 1, 9).setFormula(`=HYPERLINK("${fileUrl}";"📎 Ver NF (${idCompra})")`);
        }
      }
    }

    // Atualiza nota_fiscal no Supabase para refletir o link direto da NF no Painel Web
    try {
      const rowsSupa = supabaseRequest(`compras?nota_fiscal=ilike.${encodeURIComponent(idCompra)}*`, 'GET');
      if (Array.isArray(rowsSupa)) {
        rowsSupa.forEach(r => {
          const parts = String(r.nota_fiscal || idCompra).split('|');
          const forma = parts[1] || 'Dinheiro';
          const novoNf = `${idCompra}|${forma}|${fileUrl}`;
          supabaseRequest(`compras?id=eq.${encodeURIComponent(r.id)}`, 'PATCH', { nota_fiscal: novoNf });
        });
      }
    } catch (eSupaNf) {}

    try {
      SpreadsheetApp.flush();
    } catch (eFlush) {}

    return { ok: true, fileId: fileId, fileUrl: fileUrl, msg: `Nota Fiscal vinculada à compra ${idCompra}!` };
  } catch (err) {
    return { ok: false, msg: 'Erro no upload da NF: ' + err.message };
  }
}

function processarAcaoSyncWebApp(payload) {
  try {
    const acao = String((payload && payload.action) || 'PING').toUpperCase().trim();
    const empReq = String((payload && payload.empresa_id) || '').trim();
    const empAtual = obterEmpresaId();

    if (empReq && empReq !== empAtual) {
      return ContentService.createTextOutput(
        JSON.stringify({
          ok: false,
          msg: `Empresa ${empReq} não pertence a esta planilha (${empAtual}).`
        })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    let resultado;
    if (acao === 'PING') {
      resultado = {
        ok: true,
        empresa_id: empAtual,
        planilha_id: SpreadsheetApp.getActive().getId(),
        msg: 'Bridge Apps Script ↔ Supabase online!'
      };
    } else if (acao === 'SYNC_SUPABASE_TO_SHEET') {
      resultado = sincronizarSupabaseParaPlanilha(true);
    } else if (acao === 'SYNC_SHEET_TO_SUPABASE') {
      resultado = migrarTudoPlanilhaParaSupabase(true);
    } else if (acao === 'SYNC_BIDIRECTIONAL') {
      resultado = sincronizarTudoBidirecional(true);
    } else if (acao === 'INSTALAR_GATILHO') {
      resultado = instalarGatilhoSyncSupabase(true);
    } else if (acao === 'REPARAR_PEDIDO_LEGADO') {
      resultado = repararPedidoLegadoPlanilha(payload.de, payload.para);
    } else if (acao === 'AUDITAR_E_ORDENAR_ABAS') {
      resultado = auditarEOrdenarAbasTopo();
    } else if (acao === 'CORRIGIR_IDS_E_ESTOQUE') {
      resultado = corrigirIdsEEstoquePlanilha();
    } else if (acao === 'ATUALIZAR_RELATORIO_FINANCEIRO') {
      gerarRelatorioFinanceiroCompletoSilencioso(false);
      resultado = { ok: true, msg: 'RELATORIO_FINANCEIRO atualizado com sucesso!' };
    } else if (acao === 'ANALISAR_NF') {
      resultado = analisarNotaFiscalWebApp(payload);
    } else if (acao === 'UPLOAD_NF_DRIVE') {
      resultado = uploadNotaFiscalWebApp(payload);
    } else {
      resultado = { ok: false, msg: `Ação desconhecida: ${acao}` };
    }

    return ContentService.createTextOutput(JSON.stringify(resultado)).setMimeType(
      ContentService.MimeType.JSON
    );
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({ ok: false, msg: err.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
