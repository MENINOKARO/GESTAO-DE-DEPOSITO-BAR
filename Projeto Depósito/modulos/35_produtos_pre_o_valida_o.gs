// ===============================
// PRODUTOS / PREÇO / VALIDAÇÃO
// ===============================
  function aplicarDropdownProdutos(){
    const sh = SpreadsheetApp.getActive().getSheetByName('PRODUTOS');

    const categorias = ['Cerveja','Refrigerante','Água','Energético','Destilado','Outros'];

    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(categorias, true)
      .build();

    sh.getRange('B2:B500').setDataValidation(rule);
  }
  function recalcularPrecoSugeridoLinha(sh, row){
    const custo = Number(sh.getRange(row,7).getValue());
    let margem  = Number(sh.getRange(row,8).getValue());

    if(!custo || custo <= 0) return;
    if(margem === '' || margem < 0) return;

    // 🔥 6 → 6% | 60 → 60%
    if(margem > 1){
      margem = margem / 100;
    }

    const preco = custo * (1 + margem);

    sh.getRange(row,9)
      .setValue(preco)
      .setNumberFormat('R$ #,##0.00');
  }
  function validarPrecoVsCusto(sh, row){
    const preco = Number(sh.getRange(row,5).getValue()); // Preço
    const custo = Number(sh.getRange(row,7).getValue()); // Custo
    const statusCell = sh.getRange(row,10); // Coluna J

    // limpa visual anterior
    sh.getRange(row,1,1,10).setBackground(null);
    statusCell.setValue('').setFontColor('#020617');

    if(!preco || !custo) return;

    // 🔴 PREJUÍZO
    if(preco < custo){
      sh.getRange(row,1,1,10).setBackground('#fee2e2');
      statusCell
        .setValue('⬇️ PREJUÍZO')
        .setFontColor('#dc2626');
      return;
    }

    const margem = (preco - custo) / custo;

    // 🟡 MARGEM BAIXA
    if(margem < 0.05){
      sh.getRange(row,1,1,10).setBackground('#fef9c3');
      statusCell
        .setValue('➡️ MARGEM BAIXA')
        .setFontColor('#92400e');
      return;
    }

    // 🟢 MARGEM OK
    statusCell
      .setValue('⬆️ LUCRO')
      .setFontColor('#166534');
  }
  function atualizarCustoMedioProduto(produto, qtdCompra, valorTotalCompra){

    const ss = SpreadsheetApp.getActive();
    const shProd = ss.getSheetByName('PRODUTOS');
    const shEst  = ss.getSheetByName('ESTOQUE');

    if(!shProd || !shEst) return false;

    const prodDados = shProd.getDataRange().getValues();
    const estDados  = shEst.getDataRange().getValues();

    let qtdAntes = 0;
    let custoAtual = 0;
    let rowProd = -1;

    // 🔹 BUSCA ESTOQUE ANTES DA COMPRA
    for(let i = 1; i < estDados.length; i++){
      if(estDados[i][0] === produto){
        qtdAntes = Number(estDados[i][1]) || 0;
        break;
      }
    }

    // 🔹 BUSCA CUSTO ATUAL (PRODUTOS → coluna G)
    for(let i = 1; i < prodDados.length; i++){
      if(prodDados[i][0] === produto){
        custoAtual = Number(prodDados[i][6]) || 0;
        rowProd = i + 1;
        break;
      }
    }

    if(rowProd === -1) return false;

    const novoTotalQtd = qtdAntes + qtdCompra;
    if(novoTotalQtd <= 0) return false;

    // ✅ CUSTO MÉDIO PONDERADO REAL
    const novoCustoMedio =
      ((qtdAntes * custoAtual) + valorTotalCompra) / novoTotalQtd;

    shProd
      .getRange(rowProd, 7) // coluna G
      .setValue(Number(novoCustoMedio.toFixed(2)));

    return true;
  }

