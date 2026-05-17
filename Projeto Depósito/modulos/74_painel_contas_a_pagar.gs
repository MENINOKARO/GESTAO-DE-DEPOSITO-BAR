// ===============================
// PAINEL - CONTAS A PAGAR
// ===============================

  function calcularIndicadoresContasAPagar(){

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('CONTAS_A_PAGAR');

    if(!sh){
      return {
        pendentes: 0,
        total: 0,
        vencidas: 0,
        proximoVencimento: '',
        fixas: { qtd: 0, total: 0 },
        avulsas: { qtd: 0, total: 0 }
      };
    }

    const dados = sh.getDataRange().getValues().slice(1);

    let pendentes = 0;
    let total = 0;
    let vencidas = 0;
    let proximo = null;

    let fixasQtd = 0;
    let fixasTotal = 0;
    let avulsasQtd = 0;
    let avulsasTotal = 0;

    const hoje = new Date();
    hoje.setHours(0,0,0,0);

    dados.forEach(l => {

      const id     = String(l[0] || '');
      const valor  = Number(l[2]) || 0;
      const venc   = l[4] instanceof Date ? new Date(l[4]) : null;
      const status = l[5];

      if(status !== 'PENDENTE') return;

      pendentes++;
      total += valor;

      // 🔹 separação fixa / avulsa
      if(id.startsWith('FIXA_')){
        fixasQtd++;
        fixasTotal += valor;
      } else if(id.startsWith('AVULSA_')){
        avulsasQtd++;
        avulsasTotal += valor;
      }

      if(venc){
        venc.setHours(0,0,0,0);

        if(venc < hoje){
          vencidas++;
        }

        if(!proximo || venc < proximo){
          proximo = venc;
        }
      }
    });

    return {
      pendentes,
      total,
      vencidas,
      proximoVencimento: proximo
        ? Utilities.formatDate(
            proximo,
            Session.getScriptTimeZone(),
            'dd/MM/yyyy'
          )
        : '',
      fixas: {
        qtd: fixasQtd,
        total: fixasTotal
      },
      avulsas: {
        qtd: avulsasQtd,
        total: avulsasTotal
      }
    };
  }
  function popupPainelContasAPagar(){

    const indicadores = calcularIndicadoresContasAPagar();

    // 🎨 cor de risco
    let cor = '#dcfce7'; // verde
    let alerta = '🟢 Tudo em dia';

    if(indicadores.vencidas > 0){
      cor = '#fee2e2'; // vermelho
      alerta = '🔴 Existem contas vencidas';
    } else if(indicadores.proximoVencimento){
      cor = '#fef3c7'; // amarelo
      alerta = '🟡 Atenção aos próximos vencimentos';
    }

    const html = `
      <div style="
        font-family:Arial;
        display:flex;
        flex-direction:column;
        gap:14px
      ">

        <div style="
          background:${cor};
          padding:14px;
          border-radius:12px;
          text-align:center
        ">
          <h3 style="margin:0">🧾 Contas a Pagar</h3>
          <small>${alerta}</small>
        </div>

        <div style="
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:10px;
          text-align:center
        ">
          <div style="background:#FF7F50;color:#e5e7eb;padding:10px;border-radius:10px">
            <div>📌 Pendentes</div>
            <strong>${indicadores.pendentes}</strong>
          </div>

          <div style="background:#4169E1;color:#e5e7eb;padding:10px;border-radius:10px">
            <div>💰 Total</div>
            <strong>R$ ${Number(indicadores.total).toFixed(2).replace('.',',')}</strong>
          </div>

          <div style="background:#B22222;color:#e5e7eb;padding:10px;border-radius:10px">
            <div>⚠️ Vencidas</div>
            <strong>${indicadores.vencidas}</strong>
          </div>

          <div style="background:#228B22;color:#e5e7eb;padding:10px;border-radius:10px">
            <div>📅 Próx. Venc.</div>
            <strong>${indicadores.proximoVencimento || '-'}</strong>
          </div>
        </div>

        <div style="display:flex;gap:10px;margin-top:6px">
          <button class="btn-primary" style="flex:1" onclick="cadastrar()">
            ➕ Cadastrar Conta
          </button>

          <button class="btn-success" style="flex:1" onclick="pagar()">
            💸 Pagar Conta
          </button>
        </div>

        <div style="
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:10px;
          text-align:center
        ">
          <div style="background:#0f172a;color:#e5e7eb;padding:10px;border-radius:10px">
            <div>🔁 Fixas</div>
            <small>${indicadores.fixas.qtd} contas</small><br>
            <strong>R$ ${indicadores.fixas.total.toFixed(2).replace('.',',')}</strong>
          </div>

          <div style="background:#0f172a;color:#e5e7eb;padding:10px;border-radius:10px">
            <div>🧾 Avulsas</div>
            <small>${indicadores.avulsas.qtd} contas</small><br>
            <strong>R$ ${indicadores.avulsas.total.toFixed(2).replace('.',',')}</strong>
          </div>
        </div>


        <script>
          function cadastrar(){
            google.script.run
              .withSuccessHandler(()=> google.script.host.close())
              .withFailureHandler(e=> alert(e.message || e))
              .popupContaAPagar();
          }

          function pagar(){
            google.script.run
              .withSuccessHandler(()=> google.script.host.close())
              .withFailureHandler(e=> alert(e.message || e))
              .popupContasAPagarPendentes();
          }
        </script>

      </div>
    `;

    abrirPopup(
      '🧾 Painel – Contas a Pagar',
      html,
      420,
      420
    );
  }

