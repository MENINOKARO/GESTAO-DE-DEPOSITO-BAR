    // ======================
    // SCORE
    // ======================
    info.score = calcularScoreProduto({
      margem: info.margem,
      qtd: info.qtd,
      preco: info.preco,
      custo: info.custo
    });

    return info;
  }
  function calcularScoreProduto(p){

    let s = 0;

    if(p.margem >= 30) s+=5;
    else if(p.margem >=15) s+=3;

    if(p.qtd >= 20) s+=4;
    else if(p.qtd >=10) s+=2;

    if(p.preco > p.custo) s+=3;

    if(p.preco >= p.custo*1.4) s+=3;

    return Math.min(15,s);
  }
  function atualizarMargemProduto(nome, margem){

    const sh = SpreadsheetApp
      .getActive()
      .getSheetByName('PRODUTOS');

    if(nome == null || margem == null){
      return true; // ignora chamada inválida
    }

    if(!sh){
      throw new Error('Aba PRODUTOS não encontrada.');
    }

    // 🔒 normaliza nome recebido
    const nomeBusca = String(nome)
      .trim()
      .toUpperCase();

    // 🔒 Normaliza margem (aceita 1,3 ou 1.3)
    let m = String(margem)
      .replace(/\s/g,'')
      .replace(',','.');

    m = Number(m);

    if(isNaN(m)){
      throw new Error('Margem inválida.');
    }

    const dados = sh.getDataRange().getValues();

    for(let i = 1; i < dados.length; i++){

      const nomePlanilha = String(dados[i][0] || '')
        .trim()
        .toUpperCase();

      if(nomePlanilha === nomeBusca){

        // Coluna H → Margem (%)
        sh.getRange(i+1, 8).setValue(m);

        const custo = Number(dados[i][6]) || 0;

        const precoSug = custo * (1 + m/100);

        // Coluna I → Preço sugerido
        sh.getRange(i+1, 9)
          .setValue(Number(precoSug.toFixed(2)));

        // 🔔 LOG (se existir)
        if(typeof registrarLog === 'function'){
          registrarLog(
            'MARGEM_ATUALIZADA',
            nome,
            dados[i][7],
            m
          );
        }

        return true;
      }
    }

    throw new Error('Produto não encontrado para atualização.');
  }
  function salvarMargem(){

    let valor = margemInput.value
      .replace(/\s/g,'')   // remove espaços
      .replace(',','.');  // troca vírgula por ponto

    if(!valor || isNaN(valor)){
      alert('Informe um valor válido. Ex: 1,3');
      return;
    }

    google.script.run
      .withSuccessHandler(()=>{
        alert('✅ Margem atualizada!');
        carregar();
      })
      .atualizarMargemProduto(
        produto.value,
        Number(valor)
      );
  }
  function gerarAlertasProdutos(){

    const ss = SpreadsheetApp.getActive();

    const prod = ss.getSheetByName('PRODUTOS');
    const est = ss.getSheetByName('ESTOQUE');

    let alertas = [];

    const p = prod.getDataRange().getValues();
    const e = est.getDataRange().getValues();

    for(let i=1;i<p.length;i++){

      const nome = p[i][0];
      const margem = Number(p[i][7])||0;

      let qtd = 0;

      for(let j=1;j<e.length;j++){
        if(e[j][0]===nome){
          qtd = Number(e[j][1])||0;
        }
      }

      if(margem < 15 || qtd < 5){

        alertas.push({
          produto:nome,
          margem,
          qtd
        });

      }
    }

    return alertas;
  }
  function calcularGiroProduto(nome){

    const v = SpreadsheetApp
      .getActive()
      .getSheetByName('VENDAS')
      .getDataRange()
      .getValues();

    let qtd = 0;

    const hoje = new Date();
    const limite = new Date();
    limite.setDate(hoje.getDate()-30);

    v.forEach((l,i)=>{

      if(i===0) return;

      if(l[1]===nome && l[0] instanceof Date){

        if(l[0] >= limite){
          qtd += Number(l[2])||0;
        }
      }

    });

    return qtd;
  }
  function sugerirPreco(nome){

    const sh = SpreadsheetApp
      .getActive()
      .getSheetByName('PRODUTOS');

    const dados = sh.getDataRange().getValues();

    for(let i=1;i<dados.length;i++){

      if(dados[i][0] === nome){

        const custo  = Number(dados[i][6])||0;
        const margem = Number(dados[i][7])||0;

        const ideal =
          custo * (1,0 + margem/100);

        return Number(ideal.toFixed(2));
      }
    }

    return 0;
  }

