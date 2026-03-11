/**
 * DASHBOARD DESCONTINUADO
 * Mantido apenas para compatibilidade com chamadas antigas.
 */

function obterResumoDashboardOtimizado() {
  return {
    atualizadoEm: new Date().toISOString(),
    descontinuado: true,
    motivo: 'Dashboard removido para reduzir lentidão do sistema.'
  };
}

function abrirDashboardOtimizadoPopup() {
  SpreadsheetApp.getUi().alert(
    'ℹ️ Dashboard descontinuado',
    'A funcionalidade de dashboard foi removida para melhorar desempenho. Use a HOME e os relatórios sob demanda.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}
