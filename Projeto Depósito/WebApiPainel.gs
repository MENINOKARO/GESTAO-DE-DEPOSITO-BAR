/**
 * API do Painel Web - camada compatível com WebApp
 * Evita dependência de SpreadsheetApp.getUi() e expõe funções usadas pelo WebApp2.
 */

function carregarAbasPosLoginWeb(usuario) {
  return {
    ok: true,
    usuario: usuario || '',
    mensagem: 'Sessão web preparada.'
  };
}

function obterResumoWeb() {
  const usuario = obterUsuarioAtualWebSafe();
  const nomeDeposito = obterNomeDepositoWebSafe();

  const fluxoCaixa = calcularFluxoCaixaWeb();
  const financeiroHoje = calcularFinanceiroHojeWeb();
  const estoqueValores = obterValorTotalEstoqueSafe();
  const rentabilidade = analisarRentabilidadeEstoqueSafe();
  const vendas = obterResumoVendasWeb();
  const compras = obterResumoComprasWeb();
  const comandas = obterResumoComandasWeb();
  const delivery = obterResumoDeliveryWeb();
  const painelInteligente = obterPainelInteligenteWeb();

  return {
    app: {
      nomeDeposito: nomeDeposito,
      usuarioAtual: usuario
    },
    secoes: {
      dashboard: {
        titulo: 'Dashboard',
        descricao: 'Visão geral da operação com base nas abas da planilha.',
        metricas: [
          'Fluxo do dia',
          'Saldo de caixa',
          'Estoque valorizado',
          'Rentabilidade'
        ],
        dados: {
          vendas: vendas,
          compras: compras,
          comandas: comandas,
          delivery: delivery,
          financeiro: financeiroHoje,
          fluxoCaixa: fluxoCaixa,
          fluxoCaixa: fluxoCaixa,
          financeiroHoje: financeiroHoje,
          estoqueValores: estoqueValores,
          rentabilidade: rentabilidade
        },
        acoes: [
          { label: 'Atualizar Dashboard', functionName: 'obterResumoWeb', args: [] },
          { label: 'Resumo de Vendas', functionName: 'obterResumoVendasWeb', args: [] },
          { label: 'Resumo de Compras', functionName: 'obterResumoComprasWeb', args: [] },
          { label: 'Fluxo de Caixa (Hoje)', functionName: 'calcularFluxoCaixaWeb', args: [] },
          { label: 'Financeiro (Hoje)', functionName: 'calcularFinanceiroHojeWeb', args: [] }
        ]
      },
      comandas: {
        titulo: 'Comandas',
        descricao: 'Abertura e listagem de comandas (modo web).',
        dados: {
          abertas: listarComandasAbertasWeb().length
        },
        acoes: [
          { label: 'Listar Comandas Abertas', functionName: 'listarComandasAbertasWeb', args: [] },
          { label: 'Criar Nova Comanda', functionName: 'criarNovaComandaWeb', args: [{ cliente: 'Consumidor', mesa: 'Balcão', observacoes: '' }] }
        ]
      },
      delivery: {
        titulo: 'Delivery',
        descricao: 'Resumo de pedidos de delivery com base na aba DELIVERY.',
        dados: obterResumoDeliveryWeb(),
        acoes: [
          { label: 'Resumo Delivery', functionName: 'obterResumoDeliveryWeb', args: [] }
        ]
      },
      financeiro: {
        titulo: 'Financeiro',
        descricao: 'Indicadores financeiros diários e por meios de pagamento.',
        dados: {
          fluxoCaixa: fluxoCaixa,
          financeiroHoje: financeiroHoje
        },
        acoes: [
          { label: 'Fluxo de Caixa', functionName: 'calcularFluxoCaixaWeb', args: [] },
          { label: 'Financeiro Hoje', functionName: 'calcularFinanceiroHojeWeb', args: [] }
        ]
      },
      inteligente: {
        titulo: 'Painel Inteligente',
        descricao: 'Catálogo das funções reais existentes no sistema com compatibilidade Web.',
        dados: painelInteligente,
        acoes: painelInteligente.acoesDisponiveis
      },
      sistema: {
        titulo: 'Sistema',
        descricao: 'Funções de apoio administrativo em contexto web.',
        dados: {
          usuario: usuario,
          deposito: nomeDeposito,
          horarioServidor: new Date().toISOString()
        },
        acoes: [
          { label: 'Resumo do Sistema', functionName: 'obterResumoSistemaWeb', args: [] },
          { label: 'Carregar Painel Inteligente', functionName: 'obterPainelInteligenteWeb', args: [] },
          { label: 'Abrir Drive', functionName: 'abrirDriveWeb', args: [] },
          { label: 'Gerar Relatório Estoque (sem popup)', functionName: 'gerarRelatorioEstoqueComValoresWeb', args: [] }
        ]
      },
      whatsapp: {
        titulo: 'WhatsApp',
        descricao: 'Placeholder de integração para painel web.',
        dados: {
          status: 'Integração não configurada neste projeto.'
        },
        acoes: [
          { label: 'Status WhatsApp', functionName: 'obterStatusWhatsappWeb', args: [] }
        ]
      }
    }
  };
}


function obterPainelInteligenteWeb() {
  const catalogo = catalogoFuncoesReaisWeb();
  const total = catalogo.length;
  const webCompativeis = catalogo.filter(function(i){ return i.webCompativel; }).length;
  const dependemUi = catalogo.filter(function(i){ return !i.webCompativel; }).length;

  return {
    totalFuncoesMapeadas: total,
    webCompativeis: webCompativeis,
    dependemDeUiPlanilha: dependemUi,
    funcoes: catalogo,
    acoesDisponiveis: catalogo.filter(function(i){ return i.webCompativel; }).map(function(i){
      return { label: i.nome + ' • ' + i.modulo, functionName: i.nome, args: [] };
    })
  };
}

function catalogoFuncoesReaisWeb() {
  return [
    { nome: 'autenticarUsuario', modulo: 'autenticacao_usuarios.gs', finalidade: 'Valida login e cria sessão.', webCompativel: true },
    { nome: 'rotinaLogout', modulo: 'autenticacao_usuarios.gs', finalidade: 'Encerra sessão e aplica bloqueio.', webCompativel: true },
    { nome: 'obterUsuarioAtual', modulo: 'autenticacao_usuarios.gs', finalidade: 'Retorna usuário logado.', webCompativel: true },
    { nome: 'temPermissao', modulo: 'autenticacao_usuarios.gs', finalidade: 'Valida permissão por perfil.', webCompativel: true },
    { nome: 'garantirEstruturausuarios', modulo: 'autenticacao_usuarios.gs', finalidade: 'Cria abas de usuários/sessões/auditoria.', webCompativel: true },
    { nome: 'aplicarVisibilidadeAbasPorPerfil', modulo: 'autenticacao_usuarios.gs', finalidade: 'Exibe/oculta abas conforme sessão.', webCompativel: true },

    { nome: 'gerarRelatorioEstoqueComValores', modulo: 'gestao_estoque_valores.gs', finalidade: 'Relatório completo de estoque com valores.', webCompativel: false },
    { nome: 'obterDadosEstoque', modulo: 'gestao_estoque_valores.gs', finalidade: 'Lê estoque da planilha.', webCompativel: true },
    { nome: 'obterDadosProdutos', modulo: 'gestao_estoque_valores.gs', finalidade: 'Lê produtos/custos/preços.', webCompativel: true },
    { nome: 'obterDadosVendas', modulo: 'gestao_estoque_valores.gs', finalidade: 'Lê vendas da planilha.', webCompativel: true },
    { nome: 'obterValorTotalEstoque', modulo: 'gestao_estoque_valores.gs', finalidade: 'Calcula valor total do estoque.', webCompativel: true },
    { nome: 'obterValorEstoquesPorCategoria', modulo: 'gestao_estoque_valores.gs', finalidade: 'Agrupa valor por categoria.', webCompativel: true },
    { nome: 'analisarRentabilidadeEstoque', modulo: 'gestao_estoque_valores.gs', finalidade: 'Classifica rentabilidade e alertas.', webCompativel: true },

    { nome: 'exibirValorCategoria', modulo: 'integracao_estoque_valores.gs', finalidade: 'Gera dashboard por categoria na planilha.', webCompativel: false },
    { nome: 'exibirValorTotalEstoque', modulo: 'integracao_estoque_valores.gs', finalidade: 'Mostra consolidado via alerta.', webCompativel: false },
    { nome: 'abrirAnalisRentabilidade', modulo: 'integracao_estoque_valores.gs', finalidade: 'Monta análise de rentabilidade em aba.', webCompativel: false },
    { nome: 'monitorarEstoqueAuto', modulo: 'integracao_estoque_valores.gs', finalidade: 'Executa monitoramento automático.', webCompativel: true },
    { nome: 'setupMonitoramentoEstoque', modulo: 'integracao_estoque_valores.gs', finalidade: 'Cria trigger de monitoramento.', webCompativel: false },

    { nome: 'calcularFluxoCaixaWeb', modulo: 'WebApiPainel.gs', finalidade: 'Resumo de caixa do dia para web.', webCompativel: true },
    { nome: 'calcularFinanceiroHojeWeb', modulo: 'WebApiPainel.gs', finalidade: 'Consolida entrada/saída/saldo.', webCompativel: true },
    { nome: 'obterResumoVendasWeb', modulo: 'WebApiPainel.gs', finalidade: 'Resumo de vendas para dashboard.', webCompativel: true },
    { nome: 'obterResumoComprasWeb', modulo: 'WebApiPainel.gs', finalidade: 'Resumo de compras para dashboard.', webCompativel: true },
    { nome: 'listarComandasAbertasWeb', modulo: 'WebApiPainel.gs', finalidade: 'Lista comandas abertas.', webCompativel: true },
    { nome: 'criarNovaComandaWeb', modulo: 'WebApiPainel.gs', finalidade: 'Cria comanda na aba COMANDAS.', webCompativel: true },
    { nome: 'obterResumoDeliveryWeb', modulo: 'WebApiPainel.gs', finalidade: 'Resumo de status do delivery.', webCompativel: true },
    { nome: 'abrirDriveWeb', modulo: 'WebApiPainel.gs', finalidade: 'Retorna URL do Drive configurado.', webCompativel: true }
  ];
}

function obterResumoSistemaWeb() {
  return {
    usuarioAtual: obterUsuarioAtualWebSafe(),
    nomeDeposito: obterNomeDepositoWebSafe(),
    timezone: Session.getScriptTimeZone(),
    timestamp: new Date().toISOString()
  };
}

function obterStatusWhatsappWeb() {
  return {
    ok: true,
    integrado: false,
    mensagem: 'Nenhum endpoint de WhatsApp configurado nas funções disponíveis.'
  };
}

function listarProdutosIA() {
  const mapa = obterDadosProdutos();
  return Object.keys(mapa).map(function(nome) {
    const p = mapa[nome] || {};
    return {
      nome: nome,
      categoria: p.categoria || '',
      preco: Number(p.preco) || 0,
      custo: Number(p.custMedio) || 0
    };
  });
}

function analisarCenarioDepositoIA() {
  const fluxo = calcularFluxoCaixaWeb();
  const rent = analisarRentabilidadeEstoqueSafe();
  const resumo = {
    ok: true,
    fluxoCaixa: fluxo,
    estoqueCritico: rent && rent.estoqueCritico ? rent.estoqueCritico.length : 0,
    semVenda: rent && rent.quaseNenhumavenda ? rent.quaseNenhumavenda.length : 0,
    recomendacoes: []
  };

  if (Number(fluxo.resultado) < 0) {
    resumo.recomendacoes.push('Reduzir saídas e acelerar recebimentos para recuperar caixa do dia.');
  }
  if (resumo.estoqueCritico > 0) {
    resumo.recomendacoes.push('Priorizar compra de itens em estoque crítico.');
  }
  if (resumo.semVenda > 0) {
    resumo.recomendacoes.push('Promover produtos sem giro para liberar capital de estoque.');
  }

  if (!resumo.recomendacoes.length) {
    resumo.recomendacoes.push('Operação está estável com dados atuais.');
  }

  return resumo;
}

function buscarReferenciaMercado(produto) {
  const nome = String(produto || '').trim();
  if (!nome) {
    return { ok: false, erro: 'Informe um produto.' };
  }

  const url = 'https://api.mercadolibre.com/sites/MLB/search?q=' + encodeURIComponent(nome) + '&limit=5';

  try {
    const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const code = resp.getResponseCode();
    if (code < 200 || code >= 300) {
      return { ok: false, erro: 'Falha ao consultar referência externa. HTTP ' + code };
    }

    const payload = JSON.parse(resp.getContentText() || '{}');
    const results = Array.isArray(payload.results) ? payload.results : [];
    const amostra = results.map(function(item) {
      return {
        titulo: item.title || '',
        preco: Number(item.price) || 0,
        link: item.permalink || ''
      };
    }).filter(function(i) { return i.preco > 0; });

    if (!amostra.length) {
      return { ok: false, erro: 'Sem referências de preço para o produto informado.' };
    }

    const media = amostra.reduce(function(s, i) { return s + i.preco; }, 0) / amostra.length;

    return {
      ok: true,
      produto: nome,
      fonte: 'Mercado Livre',
      precoMedio: Number(media.toFixed(2)),
      amostra: amostra
    };
  } catch (e) {
    return { ok: false, erro: 'Falha ao consultar referência externa. ' + e.message };
  }
}

function sugerirPrecoIA(nomeProduto) {
  const nome = String(nomeProduto || '').trim();
  const mapa = obterDadosProdutos();
  const produto = mapa[nome] || {};
  const custo = Number(produto.custMedio) || 0;
  const precoAtual = Number(produto.preco) || 0;
  const referencia = buscarReferenciaMercado(nome);

  const margemBase = custo > 0 ? 0.35 : 0;
  let precoSugerido = custo > 0 ? custo * (1 + margemBase) : precoAtual;

  if (referencia.ok && Number(referencia.precoMedio) > 0) {
    precoSugerido = (precoSugerido + Number(referencia.precoMedio)) / 2;
  }

  if (precoSugerido <= 0) {
    precoSugerido = precoAtual;
  }

  return {
    ok: true,
    produto: {
      nome: nome,
      categoria: produto.categoria || '',
      custo: custo,
      preco: precoAtual
    },
    referencia: referencia,
    sugestao: {
      precoAtual: precoAtual,
      precoSugerido: Number(precoSugerido.toFixed(2)),
      margemAtual: custo > 0 && precoAtual > 0 ? Number((((precoAtual - custo) / precoAtual) * 100).toFixed(2)) : null,
      margemSugerida: custo > 0 && precoSugerido > 0 ? Number((((precoSugerido - custo) / precoSugerido) * 100).toFixed(2)) : null,
      observacao: 'Use como referência; valide concorrência local e giro de estoque.'
    }
  };
}

function gerarRespostaIA(pergunta, contexto) {
  const texto = String(pergunta || '').toLowerCase();
  const cenario = analisarCenarioDepositoIA();
  const nome = contexto && contexto.nomeDeposito ? contexto.nomeDeposito : 'Depósito';

  if (texto.indexOf('margem') !== -1 || texto.indexOf('preço') !== -1 || texto.indexOf('preco') !== -1) {
    return nome + ': para melhorar margem, revise preço de itens sem giro, mantenha estoque crítico abastecido e reduza saídas não essenciais.';
  }

  if (texto.indexOf('caixa') !== -1 || texto.indexOf('financeiro') !== -1) {
    return nome + ': resultado de caixa atual é ' + cenario.fluxoCaixa.resultado + '. Prioridade é aumentar entradas e frear saídas do dia.';
  }

  return nome + ': cenário atual -> caixa=' + cenario.fluxoCaixa.resultado + ', estoque crítico=' + cenario.estoqueCritico + '. Posso detalhar por produto se você informar o nome.';
}

function gerarRelatorioEstoqueComValoresWeb() {
  const estoque = obterDadosEstoque();
  const produtos = obterDadosProdutos();
  const vendas = obterDadosVendas();
  const relatorio = calcularValoresEstoque(estoque, produtos, vendas);

  const shRelatorio = criarAbaRelatorioEstoque();
  preencherRelatorioEstoque(shRelatorio, relatorio);

  const pdf = exportarRelatorioEstoquePdfDriveWeb(shRelatorio);

  return {
    relatorio: relatorio,
    pdf: pdf
  };
}

function exportarRelatorioEstoquePdfDriveWeb(sheet) {
  try {
    const linkDrive = obterLinkDriveWeb();
    if (!linkDrive) {
      return {
        ok: false,
        mensagem: 'Link do Drive não configurado na aba CONFIG.'
      };
    }

    const rootFolder = obterPastaDrivePorLinkWeb(linkDrive);
    if (!rootFolder) {
      return {
        ok: false,
        mensagem: 'Não foi possível acessar a pasta do Drive configurada.'
      };
    }

    const folderRelatorio = obterPastaDestinoRelatorioEstoqueWeb(rootFolder);
    const ss = SpreadsheetApp.getActive();
    const timezone = Session.getScriptTimeZone();
    const stamp = Utilities.formatDate(new Date(), timezone, 'yyyyMMdd_HHmmss');
    const nomeArquivo = 'RELATORIO_ESTOQUE_VALORES_' + stamp + '.pdf';

    const exportUrl = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export' +
      '?format=pdf' +
      '&gid=' + sheet.getSheetId() +
      '&size=A4' +
      '&portrait=false' +
      '&fitw=true' +
      '&sheetnames=false' +
      '&printtitle=false' +
      '&pagenumbers=true' +
      '&gridlines=false' +
      '&fzr=true';

    const token = ScriptApp.getOAuthToken();
    const response = UrlFetchApp.fetch(exportUrl, {
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true
    });

    const statusCode = response.getResponseCode();
    if (statusCode !== 200) {
      return {
        ok: false,
        mensagem: 'Falha ao exportar PDF do relatório. Código: ' + statusCode
      };
    }

    const blob = response.getBlob().setName(nomeArquivo);
    const file = folderRelatorio.createFile(blob);

    return {
      ok: true,
      id: file.getId(),
      nome: file.getName(),
      url: file.getUrl(),
      pasta: folderRelatorio.getName(),
      mensagem: 'PDF do relatório salvo no Drive com sucesso.'
    };
  } catch (e) {
    return {
      ok: false,
      mensagem: 'Erro ao salvar PDF no Drive: ' + e.message
    };
  }
}

function obterPastaDrivePorLinkWeb(linkDrive) {
  const link = String(linkDrive || '').trim();
  if (!link) return null;

  const idMatch = link.match(/[-\w]{25,}/);
  if (!idMatch) return null;

  try {
    return DriveApp.getFolderById(idMatch[0]);
  } catch (_) {
    return null;
  }
}

function obterOuCriarSubpastaWeb(parent, nome) {
  const iterator = parent.getFoldersByName(nome);
  if (iterator.hasNext()) {
    return iterator.next();
  }
  return parent.createFolder(nome);
}


function obterPastaDestinoRelatorioEstoqueWeb(rootFolder) {
  const pastaRelatorio = obterOuCriarSubpastaPorNomesWeb(rootFolder, [
    'Relatorio',
    'Relatórios',
    'Relatorios'
  ]);

  return obterOuCriarSubpastaPorNomesWeb(pastaRelatorio, ['Estoque']);
}

function obterOuCriarSubpastaPorNomesWeb(parent, nomesPossiveis) {
  for (var i = 0; i < nomesPossiveis.length; i++) {
    var it = parent.getFoldersByName(nomesPossiveis[i]);
    if (it.hasNext()) {
      return it.next();
    }
  }

  const alvoNormalizado = normalizarNomePastaWeb(nomesPossiveis[0]);
  const existentes = parent.getFolders();
  while (existentes.hasNext()) {
    var pasta = existentes.next();
    if (normalizarNomePastaWeb(pasta.getName()) === alvoNormalizado) {
      return pasta;
    }
  }

  return parent.createFolder(nomesPossiveis[0]);
}

function normalizarNomePastaWeb(nome) {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function listarComandasAbertasWeb() {
  const sh = SpreadsheetApp.getActive().getSheetByName('COMANDAS');
  if (!sh) return [];

  const dados = sh.getDataRange().getValues();
  if (dados.length <= 1) return [];

  const headers = dados[0].map(function(h) { return String(h || '').trim().toUpperCase(); });

  const idxId = indexHeader(headers, ['ID', 'ID_COMANDA', 'COMANDA', 'NUMERO']);
  const idxCliente = indexHeader(headers, ['CLIENTE', 'NOME_CLIENTE']);
  const idxMesa = indexHeader(headers, ['MESA', 'LOCAL']);
  const idxStatus = indexHeader(headers, ['STATUS']);
  const idxAbertura = indexHeader(headers, ['DATA_ABERTURA', 'DATA', 'CRIADO_EM']);

  return dados.slice(1).map(function(l) {
    return {
      id: idxId >= 0 ? l[idxId] : '',
      cliente: idxCliente >= 0 ? l[idxCliente] : '',
      mesa: idxMesa >= 0 ? l[idxMesa] : '',
      status: String(idxStatus >= 0 ? l[idxStatus] : '').toUpperCase(),
      abertura: idxAbertura >= 0 ? l[idxAbertura] : ''
    };
  }).filter(function(i) {
    return i.status === '' || i.status.indexOf('ABERTA') !== -1 || i.status.indexOf('ABERTO') !== -1;
  });
}

function criarNovaComandaWeb(payload) {
  const body = payload || {};
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName('COMANDAS');

  if (!sh) {
    sh = ss.insertSheet('COMANDAS');
    sh.getRange(1, 1, 1, 5).setValues([['ID_COMANDA', 'CLIENTE', 'MESA', 'STATUS', 'DATA_ABERTURA']]);
  }

  const dados = sh.getDataRange().getValues();
  const headers = (dados[0] || ['ID_COMANDA', 'CLIENTE', 'MESA', 'STATUS', 'DATA_ABERTURA'])
    .map(function(h) { return String(h || '').trim().toUpperCase(); });

  if (dados.length === 0) {
    sh.getRange(1, 1, 1, 5).setValues([['ID_COMANDA', 'CLIENTE', 'MESA', 'STATUS', 'DATA_ABERTURA']]);
  }

  const idxId = indexHeader(headers, ['ID_COMANDA', 'ID', 'COMANDA', 'NUMERO']);
  const idxCliente = indexHeader(headers, ['CLIENTE', 'NOME_CLIENTE']);
  const idxMesa = indexHeader(headers, ['MESA', 'LOCAL']);
  const idxStatus = indexHeader(headers, ['STATUS']);
  const idxAbertura = indexHeader(headers, ['DATA_ABERTURA', 'DATA', 'CRIADO_EM']);

  const now = new Date();
  const id = 'CMD-' + Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');

  const totalCols = Math.max(headers.length, 5);
  const row = new Array(totalCols).fill('');

  if (idxId >= 0) row[idxId] = id;
  else row[0] = id;

  if (idxCliente >= 0) row[idxCliente] = body.cliente || 'Consumidor';
  else row[1] = body.cliente || 'Consumidor';

  if (idxMesa >= 0) row[idxMesa] = body.mesa || 'Balcão';
  else row[2] = body.mesa || 'Balcão';

  if (idxStatus >= 0) row[idxStatus] = 'COMANDA_ABERTA';
  else row[3] = 'COMANDA_ABERTA';

  if (idxAbertura >= 0) row[idxAbertura] = now;
  else row[4] = now;

  sh.appendRow(row);

  return {
    ok: true,
    idComanda: id,
    cliente: body.cliente || 'Consumidor',
    mesa: body.mesa || 'Balcão',
    status: 'COMANDA_ABERTA',
    criadoEm: now.toISOString(),
    observacoes: body.observacoes || ''
  };
}

function obterResumoDeliveryWeb() {
  const sh = SpreadsheetApp.getActive().getSheetByName('DELIVERY');
  if (!sh) {
    return { total: 0, abertos: 0, finalizados: 0, cancelados: 0 };
  }

  const dados = sh.getDataRange().getValues();
  if (dados.length <= 1) {
    return { total: 0, abertos: 0, finalizados: 0, cancelados: 0 };
  }

  const headers = dados[0].map(function(h) { return String(h || '').trim().toUpperCase(); });
  const idxStatus = indexHeader(headers, ['STATUS']);

  const out = { total: 0, abertos: 0, finalizados: 0, cancelados: 0 };

  dados.slice(1).forEach(function(row) {
    out.total += 1;
    const st = String(idxStatus >= 0 ? row[idxStatus] : '').toUpperCase();
    if (st.indexOf('CANCEL') !== -1) out.cancelados += 1;
    else if (st.indexOf('ENTREG') !== -1 || st.indexOf('FINAL') !== -1) out.finalizados += 1;
    else out.abertos += 1;
  });

  return out;
}

function calcularFluxoCaixaWeb() {
  const sh = SpreadsheetApp.getActive().getSheetByName('CAIXA');
  if (!sh) {
    return { entradas: 0, saidas: 0, resultado: 0, saldoReal: 0, dinheiro: 0, pix: 0, debito: 0, credito: 0, fiado: 0 };
  }

  const dados = sh.getDataRange().getValues();
  if (dados.length <= 1) {
    return { entradas: 0, saidas: 0, resultado: 0, saldoReal: 0, dinheiro: 0, pix: 0, debito: 0, credito: 0, fiado: 0 };
  }

  const headers = dados[0].map(function(h) { return String(h || '').trim().toUpperCase(); });
  const idxTipo = indexHeader(headers, ['TIPO', 'ENTRADA_SAIDA', 'OPERACAO']);
  const idxValor = indexHeader(headers, ['VALOR', 'TOTAL']);
  const idxForma = indexHeader(headers, ['FORMA', 'FORMA_PAGAMENTO', 'PAGAMENTO']);

  const f = { entradas: 0, saidas: 0, resultado: 0, saldoReal: 0, dinheiro: 0, pix: 0, debito: 0, credito: 0, fiado: 0 };

  dados.slice(1).forEach(function(row) {
    const valor = Number(row[idxValor]) || 0;
    const tipo = String(idxTipo >= 0 ? row[idxTipo] : '').toUpperCase();
    const forma = String(idxForma >= 0 ? row[idxForma] : '').toUpperCase();

    if (tipo.indexOf('SAI') !== -1) f.saidas += valor;
    else f.entradas += valor;

    if (forma.indexOf('PIX') !== -1) f.pix += valor;
    else if (forma.indexOf('DEB') !== -1) f.debito += valor;
    else if (forma.indexOf('CRÉ') !== -1 || forma.indexOf('CRED') !== -1) f.credito += valor;
    else if (forma.indexOf('FIADO') !== -1) f.fiado += valor;
    else f.dinheiro += valor;
  });

  f.resultado = Number((f.entradas - f.saidas).toFixed(2));
  f.saldoReal = f.resultado;
  return f;
}

function calcularFinanceiroHojeWeb() {
  const fluxo = calcularFluxoCaixaWeb();
  return {
    entrada: fluxo.entradas,
    saida: fluxo.saidas,
    saldo: fluxo.resultado
  };
}


function obterResumoVendasWeb() {
  const sh = SpreadsheetApp.getActive().getSheetByName('VENDAS');
  if (!sh) return { registros: 0, total: 0 };
  const dados = sh.getDataRange().getValues();
  if (dados.length <= 1) return { registros: 0, total: 0 };
  const headers = dados[0].map(function(h){ return String(h || '').trim().toUpperCase(); });
  const idxValor = indexHeader(headers, ['VALOR','TOTAL','VALOR_TOTAL']);
  const total = dados.slice(1).reduce(function(s, r){ return s + (Number(idxValor >= 0 ? r[idxValor] : 0) || 0); }, 0);
  return { registros: dados.length - 1, total: Number(total.toFixed(2)) };
}

function obterResumoComprasWeb() {
  const sh = SpreadsheetApp.getActive().getSheetByName('COMPRAS');
  if (!sh) return { registros: 0, total: 0 };
  const dados = sh.getDataRange().getValues();
  if (dados.length <= 1) return { registros: 0, total: 0 };
  const headers = dados[0].map(function(h){ return String(h || '').trim().toUpperCase(); });
  const idxValor = indexHeader(headers, ['VALOR','TOTAL','VALOR_TOTAL']);
  const total = dados.slice(1).reduce(function(s, r){ return s + (Number(idxValor >= 0 ? r[idxValor] : 0) || 0); }, 0);
  return { registros: dados.length - 1, total: Number(total.toFixed(2)) };
}

function obterResumoComandasWeb() {
  const abertas = listarComandasAbertasWeb();
  return { abertas: abertas.length };
}

function abrirDriveWeb() {
  const link = obterLinkDriveWeb();
  if (!link) {
    return { ok: false, mensagem: 'Link do Drive não configurado na aba CONFIG.' };
  }
  return { ok: true, url: link, mensagem: 'Link do Drive carregado.' };
}

function obterLinkDriveWeb() {
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName('CONFIG');
    if (!sh) return '';
    const dados = sh.getDataRange().getValues();
    for (var i = 0; i < dados.length; i++) {
      const key = String(dados[i][0] || '').toUpperCase();
      if (key.indexOf('DRIVE') !== -1) {
        return String(dados[i][1] || '').trim();
      }
    }
  } catch (_) {}
  return '';
}

function indexHeader(headers, options) {
  for (var i = 0; i < options.length; i++) {
    var idx = headers.indexOf(options[i]);
    if (idx >= 0) return idx;
  }
  return -1;
}

function obterValorTotalEstoqueSafe() {
  try {
    return obterValorTotalEstoque();
  } catch (_) {
    const estoque = obterDadosEstoque();
    const produtos = obterDadosProdutos();
    let total = 0;
    estoque.forEach(function(linha) {
      const nome = String(linha[0] || '').trim();
      const qtd = Number(linha[1]) || 0;
      const p = produtos[nome] || {};
      total += qtd * (Number(p.preco) || 0);
    });
    return Number(total.toFixed(2));
  }
}

function analisarRentabilidadeEstoqueSafe() {
  try {
    return analisarRentabilidadeEstoque();
  } catch (_) {
    return null;
  }
}

function obterNomeDepositoWebSafe() {
  try {
    const sh = SpreadsheetApp.getActive().getSheetByName('CONFIG');
    if (!sh) return 'Gestão de Depósito';
    const dados = sh.getDataRange().getValues();
    for (var i = 0; i < dados.length; i++) {
      const key = String(dados[i][0] || '').toUpperCase();
      if (key.indexOf('NOME_DEPOSITO') !== -1 || key.indexOf('DEPOSITO') !== -1) {
        if (dados[i][1]) return String(dados[i][1]);
      }
    }
  } catch (_) {}
  return 'Gestão de Depósito';
}

function obterUsuarioAtualWebSafe() {
  try {
    const u = obterUsuarioAtual();
    if (u) return u;
  } catch (_) {}

  return {
    nome: Session.getActiveUser().getEmail() || 'Usuário Web',
    EMAIL: Session.getActiveUser().getEmail() || ''
  };
}
