/**
 * WebApp entrypoint (MVP).
 * Publicado como aplicativo da web no Apps Script.
 */
function doGet(e) {
  var tpl = HtmlService.createTemplateFromFile('webapp/index');
  tpl.appVersion = '0.1.0-web';
  return tpl
    .evaluate()
    .setTitle('Gestão de Depósito - Web')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include_(path) {
  return HtmlService.createHtmlOutputFromFile(path).getContent();
}

/**
 * Retorna resumo inicial para homepage web.
 */
function webResumoInicial_() {
  return {
    ok: true,
    sistema: 'Gestão de Depósito',
    versao: '2.6-web-mvp',
    modulos: [
      'Estoque',
      'Vendas',
      'Compras',
      'Comandas',
      'Delivery',
      'Financeiro'
    ],
    timestamp: new Date().toISOString()
  };
}

/**
 * Endpoint RPC para o frontend.
 */
function webApi(action, payload) {
  try {
    switch (action) {
      case 'resumoInicial':
        return webResumoInicial_();
      case 'ping':
        return { ok: true, message: 'pong', ts: new Date().toISOString() };
      default:
        return {
          ok: false,
          error: 'Ação não suportada: ' + action
        };
    }
  } catch (err) {
    return {
      ok: false,
      error: (err && err.message) ? err.message : String(err)
    };
  }
}
