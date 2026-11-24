/**
 * ====================================================================
 * CONECTOR MÍNIMO PARA PLANILHA DO CLIENTE (SEM SEGREDOS / SEM LÓGICA)
 * Toda regra, autenticação e acesso ao BD rodam na Edge Function do Supabase.
 * ====================================================================
 */

const EDGE_SYNC_URL = 'https://qohqsrgvxwkzsprggkvs.supabase.co/functions/v1/sync-planilha';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Gestão 360°')
    .addItem('Conectar Planilha (Login)', 'conectarPlanilhaPorLogin')
    .addItem('Atualizar Dados do Sistema', 'sincronizarPlanilhaDoBanco')
    .addToUi();
}

function conectarPlanilhaPorLogin() {
  const ui = SpreadsheetApp.getUi();
  const resUser = ui.prompt('Conectar Planilha', 'Digite seu usuário de login:', ui.ButtonSet.OK_CANCEL);
  if (resUser.getSelectedButton() !== ui.Button.OK) return;
  const resPass = ui.prompt('Conectar Planilha', 'Digite sua senha:', ui.ButtonSet.OK_CANCEL);
  if (resPass.getSelectedButton() !== ui.Button.OK) return;

  const resp = UrlFetchApp.fetch(EDGE_SYNC_URL, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: JSON.stringify({
      acao: 'conectar_login',
      username: resUser.getResponseText().trim(),
      senha: resPass.getResponseText().trim()
    })
  });

  const json = JSON.parse(resp.getContentText() || '{}');
  if (!json.ok || !json.sync_token) {
    ui.alert('Erro ao conectar: ' + (json.msg || 'Falha na autenticação.'));
    return;
  }

  PropertiesService.getScriptProperties().setProperty('SYNC_TOKEN', json.sync_token);
  ui.alert('Planilha conectada com sucesso! Já pode atualizar os dados.');
}

function sincronizarPlanilhaDoBanco() {
  const ui = SpreadsheetApp.getUi();
  const token = PropertiesService.getScriptProperties().getProperty('SYNC_TOKEN');
  if (!token) {
    ui.alert('Planilha ainda não conectada. Clique em "Gestão 360° → Conectar Planilha (Login)".');
    return;
  }

  const resp = UrlFetchApp.fetch(EDGE_SYNC_URL, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: { 'x-sync-token': token },
    payload: JSON.stringify({ acao: 'pull' })
  });

  const json = JSON.parse(resp.getContentText() || '{}');
  if (!json.ok) {
    ui.alert('Falha na sincronização: ' + (json.msg || 'Erro desconhecido.'));
    return;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  gravarAbaEspelho_(ss, 'PRODUTOS_ESPELHO', ['ID', 'Nome', 'Categoria', 'Preço', 'Estoque'], (json.produtos || []).map(function (p) {
    return [p.id, p.nome, p.categoria || '', p.preco || 0, p.estoque || 0];
  }));
  gravarAbaEspelho_(ss, 'CLIENTES_ESPELHO', ['ID', 'Nome', 'Telefone', 'Saldo Fiado'], (json.clientes || []).map(function (c) {
    return [c.id, c.nome, c.telefone || '', c.saldo_devedor || 0];
  }));
  ui.alert('Dados atualizados com sucesso (' + (json.empresa && json.empresa.nome ? json.empresa.nome : '') + ')!');
}

function gravarAbaEspelho_(ss, nomeAba, cabecalho, linhas) {
  let sh = ss.getSheetByName(nomeAba);
  if (!sh) sh = ss.insertSheet(nomeAba);
  sh.clearContents();
  sh.getRange(1, 1, 1, cabecalho.length).setValues([cabecalho]);
  if (linhas.length > 0) {
    sh.getRange(2, 1, linhas.length, cabecalho.length).setValues(linhas);
  }
}
