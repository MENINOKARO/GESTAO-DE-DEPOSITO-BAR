// ===============================
// VENDAS / REGISTROS
// ===============================
  function salvarVendaCarrinho(itens, pagamento){
    const ss = SpreadsheetApp.getActive();
    const vendas = ss.getSheetByName('VENDAS');
    let totalGeral = 0;

    itens.forEach(i=>{
      const total = i.qtd * i.unit;
      vendas.appendRow([
        new Date(),
        i.produto,
        i.qtd,
        total,
        pagamento,
        'Balcão'
      ]);
      totalGeral += total;
    });

    atualizarEstoque();
    registrarCaixa(new Date(),'Entrada',totalGeral,pagamento,'Balcão');
  }
