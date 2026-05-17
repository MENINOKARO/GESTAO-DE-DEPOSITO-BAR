    // ============================
    // 5️⃣ FINANCEIRO
    // ============================
      if(formaPgto === '🧾 Fiado'){

        if(saldoFinal > 0){
          criarContaAReceber(
            'COMANDA',
            idVenda,
            cliente,
            saldoFinal,
            'FIADO'
          );
        }

      } else {

        // 💡 se nada foi pago antes, entra o total
        const valorEntrada = saldoFinal > 0 ? saldoFinal : totalItens;

        if(valorEntrada > 0){
          inserirLinhaNoTopo('CAIXA', [
            agoraBrasil(),
            'Entrada',
            valorEntrada,
            formaPgto,
            `COMANDA ${idVenda} (FECHAMENTO)`
          ]);
        }
      }

