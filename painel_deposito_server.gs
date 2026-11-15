/**
 * ============================================================================
 * 👑 PAINEL EXECUTIVO & PDV 360° - GESTÃO DE DEPÓSITO (BACKEND SERVER)
 * ============================================================================
 * Central de inteligência, agregação de KPIs, catálogo de produtos em cache,
 * comandas balcão em aberto, motor de PDV Balcão/Delivery e configuração geral.
 */

/**
 * Retorna todos os dados consolidados para o Painel Executivo 360°, PDV e Configurações.
 */
function obterDadosPainel360() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const nomeDeposito = typeof getNomeDeposito === 'function' ? getNomeDeposito() : 'Gestão de Depósito';
    const spreadsheetUrl = ss.getUrl();
    const spreadsheetId = ss.getId();

    // 1. Data de Hoje
    const hoje = new Date();
    const hojeStr = formatarDataSimples(hoje);
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    // 2. Leitura de VENDAS
    let faturamentoHoje = 0;
    let faturamentoMes = 0;
    let totalVendasHoje = 0;
    const rankingVendas = {};
    const ultimasVendas = [];

    const shVendas = ss.getSheetByName('VENDAS');
    if (shVendas && shVendas.getLastRow() > 1) {
      const dadosVendas = shVendas.getRange(2, 1, shVendas.getLastRow() - 1, Math.min(shVendas.getLastColumn(), 6)).getValues();
      for (let i = dadosVendas.length - 1; i >= 0; i--) {
        const row = dadosVendas[i];
        const dataVenda = row[0] ? new Date(row[0]) : null;
        const prod = String(row[1] || '').trim();
        const qtd = Number(row[2]) || 0;
        const valor = Number(row[3]) || 0;
        const pgto = String(row[4] || 'Outro').trim();
        const origem = String(row[5] || 'Balcão').trim();

        if (dataVenda && !isNaN(dataVenda.getTime())) {
          // Vendas deste mês
          if (dataVenda.getMonth() === mesAtual && dataVenda.getFullYear() === anoAtual) {
            faturamentoMes += valor;
          }
          // Vendas de hoje
          if (formatarDataSimples(dataVenda) === hojeStr) {
            faturamentoHoje += valor;
            totalVendasHoje++;
          }
        }

        // Ranking
        if (prod) {
          rankingVendas[prod] = (rankingVendas[prod] || 0) + qtd;
        }

        // Últimas 20 vendas para o feed
        if (ultimasVendas.length < 20 && prod) {
          ultimasVendas.push({
            data: dataVenda ? formatarHoraMinuto(dataVenda) : '--:--',
            dataCompleta: dataVenda ? Utilities.formatDate(dataVenda, 'America/Bahia', 'dd/MM/yyyy HH:mm') : '',
            produto: prod,
            qtd: qtd,
            valor: valor,
            pagamento: pgto,
            origem: origem
          });
        }
      }
    }

    const ticketMedioHoje = totalVendasHoje > 0 ? (faturamentoHoje / totalVendasHoje) : 0;

    // 3. Leitura do CAIXA
    let saldoCaixa = 0;
    let entradasHoje = 0;
    let saidasHoje = 0;
    const formasPgtoHoje = {
      'PIX': 0,
      'Dinheiro': 0,
      'Cartão Débito': 0,
      'Cartão Crédito': 0,
      'Fiado': 0,
      'Outros': 0
    };

    const shCaixa = ss.getSheetByName('CAIXA');
    if (shCaixa && shCaixa.getLastRow() > 1) {
      const dadosCaixa = shCaixa.getRange(2, 1, shCaixa.getLastRow() - 1, Math.min(shCaixa.getLastColumn(), 6)).getValues();
      for (let i = 0; i < dadosCaixa.length; i++) {
        const row = dadosCaixa[i];
        const dataCaixa = row[0] ? new Date(row[0]) : null;
        const tipo = String(row[1] || '').trim().toUpperCase();
        const valor = Number(row[2]) || 0;
        const forma = String(row[3] || '').trim();

        if (tipo === 'ENTRADA') {
          saldoCaixa += valor;
        } else if (tipo === 'SAÍDA' || tipo === 'SAIDA') {
          saldoCaixa -= valor;
        }

        // Movimento de hoje
        if (dataCaixa && formatarDataSimples(dataCaixa) === hojeStr) {
          if (tipo === 'ENTRADA') {
            entradasHoje += valor;
            const formaNorm = normalizarFormaPgto(forma);
            formasPgtoHoje[formaNorm] = (formasPgtoHoje[formaNorm] || 0) + valor;
          } else if (tipo === 'SAÍDA' || tipo === 'SAIDA') {
            saidasHoje += valor;
          }
        }
      }
    }

    // 4. Leitura de PRODUTOS e ESTOQUE
    const produtos = [];
    const produtosCriticos = [];
    let valorEstoqueCusto = 0;
    let valorEstoqueVenda = 0;

    const mapaEstoque = {};
    const shEstoque = ss.getSheetByName('ESTOQUE');
    if (shEstoque && shEstoque.getLastRow() > 1) {
      const dEst = shEstoque.getRange(2, 1, shEstoque.getLastRow() - 1, Math.min(shEstoque.getLastColumn(), 4)).getValues();
      dEst.forEach(r => {
        const n = String(r[0] || '').trim().toUpperCase();
        if (n) {
          mapaEstoque[n] = {
            qtd: Number(r[1]) || 0,
            minimo: Number(r[2]) || 0,
            status: String(r[3] || '')
          };
        }
      });
    }

    const shProdutos = ss.getSheetByName('PRODUTOS');
    if (shProdutos && shProdutos.getLastRow() > 1) {
      const dProd = shProdutos.getRange(2, 1, shProdutos.getLastRow() - 1, Math.min(shProdutos.getLastColumn(), 12)).getValues();
      dProd.forEach((r, idx) => {
        const nomeProd = String(r[0] || '').trim();
        if (!nomeProd) return;

        const chave = nomeProd.toUpperCase();
        const categoria = String(r[1] || 'Geral').trim();
        const marca = String(r[2] || '').trim();
        const volume = String(r[3] || '').trim();
        const preco = Number(r[4]) || 0;
        const minimo = Number(r[5]) || (mapaEstoque[chave] ? mapaEstoque[chave].minimo : 0);
        const custo = Number(r[6]) || 0;
        const rawMargem = Number(r[7]) || (custo > 0 ? ((preco - custo) / custo) : 0);
        const margemPct = rawMargem > 1 ? rawMargem : Number((rawMargem * 100).toFixed(1));
        const precoSug = Number(r[8]) || (custo > 0 ? Number((custo * (1 + (margemPct / 100))).toFixed(2)) : preco);
        const statusMargem = String(r[9] || (preco >= precoSug ? '✅ OK' : '🚨 BAIXA')).trim();
        const idProd = String(r[10] || (idx + 1)).trim();

        let qtd = 0;
        if (mapaEstoque[chave] !== undefined) {
          qtd = mapaEstoque[chave].qtd;
        } else if (r[11] !== undefined && r[11] !== '') {
          qtd = Number(r[11]) || 0;
        }

        let status = 'OK';
        if (qtd <= 0 || qtd <= minimo) {
          status = 'CRITICO';
        } else if (qtd <= minimo * 2) {
          status = 'BAIXO';
        }

        valorEstoqueCusto += (qtd * custo);
        valorEstoqueVenda += (qtd * preco);

        const prodItem = {
          id: idProd,
          nome: nomeProd,
          categoria: categoria,
          marca: marca,
          volume: volume,
          preco: preco,
          custo: custo,
          minimo: minimo,
          estoque: qtd,
          status: status,
          margem: margemPct,
          precoSugerido: precoSug,
          statusMargem: statusMargem
        };

        produtos.push(prodItem);

        if (status === 'CRITICO') {
          produtosCriticos.push(prodItem);
        }
      });
    }

    // Ordenação: Produtos com estoque (> 0) primeiro, esgotados depois; dentro do grupo, ordem alfabética
    produtos.sort((a, b) => {
      const estA = Number(a.estoque) || 0;
      const estB = Number(b.estoque) || 0;
      const hasA = estA > 0 ? 1 : 0;
      const hasB = estB > 0 ? 1 : 0;
      if (hasA !== hasB) {
        return hasB - hasA;
      }
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });

    // 5. Leitura de CLIENTES
    const clientes = [];
    const shClientes = ss.getSheetByName('CLIENTES');
    if (shClientes && shClientes.getLastRow() > 1) {
      const dCli = shClientes.getDataRange().getValues();
      const headersCli = dCli[0].map(h => String(h || '').toUpperCase().trim());
      
      let idxNome = headersCli.findIndex(h => h.includes('NOME') || h.includes('CLIENTE'));
      if (idxNome === -1) idxNome = 0;
      let idxTel = headersCli.findIndex(h => h.includes('TEL') || h.includes('FONE') || h.includes('WHATS'));
      if (idxTel === -1) idxTel = 1;
      let idxEnd = headersCli.findIndex(h => h.includes('END'));
      if (idxEnd === -1) idxEnd = 2;
      let idxRef = headersCli.findIndex(h => h.includes('REF'));
      if (idxRef === -1) idxRef = 3;
      let idxObs = headersCli.findIndex(h => h.includes('OBS'));
      if (idxObs === -1) idxObs = 4;

      for (let i = 1; i < dCli.length; i++) {
        const r = dCli[i];
        const nome = String(r[idxNome] || '').trim();
        if (nome) {
          clientes.push({
            nome: nome,
            telefone: String(r[idxTel] || '').trim(),
            endereco: String(r[idxEnd] || '').trim(),
            referencia: String(r[idxRef] || '').trim(),
            obs: String(r[idxObs] || '').trim()
          });
        }
      }
    }
    clientes.sort((a, b) => a.nome.localeCompare(b.nome));

    // 6. Leitura de DELIVERYS (Ativos & Recentes)
    const deliverys = [];
    let deliverysPendentes = 0;
    const shDel = ss.getSheetByName('DELIVERY');
    if (shDel && shDel.getLastRow() > 1) {
      const dDel = shDel.getRange(2, 1, shDel.getLastRow() - 1, Math.min(shDel.getLastColumn(), 11)).getValues();
      for (let i = dDel.length - 1; i >= 0; i--) {
        const r = dDel[i];
        const numPedido = r[0];
        if (!numPedido) continue;

        const dataDel = r[1] ? new Date(r[1]) : null;
        const statusDel = String(r[7] || 'PEDIDO FEITO').trim().toUpperCase();

        const isPendente = (statusDel !== 'ENTREGUE' && statusDel !== 'FINALIZADO' && statusDel !== 'CANCELADO');
        if (isPendente) {
          deliverysPendentes++;
        }

        if (deliverys.length < 30) {
          deliverys.push({
            pedido: numPedido,
            dataHora: dataDel ? Utilities.formatDate(dataDel, 'America/Bahia', 'dd/MM/yyyy HH:mm') : '',
            cliente: String(r[2] || 'Consumidor').trim(),
            total: Number(r[5]) || 0,
            pagamento: String(r[6] || '').trim(),
            status: statusDel,
            entregador: String(r[8] || '').trim(),
            endereco: String(r[9] || '').trim(),
            idPedido: String(r[10] || '').trim()
          });
        }
      }
    }

    // 7. COMANDAS BALCÃO EM ABERTO (CARDS COMPLETOS COM ITENS & TOTAL)
    const comandasAbertas = [];
    const mapaItensComandas = {};

    const shComItens = ss.getSheetByName('COMANDA_ITENS');
    if (shComItens && shComItens.getLastRow() > 1) {
      const dItens = shComItens.getRange(2, 1, shComItens.getLastRow() - 1, Math.min(shComItens.getLastColumn(), 5)).getValues();
      dItens.forEach(r => {
        const ped = String(r[0] || '').trim();
        if (!ped) return;
        if (!mapaItensComandas[ped]) mapaItensComandas[ped] = [];
        const prod = String(r[1] || '').trim();
        const qtd = Number(r[2]) || 0;
        const unit = Number(r[3]) || 0;
        const totalItem = Number(r[4]) || (qtd * unit);
        mapaItensComandas[ped].push({
          produto: prod,
          qtd: qtd,
          unit: unit,
          total: totalItem
        });
      });
    }

    const shCom = ss.getSheetByName('COMANDAS');
    if (shCom && shCom.getLastRow() > 1) {
      const dCom = shCom.getRange(2, 1, shCom.getLastRow() - 1, Math.min(shCom.getLastColumn(), 5)).getValues();
      dCom.forEach(r => {
        const ped = String(r[0] || '').trim();
        const dataCom = r[1] ? new Date(r[1]) : null;
        const cli = String(r[2] || 'Balcão').trim();
        const origem = String(r[3] || 'BALCAO').trim();
        const st = String(r[4] || '').toUpperCase().trim();

        if (st === 'ABERTA' || st === 'EM ABERTO' || st === 'AGUARDANDO_PGTO') {
          const itens = mapaItensComandas[ped] || [];
          let totalComanda = 0;
          itens.forEach(it => { totalComanda += it.total; });

          comandasAbertas.push({
            pedido: ped,
            cliente: cli,
            origem: origem,
            status: st,
            dataHora: dataCom ? Utilities.formatDate(dataCom, 'America/Bahia', 'dd/MM/yyyy HH:mm') : '',
            itens: itens,
            total: totalComanda
          });
        }
      });
    }

    // 8. Contas a Pagar (Hoje / Vencidas)
    let contasPagarHojeCount = 0;
    let contasPagarHojeValor = 0;
    const shContas = ss.getSheetByName('CONTAS_A_PAGAR');
    if (shContas && shContas.getLastRow() > 1) {
      const dContas = shContas.getRange(2, 1, shContas.getLastRow() - 1, Math.min(shContas.getLastColumn(), 7)).getValues();
      dContas.forEach(r => {
        const st = String(r[5] || '').toUpperCase().trim();
        if (st === 'PENDENTE' || st === 'EM ABERTO' || st === 'A PAGAR') {
          const val = Number(r[2]) || 0;
          const dtVenc = r[4] ? new Date(r[4]) : null;
          if (dtVenc && !isNaN(dtVenc.getTime())) {
            if (formatarDataSimples(dtVenc) <= hojeStr) {
              contasPagarHojeCount++;
              contasPagarHojeValor += val;
            }
          }
        }
      });
    }

    // 9. Ranking dos Top 6 mais vendidos
    const topProdutos = Object.keys(rankingVendas)
      .map(k => ({ produto: k, qtd: rankingVendas[k] }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 6);

    // 10. Configurações Atuais do Depósito
    const configs = obterMapaConfiguracoes();

    return {
      sucesso: true,
      timestamp: Utilities.formatDate(new Date(), 'America/Bahia', 'dd/MM/yyyy HH:mm:ss'),
      nomeDeposito: nomeDeposito,
      spreadsheetUrl: spreadsheetUrl,
      spreadsheetId: spreadsheetId,
      kpis: {
        faturamentoHoje: faturamentoHoje,
        faturamentoMes: faturamentoMes,
        totalVendasHoje: totalVendasHoje,
        ticketMedioHoje: ticketMedioHoje,
        saldoCaixa: saldoCaixa,
        entradasHoje: entradasHoje,
        saidasHoje: saidasHoje,
        valorEstoqueCusto: valorEstoqueCusto,
        valorEstoqueVenda: valorEstoqueVenda,
        totalProdutos: produtos.length,
        qtdCriticos: produtosCriticos.length,
        deliverysPendentes: deliverysPendentes,
        comandasAbertasCount: comandasAbertas.length,
        contasPagarHojeCount: contasPagarHojeCount,
        contasPagarHojeValor: contasPagarHojeValor
      },
      formasPgtoHoje: formasPgtoHoje,
      produtos: produtos,
      clientes: clientes,
      deliverys: deliverys,
      comandasAbertas: comandasAbertas,
      ultimasVendas: ultimasVendas,
      produtosCriticos: produtosCriticos.slice(0, 15),
      topProdutos: topProdutos,
      configs: configs
    };

  } catch (err) {
    console.error('Erro em obterDadosPainel360:', err);
    return {
      sucesso: false,
      erro: err.message
    };
  }
}

/**
 * Retorna as chaves e valores da aba CONFIG formatados.
 */
function obterMapaConfiguracoes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('CONFIG');
  const mapa = {
    nome: '',
    dono: '',
    cnpj: '',
    telefone: '',
    cidade: '',
    chave_pix: '',
    drive_url: '',
    telegram_token: '',
    telegram_chat_id: ''
  };
  if (!sh || sh.getLastRow() <= 1) return mapa;

  const dados = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
  dados.forEach(r => {
    const k = String(r[0] || '').trim().toUpperCase();
    const v = String(r[1] || '').trim();
    if (k === 'NOME_DEPOSITO') mapa.nome = v;
    if (k === 'DONO') mapa.dono = v;
    if (k === 'CNPJ') mapa.cnpj = v;
    if (k === 'TELEFONE') mapa.telefone = v;
    if (k === 'CIDADE') mapa.cidade = v;
    if (k === 'CHAVE_PIX') mapa.chave_pix = v;
    if (k === 'DRIVE_URL') mapa.drive_url = v;
    if (k === 'TELEGRAM_BOT_TOKEN') mapa.telegram_token = v;
    if (k === 'TELEGRAM_DONO_CHAT_ID') mapa.telegram_chat_id = v;
  });
  return mapa;
}

/**
 * Salva as configurações gerais do sistema a partir do painel.
 */
function salvarConfiguracoesGerais360(dados) {
  try {
    if (!dados || typeof dados !== 'object') {
      throw new Error('Dados inválidos para salvar configurações.');
    }

    if (typeof salvarConfiguracoesSistema === 'function') {
      const res = salvarConfiguracoesSistema(dados);
      return { sucesso: true, msg: 'Configurações atualizadas com sucesso!' };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName('CONFIG');
    if (!sh) {
      sh = ss.insertSheet('CONFIG');
      sh.appendRow(['CHAVE', 'VALOR', 'DESCRIÇÃO']);
    }

    const configsMap = [
      ['NOME_DEPOSITO', dados.nome || '', 'Nome do depósito'],
      ['DONO', dados.dono || '', 'Nome do dono / responsável'],
      ['CNPJ', dados.cnpj || '', 'CNPJ'],
      ['TELEFONE', dados.telefone || '', 'Telefone / WhatsApp'],
      ['CIDADE', dados.cidade || '', 'Cidade / UF'],
      ['CHAVE_PIX', dados.chave_pix || '', 'Chave Pix para recebimentos'],
      ['TELEGRAM_BOT_TOKEN', dados.telegram_token || '', 'Token do bot do Telegram'],
      ['TELEGRAM_DONO_CHAT_ID', dados.telegram_chat_id || '', 'ID do chat do Telegram do Dono']
    ];

    const plan = sh.getDataRange().getValues();
    configsMap.forEach(cfg => {
      let achou = false;
      for (let i = 1; i < plan.length; i++) {
        if (plan[i][0] === cfg[0]) {
          sh.getRange(i + 1, 2).setValue(cfg[1]);
          achou = true;
          break;
        }
      }
      if (!achou) {
        sh.appendRow(cfg);
      }
    });

    return { sucesso: true, msg: 'Configurações salvas com sucesso!' };
  } catch (err) {
    console.error('Erro em salvarConfiguracoesGerais360:', err);
    return { sucesso: false, erro: err.message };
  }
}

/**
 * Cria ou abre uma Comanda Balcão e salva seus itens em aberto.
 */
function salvarComandaBalcaoAberta360(payload) {
  try {
    if (!payload || !payload.itens || !Array.isArray(payload.itens) || payload.itens.length === 0) {
      throw new Error('Adicione pelo menos 1 item para abrir a comanda.');
    }

    const cliente = String(payload.cliente || 'Consumidor Balcão').trim();
    let pedido = payload.pedido;

    // Se não tiver número, gera nova comanda
    if (!pedido) {
      if (typeof criarComandaBalcao === 'function') {
        pedido = criarComandaBalcao(cliente);
      } else {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        let shCom = ss.getSheetByName('COMANDAS');
        if (!shCom) shCom = ss.insertSheet('COMANDAS');
        pedido = Math.floor(Date.now() / 1000) % 100000;
        shCom.appendRow([pedido, new Date(), cliente, 'BALCAO', 'ABERTA']);
      }
    }

    // Salva itens da comanda
    if (typeof salvarItensComandaAberta === 'function') {
      salvarItensComandaAberta(pedido, payload.itens);
    } else {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let shItens = ss.getSheetByName('COMANDA_ITENS');
      if (!shItens) shItens = ss.insertSheet('COMANDA_ITENS');
      payload.itens.forEach(i => {
        const q = Number(i.qtd) || 0;
        const u = Number(i.unit) || 0;
        shItens.appendRow([pedido, i.produto, q, u, q * u]);
        try {
          if (typeof baixarEstoquePorComanda === 'function') {
            baixarEstoquePorComanda(i.produto, q);
          }
        } catch (eEst) {}
      });
    }

    return {
      sucesso: true,
      msg: 'Comanda #' + pedido + ' registrada com sucesso!',
      pedido: pedido
    };
  } catch (err) {
    console.error('Erro em salvarComandaBalcaoAberta360:', err);
    return { sucesso: false, erro: err.message };
  }
}

/**
 * Adiciona um novo produto a uma Comanda Balcão que já está aberta.
 * Baixa o estoque do produto e registra o item em COMANDA_ITENS.
 */
function adicionarItemComandaBalcao360(pedido, produto, qtd, unit) {
  try {
    if (!pedido) throw new Error('Número da comanda não informado.');
    if (!produto) throw new Error('Selecione um produto.');
    qtd = Number(qtd) || 1;
    unit = Number(unit) || 0;
    if (qtd <= 0) throw new Error('Quantidade deve ser maior que zero.');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let shItens = ss.getSheetByName('COMANDA_ITENS');
    if (!shItens) {
      shItens = ss.insertSheet('COMANDA_ITENS');
      shItens.appendRow(['Pedido', 'Produto', 'Qtd', 'Valor Unit', 'Total', 'Processado']);
    }

    // 1. Baixar Estoque imediatamente
    try {
      if (typeof baixarEstoquePorComanda === 'function') {
        baixarEstoquePorComanda(produto, qtd);
      } else {
        baixarEstoqueManual(produto, qtd);
      }
    } catch (eEst) {
      throw new Error('Estoque insuficiente para ' + produto + ': ' + eEst.message);
    }

    // 2. Registrar item na comanda
    shItens.appendRow([
      pedido,
      produto,
      qtd,
      unit,
      qtd * unit,
      'SIM'
    ]);

    // 3. Sincronizar Estoque na planilha
    try {
      if (typeof atualizarEstoque === 'function') {
        atualizarEstoque();
      }
    } catch (eSync) {}

    return {
      sucesso: true,
      msg: qtd + 'x ' + produto + ' adicionado(s) à Comanda #' + pedido + '!'
    };
  } catch (err) {
    console.error('Erro em adicionarItemComandaBalcao360:', err);
    return { sucesso: false, erro: err.message };
  }
}

/**
 * Fecha uma Comanda Balcão existente com baixa de pagamento no caixa.
 */
function fecharComandaBalcao360(pedido, formaPgto) {
  try {
    if (!pedido) throw new Error('Número da comanda não informado.');
    formaPgto = String(formaPgto || 'Dinheiro').trim();

    if (typeof fecharComandaBalcaoFinal === 'function') {
      fecharComandaBalcaoFinal(pedido, formaPgto);
      return { sucesso: true, msg: 'Comanda #' + pedido + ' finalizada com sucesso!' };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const shCom = ss.getSheetByName('COMANDAS');
    if (!shCom) throw new Error('Aba COMANDAS não encontrada.');

    const dados = shCom.getDataRange().getValues();
    let rowIndex = -1;
    for (let i = 1; i < dados.length; i++) {
      if (String(dados[i][0]) === String(pedido)) {
        rowIndex = i + 1;
        break;
      }
    }

    if (rowIndex === -1) throw new Error('Comanda #' + pedido + ' não encontrada.');
    shCom.getRange(rowIndex, 5).setValue('FECHADA');

    return { sucesso: true, msg: 'Comanda #' + pedido + ' finalizada!' };
  } catch (err) {
    console.error('Erro em fecharComandaBalcao360:', err);
    return { sucesso: false, erro: err.message };
  }
}

/**
 * Retorna os detalhes financeiros de uma comanda: Total consumido, Total já pago e Saldo devedor.
 */
function obterFinanceiroComanda360(pedido) {
  try {
    if (!pedido) throw new Error('Número da comanda não informado.');

    let total = 0;
    if (typeof calcularTotalComanda === 'function') {
      total = Number(calcularTotalComanda(pedido)) || 0;
    }

    let pagos = 0;
    if (typeof calcularPagamentosComanda === 'function') {
      pagos = Number(calcularPagamentosComanda(pedido)) || 0;
    }

    let saldo = Math.max(0, total - pagos);
    let cliente = '';
    if (typeof getClienteDaComanda === 'function') {
      cliente = getClienteDaComanda(pedido);
    }

    return {
      sucesso: true,
      pedido: pedido,
      cliente: cliente || 'Consumidor',
      total: total,
      pagos: pagos,
      saldo: saldo,
      quitado: saldo <= 0 && total > 0
    };
  } catch (err) {
    console.error('Erro em obterFinanceiroComanda360:', err);
    return { sucesso: false, erro: err.message };
  }
}

/**
 * Registra uma amortização / pagamento parcial de uma comanda sem fechá-la.
 * Utiliza o motor homologado da planilha (lançando no Caixa como 'COMANDA #pedido (PARCIAL)').
 */
function registrarPagamentoParcialComanda360(pedido, valor, formaPgto) {
  try {
    if (!pedido) throw new Error('Número da comanda não informado.');
    valor = Number(valor);
    if (!valor || valor <= 0) throw new Error('Valor inválido para pagamento.');
    formaPgto = String(formaPgto || 'Dinheiro').trim();

    if (typeof registrarPagamentoParcialComanda === 'function') {
      const res = registrarPagamentoParcialComanda(pedido, valor, formaPgto);
      if (res && res.ok) {
        return {
          sucesso: true,
          msg: `Pagamento parcial de R$ ${valor.toFixed(2).replace('.', ',')} (${formaPgto}) registrado com sucesso!`,
          saldoAtual: res.saldoAtual,
          quitado: res.quitado
        };
      } else {
        throw new Error(res?.msg || 'Erro ao registrar pagamento parcial');
      }
    }

    // Fallback se não encontrar a função nativa:
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const shCaixa = ss.getSheetByName('CAIXA');
    if (!shCaixa) throw new Error('Aba CAIXA não encontrada.');

    if (typeof inserirLinhaNoTopo === 'function') {
      inserirLinhaNoTopo('CAIXA', [
        new Date(),
        'Entrada',
        valor,
        formaPgto,
        `COMANDA #${pedido} (PARCIAL)`
      ]);
    } else {
      shCaixa.appendRow([
        new Date(),
        'Entrada',
        valor,
        formaPgto,
        `COMANDA #${pedido} (PARCIAL)`
      ]);
    }

    const fin = obterFinanceiroComanda360(pedido);
    return {
      sucesso: true,
      msg: `Pagamento parcial de R$ ${valor.toFixed(2).replace('.', ',')} (${formaPgto}) registrado com sucesso!`,
      saldoAtual: fin.saldo,
      quitado: fin.quitado
    };
  } catch (err) {
    console.error('Erro em registrarPagamentoParcialComanda360:', err);
    return { sucesso: false, erro: err.message };
  }
}

/**
 * Executa uma Venda Balcão direta com baixa de estoque e entrada no caixa.
 * @param {Object} payload { cliente, itens: [{ produto, qtd, unit, total }], formaPgto, trocoPara, obs }
 */
function executarVendaBalcao360(payload) {
  try {
    if (!payload || !payload.itens || !Array.isArray(payload.itens) || payload.itens.length === 0) {
      throw new Error('O carrinho de compras está vazio.');
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const shVendas = ss.getSheetByName('VENDAS');
    if (!shVendas) throw new Error('Aba VENDAS não encontrada.');

    const shEstoque = ss.getSheetByName('ESTOQUE');
    if (!shEstoque) throw new Error('Aba ESTOQUE não encontrada.');

    const cliente = String(payload.cliente || 'Consumidor Final (Balcão)').trim();
    const formaPgto = String(payload.formaPgto || 'Dinheiro').trim();
    const agora = new Date();
    let totalVenda = 0;

    // 0. VERIFICA CONFIGURAÇÃO DE ESTOQUE NEGATIVO
    const permitirNegativo = (typeof getConfig === 'function' ? getConfig('PERMITIR_ESTOQUE_NEGATIVO') : '') === 'SIM';

    // =========================================================================
    // 🛡️ FASE 1: PRÉ-VALIDAÇÃO ATÔMICA ("TUDO OU NADA")
    // Verifica o estoque de TODOS os itens do carrinho ANTES de gravar qualquer linha
    // =========================================================================
    const dadosEstoque = shEstoque.getDataRange().getValues();
    const mapaEstoqueLinhas = {}; // nome_lower -> { rowIdx, atual, nomeOriginal }
    const safeNorm = str => String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toUpperCase().trim();

    for (let r = 1; r < dadosEstoque.length; r++) {
      const pNome = String(dadosEstoque[r][0] || '').trim();
      if (pNome) {
        mapaEstoqueLinhas[safeNorm(pNome)] = {
          rowIdx: r + 1,
          nomeOriginal: pNome,
          atual: Number(dadosEstoque[r][1]) || 0
        };
      }
    }

    // Se Supabase estiver conectado, obtém mapa de estoque do banco
    let mapaSupaEstoque = null;
    if (typeof supabaseObterMapaEstoque === 'function') {
      try {
        mapaSupaEstoque = supabaseObterMapaEstoque();
      } catch (eSupa) {}
    }

    const itensValidados = [];
    for (let i = 0; i < payload.itens.length; i++) {
      const item = payload.itens[i];
      const prodNome = String(item.produto || '').trim();
      const qtd = Number(item.qtd) || 0;
      const unit = Number(item.unit) || 0;
      const subtotal = Number(item.total) || (qtd * unit);

      if (!prodNome || qtd <= 0) {
        throw new Error('Item com dados inválidos no carrinho: ' + (prodNome || 'Sem nome'));
      }

      const keyNorm = safeNorm(prodNome);
      const estInfo = mapaEstoqueLinhas[keyNorm];
      const estoquePlanilha = estInfo ? estInfo.atual : 0;
      const estoqueAtual = (mapaSupaEstoque && mapaSupaEstoque[keyNorm] !== undefined) ? mapaSupaEstoque[keyNorm] : estoquePlanilha;

      // 🚫 BLOQUEIO IMEDIATO: Se algum item não tiver estoque, aborta a transação inteira
      if (!permitirNegativo && estoqueAtual < qtd) {
        return {
          sucesso: false,
          erro: `❌ Venda não realizada: Estoque insuficiente para "${prodNome}". Disponível: ${estoqueAtual} un, Solicitado: ${qtd} un.`
        };
      }

      itensValidados.push({
        produto: prodNome,
        qtd: qtd,
        unit: unit,
        subtotal: subtotal,
        rowIdxEstoque: estInfo ? estInfo.rowIdx : null,
        estoqueRestante: estoqueAtual - qtd
      });

      totalVenda += subtotal;
    }

    // =========================================================================
    // 🚀 FASE 2: EXECUÇÃO GARANTIDA (Todos os itens foram 100% validados!)
    // =========================================================================
    itensValidados.forEach(item => {
      // 1. Baixa o estoque na Planilha
      if (item.rowIdxEstoque) {
        shEstoque.getRange(item.rowIdxEstoque, 2).setValue(item.estoqueRestante);
      } else {
        // Se não estava na aba estoque, tenta função nativa de comanda
        try {
          if (typeof baixarEstoquePorComanda === 'function') {
            baixarEstoquePorComanda(item.produto, item.qtd);
          }
        } catch (eB) {}
      }

      // 2. Sincroniza baixa no Supabase (se conectado)
      if (typeof supabaseAjustarEstoque === 'function') {
        try {
          supabaseAjustarEstoque(item.produto, item.estoqueRestante);
        } catch (eSupa) {}
      }

      // 3. Registra na aba VENDAS
      shVendas.appendRow([
        agora,
        item.produto,
        item.qtd,
        item.subtotal,
        formaPgto,
        'Balcão'
      ]);

      // 4. Registra venda no Supabase (se conectado)
      if (typeof supabaseRequest === 'function') {
        try {
          supabaseRequest('vendas', 'POST', {
            data_hora: agora.toISOString(),
            produto_nome: item.produto,
            quantidade: item.qtd,
            valor_unitario: item.unit,
            valor_total: item.subtotal,
            forma_pagamento: formaPgto,
            origem: 'Balcão',
            vendedor: 'Balcão'
          });
        } catch (eSupaVenda) {}
      }
    });

    // Sincroniza status visual do estoque se função existir
    try {
      if (typeof atualizarEstoque === 'function') {
        atualizarEstoque();
      }
    } catch (eSync) {}

    // Garante cadastro do cliente caso seja identificado
    if (cliente && cliente.toUpperCase() !== 'CONSUMIDOR FINAL' && cliente.toUpperCase() !== 'CONSUMIDOR FINAL (BALCÃO)') {
      try {
        garantirClienteCadastrado(cliente);
      } catch (eCad) {}
    }

    // Registra no CAIXA ou CONTAS_A_RECEBER (Fiado)
    const isFiado = formaPgto.toUpperCase().includes('FIADO');
    if (isFiado) {
      try {
        if (typeof criarContaAReceber === 'function') {
          const idVenda = 'BALCAO_' + Utilities.formatDate(agora, 'America/Bahia', 'yyyyMMdd_HHmmss');
          criarContaAReceber('BALCAO', idVenda, cliente, totalVenda, 'FIADO');
        }
      } catch (eFiado) {
        console.warn('Erro ao criar conta a receber de fiado balcão:', eFiado.message);
      }
    } else {
      try {
        if (typeof registrarCaixa === 'function') {
          registrarCaixa(agora, 'Entrada', totalVenda, formaPgto, 'Balcão', 'Venda Balcão - ' + cliente);
        } else {
          const shCaixa = ss.getSheetByName('CAIXA');
          if (shCaixa) {
            shCaixa.appendRow([agora, 'Entrada', totalVenda, formaPgto, 'Balcão', 'Venda Balcão - ' + cliente]);
          }
        }

        // Sincroniza Caixa com Supabase
        if (typeof supabaseRequest === 'function') {
          try {
            supabaseRequest('caixa', 'POST', {
              data_hora: agora.toISOString(),
              tipo: 'ENTRADA',
              valor: totalVenda,
              forma_pagamento: formaPgto,
              descricao: 'Venda Balcão - ' + cliente,
              operador: 'Balcão',
              origem: 'Balcão'
            });
          } catch (eSupaCaixa) {}
        }
      } catch (eCaixa) {
        console.warn('Erro ao registrar caixa:', eCaixa.message);
      }
    }

    return {
      sucesso: true,
      msg: 'Venda de Balcão registrada com sucesso!' + (isFiado ? ' (Registrado no Fiado)' : ''),
      total: totalVenda,
      cliente: cliente,
      formaPgto: formaPgto,
      itensCount: payload.itens.length
    };

  } catch (err) {
    console.error('Erro em executarVendaBalcao360:', err);
    return {
      sucesso: false,
      erro: err.message
    };
  }
}

/**
 * Cria um novo Pedido de Delivery com endereço, taxa e itens.
 * @param {Object} payload { cliente, telefone, endereco, referencia, entregador, taxaEntrega, formaPgto, itens: [{ produto, qtd, unit, total }], obs }
 */
function executarVendaDelivery360(payload) {
  try {
    if (!payload || !payload.itens || !Array.isArray(payload.itens) || payload.itens.length === 0) {
      throw new Error('Nenhum item selecionado para o pedido de delivery.');
    }

    const cliente = String(payload.cliente || '').trim();
    if (!cliente) throw new Error('Nome do cliente é obrigatório para Delivery.');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const shDel = ss.getSheetByName('DELIVERY');
    if (!shDel) throw new Error('Aba DELIVERY não encontrada.');

    // 1. Garantir ou atualizar cadastro do cliente
    try {
      if (typeof salvarClienteRapidoDelivery === 'function') {
        salvarClienteRapidoDelivery(cliente, payload.telefone, payload.endereco, payload.referencia, payload.obs);
      } else {
        garantirClienteCadastrado(cliente, payload.telefone, payload.endereco, payload.referencia, payload.obs);
      }
    } catch (eCli) {}

    // 2. Gerar número de pedido
    let pedido = 1;
    if (typeof gerarNumeroDelivery === 'function') {
      pedido = gerarNumeroDelivery();
    } else {
      pedido = Math.floor(Date.now() / 1000) % 100000;
    }

    let subtotalItens = 0;
    payload.itens.forEach(i => {
      subtotalItens += (Number(i.qtd) || 0) * (Number(i.unit) || 0);
    });

    const taxa = Number(payload.taxaEntrega) || 0;
    const totalGeral = subtotalItens + taxa;
    const agora = new Date();
    const formaPgto = String(payload.formaPgto || 'Dinheiro').trim();
    const entregador = String(payload.entregador || '').trim();
    const endereco = String(payload.endereco || '').trim();
    const idPedido = typeof gerarIdVendaDelivery === 'function' ? gerarIdVendaDelivery(pedido) : ('DEL-' + String(pedido).padStart(6, '0'));

    // 3. Registrar na aba DELIVERY
    shDel.appendRow([
      pedido,
      agora,
      cliente,
      'VER ITENS',
      payload.itens.length,
      totalGeral,
      formaPgto,
      'PEDIDO FEITO',
      entregador,
      endereco,
      idPedido
    ]);

    // 4. Registrar na aba DELIVERY_ITENS
    let shItens = ss.getSheetByName('DELIVERY_ITENS');
    if (!shItens) {
      shItens = ss.insertSheet('DELIVERY_ITENS');
      shItens.appendRow(['Pedido', 'Produto', 'Qtd', 'Unitário', 'Total', 'Baixado']);
    }

    payload.itens.forEach(i => {
      const q = Number(i.qtd) || 0;
      const u = Number(i.unit) || 0;
      shItens.appendRow([
        pedido,
        i.produto,
        q,
        u,
        q * u,
        'NAO'
      ]);
    });

    return {
      sucesso: true,
      msg: 'Pedido Delivery #' + pedido + ' criado com sucesso!',
      pedido: pedido,
      idPedido: idPedido,
      total: totalGeral
    };

  } catch (err) {
    console.error('Erro em executarVendaDelivery360:', err);
    return {
      sucesso: false,
      erro: err.message
    };
  }
}

/**
 * Atualiza o status de um pedido de Delivery diretamente do painel 360°.
 */
function atualizarStatusDelivery360(pedido, novoStatus, entregador) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const shDel = ss.getSheetByName('DELIVERY');
    if (!shDel) throw new Error('Aba DELIVERY não encontrada.');

    const dados = shDel.getDataRange().getValues();
    let rowIndex = -1;
    let pedidoRow = null;

    for (let i = 1; i < dados.length; i++) {
      if (String(dados[i][0]) === String(pedido)) {
        rowIndex = i + 1;
        pedidoRow = dados[i];
        break;
      }
    }

    if (rowIndex === -1) {
      throw new Error('Pedido #' + pedido + ' não encontrado.');
    }

    const statusAtual = String(pedidoRow[7] || '').toUpperCase().trim();
    novoStatus = String(novoStatus || '').toUpperCase().trim();

    if (entregador) {
      shDel.getRange(rowIndex, 9).setValue(entregador);
    }

    if (novoStatus === 'SAIU P/ ENTREGA' || novoStatus === 'A CAMINHO') {
      try {
        if (typeof baixarEstoqueDelivery === 'function') {
          baixarEstoqueDelivery(pedido);
        }
      } catch (eEst) {
        console.warn('Aviso estoque delivery:', eEst.message);
      }
    }

    if (novoStatus === 'ENTREGUE' || novoStatus === 'FINALIZADO') {
      try {
        if (typeof finalizarDelivery === 'function') {
          finalizarDelivery(pedido);
        } else {
          const valor = Number(pedidoRow[5]) || 0;
          const pgto = String(pedidoRow[6] || 'Dinheiro');
          if (typeof registrarCaixa === 'function') {
            registrarCaixa(new Date(), 'Entrada', valor, pgto, 'Delivery', 'Delivery #' + pedido + ' Concluído');
          }
        }
      } catch (eFin) {
        console.warn('Aviso finalização delivery:', eFin.message);
      }
    }

    shDel.getRange(rowIndex, 8).setValue(novoStatus);

    return {
      sucesso: true,
      msg: 'Pedido #' + pedido + ' alterado para ' + novoStatus
    };

  } catch (err) {
    console.error('Erro em atualizarStatusDelivery360:', err);
    return {
      sucesso: false,
      erro: err.message
    };
  }
}

/**
 * Auxiliar: baixa estoque direto na aba ESTOQUE caso a função nativa falhe.
 */
function baixarEstoqueManual(produto, quantidade) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('ESTOQUE');
  if (!sh) return;
  const d = sh.getDataRange().getValues();
  for (let i = 1; i < d.length; i++) {
    if (String(d[i][0]).toUpperCase().trim() === String(produto).toUpperCase().trim()) {
      const atual = Number(d[i][1]) || 0;
      const novo = Math.max(0, atual - Number(quantidade));
      sh.getRange(i + 1, 2).setValue(novo);
      return;
    }
  }
}

/**
 * Cadastra um novo cliente diretamente pelo Painel 360° (PDV Balcão ou Delivery).
 * Inicializa a conta fiado se necessário e sincroniza com a aba CLIENTES.
 */
function cadastrarCliente360(dados) {
  try {
    if (!dados || !dados.nome) {
      throw new Error('O nome do cliente é obrigatório.');
    }

    const nome = String(dados.nome).trim().toUpperCase();
    const tel = String(dados.telefone || '').trim();
    const end = String(dados.endereco || '').trim();
    const ref = String(dados.referencia || '').trim();
    const obs = String(dados.obs || '').trim();

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName('CLIENTES');
    if (!sh) {
      sh = ss.insertSheet('CLIENTES');
      sh.appendRow(['NOME', 'TELEFONE', 'ENDEREÇO', 'REFERÊNCIA', 'OBS']);
    }

    // Verificar se já existe
    const d = sh.getDataRange().getValues();
    let jaCadastrado = false;
    for (let i = 1; i < d.length; i++) {
      if (String(d[i][0] || '').trim().toUpperCase() === nome) {
        jaCadastrado = true;
        // Atualiza telefones ou endereço se fornecidos
        if (tel) sh.getRange(i + 1, 2).setValue(tel);
        if (end) sh.getRange(i + 1, 3).setValue(end);
        if (ref) sh.getRange(i + 1, 4).setValue(ref);
        if (obs) sh.getRange(i + 1, 5).setValue(obs);
        break;
      }
    }

    if (!jaCadastrado) {
      sh.appendRow([nome, tel, end, ref, obs]);
    }

    // Garante que o cliente tenha conta fiado inicializada em CONTAS_A_RECEBER
    try {
      if (typeof salvarCliente === 'function') {
        // Se a função oficial existir, chama para garantir consistência
      }
      if (typeof garantirContasAReceber === 'function') {
        garantirContasAReceber();
      }
      const cr = ss.getSheetByName('CONTAS_A_RECEBER');
      if (cr) {
        const dadosCr = cr.getDataRange().getValues();
        const existeFiado = dadosCr.some((l, i) => i > 0 && l[1] === 'CLIENTE' && String(l[3] || '').toUpperCase().trim() === nome);
        if (!existeFiado && typeof criarContaAReceber === 'function') {
          criarContaAReceber('CLIENTE', 'FIADO_FIXO', nome, 0, 'FIADO');
        }
      }
    } catch (eCr) {
      console.warn('Aviso fiado novo cliente:', eCr.message);
    }

    return {
      sucesso: true,
      msg: 'Cliente ' + nome + ' cadastrado com sucesso!',
      cliente: {
        nome: nome,
        telefone: tel,
        endereco: end,
        referencia: ref,
        obs: obs
      }
    };
  } catch (err) {
    console.error('Erro em cadastrarCliente360:', err);
    return { sucesso: false, erro: err.message };
  }
}

/**
 * Garante o cadastro básico do cliente caso seja novo.
 */
function garantirClienteCadastrado(nome, tel, end, ref, obs) {
  if (!nome || String(nome).trim().toUpperCase() === 'CONSUMIDOR FINAL' || String(nome).trim().toUpperCase() === 'CONSUMIDOR') return;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('CLIENTES');
  if (!sh) {
    sh = ss.insertSheet('CLIENTES');
    sh.appendRow(['NOME', 'TELEFONE', 'ENDEREÇO', 'REFERÊNCIA', 'OBS']);
  }
  const d = sh.getDataRange().getValues();
  const normNome = String(nome).toUpperCase().trim();
  for (let i = 1; i < d.length; i++) {
    if (String(d[i][0]).toUpperCase().trim() === normNome) {
      return;
    }
  }
  sh.appendRow([normNome, tel || '', end || '', ref || '', obs || '']);
}

/**
 * Abre o Painel Executivo & PDV 360° como Modal dentro da Planilha.
 */
function abrirPainelDeposito360Modal() {
  const template = HtmlService.createTemplateFromFile('PainelDeposito360');
  const html = template.evaluate()
    .setWidth(1280)
    .setHeight(780);
  SpreadsheetApp.getUi().showModalDialog(html, '👑 Painel Executivo & PDV 360°');
}

/**
 * Redireciona e abre o Painel Web em uma nova aba do navegador.
 */
function menuAbrirPainelDeposito360Web() {
  const url = obterUrlWebAppDeposito();
  const html = HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html><head><base target="_blank">' +
    '<style>' +
    'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #090d16; color: #f8fafc; text-align: center; }' +
    '.card { background: #0f172a; padding: 30px; border-radius: 16px; border: 1px solid #334155; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }' +
    '.btn { display: inline-flex; align-items: center; gap: 8px; padding: 14px 28px; background: linear-gradient(135deg, #8b5cf6, #6366f1); color: white; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 15px rgba(139,92,246,0.3); transition: all 0.2s; }' +
    'p { margin-bottom: 20px; font-size: 14px; color: #94a3b8; }' +
    '</style></head><body><div class="card">' +
    '<h2 style="margin-bottom:8px">👑 Painel Executivo & PDV 360°</h2>' +
    '<p>Redirecionando para o ambiente web independente...</p>' +
    '<a href="' + url + '" target="_blank" class="btn">🚀 Abrir Painel em Tela Cheia</a>' +
    '</div><script>' +
    'window.open("' + url + '", "_blank");' +
    'setTimeout(function(){ google.script.host.close(); }, 2500);' +
    '</script></body></html>'
  ).setWidth(420).setHeight(230);
  SpreadsheetApp.getUi().showModalDialog(html, '👑 Abrindo Painel Web...');
}

/**
 * Retorna a URL pública oficial do WebApp deste script.
 */
function obterUrlWebAppDeposito() {
  let url = '';
  try {
    url = ScriptApp.getService().getUrl() || '';
  } catch (e) {}

  if (!url) {
    url = 'https://script.google.com/macros/s/AKfycbzsVlZgA_M9Xqf_VCmA57XHH3iEa_YHOo0-qfSNvl3F5Xrtiuf-9QJ_sm97atoPureH/exec';
  }
  return url;
}

// Helpers de formatação
function formatarDataSimples(d) {
  if (!d || isNaN(d.getTime())) return '';
  return Utilities.formatDate(d, 'America/Bahia', 'yyyy-MM-dd');
}

function formatarHoraMinuto(d) {
  if (!d || isNaN(d.getTime())) return '';
  return Utilities.formatDate(d, 'America/Bahia', 'HH:mm');
}

function normalizarFormaPgto(forma) {
  const f = String(forma || '').toUpperCase();
  if (f.includes('PIX')) return 'PIX';
  if (f.includes('DINHEIRO')) return 'Dinheiro';
  if (f.includes('DÉBITO') || f.includes('DEBITO')) return 'Cartão Débito';
  if (f.includes('CRÉDITO') || f.includes('CREDITO')) return 'Cartão Crédito';
  if (f.includes('FIADO')) return 'Fiado';
  return 'Outros';
}

// ============================================================================
// 🔐 MÓDULO DE AUTENTICAÇÃO WEB, SESSÕES & GESTÃO DE EQUIPE (PAINEL 360°)
// ============================================================================

/**
 * Gera um token de sessão seguro para o navegador
 */
function gerarTokenSessaoWeb(idUser) {
  const rand = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  const stamp = Date.now().toString(36);
  return 'WSE_' + String(idUser).replace(/[^A-Za-z0-9]/g, '') + '_' + stamp + '_' + rand;
}

/**
 * Autentica o usuário pelo Painel Web 360°
 */
function autenticarWebPainel(loginOuEmail, senha, lembrar) {
  try {
    if (!loginOuEmail || !senha) {
      return { ok: false, msg: 'Informe o usuário/e-mail e a senha.' };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (typeof garantirEstruturausuarios === 'function') {
      garantirEstruturausuarios();
    }

    let shUsuarios = ss.getSheetByName('USUARIOS');
    if (!shUsuarios) {
      return { ok: false, msg: 'Aba de usuários não encontrada.' };
    }

    const dados = shUsuarios.getDataRange().getValues();
    const loginNorm = String(loginOuEmail).trim().toLowerCase();
    const senhaDigitada = String(senha).trim();
    let usuarioEncontrado = null;

    for (let i = 1; i < dados.length; i++) {
      const idUser = String(dados[i][0] || '').trim();
      const nome = String(dados[i][1] || '').trim().toLowerCase();
      const email = String(dados[i][2] || '').trim().toLowerCase();
      const senhaSalva = String(dados[i][3] || '').trim();
      const perfil = String(dados[i][4] || 'VENDEDOR').toUpperCase().trim();
      const ativo = String(dados[i][5] || 'NAO').toUpperCase().trim();

      if (nome === loginNorm || email === loginNorm || idUser.toLowerCase() === loginNorm) {
        usuarioEncontrado = {
          id: dados[i][0],
          nome: dados[i][1],
          email: dados[i][2],
          senhaSalva: senhaSalva,
          perfil: perfil,
          ativo: ativo,
          linha: i + 1
        };
        break;
      }
    }

    // 🔹 Fallback Master Admin (se digitou 'admin' e senha 'admin123')
    if (loginNorm === 'admin' && (senhaDigitada === 'admin123' || senhaDigitada === 'admin')) {
      const senhaHashDefault = typeof gerarHashSenha === 'function' ? gerarHashSenha('admin123') : 'admin123';
      if (usuarioEncontrado) {
        shUsuarios.getRange(usuarioEncontrado.linha, 4).setValue(senhaHashDefault);
        shUsuarios.getRange(usuarioEncontrado.linha, 5).setValue('DONO');
        shUsuarios.getRange(usuarioEncontrado.linha, 6).setValue('SIM');
        usuarioEncontrado.ativo = 'SIM';
        usuarioEncontrado.perfil = 'DONO';
        usuarioEncontrado.senhaSalva = senhaHashDefault;
      } else {
        const agora = new Date();
        shUsuarios.appendRow([
          'U-000001',
          'admin',
          'admin@deposito.com',
          senhaHashDefault,
          'DONO',
          'SIM',
          agora,
          agora,
          ''
        ]);
        usuarioEncontrado = {
          id: 'U-000001',
          nome: 'admin',
          email: 'admin@deposito.com',
          senhaSalva: senhaHashDefault,
          perfil: 'DONO',
          ativo: 'SIM',
          linha: shUsuarios.getLastRow()
        };
      }
    }

    if (!usuarioEncontrado) {
      if (typeof registrarAuditoria === 'function') {
        try { registrarAuditoria('ANONIMO', 'WEB_LOGIN_FALHA', `Usuário não encontrado: ${loginOuEmail}`); } catch(e) {}
      }
      return { ok: false, msg: 'Usuário ou senha incorretos.' };
    }

    if (usuarioEncontrado.ativo !== 'SIM') {
      if (typeof registrarAuditoria === 'function') {
        try { registrarAuditoria(usuarioEncontrado.id, 'WEB_LOGIN_BLOQUEADO', 'Tentativa de login de usuário inativo'); } catch(e) {}
      }
      return { ok: false, msg: 'Este usuário está inativo ou bloqueado.' };
    }

    const senhaConfere = typeof verificarSenha === 'function' 
      ? verificarSenha(senhaDigitada, usuarioEncontrado.senhaSalva)
      : (senhaDigitada === usuarioEncontrado.senhaSalva);

    if (!senhaConfere) {
      if (typeof registrarAuditoria === 'function') {
        try { registrarAuditoria(usuarioEncontrado.id, 'WEB_LOGIN_SENHA_ERRADA', 'Senha incorreta'); } catch(e) {}
      }
      return { ok: false, msg: 'Usuário ou senha incorretos.' };
    }

    // ✅ Login Válido
    const agora = new Date();
    try {
      shUsuarios.getRange(usuarioEncontrado.linha, 8).setValue(agora);
    } catch(e) {}

    // Gera token de sessão
    const token = gerarTokenSessaoWeb(usuarioEncontrado.id);
    const ttlSegundos = lembrar ? (30 * 24 * 3600) : (12 * 3600); // 30 dias ou 12h

    // Grava na aba SESSOES
    let shSessoes = ss.getSheetByName('SESSOES');
    if (shSessoes) {
      try {
        shSessoes.appendRow([
          token,
          usuarioEncontrado.id,
          agora,
          '',
          'SIM'
        ]);
      } catch(eSess) {
        console.warn('Erro ao salvar em SESSOES:', eSess);
      }
    }

    // Grava no CacheService para respostas instantâneas
    const userPayload = {
      id: usuarioEncontrado.id,
      nome: usuarioEncontrado.nome,
      email: usuarioEncontrado.email,
      perfil: usuarioEncontrado.perfil
    };

    try {
      const cache = CacheService.getScriptCache();
      cache.put('wtoken_' + token, JSON.stringify(userPayload), Math.min(ttlSegundos, 21600)); // máx cache 6h
    } catch(eCache) {}

    if (typeof registrarAuditoria === 'function') {
      try { registrarAuditoria(usuarioEncontrado.id, 'WEB_LOGIN_SUCESSO', 'Login no Painel 360'); } catch(e) {}
    }

    return {
      ok: true,
      usuario: userPayload,
      token: token
    };

  } catch(err) {
    console.error('Erro em autenticarWebPainel:', err);
    return { ok: false, msg: 'Erro ao autenticar: ' + err.message };
  }
}

/**
 * Valida se um token de sessão salvo no navegador ainda é válido
 */
function validarSessaoAtiva(token) {
  try {
    if (!token || String(token).trim() === '') {
      return { ok: false, msg: 'Nenhum token fornecido' };
    }

    // 1. Tenta CacheService
    const cache = CacheService.getScriptCache();
    const cached = cache.get('wtoken_' + token);
    if (cached) {
      try {
        const u = JSON.parse(cached);
        return { ok: true, usuario: u };
      } catch(e) {}
    }

    // 2. Se não está no cache, verifica na planilha SESSOES e USUARIOS
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const shSessoes = ss.getSheetByName('SESSOES');
    const shUsuarios = ss.getSheetByName('USUARIOS');

    if (!shSessoes || !shUsuarios) {
      return { ok: false, msg: 'Estrutura ausente' };
    }

    const sessoes = shSessoes.getDataRange().getValues();
    let idUserEncontrado = null;

    for (let i = sessoes.length - 1; i >= 1; i--) {
      if (String(sessoes[i][0]) === String(token)) {
        const ativo = String(sessoes[i][4] || '').toUpperCase().trim();
        if (ativo === 'SIM') {
          idUserEncontrado = String(sessoes[i][1] || '').trim();
        }
        break;
      }
    }

    if (!idUserEncontrado) {
      return { ok: false, msg: 'Sessão expirada ou encerrada' };
    }

    // Verifica se o usuário continua ATIVO na aba USUARIOS
    const usuarios = shUsuarios.getDataRange().getValues();
    let userObj = null;

    for (let i = 1; i < usuarios.length; i++) {
      if (String(usuarios[i][0]).trim() === idUserEncontrado) {
        const statusUser = String(usuarios[i][5] || '').toUpperCase().trim();
        if (statusUser === 'SIM') {
          userObj = {
            id: usuarios[i][0],
            nome: usuarios[i][1],
            email: usuarios[i][2],
            perfil: String(usuarios[i][4] || 'VENDEDOR').toUpperCase().trim()
          };
        }
        break;
      }
    }

    if (!userObj) {
      return { ok: false, msg: 'Usuário inativo ou não encontrado' };
    }

    // Revalida no cache por 6 horas
    try {
      cache.put('wtoken_' + token, JSON.stringify(userObj), 21600);
    } catch(e) {}

    return { ok: true, usuario: userObj };

  } catch(err) {
    console.error('Erro em validarSessaoAtiva:', err);
    return { ok: false, msg: err.message };
  }
}

/**
 * Encerra a sessão atual (Logout)
 */
function encerrarSessaoWeb(token) {
  try {
    if (!token) return { ok: true };

    const cache = CacheService.getScriptCache();
    cache.remove('wtoken_' + token);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const shSessoes = ss.getSheetByName('SESSOES');
    if (shSessoes) {
      const dados = shSessoes.getDataRange().getValues();
      for (let i = dados.length - 1; i >= 1; i--) {
        if (String(dados[i][0]) === String(token)) {
          shSessoes.getRange(i + 1, 4).setValue(new Date());
          shSessoes.getRange(i + 1, 5).setValue('NAO');
          break;
        }
      }
    }
    return { ok: true };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}

/**
 * Helper para verificar permissão pelo token
 */
function obterUsuarioPorToken(token) {
  const res = validarSessaoAtiva(token);
  return (res && res.ok) ? res.usuario : null;
}

/**
 * Lista todos os usuários cadastrados para gestão no Painel
 */
function listarUsuariosPainel(token) {
  try {
    const caller = obterUsuarioPorToken(token);
    if (!caller || (caller.perfil !== 'DONO' && caller.perfil !== 'GERENTE')) {
      return { ok: false, msg: 'Acesso restrito a Donos e Gerentes.' };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName('USUARIOS');
    if (!sh) return { ok: false, msg: 'Aba USUARIOS não encontrada.' };

    const dados = sh.getDataRange().getValues();
    const lista = [];

    for (let i = 1; i < dados.length; i++) {
      const id = String(dados[i][0] || '').trim();
      const nome = String(dados[i][1] || '').trim();
      const email = String(dados[i][2] || '').trim();
      const perfil = String(dados[i][4] || 'VENDEDOR').toUpperCase().trim();
      const ativo = String(dados[i][5] || 'NAO').toUpperCase().trim();
      const dCriacao = dados[i][6] ? formatarDataSimples(new Date(dados[i][6])) : '--';
      const uAcesso = dados[i][7] ? formatarDataSimples(new Date(dados[i][7])) : '--';

      if (id && nome) {
        lista.push({
          id: id,
          nome: nome,
          email: email,
          perfil: perfil,
          ativo: ativo,
          dataCriacao: dCriacao,
          ultimoAcesso: uAcesso
        });
      }
    }

    return { ok: true, usuarios: lista, perfilSolicitante: caller.perfil };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}

/**
 * Cadastra um novo usuário a partir do Painel
 */
function salvarNovoUsuarioPainel(token, dadosUser) {
  try {
    const caller = obterUsuarioPorToken(token);
    if (!caller || (caller.perfil !== 'DONO' && caller.perfil !== 'GERENTE')) {
      return { ok: false, msg: 'Acesso restrito.' };
    }

    if (!dadosUser || !dadosUser.nome || !dadosUser.senha) {
      return { ok: false, msg: 'Nome e senha são obrigatórios.' };
    }

    const nome = String(dadosUser.nome).trim();
    const email = String(dadosUser.email || '').trim();
    let perfil = String(dadosUser.perfil || 'VENDEDOR').toUpperCase().trim();
    const senha = String(dadosUser.senha).trim();

    // Gerente só pode criar Vendedor
    if (caller.perfil === 'GERENTE' && perfil !== 'VENDEDOR') {
      perfil = 'VENDEDOR';
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName('USUARIOS');
    if (!sh) return { ok: false, msg: 'Aba USUARIOS não encontrada.' };

    const dados = sh.getDataRange().getValues();
    let maxId = 0;

    for (let i = 1; i < dados.length; i++) {
      const nEx = String(dados[i][1] || '').trim().toLowerCase();
      const eEx = String(dados[i][2] || '').trim().toLowerCase();
      if (nEx === nome.toLowerCase()) {
        return { ok: false, msg: `O usuário "${nome}" já existe.` };
      }
      if (email && eEx === email.toLowerCase()) {
        return { ok: false, msg: `O e-mail "${email}" já está cadastrado.` };
      }

      const numId = Number(String(dados[i][0]).replace(/\D/g, ''));
      if (numId > maxId) maxId = numId;
    }

    const novoId = 'U-' + String(maxId + 1).padStart(6, '0');
    const hashSenha = typeof gerarHashSenha === 'function' ? gerarHashSenha(senha) : senha;
    const agora = new Date();

    sh.appendRow([
      novoId,
      nome,
      email,
      hashSenha,
      perfil,
      'SIM',
      agora,
      '',
      ''
    ]);

    if (typeof registrarAuditoria === 'function') {
      try { registrarAuditoria(caller.id, 'WEB_CRIAR_USUARIO', `Criou usuário ${novoId} (${nome}) como ${perfil}`); } catch(e) {}
    }

    return { ok: true, msg: `Usuário "${nome}" cadastrado com sucesso!`, id: novoId };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}

/**
 * Altera status de um usuário (Ativar / Desativar)
 */
function alterarStatusUsuarioPainel(token, idUser, novoStatus) {
  try {
    const caller = obterUsuarioPorToken(token);
    if (!caller || (caller.perfil !== 'DONO' && caller.perfil !== 'GERENTE')) {
      return { ok: false, msg: 'Acesso restrito.' };
    }

    if (caller.id === idUser && novoStatus !== 'SIM') {
      return { ok: false, msg: 'Você não pode desativar seu próprio usuário!' };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName('USUARIOS');
    const dados = sh.getDataRange().getValues();

    for (let i = 1; i < dados.length; i++) {
      if (String(dados[i][0]).trim() === String(idUser).trim()) {
        const perfilAlvo = String(dados[i][4] || '').toUpperCase().trim();
        if (caller.perfil === 'GERENTE' && (perfilAlvo === 'DONO' || perfilAlvo === 'GERENTE')) {
          return { ok: false, msg: 'Gerentes só podem gerenciar Vendedores.' };
        }

        sh.getRange(i + 1, 6).setValue(novoStatus === 'SIM' ? 'SIM' : 'NAO');

        if (typeof registrarAuditoria === 'function') {
          try { registrarAuditoria(caller.id, 'WEB_STATUS_USUARIO', `${novoStatus === 'SIM' ? 'Ativou' : 'Desativou'} ${idUser}`); } catch(e) {}
        }
        return { ok: true };
      }
    }

    return { ok: false, msg: 'Usuário não encontrado.' };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}

/**
 * Redefine a senha de um colaborador pelo Painel
 */
function redefinirSenhaUsuarioPainel(token, idUser, novaSenha) {
  try {
    const caller = obterUsuarioPorToken(token);
    if (!caller || (caller.perfil !== 'DONO' && caller.perfil !== 'GERENTE')) {
      return { ok: false, msg: 'Acesso restrito.' };
    }

    if (!novaSenha || String(novaSenha).trim().length < 3) {
      return { ok: false, msg: 'A senha deve conter no mínimo 3 caracteres.' };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName('USUARIOS');
    const dados = sh.getDataRange().getValues();

    for (let i = 1; i < dados.length; i++) {
      if (String(dados[i][0]).trim() === String(idUser).trim()) {
        const perfilAlvo = String(dados[i][4] || '').toUpperCase().trim();
        if (caller.perfil === 'GERENTE' && (perfilAlvo === 'DONO' || perfilAlvo === 'GERENTE')) {
          return { ok: false, msg: 'Gerentes só podem alterar senhas de Vendedores.' };
        }

        const hash = typeof gerarHashSenha === 'function' ? gerarHashSenha(String(novaSenha).trim()) : String(novaSenha).trim();
        sh.getRange(i + 1, 4).setValue(hash);

        if (typeof registrarAuditoria === 'function') {
          try { registrarAuditoria(caller.id, 'WEB_REDEFINIR_SENHA', `Redefiniu senha de ${idUser}`); } catch(e) {}
        }
        return { ok: true, msg: 'Senha alterada com sucesso!' };
      }
    }

    return { ok: false, msg: 'Usuário não encontrado.' };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}

/**
 * Edita dados de um colaborador existente (Nome, Email, Perfil, Status e opcionalmente Senha)
 * Dono pode editar qualquer usuário. Gerente só pode editar Vendedores.
 */
function editarColaboradorPainel(token, dadosUser) {
  try {
    const caller = obterUsuarioPorToken(token);
    if (!caller || (caller.perfil !== 'DONO' && caller.perfil !== 'GERENTE')) {
      return { ok: false, msg: 'Acesso restrito a Gerentes e Donos.' };
    }

    if (!dadosUser || !dadosUser.id) {
      return { ok: false, msg: 'ID do usuário não fornecido.' };
    }

    const idAlvo = String(dadosUser.id).trim();
    const novoNome = String(dadosUser.nome || '').trim();
    const novoEmail = String(dadosUser.email || '').trim().toLowerCase();
    let novoPerfil = String(dadosUser.perfil || '').toUpperCase().trim();
    const novoAtivo = (dadosUser.ativo === 'SIM' || dadosUser.ativo === true) ? 'SIM' : 'NAO';
    const novaSenha = dadosUser.senha ? String(dadosUser.senha).trim() : '';

    if (!novoNome) {
      return { ok: false, msg: 'O nome do usuário é obrigatório.' };
    }

    // Se o usuário está editando a si mesmo:
    if (caller.id === idAlvo) {
      if (caller.perfil === 'DONO' && novoPerfil !== 'DONO') {
        return { ok: false, msg: 'O Dono principal não pode rebaixar seu próprio perfil.' };
      }
      if (novoAtivo !== 'SIM') {
        return { ok: false, msg: 'Você não pode desativar seu próprio acesso.' };
      }
    }

    // Gerente só pode editar Vendedores e não pode promover para GERENTE ou DONO
    if (caller.perfil === 'GERENTE') {
      if (novoPerfil !== 'VENDEDOR') {
        return { ok: false, msg: 'Gerente não tem permissão para alterar perfil para Gerente ou Dono.' };
      }
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName('USUARIOS');
    if (!sh) return { ok: false, msg: 'Aba USUARIOS não encontrada.' };

    const dados = sh.getDataRange().getValues();
    let linhaAlvo = -1;

    for (let i = 1; i < dados.length; i++) {
      const uid = String(dados[i][0]).trim();
      const nEx = String(dados[i][1] || '').trim().toLowerCase();
      const eEx = String(dados[i][2] || '').trim().toLowerCase();

      if (uid === idAlvo) {
        linhaAlvo = i + 1;
        const perfilAtualAlvo = String(dados[i][4] || '').toUpperCase().trim();
        if (caller.perfil === 'GERENTE' && (perfilAtualAlvo === 'DONO' || perfilAtualAlvo === 'GERENTE')) {
          return { ok: false, msg: 'Gerente só tem permissão para editar colaboradores Vendedores.' };
        }
      } else {
        // Validação de duplicidade em outros usuários
        if (nEx === novoNome.toLowerCase()) {
          return { ok: false, msg: `Já existe outro colaborador com o nome "${novoNome}".` };
        }
        if (novoEmail && eEx === novoEmail) {
          return { ok: false, msg: `O e-mail "${novoEmail}" já pertence a outro usuário.` };
        }
      }
    }

    if (linhaAlvo === -1) {
      return { ok: false, msg: 'Colaborador não encontrado na base de dados.' };
    }

    // Atualiza Nome, Email, Perfil, Ativo
    sh.getRange(linhaAlvo, 2).setValue(novoNome);
    sh.getRange(linhaAlvo, 3).setValue(novoEmail);
    if (novoPerfil) {
      sh.getRange(linhaAlvo, 5).setValue(novoPerfil);
    }
    sh.getRange(linhaAlvo, 6).setValue(novoAtivo);

    // Atualiza Senha se fornecida
    if (novaSenha && novaSenha.length >= 3) {
      const hash = typeof gerarHashSenha === 'function' ? gerarHashSenha(novaSenha) : novaSenha;
      sh.getRange(linhaAlvo, 4).setValue(hash);
    }

    if (typeof registrarAuditoria === 'function') {
      try {
        registrarAuditoria(caller.id, 'WEB_EDITAR_USUARIO', `Editou dados do usuário ${idAlvo} (${novoNome}) perfil: ${novoPerfil}, ativo: ${novoAtivo}`);
      } catch(e) {}
    }

    return {
      ok: true,
      msg: `Colaborador "${novoNome}" atualizado com sucesso!`
    };
  } catch(e) {
    console.error('Erro em editarColaboradorPainel:', e);
    return { ok: false, msg: e.message };
  }
}

/**
 * Executa funções operacionais, financeiras e gerenciais do Painel Inteligente via Web.
 * Trata context-sensitivities como SpreadsheetApp.getUi() para execução 100% web-safe.
 */
function executarFuncaoPainelInteligente(token, nomeFuncao) {
  try {
    const caller = obterUsuarioPorToken(token);
    if (!caller) {
      return { ok: false, msg: 'Sessão expirada. Faça login novamente.' };
    }

    const func = String(nomeFuncao || '').trim();

    // Verificação de permissões de DONO para funções críticas
    const funcoesExclusivasDono = [
      'fazerBackupSistema',
      'padronizarTodasAbasSistema',
      'initSistema',
      'recarregarMenu'
    ];

    if (funcoesExclusivasDono.includes(func) && caller.perfil !== 'DONO') {
      return { ok: false, msg: 'Ação restrita exclusivamente ao Dono do estabelecimento.' };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    switch (func) {
      case 'fecharCaixaDia': {
        if (typeof fecharCaixaDia === 'function') {
          const res = fecharCaixaDia(true);
          if (typeof registrarAuditoria === 'function') {
            try { registrarAuditoria(caller.id, 'CONFERENCIA_CAIXA', `Saldo conferido: R$ ${(res.saldo || 0).toFixed(2)}`); } catch(e) {}
          }
          return res;
        }
        return { ok: false, msg: 'Função de conferência de caixa não encontrada.' };
      }

      case 'fecharFiscalDia': {
        if (typeof fecharFiscalDia === 'function') {
          const res = fecharFiscalDia(true);
          if (typeof registrarAuditoria === 'function') {
            try { registrarAuditoria(caller.id, 'FECHAMENTO_FISCAL', `Fechamento fiscal registrado. Saldo: R$ ${(res.saldo || 0).toFixed(2)}`); } catch(e) {}
          }
          return res;
        }
        return { ok: false, msg: 'Função de fechamento fiscal não encontrada.' };
      }

      case 'fazerBackupSistema': {
        if (typeof fazerBackupSistema === 'function') {
          fazerBackupSistema();
          return { ok: true, msg: 'Backup completo do sistema realizado com sucesso no Google Drive!' };
        }
        return { ok: false, msg: 'Função de backup não configurada no script.' };
      }

      case 'padronizarTodasAbasSistema': {
        const abas = ss.getSheets();
        abas.forEach(sh => {
          try {
            if (typeof aplicarFormatacaoPadrao === 'function') aplicarFormatacaoPadrao(sh);
          } catch(e) {}
        });
        return { ok: true, msg: `Padronização visual e técnica concluída em todas as ${abas.length} abas!` };
      }

      case 'gerarRelatorioValoresEstoque': {
        if (typeof gerarRelatorioValoresEstoque === 'function') {
          gerarRelatorioValoresEstoque();
          return { ok: true, msg: 'Relatório de Valores do Estoque gerado com sucesso na aba correspondente!' };
        }
        return { ok: false, msg: 'Relatório não disponível.' };
      }

      case 'gerarRelatorioFinanceiroCompleto': {
        if (typeof gerarRelatorioFinanceiroCompletoSilencioso === 'function') {
          gerarRelatorioFinanceiroCompletoSilencioso();
          return { ok: true, msg: 'Relatório Financeiro Completo gerado com sucesso!' };
        } else if (typeof gerarRelatorioFinanceiroCompleto === 'function') {
          gerarRelatorioFinanceiroCompleto();
          return { ok: true, msg: 'Relatório Financeiro gerado com sucesso!' };
        }
        return { ok: false, msg: 'Função de relatório financeiro não encontrada.' };
      }

      case 'gerarRelatorioCompras': {
        if (typeof gerarRelatorioComprasSilencioso === 'function') {
          gerarRelatorioComprasSilencioso();
          return { ok: true, msg: 'Relatório de Compras gerado com sucesso!' };
        } else if (typeof gerarRelatorioCompras === 'function') {
          gerarRelatorioCompras();
          return { ok: true, msg: 'Relatório de Compras gerado com sucesso!' };
        }
        return { ok: false, msg: 'Função de relatório de compras não encontrada.' };
      }

      case 'gerarRelatorioLogsSistema': {
        if (typeof gerarRelatorioLogsSistema === 'function') {
          gerarRelatorioLogsSistema();
          return { ok: true, msg: 'Relatório de Logs e Auditoria gerado com sucesso!' };
        }
        return { ok: false, msg: 'Função de relatório de logs não encontrada.' };
      }

      case 'gerarPacoteRelatoriosGerenciais': {
        if (typeof gerarPacoteRelatoriosGerenciais === 'function') {
          gerarPacoteRelatoriosGerenciais();
          return { ok: true, msg: 'Pacote completo de relatórios gerenciais gerado com sucesso!' };
        }
        return { ok: false, msg: 'Função de pacote gerencial não encontrada.' };
      }

      case 'atualizarEstoque': {
        if (typeof atualizarEstoque === 'function') {
          atualizarEstoque();
        }
        return { ok: true, msg: 'Estoque e fórmulas sincronizados com sucesso!' };
      }

      case 'recalcularValoresEstoque': {
        if (typeof recalcularValoresEstoque === 'function') {
          recalcularValoresEstoque();
        }
        return { ok: true, msg: 'Valores e totais de estoque recalculados!' };
      }

      case 'obterLinkDrive': {
        try {
          const file = DriveApp.getFileById(ss.getId());
          const parents = file.getParents();
          let folderUrl = '';
          if (parents.hasNext()) {
            folderUrl = parents.next().getUrl();
          } else {
            folderUrl = ss.getUrl();
          }
          return { ok: true, msg: 'Pasta do Drive localizada.', link: folderUrl };
        } catch(e) {
          return { ok: true, msg: 'Link da planilha.', link: ss.getUrl() };
        }
      }

      default:
        return { ok: false, msg: `Função "${func}" não reconhecida ou em desenvolvimento.` };
    }
  } catch (err) {
    console.error('Erro em executarFuncaoPainelInteligente:', err);
    return { ok: false, msg: 'Erro ao executar: ' + err.message };
  }
}

/**
 * Salva e atualiza dados do produto (Preço, Custo, Margem %, Estoque Mínimo, etc.)
 * Exclusivo para perfis DONO e GERENTE. Operadores são estritamente bloqueados.
 */
function salvarDadosProduto360(token, payload) {
  try {
    const caller = obterUsuarioPorToken(token);
    if (!caller) {
      return { ok: false, msg: 'Sessão expirada. Faça login novamente.' };
    }

    const perfil = String(caller.perfil || '').toUpperCase();
    if (perfil !== 'DONO' && perfil !== 'GERENTE') {
      return { ok: false, msg: 'Acesso negado: apenas o Dono e Gerente podem alterar valores e produtos.' };
    }

    if (!payload || (!payload.id && !payload.produto)) {
      return { ok: false, msg: 'Dados do produto incompletos para atualização.' };
    }

    // Normalização numérica
    const preco = Number(String(payload.preco || 0).replace(',', '.')) || 0;
    const custo = Number(String(payload.custo || 0).replace(',', '.')) || 0;
    const margem = Number(String(payload.margem || 0).replace(',', '.')) || 0;
    const minimo = Number(payload.minimo) || 0;

    const dadosEnvio = {
      id: payload.id ? String(payload.id).trim() : null,
      produto: String(payload.produto || '').trim(),
      categoria: String(payload.categoria || 'Geral').trim(),
      marca: String(payload.marca || '').trim(),
      volume: String(payload.volume || '').trim(),
      preco: preco,
      custo: custo,
      margem: margem,
      minimo: minimo
    };

    let res = null;
    if (typeof salvarProdutoNovoSistema === 'function') {
      res = salvarProdutoNovoSistema(dadosEnvio);
    } else {
      // Fallback direto na planilha
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sh = ss.getSheetByName('PRODUTOS');
      if (!sh) throw new Error('Aba PRODUTOS não encontrada.');
      const data = sh.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][10] || '').trim() === String(dadosEnvio.id) || String(data[i][0] || '').trim().toUpperCase() === dadosEnvio.produto.toUpperCase()) {
          const row = i + 1;
          sh.getRange(row, 1).setValue(dadosEnvio.produto);
          sh.getRange(row, 2).setValue(dadosEnvio.categoria);
          sh.getRange(row, 3).setValue(dadosEnvio.marca);
          sh.getRange(row, 4).setValue(dadosEnvio.volume);
          sh.getRange(row, 5).setValue(preco);
          sh.getRange(row, 6).setValue(minimo);
          sh.getRange(row, 7).setValue(custo);
          sh.getRange(row, 8).setFormula(`=IF(G${row}>0; (E${row}-G${row})/G${row}; 0)`);
          sh.getRange(row, 9).setFormula(`=G${row}*(1+H${row})`);
          sh.getRange(row, 10).setFormula(`=IF(E${row}>=I${row}; "✅ OK"; "🚨 BAIXA")`);
          res = { ok: true, id: dadosEnvio.id };
          break;
        }
      }
    }

    // Espelhamento atômico no Supabase
    try {
      if (typeof supabaseUpdate === 'function') {
        const idNum = Number(String(dadosEnvio.id).replace(/\D/g, '')) || dadosEnvio.id;
        supabaseUpdate('produtos', {
          nome: dadosEnvio.produto,
          categoria: dadosEnvio.categoria,
          marca: dadosEnvio.marca,
          volume: dadosEnvio.volume,
          preco: preco,
          custo: custo,
          estoque_minimo: minimo,
          atualizado_em: new Date().toISOString()
        }, { id: idNum });
      }
    } catch (e) {
      console.warn('Erro ao espelhar produto no Supabase:', e);
    }

    // Registro em Auditoria
    if (typeof registrarAuditoria === 'function') {
      try {
        registrarAuditoria(caller.id, 'PRODUTO_ATUALIZADO', `Produto ${dadosEnvio.produto} (ID: ${dadosEnvio.id}) atualizado por ${caller.nome}. Preço: R$ ${preco.toFixed(2)}, Custo: R$ ${custo.toFixed(2)}, Margem: ${margem}%.`);
      } catch (e) {}
    }

    return {
      ok: true,
      msg: `Produto "${dadosEnvio.produto}" e lucratividade atualizados com sucesso!`
    };
  } catch (err) {
    console.error('Erro em salvarDadosProduto360:', err);
    return { ok: false, msg: 'Erro ao salvar produto: ' + err.message };
  }
}

/**
 * Ajusta o saldo físico de estoque com auditoria.
 * Exclusivo para perfis DONO e GERENTE.
 */
function ajustarEstoque360(token, produtoNome, quantidade, motivo) {
  try {
    const caller = obterUsuarioPorToken(token);
    if (!caller) {
      return { ok: false, msg: 'Sessão expirada. Faça login novamente.' };
    }

    const perfil = String(caller.perfil || '').toUpperCase();
    if (perfil !== 'DONO' && perfil !== 'GERENTE') {
      return { ok: false, msg: 'Acesso negado: apenas o Dono e Gerente podem ajustar estoque.' };
    }

    const qtd = Number(quantidade);
    if (isNaN(qtd) || qtd === 0) {
      return { ok: false, msg: 'Informe uma quantidade válida diferente de zero para ajuste.' };
    }

    if (typeof ajustarEstoque === 'function') {
      const res = ajustarEstoque(produtoNome, qtd, motivo || 'AJUSTE_MANUAL_360');
      if (res && res.ok === false) {
        return res;
      }
    } else {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const shEstoque = ss.getSheetByName('ESTOQUE');
      if (!shEstoque) throw new Error('Aba ESTOQUE não encontrada.');
      const data = shEstoque.getDataRange().getValues();
      let encontrado = false;
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0] || '').trim().toUpperCase() === String(produtoNome || '').trim().toUpperCase()) {
          const row = i + 1;
          const atual = Number(data[i][1]) || 0;
          const novo = atual + qtd;
          shEstoque.getRange(row, 2).setValue(novo);
          encontrado = true;
          break;
        }
      }
      if (!encontrado) return { ok: false, msg: `Produto "${produtoNome}" não encontrado no estoque.` };
    }

    // Auditoria
    if (typeof registrarAuditoria === 'function') {
      try {
        registrarAuditoria(caller.id, 'AJUSTE_ESTOQUE', `Ajuste manual em ${produtoNome}: ${qtd > 0 ? '+' : ''}${qtd} un (${motivo || 'Manual'}).`);
      } catch (e) {}
    }

    return {
      ok: true,
      msg: `Estoque de "${produtoNome}" ajustado com sucesso!`
    };
  } catch (err) {
    console.error('Erro em ajustarEstoque360:', err);
    return { ok: false, msg: 'Erro ao ajustar estoque: ' + err.message };
  }
}
