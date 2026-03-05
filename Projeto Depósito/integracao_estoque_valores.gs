/**
 * =====================================================
 * 🔧 INTEGRAÇÃO - GESTÃO DE ESTOQUE COM VALORES
 * =====================================================
 * Exemplos de integração com o menu e dashboards
 * 
 * Data: 2026-02
 * =====================================================
 */

/**
 * 🎨 Adicionar no Menu onOpen() - Exemplo de integração
 * 
 * Substituir esta seção no onOpen():
 * 
 *   .addSubMenu(
 *     ui.createMenu('💰 Estoque com Valores')
 *       .addItem('📊 Relatório Completo', 'abrirPainelEstoqueValores')
 *       .addItem('📈 Análise de Rentabilidade', 'abrirAnalisRentabilidade')
 *       .addItem('🏷️ Valor por Categoria', 'exibirValorCategoria')
 *       .addItem('💹 Valor Total Estoque', 'exibirValorTotalEstoque')
 *   )
 */

/**
 * 📊 DASHBOARDS E PAINÉIS
 */

/**
 * Dashboard: Análise de Rentabilidade
 */
function abrirAnalisRentabilidade() {
  try {
    const analise = analisarRentabilidadeEstoque();
    
    if (!analise) {
      SpreadsheetApp.getUi().alert('❌ Erro ao gerar análise');
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
    SpreadsheetApp.getUi().alert('✅ Análise de rentabilidade atualizada!');
    
  } catch (e) {
    console.error('Erro em abrirAnalisRentabilidade:', e);
    SpreadsheetApp.getUi().alert('❌ Erro: ' + e.message);
  }
}

/**
 * Dashboard: Valor por Categoria
 */
function exibirValorCategoria() {
  try {
    const porCategoria = obterValorEstoquesPorCategoria();
    
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
    SpreadsheetApp.getUi().alert('✅ Tabela de categorias atualizada!');
    
  } catch (e) {
    console.error('Erro em exibirValorCategoria:', e);
    SpreadsheetApp.getUi().alert('❌ Erro: ' + e.message);
  }
}

/**
 * Exibir Valor Total do Estoque
 */
function exibirValorTotalEstoque() {
  try {
    const valor = obterValorTotalEstoque();
    const estoque = obterDadosEstoque();
    const produtos = obterDadosProdutos();
    
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
    
    SpreadsheetApp.getUi().alert(mensagem);
    
  } catch (e) {
    console.error('Erro em exibirValorTotalEstoque:', e);
    SpreadsheetApp.getUi().alert('❌ Erro: ' + e.message);
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
    
    const valor = obterValorTotalEstoque();
    
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
    const analise = analisarRentabilidadeEstoque();
    
    if (!analise || analise.estoqueCritico.length === 0) {
      return;
    }
    
    const relatorio = gerarRelatorioEstoqueComValores();
    
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
  
  SpreadsheetApp.getUi().alert('✅ Monitoramento ativado!');
}

/**
 * Função de monitoramento automático
 */
function monitorarEstoqueAuto() {
  try {
    // Atualiza relatório
    gerarRelatorioEstoqueComValores();
    
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
    const relatorio = gerarRelatorioEstoqueComValores();
    
    if (!relatorio) return;
    
    let csv = 'Produto,Categoria,Preço,Custo,Margem %,Qtd Estoque,Valor Estoque,Lucro Estoque,Qtd Vendida,Taxa Rotação\n';
    
    relatorio.itens.forEach(item => {
      csv += `"${item.produto}","${item.categoria}",${item.precoVenda},${item.custMedio},${item.margem},${item.qtdAtual},${item.valorTotalEstoque},${item.lucroEstoque},${item.qtdVendida},${item.taxaRotacao}\n`;
    });
    
    console.log(csv);
    SpreadsheetApp.getUi().alert('✅ CSV gerado (veja console)');
    
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
    const relatorio = gerarRelatorioEstoqueComValores();
    const analise = analisarRentabilidadeEstoque();
    
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
    SpreadsheetApp.getUi().alert(texto);
    
  } catch (e) {
    console.error('Erro ao gerar relatório executivo:', e);
  }
}

/**
 * 📧 Enviar relatório por email (exemplo)
 */
function enviarRelatorioEmail(destinatario) {
  try {
    const relatorio = gerarRelatorioEstoqueComValores();
    
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
