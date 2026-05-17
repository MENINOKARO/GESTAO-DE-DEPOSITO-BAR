    // =========================
    // NORMALIZA SALDO
    // =========================

    let r = calcularSaldoHoje();

    let entrada = 0;
    let saida   = 0;
    let saldo   = 0;


    // Caso antigo (retorna número)
    if(typeof r === 'number'){

      saldo = Number(r) || 0;

    }
    // Caso novo (retorna objeto)
    else if(typeof r === 'object' && r !== null){

      entrada = Number(r.entrada) || 0;
      saida   = Number(r.saida)   || 0;
      saldo   = Number(r.saldo)   || 0;

    }


