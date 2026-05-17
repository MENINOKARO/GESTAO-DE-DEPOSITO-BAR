      // ======================
      // KPI BOTÕES
      // ======================

      const cards = [
        ['💰 Caixa Hoje', `R$ ${caixaHoje.toFixed(2)}`, 'CAIXA', '#16a34a'],
        ['📦 Estoque Crítico', criticos.length, 'ESTOQUE', '#dc2626'],
        ['💰 Valor Estoque', `R$ ${valorTotalEstoque.toFixed(2)}`, 'ESTOQUE_VALORES', '#f59e0b'],
        ['🍺 Comandas', ops.comandasAbertas, 'COMANDAS', '#2563eb'],
        ['🚚 Delivery', ops.deliveryHoje, 'DELIVERY', '#ea580c'],
        ['🔄 Backup', 'Fazer', 'BACKUP', '#8b5cf6'],
        ['📂 Drive', driveUrl ? 'Abrir' : 'Configurar', 'DRIVE', '#10b981']
      ];


      // Layout 4x3: 4 cards na primeira linha e 3 cards na segunda (centralizados)
      const cardPositions = [
        [4,1], [4,3], [4,5], [4,7],
        [7,2], [7,4], [7,6]
      ];

      // visual mais moderno para a HOME
      sh.getRange('A1:H120')
        .setBackground('#020617')
        .setFontColor('#e2e8f0');

      sh.setColumnWidths(1, 8, 128);
      [4,5,6,7,8,9].forEach(l=> sh.setRowHeight(l, 34));

      cards.forEach(([titulo,valor,aba,cor], idx)=>{

        const [row, col] = cardPositions[idx];
        const r = sh.getRange(row, col, 3, 2);

        r.merge();

        r.setValue(`${titulo}\n${valor}`)
          .setFontSize(12)
          .setFontWeight('bold')
          .setHorizontalAlignment('center')
          .setVerticalAlignment('middle')
          .setBackground(cor)
          .setFontColor('#ffffff')
          .setBorder(true,true,true,true,true,true,'#0b1120',SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

        r.setWrap(true);

      });


