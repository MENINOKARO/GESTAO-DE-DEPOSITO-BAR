// ===============================
// ESTOQUE
// ===============================
  function atualizarEstoque(){

    const ss = SpreadsheetApp.getActive();

    const shEstoque  = ss.getSheetByName('ESTOQUE');
    const shProdutos = ss.getSheetByName('PRODUTOS');

    if(!shEstoque || !shProdutos){
      throw new Error('Aba ESTOQUE ou PRODUTOS não encontrada.');
    }

    const estoqueDados  = shEstoque.getDataRange().getValues();
    const produtosDados = shProdutos.getDataRange().getValues();

