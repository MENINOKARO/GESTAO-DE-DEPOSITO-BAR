      // ============================
      // 2️⃣ COMANDA_ITENS
      // ============================
      let shItens = ss.getSheetByName('COMANDA_ITENS');
      if(!shItens){
        shItens = ss.insertSheet('COMANDA_ITENS');
        shItens.getRange('A1:F1').setValues([[
          'Pedido','Produto','Qtd','Valor Unit','Total','Processado'
        ]]);
      }

      itens.forEach(i => {

        shItens.appendRow([
          pedido,
          i.produto,
          Number(i.qtd),
          Number(i.unit),
          Number(i.qtd) * Number(i.unit),
          'SIM'
        ]);

        // 🔻 baixa estoque imediatamente
        baixarEstoquePorComanda(
          i.produto,
          Number(i.qtd)
        );
      });

