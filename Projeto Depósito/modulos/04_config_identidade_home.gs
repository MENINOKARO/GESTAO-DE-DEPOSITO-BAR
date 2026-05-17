// ===============================
// CONFIG / IDENTIDADE / HOME
// ===============================
  // IDENTIDADE DE HOME
    function getNomeDeposito(){

      const nome = getConfig('NOME_DEPOSITO');

      return nome ? nome.toString().trim() : 'DEPÓSITO';
    }
    function organizarConfig(silencioso){

      const ss = SpreadsheetApp.getActive();

      let sh = ss.getSheetByName('CONFIG');

      if(!sh){
        sh = ss.insertSheet('CONFIG');
      }

      sh.clear();


      const dados = [

        ['CHAVE','VALOR','DESCRIÇÃO'],

        ['NOME_DEPOSITO','','Nome exibido no sistema'],

        ['TELEFONE','','Contato principal'],

        ['CIDADE','','Cidade da empresa'],

        ['DRIVE_URL','','URL da pasta do Drive'],

        ['AUTO_REFRESH','SIM','Atualizar Home automaticamente'],

        ['INTERVALO_REFRESH','5','Intervalo em minutos'],

        ['TEMA','DARK','Tema do sistema'],

        ['BACKUP_AUTO','SIM','Backup automático']
      ];


      sh.getRange(1,1,dados.length,3).setValues(dados);


      // FORMATAÇÃO
      sh.getRange('A1:C1')
        .setFontWeight('bold')
        .setBackground('#020617')
        .setFontColor('#ffffff');

      sh.setColumnWidths(1,3,220);

      sh.setFrozenRows(1);


      if(!silencioso){
        SpreadsheetApp.getUi()
          .alert('✅ CONFIG organizado com sucesso.');
      }

    }
    function getConfig(chave){

      const ss = SpreadsheetApp.getActive();
      const sh = ss.getSheetByName('CONFIG');

      if(!sh) return null;

      const dados = sh.getDataRange().getValues();

      chave = chave.toUpperCase().trim();

      for(let i=1;i<dados.length;i++){

        if(dados[i][0] === chave){

          return dados[i][1];

        }

      }

      return null;
    }
    function setConfig(chave, valor, descricao){

      const ss = SpreadsheetApp.getActive();
      let sh = ss.getSheetByName('CONFIG');

      if(!sh){
        organizarConfig(true);
        sh = ss.getSheetByName('CONFIG');
      }

      if(!sh){
        throw new Error('Aba CONFIG não encontrada.');
      }

      const chaveNorm = String(chave || '').toUpperCase().trim();
      if(!chaveNorm){
        throw new Error('Chave de configuração inválida.');
      }

      const dados = sh.getDataRange().getValues();
      let linha = -1;

      for(let i = 1; i < dados.length; i++){
        if(String(dados[i][0] || '').toUpperCase().trim() === chaveNorm){
          linha = i + 1;
          break;
        }
      }

      const valorFinal = valor == null ? '' : valor;
      const descFinal = descricao == null ? '' : descricao;

      if(linha > 0){
        sh.getRange(linha, 2).setValue(valorFinal);
        if(descFinal !== ''){
          sh.getRange(linha, 3).setValue(descFinal);
        }
      } else {
        sh.appendRow([chaveNorm, valorFinal, descFinal]);
      }

      return true;
    }
    function atualizarHome(){
      // preferencialmente monta dashboard completo
      if(typeof criarHomeDashboard === 'function'){
        criarHomeDashboard();
        return;
      }

      const ss = SpreadsheetApp.getActive();
      const sh = ss.getSheetByName('HOME');

      if(!sh) return;

      const nome = getNomeDeposito();

      sh.getRange('B2:F3')
        .clear()
        .merge()
        .setValue(`🍻 ${nome} 🎛️\nPainel de Controle`)
        .setFontSize(18)
        .setFontWeight('bold')
        .setHorizontalAlignment('center')
        .setVerticalAlignment('middle');

      // informa valor total do estoque abaixo do título
      if(typeof obterValorTotalEstoque === 'function'){
        const valor = obterValorTotalEstoque();
        sh.getRange('B4:F4')
          .clear()
          .merge()
          .setValue(`💰 Valor Estoque: R$ ${valor.toFixed(2)}`)
          .setFontSize(12)
          .setHorizontalAlignment('center');
      }
    }
    function criarHomeComBotoes(){

      const ss = SpreadsheetApp.getActive();

      let sh = ss.getSheetByName('HOME');

      if(!sh){
        sh = ss.insertSheet('HOME');
      }

      sh.clear();
      sh.setHiddenGridlines(true);

      const nome = getNomeDeposito();

      // ===== TÍTULO =====
      sh.getRange('B2:F3').merge()
        .setValue(`🍻 ${nome} 🎛️\nPainel de Controle`)
        .setFontSize(18)
        .setFontWeight('bold')
        .setHorizontalAlignment('center')
        .setVerticalAlignment('middle');


      // ===== TEXTO AUXILIAR =====
      sh.getRange('B5:F5').merge()
        .setValue('⬇️ Use os botões abaixo ⬇️')
        .setHorizontalAlignment('center')
        .setFontSize(11)
        .setFontStyle('italic');

      // ===== AJUSTES VISUAIS =====
      sh.setRowHeights(7, 20, 50);
      sh.setColumnWidths(1, 7, 120);

    }
    function abrirPainelFlutuante(){
      // atualiza folha HOME sempre que o painel rápido for aberto
      try{ criarHomeDashboard(); }catch(e){}
      abrirNovoPainelSistema();
    }
    function abrirNovoPainelSistema(){

      const html = `
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>

          * { box-sizing: border-box; }

          body{
            margin:0;
            padding:8px;
            font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background:#0f172a;
            color:#fff;
            overflow-x:hidden;
          }

          .container{
            padding:12px;
            display:flex;
            flex-direction:column;
            gap:10px;
            max-width:100%;
          }

          .hint{
            margin:0;
            font-size:12px;
            text-align:center;
            color:#94a3b8;
          }

          .search{
            width:100%;
            border:1px solid #334155;
            background:#020617;
            color:#fff;
            border-radius:10px;
            padding:10px 12px;
            font-size:14px;
          }

          .search:focus{
            outline:none;
            border-color:#2563eb;
          }

          .section{
            margin-top:4px;
          }

          .section-title{
            margin:0 0 8px 0;
            font-size:12px;
            letter-spacing:.5px;
            color:#94a3b8;
            text-transform:uppercase;
          }

          h2{
            text-align:center;
            margin:0 0 10px 0;
            font-size:18px;
          }

          .card{
            background:linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            padding:12px;
            border-radius:10px;
            border:1px solid #334155;
            cursor:pointer;
            transition:all 0.2s;
            font-weight:600;
            display:flex;
            align-items:center;
            gap:10px;
            min-height:44px;
            width:100%;
          }

          .card:active{
            transform:scale(0.98);
            background:#334155;
          }

          .icon{
            font-size:18px;
            min-width:20px;
          }

          .label{
            flex:1;
            font-size:14px;
          }

          .danger{
            background:linear-gradient(135deg, #7f1d1d 0%, #5a1515 100%);
            border:1px solid #991b1b;
          }

          .danger:active{
            background:#991b1b;
          }

          .info{
            background:linear-gradient(135deg, #1e3a8a 0%, #172554 100%);
            border:1px solid #1e40af;
          }

          .success{
            background:linear-gradient(135deg, #14532d 0%, #052e16 100%);
            border:1px solid #16a34a;
          }

          @media(max-width:600px){
            .container{
              padding:8px;
              gap:8px;
            }
            .card{
              padding:10px;
              font-size:13px;
            }
            .icon{
              font-size:16px;
            }
          }

        </style>
      </head>

      <body>

        <div class="container">

          <h2>🧠 Painel Inteligente</h2>
          <p class="hint">Acesso fácil as funções do seu depósito.</p>

          <input id="busca" class="search" type="search" placeholder="Buscar função..." oninput="filtrar()">

          <div id="lista"></div>

        </div>

        <script>

          const grupos = [
            {
              titulo: '⚡ Ações rápidas',
              estilo: 'info',
              acoes: [
                ['🍺', 'Comanda', 'popupPainelComandas'],
                ['🚚', 'Delivery', 'popupPainelDelivery2'],
                ['📝', 'Financeiro', 'popupPainelFinanceiro'],
                ['💰', 'Caixa', 'abrirCaixaOpcoes'],
                ['📦', 'Estoque', 'abrirEstoqueOpcoes'],
                ['💬', 'WhatsApp', 'abrirPainelWhatsApp']
              ]
            },
            {
              titulo: '💶 Comandas e Delivery',
              estilo: 'info',
              acoes: [
                ['🍺', 'Nova Comanda Balcão', 'popupComandaBalcao'],
                ['📂', 'Comandas Abertas', 'listarComandasAbertas'],
                ['🚚', 'Novo Delivery', 'popupDelivery'],
                ['📦', 'Painel de Delivery', 'popupPainelDelivery2']
              ]
            },
            {
              titulo: '🛅 Controle',
              estilo: 'success',
              acoes: [
                ['📝', 'Painel Financeiro', 'popupPainelFinanceiro'],
                ['🔒', 'Conferência Caixa', 'fecharCaixaDia'],
                ['📑', 'Fechamento Fiscal', 'fecharFiscalDia'],
                ['⚖️', 'Fluxo de Caixa', 'popupFluxoCaixa'],
                ['🪙', 'Contas a Pagar', 'popupPainelContasAPagar'],
                ['💳', 'Contas a Receber', 'popupPainelContasAReceber'],
                ['👤', 'Novo Cliente', 'popupCliente'],
                ['🔍', 'Consultar Cliente', 'popupBuscarCliente'],
                ['👥', 'Usuários', 'popupListarUsuarios'],
                ['🛒', 'Nova Compra', 'popupCompraV2'],
                ['❌', 'Cancelamento de Notas', 'popupPainelCancelamentoCompra'],
                ['💲', 'Análise de Lucratividade', 'abrirAnaliseProduto'],
                ['🛍️', 'Gestão de Produto', 'popupProdutoManager'],
                ['📖', 'Manual', 'abrirManualDoSistema'],
                ['📂', 'Drive', 'abrirDriveLink']
              ]
            },
            {
              titulo: '📦 Estoque Financeiro',
              estilo: 'info',
              acoes: [
                ['🎯', 'Painel Gestão', 'abrirPainelGestaoEstoque'],
                ['📊', 'Gerar Relatório Valores', 'gerarRelatorioValoresEstoque'],
                ['📈', 'Análise de Rentabilidade', 'abrirAnalisRentabilidade'],
                ['🏷️', 'Valor por Categoria', 'exibirValorCategoria'],
                ['💹', 'Valor Total Estoque', 'exibirValorTotalEstoque']
              ]
            },
            {
              titulo: '📚 Relatórios Gerenciais',
              estilo: 'success',
              acoes: [
                ['📊', 'Relatório Valores do Estoque', 'gerarRelatorioValoresEstoque'],
                ['💰', 'Relatório Financeiro Completo', 'gerarRelatorioFinanceiroCompleto'],
                ['🛒', 'Relatório de Compras', 'gerarRelatorioCompras'],
                ['🧾', 'Relatório de Logs', 'gerarRelatorioLogsSistema'],
                ['📦', 'Gerar TODOS os Relatórios', 'gerarPacoteRelatoriosGerenciais']
              ]
            },
            {
              titulo: '🖥️ Sistema',
              estilo: 'danger',
              acoes: [
                ['🚀', 'Iniciar Sistema', 'initSistema'],
                ['🚧', 'Resetar Sistema', 'popupSenhaReset'],
                ['🔐', 'Trocar Senha Reset', 'popupTrocarSenhaReset'],
                ['🧽', 'Limpar Senha Reset', 'limparSenhaResetSolicitandoTroca'],
                ['⚙️', 'Configurar Depósito', 'abrirConfiguracaoDeposito'],
                ['🔄', 'Recarregar Menu', 'recarregarMenu'],
                ['💾', 'Backup', 'fazerBackupSistema'],
                ['📜', 'Ver Logs', 'abrirAbaLog'],
                ['🧹', 'Padronizar Abas', 'padronizarTodasAbasSistema'],
                ['🔀', 'Trocar Login', 'trocarLogin'],
                ['🚪', 'Logout', 'fazerLogout']
              ]
            }
          ];

          function desenhar(lista){
            const root = document.getElementById('lista');
            root.innerHTML = '';

            let total = 0;
            lista.forEach(grupo=>{
              if(!grupo.acoes.length) return;
              total += grupo.acoes.length;

              const sec = document.createElement('div');
              sec.className = 'section';
              sec.innerHTML = '<h3 class="section-title">' + grupo.titulo + '</h3>';

              grupo.acoes.forEach(([icone, nome, fn])=>{
                const item = document.createElement('div');
                item.className = 'card ' + grupo.estilo;
                item.innerHTML = '<span class="icon">' + icone + '</span><span class="label">' + nome + '</span>';
                item.onclick = () => run(fn);
                sec.appendChild(item);
              });

              root.appendChild(sec);
            });

            if(total === 0){
              root.innerHTML = '<p class="hint">Nenhuma função encontrada.</p>';
            }
          }

          function filtrar(){
            const termo = (document.getElementById('busca').value || '').toLowerCase().trim();
            if(!termo){
              desenhar(grupos);
              return;
            }

            const filtrado = grupos.map(g=>({
              titulo: g.titulo,
              estilo: g.estilo,
              acoes: g.acoes.filter(a=> a[1].toLowerCase().includes(termo))
            }));

            desenhar(filtrado);
          }

          function run(fn){

            google.script.run
              .withFailureHandler(e=>{
                alert('Erro: ' + e.message);
              })
              [fn]();
          }

          desenhar(grupos);

        </script>

      </body>
      </html>
      `;

      const ui = HtmlService
        .createHtmlOutput(html)
        .setTitle('🎛️ Painel Inteligente')
        .setWidth(420);

      SpreadsheetApp.getUi().showSidebar(ui);
      abrirHome()
    }
  // Painel específico de gestão de estoque 
    function abrirPainelGestaoEstoque(){
      const rel = (typeof obterResumoEstoqueFinanceiroLeve_ === 'function')
        ? obterResumoEstoqueFinanceiroLeve_()
        : null;

      if(!rel){
        SpreadsheetApp.getUi().alert('❌ Falha ao gerar dados da gestão de estoque.');
        return;
      }

      const analise = (typeof analisarRentabilidadeEstoque === 'function')
        ? analisarRentabilidadeEstoque()
        : { maisRentaveis: [], estoqueCritico: [], altaRotacao: [], quaseNenhumavenda: [] };

      const ranking = (typeof gerarRankingProdutos === 'function')
        ? gerarRankingProdutos()
        : { top: [], flop: [] };

      const topVende = ranking.top.slice(0, 5)
        .map((i,idx)=>`${idx+1}. ${i.produto} (${i.qtd} un)`)
        .join('<br>') || 'Sem dados de vendas';

      const menosSai = ranking.flop.slice(0, 5)
        .map((i,idx)=>`${idx+1}. ${i.produto} (${i.qtd} un)`)
        .join('<br>') || 'Sem dados de vendas';

      const maisLucrativos = analise.maisRentaveis.slice(0, 5)
        .map((i,idx)=>`${idx+1}. ${i.produto} (R$ ${Number(i.lucroVendido || i.lucroEstoque || 0).toFixed(2)})`)
        .join('<br>') || 'Sem dados de lucratividade';

      const criticos = analise.estoqueCritico.slice(0, 10)
        .map((i,idx)=>`${idx+1}. ${i.produto} (${i.qtdAtual || i.quantidade || 0} un)`)
        .join('<br>') || 'Nenhum produto em nível crítico';

      abrirPopup('📦 Painel de Gestão de Estoque', `
        <div style="display:flex;flex-direction:column;gap:10px">
          <div style="background:#f1f5f9;border:1px solid #cbd5e1;border-radius:10px;padding:10px">
            <strong>💰 Valor total em estoque:</strong> R$ ${Number(rel.resumo.totalValorEstoque || 0).toFixed(2)}<br>
            <strong>💸 Custo total:</strong> R$ ${Number(rel.resumo.totalCustoEstoque || 0).toFixed(2)}<br>
            <strong>💹 Lucro potencial:</strong> R$ ${Number(rel.resumo.lucroEstoque || 0).toFixed(2)}<br>
            <strong>📈 Margem média:</strong> ${Number(rel.resumo.margemMedia || 0).toFixed(2)}%
          </div>

          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px">
            <strong>🏆 Produtos que mais vendem</strong><br>${topVende}
          </div>

          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px">
            <strong>💰 Produtos mais lucrativos</strong><br>${maisLucrativos}
          </div>

          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px">
            <strong>🐢 Produtos que menos saem</strong><br>${menosSai}
          </div>

          <div style="background:#fff1f2;border:1px solid #fecdd3;border-radius:10px;padding:10px">
            <strong>🚨 Estoque crítico</strong><br>${criticos}
          </div>

          <button class="btn-primary" onclick="google.script.run.gerarRelatorioValoresEstoque();google.script.host.close();">
            📊 Gerar aba de Relatório Valores
          </button>
        </div>
      `, 540, 670);
    }
    function abrirEstoqueOpcoes(){

      const html = `
      <html>
      <head>
        <style>
          body{margin:0;font-family:Arial;background:#0f172a;color:white;}
          .container{padding:18px;display:flex;flex-direction:column;gap:12px;}
          h2{text-align:center;margin:0 0 8px 0;}
          .card{background:#1e293b;padding:14px;border-radius:12px;display:flex;flex-direction:column;gap:8px;}
          .card-title{font-size:13px;font-weight:bold;opacity:.85;}
          .btn{padding:10px;border:none;border-radius:10px;font-weight:bold;cursor:pointer;font-size:14px;background:#2563eb;color:#fff;}
          .btn:hover{background:#1d4ed8;}
          .secondary{background:#475569;}
          .secondary:hover{background:#334155;}
        </style>
      </head>
      <body>
        <div class="container">
          <h2>📦 Central de Estoque</h2>

          <div class="card">
            <div class="card-title">📦 GESTÃO DE PRODUTOS E ESTOQUE</div>
            <button class="btn" onclick="run('gestao')">🏷️ Gestão de Produto</button>
            <button class="btn" onclick="run('analiseProduto')">💲 Análise de Lucratividade</button>
          </div>

          <div class="card">
            <div class="card-title">💰 ESTOQUE FINANCEIRO</div>
            <button class="btn" onclick="run('painelGestao')">🎯 Painel Gestão</button>
            <button class="btn" onclick="run('relatorioValores')">📊 Gerar Relatório Valores</button>
            <button class="btn" onclick="run('rentabilidade')">📈 Análise de Rentabilidade</button>
            <button class="btn" onclick="run('categoria')">🏷️ Valor por Categoria</button>
            <button class="btn" onclick="run('total')">💹 Valor Total Estoque</button>
          </div>

          <div class="card">
            <div class="card-title">📚 RELATÓRIOS GERENCIAIS</div>
            <button class="btn" onclick="run('financeiroCompleto')">💰 Relatório Financeiro Completo</button>
            <button class="btn" onclick="run('comprasRelatorio')">🛒 Relatório de Compras</button>
            <button class="btn" onclick="run('logsRelatorio')">🧾 Relatório de Logs</button>
            <button class="btn" onclick="run('pacoteRelatorios')">📦 Gerar Todos os Relatórios</button>
          </div>

          <button class="btn secondary" onclick="google.script.host.close()">❌ Fechar</button>
        </div>

        <script>
          function run(tipo){
            google.script.run
              .withFailureHandler(e=>alert('Erro: ' + e.message))
              .executarEstoque(tipo);
          }
        </script>
      </body>
      </html>
      `;

      const ui = HtmlService
        .createHtmlOutput(html)
        .setWidth(430)
        .setHeight(640);

      SpreadsheetApp.getUi().showModalDialog(ui, '📦 Estoque');
    }
    function executarEstoque(tipo){

      switch(tipo){

        case 'gestao':
          popupProdutoManager();
          break;

        case 'analiseProduto':
          abrirAnaliseProduto();
          break;

        case 'painelGestao':
          abrirPainelGestaoEstoque();
          break;

        case 'relatorioValores':
          gerarRelatorioValoresEstoque();
          break;

        case 'rentabilidade':
          abrirAnalisRentabilidade();
          break;

        case 'categoria':
          exibirValorCategoria();
          break;

        case 'total':
          exibirValorTotalEstoque();
          break;

        case 'financeiroCompleto':
          gerarRelatorioFinanceiroCompleto();
          break;

        case 'comprasRelatorio':
          gerarRelatorioCompras();
          break;

        case 'logsRelatorio':
          gerarRelatorioLogsSistema();
          break;

        case 'pacoteRelatorios':
          gerarPacoteRelatoriosGerenciais();
          break;

        default:
          throw new Error('Opção inválida: ' + tipo);
      }

    }
    function criarHomeDashboard(){

      const ss = SpreadsheetApp.getActive();

      let sh = ss.getSheetByName('HOME');

      // evita executar geração de relatório ao abrir HOME/menu
      const relEstoque = (typeof obterResumoEstoqueFinanceiroLeve_ === 'function')
        ? obterResumoEstoqueFinanceiroLeve_()
        : null;


      if(!sh){
        sh = ss.insertSheet('HOME');
      }

      sh.clear();
      sh.setHiddenGridlines(true);


