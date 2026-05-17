// ===============================
// PAINEL - FLUXO DE CAIXA
// ===============================
  function getResumoFluxoCaixa(dataIni, dataFim){

    const ss = SpreadsheetApp.getActive();

    /* ============================
      CAIXA
    ============================ */
    const sh = ss.getSheetByName('CAIXA');
    if(!sh){
      throw new Error('Aba CAIXA não encontrada.');
    }

    const dados = sh.getDataRange().getValues();

    const ini = new Date(dataIni + 'T00:00:00');
    const fim = new Date(dataFim + 'T23:59:59');

    let resumo = {
      dinheiro: 0,
      pix: 0,
      debito: 0,
      credito: 0,
      fiado: 0,        // 🔹 informativo (vem do A RECEBER)
      entradas: 0,
      saidas: 0,
      saldoReal: 0,
      resultado: 0
    };

    dados.forEach((l,i)=>{
      if(i === 0) return;

      const data = new Date(l[0]);
      if(isNaN(data)) return;
      if(data < ini || data > fim) return;

      const tipo  = String(l[1] || '').trim().toUpperCase();
      const valor = Number(l[2]) || 0;

      const pagamento = String(l[3] || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g,'')
        .replace(/[^\w\s]/g,'')
        .toUpperCase();

      if(tipo === 'ENTRADA'){
        resumo.entradas += valor;

        if(pagamento.includes('DINHEIRO')) resumo.dinheiro += valor;
        else if(pagamento.includes('PIX')) resumo.pix += valor;
        else if(pagamento.includes('DEBITO')) resumo.debito += valor;
        else if(pagamento.includes('CREDITO')) resumo.credito += valor;
      }

      if(tipo === 'SAIDA' || tipo === 'SAÍDA'){
        resumo.saidas += valor;
      }
    });

    /* ============================
      FIADO → CONTAS A RECEBER
    ============================ */
    const shCR = ss.getSheetByName('CONTAS_A_RECEBER');

    if(shCR){
      const cr = shCR.getDataRange().getValues().slice(1);

      cr.forEach(l => {

        const dataCriacao = new Date(l[9]);
        if(isNaN(dataCriacao)) return;
        if(dataCriacao < ini || dataCriacao > fim) return;

        const saldo  = Number(l[6]) || 0;
        const status = String(l[8] || '').toUpperCase();

        if(saldo > 0 && status !== 'QUITADO'){
          resumo.fiado += saldo;
        }
      });
    }

    /* ============================
      CÁLCULOS FINAIS
    ============================ */

    // 💰 dinheiro real em caixa
    resumo.saldoReal =
      resumo.dinheiro +
      resumo.pix +
      resumo.debito -
      resumo.saidas;

    // 📊 resultado contábil
    resumo.resultado =
      resumo.entradas -
      resumo.saidas;

    return resumo;
  }
  function popupFluxoCaixa(){

    const hoje = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );

    const html = `
    <div style="font-family:Arial;display:flex;flex-direction:column;gap:12px">


      <!-- FILTRO -->
      <div style="display:flex;gap:8px;align-items:center;justify-content:center">
        <input id="ini" type="date" value="${hoje}">
        <span>até</span>
        <input id="fim" type="date" value="${hoje}">
        <button onclick="filtrar()" style="padding:6px 10px">🔍</button>
      </div>

      <hr>

      <!-- SALDO REAL -->
      <div style="
        background:#020617;
        color:#e5e7eb;
        padding:12px;
        border-radius:10px;
        text-align:center
      ">
        <div style="font-size:13px">💰 SALDO REAL</div>
        <div id="saldo" style="font-size:22px;font-weight:bold">
          R$ 0,00
        </div>
      </div>

      <!-- ENTRADAS REAIS -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <div>💵 Dinheiro<br><strong id="dinheiro">R$ 0,00</strong></div>
        <div>⚡ Pix<br><strong id="pix">R$ 0,00</strong></div>
        <div>💳 Débito<br><strong id="debito">R$ 0,00</strong></div>
      </div>

      <hr>

      <!-- INFORMATIVO -->
      <div style="font-size:13px;color:#475569">
        📊 Informativo
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div>💳 Crédito<br><strong id="credito">R$ 0,00</strong></div>
        <div>🧾 Fiado<br><strong id="fiado">R$ 0,00</strong></div>
      </div>

      <hr>

      <!-- RESULTADO -->
      <div style="text-align:right">
        ⬆️ Entradas: <strong id="entradas">R$ 0,00</strong><br>
        ⬇️ Saídas: <strong id="saidas">R$ 0,00</strong><br>
        📈 Resultado: <strong id="resultado">R$ 0,00</strong>
      </div>

      <button onclick="google.script.host.close()">❌ Fechar</button>

      <script>
        function moeda(v){
          return 'R$ ' + Number(v).toFixed(2).replace('.',',');
        }

        function filtrar(){
          google.script.run
            .withSuccessHandler(r=>{
              dinheiro.innerText = moeda(r.dinheiro);
              pix.innerText = moeda(r.pix);
              debito.innerText = moeda(r.debito);
              credito.innerText = moeda(r.credito);
              fiado.innerText = moeda(r.fiado);
              entradas.innerText = moeda(r.entradas);
              saidas.innerText = moeda(r.saidas);
              saldo.innerText = moeda(r.saldoReal);
              resultado.innerText = moeda(r.resultado);
            })
            .getResumoFluxoCaixa(
              ini.value,
              fim.value
            );
        }

        filtrar();
      </script>
    </div>
    `;

    abrirPopup(
      '📊 Fluxo de Caixa',
      html,
      520,
      540
    );
  }

