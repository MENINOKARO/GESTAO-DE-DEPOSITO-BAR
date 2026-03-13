/**
 * =====================================================
 * 🔐 MÓDULO DE AUTENTICAÇÃO E GERENCIAMENTO DE USUÁRIOS
 * =====================================================
 * 
 * Sistema completo de:
 * - Login com email e senha
 * - Criação de usuários
 * - Perfis: GERENCIAL e OPERACIONAL
 * - Controle de acesso
 * - Auditoria de usuários
 * 
 * Data: 2026-02
 * Versão: 1.0
 * =====================================================
 */

/**
 * 🔧 INICIALIZAÇÃO DO SISTEMA DE AUTENTICAÇÃO
 */

  function garantirEstruturausuarios() {
    try {
      const ss = SpreadsheetApp.getActive();

      const headersUsuarios = [
        'ID_USER',
        'NOME',
        'EMAIL',
        'TELEFONE',
        'SENHA_HASH',
        'PERFIL',
        'ATIVO',
        'DATA_CRIACAO',
        'ULTIMO_ACESSO',
        'TROCA_SENHA_OBRIGATORIA'
      ];

      // ========== ABA USUÁRIOS ==========
      let shUsuarios = ss.getSheetByName('USUARIOS');
      if (!shUsuarios) {
        shUsuarios = ss.insertSheet('USUARIOS');
        shUsuarios.getRange('A1:J1').setValues([[
          'ID_USER',
          'NOME',
          'EMAIL',
          'TELEFONE',
          'SENHA_HASH',
          'PERFIL',
          'ATIVO',
          'DATA_CRIACAO',
          'ULTIMO_ACESSO',
          'TROCA_SENHA_OBRIGATORIA'
        ]]);
        shUsuarios.setFrozenRows(1);
      }

      normalizarEstruturaUsuarios_(shUsuarios, headersUsuarios);

      // ========== ABA SESSÕES ==========
      let shSessoes = ss.getSheetByName('SESSOES');
      if (!shSessoes) {
        shSessoes = ss.insertSheet('SESSOES');
        shSessoes.getRange('A1:E1').setValues([[
          'ID_SESSAO',
          'ID_USER',
          'DATA_LOGIN',
          'DATA_LOGOUT',
          'ATIVO'
        ]]);
      }
      shSessoes.setFrozenRows(1);

      // ========== ABA AUDITORIA ==========
      let shAuditoria = ss.getSheetByName('AUDITORIA_USUARIOS');
      if (!shAuditoria) {
        shAuditoria = ss.insertSheet('AUDITORIA_USUARIOS');
        shAuditoria.getRange('A1:F1').setValues([[
          'TIMESTAMP',
          'ID_USER',
          'ACAO',
          'DETALHE',
          'IP',
          'STATUS'
        ]]);
      }
      shAuditoria.setFrozenRows(1);

    } catch(e) {
      console.warn('Erro ao garantir estrutura de usuários:', e.message);
    }
  }

  function normalizarEstruturaUsuarios_(shUsuarios, headersUsuarios) {
    const lastRow = shUsuarios.getLastRow();
    const lastCol = Math.max(shUsuarios.getLastColumn(), headersUsuarios.length);
    const raw = lastRow > 0
      ? shUsuarios.getRange(1, 1, lastRow, lastCol).getValues()
      : [];

    const headerAtual = raw.length ? raw[0].map(v => String(v || '').trim().toUpperCase()) : [];
    const idx = {};
    headerAtual.forEach((h, i) => { if (h) idx[h] = i; });

    const linhasNormalizadas = [];

    for (let r = 1; r < raw.length; r++) {
      const row = raw[r];
      if (row.every(v => String(v || '').trim() === '')) continue;

      let idUser = (idx.ID_USER != null ? row[idx.ID_USER] : row[0]) || '';
      let nome = (idx.NOME != null ? row[idx.NOME] : row[1]) || '';
      let email = (idx.EMAIL != null ? row[idx.EMAIL] : row[2]) || '';
      let telefone = idx.TELEFONE != null ? row[idx.TELEFONE] : '';
      let senhaHash = (idx.SENHA_HASH != null ? row[idx.SENHA_HASH] : row[3]) || '';
      let perfil = (idx.PERFIL != null ? row[idx.PERFIL] : row[4]) || 'OPERACIONAL';
      let ativo = (idx.ATIVO != null ? row[idx.ATIVO] : row[5]) || 'SIM';
      let dataCriacao = (idx.DATA_CRIACAO != null ? row[idx.DATA_CRIACAO] : row[6]) || '';
      let ultimoAcesso = (idx.ULTIMO_ACESSO != null ? row[idx.ULTIMO_ACESSO] : row[7]) || '';
      let trocaSenhaObrigatoria = (idx.TROCA_SENHA_OBRIGATORIA != null ? row[idx.TROCA_SENHA_OBRIGATORIA] : row[9]) || 'NAO';

      const ativoTxt = String(ativo || '').toUpperCase();
      const dataCriacaoTxt = String(dataCriacao || '').toUpperCase();
      if ((ativoTxt !== 'SIM' && ativoTxt !== 'NAO') && (dataCriacaoTxt === 'SIM' || dataCriacaoTxt === 'NAO')) {
        telefone = senhaHash;
        senhaHash = perfil;
        perfil = ativo;
        ativo = dataCriacao;
        dataCriacao = ultimoAcesso;
        ultimoAcesso = row[(idx.ULTIMO_ACESSO != null ? idx.ULTIMO_ACESSO : 7) + 1] || '';
      }

      linhasNormalizadas.push([
        String(idUser || '').trim(),
        String(nome || '').trim(),
        String(email || '').trim().toLowerCase(),
        String(telefone || '').replace(/\D/g, ''),
        String(senhaHash || '').trim(),
        String(perfil || 'OPERACIONAL').toUpperCase(),
        String(ativo || 'SIM').toUpperCase() === 'NAO' ? 'NAO' : 'SIM',
        dataCriacao || new Date(),
        ultimoAcesso || '',
        String(trocaSenhaObrigatoria || 'NAO').toUpperCase() === 'SIM' ? 'SIM' : 'NAO'
      ]);
    }

    shUsuarios.clear();
    shUsuarios.getRange(1, 1, 1, headersUsuarios.length).setValues([headersUsuarios]);
    if (linhasNormalizadas.length) {
      shUsuarios.getRange(2, 1, linhasNormalizadas.length, headersUsuarios.length).setValues(linhasNormalizadas);
    }

    shUsuarios.getRange(1,1,1,headersUsuarios.length)
      .setFontWeight('bold')
      .setBackground('#020617')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center');
    shUsuarios.setFrozenRows(1);
    shUsuarios.setColumnWidth(1, 120);
    shUsuarios.setColumnWidth(2, 220);
    shUsuarios.setColumnWidth(3, 220);
    shUsuarios.setColumnWidth(4, 140);
    shUsuarios.setColumnWidth(5, 170);
    shUsuarios.setColumnWidth(6, 130);
    shUsuarios.setColumnWidth(7, 90);
    shUsuarios.setColumnWidth(8, 170);
    shUsuarios.setColumnWidth(9, 170);
    shUsuarios.setColumnWidth(10, 210);

    if (linhasNormalizadas.length) {
      shUsuarios.getRange(2, 8, linhasNormalizadas.length, 2).setNumberFormat('dd/MM/yyyy HH:mm:ss');
      shUsuarios.getRange(2, 7, linhasNormalizadas.length, 1).setHorizontalAlignment('center');
    }

    if (typeof aplicarFormatacaoPadrao === 'function') {
      aplicarFormatacaoPadrao(shUsuarios);
    }
  }

  /**
   * Wrapper seguro para abrir popup de login
   */
    function abrirPopupLogin() {
      try {
        popupLogin();
      } catch(e) {
        console.error('Erro ao abrir popupLogin:', e);
        uiNotificar('Erro ao abrir formulário de login','erro','Login');
      }
    }

  /**
   * Wrapper seguro para abrir popup de criar usuário
   */
    function abrirPopupCriarUsuario() {
      try {
        popupCriarUsuario();
      } catch(e) {
        console.error('Erro ao abrir popupCriarUsuario:', e);
        uiNotificar('Erro ao abrir formulário de criação','erro','Usuários');
      }
    }

  /**
   * Popup para LOGIN
   */
    function popupLogin() {
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
            }
            
            .login-container {
              background: white;
              border-radius: 15px;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
              width: 100%;
              max-width: 420px;
              padding: 40px;
              animation: slideIn 0.3s ease;
            }
            
            @keyframes slideIn {
              from { opacity: 0; transform: translateY(-20px); }
              to { opacity: 1; transform: translateY(0); }
            }
            
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            
            .header h1 {
              font-size: 28px;
              color: #333;
              margin-bottom: 8px;
            }
            
            .header p {
              color: #666;
              font-size: 14px;
            }
            
            .form-group {
              margin-bottom: 20px;
            }
            
            label {
              display: block;
              color: #333;
              font-weight: 600;
              margin-bottom: 8px;
              font-size: 14px;
            }
            
            input {
              width: 100%;
              padding: 12px 15px;
              border: 2px solid #e0e0e0;
              border-radius: 8px;
              font-size: 14px;
              transition: 0.3s;
            }
            
            input:focus {
              outline: none;
              border-color: #667eea;
              box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
            }
            
            .btn-login {
              width: 100%;
              padding: 12px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              border: none;
              border-radius: 8px;
              font-weight: 600;
              font-size: 14px;
              cursor: pointer;
              transition: 0.3s;
              margin-top: 10px;
            }
            
            .btn-login:hover:not(:disabled) {
              transform: translateY(-2px);
              box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
            }
            
            .btn-login:disabled {
              opacity: 0.6;
              cursor: not-allowed;
            }
            
            .error-msg {
              background: #fee2e2;
              color: #dc2626;
              padding: 12px;
              border-radius: 8px;
              font-size: 13px;
              margin-bottom: 15px;
              display: none;
            }
            
            .loading {
              text-align: center;
              color: #999;
              font-size: 12px;
              margin-top: 10px;
            }
            
            .new-user-link {
              text-align: center;
              margin-top: 20px;
              font-size: 13px;
              color: #666;
            }
            
            .new-user-link a {
              color: #667eea;
              text-decoration: none;
              font-weight: 600;
              cursor: pointer;
            }
            
            .new-user-link a:hover {
              text-decoration: underline;
            }
          </style>
        </head>
        <body>
          <div class="login-container">
            <div class="header">
              <h1>🔐 Login</h1>
              <p>Gestão de Depósito</p>
            </div>
            
            <div class="error-msg" id="errorMsg"></div>
            
            <form onsubmit="handleLogin(event)">
              <div class="form-group">
                <label>👤 Usuário</label>
                <input 
                  type="text" 
                  id="usuario" 
                  placeholder="Usuário (nome ou ID)"
                  required
                  autofocus
                />
              </div>
              
              <div class="form-group">
                <label>🔑 Senha</label>
                <input 
                  type="password" 
                  id="senha" 
                  placeholder="Digite sua senha"
                  required
                />
              </div>
              
              <button type="submit" class="btn-login" id="btnLogin">
                🚀 Entrar
              </button>
            </form>
            
            <div class="loading" id="loading" style="display: none;">
              ⏳ Autenticando...
            </div>
            
            <div class="new-user-link">
              Não tem conta? <a onclick="criarNovoUsuario()">Criar agora</a>
            </div>
          </div>
          
          <script>
            function handleLogin(event) {
              event.preventDefault();
              
              const usuario = document.getElementById('usuario').value.trim();
              const senha = document.getElementById('senha').value;
              const errorMsg = document.getElementById('errorMsg');
              const loading = document.getElementById('loading');
              const btnLogin = document.getElementById('btnLogin');
              
              if(!usuario || !senha) {
                errorMsg.textContent = '❌ Usuário e senha são obrigatórios';
                errorMsg.style.display = 'block';
                return;
              }
              
              btnLogin.disabled = true;
              loading.style.display = 'block';
              errorMsg.style.display = 'none';
              
              google.script.run
                .withSuccessHandler((resultado) => {
                  if(resultado.ok) {
                    if (resultado.trocaSenhaObrigatoria) {
                      google.script.run
                        .withSuccessHandler(() => {
                          google.script.host.close();
                        })
                        .withFailureHandler((erroTroca) => {
                          errorMsg.textContent = '❌ Login ok, mas falha ao abrir troca de senha: ' + erroTroca.message;
                          errorMsg.style.display = 'block';
                          btnLogin.disabled = false;
                          loading.style.display = 'none';
                        })
                        .popupTrocaSenhaObrigatoria(resultado.idUsuario);
                      return;
                    }

                    google.script.run
                      .withSuccessHandler(() => {
                        google.script.host.close();
                      })
                      .withFailureHandler((erroInit) => {
                        errorMsg.textContent = '❌ Login ok, mas falha ao iniciar: ' + erroInit.message;
                        errorMsg.style.display = 'block';
                        btnLogin.disabled = false;
                        loading.style.display = 'none';
                      })
                      .abrirSistemaPosLogin(resultado.nomeUsuario);
                  } else {
                    errorMsg.textContent = '❌ ' + resultado.msg;
                    errorMsg.style.display = 'block';
                    btnLogin.disabled = false;
                    loading.style.display = 'none';
                  }
                })
                .withFailureHandler((erro) => {
                  errorMsg.textContent = '❌ Erro: ' + erro.message;
                  errorMsg.style.display = 'block';
                  btnLogin.disabled = false;
                  loading.style.display = 'none';
                })
                .autenticarUsuario(usuario, senha);
            }
            
            function criarNovoUsuario() {
              google.script.host.close();
              google.script.run.popupCriarUsuario();
            }
          </script>
        </body>
        </html>
      `;
      
      const ui = HtmlService.createHtmlOutput(html)
        .setWidth(500)
        .setHeight(620);

      // garante que enquanto o popup estiver aberto o sistema esteja bloqueado
      try{ bloquearVisualizacaoSemLogin(); }catch(e){ console.warn('Erro ao bloquear visualização antes do login:', e); }

      SpreadsheetApp.getUi().showModalDialog(ui, '🔐 Login de Segurança');
    }

  /**
   * Autentica usuário
   */
    function autenticarUsuario(usuario, senha) {
      try {

        usuario = String(usuario).trim();

        const ss = SpreadsheetApp.getActive();
        const shUsuarios = ss.getSheetByName('USUARIOS');

        if (!shUsuarios) {
          return { ok: false, msg: 'Sistema não inicializado.' };
        }
        
        const dados = shUsuarios.getDataRange().getValues();
        let usuarioValido = null;

        console.log('[SERVER] Total de linhas encontradas: ' + dados.length);
        console.log('[SERVER] Buscando por: ' + usuario);

        // aceita login por ID (U-...), nome ou email
        for (let i = 1; i < dados.length; i++) {
          const id = String(dados[i][0] || '');
          const nome = String(dados[i][1] || '').toLowerCase().trim();
          const emailCell = String(dados[i][2] || '').toLowerCase().trim();
          const uLower = usuario.toLowerCase().trim();

          console.log('[SERVER] Linha ' + i + ': ID=' + id + ', NOME=' + nome + ', EMAIL=' + emailCell);

          if (id === usuario || nome === uLower || (emailCell && emailCell === uLower)) {
            console.log('[SERVER] ✅ Usuário encontrado na linha ' + i);
            usuarioValido = dados[i];
            break;
          }
        }
        
        if(!usuarioValido){
          console.log('[SERVER] ❌ Usuário NÃO encontrado após busca');
        }
        
        if(!usuarioValido){
          return { ok: false, msg: 'Usuário ou senha incorretos.' };
        }
        
        // ✅ Verifica ativo
        if(String(usuarioValido[6]).toUpperCase() !== 'SIM'){
          return { ok: false, msg: 'Usuário desativado.' };
        }
        
        // ✅ Verifica senha (simples - em produção usar bcrypt)
        const senhaHash = String(usuarioValido[4]);
        if(!verificarSenha(senha, senhaHash)){
          registrarAuditoria(usuarioValido[0], 'LOGIN_FALHA', 'Senha incorreta');
          return { ok: false, msg: 'Usuário ou senha incorretos.' };
        }
        
        // ✅ Cria sessão
        const idSessao = criarSessao(usuarioValido[0]);
        
        // ✅ Atualiza último acesso
        shUsuarios.getRange(dados.indexOf(usuarioValido) + 1, 9)
          .setValue(new Date());
        
        registrarAuditoria(usuarioValido[0], 'LOGIN_SUCESSO', 'Login realizado');
        if(typeof registrarLog === 'function'){
          registrarLog('LOGIN', usuarioValido[0], usuarioValido[1], new Date());
        }
        
        return { 
          ok: true, 
          msg: 'Login realizado com sucesso',
          nomeUsuario: usuarioValido[1],
          idUsuario: usuarioValido[0],
          idSessao: idSessao,
          perfil: usuarioValido[5],
          trocaSenhaObrigatoria: String(usuarioValido[9] || 'NAO').toUpperCase() === 'SIM'
        };
        
      } catch(e){
        console.error('Erro em autenticarUsuario:', e);
        return { ok: false, msg: 'Erro na autenticação: ' + e.message };
      }
    }

  /**
   * Verifica senha (simples - não usar em produção)
   */
    function verificarSenha(senhaDigitada, senhaHash){
      // Em produção, usar bcrypt ou similar
      // Hasheia a senha digitada e compara com o hash armazenado
      const senhaDigitadaHash = Utilities.base64Encode(String(senhaDigitada).trim());
      return senhaDigitadaHash === String(senhaHash).trim();
    }

  /**
   * Hash simples da senha (não seguro - melhorar em produção)
   */
    function gerarHashSenha(senha){
      // Em produção, usar biblioteca de criptografia
      return Utilities.base64Encode(String(senha).trim());
    }

  /**
   * Reseta senha para temporária e força troca obrigatória no próximo login.
   */
    function SENHA_RESET_TEMPORARIA(idUser){
      try{
        garantirEstruturausuarios();
        const ss = SpreadsheetApp.getActive();
        const sh = ss.getSheetByName('USUARIOS');
        if(!sh){
          return { ok:false, msg:'Aba USUARIOS não encontrada.' };
        }

        const dados = sh.getDataRange().getValues();
        for(let i = 1; i < dados.length; i++){
          if(String(dados[i][0]) === String(idUser)){
            const senhaTemporaria = 'adm123';
            sh.getRange(i + 1, 5).setValue(gerarHashSenha(senhaTemporaria));
            sh.getRange(i + 1, 10).setValue('SIM');
            registrarAuditoria(idUser, 'SENHA_RESET_TEMPORARIA', 'Senha resetada para padrão e troca obrigatória ativada');
            return { ok:true, msg:'Senha resetada para adm123. Troca obrigatória ativada.' };
          }
        }

        return { ok:false, msg:'Usuário não encontrado.' };
      }catch(e){
        console.error('Erro em SENHA_RESET_TEMPORARIA:', e);
        return { ok:false, msg:'Erro ao resetar senha: ' + e.message };
      }
    }

  function alterarSenhaObrigatoria(idUser, novaSenha){
    try{
      const senha = String(novaSenha || '').trim();
      if(senha.length < 6){
        return { ok:false, msg:'A nova senha deve ter no mínimo 6 caracteres.' };
      }

      garantirEstruturausuarios();
      const ss = SpreadsheetApp.getActive();
      const sh = ss.getSheetByName('USUARIOS');
      const dados = sh.getDataRange().getValues();

      for(let i = 1; i < dados.length; i++){
        if(String(dados[i][0]) === String(idUser)){
          sh.getRange(i + 1, 5).setValue(gerarHashSenha(senha));
          sh.getRange(i + 1, 10).setValue('NAO');
          sh.getRange(i + 1, 9).setValue(new Date());
          registrarAuditoria(idUser, 'SENHA_TROCADA_OBRIGATORIA', 'Usuário trocou senha após reset temporário');
          return { ok:true, msg:'Senha alterada com sucesso.' };
        }
      }

      return { ok:false, msg:'Usuário não encontrado.' };
    }catch(e){
      console.error('Erro em alterarSenhaObrigatoria:', e);
      return { ok:false, msg:'Erro ao alterar senha: ' + e.message };
    }
  }

  function popupTrocaSenhaObrigatoria(idUser){
    const html = `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <style>
          * { box-sizing: border-box; }
          body { margin:0; font-family: 'Segoe UI', Tahoma, sans-serif; background:#0f172a; color:#0f172a; }
          .wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:20px; }
          .card { width:100%; max-width:460px; background:#fff; border-radius:14px; padding:22px; box-shadow:0 18px 45px rgba(2,6,23,.45); }
          h1 { margin:0 0 8px; font-size:22px; color:#1e293b; }
          p { margin:0 0 14px; color:#475569; font-size:13px; line-height:1.4; }
          .warn { background:#fff7ed; border:1px solid #fdba74; color:#9a3412; border-radius:8px; padding:10px; font-size:12px; margin-bottom:14px; }
          label { font-weight:700; color:#334155; font-size:13px; display:block; margin:10px 0 6px; }
          input { width:100%; border:1px solid #cbd5e1; border-radius:8px; padding:10px 12px; font-size:13px; }
          .erro { display:none; margin-top:12px; background:#fee2e2; border:1px solid #fecaca; color:#991b1b; padding:10px; border-radius:8px; font-size:12px; }
          .ok { display:none; margin-top:12px; background:#dcfce7; border:1px solid #bbf7d0; color:#166534; padding:10px; border-radius:8px; font-size:12px; }
          button { margin-top:14px; width:100%; border:none; border-radius:8px; background:#1d4ed8; color:#fff; padding:11px 12px; font-size:13px; font-weight:700; cursor:pointer; }
          button:disabled { opacity:.65; cursor:not-allowed; }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="card">
            <h1>🔒 Troca de senha obrigatória</h1>
            <p>Sua senha foi resetada pelo administrador. Para continuar usando o sistema, você deve definir uma nova senha agora.</p>
            <div class="warn">Esta janela é obrigatória e não pode ser fechada sem concluir a troca de senha.</div>

            <label>Nova senha</label>
            <input type="password" id="novaSenha" placeholder="Mínimo 6 caracteres" />
            <label>Confirmar nova senha</label>
            <input type="password" id="confSenha" placeholder="Repita a nova senha" />

            <div id="erro" class="erro"></div>
            <div id="ok" class="ok"></div>

            <button id="btnSalvar" onclick="salvar()">Salvar nova senha e entrar</button>
          </div>
        </div>

        <script>
          function bloquearFechamento(){
            document.addEventListener('keydown', function(e){
              if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
              }
            }, true);
          }

          function salvar(){
            const senha = document.getElementById('novaSenha').value;
            const conf = document.getElementById('confSenha').value;
            const erro = document.getElementById('erro');
            const ok = document.getElementById('ok');
            const btn = document.getElementById('btnSalvar');

            erro.style.display = 'none';
            ok.style.display = 'none';

            if(!senha || !conf){
              erro.textContent = '❌ Preencha os dois campos.';
              erro.style.display = 'block';
              return;
            }
            if(senha.length < 6){
              erro.textContent = '❌ A nova senha deve ter no mínimo 6 caracteres.';
              erro.style.display = 'block';
              return;
            }
            if(senha !== conf){
              erro.textContent = '❌ As senhas não conferem.';
              erro.style.display = 'block';
              return;
            }

            btn.disabled = true;
            google.script.run
              .withSuccessHandler((res) => {
                if(!res.ok){
                  erro.textContent = '❌ ' + (res.msg || 'Falha ao alterar senha.');
                  erro.style.display = 'block';
                  btn.disabled = false;
                  return;
                }

                ok.textContent = '✅ Senha alterada com sucesso. Abrindo sistema...';
                ok.style.display = 'block';

                google.script.run
                  .withSuccessHandler(() => {
                    google.script.host.close();
                  })
                  .withFailureHandler((e) => {
                    erro.textContent = '❌ Senha alterada, mas falha ao abrir sistema: ' + e.message;
                    erro.style.display = 'block';
                    btn.disabled = false;
                  })
                  .abrirSistemaPosLogin('');
              })
              .withFailureHandler((e) => {
                erro.textContent = '❌ ' + e.message;
                erro.style.display = 'block';
                btn.disabled = false;
              })
              .alterarSenhaObrigatoria('${idUser}', senha);
          }

          bloquearFechamento();
        </script>
      </body>
      </html>`;

    const ui = HtmlService.createHtmlOutput(html).setWidth(520).setHeight(560);
    SpreadsheetApp.getUi().showModalDialog(ui, '🔒 Troca de senha obrigatória');
  }

/**
 * 📋 GERENCIAMENTO DE USUÁRIOS
 */

  /**
   * Popup para criar novo usuário
   */
    function popupCriarUsuario(){
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8" />
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 14px; }
            .container { background: white; border-radius: 15px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); width: 100%; max-width: 520px; padding: 28px; }
            .header { text-align: center; margin-bottom: 18px; }
            .header h1 { font-size: 24px; color: #333; margin-bottom: 6px; }
            .header p { color: #64748b; font-size: 12px; }
            .grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
            .form-group { margin-bottom: 12px; }
            .form-group.full { grid-column: 1 / -1; }
            label { display: block; color: #334155; font-weight: 600; margin-bottom: 6px; font-size: 13px; }
            input, select { width: 100%; padding: 10px 12px; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 13px; }
            input:focus, select:focus { outline:none; border-color:#667eea; box-shadow:0 0 0 3px rgba(102,126,234,.1); }
            .error { background:#fee2e2; color:#dc2626; padding:10px; border-radius:6px; font-size:12px; margin-bottom:12px; display:none; }
            .buttons { display:flex; gap:10px; margin-top: 12px; }
            button { flex:1; padding:11px; border:none; border-radius:8px; font-weight:600; font-size:13px; cursor:pointer; }
            .btn-salvar { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color:white; }
            .btn-cancelar { background:#e2e8f0; color:#0f172a; }
            @media(max-width:620px){ .grid{ grid-template-columns:1fr; } }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Novo Usuário</h1>
              <p>Cadastro com e-mail e telefone</p>
            </div>
            <div class="error" id="error"></div>
            <div class="grid">
              <div class="form-group full"><label>👤 Nome Completo</label><input type="text" id="nome" placeholder="Ex: João Silva" required /></div>
              <div class="form-group"><label>✉️ E-mail</label><input type="email" id="email" placeholder="nome@empresa.com" /></div>
              <div class="form-group"><label>📞 Telefone</label><input type="text" id="telefone" placeholder="(71) 9 9876-5432" required /></div>
              <div class="form-group"><label>🔑 Senha</label><input type="password" id="senha" placeholder="Mínimo 6 caracteres" required /></div>
              <div class="form-group"><label>🔄 Confirmar Senha</label><input type="password" id="senha2" placeholder="Repita a senha" required /></div>
              <div class="form-group full"><label>👔 Perfil de Acesso</label><select id="perfil" required><option value="OPERACIONAL">📦 Operacional</option><option value="GERENCIAL">👨‍💼 Gerencial</option></select></div>
            </div>
            
            <!-- Email removido: login será por usuário (nome ou ID) -->

            <div class="form-group">
              <label>📞 Telefone</label>
              <input type="text" id="telefone" placeholder="(71) 9 9876-5432" required />
            </div>
            
            <div class="form-group">
              <label>🔑 Senha</label>
              <input type="password" id="senha" placeholder="Mínimo 6 caracteres" required />
            </div>
            
            <div class="form-group">
              <label>🔄 Confirmar Senha</label>
              <input type="password" id="senha2" placeholder="Repita a senha" required />
            </div>
            
            <div class="form-group">
              <label>👔 Perfil de Acesso</label>
              <select id="perfil" required>
                <option value="OPERACIONAL">📦 Operacional</option>
                <option value="GERENCIAL">👨‍💼 Gerencial</option>
              </select>
            </div>
            
            <div class="buttons">
              <button class="btn-salvar" onclick="salvarUsuario()" id="btnSalvar">✅ Criar Usuário</button>
              <button class="btn-cancelar" onclick="google.script.host.close()">❌ Cancelar</button>
            </div>
          </div>
          <script>
            function formatTelefoneBR(valor) {
              const digits = String(valor || '').replace(/\D/g, '').slice(0, 11);

              if(digits.length <= 2) return digits;
              if(digits.length <= 6) return `(${digits.slice(0,2)}) ${digits.slice(2)}`;
              if(digits.length <= 10) return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;

              return `(${digits.slice(0,2)}) ${digits.slice(2,3)} ${digits.slice(3,7)}-${digits.slice(7,11)}`;
            }

            const inputTelefone = document.getElementById('telefone');
            if(inputTelefone){
              inputTelefone.addEventListener('input', e => {
                e.target.value = formatTelefoneBR(e.target.value);
              });
            }

            function salvarUsuario() {
              const error = document.getElementById('error');
              const nome = document.getElementById('nome').value.trim();
              const telefone = document.getElementById('telefone').value.trim();
              const senha = document.getElementById('senha').value;
              const senha2 = document.getElementById('senha2').value;
              const perfil = document.getElementById('perfil').value;
              const btn = document.getElementById('btnSalvar');
              
              console.log('[DEBUG] Valores obtidos: ' + JSON.stringify({ nome: nome, telefone: telefone, perfil: perfil }));
              
              error.style.display = 'none';
              
              if(!nome || !telefone || !senha || !senha2 || !perfil) {
                error.textContent = '❌ Todos os campos são obrigatórios';
                error.style.display = 'block';
                console.log('[DEBUG] Validação: campos vazios');
                return;
              }
              
              if(senha !== senha2) {
                error.textContent = '❌ As senhas não conferem';
                error.style.display = 'block';
                console.log('[DEBUG] Validação: senhas não conferem');
                return;
              }
              
              if(senha.length < 6) {
                error.textContent = '❌ Senha deve ter no mínimo 6 caracteres';
                error.style.display = 'block';
                console.log('[DEBUG] Validação: senha curta');
                return;
              }
              
              btn.disabled = true;
              btn.innerText = '⏳ Criando...';
              
              console.log('[DEBUG] Chamando criarNovoUsuario: ' + JSON.stringify({ nome: nome, telefone: telefone, perfil: perfil }));
              
              google.script.run
                .withSuccessHandler((resultado) => {
                  if(resultado.ok) {
                    error.textContent = '✅ Usuário criado com sucesso!'; error.style.display = 'block'; error.style.background = '#dcfce7'; error.style.color = '#166534';
                    setTimeout(function(){ google.script.run.popupListarUsuarios(); google.script.host.close(); }, 600);
                  } else {
                    error.textContent = '❌ ' + resultado.msg; error.style.display = 'block'; btn.disabled = false; btn.innerText = '✅ Criar Usuário';
                  }
                })
                .withFailureHandler((erro) => {
                  console.error('[DEBUG] Erro em criarNovoUsuario: ' + JSON.stringify(erro));
                  error.textContent = '❌ Erro: ' + erro.message;
                  error.style.display = 'block';
                  btn.disabled = false;
                  btn.innerText = '✅ Criar Usuário';
                })
                .criarNovoUsuario(nome, telefone, senha, perfil);
            }
          </script>
        </body>
        </html>
      `;
      const ui = HtmlService.createHtmlOutput(html).setWidth(620).setHeight(720);
      SpreadsheetApp.getUi().showModalDialog(ui, '✅ Novo Usuário');
    }

  /**
   * Cria novo usuário
   */
    function criarNovoUsuario(nome, telefone, senha, perfil){
      try {
        console.log('[SERVER] criarNovoUsuario chamado: ' + JSON.stringify({ nome: nome, telefone: telefone, perfil: perfil }));
        
        nome = String(nome).trim();
        telefone = String(telefone || '').replace(/\D/g, '');
        perfil = String(perfil).toUpperCase();
        
        // ✅ Validações
        if(!nome || !telefone || !senha || !perfil){
          console.log('[SERVER] Dados incompletos');
          return { ok: false, msg: 'Dados incompletos.' };
        }
        
        if(perfil !== 'OPERACIONAL' && perfil !== 'GERENCIAL'){
          console.log('[SERVER] Perfil inválido:', perfil);
          return { ok: false, msg: 'Perfil inválido.' };
        }
        
        if(String(senha).trim().length < 6){
          console.log('[SERVER] Senha curta');
          return { ok: false, msg: 'Senha deve ter no mínimo 6 caracteres.' };
        }
        
        console.log('[SERVER] Garantindo estrutura de usuários');
        garantirEstruturausuarios();
        
        const ss = SpreadsheetApp.getActive();
        const shUsuarios = ss.getSheetByName('USUARIOS');
        
        if(!shUsuarios){
          console.error('[SERVER] Aba USUARIOS não encontrada após garantir estrutura');
          return { ok: false, msg: 'Erro ao acessar base de dados.' };
        }
        
        const dados = shUsuarios.getDataRange().getValues();
        
        // ✅ Verifica se já existe usuário com mesmo nome
        for(let i = 1; i < dados.length; i++){
          if(String(dados[i][1]).toLowerCase().trim() === nome.toLowerCase().trim()){
            console.log('[SERVER] Usuário duplicado:', nome);
            return { ok: false, msg: 'Usuário já existe.' };
          }
          const emailExistente = String(dados[i][2] || '').toLowerCase().trim();
          if(email && emailExistente && emailExistente === email){
            return { ok:false, msg:'E-mail já cadastrado para outro usuário.' };
          }
        }
        
        // ✅ Gera ID único
        let maxId = 0;
        dados.forEach(row => {
          const id = Number(String(row[0]).replace('U-', ''));
          if(id > maxId) maxId = id;
        });
        
        const idUser = 'U-' + String(maxId + 1).padStart(6, '0');
        console.log('[SERVER] ID gerado:', idUser);
        
        const senhaHash = gerarHashSenha(senha);
        const agora = new Date();
        
        // ✅ Adiciona usuário (email fica vazio)
        console.log('[SERVER] Adicionando linha com ID=' + idUser + ', NOME=' + nome + ', PERFIL=' + perfil);
        shUsuarios.appendRow([
          idUser,
          nome,
          '',
          telefone,
          senhaHash,
          perfil,
          'SIM',
          agora,
          agora,
          'NAO'
        ]);
        
        console.log('[SERVER] ✅ Linha adicionada com sucesso');
        
        console.log('[SERVER] Registrando auditoria...');
        registrarAuditoria(idUser, 'USUARIO_CRIADO', `Perfil: ${perfil}`);
        
        console.log('[SERVER] Usuário criado com sucesso!');
        return { ok: true, msg: 'Usuário criado com sucesso!' };
        
      } catch(e){
        console.error('[SERVER] Erro em criarNovoUsuario: ' + JSON.stringify({ message: e.message, stack: e.stack }));
        return { ok: false, msg: 'Erro: ' + e.message };
      }
    }

  /**
   * LISTAR / EDITAR / EXCLUIR USUÁRIOS
   */
    function popupListarUsuarios(){
      garantirEstruturausuarios();
      const ss = SpreadsheetApp.getActive();
      const sh = ss.getSheetByName('USUARIOS');
      const dados = sh.getDataRange().getValues().slice(1);

      let rows = '';
      dados.forEach(r=>{
        const id = r[0] || '';
        const nome = r[1] || '';
        const email = r[2] || '-';
        const telefone = r[3] || '-';
        const perfil = r[5] || 'OPERACIONAL';
        const ativo = String(r[6] || 'SIM').toUpperCase();
        const badgeClass = ativo === 'SIM' ? 'badge-on' : 'badge-off';
        const criado = r[7] instanceof Date
          ? Utilities.formatDate(r[7], Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm')
          : (r[7] || '');
        const ultimo = r[8] instanceof Date
          ? Utilities.formatDate(r[8], Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm')
          : (r[8] || '');
        rows += `
          <tr>
            <td class="mono">${id}</td>
            <td>
              <div class="nome">${nome}</div>
              <div class="email-mobile">${email} | ${telefone}</div>
            </td>
            <td class="hide-mobile">${email}</td>
            <td class="hide-mobile">${telefone}</td>
            <td><span class="badge-perfil">${perfil}</span></td>
            <td><span class="badge-status ${badgeClass}">${ativo}</span></td>
            <td class="hide-mobile">${criado || '-'}</td>
            <td class="hide-mobile">${ultimo || '-'}</td>
            <td class="acoes">
              <button class="btn-icon btn-edit" title="Editar usuário" onclick="google.script.run.editarUsuario('${id}')">✏️</button>
              <button class="btn-icon" title="Limpar senha (adm123)" onclick="confirmarResetSenha('${id}','${nome.replace(/'/g, "\\'")}')">🔁</button>
              <button class="btn-icon btn-delete" title="Excluir usuário" onclick="confirmarExclusao('${id}','${nome.replace(/'/g, "\\'")}')">🗑️</button>
            </td>
          </tr>`;
      });

      const html = `
      <html>
        <head>
          <style>
            :root {
              --bg: #f8fafc;
              --card: #ffffff;
              --primary: #1d4ed8;
              --primary-dark: #1e40af;
              --border: #e2e8f0;
              --text: #0f172a;
              --muted: #64748b;
              --success-bg: #dcfce7;
              --success-text: #166534;
              --danger-bg: #fee2e2;
              --danger-text: #991b1b;
            }

            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 18px;
              font-family: Arial, sans-serif;
              color: var(--text);
              background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
            }

            .wrap {
              background: var(--card);
              border: 1px solid var(--border);
              border-radius: 14px;
              box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
              overflow: hidden;
            }

            .header {
              padding: 16px 18px;
              border-bottom: 1px solid var(--border);
              display: flex;
              justify-content: space-between;
              align-items: center;
              gap: 12px;
              flex-wrap: wrap;
            }

            .title {
              margin: 0;
              font-size: 18px;
            }

            .subtitle {
              margin: 4px 0 0;
              color: var(--muted);
              font-size: 12px;
            }

            .toolbar {
              display: flex;
              gap: 8px;
              align-items: center;
              flex-wrap: wrap;
            }

            .search {
              border: 1px solid var(--border);
              border-radius: 10px;
              padding: 8px 10px;
              min-width: 190px;
              font-size: 12px;
            }

            .btn {
              border: none;
              border-radius: 10px;
              padding: 9px 12px;
              font-weight: bold;
              font-size: 12px;
              cursor: pointer;
            }

            .btn-primary { background: var(--primary); color: #fff; }
            .btn-primary:hover { background: var(--primary-dark); }
            .btn-neutral { background: #e2e8f0; color: #0f172a; }
            .btn-neutral:hover { background: #cbd5e1; }

            .table-wrap { padding: 12px 14px 14px; }

            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 12px;
            }

            th, td {
              border-bottom: 1px solid var(--border);
              padding: 10px 8px;
              text-align: left;
              vertical-align: middle;
            }

            th {
              color: var(--muted);
              font-weight: 700;
              background: #f8fafc;
            }

            .mono { font-family: monospace; color: #334155; }
            .nome { font-weight: 700; color: #0f172a; }
            .email-mobile { display: none; color: var(--muted); font-size: 11px; margin-top: 2px; }

            .badge-perfil,
            .badge-status {
              display: inline-flex;
              align-items: center;
              padding: 4px 8px;
              border-radius: 999px;
              font-size: 11px;
              font-weight: 700;
            }

            .badge-perfil { background: #e0e7ff; color: #3730a3; }
            .badge-on { background: var(--success-bg); color: var(--success-text); }
            .badge-off { background: var(--danger-bg); color: var(--danger-text); }

            .acoes { white-space: nowrap; }
            .btn-icon {
              border: 1px solid var(--border);
              background: #fff;
              border-radius: 8px;
              padding: 6px 8px;
              margin-right: 4px;
              cursor: pointer;
            }
            .btn-edit:hover { background: #e0e7ff; }
            .btn-delete:hover { background: #fee2e2; }

            .empty {
              text-align: center;
              color: var(--muted);
              padding: 24px 10px;
            }

            @media (max-width: 720px) {
              .hide-mobile { display: none; }
              .email-mobile { display: block; }
            }
          </style>
        </head>

        <body>
          <div class="wrap">
            <div class="header">
              <div>
                <h3 class="title">👥 Gerenciar Usuários</h3>
                <p class="subtitle">Total de registros: <strong id="totalUsuarios">${dados.length}</strong></p>
              </div>
              <div class="toolbar">
                <input id="searchInput" class="search" type="text" placeholder="Buscar por nome, e-mail, telefone ou perfil" oninput="filtrar()" />
                <button class="btn btn-primary" onclick="google.script.run.popupCriarUsuario()">➕ Novo Usuário</button>
                <button class="btn btn-neutral" onclick="google.script.host.close()">Fechar</button>
              </div>
            </div>

            <div class="table-wrap">
              <table id="tabelaUsuarios">
                <thead>
                  <tr>
                    <th style="width:100px">ID</th>
                    <th>Nome</th>
                    <th class="hide-mobile">E-mail</th>
                    <th class="hide-mobile">Telefone</th>
                    <th style="width:130px">Perfil</th>
                    <th style="width:90px">Ativo</th>
                    <th class="hide-mobile">Criado em</th>
                    <th class="hide-mobile">Último acesso</th>
                    <th style="width:90px">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows || '<tr><td colspan="7" class="empty">Nenhum usuário encontrado.</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>

          <script>
            function filtrar(){
              const termo = (document.getElementById('searchInput').value || '').toLowerCase().trim();
              const linhas = Array.from(document.querySelectorAll('#tabelaUsuarios tbody tr'));
              let visiveis = 0;

              linhas.forEach(tr => {
                const txt = (tr.innerText || '').toLowerCase();
                const show = !termo || txt.includes(termo);
                tr.style.display = show ? '' : 'none';
                if(show) visiveis++;
              });

              document.getElementById('totalUsuarios').innerText = visiveis;
            }

            function confirmarExclusao(id, nome){
              const ok = confirm('Deseja realmente excluir o usuário "' + nome + '"?');
              if(!ok) return;
              google.script.run.deletarUsuario(id);
            }

            function confirmarResetSenha(id, nome){
              const ok = confirm('Resetar senha de "' + nome + '" para adm123 e forçar troca no próximo login?');
              if(!ok) return;

              google.script.run
                .withSuccessHandler((res) => {
                  if(res && res.ok){
                    alert('✅ ' + res.msg);
                  } else {
                    alert('❌ ' + ((res && res.msg) || 'Falha ao resetar senha.'));
                  }
                })
                .withFailureHandler((e) => {
                  alert('❌ Erro ao resetar senha: ' + e.message);
                })
                .SENHA_RESET_TEMPORARIA(id);
            }
          </script>
        </body>
      </html>`;

      const ui = HtmlService.createHtmlOutput(html).setWidth(900).setHeight(560);
      SpreadsheetApp.getUi().showModalDialog(ui,'👥 Gerenciar Usuários');
    }

    function editarUsuario(id){
      const ss = SpreadsheetApp.getActive();
      const sh = ss.getSheetByName('USUARIOS');
      const dados = sh.getDataRange().getValues();
      let row = null;

      for(let i=1;i<dados.length;i++){
        if(String(dados[i][0]) === String(id)){
          row = dados[i];
          break;
        }
      }

      if(!row){
        uiNotificar('Usuário não encontrado.','aviso','Usuários');
        return;
      }

      const nome = row[1] || '';
      const email = row[2] || '';
      const telefone = row[3] || '';
      const perfil = row[5] || 'OPERACIONAL';
      const ativo = row[6] || 'SIM';
      const dataCriacao = row[7] || '';
      const ultimoAcesso = row[8] || '';
      const trocaSenhaObrigatoria = row[9] || 'NAO';

      const html = `
        <html>
          <head>
            <base target="_top">
            <style>
              body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#f8fafc;color:#0f172a}
              .popup{padding:16px}
              .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
              .grid.full{grid-template-columns:1fr}
              label{display:block;font-size:12px;font-weight:700;margin:6px 0 4px;color:#334155}
              input,select{width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:8px;background:#fff}
              input[disabled]{background:#e2e8f0;color:#475569}
              .info{margin-top:12px;padding:10px;border-radius:10px;background:#f1f5f9;font-size:12px;color:#334155;line-height:1.5}
              .actions{display:flex;gap:8px;margin-top:12px}
              button{flex:1;padding:10px;border:none;border-radius:8px;font-weight:700;cursor:pointer}
              .btn-primary{background:#2563eb;color:#fff}
              .btn-success{background:#16a34a;color:#fff}
              .btn-secondary{background:#475569;color:#fff}
            </style>
          </head>
          <body>
            <div class="popup">
              <h3 style="margin:0 0 12px;text-align:center">✏️👤 Editar Usuário</h3>

              <div class="grid full">
                <div>
                  <label>🆔 ID do Usuário</label>
                  <input id="idUser" value="${id}" disabled>
                </div>
              </div>

              <div class="grid">
                <div>
                  <label>👤 Nome</label>
                  <input id="nome" value="${nome}">
                </div>
                <div>
                  <label>📱 Telefone</label>
                  <input id="telefone" value="${telefone}" placeholder="(71) 9 9876-5432">
                </div>
              </div>

              <div class="grid full">
                <div>
                  <label>📧 Email</label>
                  <input id="email" value="${email}" disabled>
                </div>
              </div>

              <div class="grid">
                <div>
                  <label>🛡️ Perfil</label>
                  <select id="perfil">
                    <option value="OPERACIONAL" ${perfil==='OPERACIONAL'?'selected':''}>📦 Operacional</option>
                    <option value="GERENCIAL" ${perfil==='GERENCIAL'?'selected':''}>👨‍💼 Gerencial</option>
                  </select>
                </div>
                <div>
                  <label>✅ Status</label>
                  <select id="ativo">
                    <option value="SIM" ${ativo==='SIM'?'selected':''}>🟢 Ativo</option>
                    <option value="NAO" ${ativo==='NAO'?'selected':''}>🔴 Inativo</option>
                  </select>
                </div>
              </div>

              <div class="grid">
                <div>
                  <label>🔐 Troca de senha obrigatória</label>
                  <select id="trocaSenhaObrigatoria">
                    <option value="NAO" ${trocaSenhaObrigatoria==='NAO'?'selected':''}>Não</option>
                    <option value="SIM" ${trocaSenhaObrigatoria==='SIM'?'selected':''}>Sim</option>
                  </select>
                </div>
                <div>
                  <label>🕘 Último acesso</label>
                  <input id="ultimoAcesso" value="${ultimoAcesso}" disabled>
                </div>
              </div>

              <div class="info">
                📅 <strong>Data de criação:</strong> ${dataCriacao || '-'}<br>
                ℹ️ Ajuste os campos necessários e clique em <strong>Salvar Alterações</strong>.
              </div>

              <div class="actions">
                <button class="btn-secondary" onclick="google.script.host.close()">❌ Cancelar</button>
                <button class="btn-success" onclick="salvar()">💾 Salvar Alterações</button>
              </div>
            </div>

            <script>
              function formatTelefoneBR(valor){
                const digits = String(valor || '').replace(/\D/g, '').slice(0, 11);

                if(digits.length <= 2) return digits;
                if(digits.length <= 6) return `(${digits.slice(0,2)}) ${digits.slice(2)}`;
                if(digits.length <= 10) return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;

                return `(${digits.slice(0,2)}) ${digits.slice(2,3)} ${digits.slice(3,7)}-${digits.slice(7,11)}`;
              }

              const campoTelefone = document.getElementById('telefone');
              if(campoTelefone){
                campoTelefone.value = formatTelefoneBR(campoTelefone.value);
                campoTelefone.addEventListener('input', e => {
                  e.target.value = formatTelefoneBR(e.target.value);
                });
              }

              function salvar(){
                const nome = document.getElementById('nome').value.trim();
                const telefone = document.getElementById('telefone').value.trim();
                const perfil = document.getElementById('perfil').value;
                const ativo = document.getElementById('ativo').value;
                const trocaSenhaObrigatoria = document.getElementById('trocaSenhaObrigatoria').value;

                if(!nome){
                  alert('Informe o nome do usuário.');
                  return;
                }

                google.script.run
                  .withSuccessHandler((res)=>{
                    if(!res || !res.ok){
                      alert((res && res.msg) || 'Falha ao atualizar usuário.');
                      return;
                    }
                    alert('✅ Usuário atualizado com sucesso.');
                    google.script.host.close();
                    google.script.run.popupListarUsuarios();
                  })
                  .withFailureHandler(e=> alert('❌ Erro: ' + (e.message || e)))
                  .atualizarUsuario('${id}', nome, telefone, perfil, ativo, trocaSenhaObrigatoria);
              }
            </script>
          </body>
        </html>`;

      const ui = HtmlService.createHtmlOutput(html).setWidth(700).setHeight(660);
      SpreadsheetApp.getUi().showModalDialog(ui,'✏️👤 Editar Usuário');
    }

    function atualizarUsuario(id, nome, telefone, perfil, ativo, trocaSenhaObrigatoria){
      const ss = SpreadsheetApp.getActive();
      const sh = ss.getSheetByName('USUARIOS');
      const dados = sh.getDataRange().getValues();
      for(let i=1;i<dados.length;i++){
        if(dados[i][0] === id){
          sh.getRange(i+1,2).setValue(nome);
          sh.getRange(i+1,4).setValue(String(telefone || '').replace(/\D/g, ''));
          sh.getRange(i+1,6).setValue(perfil);
          sh.getRange(i+1,7).setValue(ativo);
          sh.getRange(i+1,10).setValue((trocaSenhaObrigatoria || 'NAO').toUpperCase());
          registrarAuditoria(id,'USUARIO_ATUALIZADO',`Perfil:${perfil} Ativo:${ativo} TrocaSenha:${(trocaSenhaObrigatoria || 'NAO').toUpperCase()}`);
          return { ok:true };
        }
      }
      return { ok:false, msg:'Usuário não encontrado.' };
    }

    function deletarUsuario(id){
      const ss = SpreadsheetApp.getActive();
      const sh = ss.getSheetByName('USUARIOS');
      const dados = sh.getDataRange().getValues();
      let excluido = false;
      for(let i=1;i<dados.length;i++){
        if(dados[i][0] === id){
          sh.deleteRow(i+1);
          registrarAuditoria(id,'USUARIO_EXCLUIDO','');
          excluido = true;
          break;
        }
      }

      if (!excluido) {
        uiNotificar('Usuário não encontrado para exclusão.','aviso','Usuários');
      }

      // recarrega lista
      popupListarUsuarios();
    }

  /**
   * 🔐 GERENCIAMENTO DE SESSÕES
   */

  /**
   * Cria nova sessão de usuário
   */
    function criarSessao(idUser){
      const ss = SpreadsheetApp.getActive();
      const shSessoes = ss.getSheetByName('SESSOES');
      
      let maxSessao = 0;
      const dados = shSessoes.getDataRange().getValues();
      
      dados.forEach(row => {
        const id = Number(String(row[0]).replace('S-', ''));
        if(id > maxSessao) maxSessao = id;
      });
      
      const idSessao = 'S-' + String(maxSessao + 1).padStart(8, '0');
      
      shSessoes.appendRow([
        idSessao,
        idUser,
        new Date(),
        '',
        'SIM'
      ]);
      
      // Salva em propriedades de script para acesso rápido
      const props = PropertiesService.getUserProperties();
      props.setProperty('SESSAO_ATIVA', idSessao);
      props.setProperty('ID_USER', idUser);
      
      return idSessao;
    }

  /**
   * Encerra sessão
   */
    function encerrarSessao(){
      const props = PropertiesService.getUserProperties();
      const idSessao = props.getProperty('SESSAO_ATIVA');
      
      if(idSessao){
        const ss = SpreadsheetApp.getActive();
        const shSessoes = ss.getSheetByName('SESSOES');
        const dados = shSessoes.getDataRange().getValues();
        
        for(let i = 1; i < dados.length; i++){
          if(dados[i][0] === idSessao){
            shSessoes.getRange(i + 1, 4).setValue(new Date());
            shSessoes.getRange(i + 1, 5).setValue('NAO');
            break;
          }
        }
        
        props.deleteProperty('SESSAO_ATIVA');
        props.deleteProperty('ID_USER');
      }
    }




// rotina chamada pelo client HTML durante logout
  function rotinaLogout(){
    // assegura gravação e backup
    SpreadsheetApp.flush();
    try{
      fazerBackupSistema();
    }catch(e){
      console.warn('Erro ao fazer backup durante logout:', e);
    }

    const usuario = obterUsuarioAtual();
    if(usuario){
      registrarAuditoria(usuario.id, 'LOGOUT', 'Saída do sistema');
      if(typeof registrarLog === 'function'){
        registrarLog('LOGOUT', usuario.id, usuario.nome, new Date());
      }
    }

    encerrarSessao();
    // após encerrar, bloqueia visualização e reabre fluxo de autenticação
    try{
      bloquearVisualizacaoSemLogin();
    }catch(e){
      console.warn('Erro ao bloquear visualização após logout:', e);
    }

    try{
      popupTelaInicial();
    }catch(e){
      console.warn('Erro ao abrir tela inicial após logout:', e);
    }

    return { ok: true };
  }
  function popupLogout(){
    const html = `<!DOCTYPE html>
    <html><body><script>
      // ao carregar, chama servidor e tenta fechar a aba/janela
      function inicio(){
        google.script.run
          .withSuccessHandler(()=>{
            google.script.host.close();
            // tentativa extra de fechar o tab (pode ser bloqueado)
            try{ window.close(); }catch(e){}
          })
          .rotinaLogout();
      }
      window.onload = inicio;
    </script></body></html>`;
    const ui = HtmlService.createHtmlOutput(html).setWidth(10).setHeight(10);
    SpreadsheetApp.getUi().showModalDialog(ui,'Saindo...');
  }
  function trocarLogin(){
    // encerra sessão e abre tela inicial sem fechar a planilha
    const usuario = obterUsuarioAtual();
    if(usuario){
      registrarAuditoria(usuario.id, 'TROCA_LOGIN', 'Solicitou troca de login');
      if(typeof registrarLog === 'function'){
        registrarLog('TROCA_LOGIN', usuario.id, usuario.nome, new Date());
      }
    }
    try{
      fazerBackupSistema();
    }catch(e){
      console.warn('Erro ao fazer backup durante troca de login:', e);
    }
    encerrarSessao();
    // reabre fluxo de autenticação
    popupTelaInicial();
  }

/**
 * Obtém usuário da sessão atual
 */
  function obterUsuarioAtual(){
    const props = PropertiesService.getUserProperties();
    const idUser = props.getProperty('ID_USER');
    
    if(!idUser) return null;
    
    const ss = SpreadsheetApp.getActive();
    const shUsuarios = ss.getSheetByName('USUARIOS');
    const dados = shUsuarios.getDataRange().getValues();
    
    for(let i = 1; i < dados.length; i++){
      if(dados[i][0] === idUser){
        return {
          id: dados[i][0],
          nome: dados[i][1],
          email: dados[i][2],
          telefone: dados[i][3],
          perfil: dados[i][5],
          ativo: dados[i][6],
          trocaSenhaObrigatoria: String(dados[i][9] || 'NAO').toUpperCase() === 'SIM' ? 'SIM' : 'NAO'
        };
      }
    }
    
    return null;
  }

/**
 * Verifica se usuário tem permissão (perfil)
 */
function temPermissao(perfilRequerido){
  const usuario = obterUsuarioAtual();
  
  if(!usuario) return false;
  
  if(usuario.perfil === 'GERENCIAL') return true;
  
  return usuario.perfil === perfilRequerido;
}

/**
 * 📊 AUDITORIA
 */

  /**
   * Registra ação na auditoria
   */
  function registrarAuditoria(idUser, acao, detalhe){
    try {
      const ss = SpreadsheetApp.getActive();
      const shAuditoria = ss.getSheetByName('AUDITORIA_USUARIOS');
      
      if(!shAuditoria) return;
      
      shAuditoria.appendRow([
        new Date(),
        idUser,
        acao,
        detalhe || '',
        Session.getActiveUser().getEmail() || 'LOCAL',
        'OK'
      ]);
      
    } catch(e){
      console.error('Erro ao registrar auditoria:', e);
    }
  }

/**
 * 🔄 FLUXO DE ABERTURA DO SISTEMA
 */

  /**
   * Abre o sistema após login bem-sucedido
   */
    function aplicarProtecoesPlanilhas(){
      const ss = SpreadsheetApp.getActive();
      ss.getSheets().forEach(sh=>{
        try{
          // se já existe proteção e possui descrição do sistema ignorar
          let prot = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET)
                      .find(p=>p.getDescription() === 'Protegido pelo sistema');
          if(!prot){
            prot = sh.protect();
            prot.setDescription('Protegido pelo sistema');
            prot.setWarningOnly(false);
            // permite apenas o script editar
            prot.removeEditors(prot.getEditors());
            if (prot.canDomainEdit()) {
              prot.setDomainEdit(false);
            }
          }
        }catch(e){
          console.warn('falha ao proteger', sh.getName(), e);
        }
      });
    }

    function removerProtecoes(){
      const ss = SpreadsheetApp.getActive();
      ss.getSheets().forEach(sh=>{
        try{
          const prots = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET);
          prots.forEach(p=>{
            if(p.getDescription() === 'Protegido pelo sistema'){
              p.remove();
            }
          });
        }catch(e){
          console.warn('falha ao remover proteção', sh.getName(), e);
        }
      });
    }

    function executarSeFuncao_(nomeFuncao){
      try {
        if (typeof this[nomeFuncao] === 'function') {
          this[nomeFuncao]();
          return true;
        }
      } catch (e) {
        console.warn('Falha ao executar função opcional:', nomeFuncao, e);
      }
      return false;
    }

    function abrirSistemaPosLogin(emailUsuario){
      try {
        // 1️⃣ Verifica se setup foi concluído (com fallback para projetos sem getConfig)
        let setupConcluido = true;
        if (typeof getConfig === 'function') {
          setupConcluido = getConfig('SETUP_CONCLUIDO') === 'SIM';
        }
        
        if(!setupConcluido){
          // 2️⃣ Abre fluxo: boas-vindas → config → HOME
          if (typeof popupBoasVindasSistema === 'function') {
            popupBoasVindasSistema();
            return { ok: true, msg: 'Fluxo de configuração inicial aberto.' };
          }
        }
        
        // 3️⃣ Setup já feito, abre direto para HOME
        // aplica proteções sempre (nenhum usuário comum edita sem permissão da equipe de dev)
        aplicarProtecoesPlanilhas();

        // aplica visibilidade de abas conforme perfil do usuário
        try{
          aplicarVisibilidadeAbasPorPerfil();
        }catch(e){
          console.warn('Erro ao aplicar visibilidade de abas:', e);
        }

        // garante que as operações anteriores foram aplicadas antes de criar a HOME
        SpreadsheetApp.flush();

        executarSeFuncao_('criarHomeDashboard');
        executarSeFuncao_('abrirPainelFlutuante');

        // garante recarga de menu/fluxos após autenticação
        if (!executarSeFuncao_('recarregarMenu')) {
          executarSeFuncao_('onOpen');
        }

        // tenta inicialização complementar somente se existir
        executarSeFuncao_('inicializacaoSilenciosa');

        return { ok: true, msg: 'Sistema inicializado com sucesso.' };
        
      } catch(e){
        console.error('Erro em abrirSistemaPosLogin:', e);
        return { ok: false, msg: 'Erro ao iniciar sistema: ' + e.message };
      }
    }

  /**
   * Aplica visibilidade das abas com base no perfil do usuário atual.
   * - OPERACIONAL: mostra apenas um conjunto reduzido de abas.
   * - GERENCIAL: mostra todas as abas.
   */
    function aplicarVisibilidadeAbasPorPerfil(){
      const ss = SpreadsheetApp.getActive();
      const usuario = obterUsuarioAtual();

      // se não há usuário logado, bloqueia tudo
      if(!usuario){
        bloquearVisualizacaoSemLogin();
        return;
      }

      // Requisito operacional: após login, todas as abas devem abrir automaticamente.
      const sheets = ss.getSheets();
      sheets.forEach(sh => {
        try{
          sh.showSheet();
        }catch(e){
          console.warn('Falha ao exibir aba', sh.getName(), e);
        }
      });

      // aba de bloqueio não deve ficar visível após autenticação
      try{
        const shBloq = ss.getSheetByName('BLOQUEIO_LOGIN');
        if(shBloq) shBloq.hideSheet();
      }catch(e){}
    }

  /**
   * Esconde todas as abas do documento, impedindo visualização enquanto não houver usuário logado.
   */
    function bloquearVisualizacaoSemLogin(){
      const ss = SpreadsheetApp.getActive();
      // cria ou recupera uma aba de bloqueio para garantir que pelo menos UMA aba fique visível
      let shBloq = ss.getSheetByName('BLOQUEIO_LOGIN');
      if(!shBloq){
        try{
          shBloq = ss.insertSheet('BLOQUEIO_LOGIN');
          shBloq.clear();
          shBloq.getRange('A1').setValue('Sistema bloqueado. Faça login pelo menu.');
          shBloq.setTabColor('#ffcccc');
        }catch(e){
          console.warn('Não foi possível criar aba BLOQUEIO_LOGIN:', e);
        }
      }

      const sheets = ss.getSheets();
      sheets.forEach(sh => {
        try{
          if(sh.getName() === 'BLOQUEIO_LOGIN'){
            sh.showSheet();
          } else {
            // esconde as demais abas (não é possível esconder todas as abas sem deixar uma visível)
            try{ sh.hideSheet(); }catch(e){ /* ignorar */ }
          }
        }catch(e){
          console.warn('Falha ao ajustar aba', sh.getName(), e);
        }
      });

      // garante também que proteções estejam aplicadas
      try{ aplicarProtecoesPlanilhas(); }catch(e){}
    }

  /**
   * Menu da página inicial com opções de login
   */
  function popupTelaInicial(){
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          
          .container {
            background: white;
            border-radius: 15px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            padding: 50px 40px;
            text-align: center;
            max-width: 550px;
            animation: slideIn 0.4s ease;
          }
          
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translateY(-30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          .logo {
            font-size: 60px;
            margin-bottom: 20px;
          }
          
          h1 {
            font-size: 32px;
            color: #333;
            margin-bottom: 12px;
          }
          
          p {
            color: #666;
            font-size: 15px;
            margin-bottom: 30px;
            line-height: 1.6;
          }
          
          .buttons {
            display: flex;
            gap: 15px;
            flex-direction: column;
          }
          
          button {
            padding: 14px 20px;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 15px;
            cursor: pointer;
            transition: 0.3s;
          }
          
          .btn-login {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          
          .btn-login:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
          }
          
          .btn-criar {
            background: white;
            color: #667eea;
            border: 2px solid #667eea;
          }
          
          .btn-criar:hover {
            background: #f8f9ff;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">📦</div>
          <h1>Gestão de Depósito</h1>
          <p>Bem-vindo ao sistema de gerenciamento de estoque.<br>
          Faça login ou crie uma conta para começar.</p>
          
          <div class="buttons">
            <button class="btn-login" onclick="irLogin()">
              🔐 Fazer Login
            </button>
            <button class="btn-criar" onclick="irCriar()">
              ✅ Criar Conta
            </button>
          </div>
        </div>
        
        <script>
          function irLogin() {
            google.script.run.withSuccessHandler(function(){
              try{ google.script.host.close(); }catch(e){}
            }).abrirPopupLogin();
          }

          function irCriar() {
            google.script.run.withSuccessHandler(function(){
              try{ google.script.host.close(); }catch(e){}
            }).abrirPopupCriarUsuario();
          }
        </script>
      </body>
      </html>
    `;
    
    const ui = HtmlService.createHtmlOutput(html)
      .setWidth(600)
      .setHeight(700);

    // garante bloqueio visual se não houver usuário logado
    try{ bloquearVisualizacaoSemLogin(); }catch(e){ console.warn('Erro ao bloquear visualização na tela inicial:', e); }

    SpreadsheetApp.getUi().showModelessDialog(ui, '🏠 Gestão de Depósito');
  }
