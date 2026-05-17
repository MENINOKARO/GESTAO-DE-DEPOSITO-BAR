    // ===============================
    // ATUALIZA STATUS (SEM MEXER NO SALDO)
    // ===============================
    Object.values(mapaEstoque).forEach(item => {

      let status = '🟢   OK   🔋';

      if(item.qtd <= item.minimo){
        status = '🔴 Crítico🪫';
      }else if(item.qtd <= item.minimo * 2){
        status = '🟡 Baixo';
      }

      shEstoque.getRange(item.row, 4).setValue(status);
    });

    // 🔄 SINCRONIZA QUANTIDADE PARA ABA PRODUTOS
    sincronizarQuantidadeProdutos();
  }

  /*
  * 🔄 Sincroniza quantidade de ESTOQUE para coluna de PRODUTOS
  */

    function sincronizarQuantidadeProdutos() {

      try {

        const ss = SpreadsheetApp.getActive();

        const shEstoque = ss.getSheetByName('ESTOQUE');
        const shProdutos = ss.getSheetByName('PRODUTOS');

        if (!shEstoque || !shProdutos) return;

        const estoqueDados = shEstoque.getDataRange().getValues();
        const produtosDados = shProdutos.getDataRange().getValues();

        // 🔹 Mapa de estoque (Produto -> Quantidade)
        const mapaEstoque = {};
        estoqueDados.slice(1).forEach(linha => {
          const produto = linha[0];
          const quantidade = Number(linha[1]) || 0;
          if (produto) {
            mapaEstoque[produto] = quantidade;
          }
        });

        // 🔹 Atualiza coluna de quantidade em PRODUTOS (coluna K = 11)
        produtosDados.slice(1).forEach((linha, idx) => {
          const nomeProduto = linha[0];
          const quantidadeAtual = mapaEstoque[nomeProduto] || 0;

          // Atualiza a coluna 12 (Quantidade em Estoque)
          shProdutos.getRange(idx + 2, 12).setValue(quantidadeAtual);
        });

      } catch (e) {
        console.error('Erro em sincronizarQuantidadeProdutos:', e);
      }
    }
    function ajustarEstoque(produto, quantidade, motivo) {

      const ss = SpreadsheetApp.getActive();

      if(!produto || !quantidade){
        return { ok:false, msg:'Informe produto e quantidade.' };
      }

      quantidade = Number(quantidade);
      if(isNaN(quantidade) || quantidade === 0){
        return { ok:false, msg:'Quantidade inválida.' };
      }

