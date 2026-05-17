    // ======================
    // BUSCAR NO ESTOQUE
    // ======================
    for(let i = 1; i < eDados.length; i++){

      const nomeEstoque = String(eDados[i][0] || '')
        .trim()
        .toUpperCase();

      if(nomeEstoque === nomeBusca){

        info.qtd = Number(eDados[i][1]) || 0;
        break;
      }
    }

