    // ======================
    // 🔄 ATUALIZA EXISTENTE
    // ======================
    if(d.id){

      for(let i=1;i<dados.length;i++){

        if(dados[i][10] === d.id){

          const nomeAntigo = dados[i][0];

          sh.getRange(i+1,1,1,11).setValues([[
            d.produto,
            d.categoria,
            d.marca,
            d.volume,
            preco,
            minimo,
            custo,
            margem,
            precoSug,
            status,
            d.id
          ]]);

          if(nomeAntigo !== d.produto){
            atualizarNomeNoEstoque(nomeAntigo, d.produto);
          }

          registrarLog(
            'PRODUTO_ATUALIZADO',
            d.id,
            nomeAntigo,
            d.produto
          );

          return {tipo:'atualizado', id:d.id};
        }
      }
    }

