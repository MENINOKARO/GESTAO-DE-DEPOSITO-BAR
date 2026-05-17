    // ============================
    // 6️⃣ FECHA COMANDA
    // ============================
    const sh = ss.getSheetByName('COMANDAS');
    const dados = sh.getDataRange().getValues();

    dados.forEach((l,i)=>{
      if(i > 0 && l[0] === pedido){
        sh.getRange(i+1,5).setValue('FECHADA');
      }
    });

    registrarLog(
      'COMANDA_FECHADA',
      pedido,
      { totalItens, totalPago },
      { saldoFinal }
    );

    return { ok:true };
  }
  function getClienteDaComanda(pedido){
    if(!pedido) return '';

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('COMANDAS');
    if(!sh) return '';

    const dados = sh.getDataRange().getValues();

    for(let i = 1; i < dados.length; i++){
      if(Number(dados[i][0]) === Number(pedido)){
        return dados[i][2] || '';
      }
    }

    return '';
  }
  function atualizarClienteComanda(pedido, cliente){
    if(!cliente) return;

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('COMANDAS');
    const dados = sh.getDataRange().getValues();

    dados.forEach((l,i)=>{
      if(i>0 && l[0] === pedido){
        sh.getRange(i+1,3).setValue(cliente);
      }
    });
  }
  function criarComandaBalcao(cliente=''){
    const ss = SpreadsheetApp.getActive();
    let sh = ss.getSheetByName('COMANDAS');
    if(!sh){
      sh = ss.insertSheet('COMANDAS');
      sh.getRange('A1:E1').setValues([[
        'Pedido','Data','Cliente','Origem','Status'
      ]]);
    }

    const pedido = gerarNumeroComanda(); // ✅ AQUI
    sh.appendRow([pedido,new Date(),cliente,'BALCAO','ABERTA']);
    return pedido;
  }
  function gerarNumeroComanda(){
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('COMANDAS');

    if(!sh || sh.getLastRow() < 2) return 1;

    const numeros = sh.getRange(2,1,sh.getLastRow()-1,1)
      .getValues()
      .map(l => Number(l[0]))
      .filter(n => !isNaN(n));

    return numeros.length ? Math.max(...numeros) + 1 : 1;
  }
  function gerarIdVendaComanda(pedido){
    return 'C-' + String(pedido).padStart(6,'0');
  }
  function cancelarFechamentoComandaItens(pedido, itensNovos){
    if(!itensNovos || itensNovos.length === 0) return;

    const ss = SpreadsheetApp.getActive();

    const vendas = ss.getSheetByName('VENDAS');
    const itensSh = ss.getSheetByName('COMANDA_ITENS');

    /* ============================
      1️⃣ REMOVE VENDAS GERADAS
      ============================ */
    const vendasDados = vendas.getDataRange().getValues();

    for(let i = vendasDados.length - 1; i > 0; i--){
      const v = vendasDados[i];

      const achou = itensNovos.find(it =>
        it.produto === v[1] &&
        Number(it.qtd) === Number(v[2]) &&
        v[5] === 'COMANDA BALCAO'
      );

      if(achou){
        vendas.deleteRow(i + 1);
      }
    }

    /* ============================
      2️⃣ REMOVE ITENS DA COMANDA
      ============================ */
    const itensDados = itensSh.getDataRange().getValues();

    for(let i = itensDados.length - 1; i > 0; i--){
      const it = itensDados[i];

      const achou = itensNovos.find(n =>
        n.produto === it[1] &&
        Number(n.qtd) === Number(it[2]) &&
        it[0] === pedido
      );

      if(achou){
        itensSh.deleteRow(i + 1);
      }
    }

    /* ============================
      3️⃣ RECALCULA ESTOQUE
      ============================ */
    atualizarEstoque();
  }
  function baixarEstoquePorComanda(produto, quantidade){

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('ESTOQUE');

    if(!sh) throw new Error('Aba ESTOQUE não encontrada.');

    const dados = sh.getDataRange().getValues();

    for(let i = 1; i < dados.length; i++){

      if(dados[i][0] === produto){

        const atual = Number(dados[i][1]) || 0;
        const novaQtd = atual - Number(quantidade);

        if(novaQtd < 0){
          throw new Error(
            `Estoque insuficiente para ${produto}`
          );
        }

        sh.getRange(i+1, 2).setValue(novaQtd);

        return true;
      }
    }

    throw new Error(`Produto ${produto} não encontrado no estoque`);
  }
