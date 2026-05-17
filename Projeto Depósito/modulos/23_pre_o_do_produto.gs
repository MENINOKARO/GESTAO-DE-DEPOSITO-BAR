// ===============================
// PREÇO DO PRODUTO
// ===============================

  function getPrecoProduto(nome){

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('PRODUTOS');

    const dados = sh.getDataRange().getValues();

    for(let i=1;i<dados.length;i++){
      if(function(s){ try{ return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toUpperCase().trim(); }catch(e){ return String(s||'').toUpperCase().trim(); }}(dados[i][0]) === function(s){ try{ return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toUpperCase().trim(); }catch(e){ return String(s||'').toUpperCase().trim(); }}(nome)){
        return Number(dados[i][4]) || 0; // coluna preço
      }
    }

    return 0;
  }
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

