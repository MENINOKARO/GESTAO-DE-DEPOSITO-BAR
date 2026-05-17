      // =========================
      // 2️⃣ LIMPA CACHE
      // =========================
      CacheService.getScriptCache().removeAll([
        'ORIGEM_CLIENTE',
        'CLIENTE_TEMP_DELIVERY',
        'CARRINHO_TEMP',
        'CARRINHO_ATUAL',
        'COMANDA_ATIVA'
      ]);

