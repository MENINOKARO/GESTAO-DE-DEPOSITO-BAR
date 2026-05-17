// ===============================
// CENTRAL DE PRODUTOS
// ===============================
  function abrirAnaliseProduto(){

    const html = HtmlService
      .createHtmlOutputFromFile('AnaliseProduto')
      .setWidth(520)
      .setHeight(600);

    SpreadsheetApp.getUi()
      .showModalDialog(html, '📊 Análise de Produto');

  }
  function listarProdutosAnalise(){

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('PRODUTOS');

    if(!sh) return [];

    const dados = sh.getDataRange().getValues();
    const lista = [];

    for(let i = 1; i < dados.length; i++){

      const produto = dados[i][0];

      if(produto){
        lista.push(produto);
      }
    }

    return lista;
  }
  function buscarDadosProduto(nome){

    const ss = SpreadsheetApp.getActive();

    const prod = ss.getSheetByName('PRODUTOS');
    const est  = ss.getSheetByName('ESTOQUE');

    if(!prod || !est) return null;

    const pDados = prod.getDataRange().getValues();
    const eDados = est.getDataRange().getValues();

    // 🔒 normaliza o nome recebido
    const nomeBusca = String(nome || '')
      .trim()
      .toUpperCase();

    let info = {
      nome,
      preco: 0,
      custo: 0,
      margem: 0,
      precoSugerido: 0,
      qtd: 0,
      score: 0
    };

