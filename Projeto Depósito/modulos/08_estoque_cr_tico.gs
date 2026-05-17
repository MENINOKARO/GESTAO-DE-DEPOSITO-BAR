      // ======================
      // ESTOQUE CRÍTICO
      // ======================

      let r1 = 14;

      sh.setRowHeight(10, 8);


      sh.getRange(r1,1,1,8).merge()
        .setValue('🚨 PRODUTOS EM ESTOQUE CRÍTICO')
        .setFontWeight('bold')
        .setBackground('#7f1d1d')
        .setFontColor('#fecaca')
        .setHorizontalAlignment('center');


      r1++;


      if(criticos.length === 0){

        sh.getRange(r1,1,1,8).merge()
          .setValue('✅ Nenhum produto crítico')
          .setHorizontalAlignment('center');

        r1++;

      }else{

        criticos.forEach(c=>{

          sh.getRange(r1,1,1,4).merge()
            .setValue(c.produto);

          sh.getRange(r1,5,1,4).merge()
            .setValue(`Qtd: ${c.qtd} / Mín: ${c.minimo}`);

          r1++;

        });

      }


