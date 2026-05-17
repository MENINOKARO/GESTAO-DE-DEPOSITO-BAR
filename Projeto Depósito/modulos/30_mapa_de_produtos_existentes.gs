    // ===============================
    // MAPA DE PRODUTOS EXISTENTES
    // ===============================
    const mapaEstoque = {};

    for(let i = 1; i < estoqueDados.length; i++){

      const nomeOriginal = estoqueDados[i][0];
      if(!nomeOriginal) continue;

      const chave = String(nomeOriginal)
        .trim()
        .toUpperCase();

      mapaEstoque[chave] = {
        row: i + 1,
        qtd: Number(estoqueDados[i][1]) || 0,
        minimo: Number(estoqueDados[i][2]) || 0
      };
    }

