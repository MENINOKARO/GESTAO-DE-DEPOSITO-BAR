// ===============================
// TRAVA INTELIGENTE
// ===============================
  function validarEstoque(produto, qtdSolicitada) {

    const aba = SpreadsheetApp.getActive()
      .getSheetByName("PRODUTOS");

    const dados = aba.getDataRange().getValues();

    for (let i = 1; i < dados.length; i++) {

      // comparar nomes com normalização se disponível
      const safeNorm = function(str){
        if(typeof normalizeString === 'function') return normalizeString(str);
        let s = String(str || '');
        try{ return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toUpperCase().trim(); }
        catch(e){ return s.toUpperCase().trim(); }
      };

      if (safeNorm(dados[i][0]) == safeNorm(produto)) {

        const estoqueAtual = Number(dados[i][2]);

        if (estoqueAtual >= qtdSolicitada) {

          return {
            ok: true,
            estoque: estoqueAtual
          };

        } else {

          registrarLog(
            "ESTOQUE_NEGATIVO_BLOQUEADO",
            `Tentativa venda ${produto}`,
            estoqueAtual,
            qtdSolicitada
          );

          return {
            ok: false,
            estoque: estoqueAtual
          };
        }
      }
    }

    return {
      ok: false,
      estoque: 0
    };
  }
  function baixarEstoqueSeguro(produto, qtd) {

    const validacao = validarEstoque(produto, qtd);

    if (!validacao.ok) {

      SpreadsheetApp.getUi().alert(
        `❌ Estoque insuficiente!\n\nProduto: ${produto}\nDisponível: ${validacao.estoque}`
      );

      return false;
    }

    const aba = SpreadsheetApp.getActive()
      .getSheetByName("PRODUTOS");

    const dados = aba.getDataRange().getValues();

    for (let i = 1; i < dados.length; i++) {

      if (dados[i][0] == produto) {

        const novo = dados[i][2] - qtd;

        aba.getRange(i + 1, 3).setValue(novo);

        registrarLog(
          "BAIXA_ESTOQUE",
          produto,
          dados[i][2],
          novo
        );

        return true;
      }
    }

    return false;
  }
  function processarVenda(produto, qtd, comanda) {

    // 1️⃣ Validar estoque
    const validacao = validarEstoque(produto, qtd);

    if (!validacao.ok) {
      return false;
    }

    const antes = {
      estoque: validacao.estoque
    };

    // 2️⃣ Baixar com segurança
    if (!baixarEstoqueSeguro(produto, qtd)) {
      return false;
    }

    const depois = {
      estoque: validacao.estoque - qtd
    };

    // 3️⃣ Log
    registrarLog(
      "VENDA",
      `Comanda ${comanda} - ${produto}`,
      antes,
      depois
    );

    return true;
  }
  function processarCompra(produto, qtd, valorTotal) {

    const aba = SpreadsheetApp.getActive()
      .getSheetByName("PRODUTOS");

    const dados = aba.getDataRange().getValues();

    for (let i = 1; i < dados.length; i++) {

      if (dados[i][0] == produto) {

        const estoqueAntes = dados[i][2];
        const custoAntes = dados[i][3];

        // Atualiza estoque
        const novoEstoque = estoqueAntes + qtd;

        aba.getRange(i + 1, 3).setValue(novoEstoque);

        // Atualiza custo médio
        atualizarCustoMedioProduto(produto, qtd, valorTotal);

        const custoDepois = aba.getRange(i + 1, 3).getValue();

        registrarLog(
          "COMPRA",
          produto,
          {
            estoque: estoqueAntes,
            custo: custoAntes
          },
          {
            estoque: novoEstoque,
            custo: custoDepois
          }
        );

        return;
      }
    }
  }
  function registrarPagamento(comanda, valor) {

    registrarLog(
      "PARCIAL",
      `Comanda ${comanda}`,
      "",
      valor
    );
  }
  function fecharComanda(comanda, total) {

    registrarLog(
      "FECHAMENTO",
      `Comanda ${comanda}`,
      "",
      total
    );

    // Opcional: backup automático ao fechar
    fazerBackupSistema();
  }
  function ajustarProduto(produto, novoEstoque) {

    const aba = SpreadsheetApp.getActive()
      .getSheetByName("PRODUTOS");

    const dados = aba.getDataRange().getValues();

    for (let i = 1; i < dados.length; i++) {

      if (dados[i][0] == produto) {

        const antes = dados[i][2];

        aba.getRange(i + 1, 3).setValue(novoEstoque);

        registrarLog(
          "AJUSTE",
          produto,
          antes,
          novoEstoque
        );

        return;
      }
    }
  }

