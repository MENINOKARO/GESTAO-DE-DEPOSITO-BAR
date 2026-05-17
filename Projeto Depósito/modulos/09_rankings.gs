      // ======================
      // RANKINGS
      // ======================

      r1 += 1;


      sh.getRange(r1,1,1,4).merge()
        .setValue('🏆 TOP 10 MAIS VENDIDOS')
        .setFontWeight('bold')
        .setBackground('#065f46')
        .setFontColor('#d1fae5')
        .setHorizontalAlignment('center');


      sh.getRange(r1,5,1,4).merge()
        .setValue('🐢 5 MENOS VENDIDOS')
        .setFontWeight('bold')
        .setBackground('#78350f')
        .setFontColor('#fef3c7')
        .setHorizontalAlignment('center');


      r1++;


      const max = Math.max(
        ranking.top.length,
        ranking.flop.length
      );


      for(let i=0;i<max;i++){

        if(ranking.top[i]){

          sh.getRange(r1+i,1,1,4).merge()
            .setValue(
              `${i+1}. ${ranking.top[i].produto} — ${ranking.top[i].qtd}`
            );

        }

        if(ranking.flop[i]){

          sh.getRange(r1+i,5,1,4).merge()
            .setValue(
              `${i+1}. ${ranking.flop[i].produto} — ${ranking.flop[i].qtd}`
            );

        }

      }


