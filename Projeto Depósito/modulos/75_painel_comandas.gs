// ===============================
// PAINEL - COMANDAS
// ===============================
  function popupPainelComandas(){

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('COMANDAS');

    if(!sh){
      SpreadsheetApp.getUi().alert('❌ Aba COMANDAS não encontrada.');
      return;
    }

    // Se não existem dados, obtém array vazio
    const dados = sh.getLastRow() < 2 ? [] : sh.getDataRange().getValues();
    const agora = new Date();

    let abertas = [];
    let fechadasHoje = 0;
    let totalAberto = 0;

    // Processa apenas se existem dados
    if(dados.length > 0){
      dados.slice(1).forEach(l => {
        const pedido = l[0];
        const data   = new Date(l[1]);
        const cliente= l[2] || '-';
        const status = l[4];

        if(status === 'ABERTA' || status === 'AGUARDANDO_PGTO'){
          const diffMin = Math.floor((agora - data) / 60000);
          const horas = Math.floor(diffMin / 60);
          const mins  = diffMin % 60;

          const tempo = horas > 0 ? `${horas}h ${mins}min` : `${mins}min`;
          const saldo = calcularSaldoComanda(pedido);

          totalAberto += saldo;

          abertas.push({ pedido, cliente, tempo, saldo, status });
        }

        if(status === 'FECHADA'){
          const hoje = Utilities.formatDate(agora, Session.getScriptTimeZone(), 'yyyyMMdd');
          const dataCmd = Utilities.formatDate(data, Session.getScriptTimeZone(), 'yyyyMMdd');
          if(hoje === dataCmd) fechadasHoje++;
        }
      });
    }

    const html = `
    <style>
      .card{
        background:#f8fafc;
        border:1px solid #e5e7eb;
        border-radius:10px;
        padding:8px;
        text-align:center;
        font-size:13px;
      }
      .linha{
        background:#ffffff;
        border:1px solid #e5e7eb;
        border-radius:10px;
        padding:10px;
        margin-bottom:8px;
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:10px;
      }
      .btn-mini{
        padding:6px 10px;
        font-size:12px;
        border-radius:8px;
        border:1px solid #e5e7eb;
        background:#FEF3C7;
        cursor:pointer;
        display:inline-flex;
        align-items:center;
        gap:6px;
        width:fit-content;
        white-space:nowrap;
      }
      .topo{
        display:flex;
        justify-content:space-between;
        align-items:center;
        margin-bottom:8px;
      }
    </style>

    <!-- TOPO -->
    <div class="topo">
      <h3 style="margin:0">🧾 Painel de Comandas</h3>

      <button class="btn-mini"
        onclick="google.script.run.popupComandaBalcao()">
        ➕ Nova Comanda
      </button>
    </div>

    <!-- RESUMO -->
    <div style="
      display:grid;
      grid-template-columns:repeat(3,1fr);
      gap:8px;
      margin-bottom:10px
    ">
      <div class="card">
        <div style="color:#475569;font-size:12px">🟢 Abertas</div>
        <strong>${abertas.length}</strong>
      </div>

      <div class="card">
        <div style="color:#475569;font-size:12px">💵 Em Aberto</div>
        <strong>R$ ${totalAberto.toFixed(2).replace('.',',')}</strong>
      </div>

      <div class="card">
        <div style="color:#475569;font-size:12px">✅ Fechadas Hoje</div>
        <strong>${fechadasHoje}</strong>
      </div>
    </div>

    <hr>

    ${abertas.length ? abertas.map(c => `
      <div class="linha">
        <div>
          <strong>🧾 Comanda #${String(c.pedido).padStart(6,'0')}</strong><br>
          <small>👤 ${c.cliente}</small><br>
          <small>⏱️ ${c.tempo}</small>
        </div>

        <div style="text-align:right">
          <div style="font-weight:bold">
            R$ ${c.saldo.toFixed(2).replace('.',',')}
          </div>
          <button class="btn-mini"
            onclick="google.script.run.popupComandaExistente(${c.pedido})">
            🔎 Abrir
          </button>      
          </div>
      </div>
    `).join('') : `
      <p style="text-align:center;color:#64748b">
        Nenhuma comanda aberta no momento.
      </p>
    `}
    `;

    abrirPopup('🧾 Painel de Comandas', html, 720, 620);
  }
  function formatarTempo(minutos){
    if(minutos < 60){
      return minutos + 'min';
    }

    const h = Math.floor(minutos / 60);
    const m = minutos % 60;

    return h + 'h ' + (m < 10 ? '0' + m : m) + 'min';
  }

