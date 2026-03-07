/**
 * =====================================================
 * UI POPUP PADRÃO
 * =====================================================
 * Componente reutilizável para mensagens no padrão visual do projeto.
 */
function popupPadraoMensagem(titulo, mensagem, tipo) {
  const nivel = String(tipo || 'info').toLowerCase();
  const mapa = {
    sucesso: { emoji: '✅', cor: '#16a34a', fundo: '#dcfce7' },
    sucesso2: { emoji: '✅', cor: '#16a34a', fundo: '#dcfce7' },
    erro: { emoji: '❌', cor: '#dc2626', fundo: '#fee2e2' },
    aviso: { emoji: '⚠️', cor: '#d97706', fundo: '#fef3c7' },
    info: { emoji: 'ℹ️', cor: '#2563eb', fundo: '#dbeafe' }
  };

  const tema = mapa[nivel] || mapa.info;
  const tituloSafe = String(titulo || 'Mensagem');
  const msgSafe = String(mensagem || '').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

  const html = `
    <div style="font-family:Arial,sans-serif;padding:16px;background:linear-gradient(180deg,#f8fafc,#eef2ff);">
      <div style="border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;background:#fff;box-shadow:0 8px 24px rgba(15,23,42,.1)">
        <div style="padding:12px 14px;background:${tema.fundo};border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:8px;">
          <span style="font-size:18px">${tema.emoji}</span>
          <strong style="color:${tema.cor};font-size:14px;">${tituloSafe}</strong>
        </div>
        <div style="padding:14px;color:#0f172a;font-size:13px;line-height:1.45;max-height:280px;overflow:auto;">${msgSafe || 'Sem detalhes.'}</div>
        <div style="padding:0 14px 14px;display:flex;justify-content:flex-end;">
          <button onclick="google.script.host.close()" style="border:none;border-radius:10px;background:#2563eb;color:#fff;padding:9px 12px;font-weight:700;cursor:pointer;">Fechar</button>
        </div>
      </div>
    </div>`;

  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(480).setHeight(360),
    (tema.emoji + ' ' + tituloSafe)
  );
}

function popupSucesso(titulo, mensagem) { popupPadraoMensagem(titulo, mensagem, 'sucesso'); }
function popupErro(titulo, mensagem) { popupPadraoMensagem(titulo, mensagem, 'erro'); }
function popupAviso(titulo, mensagem) { popupPadraoMensagem(titulo, mensagem, 'aviso'); }
function popupInfo(titulo, mensagem) { popupPadraoMensagem(titulo, mensagem, 'info'); }

function uiNotificar(mensagem, tipo, titulo) {
  try {
    popupPadraoMensagem(titulo || 'Sistema', mensagem, tipo || 'info');
  } catch (e) {
    SpreadsheetApp.getUi().alert(String(mensagem || 'Sem mensagem'));
  }
}
