    // ============================
    // GARANTE ESTRUTURA DAS ABAS
    // ============================
    Object.keys(estrutura).forEach(nome=>{

      let sh = ss.getSheetByName(nome);

      if(!sh){
        sh = ss.insertSheet(nome);
      }

      const headers = estrutura[nome];
      const atual = sh.getRange(1,1,1,headers.length).getValues()[0];

      if(atual.join() !== headers.join()){
        sh.getRange(1,1,1,headers.length)
          .setValues([headers])
          .setFontWeight('bold');
      }
    });

