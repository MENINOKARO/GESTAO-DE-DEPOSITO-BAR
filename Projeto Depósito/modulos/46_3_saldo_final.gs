    // ============================
    // 3️⃣ SALDO FINAL
    // ============================
    const saldoFinal = totalItens - totalPago;

    if(saldoFinal < 0){
      throw new Error(
        `Erro crítico: saldo negativo na comanda ${pedido}`
      );
    }

