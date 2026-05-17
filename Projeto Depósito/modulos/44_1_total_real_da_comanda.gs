    // ============================
    // 1️⃣ TOTAL REAL DA COMANDA
    // ============================
    const itens = ss.getSheetByName('COMANDA_ITENS')
      .getDataRange()
      .getValues()
      .filter((l,i)=> i > 0 && l[0] === pedido);

    if(itens.length === 0){
      throw new Error(
        `Nenhum item encontrado para a comanda ${pedido}`
      );
    }

    let totalItens = 0;
    itens.forEach(i=>{
      totalItens += Number(i[4]) || 0;
    });

