    // ===============================
    // GARANTE / SINCRONIZA PRODUTOS
    // ===============================
    for(let i = 1; i < produtosDados.length; i++){

      const nomeProduto = produtosDados[i][0];
      if(!nomeProduto) continue;

      const chave = String(nomeProduto)
        .trim()
        .toUpperCase();

      const minimoProduto = Number(produtosDados[i][5]) || 0;

      // 🔹 Produto não existe no estoque → cria
      if(!mapaEstoque[chave]){

        const row = shEstoque.getLastRow() + 1;

        shEstoque.appendRow([
          nomeProduto,
          0,
          minimoProduto,
          '🔴 Crítico🪫',
          'Inicialização automática'
        ]);

        mapaEstoque[chave] = {
          row,
          qtd: 0,
          minimo: minimoProduto
        };

      } else {

        // 🔹 Produto já existe → ATUALIZA MÍNIMO
        shEstoque
          .getRange(mapaEstoque[chave].row, 3)
          .setValue(minimoProduto);

        mapaEstoque[chave].minimo = minimoProduto;
      }
    }

