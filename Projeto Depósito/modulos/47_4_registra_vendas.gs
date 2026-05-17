    // ============================
    // 4️⃣ REGISTRA VENDAS
    // ============================
    const vendas = ss.getSheetByName('VENDAS');
    const idVenda = gerarIdVendaComanda(pedido);

    itens.forEach(i=>{
      vendas.appendRow([
        agoraBrasil(),
        i[1],
        Number(i[2]),
        Number(i[4]),
        formaPgto,
        'COMANDA',
        idVenda
      ]);
    });

