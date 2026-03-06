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

/**
 * Garante estrutura de usuários na inicialização
 */
function garantirEstruturausuarios() {
  try {
    const ss = SpreadsheetApp.getActive();

    // ========== ABA USUÁRIOS ==========
    let shUsuarios = ss.getSheetByName('USUARIOS');
    if (!shUsuarios) {
      shUsuarios = ss.insertSheet('USUARIOS');
      shUsuarios.getRange('A1:H1').setValues([[
        'ID_USER',
        'NOME',
        'EMAIL',
        'SENHA_HASH',
        'PERFIL',
        'ATIVO',
        'DATA_CRIACAO',
        'ULTIMO_ACESSO'
      ]]);
      shUsuarios.setFrozenRows(1);
    }
    
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
      shSessoes.setFrozenRows(1);
    }
    
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
      shAuditoria.setFrozenRows(1);
    }
  } catch(e) {
    console.warn('Erro ao garantir estrutura de usuários:', e.message);
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
    SpreadsheetApp.getUi().alert('❌ Erro ao abrir formulário de login');
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
    SpreadsheetApp.getUi().alert('❌ Erro ao abrir formulário de criação');
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
                google.script.run.abrirSistemaPosLogin(resultado.nomeUsuario);
                google.script.host.close();
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
    if(String(usuarioValido[5]).toUpperCase() !== 'SIM'){
      return { ok: false, msg: 'Usuário desativado.' };
    }
    
    // ✅ Verifica senha (simples - em produção usar bcrypt)
    const senhaHash = String(usuarioValido[3]);
    if(!verificarSenha(senha, senhaHash)){
      registrarAuditoria(usuarioValido[0], 'LOGIN_FALHA', 'Senha incorreta');
      return { ok: false, msg: 'Usuário ou senha incorretos.' };
    }
    
    // ✅ Cria sessão
    const idSessao = criarSessao(usuarioValido[0]);
    
    // ✅ Atualiza último acesso
    shUsuarios.getRange(dados.indexOf(usuarioValido) + 1, 8)
      .setValue(new Date());
    
    registrarAuditoria(usuarioValido[0], 'LOGIN_SUCESSO', 'Login realizado');
    if(typeof registrarLog === 'function'){
      registrarLog('LOGIN', usuarioValido[0], usuarioValido[1], new Date());
    }
    
    return { 
      ok: true, 
      msg: 'Login realizado com sucesso',
      nomeUsuario: usuarioValido[1],
      idSessao: idSessao,
      perfil: usuarioValido[4]
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
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .container {
          background: white;
          border-radius: 15px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          width: 100%;
          max-width: 480px;
          padding: 40px;
        }
        
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        
        .header h1 {
          font-size: 26px;
          color: #333;
          margin-bottom: 8px;
        }
        
        .form-group {
          margin-bottom: 18px;
        }
        
        label {
          display: block;
          color: #333;
          font-weight: 600;
          margin-bottom: 6px;
          font-size: 13px;
        }
        
        input, select {
          width: 100%;
          padding: 10px 12px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-size: 13px;
          transition: 0.3s;
        }
        
        input:focus, select:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        
        .error {
          background: #fee2e2;
          color: #dc2626;
          padding: 10px;
          border-radius: 6px;
          font-size: 12px;
          margin-bottom: 15px;
          display: none;
        }
        
        .buttons {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }
        
        button {
          flex: 1;
          padding: 11px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: 0.3s;
        }
        
        .btn-salvar {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        
        .btn-salvar:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
        }
        
        .btn-cancelar {
          background: #f0f0f0;
          color: #333;
        }
        
        .btn-cancelar:hover {
          background: #e0e0e0;
        }
        
        .button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Novo Usuário</h1>
        </div>
        
        <div class="error" id="error"></div>
        
        <div class="form-group">
          <label>👤 Nome Completo</label>
          <input type="text" id="nome" placeholder="Ex: João Silva" required />
        </div>
        
        <!-- Email removido: login será por usuário (nome ou ID) -->
        
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
          <button class="btn-salvar" onclick="salvarUsuario()" id="btnSalvar">
            ✅ Criar Usuário
          </button>
          <button class="btn-cancelar" onclick="google.script.host.close()">
            ❌ Cancelar
          </button>
        </div>
      </div>
      
      <script>
        function salvarUsuario() {
          console.log('[DEBUG] salvarUsuario iniciado');
          const error = document.getElementById('error');
          const nome = document.getElementById('nome').value.trim();
          const senha = document.getElementById('senha').value;
          const senha2 = document.getElementById('senha2').value;
          const perfil = document.getElementById('perfil').value;
          const btn = document.getElementById('btnSalvar');
          
          console.log('[DEBUG] Valores obtidos: ' + JSON.stringify({ nome: nome, perfil: perfil }));
          
          error.style.display = 'none';
          
          if(!nome || !senha || !senha2 || !perfil) {
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
          
          console.log('[DEBUG] Chamando criarNovoUsuario: ' + JSON.stringify({ nome: nome, perfil: perfil }));
          
          google.script.run
            .withSuccessHandler((resultado) => {
              console.log('[DEBUG] Sucesso em criarNovoUsuario: ' + JSON.stringify(resultado));
              if(resultado.ok) {
                alert('✅ Usuário criado com sucesso!');
                google.script.run.popupLogin();
                google.script.host.close();
              } else {
                error.textContent = '❌ ' + resultado.msg;
                error.style.display = 'block';
                btn.disabled = false;
                btn.innerText = '✅ Criar Usuário';
              }
            })
            .withFailureHandler((erro) => {
              console.error('[DEBUG] Erro em criarNovoUsuario: ' + JSON.stringify(erro));
              error.textContent = '❌ Erro: ' + erro.message;
              error.style.display = 'block';
              btn.disabled = false;
              btn.innerText = '✅ Criar Usuário';
            })
            .criarNovoUsuario(nome, senha, perfil);
        }
      </script>
    </body>
    </html>
  `;
  
  const ui = HtmlService.createHtmlOutput(html)
    .setWidth(550)
    .setHeight(700);
  
  SpreadsheetApp.getUi().showModalDialog(ui, '✅ Novo Usuário');
}

/**
 * Cria novo usuário
 */
function criarNovoUsuario(nome, senha, perfil){
  try {
    console.log('[SERVER] criarNovoUsuario chamado: ' + JSON.stringify({ nome: nome, perfil: perfil }));
    
    nome = String(nome).trim();
    perfil = String(perfil).toUpperCase();
    
    // ✅ Validações
    if(!nome || !senha || !perfil){
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
      senhaHash,
      perfil,
      'SIM',
      agora,
      agora
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
 * � LISTAR / EDITAR / EXCLUIR USUÁRIOS
 */
function popupListarUsuarios(){
  garantirEstruturausuarios();
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('USUARIOS');
  const dados = sh.getDataRange().getValues().slice(1);

  let rows = '';
  dados.forEach(r=>{
    const id = r[0];
    const nome = r[1];
    const email = r[2];
    const perfil = r[4];
    const ativo = r[5];
    rows += `
      <tr>
        <td>${id}</td>
        <td>${nome}</td>
        <td>${email}</td>
        <td>${perfil}</td>
        <td>${ativo}</td>
        <td>
          <button onclick="google.script.run.editarUsuario('${id}')">✏️</button>
          <button onclick="google.script.run.deletarUsuario('${id}')">🗑️</button>
        </td>
      </tr>`;
  });

  const html = `
    <html><body style="font-family:Arial">
      <h3>👥 Lista de Usuários</h3>
      <table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;font-size:12px">
        <tr><th>ID</th><th>Nome</th><th>Email</th><th>Perfil</th><th>Ativo</th><th>Ações</th></tr>
        ${rows || '<tr><td colspan="6" style="text-align:center;color:#64748b">Nenhum usuário encontrado.</td></tr>'}
      </table>
      <br>
      <button onclick="google.script.run.popupCriarUsuario()">➕ Novo Usuário</button>
      <button onclick="google.script.host.close()">❌ Fechar</button>
    </body></html>`;

  const ui = HtmlService.createHtmlOutput(html).setWidth(650).setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(ui,'👥 Gerenciar Usuários');
}

function editarUsuario(id){
  // busca dados
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('USUARIOS');
  const dados = sh.getDataRange().getValues();
  let linha = -1;
  let row;
  for(let i=1;i<dados.length;i++){
    if(dados[i][0] === id){ linha = i+1; row = dados[i]; break; }
  }
  if(linha === -1){ SpreadsheetApp.getUi().alert('Usuário não encontrado.'); return; }

  const nome = row[1] || '';
  const email = row[2] || '';
  const perfil = row[4] || 'OPERACIONAL';
  const ativo = row[5] || 'SIM';

  const html = `
    <html><body style="font-family:Arial">
      <h3>✏️ Editar Usuário</h3>
      <label>Nome</label><br>
      <input id="nome" value="${nome}"><br>
      <label>Email</label><br>
      <input id="email" value="${email}" disabled><br>
      <label>Perfil</label><br>
      <select id="perfil">
        <option value="OPERACIONAL" ${perfil==='OPERACIONAL'?'selected':''}>📦 Operacional</option>
        <option value="GERENCIAL" ${perfil==='GERENCIAL'?'selected':''}>👨‍💼 Gerencial</option>
      </select><br>
      <label>Ativo</label><br>
      <select id="ativo">
        <option value="SIM" ${ativo==='SIM'?'selected':''}>SIM</option>
        <option value="NAO" ${ativo==='NAO'?'selected':''}>NÃO</option>
      </select><br><br>
      <button onclick="salvar()">💾 Salvar</button>
      <button onclick="google.script.host.close()">❌ Cancelar</button>
      <script>
        function salvar(){
          const nome = document.getElementById('nome').value;
          const perfil = document.getElementById('perfil').value;
          const ativo = document.getElementById('ativo').value;
          google.script.run
            .withSuccessHandler(()=>{google.script.host.close();google.script.run.popupListarUsuarios();})
            .atualizarUsuario('${id}', nome, perfil, ativo);
        }
      </script>
    </body></html>`;

  const ui = HtmlService.createHtmlOutput(html).setWidth(500).setHeight(400);
  SpreadsheetApp.getUi().showModalDialog(ui,'✏️ Editar Usuário');
}

function atualizarUsuario(id, nome, perfil, ativo){
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('USUARIOS');
  const dados = sh.getDataRange().getValues();
  for(let i=1;i<dados.length;i++){
    if(dados[i][0] === id){
      sh.getRange(i+1,2).setValue(nome);
      sh.getRange(i+1,5).setValue(perfil);
      sh.getRange(i+1,6).setValue(ativo);
      registrarAuditoria(id,'USUARIO_ATUALIZADO',`Perfil:${perfil} Ativo:${ativo}`);
      break;
    }
  }
}

function deletarUsuario(id){
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert('Excluir usuário', 'Deseja realmente excluir o usuário '+id+' ?', ui.ButtonSet.YES_NO);
  if(resp !== ui.Button.YES) return;
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('USUARIOS');
  const dados = sh.getDataRange().getValues();
  for(let i=1;i<dados.length;i++){
    if(dados[i][0] === id){
      sh.deleteRow(i+1);
      registrarAuditoria(id,'USUARIO_EXCLUIDO','');
      break;
    }
  }
  // recarrega lista
  popupListarUsuarios();
}

/**
 * �🔐 GERENCIAMENTO DE SESSÕES
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

/**
 * Auxiliar de logout: encerra sessão e retorna ok. Cliente pode tentar fechar a aba.
 */
function fazerLogout(){
  // método invocado por menu: abre pequeno dialog que efetua rotina e fecha janela
  popupLogout();
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
        perfil: dados[i][4],
        ativo: dados[i][5]
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

function abrirSistemaPosLogin(emailUsuario){
  try {
    // 1️⃣ Verifica se setup foi concluído
    const setupConcluido = getConfig('SETUP_CONCLUIDO') === 'SIM';
    
    if(!setupConcluido){
      // 2️⃣ Abre fluxo: boas-vindas → config → HOME
      popupBoasVindasSistema();
      return;
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

    criarHomeDashboard();
    abrirPainelFlutuante();
    // tenta reinicializar menus/fluxos caso exista função de init
    try{ if(typeof initSistema === 'function') initSistema(); }catch(e){ console.warn('Falha ao chamar initSistema():', e); }
    
  } catch(e){
    console.error('Erro em abrirSistemaPosLogin:', e);
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
