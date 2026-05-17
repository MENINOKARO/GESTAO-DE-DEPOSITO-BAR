    // ============================
    // 2️⃣ TOTAL JÁ PAGO (CAIXA)
    // ============================
    const cx = ss.getSheetByName('CAIXA')
      .getDataRange()
      .getValues();

    let totalPago = 0;

    cx.forEach((l,i)=>{
      if(i === 0) return;
      if(typeof l[4] === 'string' && l[4].includes(pedido)){
        totalPago += Number(l[2]) || 0;
      }
    });

