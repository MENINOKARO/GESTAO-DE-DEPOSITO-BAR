/**
 * ==============================================
 * WEB APP (HTML) PARA GESTÃO DE DEPÓSITO
 * ==============================================
 * Camada web para reutilizar funções já existentes no Apps Script.
 */

function doGet(e) {
  const page = (e && e.parameter && e.parameter.page) || 'WebApp';
  const template = HtmlService.createTemplateFromFile(page);

  return template
    .evaluate()
    .setTitle('Gestão de Depósito - Web')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function executarApi(functionName, args) {
  try {
    if (!functionName || typeof functionName !== 'string') {
      throw new Error('Nome de função inválido.');
    }

    const blocked = {
      doGet: true,
      include: true,
      executarApi: true,
      safeCall_: true
    };

    if (blocked[functionName]) {
      throw new Error('Função bloqueada por segurança.');
    }

    const fn = this[functionName];
    if (typeof fn !== 'function') {
      throw new Error('Função não encontrada: ' + functionName);
    }

    const params = Array.isArray(args) ? args : [];
    const result = fn.apply(null, params);

    return { ok: true, data: result };
  } catch (error) {
    return {
      ok: false,
      error: error && error.message ? error.message : String(error)
    };
  }
}

function safeCall_(functionName, args) {
  try {
    const fn = this[functionName];
    if (typeof fn !== 'function') {
      return { ok: false, error: 'Função não encontrada: ' + functionName };
    }
    const value = fn.apply(null, Array.isArray(args) ? args : []);
    return { ok: true, value: value };
  } catch (error) {
    return {
      ok: false,
      error: error && error.message ? error.message : String(error)
    };
  }
}

function carregarAbasPosLoginWeb(emailOuUsuario) {
  const exec = [];

  const setupUsuarios = safeCall_('garantirEstruturausuarios');
  exec.push({ etapa: 'garantirEstruturausuarios', ok: setupUsuarios.ok, erro: setupUsuarios.error || null });

  const abrirPosLogin = safeCall_('abrirSistemaPosLogin', [emailOuUsuario || '']);
  exec.push({ etapa: 'abrirSistemaPosLogin', ok: abrirPosLogin.ok, erro: abrirPosLogin.error || null });

  const init = safeCall_('initSistema');
  exec.push({ etapa: 'initSistema', ok: init.ok, erro: init.error || null });

  const visibilidade = safeCall_('aplicarVisibilidadeAbasPorPerfil');
  exec.push({ etapa: 'aplicarVisibilidadeAbasPorPerfil', ok: visibilidade.ok, erro: visibilidade.error || null });

  const aquecer = safeCall_('inicializacaoSilenciosa');
  exec.push({ etapa: 'inicializacaoSilenciosa', ok: aquecer.ok, erro: aquecer.error || null });

  const sheets = SpreadsheetApp.getActive().getSheets().map((s) => s.getName());

  return {
    ok: true,
    exec: exec,
    abas: sheets
  };
}

function listarProdutosIA() {
  const viaLista = safeCall_('getListaProdutos');
  if (viaLista.ok && Array.isArray(viaLista.value) && viaLista.value.length) {
    return viaLista.value.map((p) => ({
      nome: p.nome || p.Produto || p.produto || String(p),
      preco: Number(p.preco || p['Preço'] || p.precoVenda || 0) || 0,
      custo: Number(p.custo || p['Custo Médio'] || p.custoMedio || 0) || 0,
      categoria: p.categoria || p.Categoria || ''
    }));
  }

  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('PRODUTOS');
  if (!sh) return [];

  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];

  const head = values[0].map((h) => String(h).trim().toUpperCase());
  const idxNome = head.indexOf('PRODUTO');
  const idxCategoria = head.indexOf('CATEGORIA');
  const idxPreco = head.indexOf('PREÇO') >= 0 ? head.indexOf('PREÇO') : head.indexOf('PRECO');
  const idxCusto = head.indexOf('CUSTO MÉDIO') >= 0 ? head.indexOf('CUSTO MÉDIO') : head.indexOf('CUSTO MEDIO');

  return values.slice(1).filter((r) => r[idxNome]).map((r) => ({
    nome: String(r[idxNome] || '').trim(),
    categoria: idxCategoria >= 0 ? String(r[idxCategoria] || '') : '',
    preco: idxPreco >= 0 ? Number(r[idxPreco] || 0) : 0,
    custo: idxCusto >= 0 ? Number(r[idxCusto] || 0) : 0
  }));
}

function obterProdutoIA(nomeProduto) {
  const nome = String(nomeProduto || '').trim().toLowerCase();
  const produtos = listarProdutosIA();
  return produtos.find((p) => String(p.nome).toLowerCase() === nome) || null;
}

function buscarReferenciaMercado(produtoNome) {
  const termo = encodeURIComponent(String(produtoNome || '').trim());
  if (!termo) {
    return { ok: false, erro: 'Produto não informado.' };
  }

  try {
    const url = 'https://api.mercadolibre.com/sites/MLB/search?q=' + termo + '&limit=8';
    const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
    const code = resp.getResponseCode();

    if (code < 200 || code >= 300) {
      return { ok: false, erro: 'Falha ao consultar referência externa. HTTP ' + code };
    }

    const payload = JSON.parse(resp.getContentText() || '{}');
    const results = Array.isArray(payload.results) ? payload.results : [];

    const itens = results.map((r) => ({
      titulo: r.title || '',
      preco: Number(r.price || 0) || 0,
      link: r.permalink || ''
    })).filter((i) => i.preco > 0);

    if (!itens.length) {
      return { ok: false, erro: 'Sem resultados de referência para este produto.' };
    }

    const precos = itens.map((i) => i.preco);
    const media = precos.reduce((a, b) => a + b, 0) / precos.length;

    return {
      ok: true,
      fonte: 'Mercado Livre',
      produto: decodeURIComponent(termo),
      media: Number(media.toFixed(2)),
      minimo: Number(Math.min.apply(null, precos).toFixed(2)),
      maximo: Number(Math.max.apply(null, precos).toFixed(2)),
      amostra: itens.slice(0, 5)
    };
  } catch (error) {
    return { ok: false, erro: error && error.message ? error.message : String(error) };
  }
}

function sugerirPrecoIA(produtoNome) {
  const produto = obterProdutoIA(produtoNome);
  if (!produto) {
    return { ok: false, erro: 'Produto não encontrado na aba PRODUTOS.' };
  }

  const referencia = buscarReferenciaMercado(produto.nome);
  const custo = Number(produto.custo || 0);
  const precoAtual = Number(produto.preco || 0);
  const piso = custo > 0 ? custo * 1.25 : 0;
  const mediaMercado = referencia.ok ? Number(referencia.media || 0) : 0;

  let sugerido = precoAtual || piso || mediaMercado;

  if (mediaMercado > 0 && piso > 0) {
    sugerido = Math.max(piso, mediaMercado * 0.98);
  } else if (piso > 0) {
    sugerido = piso;
  } else if (mediaMercado > 0) {
    sugerido = mediaMercado;
  }

  const margemAtual = custo > 0 && precoAtual > 0 ? ((precoAtual - custo) / custo) * 100 : null;
  const margemSugerida = custo > 0 && sugerido > 0 ? ((sugerido - custo) / custo) * 100 : null;

  return {
    ok: true,
    produto: produto,
    referencia: referencia,
    sugestao: {
      precoAtual: Number(precoAtual.toFixed(2)),
      precoSugerido: Number(sugerido.toFixed(2)),
      margemAtual: margemAtual === null ? null : Number(margemAtual.toFixed(2)),
      margemSugerida: margemSugerida === null ? null : Number(margemSugerida.toFixed(2)),
      observacao: 'Ajuste final deve considerar sazonalidade, concorrência local e giro do estoque.'
    }
  };
}

function analisarCenarioDepositoIA() {
  const financeiroHoje = safeCall_('resumoFinanceiroHoje').value || {};
  const fluxo = safeCall_('getResumoFluxoCaixa').value || {};
  const rentabilidade = safeCall_('analisarRentabilidadeEstoque').value || {};

  const alertas = [];

  const saldoDia = Number(financeiroHoje.saldo || financeiroHoje.saldoCaixa || 0) || 0;
  if (saldoDia < 0) alertas.push('Saldo diário negativo: priorizar recebimentos e reduzir despesas imediatas.');

  const totalEntradas = Number(fluxo.totalEntradas || 0) || 0;
  const totalSaidas = Number(fluxo.totalSaidas || 0) || 0;
  if (totalSaidas > totalEntradas) {
    alertas.push('Saídas acima das entradas no período: revisar compras e custos fixos.');
  }

  return {
    ok: true,
    dados: {
      financeiroHoje: financeiroHoje,
      fluxoCaixa: fluxo,
      rentabilidade: rentabilidade
    },
    recomendacoes: alertas.length ? alertas : [
      'Cenário estável no recorte atual. Manter monitoramento diário de margem e giro.',
      'Use precificação assistida por custo + referência de mercado para preservar margem.'
    ]
  };
}

function gerarRespostaIA(pergunta, contexto) {
  const texto = String(pergunta || '').trim();
  const c = contexto || {};

  if (!texto) {
    return 'Descreva sua dúvida sobre vendas, compras, estoque ou precificação.';
  }

  const lower = texto.toLowerCase();

  if (lower.includes('preço') || lower.includes('preco')) {
    return 'Para precificação: use custo médio, margem alvo e referência de mercado. Posso ajudar melhor se você selecionar um produto no módulo de IA.';
  }

  if (lower.includes('estoque')) {
    return 'Para estoque: priorize produtos com alto giro e baixo saldo; reponha antes do estoque mínimo e evite sobrecompra em itens de baixa rotação.';
  }

  if (lower.includes('financeiro') || lower.includes('caixa')) {
    return 'No financeiro, acompanhe diariamente entradas x saídas e concentre ações em reduzir despesas que não geram retorno imediato.';
  }

  const nome = (c && c.nomeDeposito) ? ' no depósito ' + c.nomeDeposito : '';
  return 'Sugestão geral' + nome + ': acompanhe os indicadores do Dashboard, revise preços dos itens de maior giro e mantenha o fluxo de caixa positivo com conferência diária.';
}

function obterResumoWeb() {
  const nomeDeposito = safeCall_('getNomeDeposito').value || 'Depósito';
  const usuarioAtual = safeCall_('obterUsuarioAtual').value || null;

  const dashboard = {
    financeiroHoje: safeCall_('resumoFinanceiroHoje').value || null,
    estoqueValores: safeCall_('obterValorTotalEstoque').value || null,
    fluxoCaixa: safeCall_('getResumoFluxoCaixa', [null, null]).value || null,
    rentabilidade: safeCall_('analisarRentabilidadeEstoque').value || null
  };

  return {
    app: {
      nomeDeposito: nomeDeposito,
      usuarioAtual: usuarioAtual,
      carregadoEm: new Date().toISOString()
    },
    secoes: {
      dashboard: {
        titulo: 'Dashboard Gerencial',
        descricao: 'Visão geral de vendas, compras, estoque, fluxo e rentabilidade.',
        metricas: ['Vendas', 'Compras', 'Fluxo de Caixa', 'Estoque', 'Mais/Menos vendidos'],
        acoes: [
          { label: 'Atualizar Dashboard', functionName: 'atualizarDashboards', args: [] },
          { label: 'Painel Financeiro', functionName: 'popupPainelFinanceiro', args: [] },
          { label: 'Fluxo de Caixa', functionName: 'popupFluxoCaixa', args: [] },
          { label: 'Valor Total do Estoque', functionName: 'exibirValorTotalEstoque', args: [] },
          { label: 'Análise de Rentabilidade', functionName: 'abrirAnalisRentabilidade', args: [] }
        ],
        dados: dashboard
      },
      comandas: {
        titulo: 'Comandas',
        descricao: 'Comandas abertas, nova comanda e continuidade de atendimento.',
        acoes: [
          { label: 'Nova Comanda Balcão', functionName: 'popupComandaBalcao', args: [] },
          { label: 'Comandas Abertas', functionName: 'listarComandasAbertas', args: [] },
          { label: 'Painel de Comandas', functionName: 'popupPainelComandas', args: [] },
          { label: 'Painel Financeiro', functionName: 'popupPainelFinanceiro', args: [] }
        ]
      },
      delivery: {
        titulo: 'Delivery',
        descricao: 'Pedidos, encaminhamentos e acompanhamento financeiro do delivery.',
        acoes: [
          { label: 'Novo Delivery', functionName: 'popupDelivery', args: [] },
          { label: 'Painel de Delivery', functionName: 'popupPainelDelivery2', args: [] },
          { label: 'Fluxo de Caixa', functionName: 'popupFluxoCaixa', args: [] },
          { label: 'Painel Financeiro', functionName: 'popupPainelFinanceiro', args: [] }
        ]
      },
      financeiro: {
        titulo: 'Financeiro',
        descricao: 'Conferência, fechamento, contas a pagar/receber e fluxo de caixa.',
        acoes: [
          { label: 'Painel Financeiro', functionName: 'popupPainelFinanceiro', args: [] },
          { label: 'Conferência de Caixa', functionName: 'fecharCaixaDia', args: [] },
          { label: 'Fechamento Fiscal', functionName: 'fecharFiscalDia', args: [] },
          { label: 'Fluxo de Caixa', functionName: 'popupFluxoCaixa', args: [] },
          { label: 'Contas a Pagar', functionName: 'popupPainelContasAPagar', args: [] },
          { label: 'Contas a Receber', functionName: 'popupPainelFinanceiro', args: [] }
        ]
      },
      sistema: {
        titulo: 'Sistema',
        descricao: 'Configurações, usuários, logs, backup e suporte operacional.',
        acoes: [
          { label: 'Iniciar Sistema', functionName: 'initSistema', args: [] },
          { label: 'Configurar Depósito', functionName: 'abrirConfiguracaoDeposito', args: [] },
          { label: 'Usuários', functionName: 'popupListarUsuarios', args: [] },
          { label: 'Criar Usuário', functionName: 'abrirPopupCriarUsuario', args: [] },
          { label: 'Trocar Login', functionName: 'trocarLogin', args: [] },
          { label: 'Logs', functionName: 'abrirAbaLog', args: [] },
          { label: 'Backup Agora', functionName: 'fazerBackupSistema', args: [] },
          { label: 'Manual do Sistema', functionName: 'abrirManualDoSistema', args: [] }
        ]
      },
      whatsapp: {
        titulo: 'WhatsApp',
        descricao: 'Acesso rápido para atendimento e comunicação.',
        acoes: [{ label: 'Abrir Painel WhatsApp', functionName: 'abrirPainelWhatsApp', args: [] }]
      }
    }
  };
}
