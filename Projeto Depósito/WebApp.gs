/**
 * ==============================================
 * WEB APP (HTML) PARA GESTÃO DE DEPÓSITO
 * ==============================================
 * Esta camada permite usar telas HTML modernas
 * consumindo funções já existentes no Apps Script.
 */

/**
 * Endpoint principal da Web App.
 */
function doGet(e) {
  const page = (e && e.parameter && e.parameter.page) || 'WebApp2';
  const template = HtmlService.createTemplateFromFile(page);

  return template
    .evaluate()
    .setTitle('Gestão de Depósito - Web')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Inclui arquivos HTML parciais em templates.
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Bridge genérica para consumir funções existentes no projeto
 * diretamente a partir do frontend HTML (google.script.run).
 *
 * @param {string} functionName Nome exato da função global do Apps Script.
 * @param {Array} args Lista de argumentos para a função.
 * @return {{ok: boolean, data?: *, error?: string}}
 */
function executarApi(functionName, args) {
  try {
    if (!functionName || typeof functionName !== 'string') {
      throw new Error('Nome de função inválido.');
    }

    const blocked = {
      doGet: true,
      include: true,
      executarApi: true
    };

    if (blocked[functionName]) {
      throw new Error('Função bloqueada por segurança.');
    }

    const fn = this[functionName];
    if (typeof fn !== 'function') {
      throw new Error('Função não encontrada: ' + functionName);
    }

    const params = Array.isArray(args) ? args : [];
    const result = fn.apply(null, params);

    return { ok: true, data: result };
  } catch (error) {
    return {
      ok: false,
      error: error && error.message ? error.message : String(error)
    };
  }
}

/**
 * Executa ações da camada web com proteção para funções que dependem de UI de planilha.
 * Em contexto de WebApp, funções com SpreadsheetApp.getUi() quebram com erro de contexto.
 */
function executarAcaoWebSegura(functionName, args) {
  try {
    const normalizedArgs = Array.isArray(args) ? args : [];
    const isUiBound = /^(popup|abrirPopup|abrirPainel|abrirSistema|popupTela|popupLogout|popupLogin|popupCriar)/i.test(functionName || '');

    if (isUiBound) {
      return {
        ok: false,
        code: 'UI_CONTEXT_BLOCKED',
        functionName: functionName,
        message: 'Esta ação depende de interface do Google Sheets e não pode rodar direto no Web App.',
        suggestion: sugerirAcaoWeb(functionName)
      };
    }

    const raw = executarApi(functionName, normalizedArgs);
    if (!raw || raw.ok !== true) {
      const msg = raw && raw.error ? raw.error : 'Falha desconhecida';
      if (/SpreadsheetApp\.getUi\(\) from this context/i.test(msg)) {
        return {
          ok: false,
          code: 'UI_CONTEXT_BLOCKED',
          functionName: functionName,
          message: msg,
          suggestion: sugerirAcaoWeb(functionName)
        };
      }

      return {
        ok: false,
        code: 'EXECUTION_ERROR',
        functionName: functionName,
        message: msg
      };
    }

    return {
      ok: true,
      code: 'SUCCESS',
      functionName: functionName,
      data: raw.data
    };
  } catch (error) {
    return {
      ok: false,
      code: 'EXECUTION_ERROR',
      functionName: functionName,
      message: error && error.message ? error.message : String(error)
    };
  }
}

/**
 * Sugere um fallback de UI web para ações tradicionalmente acionadas por popup no Sheets.
 */
function sugerirAcaoWeb(functionName) {
  const key = String(functionName || '').toLowerCase();

  if (key.indexOf('comanda') !== -1) {
    return {
      type: 'OPEN_NEW_COMANDA_MODAL',
      title: 'Nova Comanda',
      description: 'Abra o formulário web para lançar cliente, mesa e observações da comanda.'
    };
  }

  if (key.indexOf('login') !== -1 || key.indexOf('usuario') !== -1) {
    return {
      type: 'OPEN_LOGIN_MODAL',
      title: 'Autenticação',
      description: 'Use os campos de login do painel web para continuar.'
    };
  }

  return {
    type: 'SHOW_INFO',
    title: 'Ação indisponível no Web App',
    description: 'Esta ação foi criada para rodar no menu da planilha e precisa de adaptação para HTML.'
  };
}

/**
 * Protótipo funcional para criação de comanda em ambiente web.
 * Não depende de SpreadsheetApp.getUi().
 */
function criarNovaComandaWeb(payload) {
  const data = payload || {};
  const agora = new Date();
  const id = 'CMD-' + Utilities.formatDate(agora, Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');

  return {
    ok: true,
    idComanda: id,
    criadoEm: agora.toISOString(),
    status: 'ABERTA',
    cliente: data.cliente || 'Consumidor',
    mesa: data.mesa || 'Balcão',
    observacoes: data.observacoes || '',
    mensagem: 'Comanda criada no modo web (protótipo). Conecte este retorno ao fluxo definitivo de gravação.'
  };
}
