    // =========================
    // SALVAR
    // =========================

    fechamento.appendRow([
      new Date(),
      entrada,
      saida,
      saldo,
      status,
      new Date()
    ]);


    inserirLinhaSeparadoraCaixa(
      'CONFERÊNCIA DE CAIXA',
      saldo
    );


    const row = fechamento.getLastRow();


    formatarLinhaFechamentoCaixa(
      fechamento,
      row,
      'CONFERENCIA'
    );


    bloquearEdicaoAposFechamento();


    ui.alert('✅ Conferência de caixa registrada com sucesso.');

  }
  function fecharFiscalDia(){
    const ss = SpreadsheetApp.getActive();
    const ui = SpreadsheetApp.getUi();

    let fiscal = ss.getSheetByName('CAIXA_FISCAL');
    if(!fiscal){
      fiscal = ss.insertSheet('CAIXA_FISCAL');
      fiscal.getRange('A1:E1').setValues([[
        'Data Referência','Entradas','Saídas','Saldo','Fechado em'
      ]]);
    }

    const cx = ss.getSheetByName('CAIXA').getDataRange().getValues();
    const dadosFiscal = fiscal.getDataRange().getValues();

    // 🔑 último fechamento fiscal REAL
    let ultimoFechamento = null;
    if(dadosFiscal.length > 1){
      ultimoFechamento = new Date(
        dadosFiscal[dadosFiscal.length - 1][4]
      );
    }

    let entrada = 0;
    let saida = 0;

    cx.forEach((c,i)=>{
      if(i === 0) return;

      const dataMov = c[0];

      // 🔒 ignora linhas sem data válida (separadores)
      if(!(dataMov instanceof Date)) return;

      // 🔥 só considera após último fechamento fiscal
      if(ultimoFechamento && dataMov <= ultimoFechamento) return;

      c[1] === 'Entrada'
        ? entrada += Number(c[2])
        : saida += Number(c[2]);
    });

    const saldo = entrada - saida;

    if(entrada === 0 && saida === 0){
      ui.alert('Nenhuma movimentação nova desde o último fechamento fiscal.');
      return;
    }

    const resp = ui.alert(
      'Fechamento Fiscal',
      `Resumo desde o último fechamento fiscal:\n\n` +
      `Entradas: R$ ${entrada.toFixed(2)}\n` +
      `Saídas: R$ ${saida.toFixed(2)}\n` +
      `Saldo: R$ ${formatarMoeda(saldo)}\n\n` +
      `Confirmar fechamento fiscal?`,
      ui.ButtonSet.YES_NO
    );

    if(resp !== ui.Button.YES) return;

    fiscal.appendRow([
      new Date(),
      entrada,
      saida,
      saldo,
      new Date()
    ]);

    inserirLinhaSeparadoraCaixa(
      'FECHAMENTO DE CAIXA FISCAL',
      saldo
    );

    const r = fiscal.getLastRow();

    // 🎨 visual padrão de fechamento fiscal
    formatarLinhaFechamentoCaixa(
      fiscal,
      r,
      'FISCAL'
    );

    bloquearEdicaoAposFechamento();

    ui.alert('📑 Fechamento fiscal realizado com sucesso.');
  }
  function inserirLinhaSeparadoraCaixa(texto, valorPeriodo){
      const cx = SpreadsheetApp.getActive().getSheetByName('CAIXA');

      cx.appendRow([
        `---------- ${texto} ----------`,
        '',
        valorPeriodo || '',
        '',
        ''
      ]);

      const r = cx.getLastRow();

      // 🔒 força formato correto de data na coluna A
      cx.getRange(r,1).setNumberFormat('@');

      cx.getRange(r,1,1,5)
        .setFontWeight('bold')
        .setHorizontalAlignment('center')
        .setFontColor('#64748b');

      if(valorPeriodo !== undefined){
        cx.getRange(r,3)
          .setNumberFormat('R$ #,##0.00')
          .setFontColor('#020617');
      }
  }
  function formatarLinhaFechamentoCaixa(sh, row, tipo = 'CONFERENCIA'){
    const range = sh.getRange(row, 1, 1, sh.getLastColumn());

    // 🎨 cores padrão
    let bg = '#0f172a'; // azul escuro elegante
    let font = '#ffffff';

    if(tipo === 'FISCAL'){
      bg = '#020617'; // ainda mais escuro (fiscal)
    }

    range
      .setBackground(bg)
      .setFontColor(font)
      .setFontWeight('bold')
      .setHorizontalAlignment('center');

    // 📅 datas reais
    sh.getRange(row, 1).setNumberFormat('dd/MM/yyyy');
    sh.getRange(row, 6).setNumberFormat('dd/MM/yyyy HH:mm');

    // 💰 valores
    sh.getRange(row, 2, 1, 3)
      .setNumberFormat('R$ #,##0.00');
  }
  function bloquearEdicaoAposFechamento(){
    const ss = SpreadsheetApp.getActive();
    const limite = getUltimoFechamentoFiscal();
    if(!limite) return;

    ['CAIXA','VENDAS','COMPRAS'].forEach(nome=>{
      const sh = ss.getSheetByName(nome);
      if(!sh) return;

      const dados = sh.getDataRange().getValues();
      let ultimaLinha = 0;

      dados.forEach((l,i)=>{
        if(i===0) return;
        if(new Date(l[0]) <= limite){
          ultimaLinha = i+1;
        }
      });

      if(ultimaLinha > 1){
        const range = sh.getRange(
          2,1,
          ultimaLinha-1,
          sh.getLastColumn()
        );
        const prot = range.protect();
        prot.setDescription(
          `Bloqueado até ${Utilities.formatDate(
            limite,
            Session.getScriptTimeZone(),
            'dd/MM/yyyy HH:mm'
          )}`
        );
        prot.removeEditors(prot.getEditors());
        if(prot.canDomainEdit()) prot.setDomainEdit(false);
      }
    });
  }
  function getUltimoFechamentoFiscal(){
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('CAIXA_FISCAL');
    if(!sh || sh.getLastRow() < 2) return null;

    return new Date(
      sh.getRange(sh.getLastRow(), 5).getValue()
    );
  }
  function getDataUltimaConferenciaCaixa(){

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('CAIXA_FECHAMENTO');

    if(!sh) return null;

    const dados = sh.getDataRange().getValues();
    if(dados.length <= 1) return null;

    const ultimaLinha = dados[dados.length - 1];
    const data = ultimaLinha[0];

    return (data instanceof Date) ? data : null;
  }
  function calcularSaldoHoje(){

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('CAIXA');

    const dados = sh.getDataRange().getValues();
    const dataInicio = getDataUltimaConferenciaCaixa();

    let entrada = 0;
    let saida   = 0;

    dados.forEach((l,i)=>{

      if(i === 0) return;
      if(!(l[0] instanceof Date)) return;

      // 🔥 ignora lançamentos ANTES da última conferência
      if(dataInicio && l[0] <= dataInicio) return;

      const tipo = String(l[1] || '').toUpperCase();
      const valor = Number(l[2]) || 0;

      if(tipo === 'ENTRADA') entrada += valor;
      if(tipo === 'SAIDA')   saida   += valor;
    });

    return {
      entrada,
      saida,
      saldo: entrada - saida
    };
  }
  function calcularIndicadoresHoje(){

    const ss = SpreadsheetApp.getActive();

    // COMANDAS
    const com = ss.getSheetByName('COMANDAS');
    let abertas = 0;

    if(com){
      const d = com.getDataRange().getValues();
      abertas = d.filter((l,i)=>i>0 && l[3]==='ABERTA').length;
    }

    // DELIVERY
    const del = ss.getSheetByName('DELIVERY');
    let deliveryHoje = 0;

    if(del){
      const d = del.getDataRange().getValues();
      const hoje = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

      deliveryHoje = d.filter((l,i)=>{
        if(i===0) return false;
        const data = Utilities.formatDate(new Date(l[1]), Session.getScriptTimeZone(), 'yyyy-MM-dd');
        return data === hoje;
      }).length;
    }

    return {
      comandasAbertas: abertas,
      deliveryHoje: deliveryHoje
    };
  }
  function formatarMoeda(v){
    return 'R$ ' + Number(v || 0).toFixed(2);
  }
  function registrarContaAReceber(dados){

    const ss = SpreadsheetApp.getActive();
    let sh = ss.getSheetByName('CONTAS_A_RECEBER');

    if(!sh){
      sh = ss.insertSheet('CONTAS_A_RECEBER');
      sh.getRange('A1:H1').setValues([[
        'ID','Origem','Pedido','Cliente',
        'Valor','Forma','Status','Data'
      ]]);
    }

    sh.appendRow([
      dados.id,
      dados.origem,
      dados.pedido,
      dados.cliente || '',
      dados.valor,
      dados.forma,
      'PENDENTE',
      new Date()
    ]);

    return true;
  }

