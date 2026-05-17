// ===============================
// CONTAS A PAGAR
// ===============================

  function popupContaAPagar(){

    const html = `
    <div style="font-family:Arial;display:flex;flex-direction:column;gap:10px">

      <h3>🧾 Nova Conta a Pagar</h3>

      <label>Tipo</label>
      <select id="tipo">
        <option value="FIXA">Conta Fixa</option>
        <option value="AVULSA">Conta Avulsa</option>
      </select>

      <label>Descrição / Fornecedor</label>
      <input id="fornecedor" placeholder="Ex: Aluguel, Energia, Internet">

      <label>Valor</label>
      <input id="valor" placeholder="Ex: 1200,50">

      <label>Forma de Pagamento</label>
      <select id="forma">
        <option>⚡PIX</option>
        <option>🧾BOLETO</option>
        <option>💵DINHEIRO</option>
        <option>🔄TRANSFERÊNCIA</option>
      </select>

      <label>Data de Vencimento</label>
      <input id="data" type="date">

      <button id="btnSalvar" onclick="salvar(this)">💾 Registrar Conta</button>
      <button onclick="google.script.host.close()">❌ Cancelar</button>

      <script>
        function salvar(btn){

          if(btn.disabled) return;
          btn.disabled = true;
          btn.innerText = '⏳ Salvando...';

          const valorLimpo = valor.value
            .replace(/[^0-9,]/g,'')
            .replace(',','.');

          const dados = {
            tipo: tipo.value,
            fornecedor: fornecedor.value.trim(),
            valor: Number(valorLimpo),
            forma: forma.value,
            data: data.value
          };

          if(!dados.fornecedor || !dados.valor || !dados.data){
            alert('Preencha todos os campos corretamente.');
            btn.disabled = false;
            btn.innerText = '💾 Registrar Conta';
            return;
          }

          google.script.run
            .withSuccessHandler(()=>{
              alert('Conta registrada com sucesso!');
              google.script.host.close();
            })
            .withFailureHandler(e=>{
              alert(e.message || e);
              btn.disabled = false;
              btn.innerText = '💾 Registrar Conta';
            })
            .registrarContaManual(dados);
        }
      </script>
    </div>
    `;

    abrirPopup('🧾 Contas a Pagar', html, 420, 420);
  }
  function registrarContaManual(dados){

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('CONTAS_A_PAGAR');

    if(!sh){
      throw new Error('Aba CONTAS_A_PAGAR não encontrada.');
    }

    // 🔢 ID SEQUENCIAL AVULSA
    const plan = sh.getDataRange().getValues();
    let proximo = 1;

    plan.slice(1).forEach(l=>{
      const id = String(l[0] || '');
      if(id.startsWith('AVULSA_')){
        const n = Number(id.replace('AVULSA_',''));
        if(n >= proximo) proximo = n + 1;
      }
    });

    const id = dados.tipo === 'FIXA'
      ? `FIXA_${dados.fornecedor.toUpperCase().replace(/\s+/g,'_')}`
      : `AVULSA_${String(proximo).padStart(4,'0')}`;

    sh.appendRow([
      id,
      dados.fornecedor,
      dados.valor,
      dados.forma,
      new Date(dados.data + 'T00:00:00'),
      'PENDENTE',
      ''
    ]);

    const linha = sh.getLastRow();

    // 🎨 FORMATAÇÃO PADRÃO
    sh.getRange(linha,1,1,sh.getLastColumn())
      .setFontSize(10)
      .setHorizontalAlignment('center');

    sh.getRange(linha,3)
      .setNumberFormat('R$ #,##0.00');

    registrarLog(
      'CONTA_A_PAGAR',
      'Conta registrada manualmente',
      '',
      dados
    );

    return true;
  }
  function popupContasAPagarPendentes(){

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('CONTAS_A_PAGAR');

    const dados = sh.getDataRange().getValues()
      .map((l,i)=>({ linha:i+1, dados:l }))
      .slice(1)
      .filter(o => o.dados[5] === 'PENDENTE');

    if(!dados.length){
      SpreadsheetApp.getUi().alert('Nenhuma conta pendente.');
      return;
    }

    const html = `
    <div style="font-family:Arial;display:flex;flex-direction:column;gap:10px">

      <h3>💰 Contas a Pagar – Pendentes</h3>

      ${dados.map(o=>`
        <div style="border:1px solid #e5e7eb;padding:10px;border-radius:8px">
          <strong>${o.dados[1]}</strong><br>
          💵 R$ ${Number(o.dados[2]).toFixed(2).replace('.',',')}<br>
          📅 Venc: ${Utilities.formatDate(
            new Date(o.dados[4]),
            Session.getScriptTimeZone(),
            'dd/MM/yyyy'
          )}<br>
          <button onclick="pagar(${o.linha}, this)">💸 Pagar</button>
        </div>
      `).join('')}

      <button onclick="google.script.host.close()">❌ Fechar</button>

      <script>
        function pagar(linha, btn){
          if(btn.disabled) return;
          btn.disabled = true;
          btn.innerText = '⏳ Processando...';

          google.script.run
            .withSuccessHandler(()=>{
              alert('Conta paga com sucesso!');
              google.script.host.close();
            })
            .withFailureHandler(e=>{
              alert(e.message || e);
              btn.disabled = false;
              btn.innerText = '💸 Pagar';
            })
            .pagarContaAPagar(linha);
        }
      </script>
    </div>
    `;

    abrirPopup('💰 Contas a Pagar', html, 420, 520);
  }
  function pagarContaAPagar(linha){

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('CONTAS_A_PAGAR');

    const status = sh.getRange(linha, 6).getValue();
    if(status === 'PAGO'){
      throw new Error('Conta já paga.');
    }

    const fornecedor = sh.getRange(linha, 2).getValue();
    const valor      = Number(sh.getRange(linha, 3).getValue()) || 0;
    const formaPgto  = sh.getRange(linha, 4).getValue();

    sh.getRange(linha, 6).setValue('PAGO');
    sh.getRange(linha, 7)
      .setValue(agoraBrasil())
      .setNumberFormat('dd/MM/yyyy HH:mm');

    registrarCaixa(
      agoraBrasil(),
      'Saida',
      valor,
      formaPgto,
      'CONTA_A_PAGAR',
      `PAGAMENTO ${fornecedor}`
    );

    registrarLog(
      'PAGAMENTO_CONTA',
      fornecedor,
      'PENDENTE',
      'PAGO'
    );

    return true;
  }
  function pagarContaById(id){
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('CONTAS_A_PAGAR');
    const dados = sh.getDataRange().getValues();
    const idx = dados.findIndex((l,i)=> i>0 && l[0] === id);
    if(idx < 0){
      throw new Error('Conta não encontrada.');
    }
    // linha na planilha é idx+1
    return pagarContaAPagar(idx + 1);
  }
  function agoraBrasil(){
    return new Date(
      Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        "yyyy/MM/dd HH:mm:ss"
      )
    );
  }

