// ===============================
// CAIXA / FINANCEIRO
// ===============================
  function registrarCaixa(data, tipo, valor, forma, origem, descricao){

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('CAIXA');

    if(!sh){
      throw new Error('Aba CAIXA não encontrada.');
    }

    const linha = [
      data,
      tipo,
      Number(valor) || 0,
      forma,
      origem || '',
      descricao || ''
    ];

    // 🔥 INSERE SEMPRE NA PRIMEIRA LINHA (APÓS CABEÇALHO)
    sh.insertRowAfter(1);
    sh.getRange(2, 1, 1, linha.length).setValues([linha]);

    // 🎨 formatação padrão
    sh.getRange(2, 1)
      .setNumberFormat('dd/MM/yyyy HH:mm');

    sh.getRange(2, 3)
      .setNumberFormat('R$ #,##0.00');

    return true;
  }
  function registrarCaixaDelivery(pedido, valor, pagamento){

    registrarCaixa(
      new Date(),
      'Entrada',
      valor,
      pagamento,
      'Delivery',
      `DELIVERY #${pedido}`
    );

  }
  function removerCaixaDelivery(pedido){
    const sh = SpreadsheetApp.getActive().getSheetByName('CAIXA');
    const dados = sh.getDataRange().getValues();

    for(let i = dados.length - 1; i > 0; i--){
      if(
        typeof dados[i][5] === 'string' &&
        dados[i][4] === `DELIVERY #${pedido}`
      ){
        sh.deleteRow(i + 1);
      }
    }
  }
  function calcularSaldoDia(data){
    const cx = SpreadsheetApp.getActive().getSheetByName('CAIXA').getDataRange().getValues();
    let entrada = 0, saida = 0;

    cx.forEach((c,i)=>{
      if(i===0) return;
      const d = Utilities.formatDate(new Date(c[0]), Session.getScriptTimeZone(), 'yyyyMMdd');
      const ref = Utilities.formatDate(data, Session.getScriptTimeZone(), 'yyyyMMdd');
      if(d === ref){
        c[1]==='Entrada' ? entrada+=c[2] : saida+=c[2];
      }
    });

    return {
      entrada,
      saida,
      saldo: entrada - saida
    };
  }
  function calcularSaldoTotal(){
    const cx = SpreadsheetApp.getActive()
      .getSheetByName('CAIXA')
      .getDataRange()
      .getValues();

    let saldo = 0;

    cx.forEach((c,i)=>{
      if(i === 0) return;
      c[1] === 'Entrada'
        ? saldo += Number(c[2])
        : saldo -= Number(c[2]);
    });

    return saldo;
  }
  function fecharCaixaDia(){

    const ss = SpreadsheetApp.getActive();
    const ui = SpreadsheetApp.getUi();

    // Cria aba se não existir
    let fechamento = ss.getSheetByName('CAIXA_FECHAMENTO');

    if(!fechamento){
      fechamento = ss.insertSheet('CAIXA_FECHAMENTO');
      fechamento.getRange('A1:F1').setValues([[
        'Data','Entradas','Saídas','Saldo','Status','Fechado em'
      ]]);
    }


