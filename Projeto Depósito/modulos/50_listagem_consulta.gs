// ===============================
// LISTAGEM / CONSULTA
// ===============================
  function listarComandasAbertas(){
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('COMANDAS').getDataRange().getValues();

    const abertas = sh.filter((c,i)=> i>0 && (c[4]==='ABERTA' || c[4]==='AGUARDANDO_PGTO'));

    if(abertas.length === 0){
      SpreadsheetApp.getUi().alert('Não há comandas abertas.');
      return;
    }

    const html = `
      <style>
        body{
          font-family:Arial;
          background:#f8fafc;
          color:#020617;
        }
        h3{
          text-align:center;
          margin-bottom:15px;
        }
        .lista{
          display:flex;
          flex-direction:column;
          gap:10px;
        }
        .item{
          display:flex;
          justify-content:space-between;
          align-items:center;
          background:#ffffff;
          border:1px solid #e5e7eb;
          border-radius:8px;
          padding:10px 12px;
          box-shadow:0 1px 3px rgba(0,0,0,.08);
        }
        .info{
          font-weight:bold;
        }
        button{
          background:#2563eb;
          color:#fff;
          border:none;
          padding:6px 12px;
          border-radius:6px;
          cursor:pointer;
          font-size:13px;
        }
        button:hover{
          background:#1e40af;
        }
      </style>

      <div class="lista">
        ${abertas.map(c=>`
          <div class="item">
            <div class="info">
              🧾 Comanda ${c[0]}<br>
              <small>${c[2] || 'Balcão'}</small>
            </div>
            <button onclick="abrir(${c[0]})">➡️ Abrir</button>
          </div>
        `).join('')}
      </div>

      <script>
        function abrir(pedido){
          google.script.run
            .withSuccessHandler(() => google.script.host.close())
            .withFailureHandler(err => {
              alert('Erro ao abrir comanda: ' + (err && err.message ? err.message : err));
            })
            .popupComandaExistente(pedido);
        }
      </script>
    `;

    abrirPopup('📂 Comandas Abertas', html, 420, 520);
  }
