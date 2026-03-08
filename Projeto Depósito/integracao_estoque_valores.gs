/**
 * =====================================================
 * 🔧 INTEGRAÇÃO - GESTÃO DE ESTOQUE COM VALORES
 * =====================================================
 * Exemplos de integração com o menu e dashboards
 * 
 * Data: 2026-02
 * =====================================================
 */
// =====================================================
// 📊 DASHBOARDS E PAINÉIS
// =====================================================

  /**
   * Painel Gestão (resumo executivo em sidebar)
   */
    function abrirPainelGestaoEstoque() {
      try {
        const relatorio = _ievGerarRelatorioEstoqueComValoresSafe();

        if (!relatorio || !relatorio.resumo) {
          uiNotificar('Falha ao gerar relatório de estoque.','erro','Painel Gestão');
          return;
        }

        const resumo = relatorio.resumo;
        const itens = Array.isArray(relatorio.itens) ? relatorio.itens : [];
        const criticos = itens.filter(item => String(item.status || '').includes('Crítico'));

        let html = '<div style="font-family:Arial;padding:16px;max-width:380px;">';
        html += '<h2>📦 Gestão de Estoque</h2>';
        html += `<p><strong>Valor Total:</strong> R$ ${Number(resumo.totalValorEstoque || 0).toFixed(2)}</p>`;
        html += `<p><strong>Lucro Potencial:</strong> R$ ${Number(resumo.lucroEstoque || 0).toFixed(2)}</p>`;
        html += `<p><strong>Margem Média:</strong> ${Number(resumo.margemMedia || 0).toFixed(2)}%</p>`;

        if (criticos.length) {
          html += '<h4>Produtos Críticos:</h4><ul>';
          criticos.slice(0, 10).forEach(item => {
            html += `<li>${item.produto} (${item.qtdAtual})</li>`;
          });
          html += '</ul>';
        }

        if (typeof getConfig === 'function') {
          const driveUrl = getConfig('DRIVE_URL');
          if (driveUrl) {
            html += `<p><a href="${driveUrl}" target="_blank">🔗 Abrir Drive</a></p>`;
          }
        }

        html += '</div>';

        const output = HtmlService
          .createHtmlOutput(html)
          .setTitle('Painel Gestão Estoque')
          .setWidth(400);

        SpreadsheetApp.getUi().showSidebar(output);
      } catch (e) {
        console.error('Erro em abrirPainelGestaoEstoque:', e);
        uiNotificar('Erro ao abrir painel de gestão: ' + e.message,'erro','Painel Gestão');
      }
    }
    function abrirPainelGestaoEstoque() {
      try {
        const relatorio = gerarRelatorioEstoqueComValores();

        if (!relatorio || !relatorio.resumo) {
          SpreadsheetApp.getUi().alert('❌ Falha ao gerar relatório de estoque.');
          return;
        }

        const resumo = relatorio.resumo;
        const itens = Array.isArray(relatorio.itens) ? relatorio.itens : [];
        const criticos = itens.filter(item => String(item.status || '').includes('Crítico'));

        let html = '<div style="font-family:Arial;padding:16px;max-width:380px;">';
        html += '<h2>📦 Gestão de Estoque</h2>';
        html += `<p><strong>Valor Total:</strong> R$ ${Number(resumo.totalValorEstoque || 0).toFixed(2)}</p>`;
        html += `<p><strong>Lucro Potencial:</strong> R$ ${Number(resumo.lucroEstoque || 0).toFixed(2)}</p>`;
        html += `<p><strong>Margem Média:</strong> ${Number(resumo.margemMedia || 0).toFixed(2)}%</p>`;

        if (criticos.length) {
          html += '<h4>Produtos Críticos:</h4><ul>';
          criticos.slice(0, 10).forEach(item => {
            html += `<li>${item.produto} (${item.qtdAtual})</li>`;
          });
          html += '</ul>';
        }

        if (typeof getConfig === 'function') {
          const driveUrl = getConfig('DRIVE_URL');
          if (driveUrl) {
            html += `<p><a href="${driveUrl}" target="_blank">🔗 Abrir Drive</a></p>`;
          }
        }

        html += '</div>';

        const output = HtmlService
          .createHtmlOutput(html)
          .setTitle('Painel Gestão Estoque')
          .setWidth(400);

        SpreadsheetApp.getUi().showSidebar(output);
      } catch (e) {
        console.error('Erro em abrirPainelGestaoEstoque:', e);
        SpreadsheetApp.getUi().alert('❌ Erro ao abrir painel de gestão: ' + e.message);
      }
    }

  /**
   * Dashboard: Análise de Rentabilidade
   */
    function abrirAnalisRentabilidade() {
      try {
        const analise = _ievAnalisarRentabilidadeEstoqueSafe();
        
        if (!analise) {
          uiNotificar('Erro ao gerar análise','erro','Rentabilidade');
          return;
        }
        
        const ss = SpreadsheetApp.getActive();
        let sh = ss.getSheetByName('ANALISE_RENTABILIDADE');
        
        if (!sh) {
          sh = ss.insertSheet('ANALISE_RENTABILIDADE');
        }
        
        sh.clear();
        
        // ========== MAIS RENTÁVEIS ==========
        sh.getRange('A1:B1').merge()
          .setValue('🏆 PRODUTOS MAIS RENTÁVEIS')
          .setFontWeight('bold')
          .setBackground('#dcfce7')
          .setFontSize(12);
        
        let row = 2;
        analise.maisRentaveis.slice(0, 10).forEach((item, idx) => {
          sh.getRange(row, 1).setValue(`${idx + 1}. ${item.produto}`);
          sh.getRange(row, 2).setValue(item.lucro);
          sh.getRange(row, 2).setNumberFormat('R$ #,##0.00');
          row++;
        });
        
        // ========== ESTOQUE CRÍTICO ==========
        row = 2;
        const colStart = 4;
        sh.getRange(row - 1, colStart, 1, 2).merge()
          .setValue('🚨 ESTOQUE CRÍTICO')
          .setFontWeight('bold')
          .setBackground('#fee2e2')
          .setFontSize(12);
        
        analise.estoqueCritico.forEach((item, idx) => {
          sh.getRange(row, colStart).setValue(`${idx + 1}. ${item.produto}`);
          sh.getRange(row, colStart + 1).setValue(item.quantidade);
          row++;
        });
        
        // ========== ALTA ROTAÇÃO ==========
        row = 2;
        const colStart2 = 7;
        sh.getRange(row - 1, colStart2, 1, 2).merge()
          .setValue('📈 ALTA ROTAÇÃO (>70%)')
          .setFontWeight('bold')
          .setBackground('#dbeafe')
          .setFontSize(12);
        
        analise.altaRotacao.forEach((item, idx) => {
          sh.getRange(row, colStart2).setValue(`${idx + 1}. ${item.produto}`);
          sh.getRange(row, colStart2 + 1).setValue(item.taxaRotacao + '%');
          row++;
        });
        
        sh.setColumnWidths(1, 8, 150);
        uiNotificar('Análise de rentabilidade atualizada!','sucesso','Rentabilidade');
        
      } catch (e) {
        console.error('Erro em abrirAnalisRentabilidade:', e);
        uiNotificar('Erro: ' + e.message,'erro','Estoque');
      }
    }

  /**
   * Dashboard: Valor por Categoria
   */
    function exibirValorCategoria() {
      try {
        const porCategoria = _ievObterValorEstoquesPorCategoriaSafe();
        
        const ss = SpreadsheetApp.getActive();
        let sh = ss.getSheetByName('ESTOQUE_CATEGORIAS');
        
        if (!sh) {
          sh = ss.insertSheet('ESTOQUE_CATEGORIAS');
        }
        
        sh.clear();
        
        // Cabeçalho
        const headers = ['Categoria', 'Quantidade', 'Valor Estoque', 'Valor Custo', 'Lucro Potencial', 'Margem %'];
        sh.getRange(1, 1, 1, headers.length)
          .setValues([headers])
          .setFontWeight('bold')
          .setBackground('#020617')
          .setFontColor('#ffffff')
          .setHorizontalAlignment('center');
        
        let row = 2;
        let totalQtd = 0;
        let totalValor = 0;
        let totalCusto = 0;
        
        Object.entries(porCategoria).forEach(([categoria, dados]) => {
          const lucro = dados.valor - dados.custo;
          const margem = dados.valor > 0 ? ((lucro / dados.valor) * 100) : 0;
          
          sh.getRange(row, 1).setValue(categoria);
          sh.getRange(row, 2).setValue(dados.quantidade);
          sh.getRange(row, 3).setValue(dados.valor);
          sh.getRange(row, 4).setValue(dados.custo);
          sh.getRange(row, 5).setValue(lucro);
          sh.getRange(row, 6).setValue(margem);
          
          // Formatação
          sh.getRange(row, 3).setNumberFormat('R$ #,##0.00');
          sh.getRange(row, 4).setNumberFormat('R$ #,##0.00');
          sh.getRange(row, 5).setNumberFormat('R$ #,##0.00');
          sh.getRange(row, 6).setNumberFormat('0.00"%"');
          
          // Cores
          if (lucro < 0) {
            sh.getRange(row, 5).setFontColor('#dc2626');
          } else if (lucro > 0) {
            sh.getRange(row, 5).setFontColor('#16a34a');
          }
          
          totalQtd += dados.quantidade;
          totalValor += dados.valor;
          totalCusto += dados.custo;
          
          row++;
        });
        
        // Totais
        row++;
        sh.getRange(row, 1).setValue('TOTAL')
          .setFontWeight('bold');
        sh.getRange(row, 2).setValue(totalQtd)
          .setFontWeight('bold');
        sh.getRange(row, 3).setValue(totalValor)
          .setNumberFormat('R$ #,##0.00')
          .setFontWeight('bold');
        sh.getRange(row, 4).setValue(totalCusto)
          .setNumberFormat('R$ #,##0.00')
          .setFontWeight('bold');
        
        const lucroTotal = totalValor - totalCusto;
        sh.getRange(row, 5).setValue(lucroTotal)
          .setNumberFormat('R$ #,##0.00')
          .setFontWeight('bold');
        
        if (lucroTotal > 0) {
          sh.getRange(row, 5).setFontColor('#16a34a');
        }
        
        sh.setColumnWidths(1, headers.length, 150);
        uiNotificar('Tabela de categorias atualizada!','sucesso','Categorias');
        
      } catch (e) {
        console.error('Erro em exibirValorCategoria:', e);
        uiNotificar('Erro: ' + e.message,'erro','Estoque');
      }
    }

  /**
   * Exibir Valor Total do Estoque
   */
    function exibirValorTotalEstoque() {
      try {
        const valor = _ievObterValorTotalEstoqueSafe();
        const estoque = _ievObterDadosEstoqueSafe();
        const produtos = _ievObterDadosProdutosSafe();
        
        let custTotal = 0;
        estoque.forEach(linha => {
          const nomeProduto = linha[0].toString().trim();
          const quantidade = Number(linha[1]) || 0;
          const produto = produtos[nomeProduto];
          
          if (produto) {
            custTotal += quantidade * produto.custMedio;
          }
        });
        
        const lucro = valor - custTotal;
        
        const mensagem = 
          `💰 VALOR TOTAL DO ESTOQUE\n\n` +
          `📦 Quantidade de Produtos: ${estoque.length}\n` +
          `📊 Valor Total (Preço Venda): R$ ${valor.toFixed(2)}\n` +
          `💸 Valor Total (Custo): R$ ${custTotal.toFixed(2)}\n` +
          `💹 Lucro Potencial: R$ ${lucro.toFixed(2)}\n` +
          `📈 Margem: ${((lucro / valor) * 100).toFixed(2)}%`;
        
        uiNotificar(mensagem,'info','Valor Total do Estoque');
        
      } catch (e) {
        console.error('Erro em exibirValorTotalEstoque:', e);
        uiNotificar('Erro: ' + e.message,'erro','Estoque');
      }
    }

  /**
   * 📱 WIDGETS PARA HOME
   */

  /**
   * Atualizar widget com valor total do estoque na HOME
   */
    function atualizarWidgetValorEstoque() {
      try {
        const ss = SpreadsheetApp.getActive();
        const sh = ss.getSheetByName('HOME');
        
        if (!sh) return;
        
        const valor = _ievObterValorTotalEstoqueSafe();
        
        // Encontrar célula com "Valor Estoque" e atualizar
        const dados = sh.getDataRange().getValues();
        
        // Você pode customizar a célula aqui
        sh.getRange('A1').setValue(`💰 Valor Total Estoque: R$ ${valor.toFixed(2)}`);
        
      } catch (e) {
        console.error('Erro em atualizarWidgetValorEstoque:', e);
      }
    }

  /**
   * 🔔 ALERTAS AUTOMÁTICOS
   */

  /**
   * Verificar e alertar sobre produtos em estoque crítico
   */
    function verificarEstoqueCriticoAuto() {
      try {
        const analise = _ievAnalisarRentabilidadeEstoqueSafe();
        
        if (!analise || analise.estoqueCritico.length === 0) {
          return;
        }
        
        const relatorio = _ievGerarRelatorioEstoqueComValoresSafe();
        
        const criticos = relatorio.itens.filter(item => 
          item.status.includes('Crítico')
        );
        
        if (criticos.length > 0) {
          const lista = criticos
            .map(p => `- ${p.produto} (${p.qtdAtual} unidades - R$ ${p.valorTotalEstoque.toFixed(2)})`)
            .join('\n');
          
          const mensagem = 
            `🚨 ALERTA: PRODUTOS EM ESTOQUE CRÍTICO\n\n` +
            lista + `\n\n` +
            `Valor total comprometido: R$ ${
              criticos.reduce((s, p) => s + p.valorTotalEstoque, 0).toFixed(2)
            }`;
          
          console.warn(mensagem);
          
          // Você pode enviar email aqui
          // MailApp.sendEmail('gerente@email.com', '🚨 Alerta Estoque Crítico', mensagem);
        }
        
      } catch (e) {
        console.error('Erro em verificarEstoqueCriticoAuto:', e);
      }
    }

  /**
   * 🔄 MONITORAMENTO AUTOMÁTICO (usar com triggers)
   */

  /**
   * Monitorar estoque a cada hora
   */
    function setupMonitoramentoEstoque() {
      // Remove triggers antigos
      const triggers = ScriptApp.getProjectTriggers();
      triggers.forEach(t => {
        if (t.getHandlerFunction() === 'monitorarEstoqueAuto') {
          ScriptApp.deleteTrigger(t);
        }
      });
      
      // Cria novo trigger
      ScriptApp.newTrigger('monitorarEstoqueAuto')
        .timeBased()
        .everyHours(1)
        .create();
      
      uiNotificar('Monitoramento ativado!','sucesso','Monitoramento');
    }

  /**
   * Função de monitoramento automático
   */
    function monitorarEstoqueAuto() {
      try {
        // Atualiza relatório
        _ievGerarRelatorioEstoqueComValoresSafe();
        
        // Verifica críticos
        verificarEstoqueCriticoAuto();
        
        // Atualiza widget na HOME
        atualizarWidgetValorEstoque();
        
        console.log('Monitoramento de estoque realizado com sucesso');
        
      } catch (e) {
        console.error('Erro no monitoramento automático:', e);
      }
    }

  /**
   * 📥 EXPORTAR DADOS
   */

  /**
   * Exportar análise completa em CSV
   */
    function exportarAnaliseEstoqueCSV() {
      try {
        const relatorio = _ievGerarRelatorioEstoqueComValoresSafe();
        
        if (!relatorio) return;
        
        let csv = 'Produto,Categoria,Preço,Custo,Margem %,Qtd Estoque,Valor Estoque,Lucro Estoque,Qtd Vendida,Taxa Rotação\n';
        
        relatorio.itens.forEach(item => {
          csv += `"${item.produto}","${item.categoria}",${item.precoVenda},${item.custMedio},${item.margem},${item.qtdAtual},${item.valorTotalEstoque},${item.lucroEstoque},${item.qtdVendida},${item.taxaRotacao}\n`;
        });
        
        console.log(csv);
        uiNotificar('CSV gerado (veja console)','sucesso','Exportação');
        
      } catch (e) {
        console.error('Erro ao exportar CSV:', e);
      }
    }

  /**
   * 🎯 RELATÓRIO EXECUTIVO
   */

  /**
   * Gerar relatório executivo simples
   */
    function gerarRelatórioExecutivo() {
      try {
        const relatorio = _ievGerarRelatorioEstoqueComValoresSafe();
        const analise = _ievAnalisarRentabilidadeEstoqueSafe();
        
        if (!relatorio || !analise) return;
        
        const resumo = relatorio.resumo;
        
        const texto = 
          `╔══════════════════════════════════════════╗\n` +
          `║     RELATÓRIO EXECUTIVO DE ESTOQUE      ║\n` +
          `╚══════════════════════════════════════════╝\n\n` +
          
          `📊 SITUAÇÃO ATUAL\n` +
          `├─ Total Produtos: ${relatorio.itens.length}\n` +
          `├─ Valor Total: R$ ${resumo.totalValorEstoque.toFixed(2)}\n` +
          `├─ Custo Total: R$ ${resumo.totalCustoEstoque.toFixed(2)}\n` +
          `└─ Lucro Potencial: R$ ${resumo.lucroEstoque.toFixed(2)}\n\n` +
          
          `💰 HISTÓRICO DE VENDAS\n` +
          `├─ Total Vendido: R$ ${resumo.totalVendido.toFixed(2)}\n` +
          `├─ Lucro Realizado: R$ ${resumo.lucroVendido.toFixed(2)}\n` +
          `└─ Margem Média: ${resumo.margemMedia.toFixed(2)}%\n\n` +
          
          `🚨 ALERTAS\n` +
          `├─ Produtos Críticos: ${analise.estoqueCritico.length}\n` +
          `├─ Sem Vendas: ${analise.quaseNenhumavenda.length}\n` +
          `└─ Alta Rotação: ${analise.altaRotacao.length}\n\n` +
          
          `🏆 TOP 3 PRODUTOS\n` +
          analise.maisRentaveis.slice(0, 3).map((p, i) => 
            `${i + 1}. ${p.produto} (R$ ${p.lucro.toFixed(2)})`
          ).join('\n');
        
        console.log(texto);
        uiNotificar(texto,'info','Relatório Executivo');
        
      } catch (e) {
        console.error('Erro ao gerar relatório executivo:', e);
      }
    }

  /**
   * 📧 Enviar relatório por email (exemplo)
   */
    function enviarRelatorioEmail(destinatario) {
      try {
        _ievGerarRelatorioEstoqueComValoresSafe();
        
        if (!relatorio) return;
        
        const resumo = relatorio.resumo;
        
        const corpo = 
          `Relatório de Estoque com Valores\n\n` +
          `Valor Total do Estoque: R$ ${resumo.totalValorEstoque.toFixed(2)}\n` +
          `Lucro Potencial: R$ ${resumo.lucroEstoque.toFixed(2)}\n` +
          `Margem Média: ${resumo.margemMedia.toFixed(2)}%\n\n` +
          `Gerado em: ${new Date().toLocaleString('pt-BR')}`;
        
        // Descomente para usar:
        // MailApp.sendEmail(destinatario, '📊 Relatório de Estoque', corpo);
        
        console.log('Email preparado para envio (descomente código)');
        
      } catch (e) {
        console.error('Erro ao enviar email:', e);
      }
    }
// =====================================================
// SAFETY HELPERS 
// =====================================================

  function _ievObterDadosEstoqueSafe() {
    if (typeof obterDadosEstoque === 'function') return obterDadosEstoque();
    const sh = SpreadsheetApp.getActive().getSheetByName('ESTOQUE');
    if (!sh) return [];
    const dados = sh.getDataRange().getValues();
    if (dados.length <= 1) return [];
    return dados.slice(1).filter(linha => linha[0] && String(linha[0]).trim() !== '');
  }
  function _ievObterDadosProdutosSafe() {
    if (typeof obterDadosProdutos === 'function') return obterDadosProdutos();
    const sh = SpreadsheetApp.getActive().getSheetByName('PRODUTOS');
    if (!sh) return {};
    const dados = sh.getDataRange().getValues();
    if (dados.length <= 1) return {};

    const mapa = {};
    dados.slice(1).forEach(linha => {
      const produto = linha[0];
      if (!produto) return;
      mapa[String(produto).trim()] = {
        nome: produto,
        categoria: linha[1] || '',
        preco: Number(linha[4]) || 0,
        custMedio: Number(linha[6]) || 0,
        margem: Number(linha[7]) || 0,
        status: linha[9] || 'Normal'
      };
    });

    return mapa;
  }
  function _ievObterDadosVendasSafe() {
    if (typeof obterDadosVendas === 'function') return obterDadosVendas();
    const sh = SpreadsheetApp.getActive().getSheetByName('VENDAS');
    if (!sh) return [];
    const dados = sh.getDataRange().getValues();
    if (dados.length <= 1) return [];
    return dados.slice(1).filter(linha => linha[1] && String(linha[1]).trim() !== '');
  }
  function _ievObterValorTotalEstoqueSafe() {
    if (typeof obterValorTotalEstoque === 'function') return obterValorTotalEstoque();
    const estoque = _ievObterDadosEstoqueSafe();
    const produtos = _ievObterDadosProdutosSafe();

    let total = 0;
    estoque.forEach(linha => {
      const nome = String(linha[0] || '').trim();
      const qtd = Number(linha[1]) || 0;
      const p = produtos[nome] || {};
      total += qtd * (Number(p.preco) || 0);
    });

    return Number(total.toFixed(2));
  }
  function _ievObterValorEstoquesPorCategoriaSafe() {
    if (typeof obterValorEstoquesPorCategoria === 'function') return obterValorEstoquesPorCategoria();
    const estoque = _ievObterDadosEstoqueSafe();
    const produtos = _ievObterDadosProdutosSafe();
    const out = {};

    estoque.forEach(linha => {
      const nome = String(linha[0] || '').trim();
      const quantidade = Number(linha[1]) || 0;
      const produto = produtos[nome];
      if (!produto) return;

      const categoria = produto.categoria || 'Sem Categoria';
      if (!out[categoria]) {
        out[categoria] = { quantidade: 0, valor: 0, custo: 0 };
      }

      out[categoria].quantidade += quantidade;
      out[categoria].valor += quantidade * (Number(produto.preco) || 0);
      out[categoria].custo += quantidade * (Number(produto.custMedio) || 0);
    });

    return out;
  }
  function _ievGerarRelatorioEstoqueComValoresSafe() {
    if (typeof gerarRelatorioEstoqueComValores === 'function') return gerarRelatorioEstoqueComValores();

    const estoque = _ievObterDadosEstoqueSafe();
    const produtos = _ievObterDadosProdutosSafe();
    const vendas = _ievObterDadosVendasSafe();

    const relatorio = { itens: [], resumo: { totalValorEstoque: 0, totalCustoEstoque: 0, lucroEstoque: 0, totalVendido: 0, lucroVendido: 0, margemMedia: 0 } };

    estoque.forEach(linha => {
      const nomeProduto = String(linha[0] || '').trim();
      const qtdAtual = Number(linha[1]) || 0;
      const minimo = Number(linha[2]) || 0;
      const p = produtos[nomeProduto];
      if (!p) return;

      const precoVenda = Number(p.preco) || 0;
      const custMedio = Number(p.custMedio) || 0;
      const valorTotalEstoque = qtdAtual * precoVenda;
      const custoTotalEstoque = qtdAtual * custMedio;
      const lucroEstoque = valorTotalEstoque - custoTotalEstoque;

      let qtdVendida = 0;
      vendas.forEach(v => {
        const produtoVenda = v[1] ? String(v[1]).trim() : '';
        if (produtoVenda === nomeProduto) qtdVendida += Number(v[2]) || 0;
      });

      const valorVendido = qtdVendida * precoVenda;
      const lucroVendido = valorVendido - (qtdVendida * custMedio);
      const taxaRotacao = (qtdAtual + qtdVendida) > 0 ? Math.round((qtdVendida / (qtdAtual + qtdVendida)) * 10000) / 100 : 0;

      let status = 'Normal';
      if (qtdAtual <= minimo) status = '🚨 Crítico';
      else if (qtdAtual <= minimo * 1.5) status = '⚠️ Baixo';
      else if (qtdAtual > minimo * 3) status = '📈 Alto';

      relatorio.itens.push({
        produto: nomeProduto,
        categoria: p.categoria || '',
        precoVenda: precoVenda,
        custMedio: custMedio,
        margem: Number(p.margem) || 0,
        qtdAtual: qtdAtual,
        valorTotalEstoque: valorTotalEstoque,
        custTotalEstoque: custoTotalEstoque,
        lucroEstoque: lucroEstoque,
        qtdVendida: qtdVendida,
        valorVendido: valorVendido,
        lucroVendido: lucroVendido,
        taxaRotacao: taxaRotacao,
        status: status
      });

      relatorio.resumo.totalValorEstoque += valorTotalEstoque;
      relatorio.resumo.totalCustoEstoque += custoTotalEstoque;
      relatorio.resumo.totalVendido += valorVendido;
      relatorio.resumo.lucroVendido += lucroVendido;
    });

    relatorio.resumo.lucroEstoque = relatorio.resumo.totalValorEstoque - relatorio.resumo.totalCustoEstoque;
    const somaMargens = relatorio.itens.reduce((soma, item) => soma + (Number(item.margem) || 0), 0);
    relatorio.resumo.margemMedia = relatorio.itens.length ? Math.round((somaMargens / relatorio.itens.length) * 100) / 100 : 0;

    return relatorio;
  }
  function _ievAnalisarRentabilidadeEstoqueSafe() {
    if (typeof analisarRentabilidadeEstoque === 'function') return analisarRentabilidadeEstoque();

    const relatorio = _ievGerarRelatorioEstoqueComValoresSafe();
    if (!relatorio || !Array.isArray(relatorio.itens)) return null;

    const analise = {
      maisRentaveis: [],
      menosRentaveis: [],
      estoqueCritico: [],
      altaRotacao: [],
      quaseNenhumavenda: []
    };

    relatorio.itens.forEach(item => {
      analise.maisRentaveis.push({ produto: item.produto, lucro: item.lucroEstoque, margem: item.margem });

      if (String(item.status || '').includes('Crítico')) {
        analise.estoqueCritico.push({ produto: item.produto, quantidade: item.qtdAtual, valor: item.valorTotalEstoque });
      }

      if (Number(item.taxaRotacao) > 70) {
        analise.altaRotacao.push({ produto: item.produto, taxaRotacao: item.taxaRotacao });
      }

      if ((Number(item.qtdVendida) || 0) === 0 && (Number(item.qtdAtual) || 0) > 0) {
        analise.quaseNenhumavenda.push({ produto: item.produto, quantidade: item.qtdAtual, valor: item.valorTotalEstoque });
      }
    });

    analise.maisRentaveis.sort((a, b) => (Number(b.lucro) || 0) - (Number(a.lucro) || 0));
    analise.altaRotacao.sort((a, b) => (Number(b.taxaRotacao) || 0) - (Number(a.taxaRotacao) || 0));
    return analise;
  }
