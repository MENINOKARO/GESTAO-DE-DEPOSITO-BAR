/**
 * DASHBOARD OTIMIZADO (SEM WEB)
 * Versão enxuta com cache para reduzir leituras repetidas e travamentos.
 */

function obterResumoDashboardOtimizado() {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'dashboard_resumo_otimizado_v1';

  const cached = cache.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const resumo = {
    atualizadoEm: new Date().toISOString(),
    financeiroHoje: calcularFinanceiroHojeInterno_(),
    vendasHoje: obterResumoVendasInterno_(),
    comprasHoje: obterResumoComprasInterno_(),
    delivery: obterResumoDeliveryInterno_()
  };

  cache.put(cacheKey, JSON.stringify(resumo), 45);
  return resumo;
}

function abrirDashboardOtimizadoPopup() {
  const dados = obterResumoDashboardOtimizado();

  const html = `
    <div style="font-family:Arial,sans-serif;padding:14px;background:#f8fafc;">
      <h2 style="margin:0 0 8px;color:#0f172a">📊 Dashboard Otimizado</h2>
      <p style="margin:0 0 12px;color:#475569;font-size:12px">Atualizado em: ${dados.atualizadoEm}</p>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <div style="padding:10px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;">
          <b>💰 Financeiro (Hoje)</b>
          <div>Entradas: R$ ${Number(dados.financeiroHoje.entradas || 0).toFixed(2)}</div>
          <div>Saídas: R$ ${Number(dados.financeiroHoje.saidas || 0).toFixed(2)}</div>
          <div><b>Saldo: R$ ${Number(dados.financeiroHoje.saldo || 0).toFixed(2)}</b></div>
        </div>

        <div style="padding:10px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;">
          <b>🛒 Vendas/Compras (Hoje)</b>
          <div>Vendas: ${Number(dados.vendasHoje.quantidade || 0)}</div>
          <div>Valor vendas: R$ ${Number(dados.vendasHoje.total || 0).toFixed(2)}</div>
          <div>Compras: ${Number(dados.comprasHoje.quantidade || 0)}</div>
          <div>Valor compras: R$ ${Number(dados.comprasHoje.total || 0).toFixed(2)}</div>
        </div>
      </div>

      <div style="margin-top:8px;padding:10px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;">
        <b>🚚 Delivery</b>
        <div>Total pedidos: ${Number(dados.delivery.total || 0)}</div>
        <div>Em andamento: ${Number(dados.delivery.emAndamento || 0)}</div>
        <div>Entregues: ${Number(dados.delivery.entregues || 0)}</div>
      </div>
    </div>
  `;

  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(560).setHeight(420),
    'Dashboard Otimizado'
  );
}

function calcularFinanceiroHojeInterno_() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('FINANCEIRO') || ss.getSheetByName('CAIXA');
  if (!sh) return { entradas: 0, saidas: 0, saldo: 0 };

  const values = sh.getDataRange().getValues();
  if (values.length < 2) return { entradas: 0, saidas: 0, saldo: 0 };

  const hoje = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');
  let entradas = 0;
  let saidas = 0;

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const data = formatarDataDdMmAaaa_(row[0]);
    if (data !== hoje) continue;

    const tipo = String(row[2] || '').toUpperCase();
    const valor = Number(row[3]) || 0;

    if (tipo.includes('ENTRADA')) entradas += valor;
    else if (tipo.includes('SAIDA') || tipo.includes('SAÍDA')) saidas += valor;
  }

  return { entradas: entradas, saidas: saidas, saldo: entradas - saidas };
}

function obterResumoVendasInterno_() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('VENDAS');
  if (!sh) return { quantidade: 0, total: 0 };

  const values = sh.getDataRange().getValues();
  if (values.length < 2) return { quantidade: 0, total: 0 };

  const hoje = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');
  let quantidade = 0;
  let total = 0;

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const data = formatarDataDdMmAaaa_(row[0]);
    if (data !== hoje) continue;
    quantidade++;
    total += Number(row[4]) || 0;
  }

  return { quantidade: quantidade, total: total };
}

function obterResumoComprasInterno_() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('COMPRAS');
  if (!sh) return { quantidade: 0, total: 0 };

  const values = sh.getDataRange().getValues();
  if (values.length < 2) return { quantidade: 0, total: 0 };

  const hoje = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy');
  let quantidade = 0;
  let total = 0;

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const data = formatarDataDdMmAaaa_(row[0]);
    if (data !== hoje) continue;
    quantidade++;
    total += Number(row[3]) || 0;
  }

  return { quantidade: quantidade, total: total };
}

function obterResumoDeliveryInterno_() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('DELIVERY');
  if (!sh) return { total: 0, emAndamento: 0, entregues: 0 };

  const values = sh.getDataRange().getValues();
  if (values.length < 2) return { total: 0, emAndamento: 0, entregues: 0 };

  let total = 0;
  let emAndamento = 0;
  let entregues = 0;

  for (let i = 1; i < values.length; i++) {
    const status = String(values[i][4] || '').toUpperCase();
    total++;
    if (status.includes('ANDAMENTO') || status.includes('PREPARO') || status.includes('TRANSPORTE')) emAndamento++;
    if (status.includes('ENTREGUE')) entregues++;
  }

  return { total: total, emAndamento: emAndamento, entregues: entregues };
}

function formatarDataDdMmAaaa_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) return text;

  const maybeDate = new Date(text);
  if (!isNaN(maybeDate)) {
    return Utilities.formatDate(maybeDate, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }
  return '';
}
