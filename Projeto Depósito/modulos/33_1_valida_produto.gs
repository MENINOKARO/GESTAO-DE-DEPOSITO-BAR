      // ===============================
      // 1️⃣ VALIDA PRODUTO
      // ===============================
      const shProdutos = ss.getSheetByName('PRODUTOS');
      if(!shProdutos){
        return { ok:false, msg:'Aba PRODUTOS não encontrada.' };
      }

      const produtos = shProdutos
        .getRange(2,1,shProdutos.getLastRow() -1,1)
        .getValues()
        .flat();

      if(!produtos.includes(produto)){
        return { ok:false, msg:'Produto não existe na aba PRODUTOS.' };
      }

