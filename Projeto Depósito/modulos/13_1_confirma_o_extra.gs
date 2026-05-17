      // =========================
      // 1️⃣ CONFIRMAÇÃO EXTRA
      // =========================
      const ui = SpreadsheetApp.getUi();

      if(!ignorarConfirmacao){
        const resp = ui.alert(
          'RESET TOTAL',
          '⚠️ ATENÇÃO!\n\n' +
          'Isso irá APAGAR:\n' +
          '- Vendas\n' +
          '- Compras\n' +
          '- Caixa\n' +
          '- Clientes\n' +
          '- Comandas\n' +
          '- Logs\n\n' +
          'Essa ação é IRREVERSÍVEL.\n\n' +
          'Deseja continuar?',
          ui.ButtonSet.YES_NO
        );

        if(resp !== ui.Button.YES){
          return { ok:false, msg:'Reset cancelado pelo usuário.' };
        }
      }

