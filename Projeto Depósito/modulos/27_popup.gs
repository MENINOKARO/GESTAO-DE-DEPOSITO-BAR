    // =========================
    // POPUP
    // =========================

    const resp = ui.alert(
      'Fechamento de Caixa',

      `Resumo do caixa neste momento:\n\n` +
      `Entradas: R$ ${entrada.toFixed(2)}\n` +
      `Saídas: R$ ${saida.toFixed(2)}\n` +
      `Saldo: R$ ${formatarMoeda(saldo)}\n\n` +
      `Deseja registrar esta conferência?`,

      ui.ButtonSet.YES_NO
    );


    if(resp !== ui.Button.YES) return;


