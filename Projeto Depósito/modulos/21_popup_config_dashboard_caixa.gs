// ===============================
// POPUP CONFIG / DASHBOARD / CAIXA
// ===============================

  // POPUP CONFIG
    function abrirConfigOpcoes(){

      const html = `
      <html>
      <head>
        <style>
          body{
            margin:0;
            font-family:Arial;
            background:#0f172a;
            color:white;
          }

          .container{
            padding:18px;
            display:flex;
            flex-direction:column;
            gap:16px;
          }

          h2{
            text-align:center;
            margin:0 0 10px 0;
          }

          .card{
            background:#1e293b;
            padding:14px;
            border-radius:14px;
            display:flex;
            flex-direction:column;
            gap:10px;
          }

          .card-title{
            font-size:14px;
            font-weight:bold;
            opacity:.8;
          }

          .btn{
            padding:10px;
            border:none;
            border-radius:10px;
            font-weight:bold;
            cursor:pointer;
            font-size:14px;
          }

          .primary{
            background:#2563eb;
            color:#fff;
          }

          .primary:hover{
            background:#1e40af;
          }

          .danger{
            background:#dc2626;
            color:#fff;
          }

          .danger:hover{
            background:#b91c1c;
          }

          .secondary{
            background:#475569;
            color:#fff;
          }

          .secondary:hover{
            background:#334155;
          }
        </style>
      </head>

      <body>
        <div class="container">

          <h2>⚙️ Configurações do Sistema</h2>

          <div class="card">
            <div class="card-title">⚙️ SISTEMA E CONFIGURAÇÕES</div>

            <button class="btn primary" onclick="run('config')">
              🛠️ Dados do Depósito
            </button>

            <button class="btn primary" onclick="run('refresh')">
              ⏱️ Atualizar Home
            </button>

            <button class="btn primary" onclick="run('recarregar')">
              🔄 Recarregar Menu
            </button>

            <button class="btn primary" onclick="run('backup')">
              💾 Fazer Backup Agora
            </button>

            <button class="btn primary" onclick="run('logs')">
              📜 Ver Logs
            </button>

            <button class="btn primary" onclick="run('manual')">
              📘 Manual do Sistema
            </button>
          </div>

          <div class="card">
            <div class="card-title">🔐 SEGURANÇA</div>

            <button class="btn primary" onclick="run('alterarSenha')">
              🔐 Alterar Senha de Reset
            </button>

            <button class="btn primary" onclick="run('limparSenha')">
              🧽 Limpar Senha de Reset
            </button>

            <button class="btn primary" onclick="run('trocarLogin')">
              🔀 Trocar Login
            </button>

            <button class="btn danger" onclick="run('logout')">
              🚪 Logout
            </button>
          </div>

          <div class="card">
            <div class="card-title">🗄️ DADOS CRÍTICOS</div>

            <button class="btn danger" onclick="run('resetar')">
              🚀 Resetar Sistema
            </button>
          </div>

          <button class="btn secondary" onclick="google.script.host.close()">
            ❌ Fechar
          </button>

        </div>

        <script>

          function run(tipo){

            if(tipo === 'resetar'){
              google.script.run.popupSenhaReset();
              return;
            }

            google.script.run
              .withFailureHandler(e=>{
                alert('Erro: ' + e.message);
              })
              .executarConfig(tipo);

          }

        </script>

      </body>
      </html>
      `;

      const ui = HtmlService
        .createHtmlOutput(html)
        .setWidth(420)
        .setHeight(640);

      SpreadsheetApp.getUi()
        .showModalDialog(ui, '⚙️ Configurações');

    }
    function executarConfig(tipo){

      switch(tipo){

        case 'config':
          abrirConfiguracaoDeposito();
          break;

        case 'manual':
          abrirManualSistema();
          break;

        case 'refresh':
          criarHomeDashboard();
          break;

        case 'recarregar':
          recarregarMenu();
          break;

        case 'backup':
          fazerBackupSistema();
          break;

        case 'logs':
          abrirAbaLog();
          break;

        case 'alterarSenha':
          popupTrocarSenhaReset();
          break;

        case 'trocarLogin':
          trocarLogin();
          break;

        case 'limparSenha':
          limparSenhaResetSolicitandoTroca();
          break;

        case 'logout':
          fazerLogout();
          break;

        case 'resetar':
          resetarSistema();
          break;

        default:
          throw new Error('Opção inválida: ' + tipo);
      }

    }
  // CAIXA 
    function abrirCaixaOpcoes(){

      const html = `
        <div style="text-align:center;font-family:Arial">

          <p>Escolha a opção:</p>

          <button onclick="run('conf')">
            📋 Conferência
          </button><br><br>

          <button onclick="run('fech')">
            🔒 Fechamento
          </button>

          <script>
            function run(tipo){

              google.script.run.withSuccessHandler(()=>{
                google.script.host.close();
              }).executarCaixa(tipo);

            }
          </script>

          <style>
            button{
              width:90%;
              padding:12px;
              margin:6px;
              font-size:14px;
              background:#020617;
              color:white;
              border:none;
              border-radius:8px;
              cursor:pointer;
            }
          </style>

        </div>
      `;

      abrirPopup('💰 Caixa', html, 350, 300);
    }
    function executarCaixa(tipo){

      if(tipo === 'fech'){

        if(typeof fecharFiscalDia === 'function'){
          fecharFiscalDia();
          return;
        }

        SpreadsheetApp.getUi().alert(
          '⚠️ Função de fechamento não encontrada.'
        );
      }

      if(tipo === 'conf'){

        if(typeof fecharCaixaDia === 'function'){
          fecharCaixaDia();
          return;
        }

        SpreadsheetApp.getUi().alert(
          '⚠️ Função de conferência não encontrada.'
        );
      }

    }

