/**
 * ==============================================
 * WEB APP (HTML) PARA GESTÃO DE DEPÓSITO
 * ==============================================
 * Camada web para consumir funções existentes do Apps Script,
 * mantendo a planilha como banco de dados principal.
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
      executarApi: true
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

function obterDadosPainelWeb() {
  const nomeDeposito = obterNomeDepositoWeb();
  const usuario = typeof obterUsuarioAtual === 'function' ? obterUsuarioAtual() : null;

  return {
    nomeDeposito: nomeDeposito,
    usuarioAtual: usuario,
    dashboard: obterResumoDashboardWeb(),
    comandas: obterResumoComandasWeb(),
    delivery: obterResumoDeliveryWeb(),
    financeiro: obterResumoFinanceiroWeb(),
    sistema: obterResumoSistemaWeb(),
    acoes: listarAcoesPainelWeb()
  };
}

function obterNomeDepositoWeb() {
  if (typeof getNomeDeposito === 'function') {
    const nome = getNomeDeposito();
    if (nome) return nome;
  }

  return SpreadsheetApp.getActive().getName();
}

function listarAcoesPainelWeb() {
  return [
    { secao: 'comandas', label: 'Criar nova comanda balcão', fn: 'popupComandaBalcao', args: [] },
    { secao: 'comandas', label: 'Abrir comandas abertas', fn: 'listarComandasAbertas', args: [] },
    { secao: 'delivery', label: 'Criar novo delivery', fn: 'popupDelivery', args: [] },
    { secao: 'delivery', label: 'Abrir painel delivery', fn: 'popupPainelDelivery2', args: [] },
    { secao: 'financeiro', label: 'Abrir painel financeiro', fn: 'popupPainelFinanceiro', args: [] },
    { secao: 'financeiro', label: 'Conferência de caixa', fn: 'fecharCaixaDia', args: [] },
    { secao: 'financeiro', label: 'Fechamento fiscal', fn: 'fecharFiscalDia', args: [] },
    { secao: 'financeiro', label: 'Fluxo de caixa', fn: 'popupFluxoCaixa', args: [] },
    { secao: 'financeiro', label: 'Contas a pagar', fn: 'popupPainelContasAPagar', args: [] },
    { secao: 'sistema', label: 'Usuários do sistema', fn: 'popupListarUsuarios', args: [] },
    { secao: 'sistema', label: 'Backup agora', fn: 'fazerBackupSistema', args: [] },
    { secao: 'sistema', label: 'Ver logs', fn: 'abrirAbaLog', args: [] },
    { secao: 'sistema', label: 'Trocar login', fn: 'trocarLogin', args: [] },
    { secao: 'sistema', label: 'Logout seguro', fn: 'fazerLogout', args: [] }
  ];
}

function obterResumoDashboardWeb() {
  const vendas = _sheetData_('VENDAS');
  const compras = _sheetData_('COMPRAS');
  const produtos = _sheetData_('PRODUTOS');
  const estoque = _sheetData_('ESTOQUE');

  const vendasHoje = _sumByDate_(vendas.rows, vendas.headers, ['VALOR', 'TOTAL'], ['DATA'], new Date());
  const comprasHoje = _sumByDate_(compras.rows, compras.headers, ['VALOR', 'TOTAL'], ['DATA'], new Date());
  const totalProdutos = produtos.rows.length;
  const totalItensEstoque = _sumCols_(estoque.rows, estoque.headers, ['ESTOQUE', 'QUANT', 'QTD']);

  const topMaisVendidos = _topBy_(vendas.rows, vendas.headers, ['PRODUTO', 'ITEM'], ['QUANT', 'QTD'], 5, 'desc');
  const topMenosVendidos = _topBy_(vendas.rows, vendas.headers, ['PRODUTO', 'ITEM'], ['QUANT', 'QTD'], 5, 'asc');

  return {
    vendasHoje: vendasHoje,
    comprasHoje: comprasHoje,
    saldoOperacionalDia: vendasHoje - comprasHoje,
    totalProdutos: totalProdutos,
    totalItensEstoque: totalItensEstoque,
    graficos: {
      vendasCompras: [
        { label: 'Vendas', value: vendasHoje },
        { label: 'Compras', value: comprasHoje },
        { label: 'Saldo', value: vendasHoje - comprasHoje }
      ],
      estoqueProdutos: [
        { label: 'Produtos cadastrados', value: totalProdutos },
        { label: 'Itens no estoque', value: totalItensEstoque }
      ],
      maisVendidos: topMaisVendidos,
      menosVendidos: topMenosVendidos
    }
  };
}

function obterResumoComandasWeb() {
  const comandas = _sheetData_('COMANDAS');
  const vendas = _sheetData_('VENDAS');
  const abertas = comandas.rows.filter(function(r) {
    const status = _getCol_(r, comandas.headers, ['STATUS']) || '';
    return String(status).toUpperCase().indexOf('ABERTA') >= 0;
  });

  const receber = _sumByFilter_(vendas.rows, vendas.headers, ['VALOR', 'TOTAL'], function(r) {
    const origem = (_getCol_(r, vendas.headers, ['ORIGEM']) || '').toString().toUpperCase();
    const pago = (_getCol_(r, vendas.headers, ['PAGO', 'QUITADO', 'STATUS']) || '').toString().toUpperCase();
    return origem.indexOf('COMANDA') >= 0 && pago.indexOf('SIM') < 0 && pago.indexOf('QUITADO') < 0;
  });

  return {
    comandasAbertasHoje: abertas.length,
    valorReceberAbertas: receber,
    listaAbertas: abertas.slice(0, 20)
  };
}

function obterResumoDeliveryWeb() {
  const delivery = _sheetData_('DELIVERY');
  const emAberto = delivery.rows.filter(function(r) {
    const status = (_getCol_(r, delivery.headers, ['STATUS']) || '').toString().toUpperCase();
    return status.indexOf('FEITO') >= 0 || status.indexOf('ANDAMENTO') >= 0 || status.indexOf('ABERTO') >= 0;
  });

  const valorEmAberto = _sumCols_(emAberto, delivery.headers, ['VALOR', 'TOTAL']);

  return {
    pedidosAbertos: emAberto.length,
    valorAberto: valorEmAberto,
    ultimosPedidos: emAberto.slice(0, 20)
  };
}

function obterResumoFinanceiroWeb() {
  const caixa = _sheetData_('CAIXA');
  const contasPagar = _sheetData_('CONTAS_A_PAGAR');
  const contasReceber = _sheetData_('CONTAS_A_RECEBER');

  const saldoCaixa = _sumCols_(caixa.rows, caixa.headers, ['SALDO']) || (_sumCols_(caixa.rows, caixa.headers, ['ENTRADA']) - _sumCols_(caixa.rows, caixa.headers, ['SAIDA']));
  const totalPagar = _sumCols_(contasPagar.rows, contasPagar.headers, ['VALOR', 'TOTAL']);
  const totalReceber = _sumCols_(contasReceber.rows, contasReceber.headers, ['VALOR', 'TOTAL']);

  return {
    saldoCaixa: saldoCaixa,
    totalPagar: totalPagar,
    totalReceber: totalReceber,
    resultadoPrevisto: saldoCaixa + totalReceber - totalPagar,
    graficos: [
      { label: 'Saldo caixa', value: saldoCaixa },
      { label: 'Contas a receber', value: totalReceber },
      { label: 'Contas a pagar', value: totalPagar }
    ]
  };
}

function obterResumoSistemaWeb() {
  const usuarios = _sheetData_('USUARIOS');
  const sessoes = _sheetData_('SESSOES');
  const logs = _sheetData_('LOG');

  const ativos = usuarios.rows.filter(function(r) {
    const ativo = (_getCol_(r, usuarios.headers, ['ATIVO']) || '').toString().toUpperCase();
    return ativo === 'TRUE' || ativo === 'SIM' || ativo === 'ATIVO';
  }).length;

  const loginsAtivos = sessoes.rows.filter(function(r) {
    const ativo = (_getCol_(r, sessoes.headers, ['ATIVO']) || '').toString().toUpperCase();
    return ativo === 'TRUE' || ativo === 'SIM' || ativo === 'ATIVO';
  }).length;

  return {
    totalUsuarios: usuarios.rows.length,
    usuariosAtivos: ativos,
    sessoesAtivas: loginsAtivos,
    totalLogs: logs.rows.length
  };
}

function gerarDiagnosticoIAWeb(pergunta) {
  const resumo = obterDadosPainelWeb();
  const fin = resumo.financeiro;
  const dash = resumo.dashboard;
  const com = resumo.comandas;
  const del = resumo.delivery;

  const alertas = [];
  if (fin.totalPagar > fin.totalReceber) {
    alertas.push('Contas a pagar acima das contas a receber: revise prazos e renegocie fornecedores.');
  }
  if (dash.saldoOperacionalDia < 0) {
    alertas.push('Saldo operacional do dia está negativo: priorize itens de maior giro e margem.');
  }
  if (com.comandasAbertasHoje > 0 && com.valorReceberAbertas > 0) {
    alertas.push('Há comandas em aberto com valores pendentes: acione cobrança amigável no fechamento.');
  }
  if (del.pedidosAbertos > 5) {
    alertas.push('Volume alto de delivery em aberto: verificar capacidade de entrega e tempo médio.');
  }

  const sugestoes = [
    'Acompanhar ticket médio diário por canal (balcão vs delivery).',
    'Definir margem mínima por categoria e bloquear venda abaixo do piso.',
    'Automatizar alerta de estoque mínimo para produtos de maior saída.'
  ];

  if (pergunta && String(pergunta).trim()) {
    sugestoes.unshift('Sobre sua pergunta: "' + String(pergunta).trim() + '", recomendamos iniciar com análise de caixa e margem do produto líder.');
  }

  return {
    pergunta: pergunta || '',
    dataHora: new Date(),
    alertas: alertas,
    sugestoes: sugestoes,
    resumo: {
      saldoCaixa: fin.saldoCaixa,
      saldoOperacional: dash.saldoOperacionalDia,
      receberComandas: com.valorReceberAbertas
    }
  };
}

function sugerirPrecoProdutoWeb(produto, custo, margemPercentual) {
  const custoNum = _toNum_(custo);
  const margemNum = _toNum_(margemPercentual);
  const margem = margemNum > 0 ? margemNum : 30;

  if (custoNum <= 0) {
    throw new Error('Informe um custo válido para calcular sugestão de preço.');
  }

  const precoSugerido = custoNum * (1 + margem / 100);
  return {
    produto: produto || 'Produto sem nome',
    custo: custoNum,
    margemPercentual: margem,
    precoSugerido: Number(precoSugerido.toFixed(2))
  };
}

function pesquisarPrecoMercadoWeb(produto) {
  if (!produto || !String(produto).trim()) {
    throw new Error('Informe um produto para pesquisa.');
  }

  try {
    const q = encodeURIComponent(String(produto).trim() + ' preço médio Brasil');
    const url = 'https://api.duckduckgo.com/?q=' + q + '&format=json&no_html=1&skip_disambig=1';
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
    const data = JSON.parse(response.getContentText() || '{}');

    return {
      produto: produto,
      fonte: 'DuckDuckGo Instant Answer',
      resumo: data.AbstractText || 'Sem resumo objetivo retornado. Use a query para pesquisa manual complementar.',
      url: data.AbstractURL || 'https://duckduckgo.com/?q=' + q
    };
  } catch (e) {
    return {
      produto: produto,
      fonte: 'DuckDuckGo Instant Answer',
      resumo: 'Não foi possível buscar preços automaticamente no momento.',
      erro: e.message
    };
  }
}

function _sheetData_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) return { headers: [], rows: [] };

  const values = sh.getDataRange().getValues();
  if (!values.length) return { headers: [], rows: [] };

  const headers = values[0].map(function(h) { return String(h || '').toUpperCase().trim(); });
  const rows = values.slice(1).filter(function(r) {
    return r.some(function(c) { return c !== '' && c !== null; });
  });

  return { headers: headers, rows: rows };
}

function _getCol_(row, headers, options) {
  if (!headers || !headers.length) return null;
  for (var i = 0; i < options.length; i++) {
    var idx = headers.findIndex(function(h) { return h.indexOf(options[i]) >= 0; });
    if (idx >= 0) return row[idx];
  }
  return null;
}

function _toNum_(v) {
  if (typeof v === 'number') return v;
  if (v === null || v === undefined) return 0;
  var s = String(v).replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  var n = Number(s);
  return isNaN(n) ? 0 : n;
}

function _sumCols_(rows, headers, options) {
  return rows.reduce(function(acc, row) {
    return acc + _toNum_(_getCol_(row, headers, options));
  }, 0);
}

function _isSameDay_(dateA, dateB) {
  if (!(dateA instanceof Date) || !(dateB instanceof Date)) return false;
  return dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate();
}

function _sumByDate_(rows, headers, valueCols, dateCols, dateRef) {
  return rows.reduce(function(acc, row) {
    var dt = _getCol_(row, headers, dateCols);
    if (!_isSameDay_(dt, dateRef)) return acc;
    return acc + _toNum_(_getCol_(row, headers, valueCols));
  }, 0);
}

function _sumByFilter_(rows, headers, valueCols, filterFn) {
  return rows.reduce(function(acc, row) {
    return filterFn(row) ? acc + _toNum_(_getCol_(row, headers, valueCols)) : acc;
  }, 0);
}

function _topBy_(rows, headers, labelCols, valueCols, limit, order) {
  var grouped = {};

  rows.forEach(function(r) {
    var label = _getCol_(r, headers, labelCols) || 'SEM NOME';
    var val = _toNum_(_getCol_(r, headers, valueCols));
    grouped[label] = (grouped[label] || 0) + val;
  });

  var list = Object.keys(grouped).map(function(k) {
    return { label: k, value: grouped[k] };
  });

  list.sort(function(a, b) {
    return order === 'asc' ? a.value - b.value : b.value - a.value;
  });

  return list.slice(0, limit || 5);
}
