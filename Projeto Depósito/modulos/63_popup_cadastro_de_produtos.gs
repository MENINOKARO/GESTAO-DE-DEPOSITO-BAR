// ===============================
// POPUP CADASTRO DE PRODUTOS
// ===============================
  function gerarNovoIdProduto(){

    const sh = SpreadsheetApp.getActive()
      .getSheetByName('PRODUTOS');

    if(!sh || sh.getLastRow() < 2){
      return 'PRD-0001';
    }

    const ids = sh.getRange(2,11,sh.getLastRow()-1,1)
      .getValues()
      .flat()
      .filter(Boolean);

    const numeros = ids
      .map(id => Number(String(id).replace('PRD-','')))
      .filter(n => !isNaN(n));

    const proximo = numeros.length
      ? Math.max(...numeros) + 1
      : 1;

    return 'PRD-' + String(proximo).padStart(4,'0');
  }
  function getProdutoPorId(id){

    const sh = SpreadsheetApp.getActive()
      .getSheetByName('PRODUTOS');

    const dados = sh.getDataRange().getValues();

    for(let i=1;i<dados.length;i++){

      if(dados[i][10] === id){

        return {
          produto: dados[i][0],
          categoria: dados[i][1],
          marca: dados[i][2],
          volume: dados[i][3],
          preco: dados[i][4],
          minimo: dados[i][5],
          custo: dados[i][6],
          margem: dados[i][7],
          precoSug: dados[i][8],
          status: dados[i][9],
          id: dados[i][10]
        };
      }
    }

    return null;
  }
  function getListaProdutosComId(){

    const sh = SpreadsheetApp.getActive()
      .getSheetByName('PRODUTOS');

    if(!sh || sh.getLastRow() < 2) return [];

    const dados = sh.getRange(2,1,sh.getLastRow()-1,11)
      .getValues();

    return dados.map(l => ({
      nome: l[0],
      id: l[10]
    }));
  }
  function salvarProdutoNovoSistema(d){

    garantirColunaIdProduto();

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('PRODUTOS');

    const dados = sh.getDataRange().getValues();

    const preco  = Number(String(d.preco).replace(',','.')) || 0;
    const custo  = Number(String(d.custo).replace(',','.')) || 0;
    const margem = Number(String(d.margem).replace(',','.')) || 0;
    const minimo = Number(d.minimo) || 0;

    const precoSug = custo * (1 + margem/100);

    let status = '🟢 IDEAL';
    if(margem < 20) status = '🔴 BAIXA';
    else if(margem <= 30) status = '🟡 MÉDIA';

