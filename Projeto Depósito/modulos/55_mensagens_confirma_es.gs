// ===============================
// MENSAGENS / CONFIRMAÇÕES
// ===============================
  function popupMensagem(titulo, mensagem){

    const html = `
      <div style="
        font-family:Arial;
        padding:20px;
        text-align:center;
      ">

        <div style="font-size:16px;margin-bottom:20px">
          ${mensagem}
        </div>

        <button class="btn-success" onclick="fechar()">
          ✅ OK
        </button>

        <script>
          function fechar(){
            google.script.host.close();
          }
        </script>

      </div>
    `;

    abrirPopup(titulo, html, 360, 220);
  }
  function popupConfirmar(titulo, mensagem, callback, ...params){

    const parametrosJSON = JSON.stringify(params);

    const html = `
      <div style="
        font-family:Arial;
        background:#020617;
        color:#e5e7eb;
        padding:20px;
        border-radius:12px;
        text-align:center;
      ">

        <h3 style="margin-bottom:10px">${titulo}</h3>

        <p style="margin:15px 0">
          ${mensagem}
        </p>

        <div style="
          display:flex;
          justify-content:center;
          gap:15px;
        ">

          <button onclick="confirmar()"
            style="
              background:#16a34a;
              color:#fff;
              border:none;
              padding:8px 18px;
              border-radius:6px;
              cursor:pointer">
            ✅ Sim
          </button>

          <button onclick="google.script.host.close()"
            style="
              background:#dc2626;
              color:#fff;
              border:none;
              padding:8px 18px;
              border-radius:6px;
              cursor:pointer">
            ❌ Não
          </button>

        </div>
      </div>

      <script>

        const params = ${parametrosJSON};

        function confirmar(){

          google.script.run
            .withSuccessHandler(()=> {
              google.script.host.close();
            })
            [ '${callback}' ](...params);

        }

      </script>
    `;

    abrirPopup(titulo, html, 380, 240);
  }

