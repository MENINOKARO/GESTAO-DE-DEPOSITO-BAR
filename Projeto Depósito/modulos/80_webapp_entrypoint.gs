/**
 * WebApp entrypoint (MVP).
 * Compatível com projetos Apps Script onde arquivos HTML ficam na raiz.
 */
function doGet(e) {
  var tpl = getWebTemplate_();
  tpl.appVersion = '0.1.1-web';
  return tpl
    .evaluate()
    .setTitle('Gestão de Depósito - Web')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getWebTemplate_() {
  var candidates = ['index', 'webapp/index'];
  var lastErr = null;

  for (var i = 0; i < candidates.length; i++) {
    try {
      return HtmlService.createTemplateFromFile(candidates[i]);
    } catch (err) {
      lastErr = err;
    }
  }

  throw new Error(
    'Nenhum arquivo HTML encontrado. Crie o arquivo "index.html" na raiz do Apps Script. ' +
      (lastErr && lastErr.message ? 'Detalhe: ' + lastErr.message : '')
  );
}

function include_(path) {
  return HtmlService.createHtmlOutputFromFile(path).getContent();
}

function webResumoInicial_() {
  return {
    ok: true,
    sistema: 'Gestão de Depósito',
    versao: '2.6-web-mvp',
    modulos: ['Estoque', 'Vendas', 'Compras', 'Comandas', 'Delivery', 'Financeiro'],
    timestamp: new Date().toISOString()
  };
}

function webApi(action, payload) {
  try {
    switch (action) {
      case 'resumoInicial':
        return webResumoInicial_();
      case 'ping':
        return { ok: true, message: 'pong', ts: new Date().toISOString() };
      default:
        return { ok: false, error: 'Ação não suportada: ' + action };
    }
  } catch (err) {
    return { ok: false, error: (err && err.message) ? err.message : String(err) };
  }
}
