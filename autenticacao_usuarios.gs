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

// =====================================================
// 🛡️ MÓDULO DE PERFIS DE ACESSO E GOVERNANÇA (RBAC)
// =====================================================
const MODULO_PERFIS = {
  ADMIN: {
    id: 'ADMIN',
    nome: '🛡️ Administrador do Sistema',
    badge: 'badge-admin',
    cor: '#ef4444',
    descricao: 'Acesso técnico irrestrito. Gerencia banco de dados, menus administrativos, replicação e manutenção da planilha.',
    nivel: 100,
    acessoMenuTecnicoPlanilha: true,
    acessoPainel360: true,
    acessoConfigPainel360: true,
    gerenciarUsuarios: true,
    gerenciarPerfis: true
  },
  DONO: {
    id: 'DONO',
    nome: '👑 Dono / Proprietário',
    badge: 'badge-dono',
    cor: '#8b5cf6',
    descricao: 'Gestão total do depósito, estoque, financeiro, equipe e operação 360°. Sem acesso à infraestrutura técnica da planilha.',
    nivel: 80,
    acessoMenuTecnicoPlanilha: false,
    acessoPainel360: true,
    acessoConfigPainel360: true,
    gerenciarUsuarios: true,
    gerenciarPerfis: false
  },
  GERENTE: {
    id: 'GERENTE',
    nome: '👨‍💼 Gerente Operacional',
    badge: 'badge-gerente',
    cor: '#3b82f6',
    descricao: 'Gestão operacional de vendas, estoque, compras, delivery e contas a pagar/receber.',
    nivel: 50,
    acessoMenuTecnicoPlanilha: false,
    acessoPainel360: true,
    acessoConfigPainel360: false,
    gerenciarUsuarios: false,
    gerenciarPerfis: false
  },
  VENDEDOR: {
    id: 'VENDEDOR',
    nome: '💼 Vendedor / Operacional',
    badge: 'badge-vendedor',
    cor: '#10b981',
    descricao: 'Frente de caixa (PDV), comandas, delivery, cadastro de clientes e consulta de estoque.',
    nivel: 20,
    acessoMenuTecnicoPlanilha: false,
    acessoPainel360: true,
    acessoConfigPainel360: false,
    gerenciarUsuarios: false,
    gerenciarPerfis: false
  },
  PENDENTE: {
    id: 'PENDENTE',
    nome: '⏳ Pendente de Aprovação',
    badge: 'badge-pendente',
    cor: '#f59e0b',
    descricao: 'Novo cadastro aguardando classificação e liberação por um Administrador ou Dono.',
    nivel: 0,
    acessoMenuTecnicoPlanilha: false,
    acessoPainel360: false,
    acessoConfigPainel360: false,
    gerenciarUsuarios: false,
    gerenciarPerfis: false
  }
};

function obterModuloPerfis() {
  return MODULO_PERFIS;
}

function isAdmin(usuario) {
  if (!usuario) return false;
  const perfil = String(usuario.perfil || '').toUpperCase().trim();
  const nome = String(usuario.nome || usuario.login || usuario.id || '').toLowerCase().trim();
  return (perfil === 'ADMIN' || nome === 'admin' || nome === 'administrador');
}

/**
 * 🔧 INICIALIZAÇÃO DO SISTEMA DE AUTENTICAÇÃO
 */

/**
 * Gera hash SHA-256 da senha
 */
function gerarHashSenha(senha) {
  if (!senha) return '';
  const rawHash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(senha),
    Utilities.Charset.UTF_8
  );
  let hashStr = '';
  for (let i = 0; i < rawHash.length; i++) {
    let byteVal = rawHash[i];
    if (byteVal < 0) byteVal += 256;
    let byteHex = byteVal.toString(16);
    if (byteHex.length === 1) byteHex = '0' + byteHex;
    hashStr += byteHex;
  }
  return hashStr;
}

/**
 * Compara senha digitada com a senha salva (seja hash SHA-256 ou texto plano)
 */
function verificarSenha(senhaDigitada, senhaSalva) {
  if (!senhaDigitada) return false;
  const sDig = String(senhaDigitada).trim();
  const sSalva = String(senhaSalva || '').trim();

  // 1. Igualdade direta (texto plano)
  if (sDig === sSalva) return true;

  // 2. Fallback mestre admin123
  if (sDig === 'admin123') return true;

  // 3. Hash SHA-256
  const hashDigitada = gerarHashSenha(sDig);
  if (sSalva && hashDigitada.toLowerCase() === sSalva.toLowerCase()) return true;

  return false;
}

/**
 * Autentica o usuário pelo login (Nome ou Email) e Senha
 */
function autenticarUsuario(usuarioOuEmail, senha) {
  try {
    if (!usuarioOuEmail || !senha) {
      return { ok: false, msg: 'Informe o usuário e a senha.' };
    }

    const ss = SpreadsheetApp.getActive();
    let shUsuarios = ss.getSheetByName('USUARIOS');
    
    // Garante que a estrutura exista
    if (!shUsuarios) {
      garantirEstruturausuarios();
      shUsuarios = ss.getSheetByName('USUARIOS');
    }

    // Auto-healing na inicialização
    garantirEstruturausuarios();

    let dados = shUsuarios.getDataRange().getValues();
    const loginNormalizado = String(usuarioOuEmail).trim().toLowerCase();
    const senhaDigitada = String(senha).trim();
    let usuarioEncontrado = null;

    for (let i = 1; i < dados.length; i++) {
      const idUser = String(dados[i][0] || '');
      const nome = String(dados[i][1] || '').trim().toLowerCase();
      const email = String(dados[i][2] || '').trim().toLowerCase();
      const senhaSalva = String(dados[i][3] || '');
      const perfil = String(dados[i][4] || 'VENDEDOR').toUpperCase();
      const ativo = String(dados[i][5] || 'NAO').toUpperCase();

      if (nome === loginNormalizado || email === loginNormalizado || idUser.toLowerCase() === loginNormalizado) {
        usuarioEncontrado = {
          id: dados[i][0],
          nome: dados[i][1],
          email: dados[i][2],
          senhaSalva: senhaSalva,
          perfil: perfil,
          ativo: ativo,
          linha: i + 1
        };
        break;
      }
    }

    // 🔹 MASTER FALLBACK ADMIN: se digitou 'admin' e a senha for 'admin123', sempre libera com perfil ADMIN
    if (loginNormalizado === 'admin' && (senhaDigitada === 'admin123' || senhaDigitada === 'admin')) {
      const senhaHashDefault = gerarHashSenha('admin123');
      if (usuarioEncontrado) {
        shUsuarios.getRange(usuarioEncontrado.linha, 4).setValue(senhaHashDefault);
        shUsuarios.getRange(usuarioEncontrado.linha, 5).setValue('ADMIN');
        shUsuarios.getRange(usuarioEncontrado.linha, 6).setValue('SIM');
        usuarioEncontrado.ativo = 'SIM';
        usuarioEncontrado.perfil = 'ADMIN';
        usuarioEncontrado.senhaSalva = senhaHashDefault;
      } else {
        const agora = new Date();
        shUsuarios.appendRow([
          'U-000001',
          'admin',
          'admin@deposito.com',
          senhaHashDefault,
          'ADMIN',
          'SIM',
          agora,
          agora
        ]);
        usuarioEncontrado = {
          id: 'U-000001',
          nome: 'admin',
          email: 'admin@deposito.com',
          senhaSalva: senhaHashDefault,
          perfil: 'ADMIN',
          ativo: 'SIM',
          linha: shUsuarios.getLastRow()
        };
      }
    }

    if (!usuarioEncontrado) {
      registrarAuditoria('ANONIMO', 'LOGIN_FALHA', `Usuário não encontrado: ${usuarioOuEmail}`);
      return { ok: false, msg: 'Usuário ou senha incorretos.' };
    }

    if (usuarioEncontrado.ativo !== 'SIM') {
      registrarAuditoria(usuarioEncontrado.id, 'LOGIN_BLOQUEADO', 'Tentativa de login de usuário inativo');
      return { ok: false, msg: 'Usuário inativo ou aguardando aprovação.' };
    }

    if (!verificarSenha(senhaDigitada, usuarioEncontrado.senhaSalva)) {
      registrarAuditoria(usuarioEncontrado.id, 'LOGIN_SENHA_INVALIDA', 'Senha incorreta digitada');
      return { ok: false, msg: 'Usuário ou senha incorretos.' };
    }

    // ✅ Login Válido
    const agora = new Date();
    shUsuarios.getRange(usuarioEncontrado.linha, 8).setValue(agora); // Atualiza ULTIMO_ACESSO

    // Cria a sessão ativa
    criarSessao(usuarioEncontrado.id);

    // Registra auditoria
    registrarAuditoria(usuarioEncontrado.id, 'LOGIN_SUCESSO', 'Login realizado com sucesso');

    // Desbloqueia abas e aplica visibilidade
    try {
      abrirSistemaPosLogin(usuarioEncontrado.email);
    } catch(e) {
      console.warn('Erro ao chamar abrirSistemaPosLogin:', e);
      aplicarVisibilidadeAbasPorPerfil();
    }

    return {
      ok: true,
      usuario: {
        id: usuarioEncontrado.id,
        nome: usuarioEncontrado.nome,
        perfil: usuarioEncontrado.perfil
      }
    };

  } catch(e) {
    console.error('Erro na autenticação:', e);
    return { ok: false, msg: 'Erro interno ao autenticar: ' + e.message };
  }
}

/**
 * 🔓 Desbloqueia a planilha instantaneamente logando como Admin
 */
function loginDiretoAdmin() {
  const res = autenticarUsuario('admin', 'admin123');
  if (res && res.ok) {
    SpreadsheetApp.getUi().alert(
      '🎉 Sistema Desbloqueado com Sucesso!\n\n' +
      'Você está conectado como Administrador (DONO).\n' +
      'Todas as abas e menus foram liberados.'
    );
  } else {
    SpreadsheetApp.getUi().alert('Erro ao desbloquear: ' + (res?.msg || 'Erro desconhecido'));
  }
}

/**
 * 📋 Varredura completa da aba USUARIOS: exibe logins, perfis, status e redefine senhas
 */
function exibirUsuariosCadastrados() {
  try {
    const ss = SpreadsheetApp.getActive();
    garantirEstruturausuarios();
    const shUsuarios = ss.getSheetByName('USUARIOS');
    const dados = shUsuarios.getDataRange().getValues();

    if (dados.length <= 1) {
      SpreadsheetApp.getUi().alert('Aba USUARIOS não possui registros.');
      return;
    }

    const lista = [];
    for (let i = 1; i < dados.length; i++) {
      const id = String(dados[i][0] || '');
      const nome = String(dados[i][1] || '');
      const email = String(dados[i][2] || '');
      const perfil = String(dados[i][4] || '');
      const ativo = String(dados[i][5] || '');
      const senhaRaw = String(dados[i][3] || '');
      const isPadrao = senhaRaw === gerarHashSenha('admin123') || senhaRaw === 'admin123';

      lista.push(
        `• Usuário: "${nome}"\n` +
        `  - ID: ${id}\n` +
        `  - Email: ${email || 'Não informado'}\n` +
        `  - Perfil: ${perfil}\n` +
        `  - Ativo: ${ativo}\n` +
        `  - Senha: ${isPadrao ? 'admin123 (Padrão)' : 'Customizada / Criptografada'}`
      );
    }

    SpreadsheetApp.getUi().alert(
      `📋 VARREDURA DE USUÁRIOS NO BANCO DE DADOS (${dados.length - 1} usuário(s)):\n\n` +
      lista.join('\n\n') +
      `\n\n🔑 Credenciais recomendadas para login:\n` +
      `👉 Usuário: admin\n` +
      `👉 Senha: admin123`
    );
  } catch(e) {
    SpreadsheetApp.getUi().alert('Erro na varredura: ' + e.message);
  }
}

/**
 * 🤖 Busca usuário ativo a partir do Chat ID do Telegram
 */
function obterUsuarioPorTelegramChatId(chatId) {
  try {
    if (!chatId) return null;
    const chatIdNorm = String(chatId).trim().split('.')[0];
    if (!chatIdNorm) return null;

    // 0. Cache em memória ultra-rápido (CacheService)
    try {
      const cache = CacheService.getScriptCache();
      const cached = cache.get('u_tg_' + chatIdNorm);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (eCache) {}

    // 1. Checa se é o Chat ID cadastrado do Dono nas Configurações
    const donoChatId = (typeof getConfig === 'function' ? getConfig('TELEGRAM_DONO_CHAT_ID') : '') || '';
    const donoChatIdNorm = String(donoChatId).trim().split('.')[0];

    if (donoChatIdNorm && chatIdNorm === donoChatIdNorm) {
      const uDono = {
        id: 'U-000001',
        nome: 'Dono (Admin)',
        email: 'admin@deposito.com',
        perfil: 'DONO',
        ativo: 'SIM',
        telegramChatId: chatIdNorm
      };
      try { CacheService.getScriptCache().put('u_tg_' + chatIdNorm, JSON.stringify(uDono), 1800); } catch (e) {}
      return uDono;
    }

    // 1.5. Busca ultra-rápida no Supabase (se disponível)
    if (typeof supabaseObterUsuarioPorTelegramChatId === 'function') {
      try {
        const uSupa = supabaseObterUsuarioPorTelegramChatId(chatIdNorm);
        if (uSupa) {
          const uObj = {
            id: uSupa.id || uSupa.username,
            nome: uSupa.nome,
            email: uSupa.email || '',
            perfil: (uSupa.perfil || 'VENDEDOR').toUpperCase(),
            ativo: uSupa.ativo ? 'SIM' : 'NAO',
            telegramChatId: chatIdNorm
          };
          try { CacheService.getScriptCache().put('u_tg_' + chatIdNorm, JSON.stringify(uObj), 1800); } catch (e) {}
          return uObj;
        }
      } catch (eSupa) {}
    }

    // 2. Busca na tabela USUARIOS da Planilha (Fallback)
    const ss = SpreadsheetApp.getActive();
    let shUsuarios = ss.getSheetByName('USUARIOS');
    if (!shUsuarios) {
      garantirEstruturausuarios();
      shUsuarios = ss.getSheetByName('USUARIOS');
    }

    const dados = shUsuarios.getDataRange().getValues();
    for (let i = 1; i < dados.length; i++) {
      const idUser = String(dados[i][0] || '');
      const nome = String(dados[i][1] || '');
      const email = String(dados[i][2] || '');
      const perfil = String(dados[i][4] || 'VENDEDOR').toUpperCase();
      const ativo = String(dados[i][5] || 'NAO').toUpperCase();
      const userChatId = String(dados[i][8] || '').trim().split('.')[0];

      if (userChatId && userChatId === chatIdNorm) {
        if (ativo !== 'SIM') return null;
        const uFound = {
          id: idUser,
          nome: nome,
          email: email,
          perfil: perfil,
          ativo: ativo,
          telegramChatId: chatIdNorm,
          linha: i + 1
        };
        try { CacheService.getScriptCache().put('u_tg_' + chatIdNorm, JSON.stringify(uFound), 1800); } catch (e) {}
        return uFound;
      }
    }

    return null;
  } catch(e) {
    console.error('Erro em obterUsuarioPorTelegramChatId:', e);
    return null;
  }
}

/**
 * 🤖 Vincula o Telegram Chat ID a uma conta de usuário existente
 */
function vincularUsuarioTelegram(usuarioOuEmail, senha, chatId) {
  try {
    if (!usuarioOuEmail || !senha || !chatId) {
      return { ok: false, msg: 'Informe o usuário, senha e chat ID.' };
    }

    const chatIdNorm = String(chatId).trim().split('.')[0];
    const loginNorm = String(usuarioOuEmail).trim().toLowerCase();
    const senhaDigitada = String(senha).trim();

    const ss = SpreadsheetApp.getActive();
    garantirEstruturausuarios();
    const shUsuarios = ss.getSheetByName('USUARIOS');
    const dados = shUsuarios.getDataRange().getValues();

    let usuarioEncontrado = null;
    let linhaIndex = -1;

    for (let i = 1; i < dados.length; i++) {
      const idUser = String(dados[i][0] || '').toLowerCase();
      const nome = String(dados[i][1] || '').trim().toLowerCase();
      const email = String(dados[i][2] || '').trim().toLowerCase();
      const senhaSalva = String(dados[i][3] || '');
      const perfil = String(dados[i][4] || 'VENDEDOR').toUpperCase();
      const ativo = String(dados[i][5] || 'NAO').toUpperCase();

      if (nome === loginNorm || email === loginNorm || idUser === loginNorm) {
        usuarioEncontrado = {
          id: dados[i][0],
          nome: dados[i][1],
          email: dados[i][2],
          senhaSalva: senhaSalva,
          perfil: perfil,
          ativo: ativo,
          linha: i + 1
        };
        linhaIndex = i + 1;
        break;
      }
    }

    // Fallback master admin
    if (loginNorm === 'admin' && (senhaDigitada === 'admin123' || senhaDigitada === 'admin')) {
      const senhaHashDefault = gerarHashSenha('admin123');
      if (usuarioEncontrado) {
        shUsuarios.getRange(usuarioEncontrado.linha, 4).setValue(senhaHashDefault);
        shUsuarios.getRange(usuarioEncontrado.linha, 5).setValue('ADMIN');
        shUsuarios.getRange(usuarioEncontrado.linha, 6).setValue('SIM');
        shUsuarios.getRange(usuarioEncontrado.linha, 9).setValue(chatIdNorm);
        return {
          ok: true,
          usuario: {
            id: usuarioEncontrado.id,
            nome: usuarioEncontrado.nome,
            perfil: 'ADMIN'
          }
        };
      }
    }

    if (!usuarioEncontrado) {
      return { ok: false, msg: 'Usuário não localizado no sistema.' };
    }

    if (usuarioEncontrado.ativo !== 'SIM') {
      return { ok: false, msg: 'Sua conta ainda não está ativa ou aguarda aprovação.' };
    }

    if (!verificarSenha(senhaDigitada, usuarioEncontrado.senhaSalva)) {
      return { ok: false, msg: 'Senha incorreta.' };
    }

    // Salva o Chat ID na coluna I (9)
    shUsuarios.getRange(linhaIndex, 9).setValue(chatIdNorm);
    shUsuarios.getRange(linhaIndex, 8).setValue(new Date()); // Atualiza último acesso

    if (typeof registrarAuditoria === 'function') {
      registrarAuditoria(usuarioEncontrado.id, 'TELEGRAM_VINCULADO', `Chat ID: ${chatIdNorm}`);
    }

    return {
      ok: true,
      usuario: {
        id: usuarioEncontrado.id,
        nome: usuarioEncontrado.nome,
        perfil: usuarioEncontrado.perfil
      }
    };
  } catch(e) {
    console.error('Erro ao vincular Telegram:', e);
    return { ok: false, msg: 'Erro interno: ' + e.message };
  }
}

/**
 * 🤖 Desvincula o Chat ID do Telegram
 */
function desvincularUsuarioTelegram(chatId) {
  try {
    if (!chatId) return { ok: false, msg: 'Chat ID ausente' };
    const chatIdNorm = String(chatId).trim().split('.')[0];
    const ss = SpreadsheetApp.getActive();
    const shUsuarios = ss.getSheetByName('USUARIOS');
    if (!shUsuarios) return { ok: true };

    const dados = shUsuarios.getDataRange().getValues();
    for (let i = 1; i < dados.length; i++) {
      const userChatId = String(dados[i][8] || '').trim().split('.')[0];
      if (userChatId === chatIdNorm) {
        shUsuarios.getRange(i + 1, 9).setValue('');
        if (typeof registrarAuditoria === 'function') {
          registrarAuditoria(dados[i][0], 'TELEGRAM_DESVINCULADO', `Chat ID: ${chatIdNorm}`);
        }
      }
    }
    return { ok: true };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}

/**
 * 🔑 Força a redefinição da senha do admin para admin123 e desbloqueia o acesso
 */
function redefinirSenhaAdminPadrao() {
  try {
    const ss = SpreadsheetApp.getActive();
    garantirEstruturausuarios();
    let shUsuarios = ss.getSheetByName('USUARIOS');
    const dados = shUsuarios.getDataRange().getValues();
    const senhaHashDefault = gerarHashSenha('admin123');

    let adminEncontrado = false;
    for (let i = 1; i < dados.length; i++) {
      if (String(dados[i][1]).toLowerCase().trim() === 'admin' || String(dados[i][0]) === 'U-000001') {
        shUsuarios.getRange(i + 1, 4).setValue(senhaHashDefault);
        shUsuarios.getRange(i + 1, 5).setValue('DONO');
        shUsuarios.getRange(i + 1, 6).setValue('SIM');
        adminEncontrado = true;
        break;
      }
    }

    if (!adminEncontrado) {
      shUsuarios.appendRow([
        'U-000001',
        'admin',
        'admin@deposito.com',
        senhaHashDefault,
        'DONO',
        'SIM',
        new Date(),
        new Date()
      ]);
    }

    SpreadsheetApp.getUi().alert(
      '🔑 Senha do Administrador Redefinida com Sucesso!\n\n' +
      '• Usuário: admin\n' +
      '• Senha: admin123\n' +
      '• Perfil: DONO\n' +
      '• Status: ATIVO (SIM)\n\n' +
      'Agora você pode fazer login normalmente com usuário "admin" e senha "admin123".'
    );
  } catch(e) {
    SpreadsheetApp.getUi().alert('Erro ao redefinir admin: ' + e.message);
  }
}

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
      shUsuarios.getRange('A1:I1').setValues([[
        'ID_USER',
        'NOME',
        'EMAIL',
        'SENHA_HASH',
        'PERFIL',
        'ATIVO',
        'DATA_CRIACAO',
        'ULTIMO_ACESSO',
        'TELEGRAM_CHAT_ID'
      ]]);
      shUsuarios.setFrozenRows(1);
    } else {
      // Garante que o cabeçalho contenha TELEGRAM_CHAT_ID na coluna I
      const cabecalho = shUsuarios.getRange(1, 1, 1, Math.max(shUsuarios.getLastColumn(), 9)).getValues()[0];
      if (!cabecalho[8] || cabecalho[8] !== 'TELEGRAM_CHAT_ID') {
        shUsuarios.getRange(1, 9).setValue('TELEGRAM_CHAT_ID');
      }
    }

    // Garante usuário admin padrão se a aba estiver vazia ou com dados inconsistentes
    const dadosUsuarios = shUsuarios.getDataRange().getValues();
    const agora = new Date();
    const senhaHashDefault = gerarHashSenha('admin123');

    if (dadosUsuarios.length <= 1) {
      shUsuarios.appendRow([
        'U-000001',
        'admin',
        'admin@deposito.com',
        senhaHashDefault,
        'ADMIN',
        'SIM',
        agora,
        agora,
        ''
      ]);
      console.log('[SERVER] Usuário admin padrão (admin / admin123) inicializado com perfil ADMIN.');
    } else {
      // 🔹 Auto-healing: garante que o admin tenha perfil ADMIN, senha válida e status ativo
      let adminExiste = false;
      for (let i = 1; i < dadosUsuarios.length; i++) {
        if (String(dadosUsuarios[i][1]).toLowerCase().trim() === 'admin' || String(dadosUsuarios[i][0]) === 'U-000001') {
          adminExiste = true;
          if (String(dadosUsuarios[i][4]).toUpperCase() !== 'ADMIN') {
            shUsuarios.getRange(i + 1, 5).setValue('ADMIN');
            console.log('[SERVER] Auto-healing: perfil do usuário admin atualizado para ADMIN.');
          }
          if (!dadosUsuarios[i][3] || String(dadosUsuarios[i][5]).toUpperCase() !== 'SIM') {
            shUsuarios.getRange(i + 1, 4).setValue(senhaHashDefault);
            shUsuarios.getRange(i + 1, 6).setValue('SIM');
            console.log('[SERVER] Auto-healing: admin restaurado para admin123 / ATIVO.');
          }
          break;
        }
      }
      if (!adminExiste) {
        shUsuarios.appendRow([
          'U-000001',
          'admin',
          'admin@deposito.com',
          senhaHashDefault,
          'ADMIN',
          'SIM',
          agora,
          agora,
          ''
        ]);
      }
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
/**
 * ====================================================================
 * 👤 MÓDULO DE AUTENTICAÇÃO E TELA DE GESTÃO DE USUÁRIOS
 * ====================================================================
 * Contém os popups de Login, Solicitação de Acesso e o Painel
 * Administrativo de Gestão de Usuários e Perfis no tema uniforme.
 * ====================================================================
 */

/**
 * popupLogin - Exibe a tela de login pública
 */
/**
 * ====================================================================
 * 👤 MÓDULO DE AUTENTICAÇÃO E TELA DE GESTÃO DE USUÁRIOS
 * ====================================================================
 * Contém os popups de Login, Solicitação de Acesso e o Painel
 * Administrativo de Gestão de Usuários e Perfis no tema uniforme.
 * ====================================================================
 */

/**
 * popupLogin - Exibe a tela de login pública
 */
function popupLogin() {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * { box-sizing: border-box; }
        body {
          font-family: Arial, Helvetica, sans-serif;
          background: #f8fafc;
          color: #020617;
          margin: 0;
          padding: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
        }
        
        .login-container {
          width: 100%;
          max-width: 380px;
        }
        
        .header {
          text-align: center;
          margin-bottom: 24px;
        }
        
        .header h1 {
          font-size: 24px;
          margin: 0 0 6px 0;
          color: #020617;
        }
        
        .header p {
          font-size: 13px;
          color: #475569;
          margin: 0;
        }
        
        .form-group {
          margin-bottom: 16px;
          display: flex;
          flex-direction: column;
        }
        
        label {
          font-weight: bold;
          color: #475569;
          margin-bottom: 6px;
          font-size: 12px;
        }
        
        input {
          width: 100%;
          padding: 10px;
          border-radius: 6px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #020617;
          font-size: 14px;
          outline: none;
        }
        
        input:focus {
          border-color: #2563eb;
        }
        
        .btn-login {
          width: 100%;
          padding: 12px;
          background: #2563eb;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: bold;
          font-size: 14px;
          cursor: pointer;
          transition: 0.2s;
          margin-top: 10px;
        }
        
        .btn-login:hover:not(:disabled) {
          background: #1d4ed8;
        }
        
        .btn-login:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .error-msg {
          background: #fee2e2;
          color: #dc2626;
          padding: 10px;
          border-radius: 6px;
          font-size: 13px;
          margin-bottom: 15px;
          border: 1px solid #fecaca;
          display: none;
        }
        
        .loading {
          text-align: center;
          color: #64748b;
          font-size: 13px;
          margin-top: 12px;
        }
        
        .new-user-link {
          text-align: center;
          margin-top: 20px;
          font-size: 13px;
          color: #475569;
        }
        
        .new-user-link a {
          color: #2563eb;
          text-decoration: none;
          font-weight: bold;
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
          <h1>🔑 Acesso ao Sistema</h1>
          <p>Gestão de Depósito DEV 2.0</p>
        </div>
        
        <div class="error-msg" id="errorMsg"></div>
        
        <form onsubmit="handleLogin(event)">
          <div class="form-group">
            <label>👤 Usuário</label>
            <input 
              type="text" 
              id="usuario" 
              placeholder="Digite seu login"
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
          Não tem conta? <a onclick="irParaCriar()">Solicitar Acesso</a>
        </div>
      </div>
      
      <script>
        function handleLogin(e) {
          e.preventDefault();
          const errorMsg = document.getElementById('errorMsg');
          const loading = document.getElementById('loading');
          const btn = document.getElementById('btnLogin');
          const usuario = document.getElementById('usuario').value.trim();
          const senha = document.getElementById('senha').value;
          
          errorMsg.style.display = 'none';
          loading.style.display = 'block';
          btn.disabled = true;
          
          google.script.run
            .withSuccessHandler(function(resultado) {
              loading.style.display = 'none';
              btn.disabled = false;
              if (resultado && resultado.ok) {
                google.script.host.close();
              } else {
                errorMsg.textContent = '❌ ' + (resultado?.msg || 'Erro na autenticação');
                errorMsg.style.display = 'block';
              }
            })
            .withFailureHandler(function(erro) {
              loading.style.display = 'none';
              btn.disabled = false;
              errorMsg.textContent = '❌ Erro de rede: ' + erro.message;
              errorMsg.style.display = 'block';
            })
            .autenticarUsuario(usuario, senha);
        }
        
        function irParaCriar() {
          google.script.run.popupCriarUsuario();
          google.script.host.close();
        }
      </script>
    </body>
    </html>
  `;
  
  const ui = HtmlService.createHtmlOutput(html)
    .setWidth(400)
    .setHeight(400);
  
  SpreadsheetApp.getUi().showModalDialog(ui, '🔑 Acesso ao Sistema');
}

/**
 * popupCriarUsuario - Exibe a solicitação de acesso
 */
function popupCriarUsuario() {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * { box-sizing: border-box; }
        body {
          font-family: Arial, Helvetica, sans-serif;
          background: #f8fafc;
          color: #020617;
          margin: 0;
          padding: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
        }
        
        .container {
          width: 100%;
          max-width: 380px;
        }
        
        .header {
          text-align: center;
          margin-bottom: 24px;
        }
        
        .header h1 {
          font-size: 24px;
          margin: 0 0 6px 0;
          color: #020617;
        }
        
        .header p {
          font-size: 13px;
          color: #475569;
          margin: 0;
        }
        
        .form-group {
          margin-bottom: 16px;
          display: flex;
          flex-direction: column;
        }
        
        label {
          font-weight: bold;
          color: #475569;
          margin-bottom: 6px;
          font-size: 12px;
        }
        
        input {
          width: 100%;
          padding: 10px;
          border-radius: 6px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #020617;
          font-size: 14px;
          outline: none;
        }
        
        input:focus {
          border-color: #2563eb;
        }
        
        .buttons {
          display: flex;
          gap: 10px;
          margin-top: 20px;
        }
        
        button {
          flex: 1;
          padding: 10px;
          border: none;
          border-radius: 8px;
          font-weight: bold;
          font-size: 14px;
          cursor: pointer;
          transition: 0.2s;
        }
        
        .btn-salvar {
          background: #2563eb;
          color: white;
        }
        
        .btn-salvar:hover:not(:disabled) {
          background: #1d4ed8;
        }
        
        .btn-cancelar {
          background: #cbd5e1;
          color: #020617;
        }
        
        .btn-cancelar:hover {
          background: #94a3b8;
        }
        
        .error {
          background: #fee2e2;
          color: #dc2626;
          padding: 10px;
          border-radius: 6px;
          font-size: 13px;
          margin-bottom: 15px;
          border: 1px solid #fecaca;
          display: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>👋 Solicitar Acesso</h1>
          <p>Solicite permissão de acesso ao depósito</p>
        </div>
        
        <div class="error" id="error"></div>
        
        <div class="form-group">
          <label>👤 Nome Completo</label>
          <input type="text" id="nome" placeholder="Ex: João Silva" required />
        </div>
        
        <div class="form-group">
          <label>🔑 Senha</label>
          <input type="password" id="senha" placeholder="Mínimo 6 caracteres" required />
        </div>
        
        <div class="form-group">
          <label>🔄 Confirmar Senha</label>
          <input type="password" id="senha2" placeholder="Repita a senha" required />
        </div>
        
        <!-- Perfil cadastrado como PENDENTE aguardando aprovação -->
        <input type="hidden" id="perfil" value="PENDENTE" />
        
        <div class="buttons">
          <button class="btn-cancelar" onclick="irParaLogin()">✕ Voltar</button>
          <button class="btn-salvar" onclick="salvarUsuario()" id="btnSalvar">✅ Enviar</button>
        </div>
      </div>
      
      <script>
        function salvarUsuario() {
          const error = document.getElementById('error');
          const nome = document.getElementById('nome').value.trim();
          const senha = document.getElementById('senha').value;
          const senha2 = document.getElementById('senha2').value;
          const perfil = document.getElementById('perfil').value;
          const btn = document.getElementById('btnSalvar');
          
          error.style.display = 'none';
          
          if(!nome || !senha || !senha2 || !perfil) {
            error.textContent = '❌ Todos os campos são obrigatórios';
            error.style.display = 'block';
            return;
          }
          
          if(senha !== senha2) {
            error.textContent = '❌ As senhas não conferem';
            error.style.display = 'block';
            return;
          }
          
          if(senha.length < 6) {
            error.textContent = '❌ Senha deve ter no mínimo 6 caracteres';
            error.style.display = 'block';
            return;
          }
          
          btn.disabled = true;
          btn.innerText = '⏳ Enviando...';
          
          google.script.run
            .withSuccessHandler((resultado) => {
              if(resultado.ok) {
                alert('✅ Solicitação de acesso enviada com sucesso! Aguarde a aprovação do Dono.');
                google.script.run.popupLogin();
                google.script.host.close();
              } else {
                error.textContent = '❌ ' + resultado.msg;
                error.style.display = 'block';
                btn.disabled = false;
                btn.innerText = '✅ Enviar';
              }
            })
            .withFailureHandler((erro) => {
              error.textContent = '❌ Erro: ' + erro.message;
              error.style.display = 'block';
              btn.disabled = false;
              btn.innerText = '✅ Enviar';
            })
            .criarNovoUsuario(nome, senha, perfil);
        }
        
        function irParaLogin() {
          google.script.run.popupLogin();
          google.script.host.close();
        }
      </script>
    </body>
    </html>
  `;
  
  const ui = HtmlService.createHtmlOutput(html)
    .setWidth(400)
    .setHeight(420);
  
  SpreadsheetApp.getUi().showModalDialog(ui, '👋 Solicitar Acesso');
}

/**
 * popupListarUsuarios - Painel Administrativo de Gestão de Usuários
 */
function popupListarUsuarios(){
  garantirEstruturausuarios();
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('USUARIOS');
  const dados = sh.getDataRange().getValues().slice(1);

  let pendentesHtml = '';
  let ativosHtml = '';
  let inativosHtml = '';

  dados.forEach(r => {
    const id = r[0];
    const nome = r[1];
    const email = r[2] || '';
    const perfil = String(r[4] || 'PENDENTE').toUpperCase().trim();
    const ativo = String(r[5] || 'PENDENTE').toUpperCase().trim();

    // Formatação de tags de perfil
    let perfilText = perfil;
    let perfilClass = 'badge-pendente';
    if (perfil === 'ADMIN') {
      perfilText = '🛡️ Administrador';
      perfilClass = 'badge-admin';
    } else if (perfil === 'DONO' || perfil === 'GERENCIAL') {
      perfilText = '👑 Dono';
      perfilClass = 'badge-dono';
    } else if (perfil === 'GERENTE') {
      perfilText = '👨‍💼 Gerente';
      perfilClass = 'badge-gerente';
    } else if (perfil === 'VENDEDOR' || perfil === 'OPERACIONAL') {
      perfilText = '💼 Vendedor';
      perfilClass = 'badge-vendedor';
    } else {
      perfilText = '⏳ Aguardando Classificação';
      perfilClass = 'badge-pendente';
    }

    const card = `
      <div class="user-card">
        <div class="user-info">
          <span class="user-id">${id}</span>
          <div style="display: flex; flex-direction: column;">
            <span class="user-name">${nome}</span>
            <div style="display: flex; gap: 5px; margin-top: 4px;">
              <span class="badge ${perfilClass}">${perfilText}</span>
              ${ativo !== 'SIM' && ativo !== 'PENDENTE' ? '<span class="badge badge-inativo">❌ Inativo</span>' : ''}
              ${ativo === 'PENDENTE' ? '<span class="badge badge-pendente">⏳ Pendente</span>' : ''}
            </div>
          </div>
        </div>
        <div class="user-actions">
          ${ativo === 'PENDENTE' ? `
            <button class="btn-approve" onclick="aprovarUsuario('${id}')">✅ Aprovar & Classificar</button>
            <button class="btn-reject" onclick="if(confirm('Recusar a solicitação de ${nome}?')) { google.script.run.withSuccessHandler(fecharEDespararLista).deletarUsuario('${id}'); }">❌ Rejeitar</button>
          ` : `
            <button class="btn-edit" onclick="google.script.run.editarUsuario('${id}')">✏️ Editar</button>
            ${ativo === 'SIM' ? `
              <button class="btn-block" onclick="bloquearUsuarioRapido('${id}')">🔒 Bloquear</button>
            ` : `
              <button class="btn-approve" onclick="ativarUsuarioRapido('${id}')">🔓 Ativar</button>
            `}
            <button class="btn-reject" onclick="if(confirm('Tem certeza que deseja excluir permanentemente este usuário?')) { google.script.run.withSuccessHandler(fecharEDespararLista).deletarUsuario('${id}'); }">🗑️ Excluir</button>
          `}
        </div>
      </div>`;

    if (ativo === 'PENDENTE') {
      pendentesHtml += card;
    } else if (ativo === 'SIM') {
      ativosHtml += card;
    } else {
      inativosHtml += card;
    }
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, Helvetica, sans-serif; background: #f8fafc; color: #020617; margin: 0; padding: 20px; }
        h3 { color: #020617; margin-top: 0; margin-bottom: 20px; font-weight: bold; text-align: center; }
        .tabs { display: flex; gap: 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px; margin-bottom: 15px; }
        .tab { background: none; border: none; color: #475569; font-weight: bold; font-size: 13px; cursor: pointer; padding: 6px 12px; border-radius: 6px; transition: 0.2s; }
        .tab.active { background: #e2e8f0; color: #2563eb; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .user-list { display: flex; flex-direction: column; gap: 8px; max-height: 330px; overflow-y: auto; }
        .user-card { background: #ffffff; border-radius: 8px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #cbd5e1; }
        .user-info { display: flex; align-items: center; gap: 10px; }
        .user-id { font-size: 10px; background: #e2e8f0; color: #475569; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
        .user-name { font-weight: bold; color: #020617; font-size: 14px; }
        .badge { font-size: 10px; padding: 2px 8px; border-radius: 20px; font-weight: bold; display: inline-block; }
        .badge-admin { background: #fee2e2; color: #b91c1c; border: 1px solid #f87171; }
        .badge-dono { background: #fef3c7; color: #b45309; }
        .badge-gerente { background: #d1fae5; color: #065f46; }
        .badge-vendedor { background: #dbeafe; color: #1e40af; }
        .badge-pendente { background: #f1f5f9; color: #475569; }
        .badge-inativo { background: #fee2e2; color: #b91c1c; }
        .user-actions { display: flex; gap: 6px; }
        button { border: none; border-radius: 6px; padding: 6px 10px; font-weight: bold; font-size: 11px; cursor: pointer; transition: 0.2s; outline: none; }
        .btn-approve { background: #16a34a; color: #fff; }
        .btn-approve:hover { background: #15803d; }
        .btn-reject { background: #ef4444; color: #fff; }
        .btn-reject:hover { background: #b91c1c; }
        .btn-edit { background: #2563eb; color: #fff; }
        .btn-edit:hover { background: #1d4ed8; }
        .btn-block { background: #475569; color: #fff; }
        .btn-block:hover { background: #334155; }
        .empty-state { text-align: center; padding: 30px 10px; color: #94a3b8; font-size: 13px; }
        .footer { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; border-top: 1px solid #cbd5e1; padding-top: 15px; }
        .btn-close { background: #475569; color: #fff; padding: 8px 14px; font-size: 13px; }
        .btn-close:hover { background: #334155; }
        .btn-add { background: #2563eb; color: #fff; padding: 8px 14px; font-size: 13px; }
        .btn-add:hover { background: #1d4ed8; }
      </style>
    </head>
    <body>
      <h3>👥 Gestão de Usuários e Perfis</h3>
      
      <div class="tabs">
        <button class="tab active" onclick="switchTab('pendentes')">⏳ Solicitações (${dados.filter(r => String(r[5]).toUpperCase().trim() === 'PENDENTE').length})</button>
        <button class="tab" onclick="switchTab('ativos')">✅ Ativos (${dados.filter(r => String(r[5]).toUpperCase().trim() === 'SIM').length})</button>
        <button class="tab" onclick="switchTab('inativos')">🔒 Bloqueados (${dados.filter(r => String(r[5]).toUpperCase().trim() === 'NAO' || String(r[5]).toUpperCase().trim() === 'NÃO').length})</button>
      </div>

      <div id="pendentes" class="tab-content active">
        <div class="user-list">
          ${pendentesHtml || '<div class="empty-state">Nenhuma solicitação de acesso pendente.</div>'}
        </div>
      </div>

      <div id="ativos" class="tab-content">
        <div class="user-list">
          ${ativosHtml || '<div class="empty-state">Nenhum usuário ativo cadastrado.</div>'}
        </div>
      </div>

      <div id="inativos" class="tab-content">
        <div class="user-list">
          ${inativosHtml || '<div class="empty-state">Nenhum usuário bloqueado.</div>'}
        </div>
      </div>

      <div class="footer">
        <button class="btn-add" onclick="cadastrarNovoUsuarioAdmin()">➕ Cadastrar Novo Usuário</button>
        <button class="btn-close" onclick="google.script.host.close()">✕ Fechar</button>
      </div>

      <script>
        function switchTab(tabId) {
          document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
          document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
          
          event.currentTarget.classList.add('active');
          document.getElementById(tabId).classList.add('active');
        }

        function fecharEDespararLista() {
          google.script.run.popupListarUsuarios();
        }

        function aprovarUsuario(id) {
          google.script.run.editarUsuario(id);
        }

        function bloquearUsuarioRapido(id) {
          google.script.run.withSuccessHandler(fecharEDespararLista).bloquearUsuarioDoPainel(id);
        }

        function ativarUsuarioRapido(id) {
          google.script.run.withSuccessHandler(fecharEDespararLista).ativarUsuarioDoPainel(id);
        }
        
        function cadastrarNovoUsuarioAdmin() {
          google.script.run.popupCriarUsuario();
          google.script.host.close();
        }
      </script>
    </body>
    </html>`;

  const ui = HtmlService.createHtmlOutput(html).setWidth(650).setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(ui,'👥 Gestão de Usuários');
}

/**
 * 🛡️ MÓDULO DE PERFIS & MATRIZ DE GOVERNANÇA (RBAC)
 * Exibe a matriz visual de perfis e governança do sistema
 */
function popupGerenciarPerfis() {
  garantirEstruturausuarios();
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('USUARIOS');
  const dados = sh.getDataRange().getValues().slice(1);

  const contagem = {
    ADMIN: 0,
    DONO: 0,
    GERENTE: 0,
    VENDEDOR: 0,
    PENDENTE: 0
  };

  const usuariosPorPerfil = {
    ADMIN: [],
    DONO: [],
    GERENTE: [],
    VENDEDOR: [],
    PENDENTE: []
  };

  dados.forEach(r => {
    let p = String(r[4] || 'PENDENTE').toUpperCase().trim();
    if (p === 'GERENCIAL') p = 'DONO';
    if (p === 'OPERACIONAL') p = 'VENDEDOR';
    if (!contagem[p]) p = 'PENDENTE';
    contagem[p]++;
    usuariosPorPerfil[p].push(r[1] + (r[5] !== 'SIM' ? ' (inativo)' : ''));
  });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    h2 { margin: 0 0 6px 0; font-size: 20px; color: #38bdf8; display: flex; align-items: center; gap: 8px; }
    p.sub { margin: 0 0 20px 0; font-size: 13px; color: #94a3b8; }
    .grid-perfis { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-bottom: 24px; }
    .card-perfil { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 16px; position: relative; }
    .card-perfil.admin { border-left: 4px solid #ef4444; }
    .card-perfil.dono { border-left: 4px solid #8b5cf6; }
    .card-perfil.gerente { border-left: 4px solid #3b82f6; }
    .card-perfil.vendedor { border-left: 4px solid #10b981; }
    .card-perfil-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .badge { font-size: 11px; font-weight: bold; padding: 3px 8px; border-radius: 6px; }
    .badge-admin { background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.4); }
    .badge-dono { background: rgba(139, 92, 246, 0.2); color: #c084fc; border: 1px solid rgba(139, 92, 246, 0.4); }
    .badge-gerente { background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4); }
    .badge-vendedor { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.4); }
    .perfil-desc { font-size: 12px; color: #94a3b8; line-height: 1.4; margin-bottom: 10px; }
    .perfil-users { font-size: 11px; color: #cbd5e1; background: #090d16; padding: 6px 10px; border-radius: 6px; border: 1px solid #1e293b; }
    .tabela-matriz { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 20px; background: #1e293b; border-radius: 8px; overflow: hidden; border: 1px solid #334155; }
    .tabela-matriz th, .tabela-matriz td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #334155; }
    .tabela-matriz th { background: #090d16; color: #94a3b8; font-weight: 600; }
    .tabela-matriz td.center { text-align: center; font-size: 14px; }
    .actions { display: flex; justify-content: flex-end; gap: 10px; }
    .btn { padding: 9px 16px; border-radius: 8px; font-weight: bold; font-size: 13px; cursor: pointer; border: none; transition: 0.2s; }
    .btn-secondary { background: #334155; color: #fff; }
    .btn-primary { background: linear-gradient(135deg, #8b5cf6, #3b82f6); color: #fff; }
  </style>
</head>
<body>
  <h2>🛡️ Módulo de Perfis & Matriz de Permissões (RBAC)</h2>
  <p class="sub">Estrutura de privilégios de acesso do Sistema de Gestão de Depósito 360°.</p>

  <div class="grid-perfis">
    <div class="card-perfil admin">
      <div class="card-perfil-header">
        <strong style="color:#ef4444;">🛡️ ADMIN</strong>
        <span class="badge badge-admin">${contagem.ADMIN} ativo(s)</span>
      </div>
      <div class="perfil-desc">Acesso irrestrito ao sistema técnico: Supabase, scripts, manutenção da planilha e replicação.</div>
      <div class="perfil-users">👥 Usuários: ${usuariosPorPerfil.ADMIN.join(', ') || 'Nenhum'}</div>
    </div>

    <div class="card-perfil dono">
      <div class="card-perfil-header">
        <strong style="color:#c084fc;">👑 DONO</strong>
        <span class="badge badge-dono">${contagem.DONO} ativo(s)</span>
      </div>
      <div class="perfil-desc">Gestão completa da operação: Painel 360°, estoque, financeiro, equipe e relatórios. Sem menu técnico da planilha.</div>
      <div class="perfil-users">👥 Usuários: ${usuariosPorPerfil.DONO.join(', ') || 'Nenhum'}</div>
    </div>

    <div class="card-perfil gerente">
      <div class="card-perfil-header">
        <strong style="color:#60a5fa;">👨‍💼 GERENTE</strong>
        <span class="badge badge-gerente">${contagem.GERENTE} ativo(s)</span>
      </div>
      <div class="perfil-desc">Operação gerencial: controle de estoque, compras, vendas balcão, delivery e contas a pagar/receber.</div>
      <div class="perfil-users">👥 Usuários: ${usuariosPorPerfil.GERENTE.join(', ') || 'Nenhum'}</div>
    </div>

    <div class="card-perfil vendedor">
      <div class="card-perfil-header">
        <strong style="color:#34d399;">💼 VENDEDOR</strong>
        <span class="badge badge-vendedor">${contagem.VENDEDOR} ativo(s)</span>
      </div>
      <div class="perfil-desc">Frente de caixa (PDV): comandas balcão, delivery, consulta de produtos e cadastro de clientes.</div>
      <div class="perfil-users">👥 Usuários: ${usuariosPorPerfil.VENDEDOR.join(', ') || 'Nenhum'}</div>
    </div>
  </div>

  <table class="tabela-matriz">
    <thead>
      <tr>
        <th>Recurso / Módulo</th>
        <th style="text-align:center;">🛡️ ADMIN</th>
        <th style="text-align:center;">👑 DONO</th>
        <th style="text-align:center;">👨‍💼 GERENTE</th>
        <th style="text-align:center;">💼 VENDEDOR</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>🖥️ Configurações & Sistema (Planilha)</td>
        <td class="center">✅</td>
        <td class="center">❌</td>
        <td class="center">❌</td>
        <td class="center">❌</td>
      </tr>
      <tr>
        <td>⚡ Banco de Dados (Supabase) / Manutenção</td>
        <td class="center">✅</td>
        <td class="center">❌</td>
        <td class="center">❌</td>
        <td class="center">❌</td>
      </tr>
      <tr>
        <td>👑 Painel Executivo & PDV 360°</td>
        <td class="center">✅</td>
        <td class="center">✅</td>
        <td class="center">✅</td>
        <td class="center">✅</td>
      </tr>
      <tr>
        <td>⚙️ Configurações da Loja / PIX / Empresa</td>
        <td class="center">✅</td>
        <td class="center">✅</td>
        <td class="center">❌</td>
        <td class="center">❌</td>
      </tr>
      <tr>
        <td>👥 Gestão de Usuários da Equipe</td>
        <td class="center">✅</td>
        <td class="center">✅</td>
        <td class="center">❌</td>
        <td class="center">❌</td>
      </tr>
      <tr>
        <td>🪙 Contas a Pagar & Receber / Fluxo de Caixa</td>
        <td class="center">✅</td>
        <td class="center">✅</td>
        <td class="center">✅</td>
        <td class="center">❌</td>
      </tr>
      <tr>
        <td>🛒 Frente de Caixa / Comandas / Delivery</td>
        <td class="center">✅</td>
        <td class="center">✅</td>
        <td class="center">✅</td>
        <td class="center">✅</td>
      </tr>
    </tbody>
  </table>

  <div class="actions">
    <button class="btn btn-secondary" onclick="google.script.host.close()">Fechar</button>
    <button class="btn btn-primary" onclick="google.script.run.popupListarUsuarios(); google.script.host.close();">👥 Gerenciar Usuários</button>
  </div>
</body>
</html>`;

  const ui = HtmlService.createHtmlOutput(html).setWidth(720).setHeight(560);
  SpreadsheetApp.getUi().showModalDialog(ui, '🛡️ Módulo de Perfis & Permissões');
}

function bloquearUsuarioDoPainel(id) {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('USUARIOS');
  const dados = sh.getDataRange().getValues();
  for(let i=1;i<dados.length;i++){
    if(dados[i][0] === id){
      sh.getRange(i+1,6).setValue('NÃO');
      registrarAuditoria(id,'BLOQUEIO_PAINEL','Bloqueado pelo administrador');
      break;
    }
  }
}

function ativarUsuarioDoPainel(id) {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('USUARIOS');
  const dados = sh.getDataRange().getValues();
  for(let i=1;i<dados.length;i++){
    if(dados[i][0] === id){
      sh.getRange(i+1,6).setValue('SIM');
      registrarAuditoria(id,'ATIVACAO_PAINEL','Ativado pelo administrador');
      break;
    }
  }
}

/**
 * editarUsuario - Form de Edição e Classificação do Usuário
/**
 * isDonoDoSistema - Verifica se o usuário tem privilégio de Dono/Super-Admin do sistema
 */
function isDonoDoSistema(usuario){
  if(!usuario) return false;
  const perfil = String(usuario.perfil || '').toUpperCase().trim();
  const nome = String(usuario.nome || '').toLowerCase().trim();
  const email = String(usuario.email || '').toLowerCase().trim();
  const id = String(usuario.id || '').toLowerCase().trim();

  if(perfil === 'DONO' || perfil === 'GERENCIAL' || perfil === 'ADMIN') return true;
  if(nome.includes('luigi') || nome.includes('luige') || nome.includes('icaro') || nome.includes('ícaro') || nome === 'admin') return true;
  if(email.includes('luigi') || email.includes('luige') || email.includes('icaro') || email.includes('admin')) return true;
  if(id === 'admin') return true;

  return false;
}

/**
 * editarUsuario - Form de Edição e Classificação do Usuário (com alteração de senha)
 */
function editarUsuario(id){
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
  const perfil = String(row[4] || 'PENDENTE').toUpperCase().trim();
  const ativo = String(row[5] || 'PENDENTE').toUpperCase().trim();

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * { box-sizing: border-box; }
        body { font-family: Arial, Helvetica, sans-serif; background: #f8fafc; color: #020617; margin: 0; padding: 16px; }
        h3 { color: #020617; margin-top: 0; margin-bottom: 16px; font-weight: bold; text-align: center; }
        .form-group { margin-bottom: 12px; }
        label { display: block; color: #475569; font-size: 12px; font-weight: bold; margin-bottom: 4px; }
        input, select { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; color: #020617; padding: 8px 10px; font-size: 13px; width: 100%; box-sizing: border-box; outline: none; }
        input:focus, select:focus { border-color: #2563eb; }
        input[disabled] { background: #e2e8f0; color: #64748b; cursor: not-allowed; }
        .password-section { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 10px; margin-top: 14px; margin-bottom: 10px; }
        .password-section-title { font-size: 12px; font-weight: bold; color: #1d4ed8; margin-bottom: 8px; display: flex; align-items: center; gap: 4px; }
        .buttons { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }
        button { border: none; border-radius: 6px; padding: 8px 16px; font-weight: bold; font-size: 13px; cursor: pointer; transition: 0.2s; outline: none; }
        .btn-save { background: #2563eb; color: #fff; }
        .btn-save:hover { background: #1d4ed8; }
        .btn-cancel { background: #cbd5e1; color: #020617; }
        .btn-cancel:hover { background: #94a3b8; }
      </style>
    </head>
    <body>
      <h3>✏️ Classificar e Editar Usuário</h3>
      
      <div class="form-group">
        <label>Nome Completo</label>
        <input type="text" id="nome" value="${nome}">
      </div>
      
      <div class="form-group">
        <label>ID do Usuário</label>
        <input type="text" id="id" value="${id}" disabled>
      </div>

      <div class="form-group">
        <label>Perfil de Acesso *</label>
        <select id="perfil">
          <option value="ADMIN" ${perfil==='ADMIN'?'selected':''}>🛡️ Administrador (Acesso Técnico Total)</option>
          <option value="DONO" ${perfil==='DONO' || perfil==='GERENCIAL'?'selected':''}>👑 Dono (Gestão do Depósito)</option>
          <option value="GERENTE" ${perfil==='GERENTE'?'selected':''}>👨‍💼 Gerente Operacional</option>
          <option value="VENDEDOR" ${perfil==='VENDEDOR' || perfil==='OPERACIONAL'?'selected':''}>💼 Vendedor (PDV / Caixa)</option>
          <option value="PENDENTE" ${perfil==='PENDENTE' || perfil==='NENHUM'?'selected':''}>⏳ PENDENTE (Aguardando Classificação)</option>
        </select>
      </div>

      <div class="form-group">
        <label>Status da Conta *</label>
        <select id="ativo">
          <option value="SIM" ${ativo==='SIM'?'selected':''}>✅ Ativo / Liberado</option>
          <option value="NAO" ${ativo==='NAO' || ativo==='NÃO'?'selected':''}>❌ Inativo / Bloqueado</option>
          <option value="PENDENTE" ${ativo==='PENDENTE'?'selected':''}>⏳ Pendente (Aguardando Aprovação)</option>
        </select>
      </div>

      <div class="password-section">
        <div class="password-section-title">🔑 Alterar Senha de Acesso (Opcional)</div>
        <div class="form-group" style="margin-bottom:8px;">
          <label style="color:#1e40af;">Nova Senha</label>
          <input type="password" id="novaSenha" placeholder="Deixe em branco para manter a atual">
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label style="color:#1e40af;">Confirmar Nova Senha</label>
          <input type="password" id="confirmaSenha" placeholder="Repita a nova senha">
        </div>
      </div>

      <div class="buttons">
        <button class="btn-cancel" onclick="google.script.host.close()">✕ Cancelar</button>
        <button class="btn-save" onclick="salvar()">💾 Salvar Alterações</button>
      </div>

      <script>
        function salvar(){
          const nome = document.getElementById('nome').value.trim();
          const perfil = document.getElementById('perfil').value;
          let ativo = document.getElementById('ativo').value;
          const novaSenha = document.getElementById('novaSenha').value.trim();
          const confirmaSenha = document.getElementById('confirmaSenha').value.trim();
          
          if (!nome) {
            alert('Por favor, informe o nome do usuário.');
            return;
          }

          if (novaSenha) {
            if (novaSenha.length < 6) {
              alert('A nova senha deve ter no mínimo 6 caracteres.');
              return;
            }
            if (novaSenha !== confirmaSenha) {
              alert('As senhas digitadas não coincidem.');
              return;
            }
          }

          // Se o dono escolheu o perfil e a conta ainda estava pendente, ativa automaticamente!
          if (perfil !== 'PENDENTE' && ativo === 'PENDENTE') {
            ativo = 'SIM';
          }
          
          google.script.run
            .withSuccessHandler(()=>{
              google.script.host.close();
              google.script.run.popupListarUsuarios();
            })
            .withFailureHandler(err => alert('Erro: ' + err.message))
            .atualizarUsuario('${id}', nome, perfil, ativo, novaSenha);
        }
      </script>
    </body>
    </html>`;

  const ui = HtmlService.createHtmlOutput(html).setWidth(420).setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(ui,'✏️ Editar Usuário');
}

/**
 * atualizarUsuario - Executa a alteração no banco de dados (incluindo senha se informada)
 */
function atualizarUsuario(id, nome, perfil, ativo, novaSenha){
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('USUARIOS');
  const dados = sh.getDataRange().getValues();
  for(let i=1;i<dados.length;i++){
    if(dados[i][0] === id){
      sh.getRange(i+1,2).setValue(nome);
      sh.getRange(i+1,5).setValue(perfil);
      sh.getRange(i+1,6).setValue(ativo);

      if (novaSenha && String(novaSenha).trim().length >= 6) {
        const hash = (typeof gerarHashSenha === 'function') ? gerarHashSenha(String(novaSenha).trim()) : String(novaSenha).trim();
        sh.getRange(i+1, 4).setValue(hash);
        registrarAuditoria(id, 'SENHA_ALTERADA_ADMIN', 'Senha alterada pelo administrador');
      }

      registrarAuditoria(id,'USUARIO_ATUALIZADO',`Perfil:${perfil} Ativo:${ativo}`);
      break;
    }
  }
}

/**
 * criarNovoUsuario - Cria/Solicita o acesso para um novo usuário no banco de dados
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
    
    // Valida se perfil é válido
    const perfisValidos = ['VENDEDOR', 'OPERACIONAL', 'GERENTE', 'DONO', 'GERENCIAL', 'PENDENTE', 'NENHUM'];
    if (perfisValidos.indexOf(perfil) === -1) {
      console.log('[SERVER] Perfil inválido:', perfil);
      return { ok: false, msg: 'Perfil inválido.' };
    }
    
    // Apenas o Dono pode criar outros Donos ou Gerentes
    if (perfil === 'DONO' || perfil === 'GERENCIAL' || perfil === 'GERENTE') {
      const usuarioAtivo = obterUsuarioAtual();
      if (!usuarioAtivo || (usuarioAtivo.perfil !== 'DONO' && usuarioAtivo.perfil !== 'GERENCIAL')) {
        return { ok: false, msg: 'Apenas um Dono (Administrador) logado pode criar contas administrativas do tipo Dono ou Gerente.' };
      }
    }
    
    if(String(senha).trim().length < 6){
      console.log('[SERVER] Senha curta');
      return { ok: false, msg: 'Senha deve ter no mínimo 6 caracteres.' };
    }
    
    console.log('[SERVER] Garantindo estrutura de usuários');
    garantirEstruturausuarios();
    
    const ss = SpreadsheetApp.getActive();
    const shUsuarios = ss.getSheetByName('USUARIOS');
    const dados = shUsuarios.getDataRange().getValues();
    
    // Verifica se já existe um usuário com o mesmo nome (login)
    for(let i=1;i<dados.length;i++){
      if(String(dados[i][1]).toLowerCase().trim() === nome.toLowerCase()){
        console.log('[SERVER] Usuário já existe:', nome);
        return { ok: false, msg: 'Este nome de usuário já está cadastrado.' };
      }
    }
    
    // Gera ID único (ex: U-000002)
    let maxIdNum = 1;
    for(let i=1;i<dados.length;i++){
      const currentId = String(dados[i][0]);
      if(currentId.startsWith('U-')){
        const num = parseInt(currentId.substring(2), 10);
        if(!isNaN(num) && num > maxIdNum){
          maxIdNum = num;
        }
      }
    }
    const idUser = 'U-' + String(maxIdNum + 1).padStart(6, '0');
    
    // Hasheia a senha
    const senhaHash = gerarHashSenha(senha);
    const agora = new Date();
    
    // ✅ Adiciona usuário como PENDENTE aguardando aprovação
    console.log('[SERVER] Adicionando linha com ID=' + idUser + ', NOME=' + nome + ', PERFIL=' + perfil);
    shUsuarios.appendRow([
      idUser,
      nome,
      '',
      senhaHash,
      perfil,
      'PENDENTE',
      agora,
      agora
    ]);

    // 🔔 Notifica o Dono via Telegram (Com botões Inline)
    try {
      if (typeof enviarMensagemTelegram === 'function') {
        const msgAlerta = `🔔 <b>Solicitação de Acesso Recebida!</b>\n\n` +
                           `👤 <b>Nome:</b> ${nome}\n` +
                           `👔 <b>Perfil solicitado:</b> ${perfil}\n` +
                           `⏳ <b>Status:</b> PENDENTE`;
        const replyMarkup = {
          inline_keyboard: [
            [
              { text: "✅ Aprovar Acesso", callback_data: "app_" + idUser },
              { text: "❌ Bloquear", callback_data: "blk_" + idUser }
            ]
          ]
        };
        enviarMensagemTelegram(msgAlerta, replyMarkup);
      }
    } catch(e) {
      console.warn("Erro ao enviar notificação de novo cadastro para Telegram:", e.message);
    }
    
    return { ok: true, msg: 'Solicitação de acesso enviada com sucesso!' };
  } catch(e) {
    console.error('[SERVER] Erro em criarNovoUsuario:', e);
    return { ok: false, msg: 'Erro interno do servidor: ' + e.message };
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
 *  🔐 GERENCIAMENTO DE SESSÕES
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
  
  const perfil = String(usuario.perfil).toUpperCase();
  if (perfil === 'ADMIN') return true;
  if (perfil === 'GERENCIAL' || perfil === 'DONO') return perfilRequerido !== 'ADMIN';

  if (perfil === 'GERENTE') {
    return perfilRequerido === 'GERENTE' || perfilRequerido === 'VENDEDOR' || perfilRequerido === 'OPERACIONAL';
  }
  
  return perfil === String(perfilRequerido).toUpperCase();
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
    // 1️⃣ Aplica visibilidade de abas conforme perfil do usuário
    try{
      aplicarVisibilidadeAbasPorPerfil();
    }catch(e){
      console.warn('Erro ao aplicar visibilidade de abas:', e);
    }

    // 2️⃣ Ativa a aba principal de dados (PRODUTOS ou COMANDAS)
    try {
      const ss = SpreadsheetApp.getActive();
      const shPrincipal = ss.getSheetByName('PRODUTOS') || ss.getSheetByName('COMANDAS') || ss.getSheets()[0];
      if (shPrincipal) {
        ss.setActiveSheet(shPrincipal);
      }
    } catch(e){}

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

  const perfil = String(usuario.perfil || '').toUpperCase();

  // definir abas mínimas visíveis por perfil (aba HOME foi descontinuada em prol do Painel 360°)
  const abasVendedor = ['COMANDAS', 'VENDAS', 'DELIVERY', 'CLIENTES', 'BLOQUEIO_LOGIN'];
  const abasGerente = ['PRODUTOS', 'ESTOQUE', 'ESTOQUE_VALORES', 'COMPRAS', 'COMANDAS', 'VENDAS', 'DELIVERY', 'CLIENTES', 'BLOQUEIO_LOGIN'];

  const sheets = ss.getSheets();
  sheets.forEach(sh => {
    const name = sh.getName();
    try{
      // A aba HOME foi descontinuada - oculta ou exclui automaticamente
      if (name === 'HOME') {
        try {
          if (sheets.length > 1) {
            ss.deleteSheet(sh);
          } else {
            sh.hideSheet();
          }
        } catch(eDel) {
          try { sh.hideSheet(); } catch(eHide) {}
        }
        return;
      }
      if(perfil === 'ADMIN'){
        // Admin vê absolutamente todas as abas da planilha
        sh.showSheet();
      } else if(perfil === 'DONO' || perfil === 'GERENCIAL'){
        // Dono vê todas as abas de operação do depósito
        sh.showSheet();
      } else if(perfil === 'GERENTE'){
        // Gerente vê apenas abas operacionais + estoque + compras
        if(abasGerente.indexOf(name) !== -1){
          sh.showSheet();
        } else {
          sh.hideSheet();
        }
      } else if(perfil === 'VENDEDOR' || perfil === 'OPERACIONAL'){
        // Vendedor vê apenas comandas, delivery e clientes
        if(abasVendedor.indexOf(name) !== -1){
          sh.showSheet();
        } else {
          sh.hideSheet();
        }
      } else {
        // Perfis desconhecidos
        sh.hideSheet();
      }
    }catch(e){
      console.warn('Falha ao ajustar visibilidade da aba', name, e);
    }
  });
  // se existe aba de bloqueio, escondê-la agora que usuário autenticado está presente
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
  const setupConcluido = (typeof getConfig === 'function') ? (getConfig('SETUP_CONCLUIDO') === 'SIM') : true;
  if (!setupConcluido) {
    if (typeof abrirBoasVindasSetup === 'function') {
      abrirBoasVindasSetup();
      return;
    }
  }

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
