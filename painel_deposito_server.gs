/**
 * ============================================================================
 * 👑 PAINEL EXECUTIVO & PDV 360° - GESTÃO DE DEPÓSITO (BACKEND SERVER)
 * ============================================================================
 * Central de inteligência, agregação de KPIs, catálogo de produtos em cache,
 * comandas balcão em aberto, motor de PDV Balcão/Delivery e configuração geral.
 */

/**
 * 🔔 Notificação segura da UI para evitar ReferenceError caso a interface não esteja disponível
 */
function uiNotificar(msg, tipo, titulo) {
  try {
    const activeSs = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.getActive();
    if (activeSs && typeof activeSs.toast === 'function') {
      activeSs.toast(String(msg || ''), String(titulo || 'Sistema Depósito'), 5);
    }
  } catch(e) {
    console.log('[' + String(tipo || 'INFO').toUpperCase() + '] ' + String(msg || ''));
  }
}

/**
 * 🌟 Inserção Universal no Topo com Padronização Visual Estrita:
 * Linha 1 = Cabeçalho Colorido
 * Linha 2 em diante = Fundo Branco (#ffffff), Texto Preto (#000000), Peso Normal
 */
function inserirLinhaPadronizadaNoTopo(sheetOuNome, dados) {
  if (!dados || !Array.isArray(dados) || dados.length === 0) return;

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = (typeof sheetOuNome === 'string') ? ss.getSheetByName(sheetOuNome) : sheetOuNome;
  if (!sh) return;

  if (sh.getLastRow() < 1) return;

  // Insere nova linha logo abaixo do cabeçalho (na linha 2)
  sh.insertRowBefore(2);

  // Grava os valores na linha 2
  const range = sh.getRange(2, 1, 1, dados.length);
  range.setValues([dados]);

  // Aplica o padrão visual exigido: Fundo BRANCO (#ffffff) e Texto PRETO (#000000)
  range.setBackground('#ffffff')
       .setFontColor('#000000')
       .setFontWeight('normal')
       .setVerticalAlignment('middle');

  try { sh.setRowHeight(2, 24); } catch(e) {}
}

/**
 * Retorna todos os dados consolidados para o Painel Executivo 360°, PDV e Configurações.
 */
function obterDadosPainel360() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const nomeDeposito = typeof getNomeDeposito === 'function' ? getNomeDeposito() : 'Gestão de Depósito';
    const spreadsheetUrl = ss.getUrl();
    const spreadsheetId = ss.getId();

    // 1. Sincronização do Fuso Horário e Padronização Visual Limpa
    sincronizarFusoHorarioPlanilha();
    try { verificarENotificarFechamentoFiscalAtrasado(); } catch(e) {}
    try {
      if (typeof padronizarVisualECoresAbasSistema === 'function') {
        padronizarVisualECoresAbasSistema(ss);
      }
    } catch(ePad) {
      console.warn('Aviso ao padronizar cores das abas:', ePad.message);
    }

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

    // 3.1 Leitura do Último Fechamento Fiscal para Governança e Alertas
    let ultimoFechamentoFiscal = null;
    const shFiscal = obterAbaFechamentoFiscal(ss);
    if (shFiscal && shFiscal.getLastRow() > 1) {
      const valFisc = shFiscal.getRange(shFiscal.getLastRow(), 5).getValue() || shFiscal.getRange(shFiscal.getLastRow(), 1).getValue();
      if (valFisc) {
        const d = valFisc instanceof Date ? valFisc : new Date(valFisc);
        if (!isNaN(d.getTime())) {
          ultimoFechamentoFiscal = d.toISOString();
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

    // 7. COMANDAS BALCÃO EM ABERTO (CARDS COMPLETOS COM ITENS, TOTAL, PAGAMENTOS E SALDO REAL)
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

    // Mapeia amortizações/pagamentos parciais já lançados na aba CAIXA
    const mapaPagosComandas = {};
    const shCaixaCom = ss.getSheetByName('CAIXA');
    if (shCaixaCom && shCaixaCom.getLastRow() > 1) {
      const dCaixa = shCaixaCom.getRange(2, 1, shCaixaCom.getLastRow() - 1, Math.min(shCaixaCom.getLastColumn(), 5)).getValues();
      dCaixa.forEach(r => {
        const tipo = String(r[1] || '').trim().toUpperCase();
        if (tipo === 'ENTRADA') {
          const val = Number(r[2]) || 0;
          const desc = String(r[4] || '').toUpperCase();
          if (desc.includes('COMANDA')) {
            const matches = desc.match(/#?(\d+)/g);
            if (matches) {
              matches.forEach(m => {
                const num = m.replace('#', '');
                mapaPagosComandas[num] = (mapaPagosComandas[num] || 0) + val;
              });
            }
          }
        }
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

          const idNum = ped.replace(/[^0-9]/g, '');
          const totalPago = mapaPagosComandas[idNum] || (typeof calcularPagamentosComanda === 'function' ? Number(calcularPagamentosComanda(ped)) : 0) || 0;
          const saldoRestante = Math.max(0, totalComanda - totalPago);
          const quitada = (totalComanda > 0 && saldoRestante <= 0.001);
          const vazia = (itens.length === 0 && totalComanda === 0);

          comandasAbertas.push({
            pedido: ped,
            cliente: cli,
            origem: origem,
            status: st,
            dataHora: dataCom ? Utilities.formatDate(dataCom, 'America/Bahia', 'dd/MM/yyyy HH:mm') : '',
            itens: itens,
            total: totalComanda,
            pagos: totalPago,
            saldo: saldoRestante,
            quitada: quitada,
            vazia: vazia
          });
        }
      });
    }

    // 8. Contas a Pagar (Hoje / Vencidas / Total Pendente)
    let contasPagarHojeCount = 0;
    let contasPagarHojeValor = 0;
    let contasPagarVencidasCount = 0;
    let contasPagarVencidasValor = 0;
    let contasPagarTotalPendente = 0;
    const shContas = ss.getSheetByName('CONTAS_A_PAGAR');
    if (shContas && shContas.getLastRow() > 1) {
      const dContas = shContas.getRange(2, 1, shContas.getLastRow() - 1, Math.min(shContas.getLastColumn(), 7)).getValues();
      dContas.forEach(r => {
        const st = String(r[5] || '').toUpperCase().trim();
        if (st === 'PENDENTE' || st === 'ABERTO' || st === 'EM ABERTO' || st === 'A PAGAR') {
          const val = Number(r[2]) || 0;
          contasPagarTotalPendente += val;
          const dtVenc = r[4] ? new Date(r[4]) : null;
          if (dtVenc && !isNaN(dtVenc.getTime())) {
            const dtVencStr = formatarDataSimples(dtVenc);
            if (dtVencStr < hojeStr) {
              contasPagarVencidasCount++;
              contasPagarVencidasValor += val;
            } else if (dtVencStr === hojeStr) {
              contasPagarHojeCount++;
              contasPagarHojeValor += val;
            }
          }
        }
      });
    }

    // 8.1 Contas a Receber (Fiados de Clientes)
    let contasReceberAbertoValor = 0;
    let contasReceberAbertoCount = 0;
    const shCR = ss.getSheetByName('CONTAS_A_RECEBER');
    if (shCR && shCR.getLastRow() > 1) {
      const dCR = shCR.getRange(2, 1, shCR.getLastRow() - 1, Math.min(shCR.getLastColumn(), 9)).getValues();
      dCR.forEach(r => {
        const saldo = Number(r[6]) || 0;
        const st = String(r[8] || '').toUpperCase().trim();
        if (st !== 'QUITADO' && saldo > 0.001) {
          contasReceberAbertoCount++;
          contasReceberAbertoValor += saldo;
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
        contasPagarHojeValor: contasPagarHojeValor,
        contasPagarVencidasCount: contasPagarVencidasCount,
        contasPagarVencidasValor: contasPagarVencidasValor,
        contasPagarTotalPendente: contasPagarTotalPendente,
        contasReceberAbertoCount: contasReceberAbertoCount,
        contasReceberAbertoValor: contasReceberAbertoValor
      },
      formasPgtoHoje: formasPgtoHoje,
      produtos: produtos,
      clientes: clientes,
      deliverys: deliverys,
      comandasAbertas: comandasAbertas,
      ultimasVendas: ultimasVendas,
      produtosCriticos: produtosCriticos.slice(0, 15),
      topProdutos: topProdutos,
      ultimoFechamentoFiscal: ultimoFechamentoFiscal,
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
    telegram_chat_id: '',
    setup_concluido: 'SIM',
    empresa_id: ''
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
    if (k === 'SETUP_CONCLUIDO') mapa.setup_concluido = v || 'NAO';
    if (k === 'EMPRESA_ID') mapa.empresa_id = v;
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
      ['TELEGRAM_DONO_CHAT_ID', dados.telegram_chat_id || '', 'ID do chat do Telegram do Dono'],
      ['SETUP_CONCLUIDO', 'SIM', 'Configuração inicial finalizada']
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

    // Se informou nome do dono, atualiza na aba USUARIOS
    if (dados.dono) {
      try {
        const shUsers = ss.getSheetByName('USUARIOS');
        if (shUsers && shUsers.getLastRow() > 1) {
          const dU = shUsers.getDataRange().getValues();
          for (let i = 1; i < dU.length; i++) {
            if (String(dU[i][4] || '').toUpperCase() === 'DONO') {
              shUsers.getRange(i + 1, 2).setValue(dados.dono.trim());
              break;
            }
          }
        }
      } catch(eDono) {}
    }

    try {
      if (typeof padronizarVisualECoresAbasSistema === 'function') {
        padronizarVisualECoresAbasSistema(ss);
      }
    } catch(ePad) {}

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
        inserirLinhaPadronizadaNoTopo(shCom, [pedido, new Date(), cliente, 'BALCAO', 'ABERTA']);
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
        inserirLinhaPadronizadaNoTopo(shItens, [pedido, i.produto, q, u, q * u]);
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

    // 2. Registrar item na comanda no topo com padronização visual
    inserirLinhaPadronizadaNoTopo(shItens, [
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
 * 👑 Exclusivo do DONO: Remove item já registrado de uma comanda balcão aberta,
 * devolve a quantidade ao estoque físico e atualiza a aba COMANDA_ITENS.
 */
function removerItemComandaBalcao360(token, pedido, produto, qtd) {
  try {
    const caller = obterUsuarioPorToken(token);
    if (!caller) return { sucesso: false, erro: 'Sessão expirada. Faça login novamente.' };

    // RBAC: Apenas DONO pode cancelar/remover item já inserido na comanda
    if (caller.perfil !== 'DONO') {
      return {
        sucesso: false,
        erro: 'Acesso negado: Apenas o perfil DONO possui autorização para estornar itens já lançados na comanda.'
      };
    }

    if (!pedido) throw new Error('Número da comanda não informado.');
    if (!produto) throw new Error('Produto não informado.');
    qtd = Number(qtd) || 0;
    if (qtd <= 0) throw new Error('Quantidade inválida para estorno.');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const shItens = ss.getSheetByName('COMANDA_ITENS');
    if (!shItens || shItens.getLastRow() < 2) {
      throw new Error('Aba COMANDA_ITENS vazia ou não encontrada.');
    }

    // 1. Localiza e remove a linha correspondente em COMANDA_ITENS
    const dadosItens = shItens.getDataRange().getValues();
    let linhaRemovida = -1;
    const prodBusca = String(produto).trim().toLowerCase();

    for (let r = dadosItens.length - 1; r >= 1; r--) {
      const pedRow = String(dadosItens[r][0] || '').trim();
      const prodRow = String(dadosItens[r][1] || '').trim().toLowerCase();

      if (pedRow === String(pedido).trim() && (prodRow === prodBusca || prodRow.includes(prodBusca) || prodBusca.includes(prodRow))) {
        linhaRemovida = r + 1;
        break;
      }
    }

    if (linhaRemovida === -1) {
      throw new Error(`Item "${produto}" não encontrado nos lançamentos da Comanda #${pedido}.`);
    }

    shItens.deleteRow(linhaRemovida);

    // 2. Devolve ao estoque físico
    try {
      if (typeof devolverEstoquePorComanda === 'function') {
        devolverEstoquePorComanda(produto, qtd);
      } else {
        const shEst = ss.getSheetByName('ESTOQUE');
        if (shEst) {
          const dEst = shEst.getDataRange().getValues();
          for (let i = 1; i < dEst.length; i++) {
            if (String(dEst[i][0] || '').trim().toLowerCase() === prodBusca) {
              const novaQtd = (Number(dEst[i][1]) || 0) + qtd;
              shEst.getRange(i + 1, 2).setValue(novaQtd);
              break;
            }
          }
        }
      }
    } catch (eEst) {
      console.warn('Erro ao devolver estoque:', eEst.message);
    }

    // 3. Força atualização do estoque
    try {
      if (typeof atualizarEstoque === 'function') {
        atualizarEstoque();
      }
    } catch(eSync) {}

    // 4. Trilha de Auditoria
    try {
      const shAud = ss.getSheetByName('AUDITORIA_USUARIOS');
      if (shAud) {
        inserirLinhaPadronizadaNoTopo(shAud, [
          new Date(),
          caller.nome,
          caller.perfil,
          'ESTORNO_ITEM_COMANDA',
          `Cancelou e devolveu ao estoque ${qtd}x ${produto} da Comanda #${pedido}`
        ]);
      }
    } catch(eAud) {}

    // 5. Retorna itens atualizados da comanda
    const itensRestantes = [];
    let novoTotal = 0;
    const novosDadosItens = shItens.getDataRange().getValues();
    for (let r = 1; r < novosDadosItens.length; r++) {
      if (String(novosDadosItens[r][0] || '').trim() === String(pedido).trim()) {
        const p = String(novosDadosItens[r][1] || '').trim();
        const q = Number(novosDadosItens[r][2]) || 0;
        const u = Number(novosDadosItens[r][3]) || 0;
        const tot = Number(novosDadosItens[r][4]) || (q * u);
        itensRestantes.push({ produto: p, qtd: q, unit: u, total: tot });
        novoTotal += tot;
      }
    }

    return {
      sucesso: true,
      msg: `Item "${produto}" (${qtd} un) estornado com sucesso! Quantidade devolvida ao estoque.`,
      itensRestantes: itensRestantes,
      novoTotal: novoTotal
    };
  } catch (err) {
    console.error('Erro em removerItemComandaBalcao360:', err);
    return { sucesso: false, erro: err.message };
  }
}

/**
 * Fecha uma Comanda Balcão existente com baixa de pagamento no caixa.
 * Suporta comandas com saldo devedor restante, comandas já quitadas (R$ 0,00) e comandas sem itens.
 */
function fecharComandaBalcao360(pedido, formaPgto) {
  try {
    if (!pedido) throw new Error('Número da comanda não informado.');
    formaPgto = String(formaPgto || 'Dinheiro').trim();

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const shCom = ss.getSheetByName('COMANDAS');
    if (!shCom) throw new Error('Aba COMANDAS não encontrada.');

    // 1. Tenta fechar usando o motor nativo da planilha (baixa no caixa se houver saldo restante e vendas)
    let fechouNativo = false;
    try {
      if (typeof fecharComandaBalcaoFinal === 'function') {
        const res = fecharComandaBalcaoFinal(pedido, formaPgto);
        if (res && res.ok) fechouNativo = true;
      }
    } catch (eNativo) {
      console.warn('Aviso em fecharComandaBalcaoFinal:', eNativo.message);
    }

    // 2. Garante que o status na aba COMANDAS seja atualizado para FECHADA
    const dados = shCom.getDataRange().getValues();
    let encontrou = false;
    for (let i = 1; i < dados.length; i++) {
      const pedRow = String(dados[i][0] || '').trim();
      if (pedRow === String(pedido).trim() || (Number(pedRow) === Number(pedido) && !isNaN(Number(pedido)))) {
        shCom.getRange(i + 1, 5).setValue('FECHADA');
        encontrou = true;
      }
    }

    if (!encontrou && !fechouNativo) {
      throw new Error('Comanda #' + pedido + ' não encontrada.');
    }

    return { sucesso: true, msg: 'Comanda #' + pedido + ' finalizada e arquivada com sucesso!' };
  } catch (err) {
    console.error('Erro em fecharComandaBalcao360:', err);
    return { sucesso: false, erro: err.message };
  }
}

/**
 * 🧹 Varre a aba COMANDAS e arquiva (status = FECHADA) todas as comandas
 * que já estiverem com saldo devedor R$ 0,00 ou sem itens discriminados.
 */
function arquivarComandasQuitadas360(token) {
  try {
    const caller = obterUsuarioPorToken(token);
    if (!caller) return { sucesso: false, erro: 'Sessão expirada. Faça login novamente.' };

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const shCom = ss.getSheetByName('COMANDAS');
    if (!shCom || shCom.getLastRow() < 2) {
      return { sucesso: true, msg: 'Nenhuma comanda para arquivar.', arquivadas: 0 };
    }

    // 1. Mapeia itens de cada comanda
    const mapaItens = {};
    const shItens = ss.getSheetByName('COMANDA_ITENS');
    if (shItens && shItens.getLastRow() > 1) {
      const dItens = shItens.getRange(2, 1, shItens.getLastRow() - 1, Math.min(shItens.getLastColumn(), 5)).getValues();
      dItens.forEach(r => {
        const ped = String(r[0] || '').trim();
        if (!ped) return;
        const tot = Number(r[4]) || ((Number(r[2]) || 0) * (Number(r[3]) || 0));
        mapaItens[ped] = (mapaItens[ped] || 0) + tot;
      });
    }

    // 2. Mapeia pagamentos da aba CAIXA
    const mapaPagos = {};
    const shCaixa = ss.getSheetByName('CAIXA');
    if (shCaixa && shCaixa.getLastRow() > 1) {
      const dCaixa = shCaixa.getRange(2, 1, shCaixa.getLastRow() - 1, Math.min(shCaixa.getLastColumn(), 5)).getValues();
      dCaixa.forEach(r => {
        const tipo = String(r[1] || '').trim().toUpperCase();
        if (tipo === 'ENTRADA') {
          const val = Number(r[2]) || 0;
          const desc = String(r[4] || '').toUpperCase();
          if (desc.includes('COMANDA')) {
            const matches = desc.match(/#?(\d+)/g);
            if (matches) {
              matches.forEach(m => {
                const num = m.replace('#', '');
                mapaPagos[num] = (mapaPagos[num] || 0) + val;
              });
            }
          }
        }
      });
    }

    // 3. Varre as comandas com status ABERTA
    const dCom = shCom.getDataRange().getValues();
    let arquivadas = 0;

    for (let i = 1; i < dCom.length; i++) {
      const ped = String(dCom[i][0] || '').trim();
      const st = String(dCom[i][4] || '').toUpperCase().trim();

      if (st === 'ABERTA' || st === 'EM ABERTO' || st === 'AGUARDANDO_PGTO') {
        const totalConsumido = mapaItens[ped] || 0;
        const idNum = ped.replace(/[^0-9]/g, '');
        const totalPago = mapaPagos[idNum] || (typeof calcularPagamentosComanda === 'function' ? Number(calcularPagamentosComanda(ped)) : 0) || 0;
        const saldoRestante = Math.max(0, totalConsumido - totalPago);

        // Se o saldo restante for zero ou a comanda não tiver itens discriminados
        if (saldoRestante <= 0.001 || totalConsumido === 0) {
          shCom.getRange(i + 1, 5).setValue('FECHADA');
          arquivadas++;
        }
      }
    }

    return {
      sucesso: true,
      msg: arquivadas > 0 
        ? `${arquivadas} comanda(s) quitada(s) ou zerada(s) foram arquivadas com sucesso!` 
        : 'Nenhuma comanda quitada pendente de arquivamento.',
      arquivadas: arquivadas
    };
  } catch (err) {
    console.error('Erro em arquivarComandasQuitadas360:', err);
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
      inserirLinhaPadronizadaNoTopo(shCaixa, [
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

      // 3. Registra no topo da aba VENDAS com padronização visual
      inserirLinhaPadronizadaNoTopo(shVendas, [
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
            inserirLinhaPadronizadaNoTopo(shCaixa, [agora, 'Entrada', totalVenda, formaPgto, 'Balcão', 'Venda Balcão - ' + cliente]);
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

    // 3. Registrar na aba DELIVERY no topo com padronização visual
    inserirLinhaPadronizadaNoTopo(shDel, [
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
      inserirLinhaPadronizadaNoTopo(shItens, [
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
      inserirLinhaPadronizadaNoTopo(sh, [nome, tel, end, ref, obs]);
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
  inserirLinhaPadronizadaNoTopo(sh, [normNome, tel || '', end || '', ref || '', obs || '']);
}

/**
 * Abre o Painel Executivo & PDV 360° como Modal dentro da Planilha.
 */
function abrirPainelDeposito360Modal() {
  try {
    if (typeof sincronizarArquivosEPastaRaizEmpresa === 'function') {
      sincronizarArquivosEPastaRaizEmpresa();
    }
  } catch(eSync) {}

  const html = HtmlService.createHtmlOutputFromFile('PainelDeposito360')
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
  const urlPadrao = 'https://script.google.com/macros/s/AKfycbzsVlZgA_M9Xqf_VCmA57XHH3iEa_YHOo0-qfSNvl3F5Xrtiuf-9QJ_sm97atoPureH/exec';
  try {
    const urlService = ScriptApp.getService().getUrl();
    if (urlService && urlService.includes('/exec') && !urlService.includes('AKfycbyBush')) {
      return urlService;
    }
  } catch (e) {}
  return urlPadrao;
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
    if (!caller || (caller.perfil !== 'ADMIN' && caller.perfil !== 'DONO' && caller.perfil !== 'GERENTE')) {
      return { ok: false, msg: 'Acesso restrito a Administradores, Donos e Gerentes.' };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName('USUARIOS');
    if (!sh) return { ok: false, msg: 'Aba USUARIOS não encontrada.' };

    const dados = sh.getDataRange().getValues();
    const lista = [];
    const isCallerAdmin = (caller.perfil === 'ADMIN');

    for (let i = 1; i < dados.length; i++) {
      const id = String(dados[i][0] || '').trim();
      const nome = String(dados[i][1] || '').trim();
      const email = String(dados[i][2] || '').trim();
      const perfil = String(dados[i][4] || 'VENDEDOR').toUpperCase().trim();
      const ativo = String(dados[i][5] || 'NAO').toUpperCase().trim();
      const dCriacao = dados[i][6] ? formatarDataSimples(new Date(dados[i][6])) : '--';
      const uAcesso = dados[i][7] ? formatarDataSimples(new Date(dados[i][7])) : '--';

      // 🛡️ Regra RBAC: Usuários com perfil ADMIN ficam SEMPRE ocultos para quem não for ADMIN.
      // O ADMIN quando entra no sistema vê o de todos.
      if (!isCallerAdmin && (perfil === 'ADMIN' || nome.toLowerCase() === 'admin')) {
        continue;
      }

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
    if (!caller || (caller.perfil !== 'ADMIN' && caller.perfil !== 'DONO' && caller.perfil !== 'GERENTE')) {
      return { ok: false, msg: 'Acesso restrito.' };
    }

    if (!dadosUser || !dadosUser.nome || !dadosUser.senha) {
      return { ok: false, msg: 'Nome e senha são obrigatórios.' };
    }

    const nome = String(dadosUser.nome).trim();
    const email = String(dadosUser.email || '').trim();
    let perfil = String(dadosUser.perfil || 'VENDEDOR').toUpperCase().trim();
    const senha = String(dadosUser.senha).trim();

    // 🛡️ Apenas ADMIN pode cadastrar perfil ADMIN
    if (caller.perfil !== 'ADMIN' && perfil === 'ADMIN') {
      return { ok: false, msg: 'Acesso restrito: apenas Administradores podem cadastrar novos Administradores.' };
    }

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
    if (!caller || (caller.perfil !== 'ADMIN' && caller.perfil !== 'DONO' && caller.perfil !== 'GERENTE')) {
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
        const nomeAlvo = String(dados[i][1] || '').trim().toLowerCase();

        // 🛡️ Usuários não-ADMIN não podem alterar status de Administrador
        if (caller.perfil !== 'ADMIN' && (perfilAlvo === 'ADMIN' || nomeAlvo === 'admin')) {
          return { ok: false, msg: 'Acesso restrito: contas de Administrador só podem ser alteradas por outro Administrador.' };
        }

        if (caller.perfil === 'GERENTE' && (perfilAlvo === 'ADMIN' || perfilAlvo === 'DONO' || perfilAlvo === 'GERENTE')) {
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
    if (!caller || (caller.perfil !== 'ADMIN' && caller.perfil !== 'DONO' && caller.perfil !== 'GERENTE')) {
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
        const nomeAlvo = String(dados[i][1] || '').trim().toLowerCase();

        // 🛡️ Usuários não-ADMIN não podem redefinir senha de Administrador
        if (caller.perfil !== 'ADMIN' && (perfilAlvo === 'ADMIN' || nomeAlvo === 'admin')) {
          return { ok: false, msg: 'Acesso restrito: senhas de Administrador só podem ser alteradas pelo próprio Administrador.' };
        }

        if (caller.perfil === 'GERENTE' && (perfilAlvo === 'ADMIN' || perfilAlvo === 'DONO' || perfilAlvo === 'GERENTE')) {
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
    if (!caller || (caller.perfil !== 'ADMIN' && caller.perfil !== 'DONO' && caller.perfil !== 'GERENTE')) {
      return { ok: false, msg: 'Acesso restrito a Administradores, Donos e Gerentes.' };
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
      if ((caller.perfil === 'DONO' || caller.perfil === 'ADMIN') && (novoPerfil !== 'DONO' && novoPerfil !== 'ADMIN')) {
        return { ok: false, msg: 'O gestor principal não pode rebaixar seu próprio perfil para operacional.' };
      }
      if (novoAtivo !== 'SIM') {
        return { ok: false, msg: 'Você não pode desativar seu próprio acesso.' };
      }
    }

    // Gerente só pode editar Vendedores e não pode promover para GERENTE, DONO ou ADMIN
    if (caller.perfil === 'GERENTE') {
      if (novoPerfil !== 'VENDEDOR') {
        return { ok: false, msg: 'Gerente não tem permissão para alterar perfil para Gerente, Dono ou Admin.' };
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
        const nomeAtualAlvo = String(dados[i][1] || '').trim().toLowerCase();

        // 🛡️ Usuários não-ADMIN não podem editar cadastro de Administrador
        if (caller.perfil !== 'ADMIN' && (perfilAtualAlvo === 'ADMIN' || nomeAtualAlvo === 'admin')) {
          return { ok: false, msg: 'Acesso restrito: contas de Administrador só podem ser editadas por outro Administrador.' };
        }

        // 🛡️ Usuários não-ADMIN não podem conceder o perfil de Administrador a ninguém
        if (caller.perfil !== 'ADMIN' && novoPerfil === 'ADMIN') {
          return { ok: false, msg: 'Acesso restrito: apenas Administradores podem conceder o perfil de Administrador.' };
        }

        if (caller.perfil === 'GERENTE' && (perfilAtualAlvo === 'ADMIN' || perfilAtualAlvo === 'DONO' || perfilAtualAlvo === 'GERENTE')) {
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

      case 'reorganizarRelatoriosPastasCorretas': {
        const res = (typeof reorganizarRelatoriosPastasCorretas === 'function')
          ? reorganizarRelatoriosPastasCorretas()
          : { ok: false, msg: 'Função não encontrada.' };
        return { ok: res.ok, msg: res.msg || 'Organização concluída!' };
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

/**
 * Retorna dados estruturados de prévia de um relatório para exibição e geração de PDF.
 * Salva automaticamente uma cópia em PDF na pasta de Relatórios do Drive do mês vigente.
 */
function obterPreviaRelatorio360(token, tipoRelatorio) {
  try {
    const caller = obterUsuarioPorToken(token);
    if (!caller) {
      return { ok: false, msg: 'Sessão expirada. Faça login novamente.' };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    sincronizarFusoHorarioPlanilha();
    const tipo = String(tipoRelatorio || '').trim();
    let resultado = null;

    if (tipo === 'valoresEstoque') {
      if (typeof gerarRelatorioEstoqueComValores === 'function') {
        try { gerarRelatorioEstoqueComValores(); } catch(e) {}
      }

      const shProd = ss.getSheetByName('PRODUTOS');
      const shEst = ss.getSheetByName('ESTOQUE');
      const produtos = [];
      let totalCusto = 0;
      let totalVenda = 0;

      const mapaEst = {};
      if (shEst && shEst.getLastRow() > 1) {
        const dEst = shEst.getRange(2, 1, shEst.getLastRow() - 1, 2).getValues();
        dEst.forEach(r => {
          const n = String(r[0] || '').trim().toUpperCase();
          if (n) mapaEst[n] = Number(r[1]) || 0;
        });
      }

      if (shProd && shProd.getLastRow() > 1) {
        const dProd = shProd.getRange(2, 1, shProd.getLastRow() - 1, 8).getValues();
        dProd.forEach(r => {
          const nome = String(r[0] || '').trim();
          if (!nome) return;
          const preco = Number(r[4]) || 0;
          const custo = Number(r[6]) || 0;
          const qtd = mapaEst[nome.toUpperCase()] !== undefined ? mapaEst[nome.toUpperCase()] : (Number(r[7]) || 0);
          const vCusto = qtd * custo;
          const vVenda = qtd * preco;
          totalCusto += vCusto;
          totalVenda += vVenda;
          produtos.push({
            nome: nome,
            categoria: String(r[1] || 'Geral'),
            qtd: qtd,
            custo: custo,
            preco: preco,
            totalCusto: vCusto,
            totalVenda: vVenda,
            lucroProjetado: vVenda - vCusto
          });
        });
      }

      produtos.sort((a, b) => b.totalVenda - a.totalVenda);

      resultado = {
        ok: true,
        tipo: 'valoresEstoque',
        titulo: '📊 Relatório de Valores do Estoque',
        dataGeracao: Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm'),
        resumo: {
          totalItens: produtos.length,
          valorEstoqueCusto: totalCusto,
          valorEstoqueVenda: totalVenda,
          lucroProjetadoTotal: totalVenda - totalCusto,
          margemMediaGlobal: totalCusto > 0 ? ((totalVenda - totalCusto) / totalCusto) * 100 : 0
        },
        colunas: ['Produto', 'Categoria', 'Estoque', 'Custo Un.', 'Preço Venda', 'Total Custo', 'Total Venda', 'Lucro Proj.'],
        linhas: produtos.slice(0, 50).map(p => [
          p.nome, p.categoria, p.qtd + ' un',
          'R$ ' + p.custo.toFixed(2).replace('.', ','),
          'R$ ' + p.preco.toFixed(2).replace('.', ','),
          'R$ ' + p.totalCusto.toFixed(2).replace('.', ','),
          'R$ ' + p.totalVenda.toFixed(2).replace('.', ','),
          'R$ ' + p.lucroProjetado.toFixed(2).replace('.', ',')
        ]),
        abaNome: 'RELATORIO_VALORES_ESTOQUE'
      };
    }

    if (tipo === 'financeiroCompleto') {
      if (typeof gerarRelatorioFinanceiroCompletoSilencioso === 'function') {
        try { gerarRelatorioFinanceiroCompletoSilencioso(); } catch(e) {}
      }

      const shCaixa = ss.getSheetByName('CAIXA');
      let entradas = 0;
      let saidas = 0;
      const ultimos = [];

      if (shCaixa && shCaixa.getLastRow() > 1) {
        const dCaixa = shCaixa.getRange(2, 1, shCaixa.getLastRow() - 1, 5).getValues();
        for (let i = dCaixa.length - 1; i >= 0; i--) {
          const r = dCaixa[i];
          const rawData = r[0];
          const d = rawData instanceof Date ? rawData : new Date(rawData);
          const t = String(r[1] || '').trim().toUpperCase();
          const v = Number(r[2]) || 0;
          const pgto = String(r[3] || '');
          const desc = String(r[4] || '');

          if (t === 'ENTRADA') entradas += v;
          if (t === 'SAIDA' || t === 'SAÍDA') saidas += v;

          if (ultimos.length < 30 && !isNaN(d.getTime())) {
            ultimos.push([
              Utilities.formatDate(d, 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm'),
              t,
              'R$ ' + v.toFixed(2).replace('.', ','),
              pgto,
              desc
            ]);
          }
        }
      }

      resultado = {
        ok: true,
        tipo: 'financeiroCompleto',
        titulo: '💰 Relatório Financeiro Consolidado',
        dataGeracao: Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm'),
        resumo: {
          totalEntradas: entradas,
          totalSaidas: saidas,
          saldoConsolidado: entradas - saidas
        },
        colunas: ['Data / Hora', 'Tipo', 'Valor', 'Forma Pgto', 'Descrição'],
        linhas: ultimos,
        abaNome: 'RELATORIO_FINANCEIRO'
      };
    }

    if (tipo === 'compras') {
      if (typeof gerarRelatorioComprasSilencioso === 'function') {
        try { gerarRelatorioComprasSilencioso(); } catch(e) {}
      }
      const shCompras = ss.getSheetByName('COMPRAS');
      let totalCompras = 0;
      const listaCompras = [];

      if (shCompras && shCompras.getLastRow() > 1) {
        const d = shCompras.getRange(2, 1, shCompras.getLastRow() - 1, Math.min(shCompras.getLastColumn(), 6)).getValues();
        for (let i = d.length - 1; i >= 0; i--) {
          const r = d[i];
          const rawData = r[0];
          const dt = rawData instanceof Date ? rawData : new Date(rawData);
          const val = Number(r[3]) || Number(r[2]) || 0;
          totalCompras += val;
          if (listaCompras.length < 30) {
            listaCompras.push([
              !isNaN(dt.getTime()) ? Utilities.formatDate(dt, 'America/Sao_Paulo', 'dd/MM/yyyy') : String(rawData || ''),
              String(r[1] || ''),
              'R$ ' + val.toFixed(2).replace('.', ','),
              String(r[4] || ''),
              String(r[5] || '')
            ]);
          }
        }
      }

      resultado = {
        ok: true,
        tipo: 'compras',
        titulo: '🛒 Relatório de Compras de Fornecedores',
        dataGeracao: Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm'),
        resumo: {
          totalRegistros: shCompras ? Math.max(0, shCompras.getLastRow() - 1) : 0,
          valorTotalGasto: totalCompras
        },
        colunas: ['Data', 'Fornecedor / Item', 'Valor', 'Status', 'Nota Fiscal / Obs'],
        linhas: listaCompras,
        abaNome: 'RELATORIO_COMPRAS'
      };
    }

    if (tipo === 'logs') {
      const shLogs = ss.getSheetByName('LOGS') || ss.getSheetByName('AUDITORIA');
      const ultimosLogs = [];
      if (shLogs && shLogs.getLastRow() > 1) {
        const d = shLogs.getRange(2, 1, shLogs.getLastRow() - 1, Math.min(shLogs.getLastColumn(), 5)).getValues();
        for (let i = d.length - 1; i >= Math.max(0, d.length - 40); i--) {
          const r = d[i];
          const rawData = r[0];
          const dt = rawData instanceof Date ? rawData : new Date(rawData);
          ultimosLogs.push([
            !isNaN(dt.getTime()) ? Utilities.formatDate(dt, 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm') : String(rawData || ''),
            String(r[1] || ''),
            String(r[2] || ''),
            String(r[3] || '')
          ]);
        }
      }

      resultado = {
        ok: true,
        tipo: 'logs',
        titulo: '🧾 Relatório de Logs e Auditoria',
        dataGeracao: Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm'),
        resumo: {
          totalEventos: shLogs ? Math.max(0, shLogs.getLastRow() - 1) : 0
        },
        colunas: ['Data / Hora', 'Ação / Evento', 'Operador', 'Detalhes'],
        linhas: ultimosLogs,
        abaNome: 'RELATORIO_LOGS'
      };
    }

    if (resultado && resultado.ok) {
      // 📂 Salva arquivo automaticamente na subpasta correta de categoria e mês
      try {
        const driveRes = salvarRelatorioNoDriveMes(resultado.titulo, resultado.resumo, resultado.colunas, resultado.linhas, resultado.tipo);
        resultado.driveInfo = driveRes;
      } catch(eDrive) {
        console.warn('Erro ao salvar relatório no Drive:', eDrive.message);
      }
      return resultado;
    }

    return { ok: false, msg: `Tipo de relatório "${tipo}" não suportado.` };
  } catch(err) {
    console.error('Erro em obterPreviaRelatorio360:', err);
    return { ok: false, msg: 'Erro ao gerar prévia do relatório: ' + err.message };
  }
}

/**
 * 🏷️ Mapeia o tipo ou título do relatório para sua respectiva pasta oficial em "Relatorios":
 * - Financeiro: financeiroCompleto, DRE, Caixa, Contas a Pagar/Receber, Fechamento
 * - Estoque: valoresEstoque, Curva ABC, Giro de Estoque, Produtos, Críticos
 * - Compras: compras, Fornecedores, Entradas de NF
 * - Registros: logs, Auditoria, Eventos do Sistema, Backup Logs
 */
function resolverCategoriaRelatorio(tipoRelatorio, titulo) {
  const t = String(tipoRelatorio || '').toLowerCase();
  const tit = String(titulo || '').toLowerCase();

  // 1. Estoque
  if (t === 'valoresestoque' || t.includes('estoque') || tit.includes('estoque') || tit.includes('produto') || tit.includes('curva abc') || tit.includes('giro')) {
    return 'Estoque';
  }
  // 2. Financeiro
  if (t === 'financeirocompleto' || t.includes('financeiro') || t.includes('caixa') || t.includes('dre') ||
      tit.includes('financeiro') || tit.includes('caixa') || tit.includes('pagar') || tit.includes('receber') || tit.includes('dre') || tit.includes('fechamento')) {
    return 'Financeiro';
  }
  // 3. Compras
  if (t === 'compras' || t.includes('compra') || t.includes('forneced') ||
      tit.includes('compra') || tit.includes('forneced') || tit.includes('entrada')) {
    return 'Compras';
  }
  // 4. Registros
  if (t === 'logs' || t.includes('log') || t.includes('auditoria') ||
      tit.includes('log') || tit.includes('auditoria') || tit.includes('registro') || tit.includes('evento')) {
    return 'Registros';
  }

  return 'Financeiro';
}

/**
 * 🧹 Varre a pasta "Relatorios", identifica pastas de mês que ficaram soltas na raiz de Relatórios
 * (como "11 - Novembro 2026") ou arquivos avulsos, move cada relatório para sua categoria correta:
 *   - Relatorios / Financeiro / [Mês]
 *   - Relatorios / Estoque / [Mês]
 *   - Relatorios / Compras / [Mês]
 *   - Relatorios / Registros / [Mês]
 * E remove a pasta do mês solta que ficou vazia.
 */
function reorganizarRelatoriosPastasCorretas(pastaRelatoriosParam) {
  try {
    let pastaRelatorios = pastaRelatoriosParam || null;
    if (!pastaRelatorios) {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const nomeDeposito = (typeof getNomeDeposito === 'function') ? getNomeDeposito() : 'Gestão de Depósito';

      let rootFolder = null;
      try {
        const itP = DriveApp.getFileById(ss.getId()).getParents();
        if (itP.hasNext()) rootFolder = itP.next();
      } catch(e) {}
      if (!rootFolder) {
        const pastas = DriveApp.getFoldersByName(nomeDeposito);
        if (pastas.hasNext()) rootFolder = pastas.next();
        else rootFolder = DriveApp.getRootFolder();
      }

      const itRel = rootFolder.getFoldersByName('Relatorios');
      if (itRel.hasNext()) {
        pastaRelatorios = itRel.next();
      } else {
        const itRel2 = rootFolder.getFoldersByName('Relatórios');
        if (itRel2.hasNext()) pastaRelatorios = itRel2.next();
      }
    }

    if (!pastaRelatorios) {
      return { ok: false, msg: 'Pasta Relatorios não localizada no Drive.' };
    }

    // Garante as 4 subpastas de categoria oficiais
    const categorias = ['Financeiro', 'Estoque', 'Compras', 'Registros'];
    const pastasCat = {};
    categorias.forEach(cat => {
      const it = pastaRelatorios.getFoldersByName(cat);
      if (it.hasNext()) {
        pastasCat[cat] = it.next();
      } else {
        pastasCat[cat] = pastaRelatorios.createFolder(cat);
      }
    });

    let arquivosMovidos = 0;
    const pastasRemovidas = [];

    // 1. Procura subpastas dentro de Relatorios que não sejam as categorias oficiais
    const subPastas = pastaRelatorios.getFolders();
    const pastasRogue = [];
    while (subPastas.hasNext()) {
      const sub = subPastas.next();
      const nomeSub = sub.getName();
      if (!categorias.includes(nomeSub)) {
        pastasRogue.push(sub);
      }
    }

    pastasRogue.forEach(sub => {
      const nomeSub = sub.getName();
      const arquivos = sub.getFiles();
      while (arquivos.hasNext()) {
        const arq = arquivos.next();
        const nomeArq = arq.getName();
        const catAlvo = resolverCategoriaRelatorio('', nomeArq);
        const pastaCat = pastasCat[catAlvo] || pastasCat['Financeiro'];

        // Garante a pasta do mês (ex: "11 - Novembro 2026") dentro da categoria correta
        let pastaMesAlvo = null;
        const itMes = pastaCat.getFoldersByName(nomeSub);
        if (itMes.hasNext()) {
          pastaMesAlvo = itMes.next();
        } else {
          pastaMesAlvo = pastaCat.createFolder(nomeSub);
        }

        try {
          arq.moveTo(pastaMesAlvo);
          arquivosMovidos++;
        } catch(eMove) {
          pastaMesAlvo.addFile(arq);
          sub.removeFile(arq);
          arquivosMovidos++;
        }
      }

      // Se a pasta agora estiver vazia de arquivos e subpastas, move para a lixeira
      try {
        if (!sub.getFiles().hasNext() && !sub.getFolders().hasNext()) {
          sub.setTrashed(true);
          pastasRemovidas.push(nomeSub);
        }
      } catch(eTrash) {
        console.warn('Erro ao remover pasta solta vazia:', eTrash.message);
      }
    });

    // 2. Se houver arquivos avulsos soltos diretamente em "Relatorios"
    const agora = new Date();
    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const mesNum = Utilities.formatDate(agora, 'America/Sao_Paulo', 'MM');
    const mesNome = meses[agora.getMonth()];
    const ano = Utilities.formatDate(agora, 'America/Sao_Paulo', 'yyyy');
    const nomePastaMesPadrao = `${mesNum} - ${mesNome} ${ano}`;

    const arqsAvulsos = pastaRelatorios.getFiles();
    while (arqsAvulsos.hasNext()) {
      const arq = arqsAvulsos.next();
      const nomeArq = arq.getName();
      const catAlvo = resolverCategoriaRelatorio('', nomeArq);
      const pastaCat = pastasCat[catAlvo] || pastasCat['Financeiro'];

      let pastaMesAlvo = null;
      const itMes = pastaCat.getFoldersByName(nomePastaMesPadrao);
      if (itMes.hasNext()) {
        pastaMesAlvo = itMes.next();
      } else {
        pastaMesAlvo = pastaCat.createFolder(nomePastaMesPadrao);
      }

      try {
        arq.moveTo(pastaMesAlvo);
        arquivosMovidos++;
      } catch(eMove) {
        pastaMesAlvo.addFile(arq);
        pastaRelatorios.removeFile(arq);
        arquivosMovidos++;
      }
    }

    try {
      const ssToast = SpreadsheetApp.getActiveSpreadsheet();
      if (ssToast) {
        ssToast.toast(`Pastas de relatórios organizadas! ${arquivosMovidos} arquivo(s) alocado(s).`, '📂 Google Drive');
      }
    } catch(eT) {}

    return {
      ok: true,
      arquivosMovidos: arquivosMovidos,
      pastasRemovidas: pastasRemovidas,
      msg: `Organização concluída! ${arquivosMovidos} arquivo(s) alocado(s) em suas respectivas pastas.`
    };
  } catch(err) {
    console.error('Erro em reorganizarRelatoriosPastasCorretas:', err);
    return { ok: false, msg: err.message };
  }
}

/**
 * 📂 Cria e salva o relatório na subpasta correta de categoria e mês no Google Drive:
 * Exemplo: Relatorios / [Estoque | Financeiro | Compras | Registros] / [MM - Mês AAAA] / [Nome Relatório - Data].pdf
 */
function salvarRelatorioNoDriveMes(titulo, dadosResumo, colunas, linhas, tipoRelatorio) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const nomeDeposito = (typeof getNomeDeposito === 'function') ? getNomeDeposito() : 'Gestão de Depósito';

    let rootFolder = null;
    try {
      const itP = DriveApp.getFileById(ss.getId()).getParents();
      if (itP.hasNext()) rootFolder = itP.next();
    } catch(e) {}
    if (!rootFolder) {
      const pastas = DriveApp.getFoldersByName(nomeDeposito);
      if (pastas.hasNext()) rootFolder = pastas.next();
      else rootFolder = DriveApp.getRootFolder();
    }

    // Pasta "Relatorios"
    let pastaRelatorios = null;
    const itRel = rootFolder.getFoldersByName('Relatorios');
    if (itRel.hasNext()) {
      pastaRelatorios = itRel.next();
    } else {
      const itRel2 = rootFolder.getFoldersByName('Relatórios');
      if (itRel2.hasNext()) {
        pastaRelatorios = itRel2.next();
      } else {
        pastaRelatorios = rootFolder.createFolder('Relatorios');
      }
    }

    // 1. Identifica a subcategoria correta (Financeiro, Estoque, Compras, Registros)
    const categoria = resolverCategoriaRelatorio(tipoRelatorio, titulo);

    // 2. Obtém ou cria a pasta da Categoria dentro de Relatorios
    let pastaCategoria = null;
    const itCat = pastaRelatorios.getFoldersByName(categoria);
    if (itCat.hasNext()) {
      pastaCategoria = itCat.next();
    } else {
      pastaCategoria = pastaRelatorios.createFolder(categoria);
    }

    // 3. Subpasta do mês: MM - Mês AAAA dentro da categoria correspondente
    const agora = new Date();
    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const mesNum = Utilities.formatDate(agora, 'America/Sao_Paulo', 'MM');
    const mesNome = meses[agora.getMonth()];
    const ano = Utilities.formatDate(agora, 'America/Sao_Paulo', 'yyyy');
    const nomePastaMes = `${mesNum} - ${mesNome} ${ano}`;

    let pastaMes = null;
    const itMes = pastaCategoria.getFoldersByName(nomePastaMes);
    if (itMes.hasNext()) {
      pastaMes = itMes.next();
    } else {
      pastaMes = pastaCategoria.createFolder(nomePastaMes);
    }

    // 4. Nome do arquivo: [Nome do Relatório] - [dd-MM-yyyy HH-mm].pdf
    const dataHoraStr = Utilities.formatDate(agora, 'America/Sao_Paulo', 'dd-MM-yyyy HH-mm');
    const nomeLimpo = String(titulo || 'Relatório').replace(/[^a-zA-Z0-9À-ÿ\s\-_]/g, '').trim();
    const nomeArquivo = `${nomeLimpo} - ${dataHoraStr}`;

    // Monta HTML elegante para conversão em PDF
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${nomeArquivo}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 30px; color: #1e293b; }
          .header { border-bottom: 2px solid #0284c7; padding-bottom: 12px; margin-bottom: 20px; }
          h2 { color: #0f172a; margin: 0 0 6px 0; font-size: 20px; }
          .meta { font-size: 11px; color: #64748b; }
          .kpi-row { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
          .kpi-box { border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 8px; padding: 10px 14px; flex: 1; min-width: 120px; text-align: center; }
          .kpi-lbl { font-size: 10px; color: #64748b; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 4px; }
          .kpi-val { font-size: 16px; font-weight: 800; color: #0284c7; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 10px; }
          th { background: #0f172a; color: #ffffff; padding: 8px 10px; text-align: left; font-weight: 600; }
          td { border-bottom: 1px solid #e2e8f0; padding: 7px 10px; color: #334155; }
          tr:nth-child(even) td { background-color: #f8fafc; }
          .footer { margin-top: 30px; font-size: 9px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>${titulo}</h2>
          <div class="meta">${nomeDeposito} | Pasta: Relatorios/${categoria}/${nomePastaMes} | Solicitado em: ${Utilities.formatDate(agora, 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm:ss')}</div>
        </div>
    `;

    if (dadosResumo) {
      htmlContent += `<div class="kpi-row">`;
      for (const k in dadosResumo) {
        let v = dadosResumo[k];
        if (typeof v === 'number' && !k.toLowerCase().includes('itens') && !k.toLowerCase().includes('totalregistros') && !k.toLowerCase().includes('totaleventos') && !k.toLowerCase().includes('margem')) {
          v = 'R$ ' + v.toFixed(2).replace('.', ',');
        } else if (k.toLowerCase().includes('margem')) {
          v = Number(v).toFixed(1) + '%';
        }
        const lbl = k.replace(/([A-Z])/g, ' $1').trim().toUpperCase();
        htmlContent += `<div class="kpi-box"><span class="kpi-lbl">${lbl}</span><div class="kpi-val">${v}</div></div>`;
      }
      htmlContent += `</div>`;
    }

    htmlContent += `<table><thead><tr>`;
    (colunas || []).forEach(c => { htmlContent += `<th>${c}</th>`; });
    htmlContent += `</tr></thead><tbody>`;
    (linhas || []).forEach(r => {
      htmlContent += `<tr>`;
      r.forEach(cel => { htmlContent += `<td>${cel}</td>`; });
      htmlContent += `</tr>`;
    });
    htmlContent += `</tbody></table>`;
    htmlContent += `<div class="footer">Documento corporativo arquivado em Relatorios/${categoria}/${nomePastaMes} — Depósito Karo$$</div></body></html>`;

    const blob = Utilities.newBlob(htmlContent, 'text/html').getAs('application/pdf').setName(`${nomeArquivo}.pdf`);
    const file = pastaMes.createFile(blob);

    // 5. Executa rotina de auto-limpeza para garantir que nenhuma pasta solta permaneça na raiz de Relatorios
    try {
      reorganizarRelatoriosPastasCorretas(pastaRelatorios);
    } catch(eReorg) {}

    return {
      ok: true,
      nomeArquivo: `${nomeArquivo}.pdf`,
      pastaNome: `${categoria}/${nomePastaMes}`,
      categoria: categoria,
      fileId: file.getId(),
      url: file.getUrl()
    };
  } catch(err) {
    console.error('Erro em salvarRelatorioNoDriveMes:', err);
    return { ok: false, msg: err.message };
  }
}

/**
 * ⏰ Sincroniza o Fuso Horário da Planilha Google para America/Sao_Paulo (UTC-3)
 */
function sincronizarFusoHorarioPlanilha() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const fusoAlvo = "America/Sao_Paulo";
    if (ss.getSpreadsheetTimeZone() !== fusoAlvo) {
      ss.setSpreadsheetTimeZone(fusoAlvo);
    }
  } catch(e) {
    console.warn("Erro ao sincronizar fuso horário da planilha:", e.message);
  }
}

/**
 * 🔒 Obtém ou renomeia a aba de Conferência de Caixa para o padrão CONFERENCIA_CAIXA
 * e assegura o cabeçalho oficial completo de 12 colunas com layout escuro executivo
 */
function obterAbaConferenciaCaixa(ss) {
  const planilha = ss || SpreadsheetApp.getActiveSpreadsheet();
  let sh = planilha.getSheetByName('CONFERENCIA_CAIXA') || planilha.getSheetByName('CONFERÊNCIA_CAIXA') || planilha.getSheetByName('CAIXA_FECHAMENTO');
  if (!sh) sh = planilha.insertSheet('CONFERENCIA_CAIXA');
  if (sh.getName() !== 'CONFERENCIA_CAIXA') {
    try { sh.setName('CONFERENCIA_CAIXA'); } catch(e) {}
  }

  // Verifica se a aba precisa da padronização dos 12 cabeçalhos oficiais
  const cabecalhos = [
    'Protocolo', 'Data Registro', 'Entradas', 'Saídas', 'Saldo Sistema', 'Valor Gaveta', 'Diferença', 'Status', 'Operador', 'Gestor Aprovador', 'Data Aprovação', 'Observações'
  ];

  try {
    const valL1 = sh.getRange(1, 12).getValue();
    if (String(valL1).trim().toLowerCase() !== 'observações' && String(valL1).trim().toLowerCase() !== 'observacoes') {
      sh.getRange(1, 1, 1, cabecalhos.length).setValues([cabecalhos]);
      sh.getRange(1, 1, 1, cabecalhos.length)
        .setFontWeight('bold')
        .setBackground('#0f172a')
        .setFontColor('#ffffff')
        .setHorizontalAlignment('center')
        .setVerticalAlignment('middle');
      try { sh.setRowHeight(1, 28); } catch(e) {}

      const maxRows = Math.max(sh.getLastRow(), 2);
      sh.getRange(2, 3, maxRows - 1, 5).setNumberFormat('R$ #,##0.00');
      sh.getRange(2, 2, maxRows - 1, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
      sh.getRange(2, 11, maxRows - 1, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
      sh.getRange(2, 1, maxRows - 1, 1).setHorizontalAlignment('center');
      sh.getRange(2, 8, maxRows - 1, 3).setHorizontalAlignment('center');
    }
  } catch(ePad) {
    console.warn('Aviso ao formatar cabeçalhos de CONFERENCIA_CAIXA:', ePad.message);
  }

  return sh;
}

/**
 * 📑 Obtém ou renomeia a aba de Fechamento Fiscal para o padrão FECHAMENTO_FISCAL
 * e assegura o cabeçalho executivo de 7 colunas
 */
function obterAbaFechamentoFiscal(ss) {
  const planilha = ss || SpreadsheetApp.getActiveSpreadsheet();
  let sh = planilha.getSheetByName('FECHAMENTO_FISCAL') || planilha.getSheetByName('CAIXA_FISCAL');
  if (!sh) sh = planilha.insertSheet('FECHAMENTO_FISCAL');
  if (sh.getName() !== 'FECHAMENTO_FISCAL') {
    try { sh.setName('FECHAMENTO_FISCAL'); } catch(e) {}
  }

  const cabecalhos = [
    'Data Referência', 'Entradas', 'Saídas', 'Saldo Fiscal', 'Fechado em', 'Responsável', 'Observações'
  ];

  try {
    const valG1 = sh.getRange(1, 7).getValue();
    if (String(valG1).trim().toLowerCase() !== 'observações' && String(valG1).trim().toLowerCase() !== 'observacoes') {
      sh.getRange(1, 1, 1, cabecalhos.length).setValues([cabecalhos]);
      sh.getRange(1, 1, 1, cabecalhos.length)
        .setFontWeight('bold')
        .setBackground('#0f172a')
        .setFontColor('#ffffff')
        .setHorizontalAlignment('center')
        .setVerticalAlignment('middle');
      try { sh.setRowHeight(1, 28); } catch(e) {}

      const maxRows = Math.max(sh.getLastRow(), 2);
      sh.getRange(2, 2, maxRows - 1, 3).setNumberFormat('R$ #,##0.00');
      sh.getRange(2, 5, maxRows - 1, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
    }
  } catch(ePad) {
    console.warn('Aviso ao formatar cabeçalhos de FECHAMENTO_FISCAL:', ePad.message);
  }

  return sh;
}

/**
 * Retorna dados para a prévia da Conferência de Caixa antes do operador enviar/gravar.
 */
function obterPreviaConferenciaCaixa(token) {
  try {
    const caller = obterUsuarioPorToken(token);
    if (!caller) return { ok: false, msg: 'Sessão expirada. Faça login novamente.' };

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    sincronizarFusoHorarioPlanilha();

    let saldoObj = (typeof calcularSaldoHoje === 'function') ? calcularSaldoHoje() : null;
    let entradas = 0;
    let saidas = 0;
    let saldo = 0;

    if (saldoObj && typeof saldoObj === 'object') {
      entradas = Number(saldoObj.entrada) || 0;
      saidas = Number(saldoObj.saida) || 0;
      saldo = Number(saldoObj.saldo) || 0;
    } else if (typeof saldoObj === 'number') {
      saldo = saldoObj;
    }

    if (entradas === 0 && saidas === 0) {
      const shCaixa = ss.getSheetByName('CAIXA');
      if (shCaixa && shCaixa.getLastRow() > 1) {
        const hojeStr = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyyMMdd');
        const dCaixa = shCaixa.getRange(2, 1, shCaixa.getLastRow() - 1, 4).getValues();
        dCaixa.forEach(r => {
          const dt = converterParaDataValida(r[0]);
          if (dt && Utilities.formatDate(dt, 'America/Sao_Paulo', 'yyyyMMdd') === hojeStr) {
            const tipo = String(r[1] || '').toUpperCase().trim();
            const val = Number(r[2]) || 0;
            if (tipo === 'ENTRADA') entradas += val;
            if (tipo === 'SAIDA' || tipo === 'SAÍDA') saidas += val;
          }
        });
        saldo = entradas - saidas;
      }
    }

    // Lista gestores disponíveis para seleção de envio
    const gestores = [];
    const shUsuarios = ss.getSheetByName('USUARIOS');
    if (shUsuarios && shUsuarios.getLastRow() > 1) {
      const dUsers = shUsuarios.getRange(2, 1, shUsuarios.getLastRow() - 1, 9).getValues();
      dUsers.forEach(u => {
        const p = String(u[4] || '').toUpperCase().trim();
        const at = String(u[5] || '').toUpperCase().trim();
        const chatId = String(u[8] || '').trim().split('.')[0];
        if (at === 'SIM' && (p === 'DONO' || p === 'GERENTE' || p === 'GERENCIAL' || p === 'ADMIN')) {
          gestores.push({
            id: String(u[0]),
            nome: String(u[1]),
            perfil: p,
            chatId: chatId
          });
        }
      });
    }

    return {
      ok: true,
      dataHoje: Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm'),
      operadorNome: caller.nome,
      perfilOperador: caller.perfil,
      entradas: entradas,
      saidas: saidas,
      saldo: saldo,
      gestores: gestores
    };
  } catch(err) {
    console.error('Erro em obterPreviaConferenciaCaixa:', err);
    return { ok: false, msg: 'Erro ao gerar prévia da conferência: ' + err.message };
  }
}

/**
 * Registra a Conferência de Caixa e envia notificação com botões interativos no Telegram do Gestor selecionado.
 */
function solicitarAprovacaoConferenciaCaixa(token, payload) {
  try {
    const caller = obterUsuarioPorToken(token);
    if (!caller) return { ok: false, msg: 'Sessão expirada. Faça login novamente.' };

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    sincronizarFusoHorarioPlanilha();

    const shConf = obterAbaConferenciaCaixa(ss);
    const agora = new Date();
    const idConf = 'CONF-' + Utilities.formatDate(agora, 'America/Sao_Paulo', 'yyyyMMdd-HHmmss');

    const valorGaveta = Number(payload.valorGaveta) || 0;
    const saldoSistema = Number(payload.saldoSistema) || 0;
    const entradas = Number(payload.entradas) || 0;
    const saidas = Number(payload.saidas) || 0;
    const dif = valorGaveta - saldoSistema;
    const obs = String(payload.observacao || '').trim();
    const nomeGestorDestino = String(payload.nomeGestor || 'Gestor');
    const chatIdGestor = String(payload.chatIdGestor || '');

    const isGestor = (caller.perfil === 'DONO' || caller.perfil === 'GERENTE');
    const autoAprovar = !!payload.autoAprovar && isGestor;

    const statusInicial = autoAprovar ? 'APROVADO' : 'AGUARDANDO APROVAÇÃO';
    const aprovador = autoAprovar ? caller.nome : '';
    const dtAprov = autoAprovar ? agora : '';

    inserirLinhaPadronizadaNoTopo(shConf, [
      idConf,
      agora,
      entradas,
      saidas,
      saldoSistema,
      valorGaveta,
      dif,
      statusInicial,
      caller.nome,
      aprovador,
      dtAprov,
      obs
    ]);

    if (autoAprovar) {
      try {
        if (typeof inserirLinhaSeparadoraCaixa === 'function') {
          inserirLinhaSeparadoraCaixa(`CONFERÊNCIA DE CAIXA [${caller.nome.toUpperCase()}]`, saldoSistema);
        }
      } catch(e) {}
      return { ok: true, msg: 'Conferência de Caixa registrada e aprovada com sucesso!' };
    }

    // Dispara para o Telegram do gestor selecionado
    if (typeof enviarSolicitacaoConferenciaTelegram === 'function') {
      enviarSolicitacaoConferenciaTelegram({
        idConf: idConf,
        chatIdDestino: chatIdGestor,
        nomeOperador: caller.nome,
        entradas: entradas,
        saidas: saidas,
        saldo: saldoSistema,
        valorGaveta: valorGaveta,
        obs: obs
      });
    }

    return {
      ok: true,
      protocolo: idConf,
      msg: `Conferência registrada com protocolo #${idConf}! Uma notificação com resumo e botões de aprovação foi enviada para o Telegram de ${nomeGestorDestino}.`
    };
  } catch(err) {
    console.error('Erro em solicitarAprovacaoConferenciaCaixa:', err);
    return { ok: false, msg: 'Erro ao registrar conferência: ' + err.message };
  }
}

/**
 * Retorna dados para a prévia do Fechamento Fiscal antes de gravar na planilha.
 */
function obterPreviaFechamentoFiscal(token) {
  try {
    const caller = obterUsuarioPorToken(token);
    if (!caller) return { ok: false, msg: 'Sessão expirada. Faça login novamente.' };
    if (caller.perfil !== 'DONO' && caller.perfil !== 'GERENTE') {
      return { ok: false, msg: 'Apenas Donos e Gerentes têm acesso ao Fechamento Fiscal.' };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    sincronizarFusoHorarioPlanilha();

    const fiscal = obterAbaFechamentoFiscal(ss);
    const shCaixa = ss.getSheetByName('CAIXA');
    if (!shCaixa) return { ok: false, msg: 'Aba CAIXA não encontrada.' };

    const cx = shCaixa.getDataRange().getValues();
    const dadosFiscal = fiscal.getDataRange().getValues();

    let ultimoFechamento = null;
    let ultimoFechamentoStr = 'Nenhum fechamento anterior';
    for (let i = dadosFiscal.length - 1; i >= 1; i--) {
      const val = dadosFiscal[i][4] || dadosFiscal[i][0];
      const d = converterParaDataValida(val);
      if (d) {
        ultimoFechamento = d;
        ultimoFechamentoStr = Utilities.formatDate(d, 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm');
        break;
      }
    }

    let entrada = 0;
    let saida = 0;
    let qtdMovimentos = 0;

    cx.forEach((c, i) => {
      if (i === 0) return;
      const dataMov = converterParaDataValida(c[0]);
      if (!dataMov) return;
      if (ultimoFechamento && dataMov <= ultimoFechamento) return;

      const tipo = String(c[1] || '').trim().toUpperCase();
      const val = Number(c[2]) || 0;
      if (tipo === 'ENTRADA') { entrada += val; qtdMovimentos++; }
      else if (tipo === 'SAIDA' || tipo === 'SAÍDA') { saida += val; qtdMovimentos++; }
    });

    if (qtdMovimentos === 0) {
      const hojeStr = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyyMMdd');
      cx.forEach((c, i) => {
        if (i === 0) return;
        const dataMov = converterParaDataValida(c[0]);
        if (!dataMov) return;
        if (Utilities.formatDate(dataMov, 'America/Sao_Paulo', 'yyyyMMdd') === hojeStr) {
          const tipo = String(c[1] || '').trim().toUpperCase();
          const val = Number(c[2]) || 0;
          if (tipo === 'ENTRADA') { entrada += val; qtdMovimentos++; }
          else if (tipo === 'SAIDA' || tipo === 'SAÍDA') { saida += val; qtdMovimentos++; }
        }
      });
    }

    return {
      ok: true,
      ultimoFechamento: ultimoFechamentoStr,
      periodoReferencia: `${ultimoFechamentoStr} até HOJE (${Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm')})`,
      entradas: entrada,
      saidas: saida,
      saldo: entrada - saida,
      qtdMovimentos: qtdMovimentos,
      responsavel: caller.nome
    };
  } catch(err) {
    console.error('Erro em obterPreviaFechamentoFiscal:', err);
    return { ok: false, msg: 'Erro ao gerar prévia fiscal: ' + err.message };
  }
}

/**
 * Dispara alerta no Telegram do Dono/Gerentes caso o operador deslogue sem conferir o caixa.
 */
function notificarLogoutOperadorSemConferencia(token) {
  try {
    const caller = obterUsuarioPorToken(token);
    if (!caller) return { ok: false };

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const shConf = obterAbaConferenciaCaixa(ss);
    const hojeStr = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyyMMdd');

    let fezConferenciaHoje = false;
    if (shConf && shConf.getLastRow() > 1) {
      const d = shConf.getRange(2, 1, shConf.getLastRow() - 1, 9).getValues();
      for (let i = d.length - 1; i >= 0; i--) {
        const dt = converterParaDataValida(d[i][1]);
        const op = String(d[i][8] || '').trim().toLowerCase();
        if (dt && Utilities.formatDate(dt, 'America/Sao_Paulo', 'yyyyMMdd') === hojeStr) {
          if (op === caller.nome.trim().toLowerCase() || op.includes(caller.nome.trim().toLowerCase())) {
            fezConferenciaHoje = true;
            break;
          }
        }
      }
    }

    if (!fezConferenciaHoje) {
      const targetIds = (typeof obterChatIdsGerentesEDono === 'function') ? obterChatIdsGerentesEDono() : [];
      const agoraFmt = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm:ss');
      const msgAlerta = 
        `⚠️ <b>ALERTA DE SEGURANÇA: OPERADOR DESLOGOU SEM CONFERÊNCIA!</b>\n\n` +
        `👤 <b>Operador:</b> ${caller.nome} (${caller.perfil || 'Vendedor'})\n` +
        `⏰ <b>Horário:</b> ${agoraFmt}\n` +
        `📌 <b>Status:</b> O operador encerrou a sessão no sistema sem registrar a <b>Conferência de Caixa</b> física do seu turno!\n\n` +
        `💡 <i>Recomenda-se verificar a gaveta de dinheiro ou contatar o colaborador imediatamente.</i>`;

      targetIds.forEach(chatId => {
        if (typeof enviarMensagemTelegram === 'function') {
          enviarMensagemTelegram(msgAlerta, null, chatId);
        }
      });
    }
    return { ok: true };
  } catch(e) {
    console.error('Erro em notificarLogoutOperadorSemConferencia:', e);
    return { ok: false, msg: e.message };
  }
}

/**
 * Dispara lembrete para Dono e Gerentes no Telegram caso o Fechamento Fiscal esteja atrasado (> 7 dias ou fim do mês).
 * Limita o envio a no máximo 1 vez a cada 24 horas.
 */
function verificarENotificarFechamentoFiscalAtrasado() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const shFiscal = obterAbaFechamentoFiscal(ss);
    let ultimoFechamento = null;

    if (shFiscal && shFiscal.getLastRow() > 1) {
      const val = shFiscal.getRange(shFiscal.getLastRow(), 5).getValue() || shFiscal.getRange(shFiscal.getLastRow(), 1).getValue();
      ultimoFechamento = converterParaDataValida(val);
    }

    const hoje = new Date();
    const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
    const diasRestantesMes = ultimoDiaMes - hoje.getDate();
    const isFimMes = (diasRestantesMes <= 3);

    let diasSemFechar = 999;
    if (ultimoFechamento) {
      diasSemFechar = Math.floor((hoje.getTime() - ultimoFechamento.getTime()) / (1000 * 60 * 60 * 24));
    }

    if (diasSemFechar > 7 || isFimMes) {
      const props = PropertiesService.getScriptProperties();
      const ultimoAviso = props.getProperty('TELEGRAM_ULTIMO_AVISO_FISCAL');
      const hojeDataStr = Utilities.formatDate(hoje, 'America/Sao_Paulo', 'yyyyMMdd');

      if (ultimoAviso !== hojeDataStr) {
        props.setProperty('TELEGRAM_ULTIMO_AVISO_FISCAL', hojeDataStr);

        const targetIds = (typeof obterChatIdsGerentesEDono === 'function') ? obterChatIdsGerentesEDono() : [];
        const motivo = diasSemFechar > 7 
          ? `O último fechamento fiscal foi realizado há ${diasSemFechar} dias.` 
          : `O mês corrente está se encerrando (restam apenas ${diasRestantesMes} dias).`;

        const msgFiscal = 
          `📑 <b>LEMBRETE GERENCIAL: FECHAMENTO FISCAL PENDENTE!</b>\n\n` +
          `🏢 <b>Depósito Karo$$</b>\n` +
          `📅 <b>Situação:</b> ${motivo}\n\n` +
          `⚠️ <b>Ação Necessária:</b> Dono ou Gerente deve acessar o <b>Painel Inteligente -> Fechamento Fiscal</b> para consolidar a escrituração do período.`;

        targetIds.forEach(cId => {
          if (typeof enviarMensagemTelegram === 'function') {
            enviarMensagemTelegram(msgFiscal, null, cId);
          }
        });
      }
    }
  } catch(e) {
    console.error('Erro em verificarENotificarFechamentoFiscalAtrasado:', e);
  }
}

// =========================================================================
// 🪙 MÓDULO FINANCEIRO: CONTAS A PAGAR & CONTAS A RECEBER (FIADOS)
// =========================================================================

/**
 * Retorna dados consolidados de Contas a Pagar e Contas a Receber para o Painel 360°
 */
function obterDadosFinanceiroObrigacoes360(token) {
  try {
    const caller = (typeof obterUsuarioPorToken === 'function') ? obterUsuarioPorToken(token) : null;
    const perfil = caller ? String(caller.perfil || '').toUpperCase() : '';
    if (perfil !== 'DONO' && perfil !== 'GERENTE' && perfil !== 'ADMIN' && caller && String(caller.login).toLowerCase() !== 'admin') {
      return { sucesso: false, erro: 'Acesso restrito ao Dono e Gerência.' };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // 1. Mapeia telefones dos clientes para WhatsApp
    const mapaClientesTel = {};
    const shClientes = ss.getSheetByName('CLIENTES');
    if (shClientes && shClientes.getLastRow() > 1) {
      const dCli = shClientes.getRange(2, 1, shClientes.getLastRow() - 1, Math.min(shClientes.getLastColumn(), 4)).getValues();
      dCli.forEach(r => {
        const nome = String(r[0] || '').trim();
        const tel = String(r[1] || '').trim();
        if (nome) mapaClientesTel[nome.toLowerCase()] = tel;
      });
    }

    // 2. Processa CONTAS_A_PAGAR
    const contasPagar = [];
    let pagTotalPendente = 0;
    let pagTotalVencido = 0;
    let pagTotalHoje = 0;
    let pagTotalPago = 0;
    let pagQtdVencidas = 0;
    let pagQtdHoje = 0;
    let pagQtdPendentes = 0;

    const shCP = ss.getSheetByName('CONTAS_A_PAGAR');
    if (shCP && shCP.getLastRow() > 1) {
      const dCP = shCP.getRange(2, 1, shCP.getLastRow() - 1, Math.min(shCP.getLastColumn(), 7)).getValues();
      dCP.forEach((r, idx) => {
        const id = String(r[0] || ('CP-' + (idx + 1))).trim();
        const fornecedor = String(r[1] || 'Fornecedor').trim();
        const valor = Number(r[2]) || 0;
        const forma = String(r[3] || 'Boleto').trim();
        const rawVenc = r[4];
        const statusRaw = String(r[5] || '').toUpperCase().trim();
        const rawPago = r[6];

        const isPago = (statusRaw === 'PAGO' || statusRaw === 'QUITADO' || (rawPago && String(rawPago).trim() !== ''));
        const dtVenc = rawVenc ? new Date(rawVenc) : null;
        let vencStr = '';
        let vencFormatado = '-';
        let situacao = 'NO_PRAZO'; // VENCIDA, VENCE_HOJE, NO_PRAZO, PAGO
        let diasDiff = 0;

        if (dtVenc && !isNaN(dtVenc.getTime())) {
          vencStr = Utilities.formatDate(dtVenc, 'America/Bahia', 'yyyy-MM-dd');
          vencFormatado = Utilities.formatDate(dtVenc, 'America/Bahia', 'dd/MM/yyyy');
          const dtVencZero = new Date(dtVenc);
          dtVencZero.setHours(0, 0, 0, 0);
          diasDiff = Math.round((dtVencZero.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

          if (!isPago) {
            if (diasDiff < 0) {
              situacao = 'VENCIDA';
              pagQtdVencidas++;
              pagTotalVencido += valor;
            } else if (diasDiff === 0) {
              situacao = 'VENCE_HOJE';
              pagQtdHoje++;
              pagTotalHoje += valor;
            } else {
              situacao = 'NO_PRAZO';
            }
          }
        }

        if (isPago) {
          pagTotalPago += valor;
        } else {
          pagQtdPendentes++;
          pagTotalPendente += valor;
        }

        contasPagar.push({
          linha: idx + 2,
          id: id,
          fornecedor: fornecedor,
          valor: valor,
          forma: forma,
          vencimento: vencStr,
          vencimentoFormatado: vencFormatado,
          isPago: isPago,
          status: isPago ? 'PAGO' : 'PENDENTE',
          situacao: isPago ? 'PAGO' : situacao,
          diasDiff: diasDiff,
          dataPagamento: rawPago ? String(rawPago) : ''
        });
      });
    }

    // Ordenação: Vencidas primeiro, depois Hoje, depois No Prazo, Pagas no fim
    contasPagar.sort((a, b) => {
      if (a.isPago !== b.isPago) return a.isPago ? 1 : -1;
      return a.diasDiff - b.diasDiff;
    });

    // 3. Processa CONTAS_A_RECEBER (Fiados)
    const contasReceber = [];
    let recTotalAberto = 0;
    let recTotalRecebido = 0;
    let recQtdPendentes = 0;
    const devedoresUnicos = new Set();

    const shCR = ss.getSheetByName('CONTAS_A_RECEBER');
    if (shCR && shCR.getLastRow() > 1) {
      const dCR = shCR.getRange(2, 1, shCR.getLastRow() - 1, Math.min(shCR.getLastColumn(), 10)).getValues();
      dCR.forEach((r, idx) => {
        const id = String(r[0] || ('CR-' + (idx + 1))).trim();
        const origem = String(r[1] || 'BALCAO').trim();
        const idVenda = String(r[2] || '').trim();
        const cliente = String(r[3] || 'Consumidor').trim();
        const valorTotal = Number(r[4]) || 0;
        const valorRecebido = Number(r[5]) || 0;
        const saldo = Number(r[6]) || Math.max(0, valorTotal - valorRecebido);
        const forma = String(r[7] || 'FIADO').trim();
        const statusRaw = String(r[8] || '').toUpperCase().trim();
        const rawData = r[9] || r[1];

        const isQuitado = (statusRaw === 'QUITADO' || saldo <= 0.001);
        let dataFormatada = '-';
        if (rawData instanceof Date && !isNaN(rawData.getTime())) {
          dataFormatada = Utilities.formatDate(rawData, 'America/Bahia', 'dd/MM/yyyy HH:mm');
        } else if (rawData) {
          dataFormatada = String(rawData);
        }

        if (!isQuitado) {
          recTotalAberto += saldo;
          recQtdPendentes++;
          devedoresUnicos.add(cliente.toLowerCase());
        }
        recTotalRecebido += valorRecebido;

        const tel = mapaClientesTel[cliente.toLowerCase()] || '';

        contasReceber.push({
          linha: idx + 2,
          id: id,
          origem: origem,
          idVenda: idVenda,
          cliente: cliente,
          telefone: tel,
          valorTotal: valorTotal,
          valorRecebido: valorRecebido,
          saldo: saldo,
          forma: forma,
          status: isQuitado ? 'QUITADO' : (valorRecebido > 0 ? 'PARCIAL' : 'PENDENTE'),
          isQuitado: isQuitado,
          dataRegistro: dataFormatada
        });
      });
    }

    // Ordenação: Maiores saldos primeiro, Quitados no fim
    contasReceber.sort((a, b) => {
      if (a.isQuitado !== b.isQuitado) return a.isQuitado ? 1 : -1;
      return b.saldo - a.saldo;
    });

    const configs = (typeof obterMapaConfiguracoes === 'function') ? obterMapaConfiguracoes() : {};

    return {
      sucesso: true,
      timestamp: Utilities.formatDate(new Date(), 'America/Bahia', 'dd/MM/yyyy HH:mm:ss'),
      kpisPagar: {
        totalPendente: pagTotalPendente,
        totalVencido: pagTotalVencido,
        totalHoje: pagTotalHoje,
        totalPago: pagTotalPago,
        qtdPendentes: pagQtdPendentes,
        qtdVencidas: pagQtdVencidas,
        qtdHoje: pagQtdHoje
      },
      contasPagar: contasPagar,
      kpisReceber: {
        totalAberto: recTotalAberto,
        totalRecebido: recTotalRecebido,
        qtdPendentes: recQtdPendentes,
        qtdDevedores: devedoresUnicos.size
      },
      contasReceber: contasReceber,
      loja: {
        nome: configs.nome || 'Depósito',
        chavePix: configs.chave_pix || '',
        telefone: configs.telefone || ''
      }
    };
  } catch(err) {
    console.error('Erro em obterDadosFinanceiroObrigacoes360:', err);
    return { sucesso: false, erro: err.message };
  }
}

/**
 * Dá baixa e liquida uma conta a pagar, registrando a saída no Caixa
 */
function pagarContaPagar360(token, idConta, formaPgto) {
  try {
    const caller = (typeof obterUsuarioPorToken === 'function') ? obterUsuarioPorToken(token) : null;
    const perfil = caller ? String(caller.perfil || '').toUpperCase() : '';
    if (perfil !== 'DONO' && perfil !== 'GERENTE' && perfil !== 'ADMIN' && caller && String(caller.login).toLowerCase() !== 'admin') {
      return { sucesso: false, erro: 'Apenas Dono e Gerência podem liquidar contas a pagar.' };
    }

    if (!idConta) return { sucesso: false, erro: 'ID da conta não informado.' };
    formaPgto = formaPgto || 'Dinheiro';

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName('CONTAS_A_PAGAR');
    if (!sh || sh.getLastRow() < 2) return { sucesso: false, erro: 'Aba CONTAS_A_PAGAR vazia ou inexistente.' };

    const dados = sh.getDataRange().getValues();
    let linhaEncontrada = -1;
    let fornecedor = '';
    let valor = 0;

    for (let i = 1; i < dados.length; i++) {
      if (String(dados[i][0] || '').trim() === String(idConta).trim()) {
        linhaEncontrada = i + 1;
        fornecedor = String(dados[i][1] || 'Fornecedor').trim();
        valor = Number(dados[i][2]) || 0;
        const st = String(dados[i][5] || '').toUpperCase().trim();
        if (st === 'PAGO' || st === 'QUITADO') {
          return { sucesso: false, erro: 'Esta conta já foi liquidada anteriormente.' };
        }
        break;
      }
    }

    if (linhaEncontrada === -1) {
      return { sucesso: false, erro: 'Conta ' + idConta + ' não encontrada na planilha.' };
    }

    const agora = new Date();
    sh.getRange(linhaEncontrada, 6).setValue('PAGO');
    sh.getRange(linhaEncontrada, 7)
      .setValue(agora)
      .setNumberFormat('dd/MM/yyyy HH:mm:ss');

    // Registra Saída no Caixa
    if (typeof registrarCaixa === 'function') {
      registrarCaixa(agora, 'Saida', valor, formaPgto, 'CONTA_A_PAGAR', 'PAGAMENTO ' + fornecedor + ' (' + idConta + ')');
    } else {
      const shCaixa = ss.getSheetByName('CAIXA');
      if (shCaixa) {
        if (typeof inserirLinhaPadronizadaNoTopo === 'function') {
          inserirLinhaPadronizadaNoTopo(shCaixa, [agora, 'Saida', valor, formaPgto, 'CONTA_A_PAGAR', 'PAGAMENTO ' + fornecedor + ' (' + idConta + ')']);
        } else {
          shCaixa.appendRow([agora, 'Saida', valor, formaPgto, 'CONTA_A_PAGAR', 'PAGAMENTO ' + fornecedor + ' (' + idConta + ')']);
        }
      }
    }

    if (typeof registrarLog === 'function') {
      registrarLog('PAGAMENTO_CONTA', fornecedor, 'PENDENTE', 'PAGO - R$ ' + valor.toFixed(2));
    }

    return { sucesso: true, msg: 'Conta paga com sucesso e saída registrada no Caixa!' };
  } catch(err) {
    console.error('Erro em pagarContaPagar360:', err);
    return { sucesso: false, erro: err.message };
  }
}

/**
 * Cadastra uma nova conta a pagar (fixa ou avulsa) pelo Painel 360°
 */
function cadastrarContaPagar360(token, dados) {
  try {
    const caller = (typeof obterUsuarioPorToken === 'function') ? obterUsuarioPorToken(token) : null;
    const perfil = caller ? String(caller.perfil || '').toUpperCase() : '';
    if (perfil !== 'DONO' && perfil !== 'GERENTE' && perfil !== 'ADMIN' && caller && String(caller.login).toLowerCase() !== 'admin') {
      return { sucesso: false, erro: 'Apenas Dono e Gerência podem cadastrar contas a pagar.' };
    }

    if (!dados || !dados.fornecedor || !dados.fornecedor.trim()) {
      return { sucesso: false, erro: 'Informe o fornecedor ou descrição da conta.' };
    }
    const valor = Number(dados.valor);
    if (isNaN(valor) || valor <= 0) {
      return { sucesso: false, erro: 'Informe um valor válido maior que zero.' };
    }
    if (!dados.vencimento) {
      return { sucesso: false, erro: 'Informe a data de vencimento da conta.' };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName('CONTAS_A_PAGAR');
    if (!sh) {
      if (typeof garantirContasAPagar === 'function') {
        sh = garantirContasAPagar();
      } else {
        sh = ss.insertSheet('CONTAS_A_PAGAR');
        sh.appendRow(['ID_COMPRA', 'Fornecedor', 'Valor', 'FormaPgto', 'Data', 'Status', 'Data_Pagamento']);
      }
    }

    const plan = sh.getDataRange().getValues();
    let proximo = 1;
    for (let i = 1; i < plan.length; i++) {
      const id = String(plan[i][0] || '');
      if (id.startsWith('AVULSA_')) {
        const n = Number(id.replace('AVULSA_', ''));
        if (!isNaN(n) && n >= proximo) proximo = n + 1;
      }
    }

    const tipo = String(dados.tipo || 'AVULSA').toUpperCase();
    const idFinal = tipo === 'FIXA'
      ? `FIXA_${dados.fornecedor.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`
      : `AVULSA_${String(proximo).padStart(4, '0')}`;

    const dtVenc = new Date(dados.vencimento + 'T00:00:00');
    const forma = dados.forma || 'Boleto';

    if (typeof inserirLinhaPadronizadaNoTopo === 'function') {
      inserirLinhaPadronizadaNoTopo(sh, [
        idFinal,
        dados.fornecedor.trim(),
        valor,
        forma,
        dtVenc,
        'PENDENTE',
        ''
      ]);
    } else {
      sh.appendRow([
        idFinal,
        dados.fornecedor.trim(),
        valor,
        forma,
        dtVenc,
        'PENDENTE',
        ''
      ]);
    }

    const linha = (typeof inserirLinhaPadronizadaNoTopo === 'function') ? 2 : sh.getLastRow();
    sh.getRange(linha, 3).setNumberFormat('R$ #,##0.00');
    sh.getRange(linha, 5).setNumberFormat('dd/MM/yyyy');
    sh.getRange(linha, 6).setHorizontalAlignment('center');

    if (typeof registrarLog === 'function') {
      registrarLog('CONTA_A_PAGAR', 'Cadastrada pelo Painel 360', idFinal, dados);
    }

    return { sucesso: true, msg: 'Conta a pagar cadastrada com sucesso!' };
  } catch(err) {
    console.error('Erro em cadastrarContaPagar360:', err);
    return { sucesso: false, erro: err.message };
  }
}

/**
 * Dá baixa total ou parcial em um fiado (Contas a Receber) com entrada imediata no Caixa
 */
function receberFiadoCliente360(token, idFiado, valorRecebido, formaPgto) {
  try {
    const caller = (typeof obterUsuarioPorToken === 'function') ? obterUsuarioPorToken(token) : null;
    const perfil = caller ? String(caller.perfil || '').toUpperCase() : '';
    if (perfil !== 'DONO' && perfil !== 'GERENTE' && perfil !== 'ADMIN' && caller && String(caller.login).toLowerCase() !== 'admin') {
      return { sucesso: false, erro: 'Apenas Dono e Gerência podem registrar recebimento de fiado.' };
    }

    if (!idFiado) return { sucesso: false, erro: 'ID do fiado não informado.' };
    const valor = Number(valorRecebido);
    if (isNaN(valor) || valor <= 0) return { sucesso: false, erro: 'Informe um valor de recebimento válido.' };
    formaPgto = formaPgto || 'Dinheiro';

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName('CONTAS_A_RECEBER');
    if (!sh || sh.getLastRow() < 2) return { sucesso: false, erro: 'Aba CONTAS_A_RECEBER vazia ou inexistente.' };

    const dados = sh.getDataRange().getValues();
    let linhaEncontrada = -1;
    let cliente = '';
    let valorTotal = 0;
    let jaRecebido = 0;
    let saldoAtual = 0;

    for (let i = 1; i < dados.length; i++) {
      if (String(dados[i][0] || '').trim() === String(idFiado).trim()) {
        linhaEncontrada = i + 1;
        cliente = String(dados[i][3] || 'Cliente').trim();
        valorTotal = Number(dados[i][4]) || 0;
        jaRecebido = Number(dados[i][5]) || 0;
        saldoAtual = Number(dados[i][6]) || Math.max(0, valorTotal - jaRecebido);
        break;
      }
    }

    if (linhaEncontrada === -1) {
      return { sucesso: false, erro: 'Fiado ' + idFiado + ' não encontrado na planilha.' };
    }

    if (valor > (saldoAtual + 0.01)) {
      return { sucesso: false, erro: `Valor informado (R$ ${valor.toFixed(2)}) é maior que o saldo devedor (R$ ${saldoAtual.toFixed(2)}).` };
    }

    const novoRecebido = jaRecebido + valor;
    const novoSaldo = Math.max(0, valorTotal - novoRecebido);
    const novoStatus = (novoSaldo <= 0.001) ? 'QUITADO' : 'PARCIAL';

    sh.getRange(linhaEncontrada, 6).setValue(novoRecebido);
    sh.getRange(linhaEncontrada, 7).setValue(novoSaldo);
    sh.getRange(linhaEncontrada, 9).setValue(novoStatus);

    // Registra Entrada no Caixa
    const agora = new Date();
    if (typeof registrarCaixa === 'function') {
      registrarCaixa(agora, 'Entrada', valor, formaPgto, 'CONTAS_A_RECEBER', 'RECEBIMENTO FIADO ' + cliente + ' (' + idFiado + ')');
    } else {
      const shCaixa = ss.getSheetByName('CAIXA');
      if (shCaixa) {
        if (typeof inserirLinhaPadronizadaNoTopo === 'function') {
          inserirLinhaPadronizadaNoTopo(shCaixa, [agora, 'Entrada', valor, formaPgto, 'CONTAS_A_RECEBER', 'RECEBIMENTO FIADO ' + cliente + ' (' + idFiado + ')']);
        } else {
          shCaixa.appendRow([agora, 'Entrada', valor, formaPgto, 'CONTAS_A_RECEBER', 'RECEBIMENTO FIADO ' + cliente + ' (' + idFiado + ')']);
        }
      }
    }

    if (typeof registrarLog === 'function') {
      registrarLog('RECEBIMENTO_FIADO', idFiado, saldoAtual, novoSaldo);
    }

    return {
      sucesso: true,
      msg: (novoSaldo <= 0.001)
        ? `Fiado de ${cliente} quitado com sucesso! Entrada de R$ ${valor.toFixed(2)} lançada no Caixa.`
        : `Recebimento de R$ ${valor.toFixed(2)} registrado! Saldo restante de ${cliente}: R$ ${novoSaldo.toFixed(2)}.`
    };
  } catch(err) {
    console.error('Erro em receberFiadoCliente360:', err);
    return { sucesso: false, erro: err.message };
  }
}

/**
 * Endpoint para sincronizar pasta raiz e arquivos da empresa a partir do Painel 360
 */
function sincronizarPastaRaizEmpresa360(token) {
  const auth = validarSessaoOuErro(token);
  if (!auth.ok) return { sucesso: false, erro: auth.erro };
  try {
    if (typeof sincronizarArquivosEPastaRaizEmpresa === 'function') {
      const res = sincronizarArquivosEPastaRaizEmpresa();
      return { sucesso: true, dados: res };
    }
    return { sucesso: false, erro: 'Função de sincronização não carregada.' };
  } catch(e) {
    console.error('Erro em sincronizarPastaRaizEmpresa360:', e);
    return { sucesso: false, erro: e.message };
  }
}
