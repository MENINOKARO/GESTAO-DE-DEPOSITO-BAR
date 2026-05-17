      // ======================
      // DADOS
      // ======================

      const nome = getNomeDeposito();

      const hoje = Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        'dd/MM/yyyy HH:mm'
      );

      const driveUrl = getConfig('DRIVE_URL');
      
      // 🔹 Dados do usuário logado
      const usuario = obterUsuarioAtual();
      const nomeUsuario = usuario && usuario.nome ? usuario.nome : 'Usuário';
      const perfilUsuario = usuario && usuario.perfil ? usuario.perfil : 'OPERACIONAL';
      
      const fin = (typeof calcularSaldoHoje === 'function') ? calcularSaldoHoje() : null;
      const caixaHoje = Number((fin && fin.saldo) ? fin.saldo : 0); 
      
      const ops = (typeof calcularIndicadoresHoje === 'function') ? calcularIndicadoresHoje() : {};
      const criticos = (typeof listarEstoqueCritico === 'function') ? listarEstoqueCritico() : []; 
      
      const valorTotalEstoque = typeof obterValorTotalEstoque === 'function' 
        ? obterValorTotalEstoque() 
        : 0;
        
      const resumoEstoque = relEstoque && relEstoque.resumo ? relEstoque.resumo : {};

      // ranking pode ser pesado, usar cache de 5 minutos
      let ranking = { top: [], flop: [] };
      try {
        const cache = CacheService.getScriptCache();
        const cached = cache.get('HOME_RANKING');
        if(cached){
          ranking = JSON.parse(cached);
        } else if(typeof gerarRankingProdutos === 'function'){
          ranking = gerarRankingProdutos();
          cache.put('HOME_RANKING', JSON.stringify(ranking), 300);
        }
      } catch(e){
        console.warn('Erro ao obter ranking cache:', e);
      }

      sh.getRange('A1:H1').merge()
        .setValue(`🍻 GESTÃO DE DEPÓSITO — ${nome}`)
        .setFontSize(18)
        .setFontWeight('bold')
        .setHorizontalAlignment('center')
        .setVerticalAlignment('middle')
        .setBackground('#0f172a')
        .setFontColor('#ffffff');
      
      sh.getRange('A2:H2').merge()
        .setValue(`👋 Bem-vindo, ${nomeUsuario} | Perfil: ${perfilUsuario} | ${hoje}`)
        .setFontSize(18)
        .setFontWeight('bold')
        .setHorizontalAlignment('center')
        .setVerticalAlignment('middle')
        .setBackground('#1e293b')
        .setFontColor('#e0e7ff');

      // link para pasta do drive (se configurado)
      if(driveUrl){
        sh.getRange('A3:H3').merge()
          .setFormula(`=HYPERLINK("${driveUrl}","📂 Abra Drive")`)
          .setHorizontalAlignment('center')
          .setFontSize(12)
          .setFontStyle('italic');
      }


