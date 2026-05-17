      // ======================
      // BOTÃO PAINEL
      // ======================

      const painel = sh.getRange(11,1,2,8);

      painel.merge();

      painel.setValue('🎛️  ABRIR CONTROLE RÁPIDO')
        .setFontSize(15)
        .setFontWeight('bold')
        .setHorizontalAlignment('center')
        .setVerticalAlignment('middle')
        .setBackground('#3730a3')
        .setFontColor('#ffffff');


