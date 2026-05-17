// ===============================
// FORMATAÇÕES
// ===============================
  function formatarLinhaFinanceira(sh){
    const r = sh.getLastRow();
    const cols = sh.getLastColumn();

    const linha = sh.getRange(r, 1, 1, cols);

    // 🔥 RESET TOTAL DE FORMATAÇÃO (mata o cinza/preto herdado)
    linha
      .setBackground('#ffffff')
      .setFontColor('#020617')
      .setFontWeight('normal');

    // 🔹 Data e hora REAL (não texto)
    sh.getRange(r, 1)
      .setNumberFormat('dd/MM/yyyy HH:mm');

    // 🔹 Tipo (Entrada / Saída) centralizado
    sh.getRange(r, 2)
      .setHorizontalAlignment('center');

    // 🔹 Valor monetário
    sh.getRange(r, 3)
      .setNumberFormat('R$ #,##0.00');

    // 🔒 garante que nenhuma cópia de estilo antigo volte
    SpreadsheetApp.flush();
  }
  function inserirLinhaNoTopo(nomeAba, dados){

    if(!nomeAba || !Array.isArray(dados)){
      throw new Error('Parâmetros inválidos.');
    }

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(nomeAba);

    if(!sh){
      throw new Error(`Aba ${nomeAba} não encontrada.`);
    }

    // Insere nova linha logo abaixo do cabeçalho
    sh.insertRowBefore(2);

    // Grava dados na linha 2
    sh.getRange(2, 1, 1, dados.length)
      .setValues([dados]);

  }
