    // ============================
    // CONFIGURAÇÕES ESTRUTURAIS
    // ============================

    if(typeof aplicarTema === 'function'){ aplicarTema(); }
    if(typeof aplicarDropdownProdutos === 'function'){ aplicarDropdownProdutos(); }
    
    // 🔹 INICIALIZA SISTEMA DE AUTENTICAÇÃO
    if(typeof garantirEstruturausuarios === 'function'){
      garantirEstruturausuarios();
    }
    
    // 🔹 APLICA TEMA COMPLETO
    if(typeof aplicarTemaCompleto === 'function'){
      aplicarTemaCompleto();
    }
    
    // 🔹 GARANTE SENHA DE RESET
    if(typeof garantirSenhaResetObrigatoria === 'function'){
      garantirSenhaResetObrigatoria();
    }
    
    // 🔹 PROTEGE PLANILHAS (exceto gerencial será protegido ao login)
    if(typeof aplicarProtecoesPlanilhas === 'function'){
      aplicarProtecoesPlanilhas();
    }

    if(typeof padronizarTodasAbasSistema === 'function'){
      padronizarTodasAbasSistema();
    }

  }
  function aplicarTema(){
    SpreadsheetApp.getActive().getSheets().forEach(sh=>sh.setHiddenGridlines(true));
  }
  function aplicarFormatacaoPadrao(sh){
    // Formata sheet com padrão consistent
    if(!sh) return;
    
    try {
      // Esconde gridlines
      sh.setHiddenGridlines(true);
      
      // Congela primeira linha
      sh.setFrozenRows(1);
      
      // Formata cabeçalho (primeira linha)
      const lastCol = sh.getLastColumn() || 10;
      if(sh.getLastRow() > 0){
        sh.getRange(1, 1, 1, lastCol)
          .setFontWeight('bold')
          .setBackground('#0f172a')
          .setFontColor('#ffffff')
          .setHorizontalAlignment('center')
          .setVerticalAlignment('middle');
      }
      
      // Ajusta altura das linhas
      sh.setRowHeight(1, 28);
      
      // Coloca bordas em todo o intervalo de dados
      const lastRow = sh.getLastRow();
      if(lastRow > 1){
        sh.getRange(1, 1, lastRow, lastCol)
          .setBorder(true, true, true, true, true, true, '#cbd5e1', SpreadsheetApp.BorderStyle.SOLID);
      }
      
    } catch(e) {
      console.log('Erro ao aplicar formatação: ' + e);
    }
  }


  function padronizarTodasAbasSistema(){
    const ss = SpreadsheetApp.getActive();
    const abas = ss.getSheets();

    abas.forEach(sh => {
      aplicarFormatacaoPadrao(sh);
    });

    uiNotificar('Formatação padrão aplicada em todas as abas.','sucesso','Padronização');
    return { ok:true, total: abas.length };
  }

