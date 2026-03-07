/**
 * =====================================================
 * 📊 MÓDULO DE GESTÃO DE ESTOQUE COM VALORES
 * =====================================================
 * Sistema completo para gerenciar estoque com:
 * - Valores totais de estoque
 * - Valores após venda
 * - Preços praticados
 * - Análise de rentabilidade
 * 
 * Data: 2026-02
 * Versão: 1.0
 * =====================================================
 */
 /**
 * 🎯 FUNÇÃO PRINCIPAL
 * Gera relatório completo de estoque com valores totais e após vendas
 */

 function gerarRelatorioEstoqueComValores() {
   const ss = SpreadsheetApp.getActive();
   
   try {
     // Busca dados
     const estoque = obterDadosEstoque();
     const produtos = obterDadosProdutos();
     const vendas = obterDadosVendas();
     
     if (!estoque || estoque.length === 0) {
     uiNotificar('Nenhum produto encontrado no estoque','aviso','Estoque');
       return null;
     }
     
     // Calcula valores
     const relatorio = calcularValoresEstoque(estoque, produtos, vendas);
     
     // Cria ou atualiza aba de relatório
     const shRelatorio = criarAbaRelatorioEstoque();
     
     // Popula dados
     preencherRelatorioEstoque(shRelatorio, relatorio);
     
      uiNotificar('Relatório de estoque gerado com sucesso!','sucesso','Estoque');
     
     return relatorio;
     
   } catch (e) {
     console.error('Erro em gerarRelatorioEstoqueComValores:', e);
     uiNotificar('Erro ao gerar relatório: ' + e.message,'erro','Estoque');
     return null;
   }
 }
 
 /**
 * 📦 Obtém dados da aba ESTOQUE
 */

function obterDadosEstoque() {
   const ss = SpreadsheetApp.getActive();
   const sh = ss.getSheetByName('ESTOQUE');
   
   if (!sh) return [];
   
   const dados = sh.getDataRange().getValues();
   
   if (dados.length <= 1) return [];
   
   return dados.slice(1).filter(linha => 
     linha[0] && linha[0].toString().trim() !== ''
   );
 }
 
 /**
 *🏷️ Obtém dados da aba PRODUTOS com preços e custos
 */

function obterDadosProdutos() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('PRODUTOS');
  
  if (!sh) return [];
  
  const dados = sh.getDataRange().getValues();
  
  if (dados.length <= 1) return [];
  
  const mapa = {};
  
  dados.slice(1).forEach(linha => {
    const produto = linha[0];
    
    if(!produto) return;
    
    mapa[produto.toString().trim()] = {
      nome: produto,
      categoria: linha[1] || '',
      preco: Number(linha[4]) || 0,         // Preço de venda
      custMedio: Number(linha[6]) || 0,     // Custo médio
      margem: Number(linha[7]) || 0,         // Margem %
      status: linha[9] || 'Normal'
    };
  });
  
  return mapa;
}

/**
 * 🛒 Obtém dados de vendas
 */
function obterDadosVendas() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('VENDAS');
  
  if (!sh) return [];
  
  const dados = sh.getDataRange().getValues();
  
  if (dados.length <= 1) return [];
  
  return dados.slice(1).filter(linha => 
    linha[1] && linha[1].toString().trim() !== ''
  );
}

/**
 * 💰 Calcula valores totais do estoque e após vendas
 */
function calcularValoresEstoque(estoque, produtos, vendas) {
  
  const relatorio = [];
  let totalValorAtual = 0;
  let totalValorCusto = 0;
  let totalVendido = 0;
  let lucroTotal = 0;
  
  estoque.forEach(linha => {
    const nomeProduto = linha[0].toString().trim();
    const quantidadeAtual = Number(linha[1]) || 0;
    const minimo = Number(linha[2]) || 0;
    
    const produto = produtos[nomeProduto];
    
    if (!produto) return;
    
    const precoVenda = produto.preco;
    const custMedio = produto.custMedio;
    const margem = produto.margem;
    
    // Valores atuais de estoque
    const valorTotalEstoque = quantidadeAtual * precoVenda;
    const custTotalEstoque = quantidadeAtual * custMedio;
    const lucroEstoque = valorTotalEstoque - custTotalEstoque;
    
    // Calcula quantidade vendida (para análise)
    const qtdVendida = calcularQuantidadeVendida(nomeProduto, vendas);
    const valorVendido = qtdVendida * precoVenda;
    const custVendido = qtdVendida * custMedio;
    const lucroVendido = valorVendido - custVendido;
    
    // Avalia status do estoque
    let status = 'Normal';
    if (quantidadeAtual <= minimo) {
      status = '🚨 Crítico';
    } else if (quantidadeAtual <= minimo * 1.5) {
      status = '⚠️ Baixo';
    } else if (quantidadeAtual > minimo * 3) {
      status = '📈 Alto';
    }
    
    relatorio.push({
      produto: nomeProduto,
      categoria: produto.categoria,
      precoVenda: precoVenda,
      custMedio: custMedio,
      margem: margem,
      // ESTOQUE ATUAL
      qtdAtual: quantidadeAtual,
      valorTotalEstoque: valorTotalEstoque,
      custTotalEstoque: custTotalEstoque,
      lucroEstoque: lucroEstoque,
      // VENDAS
      qtdVendida: qtdVendida,
      valorVendido: valorVendido,
      custVendido: custVendido,
      lucroVendido: lucroVendido,
      // ANÁLISE
      taxaRotacao: calcularTaxaRotacao(quantidadeAtual, qtdVendida),
      status: status
    });
    
    totalValorAtual += valorTotalEstoque;
    totalValorCusto += custTotalEstoque;
    totalVendido += valorVendido;
    lucroTotal += lucroVendido;
  });
  
  return {
    itens: relatorio,
    resumo: {
      totalValorEstoque: totalValorAtual,
      totalCustoEstoque: totalValorCusto,
      lucroEstoque: totalValorAtual - totalValorCusto,
      totalVendido: totalVendido,
      lucroVendido: lucroTotal,
      margemMedia: calcularMargemMedia(relatorio)
    }
  };
}

/**
 * 📊 Calcula quantidade total vendida de um produto
 */
function calcularQuantidadeVendida(nomeProduto, vendas) {
  let total = 0;
  
  vendas.forEach(venda => {
    const produtoVenda = venda[1] ? venda[1].toString().trim() : '';
    const qtd = Number(venda[2]) || 0;
    
    if (produtoVenda === nomeProduto.toString().trim()) {
      total += qtd;
    }
  });
  
  return total;
}

/**
 * 📈 Calcula taxa de rotação do estoque
 */
function calcularTaxaRotacao(qtdAtual, qtdVendida) {
  if (qtdAtual === 0) return qtdVendida > 0 ? 100 : 0;
  return Math.round((qtdVendida / (qtdAtual + qtdVendida)) * 100 * 100) / 100;
}

/**
 * 💹 Calcula margem média do estoque
 */
function calcularMargemMedia(itens) {
  if (itens.length === 0) return 0;
  
  const somaMargens = itens.reduce((soma, item) => soma + item.margem, 0);
  return Math.round(somaMargens / itens.length * 100) / 100;
}

/**
 * 📋 Cria aba de relatório de estoque
 */
function criarAbaRelatorioEstoque() {
  const ss = SpreadsheetApp.getActive();
  
  let sh = ss.getSheetByName('ESTOQUE_VALORES');
  
  if (!sh) {
    sh = ss.insertSheet('ESTOQUE_VALORES');
  }
  
  sh.clear();
  
  return sh;
}

/**
 * ✍️ Preenche relatório na planilha
 */
function preencherRelatorioEstoque(sh, relatorio) {
  const headers = [
    'Produto',
    'Categoria',
    'Preço Unitário',
    'Custo Médio',
    'Margem %',
    'Qtd em Estoque',
    'Valor Total (Est.)',
    'Custo Total (Est.)',
    'Lucro (Est.)',
    'Qtd Vendida',
    'Valor Vendido',
    'Custo Vendido',
    'Lucro Vendido',
    'Taxa Rotação %',
    'Status'
  ];
  
  // Cabeçalhos
  sh.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight('bold')
    .setBackground('#020617')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');
  
  let linhaAtual = 2;
  
  // Dados dos itens
  relatorio.itens.forEach(item => {
    const dados = [
      item.produto,
      item.categoria,
      item.precoVenda,
      item.custMedio,
      item.margem,
      item.qtdAtual,
      item.valorTotalEstoque,
      item.custTotalEstoque,
      item.lucroEstoque,
      item.qtdVendida,
      item.valorVendido,
      item.custVendido,
      item.lucroVendido,
      item.taxaRotacao,
      item.status
    ];
    
    sh.getRange(linhaAtual, 1, 1, headers.length).setValues([dados]);
    
    // Formatação condicional
    if (item.lucroEstoque < 0) {
      sh.getRange(linhaAtual, 9).setFontColor('#dc2626'); // Vermelho para lucro negativo
    }
    
    linhaAtual++;
  });
  
  // Resumo
  const linhaResumo = linhaAtual + 2;
  
  sh.getRange(linhaResumo, 1, 1, 2)
    .mergeAcross()
    .setValue('📊 RESUMO FINANCEIRO DO ESTOQUE')
    .setFontWeight('bold')
    .setBackground('#f0f9ff')
    .setFontSize(12);
  
  const resumoData = [
    ['Total em Estoque (Preço de Venda):', relatorio.resumo.totalValorEstoque],
    ['Total de Custos em Estoque:', relatorio.resumo.totalCustoEstoque],
    ['Lucro Potencial em Estoque:', relatorio.resumo.lucroEstoque],
    ['Total Vendido (Período):', relatorio.resumo.totalVendido],
    ['Lucro Realizado (Vendas):', relatorio.resumo.lucroVendido],
    ['Margem Média:', relatorio.resumo.margemMedia + '%']
  ];
  
  let linhaResumoData = linhaResumo + 1;
  
  resumoData.forEach(([label, valor]) => {
    sh.getRange(linhaResumoData, 1).setValue(label);
    sh.getRange(linhaResumoData, 2).setValue(valor);
    
    if (typeof valor === 'number' && valor < 0) {
      sh.getRange(linhaResumoData, 2).setFontColor('#dc2626');
    } else if (typeof valor === 'number' && valor > 0) {
      sh.getRange(linhaResumoData, 2).setFontColor('#16a34a');
    }
    
    linhaResumoData++;
  });
  
  // Ajusta largura das colunas
  sh.autoResizeColumns(1, headers.length);
  
  // Formata números como moeda
  for (let col = 3; col <= 13; col++) {
    if (col !== 5 && col !== 14) { // Ignora margem e taxa rotação
      sh.getRange(2, col, relatorio.itens.length, 1)
        .setNumberFormat('#,##0.00');
    }
  }
  
  // Congela cabeçalho
  sh.setFrozenRows(1);
}

/**
 * 💰 Função auxiliar para obter valor total do estoque
 */
function obterValorTotalEstoque() {
  try {
    const estoque = obterDadosEstoque();
    const produtos = obterDadosProdutos();
    let total = 0;
    
    estoque.forEach(linha => {
      const nomeProduto = linha[0].toString().trim();
      const quantidade = Number(linha[1]) || 0;
      const produto = produtos[nomeProduto];
      
      if (produto) {
        total += quantidade * produto.preco;
      }
    });
    
    return total;
  } catch (e) {
    console.error('Erro em obterValorTotalEstoque:', e);
    return 0;
  }
}

/**
 * 🎯 Função para buscar valor de estoque por categoria
 */
function obterValorEstoquesPorCategoria() {
  try {
    const estoque = obterDadosEstoque();
    const produtos = obterDadosProdutos();
    const porCategoria = {};
    
    estoque.forEach(linha => {
      const nomeProduto = linha[0].toString().trim();
      const quantidade = Number(linha[1]) || 0;
      const produto = produtos[nomeProduto];
      
      if (produto) {
        const categoria = produto.categoria || 'Sem Categoria';
        
        if (!porCategoria[categoria]) {
          porCategoria[categoria] = {
            quantidade: 0,
            valor: 0,
            custo: 0
          };
        }
        
        const valorVenda = quantidade * produto.preco;
        const valorCusto = quantidade * produto.custMedio;
        
        porCategoria[categoria].quantidade += quantidade;
        porCategoria[categoria].valor += valorVenda;
        porCategoria[categoria].custo += valorCusto;
      }
    });
    
    return porCategoria;
  } catch (e) {
    console.error('Erro em obterValorEstoquesPorCategoria:', e);
    return {};
  }
}

/**
 * 📊 Função para análise de rentabilidade por produto
 */
function analisarRentabilidadeEstoque() {
  try {
    const relatorio = gerarRelatorioEstoqueComValores();
    
    if (!relatorio) return null;
    
    const analise = {
      maisRentaveis: [],
      menosRentaveis: [],
      estoqueCritico: [],
      altaRotacao: [],
      quaseNenhumavenda: []
    };
    
    relatorio.itens.forEach(item => {
      // Mais rentáveis
      analise.maisRentaveis.push({
        produto: item.produto,
        lucro: item.lucroEstoque,
        margem: item.margem
      });
      
      // Estoque crítico
      if (item.status.includes('Crítico')) {
        analise.estoqueCritico.push({
          produto: item.produto,
          quantidade: item.qtdAtual,
          valor: item.valorTotalEstoque
        });
      }
      
      // Alta rotação
      if (item.taxaRotacao > 70) {
        analise.altaRotacao.push({
          produto: item.produto,
          taxaRotacao: item.taxaRotacao
        });
      }
      
      // Quase nenhuma venda
      if (item.qtdVendida === 0 && item.qtdAtual > 0) {
        analise.quaseNenhumavenda.push({
          produto: item.produto,
          quantidade: item.qtdAtual,
          valor: item.valorTotalEstoque
        });
      }
    });
    
    // Ordena
    analise.maisRentaveis.sort((a, b) => b.lucro - a.lucro);
    analise.altaRotacao.sort((a, b) => b.taxaRotacao - a.taxaRotacao);
    
    return analise;
    
  } catch (e) {
    console.error('Erro em analisarRentabilidadeEstoque:', e);
    return null;
  }
}

/**
 * Menu: Abre painel de gestão de estoque com valores
 */
function abrirPainelEstoqueValores() {
  try {
    const relatorio = gerarRelatorioEstoqueComValores();
    
    if (!relatorio) {
      return;
    }
    
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('ESTOQUE_VALORES');
    
    if (sh) {
      ss.setActiveSheet(sh);
      SpreadsheetApp.flush();
    }
    
  } catch (e) {
    console.error('Erro em abrirPainelEstoqueValores:', e);
    uiNotificar('Erro ao abrir painel: ' + e.message,'erro','Estoque');
  }
}
