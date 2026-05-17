    // ===============================
    // 📊 RELATÓRIOS
    // ===============================
    const relatorios = obterOuCriarPastaPorNome(
      root,
      'Relatorios',
      'CRIAR_PASTA',
      `${nomeDeposito}/Relatorios`
    );

    obterOuCriarPastaPorNome(relatorios, 'Financeiro', 'CRIAR_PASTA', `${nomeDeposito}/Relatorios/Financeiro`);
    obterOuCriarPastaPorNome(relatorios, 'Estoque',    'CRIAR_PASTA', `${nomeDeposito}/Relatorios/Estoque`);
    obterOuCriarPastaPorNome(relatorios, 'Compras',    'CRIAR_PASTA', `${nomeDeposito}/Relatorios/Compras`);

