// ===============================
// 🔐 FUNÇÕES DE PERFIL E LOGOUT
// ===============================

  function abrirMeuPerfil(){
    const usuario = obterUsuarioAtual();

    if(!usuario){
      SpreadsheetApp.getUi().alert('❌ Nenhum usuário logado.');
      return;
    }

    const html = `
      <div style="font-family:Arial; padding: 20px; max-width: 400px;">
        <h2 style="text-align:center; color:#0f172a">👤 Meu Perfil</h2>
    
        <div style="background:#f0f4f8; padding:15px; border-radius:8px; margin:15px 0">
          <p><strong>Nome:</strong> ${usuario.nome}</p>
          <p><strong>Email:</strong> ${usuario.email}</p>
          <p><strong>Perfil:</strong> 
            <span style="
              background:${usuario.perfil === 'GERENCIAL' ? '#16a34a' : '#2563eb'};
              color:white;
              padding:4px 8px;
              border-radius:4px;
              font-weight:bold;
            ">
              ${usuario.perfil === 'GERENCIAL' ? '👨‍💼 Gerencial' : '📦 Operacional'}
            </span>
          </p>
          <p><strong>Status:</strong> ${usuario.ativo === 'SIM' ? '✅ Ativo' : '❌ Inativo'}</p>
        </div>
    
        <div style="text-align:center; margin-top:20px">
          <button onclick="google.script.host.close()" style="
            padding:10px 20px;
            background:#2563eb;
            color:#fff;
            border:none;
            border-radius:6px;
            cursor:pointer;
          ">
            ✅ Fechar
          </button>
        </div>
      </div>
    `;

    abrirPopup('👤 Meu Perfil', html, 420, 350);
  }
  function fazerLogout(){
    const ui = SpreadsheetApp.getUi();

    const resp = ui.alert(
      '🚪 Logout',
      'Tem certeza que deseja sair?',
      ui.ButtonSet.YES_NO
    );

    if(resp !== ui.Button.YES) return;

    // delega para fluxo assíncrono seguro
    popupLogout();
  }
  function aplicarTemaCompleto(){
    const ss = SpreadsheetApp.getActive();
    const sheets = ss.getSheets();

    sheets.forEach(sh => {
      // Cores do tema DARK
      const corFundo = '#0f172a';
      const corCabecalho = '#1e293b';
      const corTexto = '#e2e8f0';
      const corDestaque = '#3730a3';

      // Oculta gridlines
      sh.setHiddenGridlines(true);

      // Aplica ao cabeçalho (primeira linha)
      const ultimaCol = sh.getLastColumn() || 8;
      if(ultimaCol > 0){
        try {
          sh.getRange(1, 1, 1, ultimaCol)
            .setBackground(corCabecalho)
            .setFontColor('#e0e7ff')
            .setFontWeight('bold');
        } catch(e){}
      }

      // Define fontes padrão (aplica ao conteúdo da planilha)
      try{ sh.getDataRange().setFontFamily('Arial').setFontSize(11); }catch(e){};
    });

  }
  function garantirSenhaResetObrigatoria(){
    const props = PropertiesService.getScriptProperties();

    if(!props.getProperty('SENHA_RESET')){
      // Define senha padrão
      props.setProperty('SENHA_RESET', SENHA_RESET_PADRAO);
      props.setProperty('RESET_SENHA_OBRIGATORIA', 'SIM');

      registrarLog(
        'RESET_SENHA_CONFIG',
        'Senha de reset configurada',
        SENHA_RESET_PADRAO,
        'Sistema'
      );
    }
  }
  function criarContaAReceber(origem, idVenda, cliente, valor, forma){
    garantirContasAReceber();

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('CONTAS_A_RECEBER');

    const dados = sh.getDataRange().getValues();
    let seq = 1;

    dados.slice(1).forEach(l => {
      const id = String(l[0] || '');
      if(id.startsWith('CR-')){
        const n = Number(id.replace('CR-',''));
        if(n >= seq) seq = n + 1;
      }
    });

    const id = 'CR-' + String(seq).padStart(6,'0');

    sh.appendRow([
      id,
      origem,           // COMANDA | DELIVERY
      idVenda,          // C-000012 | D-000008
      cliente || '',
      Number(valor),
      0,
      Number(valor),
      forma,            // FIADO | CRÉDITO
      'PENDENTE',
      agoraBrasil(),
      ''
    ]);

    sh.getRange(sh.getLastRow(), 5, 1, 3)
      .setNumberFormat('R$ #,##0.00');

    return id;
  }
  function validarClienteFiado(cliente){

    if(!cliente){
      throw new Error('Informe o cliente para venda fiado.');
    }

    const ss = SpreadsheetApp.getActive();
    const shCli = ss.getSheetByName('CLIENTES');

    if(!shCli){
      throw new Error('Aba CLIENTES não encontrada.');
    }

    const clientes = shCli
      .getDataRange()
      .getValues()
      .slice(1)
      .map(l => String(l[0]).trim().toUpperCase())
      .filter(Boolean);

    const nome = String(cliente).trim().toUpperCase();

    if(!clientes.includes(nome)){
      throw new Error(
        'Cliente não cadastrado.\nCadastre o cliente para usar FIADO.'
      );
    }

    // ✅ NÃO BLOQUEIA MAIS NOVO FIADO
    // Cada venda FIADO gera uma nova conta a receber
    return true;
  }
  function receberParcialContaAReceber(id, valor, forma){

    valor = Number(valor);
    if(valor <= 0){
      throw new Error('Valor inválido.');
    }

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('CONTAS_A_RECEBER');
    const dados = sh.getDataRange().getValues();

    const linha = dados.findIndex((l,i)=> i>0 && l[0] === id);
    if(linha < 0){
      throw new Error('Conta não encontrada.');
    }

    const total   = Number(dados[linha][4]) || 0;
    const recebido= Number(dados[linha][5]) || 0;
    const saldo   = Number(dados[linha][6]) || 0;

    if(valor > saldo){
      throw new Error('Valor maior que o saldo.');
    }

    const novoRecebido = recebido + valor;
    const novoSaldo    = total - novoRecebido;

    sh.getRange(linha+1,6).setValue(novoRecebido);
    sh.getRange(linha+1,7).setValue(novoSaldo);

    const statusAtualizado = novoSaldo === 0 ? 'QUITADO' : 'PARCIAL';

    sh.getRange(linha+1,9)
      .setValue(statusAtualizado);

    sh.getRange(linha+1,12)
      .setValue(statusAtualizado === 'QUITADO' ? agoraBrasil() : '');

    // 🔥 REGISTRA CAIXA (SEM AMARRAR A FISCAL AINDA)
    registrarCaixa(
      agoraBrasil(),
      'Entrada',
      valor,
      forma,
      'CONTAS_A_RECEBER',
      id
    );

    registrarLog(
      'RECEBIMENTO',
      id,
      recebido,
      novoRecebido
    );

    return true;
  }
  function gerarPainelFinanceiro(dataIni, dataFim){

    const ss = SpreadsheetApp.getActive();

    const ini = new Date(dataIni + 'T00:00:00');
    const fim = new Date(dataFim + 'T23:59:59');

    /* ============================
      CAIXA
    ============================ */
    const caixa = ss.getSheetByName('CAIXA').getDataRange().getValues();

    let entradas = 0;
    let saidas   = 0;

    caixa.forEach((l,i)=>{
      if(i === 0) return;

      const data = new Date(l[0]);
      if(data < ini || data > fim) return;

      if(l[1] === 'Entrada') entradas += Number(l[2]) || 0;
      if(l[1] === 'Saida')   saidas   += Number(l[2]) || 0;
    });

    /* ============================
      CONTAS A RECEBER (ACUMULADO)
    ============================ */
    let contasReceberHtml = '<p style="color:#64748b">Nenhuma conta a receber.</p>';
    const crSh = ss.getSheetByName('CONTAS_A_RECEBER');

    let nivelFiado = 0; // 🔥 KPI

    if(crSh){
      const cr = crSh.getDataRange().getValues().slice(1);
      const mapa = {};

      cr.forEach(l=>{
        const data = new Date(l[9]);
        const cliente = l[3];
        const saldo = Number(l[6]) || 0;
        const status = l[8];

        if(data < ini || data > fim) return;
        if(status === 'QUITADO') return;
        if(saldo <= 0) return;

        nivelFiado += saldo; // 🔥 acumula fiado

        if(!mapa[cliente]){
          mapa[cliente] = { saldo: 0, id: l[0] };
        }

        mapa[cliente].saldo += saldo;
      });

      if(Object.keys(mapa).length){
        contasReceberHtml = Object.keys(mapa).map(c=>`
          <div style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            border:1px solid #e5e7eb;
            border-radius:8px;
            padding:8px 10px;
            margin-bottom:6px
          ">
            <div>
              <strong>${c}</strong><br>
              <small>
                Saldo:
                <strong style="color:#dc2626">
                  R$ ${mapa[c].saldo.toFixed(2).replace('.',',')}
                </strong>
              </small>
            </div>

            <button
              style="
                width:110px;
                height:28px;
                font-size:12px;
                border-radius:6px;
                background:#16a34a;
                color:#fff;
                border:none;
                cursor:pointer;
                display:flex;
                align-items:center;
                justify-content:center
              "
              onclick="google.script.run.popupReceberClienteContaAReceber(decodeURIComponent('${encodeURIComponent(c)}'))">
              💰 Receber
            </button>        
          </div>
        `).join('');
      }
    }

    /* ============================
      CONTAS A PAGAR
    ============================ */
    let contasPagarHtml = '<p style="color:#64748b">Nenhuma conta a pagar.</p>';
    const cpSh = ss.getSheetByName('CONTAS_A_PAGAR');

    if(cpSh){
      const cp = cpSh.getDataRange().getValues().slice(1);

      const pendentes = cp.filter(l=>{
        const data = new Date(l[4]);
        return (
          data >= ini &&
          data <= fim &&
          l[5] === 'PENDENTE'
        );
      });

      if(pendentes.length){
        contasPagarHtml = pendentes.map(l=>`
          <div style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            border:1px solid #e5e7eb;
            border-radius:8px;
            padding:8px 10px;
            margin-bottom:6px
          ">
            <div>
              <strong>${l[1]}</strong><br>
              <small>
                Valor:
                <strong style="color:#dc2626">
                  R$ ${Number(l[2]).toFixed(2).replace('.',',')}
                </strong>
              </small>
            </div>

            <button
              style="
                width:110px;
                height:28px;
                font-size:12px;
                border-radius:6px;
                background:#dc2626;
                color:#fff;
                border:none;
                cursor:pointer;
                display:flex;
                align-items:center;
                justify-content:center
              "
              onclick="pagarConta('${l[0]}', this)">
              💸 Pagar
            </button>       
          </div>
        `).join('');
      }
    }

    const resultado = entradas - saidas;

    /* ============================
      HTML FINAL
    ============================ */
    return `
      <div style="display:flex;flex-direction:column;gap:12px">

        <div style="display:flex;gap:20px;font-size:14px;flex-wrap:wrap">
          <div>💰 Entradas: <strong>R$ ${entradas.toFixed(2).replace('.',',')}</strong></div>
          <div>💸 Saídas: <strong>R$ ${saidas.toFixed(2).replace('.',',')}</strong></div>
          <div>
            ⚖️ Resultado:
            <strong style="color:${resultado>=0?'#16a34a':'#dc2626'}">
              R$ ${resultado.toFixed(2).replace('.',',')}
            </strong>
          </div>
          <div>
            🧾 Fiado em Aberto:
            <strong style="color:#dc2626">
              R$ ${nivelFiado.toFixed(2).replace('.',',')}
            </strong>
          </div>
        </div>

        <hr>

        <h4>📌 Contas a Receber</h4>
        ${contasReceberHtml}

        <hr>

        <h4>📌 Contas a Pagar</h4>
        ${contasPagarHtml}

        <script>
          function pagarConta(id, btn){
            if(btn){
              btn.disabled = true;
              btn.innerText = '⏳ Pagando...';
            }

            google.script.run
              .withSuccessHandler(()=>{
                alert('Conta paga com sucesso!');
                if(google && google.script && google.script.host){
                  google.script.host.close();
                }
              })
              .withFailureHandler(e=>{
                alert((e && e.message) ? e.message : e);
                if(btn){
                  btn.disabled = false;
                  btn.innerText = '💸 Pagar';
                }
              })
              .pagarContaById(id);
          }
        </script>

      </div>
    `;
  }
  function gerarPainelFinanceiroMesAtual(){

    const hoje = new Date();
    const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);

    return gerarPainelFinanceiro(
      Utilities.formatDate(ini, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      Utilities.formatDate(fim, Session.getScriptTimeZone(), 'yyyy-MM-dd')
    );
  }
  function gerarRelatorioFinanceiroCompleto() {
    const ss = SpreadsheetApp.getActive();
    const caixa = ss.getSheetByName('CAIXA');
    const vendas = ss.getSheetByName('VENDAS');
    const compras = ss.getSheetByName('COMPRAS');
    const contasReceber = ss.getSheetByName('CONTAS_A_RECEBER');
    const contasPagar = ss.getSheetByName('CONTAS_A_PAGAR');

    let sh = ss.getSheetByName('RELATORIO_FINANCEIRO');
    if(!sh){
      sh = ss.insertSheet('RELATORIO_FINANCEIRO');
    }
    sh.clear();

    const dadosCaixa = caixa ? caixa.getDataRange().getValues().slice(1) : [];
    const dadosVendas = vendas ? vendas.getDataRange().getValues().slice(1) : [];
    const dadosCompras = compras ? compras.getDataRange().getValues().slice(1) : [];
    const dadosCR = contasReceber ? contasReceber.getDataRange().getValues().slice(1) : [];
    const dadosCP = contasPagar ? contasPagar.getDataRange().getValues().slice(1) : [];

    const totalEntradas = dadosCaixa
      .filter(l => String(l[1]).toUpperCase() === 'ENTRADA')
      .reduce((s, l) => s + (Number(l[2]) || 0), 0);

    const totalSaidas = dadosCaixa
      .filter(l => String(l[1]).toUpperCase() === 'SAIDA' || String(l[1]).toUpperCase() === 'SAÍDA')
      .reduce((s, l) => s + (Number(l[2]) || 0), 0);

    const totalVendas = dadosVendas.reduce((s, l) => s + (Number(l[3]) || 0), 0);
    const totalCompras = dadosCompras.reduce((s, l) => s + ((Number(l[3]) || 0)), 0);
    const totalCRAberto = dadosCR
      .filter(l => String(l[8]).toUpperCase() !== 'QUITADO')
      .reduce((s, l) => s + (Number(l[6]) || 0), 0);
    const totalCPendente = dadosCP
      .filter(l => String(l[5]).toUpperCase() === 'ABERTO' || String(l[5]).toUpperCase() === 'PENDENTE')
      .reduce((s, l) => s + (Number(l[2]) || 0), 0);

    const linhasResumo = [
      ['RELATÓRIO FINANCEIRO COMPLETO', '', ''],
      ['Gerado em', new Date(), ''],
      ['', '', ''],
      ['Métrica', 'Valor', 'Observação'],
      ['Entradas no Caixa', totalEntradas, 'Somatório CAIXA tipo Entrada'],
      ['Saídas no Caixa', totalSaidas, 'Somatório CAIXA tipo Saída'],
      ['Resultado Caixa', totalEntradas - totalSaidas, 'Entradas - Saídas'],
      ['Total Vendas', totalVendas, 'Somatório VENDAS coluna Valor'],
      ['Total Compras', totalCompras, 'Somatório COMPRAS'],
      ['Contas a Receber em Aberto', totalCRAberto, 'CONTAS_A_RECEBER não quitadas'],
      ['Contas a Pagar Pendentes', totalCPendente, 'CONTAS_A_PAGAR abertas/pendentes'],
      ['Resultado Gerencial Estimado', totalVendas - totalCompras - totalCPendente + totalCRAberto, 'Vendas - Compras - CP + CR']
    ];

    sh.getRange(1, 1, linhasResumo.length, 3).setValues(linhasResumo);

    sh.getRange('A1:C1').merge()
      .setFontWeight('bold')
      .setBackground('#020617')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center');

    sh.getRange('A4:C4')
      .setFontWeight('bold')
      .setBackground('#1e293b')
      .setFontColor('#ffffff');

    sh.getRange(5, 2, linhasResumo.length - 4, 1).setNumberFormat('R$ #,##0.00');
    sh.getRange('B2').setNumberFormat('dd/MM/yyyy HH:mm');

    sh.setColumnWidth(1, 300);
    sh.setColumnWidth(2, 170);
    sh.setColumnWidth(3, 360);

    aplicarFormatacaoPadrao(sh);

    registrarInformacaoImportanteNoDrive(
      'RELATORIO',
      'Relatório financeiro completo',
      [
        `Entradas caixa: R$ ${totalEntradas.toFixed(2)}`,
        `Saídas caixa: R$ ${totalSaidas.toFixed(2)}`,
        `Total vendas: R$ ${totalVendas.toFixed(2)}`,
        `Total compras: R$ ${totalCompras.toFixed(2)}`,
        `CR em aberto: R$ ${totalCRAberto.toFixed(2)}`,
        `CP pendente: R$ ${totalCPendente.toFixed(2)}`
      ].join('\n'),
      { subcategoria: 'Financeiro' }
    );

    ss.setActiveSheet(sh);
    SpreadsheetApp.getUi().alert('✅ Relatório financeiro completo gerado!');
  }
  function gerarRelatorioCompras() {
    const ss = SpreadsheetApp.getActive();
    const compras = ss.getSheetByName('COMPRAS');
    if(!compras){
      SpreadsheetApp.getUi().alert('❌ Aba COMPRAS não encontrada.');
      return;
    }

    const dados = compras.getDataRange().getValues();
    const itens = dados.slice(1);

    let sh = ss.getSheetByName('RELATORIO_COMPRAS');
    if(!sh){
      sh = ss.insertSheet('RELATORIO_COMPRAS');
    }
    sh.clear();

    const headers = ['Data', 'Produto', 'Qtd', 'Valor Unit.', 'Valor Total', 'Fornecedor'];
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#020617').setFontColor('#fff');

    const rows = [];
    let totalGeral = 0;

    itens.forEach(l => {
      const qtd = Number(l[2]) || 0;
      const valorBruto = Number(l[3]) || 0;
      const valorUnit = qtd > 0 ? (valorBruto / qtd) : 0;
      const valorTotal = valorBruto;
      totalGeral += valorTotal;

      rows.push([
        l[0] || '',
        l[1] || '',
        qtd,
        valorUnit,
        valorTotal,
        l[4] || ''
      ]);
    });

    if(rows.length){
      sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }

    const rowTotal = rows.length + 3;
    sh.getRange(rowTotal, 1).setValue('TOTAL GERAL').setFontWeight('bold');
    sh.getRange(rowTotal, 5).setValue(totalGeral).setFontWeight('bold').setNumberFormat('R$ #,##0.00');

    if(rows.length){
      sh.getRange(2, 1, rows.length, 1).setNumberFormat('dd/MM/yyyy HH:mm');
      sh.getRange(2, 4, rows.length, 2).setNumberFormat('R$ #,##0.00');
    }

    sh.setColumnWidth(1, 160);
    sh.setColumnWidth(2, 260);
    sh.setColumnWidth(3, 110);
    sh.setColumnWidth(4, 140);
    sh.setColumnWidth(5, 160);
    sh.setColumnWidth(6, 220);

    aplicarFormatacaoPadrao(sh);

    registrarInformacaoImportanteNoDrive(
      'RELATORIO',
      'Relatório de compras',
      [
        `Itens: ${rows.length}`,
        `Total comprado: R$ ${totalGeral.toFixed(2)}`
      ].join('\n'),
      { subcategoria: 'Compras' }
    );

    ss.setActiveSheet(sh);
    SpreadsheetApp.getUi().alert('✅ Relatório de compras gerado!');
  }
  function gerarRelatorioLogsSistema() {
    const ss = SpreadsheetApp.getActive();
    const logs = ss.getSheetByName('LOG_SISTEMA');
    if(!logs){
      SpreadsheetApp.getUi().alert('❌ Aba LOG_SISTEMA não encontrada.');
      return;
    }

    const dados = logs.getDataRange().getValues().slice(1);
    const porAcao = {};
    const porUsuario = {};

    dados.forEach(l => {
      const acao = String(l[3] || 'SEM_ACAO');
      const usuario = String(l[2] || 'Desconhecido');
      porAcao[acao] = (porAcao[acao] || 0) + 1;
      porUsuario[usuario] = (porUsuario[usuario] || 0) + 1;
    });

    let sh = ss.getSheetByName('RELATORIO_LOGS');
    if(!sh){
      sh = ss.insertSheet('RELATORIO_LOGS');
    }
    sh.clear();

    sh.getRange('A1:D1').merge()
      .setValue('RELATÓRIO DE LOGS DO SISTEMA')
      .setFontWeight('bold')
      .setBackground('#020617')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center');

    sh.getRange('A2').setValue('Gerado em');
    sh.getRange('B2').setValue(new Date()).setNumberFormat('dd/MM/yyyy HH:mm:ss');
    sh.getRange('A3').setValue('Total de logs');
    sh.getRange('B3').setValue(dados.length);

    sh.getRange('A5:B5').setValues([['Ação', 'Qtde']])
      .setFontWeight('bold').setBackground('#1e293b').setFontColor('#fff');

    let row = 6;
    Object.keys(porAcao).sort().forEach(acao => {
      sh.getRange(row, 1, 1, 2).setValues([[acao, porAcao[acao]]]);
      row++;
    });

    sh.getRange('D5:E5').setValues([['Usuário', 'Qtde']])
      .setFontWeight('bold').setBackground('#1e293b').setFontColor('#fff');

    row = 6;
    Object.keys(porUsuario).sort().forEach(usuario => {
      sh.getRange(row, 4, 1, 2).setValues([[usuario, porUsuario[usuario]]]);
      row++;
    });

    sh.setColumnWidth(1, 280);
    sh.setColumnWidth(2, 90);
    sh.setColumnWidth(4, 280);
    sh.setColumnWidth(5, 90);

    aplicarFormatacaoPadrao(sh);

    registrarInformacaoImportanteNoDrive(
      'RELATORIO',
      'Relatório de logs do sistema',
      [
        `Total de logs: ${dados.length}`,
        `Ações diferentes: ${Object.keys(porAcao).length}`,
        `Usuários com ação: ${Object.keys(porUsuario).length}`
      ].join('\n'),
      { subcategoria: 'Logs' }
    );

    ss.setActiveSheet(sh);
    SpreadsheetApp.getUi().alert('✅ Relatório de logs gerado!');
  }
  function aplicarFormatacaoFinanceiraTodasAbas() {
    const ss = SpreadsheetApp.getActive();
    const padraoMoeda = ['VALOR', 'PREÇO', 'PRECO', 'CUSTO', 'TOTAL', 'SALDO', 'LUCRO'];

    ss.getSheets().forEach(sh => {
      aplicarFormatacaoPadrao(sh);

      const lastRow = sh.getLastRow();
      const lastCol = sh.getLastColumn();
      if(lastCol <= 0) return;

      for(let c=1;c<=lastCol;c++){
        const header = String(sh.getRange(1, c).getValue() || '').toUpperCase();
        const isMoeda = padraoMoeda.some(k => header.includes(k));
        if(isMoeda && lastRow > 1){
          sh.getRange(2, c, lastRow - 1, 1).setNumberFormat('R$ #,##0.00');
        }

        const largura = isMoeda ? 150 : Math.max(sh.getColumnWidth(c), 130);
        sh.setColumnWidth(c, largura);
      }
    });

    SpreadsheetApp.getUi().alert('✅ Formatação padrão aplicada em todas as abas (incluindo colunas monetárias).');
  }
  function gerarPacoteRelatoriosGerenciais() {
    gerarRelatorioValoresEstoque();
    gerarRelatorioFinanceiroCompleto();
    gerarRelatorioCompras();
    gerarRelatorioLogsSistema();
    aplicarFormatacaoFinanceiraTodasAbas();

    registrarInformacaoImportanteNoDrive(
      'RELATORIO',
      'Pacote de relatórios gerenciais',
      'Foram gerados relatórios: Estoque Valores, Financeiro Completo, Compras e Logs.',
      { subcategoria: 'Gerencial' }
    );
  }

/*************************************************
*                 🔵 V2.1
**************************************************
* =====================================================
* 📊 MÓDULO DE GESTÃO DE ESTOQUE COM VALORES
* =====================================================
* Sistema completo para gerenciar estoque com:
* - Valores totais de estoque
* - Valores após venda
* - Preços praticados
* - Análise de rentabilidade
* 
* Data: 2026-02
* Versão: 2.1.0
* =====================================================
*/
  // GESTÃO ESTOQUE
  function calcularValoresEstoque(estoque, produtos, vendas) {
    
    const relatorio = [];
    let totalValorAtual = 0;
    let totalValorCusto = 0;
    let totalVendido = 0;
    let lucroTotal = 0;
    
    estoque.forEach(linha => {
      const nomeProduto = linha[0].toString().trim();
      const quantidadeAtual = Number(linha[1]) || 0;
      const minimo = Number(linha[2]) || 0;
      
      const produto = produtos[nomeProduto];
      
      if (!produto) return;
      
      const precoVenda = produto.preco;
      const custMedio = produto.custMedio;
      const margem = produto.margem;
      
      // Valores atuais de estoque
      const valorTotalEstoque = quantidadeAtual * precoVenda;
      const custTotalEstoque = quantidadeAtual * custMedio;
      const lucroEstoque = valorTotalEstoque - custTotalEstoque;
      
      // Calcula quantidade vendida (para análise)
      const qtdVendida = calcularQuantidadeVendida(nomeProduto, vendas);
      const valorVendido = qtdVendida * precoVenda;
      const custVendido = qtdVendida * custMedio;
      const lucroVendido = valorVendido - custVendido;
      
      // Avalia status do estoque
      let status = 'Normal';
      if (quantidadeAtual <= minimo) {
        status = '🚨 Crítico';
      } else if (quantidadeAtual <= minimo * 1.5) {
        status = '⚠️ Baixo';
      } else if (quantidadeAtual > minimo * 3) {
        status = '📈 Alto';
      }
      
      relatorio.push({
        produto: nomeProduto,
        categoria: produto.categoria,
        precoVenda: precoVenda,
        custMedio: custMedio,
        margem: margem,
        // ESTOQUE ATUAL
        qtdAtual: quantidadeAtual,
        valorTotalEstoque: valorTotalEstoque,
        custTotalEstoque: custTotalEstoque,
        lucroEstoque: lucroEstoque,
        // VENDAS
        qtdVendida: qtdVendida,
        valorVendido: valorVendido,
        custVendido: custVendido,
        lucroVendido: lucroVendido,
        // ANÁLISE
        taxaRotacao: calcularTaxaRotacao(quantidadeAtual, qtdVendida),
        status: status
      });
      
      totalValorAtual += valorTotalEstoque;
      totalValorCusto += custTotalEstoque;
      totalVendido += valorVendido;
      lucroTotal += lucroVendido;
    });
    
    return {
      itens: relatorio,
      resumo: {
        totalValorEstoque: totalValorAtual,
        totalCustoEstoque: totalValorCusto,
        lucroEstoque: totalValorAtual - totalValorCusto,
        totalVendido: totalVendido,
        lucroVendido: lucroTotal,
        margemMedia: calcularMargemMedia(relatorio)
      }
    };
  }
  function obterDadosEstoque() {
    const sh = SpreadsheetApp.getActive().getSheetByName('ESTOQUE');
    if(!sh) return [];
    const dados = sh.getDataRange().getValues();
    return dados.length > 1 ? dados.slice(1) : [];
  }
  function obterDadosProdutos() {
    const sh = SpreadsheetApp.getActive().getSheetByName('PRODUTOS');
    if(!sh) return {};

    const dados = sh.getDataRange().getValues();
    const mapa = {};

    for(let i=1;i<dados.length;i++){
      const produto = String(dados[i][0] || '').trim();
      if(!produto) continue;

      mapa[produto] = {
        categoria: String(dados[i][1] || 'SEM CATEGORIA'),
        preco: Number(dados[i][4]) || 0,
        minimo: Number(dados[i][5]) || 0,
        custMedio: Number(dados[i][6]) || 0,
        margem: Number(dados[i][7]) || 0
      };
    }

    return mapa;
  }
  function obterDadosVendas() {
    const sh = SpreadsheetApp.getActive().getSheetByName('VENDAS');
    if(!sh) return [];
    const dados = sh.getDataRange().getValues();
    return dados.length > 1 ? dados.slice(1) : [];
  }
  function calcularQuantidadeVendida(produto, vendas) {
    const chave = String(produto || '').trim().toUpperCase();
    return vendas.reduce((acc, item) => {
      const prod = String(item[1] || '').trim().toUpperCase();
      if(prod !== chave) return acc;
      return acc + (Number(item[2]) || 0);
    }, 0);
  }
  function calcularTaxaRotacao(qtdAtual, qtdVendida) {
    const base = (Number(qtdAtual) || 0) + (Number(qtdVendida) || 0);
    if(base <= 0) return 0;
    return Number(((Number(qtdVendida) || 0) / base * 100).toFixed(2));
  }
  function calcularMargemMedia(relatorio) {
    if(!relatorio || !relatorio.length) return 0;
    const soma = relatorio.reduce((acc, item) => acc + (Number(item.margem) || 0), 0);
    return Number((soma / relatorio.length).toFixed(2));
  }
  function gerarRelatorioEstoqueComValores() {
    const estoque = obterDadosEstoque();
    const produtos = obterDadosProdutos();
    const vendas = obterDadosVendas();

    const relatorio = calcularValoresEstoque(estoque, produtos, vendas);

    const ss = SpreadsheetApp.getActive();
    let sh = ss.getSheetByName('ESTOQUE_VALORES');

    if(!sh){
      sh = ss.insertSheet('ESTOQUE_VALORES');
    }

    sh.clear();

    const headers = [
      'Produto', 'Categoria', 'Preço Venda', 'Custo Médio', 'Margem %',
      'Qtd Atual', 'Valor Estoque', 'Custo Estoque', 'Lucro Estoque',
      'Qtd Vendida', 'Valor Vendido', 'Lucro Vendido', 'Rotação %', 'Status'
    ];

    sh.getRange(1, 1, 1, headers.length)
      .setValues([headers])
      .setFontWeight('bold')
      .setBackground('#020617')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center');

    if(relatorio.itens.length){
      const rows = relatorio.itens.map(i => [
        i.produto,
        i.categoria,
        i.precoVenda,
        i.custMedio,
        i.margem,
        i.qtdAtual,
        i.valorTotalEstoque,
        i.custTotalEstoque,
        i.lucroEstoque,
        i.qtdVendida,
        i.valorVendido,
        i.lucroVendido,
        i.taxaRotacao,
        i.status
      ]);

      sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }

    const rowTotal = relatorio.itens.length + 3;
    sh.getRange(rowTotal, 1, 1, headers.length).setBackground('#e2e8f0').setFontWeight('bold');
    sh.getRange(rowTotal, 1).setValue('RESUMO GERAL');
    sh.getRange(rowTotal, 7).setValue(relatorio.resumo.totalValorEstoque);
    sh.getRange(rowTotal, 8).setValue(relatorio.resumo.totalCustoEstoque);
    sh.getRange(rowTotal, 9).setValue(relatorio.resumo.lucroEstoque);
    sh.getRange(rowTotal, 11).setValue(relatorio.resumo.totalVendido);
    sh.getRange(rowTotal, 12).setValue(relatorio.resumo.lucroVendido);
    sh.getRange(rowTotal, 13).setValue(relatorio.resumo.margemMedia);

    sh.getRange(2, 3, Math.max(1, relatorio.itens.length + 2), 2).setNumberFormat('R$ #,##0.00');
    sh.getRange(2, 5, Math.max(1, relatorio.itens.length + 2), 1).setNumberFormat('0.00"%"');
    sh.getRange(2, 7, Math.max(1, relatorio.itens.length + 2), 3).setNumberFormat('R$ #,##0.00');
    sh.getRange(2, 11, Math.max(1, relatorio.itens.length + 2), 2).setNumberFormat('R$ #,##0.00');
    sh.getRange(2, 13, Math.max(1, relatorio.itens.length + 2), 1).setNumberFormat('0.00"%"');

    sh.setFrozenRows(1);
    sh.setColumnWidths(1, headers.length, 150);
    sh.setColumnWidth(1, 240);
    sh.setColumnWidth(2, 150);
    aplicarFormatacaoPadrao(sh);

    registrarInformacaoImportanteNoDrive(
      'RELATORIO',
      'Relatório de valores do estoque',
      [
        `Itens: ${relatorio.itens.length}`,
        `Valor total estoque: R$ ${relatorio.resumo.totalValorEstoque.toFixed(2)}`,
        `Lucro potencial estoque: R$ ${relatorio.resumo.lucroEstoque.toFixed(2)}`,
        `Total vendido: R$ ${relatorio.resumo.totalVendido.toFixed(2)}`
      ].join('\n'),
      { subcategoria: 'Estoque' }
    );

    return relatorio;
  }
  function gerarRelatorioValoresEstoque() {
    const relatorio = gerarRelatorioEstoqueComValores();
    if(!relatorio){
      SpreadsheetApp.getUi().alert('❌ Não foi possível gerar o relatório de valores.');
      return;
    }

    const sh = SpreadsheetApp.getActive().getSheetByName('ESTOQUE_VALORES');
    if(sh){
      SpreadsheetApp.getActive().setActiveSheet(sh);
    }

    SpreadsheetApp.getUi().alert('✅ Relatório de valores do estoque atualizado!');
  }
  function obterValorTotalEstoque() {
    const relatorio = gerarRelatorioEstoqueComValores();
    return relatorio ? Number(relatorio.resumo.totalValorEstoque || 0) : 0;
  }
  function obterValorEstoquesPorCategoria() {
    const relatorio = gerarRelatorioEstoqueComValores();
    const out = {};

    (relatorio ? relatorio.itens : []).forEach(item => {
      const cat = item.categoria || 'SEM CATEGORIA';
      if(!out[cat]){
        out[cat] = { quantidade: 0, valor: 0, custo: 0 };
      }

      out[cat].quantidade += Number(item.qtdAtual) || 0;
      out[cat].valor += Number(item.valorTotalEstoque) || 0;
      out[cat].custo += Number(item.custTotalEstoque) || 0;
    });

    return out;
  }
  function analisarRentabilidadeEstoque() {
    const relatorio = gerarRelatorioEstoqueComValores();
    if(!relatorio || !relatorio.itens.length){
      return {
        maisRentaveis: [],
        estoqueCritico: [],
        altaRotacao: [],
        quaseNenhumavenda: []
      };
    }

    const itens = relatorio.itens.slice();

    return {
      maisRentaveis: itens
        .slice()
        .sort((a, b) => Number(b.lucroVendido || b.lucroEstoque) - Number(a.lucroVendido || a.lucroEstoque)),
      estoqueCritico: itens.filter(i => String(i.status).includes('Crítico')),
      altaRotacao: itens.filter(i => Number(i.taxaRotacao) >= 70),
      quaseNenhumavenda: itens.filter(i => Number(i.qtdVendida) <= 1)
    };
  }
  function abrirPainelEstoqueValores() {
    try {
      const relatorio = gerarRelatorioEstoqueComValores();
      
      if (!relatorio) {
        return;
      }
      
      const ss = SpreadsheetApp.getActive();
      const sh = ss.getSheetByName('ESTOQUE_VALORES');
      
      if (sh) {
        ss.setActiveSheet(sh);
        SpreadsheetApp.flush();
      }
      
    } catch (e) {
      console.error('Erro em abrirPainelEstoqueValores:', e);
      SpreadsheetApp.getUi().alert('❌ Erro ao abrir painel: ' + e.message);
    }
  }
  function abrirAnalisRentabilidade() {
    try {
      const analise = analisarRentabilidadeEstoque();
      
      if (!analise) {
        SpreadsheetApp.getUi().alert('❌ Erro ao gerar análise');
        return;
      }
      
      const ss = SpreadsheetApp.getActive();
      let sh = ss.getSheetByName('ANALISE_RENTABILIDADE');
      
      if (!sh) {
        sh = ss.insertSheet('ANALISE_RENTABILIDADE');
      }
      
      sh.clear();
      
      // ========== MAIS RENTÁVEIS ==========
      sh.getRange('A1:B1').merge()
        .setValue('🏆 PRODUTOS MAIS RENTÁVEIS')
        .setFontWeight('bold')
        .setBackground('#dcfce7')
        .setFontSize(12);
      
      let row = 2;
      analise.maisRentaveis.slice(0, 10).forEach((item, idx) => {
        sh.getRange(row, 1).setValue(`${idx + 1}. ${item.produto}`);
        sh.getRange(row, 2).setValue(item.lucro);
        sh.getRange(row, 2).setNumberFormat('R$ #,##0.00');
        row++;
      });
      
      // ========== ESTOQUE CRÍTICO ==========
      row = 2;
      const colStart = 4;
      sh.getRange(row - 1, colStart, 1, 2).merge()
        .setValue('🚨 ESTOQUE CRÍTICO')
        .setFontWeight('bold')
        .setBackground('#fee2e2')
        .setFontSize(12);
      
      analise.estoqueCritico.forEach((item, idx) => {
        sh.getRange(row, colStart).setValue(`${idx + 1}. ${item.produto}`);
        sh.getRange(row, colStart + 1).setValue(item.quantidade);
        row++;
      });
      
      // ========== ALTA ROTAÇÃO ==========
      row = 2;
      const colStart2 = 7;
      sh.getRange(row - 1, colStart2, 1, 2).merge()
        .setValue('📈 ALTA ROTAÇÃO (>70%)')
        .setFontWeight('bold')
        .setBackground('#dbeafe')
        .setFontSize(12);
      
      analise.altaRotacao.forEach((item, idx) => {
        sh.getRange(row, colStart2).setValue(`${idx + 1}. ${item.produto}`);
        sh.getRange(row, colStart2 + 1).setValue(item.taxaRotacao + '%');
        row++;
      });
      
      sh.setColumnWidths(1, 8, 150);
      SpreadsheetApp.getUi().alert('✅ Análise de rentabilidade atualizada!');
      
    } catch (e) {
      console.error('Erro em abrirAnalisRentabilidade:', e);
      SpreadsheetApp.getUi().alert('❌ Erro: ' + e.message);
    }
  }
  function exibirValorCategoria() {
    try {
      const porCategoria = obterValorEstoquesPorCategoria();
      
      const ss = SpreadsheetApp.getActive();
      let sh = ss.getSheetByName('ESTOQUE_CATEGORIAS');
      
      if (!sh) {
        sh = ss.insertSheet('ESTOQUE_CATEGORIAS');
      }
      
      sh.clear();
      
      // Cabeçalho
      const headers = ['Categoria', 'Quantidade', 'Valor Estoque', 'Valor Custo', 'Lucro Potencial', 'Margem %'];
      sh.getRange(1, 1, 1, headers.length)
        .setValues([headers])
        .setFontWeight('bold')
        .setBackground('#020617')
        .setFontColor('#ffffff')
        .setHorizontalAlignment('center');
      
      let row = 2;
      let totalQtd = 0;
      let totalValor = 0;
      let totalCusto = 0;
      
      Object.entries(porCategoria).forEach(([categoria, dados]) => {
        const lucro = dados.valor - dados.custo;
        const margem = dados.valor > 0 ? ((lucro / dados.valor) * 100) : 0;
        
        sh.getRange(row, 1).setValue(categoria);
        sh.getRange(row, 2).setValue(dados.quantidade);
        sh.getRange(row, 3).setValue(dados.valor);
        sh.getRange(row, 4).setValue(dados.custo);
        sh.getRange(row, 5).setValue(lucro);
        sh.getRange(row, 6).setValue(margem);
        
        // Formatação
        sh.getRange(row, 3).setNumberFormat('R$ #,##0.00');
        sh.getRange(row, 4).setNumberFormat('R$ #,##0.00');
        sh.getRange(row, 5).setNumberFormat('R$ #,##0.00');
        sh.getRange(row, 6).setNumberFormat('0.00"%"');
        
        // Cores
        if (lucro < 0) {
          sh.getRange(row, 5).setFontColor('#dc2626');
        } else if (lucro > 0) {
          sh.getRange(row, 5).setFontColor('#16a34a');
        }
        
        totalQtd += dados.quantidade;
        totalValor += dados.valor;
        totalCusto += dados.custo;
        
        row++;
      });
      
      // Totais
      row++;
      sh.getRange(row, 1).setValue('TOTAL')
        .setFontWeight('bold');
      sh.getRange(row, 2).setValue(totalQtd)
        .setFontWeight('bold');
      sh.getRange(row, 3).setValue(totalValor)
        .setNumberFormat('R$ #,##0.00')
        .setFontWeight('bold');
      sh.getRange(row, 4).setValue(totalCusto)
        .setNumberFormat('R$ #,##0.00')
        .setFontWeight('bold');
      
      const lucroTotal = totalValor - totalCusto;
      sh.getRange(row, 5).setValue(lucroTotal)
        .setNumberFormat('R$ #,##0.00')
        .setFontWeight('bold');
      
      if (lucroTotal > 0) {
        sh.getRange(row, 5).setFontColor('#16a34a');
      }
      
      sh.setColumnWidths(1, headers.length, 150);
      SpreadsheetApp.getUi().alert('✅ Tabela de categorias atualizada!');
      
    } catch (e) {
      console.error('Erro em exibirValorCategoria:', e);
      SpreadsheetApp.getUi().alert('❌ Erro: ' + e.message);
    }
  }
  function exibirValorTotalEstoque() {
    try {
      const valor = obterValorTotalEstoque();
      const estoque = obterDadosEstoque();
      const produtos = obterDadosProdutos();
      
      let custTotal = 0;
      estoque.forEach(linha => {
        const nomeProduto = linha[0].toString().trim();
        const quantidade = Number(linha[1]) || 0;
        const produto = produtos[nomeProduto];
        
        if (produto) {
          custTotal += quantidade * produto.custMedio;
        }
      });
      
      const lucro = valor - custTotal;
      
      const mensagem = 
        `💰 VALOR TOTAL DO ESTOQUE\n\n` +
        `📦 Quantidade de Produtos: ${estoque.length}\n` +
        `📊 Valor Total (Preço Venda): R$ ${valor.toFixed(2)}\n` +
        `💸 Valor Total (Custo): R$ ${custTotal.toFixed(2)}\n` +
        `💹 Lucro Potencial: R$ ${lucro.toFixed(2)}\n` +
        `📈 Margem: ${((lucro / valor) * 100).toFixed(2)}%`;
      
      SpreadsheetApp.getUi().alert(mensagem);
      
    } catch (e) {
      console.error('Erro em exibirValorTotalEstoque:', e);
      SpreadsheetApp.getUi().alert('❌ Erro: ' + e.message);
    }
  }
  function atualizarWidgetValorEstoque() {
    try {
      const ss = SpreadsheetApp.getActive();
      const sh = ss.getSheetByName('HOME');
      
      if (!sh) return;
      
      const valor = obterValorTotalEstoque();
      
      // Encontrar célula com "Valor Estoque" e atualizar
      const dados = sh.getDataRange().getValues();
      
      // Você pode customizar a célula aqui
      sh.getRange('A1').setValue(`💰 Valor Total Estoque: R$ ${valor.toFixed(2)}`);
      
    } catch (e) {
      console.error('Erro em atualizarWidgetValorEstoque:', e);
    }
  }
  function verificarEstoqueCriticoAuto() {
    try {
      const analise = analisarRentabilidadeEstoque();
      
      if (!analise || analise.estoqueCritico.length === 0) {
        return;
      }
      
      const relatorio = gerarRelatorioEstoqueComValores();
      
      const criticos = relatorio.itens.filter(item => 
        item.status.includes('Crítico')
      );
      
      if (criticos.length > 0) {
        const lista = criticos
          .map(p => `- ${p.produto} (${p.qtdAtual} unidades - R$ ${p.valorTotalEstoque.toFixed(2)})`)
          .join('\n');
        
        const mensagem = 
          `🚨 ALERTA: PRODUTOS EM ESTOQUE CRÍTICO\n\n` +
          lista + `\n\n` +
          `Valor total comprometido: R$ ${
            criticos.reduce((s, p) => s + p.valorTotalEstoque, 0).toFixed(2)
          }`;
        
        console.warn(mensagem);
        
        // Você pode enviar email aqui
        // MailApp.sendEmail('gerente@email.com', '🚨 Alerta Estoque Crítico', mensagem);
      }
      
    } catch (e) {
      console.error('Erro em verificarEstoqueCriticoAuto:', e);
    }
  }
  function setupMonitoramentoEstoque() {
    // Remove triggers antigos
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(t => {
      if (t.getHandlerFunction() === 'monitorarEstoqueAuto') {
        ScriptApp.deleteTrigger(t);
      }
    });
    
    // Cria novo trigger
    ScriptApp.newTrigger('monitorarEstoqueAuto')
      .timeBased()
      .everyHours(1)
      .create();
    
    SpreadsheetApp.getUi().alert('✅ Monitoramento ativado!');
  }
  function monitorarEstoqueAuto() {
    try {
      // Atualiza relatório
      gerarRelatorioEstoqueComValores();
      
      // Verifica críticos
      verificarEstoqueCriticoAuto();
      
      // Atualiza widget na HOME
      atualizarWidgetValorEstoque();
      
      console.log('Monitoramento de estoque realizado com sucesso');
      
    } catch (e) {
      console.error('Erro no monitoramento automático:', e);
    }
  }
  function exportarAnaliseEstoqueCSV() {
    try {
      const relatorio = gerarRelatorioEstoqueComValores();
      
      if (!relatorio) return;
      
      let csv = 'Produto,Categoria,Preço,Custo,Margem %,Qtd Estoque,Valor Estoque,Lucro Estoque,Qtd Vendida,Taxa Rotação\n';
      
      relatorio.itens.forEach(item => {
        csv += `"${item.produto}","${item.categoria}",${item.precoVenda},${item.custMedio},${item.margem},${item.qtdAtual},${item.valorTotalEstoque},${item.lucroEstoque},${item.qtdVendida},${item.taxaRotacao}\n`;
      });
      
      console.log(csv);
      SpreadsheetApp.getUi().alert('✅ CSV gerado (veja console)');
      
    } catch (e) {
      console.error('Erro ao exportar CSV:', e);
    }
  }
  function gerarRelatórioExecutivo() {
    try {
      const registroRelatorio = registrarInformacaoImportanteNoDrive(
        'RELATORIO',
        'Relatório executivo de estoque',
        `Relatório executivo solicitado em ${new Date().toLocaleString('pt-BR')}`,
        { subcategoria: 'Estoque' }
      );
      const relatorio = gerarRelatorioEstoqueComValores();
      const analise = analisarRentabilidadeEstoque();
      
      if (!relatorio || !analise) return;
      
      const resumo = relatorio.resumo;
      
      const texto = 
        `╔══════════════════════════════════════════╗\n` +
        `║     RELATÓRIO EXECUTIVO DE ESTOQUE      ║\n` +
        `╚══════════════════════════════════════════╝\n\n` +
        
        `📊 SITUAÇÃO ATUAL\n` +
        `├─ Total Produtos: ${relatorio.itens.length}\n` +
        `├─ Valor Total: R$ ${resumo.totalValorEstoque.toFixed(2)}\n` +
        `├─ Custo Total: R$ ${resumo.totalCustoEstoque.toFixed(2)}\n` +
        `└─ Lucro Potencial: R$ ${resumo.lucroEstoque.toFixed(2)}\n\n` +
        
        `💰 HISTÓRICO DE VENDAS\n` +
        `├─ Total Vendido: R$ ${resumo.totalVendido.toFixed(2)}\n` +
        `├─ Lucro Realizado: R$ ${resumo.lucroVendido.toFixed(2)}\n` +
        `└─ Margem Média: ${resumo.margemMedia.toFixed(2)}%\n\n` +
        
        `🚨 ALERTAS\n` +
        `├─ Produtos Críticos: ${analise.estoqueCritico.length}\n` +
        `├─ Sem Vendas: ${analise.quaseNenhumavenda.length}\n` +
        `└─ Alta Rotação: ${analise.altaRotacao.length}\n\n` +
        
        `🏆 TOP 3 PRODUTOS\n` +
        analise.maisRentaveis.slice(0, 3).map((p, i) => 
          `${i + 1}. ${p.produto} (R$ ${p.lucro.toFixed(2)})`
        ).join('\n');
      
      console.log(texto);

      if(registroRelatorio && registroRelatorio.url){
        console.log('Relatório executivo registrado no Drive:', registroRelatorio.url);
      }

      SpreadsheetApp.getUi().alert(texto);
      
    } catch (e) {
      console.error('Erro ao gerar relatório executivo:', e);
    }
  }
  function enviarRelatorioEmail(destinatario) {
    try {
      const relatorio = gerarRelatorioEstoqueComValores();
      
      if (!relatorio) return;
      
      const resumo = relatorio.resumo;
      
      const corpo = 
        `Relatório de Estoque com Valores\n\n` +
        `Valor Total do Estoque: R$ ${resumo.totalValorEstoque.toFixed(2)}\n` +
        `Lucro Potencial: R$ ${resumo.lucroEstoque.toFixed(2)}\n` +
        `Margem Média: ${resumo.margemMedia.toFixed(2)}%\n\n` +
        `Gerado em: ${new Date().toLocaleString('pt-BR')}`;
      
      // Descomente para usar:
      // MailApp.sendEmail(destinatario, '📊 Relatório de Estoque', corpo);
      
      console.log('Email preparado para envio (descomente código)');
      
    } catch (e) {
      console.error('Erro ao enviar email:', e);
    }
  }
