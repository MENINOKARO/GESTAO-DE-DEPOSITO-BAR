// ===============================
// DRIVE - ESTRUTURA GERAL DO SISTEMA - BACKUP - LOGS - RELATÓRIOS
// ===============================
  function garantirEstruturaDriveSistema(dataRef){

    const nomeDeposito = getNomeDeposito(); // ✅ fonte única
    const data = dataRef || new Date();

    const ano = Utilities.formatDate(data, Session.getScriptTimeZone(), 'yyyy');
    const mes = Utilities.formatDate(data, Session.getScriptTimeZone(), 'MM');

