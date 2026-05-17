      // ============================
      // 1️⃣ COMANDAS
      // ============================
      let shComandas = ss.getSheetByName('COMANDAS');
      if(!shComandas){
        shComandas = ss.insertSheet('COMANDAS');
        shComandas.getRange('A1:E1').setValues([[
          'Pedido','Data','Cliente','Origem','Status'
        ]]);
      }

      shComandas.appendRow([
        pedido,
        new Date(),
        cliente || '',
        'BALCAO',
        status
      ]);

