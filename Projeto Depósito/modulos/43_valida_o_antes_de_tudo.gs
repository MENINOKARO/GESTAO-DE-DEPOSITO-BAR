    // ============================
    // 🔒 VALIDAÇÃO ANTES DE TUDO
    // ============================
    let cliente = '';

    if(formaPgto === '🧾 Fiado'){
      cliente = getClienteDaComanda(pedido);

      if(!cliente){
        throw new Error(
          'Venda FIADO exige cliente informado na comanda.'
        );
      }

      // 🔥 valida existência REAL na aba CLIENTES
      validarClienteFiado(cliente);
    }

