    // ======================
    // BUSCAR NO PRODUTOS
    // ======================
    for(let i = 1; i < pDados.length; i++){

      const nomeProduto = String(pDados[i][0] || '')
        .trim()
        .toUpperCase();

      if(nomeProduto === nomeBusca){

        info.preco = Number(pDados[i][4]) || 0;
        info.custo = Number(pDados[i][6]) || 0;
        info.margem = Number(pDados[i][7]) || 0;
        info.precoSugerido = Number(pDados[i][8]) || 0;

        break;
      }
    }

