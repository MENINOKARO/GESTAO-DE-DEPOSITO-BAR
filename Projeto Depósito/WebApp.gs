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
