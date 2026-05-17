      // ======================
      // VALOR POR CATEGORIA (primeiras 5)
      // ======================
      const porCat = typeof obterValorEstoquesPorCategoria === 'function'
        ? obterValorEstoquesPorCategoria()
        : {};
      if(Object.keys(porCat).length){
        r1++;
        sh.getRange(r1,1,1,8).merge()
          .setValue('📂 Valor por Categoria (top 5)')
          .setFontWeight('bold')
          .setBackground('#0c4a6e')
          .setFontColor('#cffafe')
          .setHorizontalAlignment('center');
        r1++;
        Object.entries(porCat).slice(0,5).forEach(([cat,d])=>{
          sh.getRange(r1,1,1,4).merge().setValue(cat);
          sh.getRange(r1,5,1,4).merge().setValue(`R$ ${d.valor.toFixed(2)}`);
          r1++;
        });
      }

