      // ======================
      // ESTOQUE FINANCEIRO
      // ======================

      r1 += 1;
      
      sh.setRowHeight(r1, 2);

      sh.getRange(r1,1,1,8).merge()
        .setValue('💰 VALOR TOTAL DO ESTOQUE')
        .setFontWeight('bold')
        .setBackground('#5b2c05')
        .setFontColor('#fef3c7')
        .setHorizontalAlignment('center');
      +

      r1++;
      sh.getRange(r1,1,1,4).merge()
        .setValue(`Total: R$ ${valorTotalEstoque.toFixed(2)}`);
      sh.getRange(r1,5,1,4).merge()
        .setValue(`Lucro Estimado: R$ ${resumoEstoque.lucroEstoque ? resumoEstoque.lucroEstoque.toFixed(2) : 0}`);
      r1++;

