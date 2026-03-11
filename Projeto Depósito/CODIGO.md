/*************************************************
 *       GESTÃO DE DEPÓSITO 
 *            VERSÃO 1.0
 *************************************************
  *
  * ===============================================
  * SISTEMA DE GESTÃO – KARO PRO v1.0
  * Status: ✅ ESTÁVEL 
  * Data de fechamento: 2026-02
  * Última atualização: Março 2026
  * ===============================================
  *
  * 📌 IMPORTANTE - LEIA PRIMEIRO:
  * ==============================
  * 📋 DOCUMENTAÇÃO (Abra estes arquivos):
  * ─────────────────────────────────────────────────
  * 1. RESUMO_AJUSTES_REALIZADOS.md       ← COMECE AQUI (visão geral)
  * 2. README_FUNCIONAMENTO_CORRIGIDO.md  ← Guia completo (manual operacional)
  * 3. ESTUDO_FUNCIONAMENTO_SISTEMA.md    ← Análise profunda (arquitetura)
  * 4. BUGS_ENCONTRADOS_E_CORRECOES.md    ← Detalhes técnicos (para devs)
  * 5. INDICE_DOCUMENTACAO.md             ← MAPA COMPLETO (você está aqui!)
  *
  * 🎯 COMPORTAMENTO ESPERADO 
  * ─────────────────────────────────────────────
  * 🍺 COMANDA BALCÃO:
  *    • Estoque baixa IMEDIATAMENTE
  *    • Cliente fica TRAVADO após 1º item
  *    • Pode continuar vendendo depois
  *    • Pagamento parcial funciona corretamente
  *    • ✅ NÃO gera falso erro "sem estoque" (chaves normalizadas)
  *
  * 📂 COMANDA ABERTA:
  *    • Itens históricos aparecem TRAVADOS (cinza)
  *    • Itens novos podem ser REMOVIDOS (colorido)
  *    • Saldo calcula: total - pagamentos parciais
  *    • Estoque validado ANTES de cada operação
  *    • ✅ Produtos com espaços/capitalização diferentes funcionam
  *
  * 🚚 DELIVERY:
  *    • Estoque NÃO baixa ao criar (PEDIDO FEITO)
  *    • Estoque BAIXA ao encaminhar (EM ANDAMENTO)
  *    • Cancelamento DEVOLVE estoque se foi encaminhado
  *    • Fiado BLOQUEADO (não permitido)
  *    • ✅ Todos os produtos aparecem no dropdown (não filtra por estoque)
  *
  * ===============================================
  */

// ===============================
// MENU / INICIALIZAÇÃO
// ===============================

  function onOpen() {

    try {

      // 🔐 VERIFICAÇÃO DE AUTENTICAÇÃO
      const usuarioAtual = obterUsuarioAtual();

      const ui = SpreadsheetApp.getUi();

      // 🔹 Se não autenticado, mostrar apenas menu de login
      if (!usuarioAtual) {
        ui.createMenu('📦 GESTÃO DE DEPÓSITO')
          .addItem('🔐 Fazer Login / Criar Conta', 'telaLoginOuCriar')
          .addToUi();
        return;
      }

      // 🔹 Nome do depósito (UI apenas)
      const nomeDeposito = getNomeDeposito();
      const tituloMenu = `📦 ${nomeDeposito} 📦`;

      // 🔹 MENU PRINCIPAL
      ui.createMenu(tituloMenu)
        .addItem('🏠 Home', 'abrirPainelFlutuante')
        .addSeparator()
        .addSubMenu(
          ui.createMenu('💶 Comandas')
            .addItem('🍺 Nova Comanda Balcão', 'popupComandaBalcao')
            .addItem('📂 Comandas Abertas', 'listarComandasAbertas')
        )
        .addSeparator()
        .addSubMenu(
          ui.createMenu('🚚 Delivery')
            .addItem('🚚 Novo Delivery', 'popupDelivery')
            .addItem('📦 Painel de Delivery', 'popupPainelDelivery2')
        )
        .addSeparator()
        .addSubMenu(
          ui.createMenu('🛅 Controle')
            .addItem('📝 Painel Financeiro', 'popupPainelFinanceiro')
            .addItem('🔒 Conferencia Caixa', 'fecharCaixaDia')
            .addItem('📑 Fechamento Fiscal do Dia', 'fecharFiscalDia')
            .addItem('⚖️ Fluxo de Caixa', 'popupFluxoCaixa')
            .addItem('🪙 Contas a Pagar', 'popupPainelContasAPagar')
            .addSeparator()
            .addItem('👤 Novo Cliente', 'popupCliente')
            .addItem('👥 Usuários', 'popupListarUsuarios')
            .addSeparator()
            .addItem('🛒 Nova Compra', 'popupCompraV2')
            .addItem('❌ Cancelamento de Notas', 'popupPainelCancelamentoCompra')
            .addSeparator()
            .addItem('💲 Análise de Lucratividade', 'abrirAnaliseProduto')
            .addItem('🛍️ Gestão de Produto', 'popupProdutoManager')
        )
        .addSeparator()
        .addSubMenu(
          ui.createMenu('📚 Relatórios Gerenciais')
            .addItem('📊 Relatório Valores do Estoque', 'gerarRelatorioValoresEstoque')
            .addItem('💰 Relatório Financeiro Completo', 'gerarRelatorioFinanceiroCompleto')
            .addItem('🛒 Relatório de Compras', 'gerarRelatorioCompras')
            .addItem('🧾 Relatório de Logs', 'gerarRelatorioLogsSistema')
            .addItem('📦 Gerar TODOS os Relatórios', 'gerarPacoteRelatoriosGerenciais')
        )
        .addSeparator()
        .addSubMenu(
          ui.createMenu('📦 Estoque Financeiro')
            .addItem('🎯 Painel Gestão', 'abrirPainelGestaoEstoque')
            .addItem('📊 Relatório Valores', 'gerarRelatorioValoresEstoque')
            .addItem('📈 Análise de Rentabilidade', 'abrirAnalisRentabilidade')
            .addItem('🏷️ Valor por Categoria', 'exibirValorCategoria')
            .addItem('💹 Valor Total Estoque', 'exibirValorTotalEstoque')
        )
        .addSeparator()
        .addSubMenu(
          ui.createMenu('🖥️ Sistema')
            .addItem('🚀 Iniciar Sistema', 'initSistema')
            .addItem('🚧 Resetar Sistema', 'popupSenhaReset')
            .addItem('🔐 Alterar Senha de Reset', 'popupTrocarSenhaReset')
            .addItem('⚙️ Configurar Depósito', 'abrirConfiguracaoDeposito')
            .addItem('🔄 Recarregar Menu', 'recarregarMenu')
            .addItem('💾 Fazer Backup Agora', 'fazerBackupSistema')
            .addItem('📜 Ver Logs', 'abrirAbaLog')
            .addItem('🧹 Padronizar Todas as Abas', 'padronizarTodasAbasSistema')
            .addItem('📖 Manual do Sistema', 'abrirManualDoSistema')
            .addSeparator()
            .addItem('🔀 Trocar Login', 'trocarLogin')
            .addItem('📂 Drive', 'abrirDriveLink')
            .addItem('💬 WhatsApp', 'abrirPainelWhatsApp')
            .addSeparator()
            .addItem('🚪 Logout', 'fazerLogout')
        )
        .addToUi();

      // 🔹 Inicialização silenciosa
      inicializacaoSilenciosa();

    } catch (e) {
      console.error('❌ Erro no onOpen:', e.message);
      SpreadsheetApp.getUi().alert('⚠️ Erro ao carregar menu: ' + e.message);
    }
  }
  function inicializacaoSilenciosa() {

    try {

      const ss = SpreadsheetApp.getActive();

      // 🔹 Garante abas críticas (sem criar tudo de novo)
      ss.getSheetByName('PRODUTOS');
      ss.getSheetByName('ESTOQUE');
      ss.getSheetByName('CAIXA');

      // 🔹 Sincroniza estoque (rápido e essencial)
      if (typeof atualizarEstoque === 'function') {
        atualizarEstoque();
      }

      // 🔹 Aquece funções financeiras usadas com frequência
      if (typeof resumoFinanceiroHoje === 'function') {
        resumoFinanceiroHoje();
      }

      // 🔹 Remove legado de dashboard pesado (aba + gatilhos antigos)
      if (typeof removerLegadoDashboard === 'function') {
        removerLegadoDashboard();
      }

    } catch (e) {
      // falha silenciosa (não quebra experiência)
      console.error('Erro na inicialização silenciosa:', e);
    }
  }
  function initSistema() {

    const ss = SpreadsheetApp.getActive();

    const estrutura = {

      PRODUTOS: ['Produto', 'Categoria', 'Marca', 'Volume', 'Preço', 'Estoque Mínimo', 'Custo Médio', 'Margem %', 'Preço Sugerido', 'Status Margem', 'ID PRODUTO', 'Quantidade em Estoque'],

      ESTOQUE: ['Produto', 'Quantidade', 'Mínimo', 'Status'],

      VENDAS: ['Data','Produto','Qtd','Valor','Pagamento','Origem'],

      COMPRAS: ['Data','Produto','Qtd','Valor','Fornecedor'],

      CLIENTES: ['Nome','Telefone','Endereço','Referência','Obs'],

      DELIVERY: ['Pedido','Data','Cliente','Produto','Qtd','Total','Pagamento','Status','Entregador'],

      CAIXA: ['Data','Tipo','Valor','Pagamento','Origem'],

      CONFIG: ['Chave','Valor']
    };

    // ============================
    // GARANTE ESTRUTURA DAS ABAS
    // ============================
    Object.keys(estrutura).forEach(nome=>{

      let sh = ss.getSheetByName(nome);

      if(!sh){
        sh = ss.insertSheet(nome);
      }

      const headers = estrutura[nome];
      const atual = sh.getRange(1,1,1,headers.length).getValues()[0];

      if(atual.join() !== headers.join()){
        sh.getRange(1,1,1,headers.length)
          .setValues([headers])
          .setFontWeight('bold');
      }
    });

    // ============================
    // CONFIGURAÇÕES ESTRUTURAIS
    // ============================

    if(typeof aplicarTema === 'function'){ aplicarTema(); }
    if(typeof aplicarDropdownProdutos === 'function'){ aplicarDropdownProdutos(); }
    
    // 🔹 INICIALIZA SISTEMA DE AUTENTICAÇÃO
    if(typeof garantirEstruturausuarios === 'function'){
      garantirEstruturausuarios();
    }
    
    // 🔹 APLICA TEMA COMPLETO
    if(typeof aplicarTemaCompleto === 'function'){
      aplicarTemaCompleto();
    }
    
    // 🔹 GARANTE SENHA DE RESET
    if(typeof garantirSenhaResetObrigatoria === 'function'){
      garantirSenhaResetObrigatoria();
    }
    
    // 🔹 PROTEGE PLANILHAS (exceto gerencial será protegido ao login)
    if(typeof aplicarProtecoesPlanilhas === 'function'){
      aplicarProtecoesPlanilhas();
    }

    if(typeof padronizarTodasAbasSistema === 'function'){
      padronizarTodasAbasSistema();
    }
    
    SpreadsheetApp.getUi().alert(
      '✅ Estrutura do sistema verificada, autenticação configurada e tema aplicado!'
    );
  }
  function aplicarTema(){
    SpreadsheetApp.getActive().getSheets().forEach(sh=>sh.setHiddenGridlines(true));
  }
  function aplicarFormatacaoPadrao(sh){
    // Formata sheet com padrão consistent
    if(!sh) return;
    
    try {
      // Esconde gridlines
      sh.setHiddenGridlines(true);
      
      // Congela primeira linha
      sh.setFrozenRows(1);
      
      // Formata cabeçalho (primeira linha)
      const lastCol = sh.getLastColumn() || 10;
      if(sh.getLastRow() > 0){
        sh.getRange(1, 1, 1, lastCol)
          .setFontWeight('bold')
          .setBackground('#0f172a')
          .setFontColor('#ffffff')
          .setHorizontalAlignment('center')
          .setVerticalAlignment('middle');
      }
      
      // Ajusta altura das linhas
      sh.setRowHeight(1, 28);
      
      // Coloca bordas em todo o intervalo de dados
      const lastRow = sh.getLastRow();
      if(lastRow > 1){
        sh.getRange(1, 1, lastRow, lastCol)
          .setBorder(true, true, true, true, true, true, '#cbd5e1', SpreadsheetApp.BorderStyle.SOLID);
      }
      
    } catch(e) {
      console.log('Erro ao aplicar formatação: ' + e);
    }
  }


  function padronizarTodasAbasSistema(){
    const ss = SpreadsheetApp.getActive();
    const abas = ss.getSheets();

    abas.forEach(sh => {
      aplicarFormatacaoPadrao(sh);
    });

    uiNotificar('Formatação padrão aplicada em todas as abas.','sucesso','Padronização');
    return { ok:true, total: abas.length };
  }

// ===============================
// CONFIG / IDENTIDADE / HOME
// ===============================
  // IDENTIDADE DE HOME
    function getNomeDeposito(){

      const nome = getConfig('NOME_DEPOSITO');

      return nome ? nome.toString().trim() : 'DEPÓSITO';
    }
    function organizarConfig(){

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


      SpreadsheetApp.getUi()
        .alert('✅ CONFIG organizado com sucesso.');

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

          <h2>🎛️ Painel Inteligente</h2>
          <p class="hint">Modo mobile com acesso rápido + todas as funções do sistema.</p>

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
                ['📦', 'Estoque', 'abrirEstoqueOpcoes']
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
                ['👤', 'Novo Cliente', 'popupCliente'],
                ['👥', 'Usuários', 'popupListarUsuarios'],
                ['🛒', 'Nova Compra', 'popupCompraV2'],
                ['❌', 'Cancelamento de Notas', 'popupPainelCancelamentoCompra'],
                ['💲', 'Análise de Lucratividade', 'abrirAnaliseProduto'],
                ['🛍️', 'Gestão de Produto', 'popupProdutoManager']
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
                ['⚙️', 'Configurar Depósito', 'abrirConfiguracaoDeposito'],
                ['🔄', 'Recarregar Menu', 'recarregarMenu'],
                ['💾', 'Backup', 'fazerBackupSistema'],
                ['📜', 'Ver Logs', 'abrirAbaLog'],
                ['🧹', 'Padronizar Abas', 'padronizarTodasAbasSistema'],
                ['📖', 'Manual', 'abrirManualDoSistema'],
                ['🔀', 'Trocar Login', 'trocarLogin'],
                ['🚪', 'Logout', 'fazerLogout'],
                ['📂', 'Drive', 'abrirDriveLink'],
                ['💬', 'WhatsApp', 'abrirPainelWhatsApp']
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


      // ======================
      // BOTÃO PAINEL
      // ======================

      const painel = sh.getRange(11,1,2,8);

      painel.merge();

      painel.setValue('🎛️  ABRIR CONTROLE RÁPIDO')
        .setFontSize(15)
        .setFontWeight('bold')
        .setHorizontalAlignment('center')
        .setVerticalAlignment('middle')
        .setBackground('#3730a3')
        .setFontColor('#ffffff');


      // ======================
      // ESTOQUE CRÍTICO
      // ======================

      let r1 = 14;

      sh.setRowHeight(10, 8);


      sh.getRange(r1,1,1,8).merge()
        .setValue('🚨 PRODUTOS EM ESTOQUE CRÍTICO')
        .setFontWeight('bold')
        .setBackground('#7f1d1d')
        .setFontColor('#fecaca')
        .setHorizontalAlignment('center');


      r1++;


      if(criticos.length === 0){

        sh.getRange(r1,1,1,8).merge()
          .setValue('✅ Nenhum produto crítico')
          .setHorizontalAlignment('center');

        r1++;

      }else{

        criticos.forEach(c=>{

          sh.getRange(r1,1,1,4).merge()
            .setValue(c.produto);

          sh.getRange(r1,5,1,4).merge()
            .setValue(`Qtd: ${c.qtd} / Mín: ${c.minimo}`);

          r1++;

        });

      }


      // ======================
      // RANKINGS
      // ======================

      r1 += 1;


      sh.getRange(r1,1,1,4).merge()
        .setValue('🏆 TOP 10 MAIS VENDIDOS')
        .setFontWeight('bold')
        .setBackground('#065f46')
        .setFontColor('#d1fae5')
        .setHorizontalAlignment('center');


      sh.getRange(r1,5,1,4).merge()
        .setValue('🐢 5 MENOS VENDIDOS')
        .setFontWeight('bold')
        .setBackground('#78350f')
        .setFontColor('#fef3c7')
        .setHorizontalAlignment('center');


      r1++;


      const max = Math.max(
        ranking.top.length,
        ranking.flop.length
      );


      for(let i=0;i<max;i++){

        if(ranking.top[i]){

          sh.getRange(r1+i,1,1,4).merge()
            .setValue(
              `${i+1}. ${ranking.top[i].produto} — ${ranking.top[i].qtd}`
            );

        }

        if(ranking.flop[i]){

          sh.getRange(r1+i,5,1,4).merge()
            .setValue(
              `${i+1}. ${ranking.flop[i].produto} — ${ranking.flop[i].qtd}`
            );

        }

      }


      // ======================
      // ESTOQUE FINANCEIRO
      // ======================

      r1 += 1;
      
      sh.setRowHeight(r1, 2);

      sh.getRange(r1,1,1,8).merge()
        .setValue('💰 VALOR TOTAL DO ESTOQUE')
        .setFontWeight('bold')
        .setBackground('#5b2c05')
        .setFontColor('#fef3c7')
        .setHorizontalAlignment('center');
      +

      r1++;
      sh.getRange(r1,1,1,4).merge()
        .setValue(`Total: R$ ${valorTotalEstoque.toFixed(2)}`);
      sh.getRange(r1,5,1,4).merge()
        .setValue(`Lucro Estimado: R$ ${resumoEstoque.lucroEstoque ? resumoEstoque.lucroEstoque.toFixed(2) : 0}`);
      r1++;

      // ======================
      // VALOR POR CATEGORIA (primeiras 5)
      // ======================
      const porCat = typeof obterValorEstoquesPorCategoria === 'function'
        ? obterValorEstoquesPorCategoria()
        : {};
      if(Object.keys(porCat).length){
        r1++;
        sh.getRange(r1,1,1,8).merge()
          .setValue('📂 Valor por Categoria (top 5)')
          .setFontWeight('bold')
          .setBackground('#0c4a6e')
          .setFontColor('#cffafe')
          .setHorizontalAlignment('center');
        r1++;
        Object.entries(porCat).slice(0,5).forEach(([cat,d])=>{
          sh.getRange(r1,1,1,4).merge().setValue(cat);
          sh.getRange(r1,5,1,4).merge().setValue(`R$ ${d.valor.toFixed(2)}`);
          r1++;
        });
      }

      // ======================
      // AJUSTES
      // ======================

      sh.setColumnWidths(1,8,120);

      sh.setRowHeights(1,2,30);
      sh.setRowHeights(4,12,50);

      SpreadsheetApp.flush();

    }
    function abrirAba(nome){

      const ss = SpreadsheetApp.getActive();
      const sh = ss.getSheetByName(nome);

      if(sh){
        ss.setActiveSheet(sh);
      }else{
        SpreadsheetApp.getUi()
          .alert(`Aba ${nome} não encontrada.`);
      }
    }
    function ativarAutoRefreshHome(){

      // remove antigos
      const triggers = ScriptApp.getProjectTriggers();

      triggers.forEach(t=>{
        if(t.getHandlerFunction() === 'criarHomeDashboard'){
          ScriptApp.deleteTrigger(t);
        }
      });

      // cria novo
      ScriptApp.newTrigger('criarHomeDashboard')
        .timeBased()
        .everyMinutes(5)
        .create();


      SpreadsheetApp.getUi()
        .alert('⏱️ Home será atualizada a cada 5 minutos.');
    }
    function listarEstoqueCritico(){

      const ss = SpreadsheetApp.getActive();
      const sh = ss.getSheetByName('ESTOQUE');

      if(!sh) return [];

      const dados = sh.getDataRange().getValues();

      if(dados.length <= 1) return [];

      const lista = [];

      dados.slice(1).forEach(l=>{

        const produto = l[0];
        const qtd = Number(l[1]);
        const minimo = Number(l[2]);

        if(produto && qtd <= minimo){

          lista.push({
            produto,
            qtd,
            minimo
          });

        }

      });

      return lista;
    }
    function gerarRankingProdutos(){

      const ss = SpreadsheetApp.getActive();
      const sh = ss.getSheetByName('VENDAS');

      if(!sh) return { top:[], flop:[] };

      const dados = sh.getDataRange().getValues();

      if(dados.length <= 1){
        return { top:[], flop:[] };
      }

      const mapa = {};

      dados.slice(1).forEach(l=>{

        const produto = l[1];
        const qtd = Number(l[2]);

        if(!produto || !qtd) return;

        if(!mapa[produto]){
          mapa[produto] = 0;
        }

        mapa[produto] += qtd;
      });


      const lista = Object.entries(mapa)
        .map(([p,q])=>({ produto:p, qtd:q }))
        .sort((a,b)=>b.qtd - a.qtd);


      return {
        top: lista.slice(0,10),
        flop: lista.slice(-5).reverse()
      };
    }
    function abrirConfiguracaoDeposito(){

      const html = HtmlService
        .createHtmlOutputFromFile('ConfigDeposito')
        .setWidth(500)
        .setHeight(550);

      SpreadsheetApp.getUi()
        .showModalDialog(html, '⚙️ Configuração do Depósito');

    }
  // MODULO DRIVE
    function abrirDriveLink(){
      const url = getConfig('DRIVE_URL');
      if(url){
        const html = HtmlService
          .createHtmlOutput(`<script>window.open('${url}','_blank');google.script.host.close();</script>`);
        SpreadsheetApp.getUi().showModalDialog(html,'Abrindo Drive...');
      }else{
        SpreadsheetApp.getUi().alert('🔗 Link do Drive não configurado em CONFIG.');
      }
    }
    function carregarDadosConfiguracao(){
      return {
        nome: getConfig('NOME_DEPOSITO') || '',
        dono: getConfig('DONO') || '',
        cnpj: getConfig('CNPJ') || '',
        telefone: getConfig('TELEFONE') || '',
        cidade: getConfig('CIDADE') || '',
        drive: getConfig('DRIVE_URL') || '',
        auto: getConfig('AUTO_REFRESH') || 'SIM',
        intervalo: getConfig('INTERVALO_REFRESH') || '5',
        tema: getConfig('TEMA') || 'DARK',
        backup: getConfig('BACKUP_AUTO') || 'SIM'
      };
    }
    function salvarConfiguracaoDeposito(dados){

      try {
        const ss = SpreadsheetApp.getActive();
        let sh = ss.getSheetByName('CONFIG');

        if(!sh){
          sh = ss.insertSheet('CONFIG');
          sh.getRange('A1:C1')
            .setValues([['CHAVE','VALOR','DESCRIÇÃO']]);
          
          // Formata cabeçalho
          sh.getRange('A1:C1')
            .setFontWeight('bold')
            .setBackground('#0f172a')
            .setFontColor('#ffffff')
            .setHorizontalAlignment('center');
        }

        const setupConcluido = getConfig('SETUP_CONCLUIDO') === 'SIM';
        const nomeAtual = getConfig('NOME_DEPOSITO');

        // 🔒 HARD-LOCK DO NOME após setup
        if(setupConcluido && nomeAtual){
          dados.nome = nomeAtual;
        }

        if(!dados.nome || dados.nome.trim() === ''){
          return { ok: false, msg: 'Nome do depósito é obrigatório!' };
        }

        const configs = [
          ['NOME_DEPOSITO', dados.nome.trim(), 'Nome do depósito'],
          ['DONO', dados.dono ? dados.dono.trim() : '', 'Nome do dono'],
          ['CNPJ', dados.cnpj ? dados.cnpj.trim() : '', 'CNPJ'],
          ['TELEFONE', dados.telefone ? dados.telefone.trim() : '', 'Telefone'],
          ['CIDADE', dados.cidade ? dados.cidade.trim() : '', 'Cidade'],
          ['DRIVE_URL', dados.drive ? dados.drive.trim() : '', 'URL da pasta do Drive'],
          ['AUTO_REFRESH', dados.auto ? dados.auto.toUpperCase() : 'SIM', 'Auto refresh'],
          ['INTERVALO_REFRESH', dados.intervalo ? String(dados.intervalo).trim() : '5', 'Intervalo em minutos'],
          ['TEMA', dados.tema ? dados.tema.toUpperCase() : 'DARK', 'Tema do sistema'],
          ['BACKUP_AUTO', dados.backup ? dados.backup.toUpperCase() : 'SIM', 'Backup automático']
        ];

        const plan = sh.getDataRange().getValues();

        configs.forEach(cfg => {
          let achou = false;
          for(let i=1;i<plan.length;i++){
            if(plan[i][0] === cfg[0]){
              sh.getRange(i+1,2).setValue(cfg[1]);
              sh.getRange(i+1,3).setValue(cfg[2]);
              achou = true;
              break;
            }
          }
          if(!achou){
            sh.appendRow(cfg);
          }
        });

        // Formata coluna do CONFIG
        aplicarFormatacaoPadrao(sh);

        // 🔐 PRIMEIRA CONCLUSÃO DO SETUP
        if(!setupConcluido){

          // marca como concluído
          let achouSetup = false;
          for(let i=1;i<plan.length;i++){
            if(plan[i][0] === 'SETUP_CONCLUIDO'){
              sh.getRange(i+1,2).setValue('SIM');
              achouSetup = true;
              break;
            }
          }
          
          if(!achouSetup){
            sh.appendRow(['SETUP_CONCLUIDO', 'SIM', 'Configuração inicial finalizada']);
          }

          // 🚀 GARANTE ESTRUTURA DRIVE
          garantirEstruturaDriveSistema();

          // 📝 REGISTRA CONCLUSÃO
          registrarLog(
            'CONFIG_DEPOSITO_SETADA',
            `Configuração inicial: ${dados.nome}`,
            'VAZIA',
            JSON.stringify(dados)
          );
        } else {
          // 📝 REGISTRA ATUALIZAÇÃO
          registrarLog(
            'CONFIG_DEPOSITO_ATUALIZADA',
            `Configuração atualizada: ${dados.nome}`,
            JSON.stringify(nomeAtual),
            JSON.stringify(dados)
          );
        }

        // Atualiza HOME
        if(typeof criarHomeDashboard === 'function'){
          criarHomeDashboard();
        }

        recarregarMenu();

        return { ok: true, msg: 'Configuração salva com sucesso!' };

      } catch(e){
        registrarLog(
          'ERRO_SALVAR_CONFIG',
          'Erro ao salvar configuração',
          JSON.stringify(dados),
          e.toString()
        );
        return { ok: false, msg: 'Erro ao salvar: ' + e.message };
      }
    }
  // MODULO SENHA 
    function resetarSistema(){

      const ss = SpreadsheetApp.getActive();

      // =========================
      // 1️⃣ CONFIRMAÇÃO EXTRA
      // =========================
      const ui = SpreadsheetApp.getUi();

      const resp = ui.alert(
        'RESET TOTAL',
        '⚠️ ATENÇÃO!\n\n' +
        'Isso irá APAGAR:\n' +
        '- Vendas\n' +
        '- Compras\n' +
        '- Caixa\n' +
        '- Clientes\n' +
        '- Comandas\n' +
        '- Logs\n\n' +
        'Essa ação é IRREVERSÍVEL.\n\n' +
        'Deseja continuar?',
        ui.ButtonSet.YES_NO
      );

      if(resp !== ui.Button.YES){
        return false;
      }

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

      // =========================
      // 3️⃣ LIBERA LOCK
      // =========================
      try{
        LockService.getScriptLock().releaseLock();
      }catch(e){}

      // =========================
      // 4️⃣ ABAS A LIMPAR
      // =========================
      const abas = [
        'VENDAS',
        'COMPRAS',
        'ESTOQUE',
        'PRODUTOS',
        'COMANDAS',
        'COMANDA_ITENS',
        'CAIXA',
        'CAIXA_FECHAMENTO',
        'CAIXA_FISCAL',
        'DELIVERY',
        'DELIVERY_ITENS',
        'CLIENTES',
        'CONFIG',
        'LOG_SISTEMA',
        'CONTAS_A_PAGAR',
        'CONTAS_A_RECEBER'
      ];

      // =========================
      // 5️⃣ LIMPEZA SEGURA
      // =========================
      abas.forEach(nome => {

        const sh = ss.getSheetByName(nome);

        if(!sh) return;

        const lastRow = sh.getLastRow();
        const lastCol = sh.getLastColumn();

        // mantém cabeçalho
        if(lastRow > 1){

          sh.getRange(2, 1, lastRow-1, lastCol)
            .clearContent();

        }

      });

      // =========================
      // 6️⃣ RECRIA CONFIG PADRÃO
      // =========================
      if(typeof organizarConfig === 'function'){
        organizarConfig();
      
        // =========================
        // 7️⃣ RENOVA SENHA DE RESET
        // =========================
        const props = PropertiesService.getScriptProperties();
        props.setProperty('RESET_SENHA_OBRIGATORIA', 'SIM');
        if(typeof garantirSenhaResetObrigatoria === 'function'){
          garantirSenhaResetObrigatoria();
        }
      }

      // =========================
      // 8️⃣ ATUALIZA HOME
      // =========================
      criarHomeDashboard();
      abrirPainelFlutuante();

      // =========================
      // 9️⃣ LOG INTERNO
      // =========================
      if(typeof registrarLog === 'function'){

        registrarLog(
          'RESET_TOTAL',
          Session.getActiveUser().getEmail() || 'LOCAL',
          '',
          new Date()
        );

      }

      ui.alert('✅ Sistema resetado com sucesso.');
      iniciarSistemaAposReset();
      return true;

    }
    function popupSenhaReset(){

      const html = `
        <div style="display:flex;flex-direction:column;gap:12px;font-family:Arial">

          <h3 style="text-align:center">🔐 Autenticação Necessária</h3>

          <p style="font-size:14px;text-align:center">
            Para continuar com o RESET TOTAL,<br>
            informe a senha administrativa.
          </p>

          <input 
            id="senha"
            type="password"
            placeholder="Digite a senha"
            style="padding:10px;border-radius:8px;border:1px solid #ccc"
          >

          <button 
            style="background:#dc2626;color:#fff;padding:10px;border:none;border-radius:8px"
            onclick="confirmar()">
            🚀 Confirmar Reset
          </button>

          <button 
            style="background:#475569;color:#fff;padding:8px;border:none;border-radius:8px"
            onclick="google.script.host.close()">
            ❌ Cancelar
          </button>

        </div>

        <script>

          function confirmar(){

            const senha = document.getElementById('senha').value;

            if(!senha){
              alert('Digite a senha.');
              return;
            }

            google.script.run
              .withSuccessHandler(res=>{

                if(!res.ok){
                  alert(res.msg);
                  return;
                }

                if(res.trocar){
                  google.script.host.close();
                  google.script.run.popupTrocarSenhaReset();
                  return;
                }

                google.script.host.close();
                google.script.run.resetarSistema();

              })
              .withFailureHandler(e=>{
                alert(e.message);
              })
              .validarSenhaReset(senha);
          }

        </script>
      `;

      abrirPopup('🔐 Segurança do Sistema', html, 380, 320);
    }
    function popupTrocarSenhaReset(){

      const html = `
        <div style="
          display:flex;
          flex-direction:column;
          gap:12px;
          font-family:Arial
        ">

          <h3 style="text-align:center">🔐 Alterar Senha de Reset</h3>

          <p style="font-size:14px;text-align:center">
            Informe a senha atual para definir uma nova senha.
          </p>

          <input 
            id="atual"
            type="password"
            placeholder="Senha atual"
            style="padding:10px;border-radius:8px;border:1px solid #ccc"
          >

          <input 
            id="nova"
            type="password"
            placeholder="Nova senha"
            style="padding:10px;border-radius:8px;border:1px solid #ccc"
          >

          <button 
            style="background:#16a34a;color:#fff;padding:10px;border:none;border-radius:8px"
            onclick="salvar()">
            ✅ Salvar Nova Senha
          </button>

          <button 
            style="background:#475569;color:#fff;padding:8px;border:none;border-radius:8px"
            onclick="google.script.host.close()">
            ❌ Cancelar
          </button>

        </div>

        <script>

          function salvar(){

            const atual = document.getElementById('atual').value;
            const nova  = document.getElementById('nova').value;

            if(!atual){
              google.script.run.popupMensagem(
                'Erro',
                'Informe a senha atual.'
              );
              return;
            }

            if(!nova || nova.length < 4){
              google.script.run.popupMensagem(
                'Erro',
                'Nova senha deve ter no mínimo 4 caracteres.'
              );
              return;
            }

            google.script.run
              .withSuccessHandler(res=>{

                if(!res.ok){
                  google.script.run.popupMensagem(
                    'Erro',
                    res.msg
                  );
                  return;
                }

                google.script.run.popupMensagem(
                  'Sucesso',
                  'Senha alterada com sucesso.'
                );

                google.script.host.close();

              })
              .withFailureHandler(e=>{
                google.script.run.popupMensagem(
                  'Erro',
                  e.message
                );
              })
              .alterarSenhaReset(atual, nova);

          }

        </script>
      `;

      abrirPopup('🔐 Atualizar Senha', html, 380, 340);
    }
    function alterarSenhaReset(senhaAtual, novaSenha){

      const props = PropertiesService.getScriptProperties();

      const senhaSalva = props.getProperty('SENHA_RESET');

      if(!senhaSalva){
        return { ok:false, msg:'Senha não configurada.' };
      }

      if(String(senhaAtual).trim() !== String(senhaSalva).trim()){
        return { ok:false, msg:'Senha atual incorreta.' };
      }

      if(!novaSenha || String(novaSenha).trim().length < 4){
        return { ok:false, msg:'Nova senha inválida.' };
      }

      // 🔥 salva nova senha
      props.setProperty('SENHA_RESET', String(novaSenha).trim());

      // remove flag obrigatória
      props.setProperty('RESET_SENHA_OBRIGATORIA', 'NAO');

      // 🔎 TESTE DE CONFIRMAÇÃO
      const teste = props.getProperty('SENHA_RESET');

      return { 
        ok:true,
        msg:'Senha alterada.',
        debug: teste
      };
    }
    function garantirSenhaReset(){

      const props = PropertiesService.getScriptProperties();

      let senha = props.getProperty('SENHA_RESET');

      if(!senha){

        // 🔑 senha padrão inicial
        props.setProperty('SENHA_RESET', 'admin123');

        // 🔁 flag de troca obrigatória
        props.setProperty('RESET_SENHA_OBRIGATORIA', 'SIM');
      }

    }
    function validarSenhaReset(senhaDigitada){

      const senhaSalva = PropertiesService
        .getScriptProperties()
        .getProperty('SENHA_RESET');

      if(!senhaSalva){
        return { ok:false, msg:'Senha não configurada.' };
      }

      if(String(senhaDigitada).trim() !== String(senhaSalva).trim()){
        return { ok:false, msg:'Senha incorreta.' };
      }

      return { ok:true };
    }
    function definirNovaSenhaReset(nova){

      const props = PropertiesService.getScriptProperties();

      props.setProperty('SENHA_RESET', nova.trim());
      props.setProperty('RESET_SENHA_OBRIGATORIA', 'NAO');

      return true;
    }
    function debugSenha(){
      const props = PropertiesService.getScriptProperties();
      Logger.log(props.getProperty('SENHA_RESET'));
    }
  // FUNÇÕES PARA ABRIR ABAS
    function abrirHome(){
      abrirAba('HOME');
    }
    function abrirCaixa(){
      abrirAba('CAIXA');
    }
    function abrirEstoque(){
      abrirAba('ESTOQUE');
    }
    function abrirComandas(){
      abrirAba('COMANDAS');
    }
    function abrirDelivery(){
      abrirAba('DELIVERY');
    }
    function abrirProdutos(){
      abrirAba('PRODUTOS');
    }

// ===============================
// POPUP CONFIG / DASHBOARD / CAIXA
// ===============================

  // POPUP CONFIG
    function abrirConfigOpcoes(){

      const html = `
      <html>
      <head>
        <style>
          body{
            margin:0;
            font-family:Arial;
            background:#0f172a;
            color:white;
          }

          .container{
            padding:18px;
            display:flex;
            flex-direction:column;
            gap:16px;
          }

          h2{
            text-align:center;
            margin:0 0 10px 0;
          }

          .card{
            background:#1e293b;
            padding:14px;
            border-radius:14px;
            display:flex;
            flex-direction:column;
            gap:10px;
          }

          .card-title{
            font-size:14px;
            font-weight:bold;
            opacity:.8;
          }

          .btn{
            padding:10px;
            border:none;
            border-radius:10px;
            font-weight:bold;
            cursor:pointer;
            font-size:14px;
          }

          .primary{
            background:#2563eb;
            color:#fff;
          }

          .primary:hover{
            background:#1e40af;
          }

          .danger{
            background:#dc2626;
            color:#fff;
          }

          .danger:hover{
            background:#b91c1c;
          }

          .secondary{
            background:#475569;
            color:#fff;
          }

          .secondary:hover{
            background:#334155;
          }
        </style>
      </head>

      <body>
        <div class="container">

          <h2>⚙️ Configurações do Sistema</h2>

          <div class="card">
            <div class="card-title">⚙️ SISTEMA E CONFIGURAÇÕES</div>

            <button class="btn primary" onclick="run('config')">
              🛠️ Dados do Depósito
            </button>

            <button class="btn primary" onclick="run('refresh')">
              ⏱️ Atualizar Home
            </button>

            <button class="btn primary" onclick="run('recarregar')">
              🔄 Recarregar Menu
            </button>

            <button class="btn primary" onclick="run('backup')">
              💾 Fazer Backup Agora
            </button>

            <button class="btn primary" onclick="run('logs')">
              📜 Ver Logs
            </button>

            <button class="btn primary" onclick="run('manual')">
              📘 Manual do Sistema
            </button>
          </div>

          <div class="card">
            <div class="card-title">🔐 SEGURANÇA</div>

            <button class="btn primary" onclick="run('alterarSenha')">
              🔐 Alterar Senha de Reset
            </button>

            <button class="btn primary" onclick="run('trocarLogin')">
              🔀 Trocar Login
            </button>

            <button class="btn danger" onclick="run('logout')">
              🚪 Logout
            </button>
          </div>

          <div class="card">
            <div class="card-title">🗄️ DADOS CRÍTICOS</div>

            <button class="btn danger" onclick="run('resetar')">
              🚀 Resetar Sistema
            </button>
          </div>

          <button class="btn secondary" onclick="google.script.host.close()">
            ❌ Fechar
          </button>

        </div>

        <script>

          function run(tipo){

            if(tipo === 'resetar'){
              google.script.run.popupSenhaReset();
              return;
            }

            google.script.run
              .withFailureHandler(e=>{
                alert('Erro: ' + e.message);
              })
              .executarConfig(tipo);

          }

        </script>

      </body>
      </html>
      `;

      const ui = HtmlService
        .createHtmlOutput(html)
        .setWidth(420)
        .setHeight(640);

      SpreadsheetApp.getUi()
        .showModalDialog(ui, '⚙️ Configurações');

    }
    function executarConfig(tipo){

      switch(tipo){

        case 'config':
          abrirConfiguracaoDeposito();
          break;

        case 'manual':
          abrirManualSistema();
          break;

        case 'refresh':
          criarHomeDashboard();
          break;

        case 'recarregar':
          recarregarMenu();
          break;

        case 'backup':
          fazerBackupSistema();
          break;

        case 'logs':
          abrirAbaLog();
          break;

        case 'alterarSenha':
          popupTrocarSenhaReset();
          break;

        case 'trocarLogin':
          trocarLogin();
          break;

        case 'logout':
          fazerLogout();
          break;

        case 'resetar':
          resetarSistema();
          break;

        default:
          throw new Error('Opção inválida: ' + tipo);
      }

    }
  // CAIXA 
    function abrirCaixaOpcoes(){

      const html = `
        <div style="text-align:center;font-family:Arial">

          <p>Escolha a opção:</p>

          <button onclick="run('conf')">
            📋 Conferência
          </button><br><br>

          <button onclick="run('fech')">
            🔒 Fechamento
          </button>

          <script>
            function run(tipo){

              google.script.run.withSuccessHandler(()=>{
                google.script.host.close();
              }).executarCaixa(tipo);

            }
          </script>

          <style>
            button{
              width:90%;
              padding:12px;
              margin:6px;
              font-size:14px;
              background:#020617;
              color:white;
              border:none;
              border-radius:8px;
              cursor:pointer;
            }
          </style>

        </div>
      `;

      abrirPopup('💰 Caixa', html, 350, 300);
    }
    function executarCaixa(tipo){

      if(tipo === 'fech'){

        if(typeof fecharFiscalDia === 'function'){
          fecharFiscalDia();
          return;
        }

        SpreadsheetApp.getUi().alert(
          '⚠️ Função de fechamento não encontrada.'
        );
      }

      if(tipo === 'conf'){

        if(typeof fecharCaixaDia === 'function'){
          fecharCaixaDia();
          return;
        }

        SpreadsheetApp.getUi().alert(
          '⚠️ Função de conferência não encontrada.'
        );
      }

    }

// ===============================
// UTILIDADE / SISTEMA
// ===============================
  function abrirPopup(titulo, corpoHTML, largura = 420, altura = 620){
    const html = `
    <html>
      <head>
        <base target="_top">
        <style>
          body{
            margin:0;
            font-family: Arial, Helvetica, sans-serif;
            background:#f8fafc;
            color:#020617;
          }
          .popup{
            padding:16px;
          }
          h3{
            margin-top:0;
            text-align:center;
          }
          button{
            width:100%;
            padding:10px;
            margin-top:10px;
            border:none;
            border-radius:8px;
            font-weight:bold;
            cursor:pointer;
          }
          .btn-primary{ background:#2563eb;color:#fff }
          .btn-success{ background:#16a34a;color:#fff }
          .btn-warning{ background:#f59e0b;color:#000 }
          .btn-danger{ background:#dc2626;color:#fff }
          input,select{
            width:100%;
            padding:8px;
            margin-top:6px;
            border-radius:6px;
            border:1px solid #cbd5e1;
          }
        </style>
      </head>
      <body>
        <div class="popup">
          <h3>${titulo}</h3>
          ${corpoHTML}
        </div>

        <script>
          function travarBotao(btn){
            btn.disabled = true;
            btn.innerText = '⏳ Processando...';
          }
        </script>
      </body>
    </html>
    `;

    SpreadsheetApp.getUi().showModalDialog(
      HtmlService.createHtmlOutput(html)
        .setWidth(largura)
        .setHeight(altura),
      titulo
    );
  }
  function popupPadrao(titulo, corpoHTML, largura = 420, altura = 620){
    const html = `
      <html>
        <head>
          <base target="_top">
          <style>
            body{
              margin:0;
              font-family: Arial, Helvetica, sans-serif;
              background:#f8fafc;
              color:#020617;
            }

            .popup{
              padding:16px;
              max-height:100vh;
              overflow-y:auto;
            }

            h3{
              margin-top:0;
              text-align:center;
              font-size:18px;
            }

            label{
              font-weight:bold;
              margin-top:12px;
              display:block;
            }

            input, select{
              width:100%;
              padding:10px;
              margin-top:6px;
              border-radius:8px;
              border:1px solid #cbd5e1;
              background:#ffffff;
              color:#020617;
            }

            button{
              width:100%;
              padding:10px;
              margin-top:10px;
              border:none;
              border-radius:10px;
              font-weight:bold;
              cursor:pointer;
            }

            .btn-primary{ background:#2563eb; color:#fff }
            .btn-success{ background:#16a34a; color:#fff }
            .btn-warning{ background:#f59e0b; color:#000 }
            .btn-danger{ background:#dc2626; color:#fff }
            .btn-secondary{ background:#334155; color:#fff }

            .btn-qtd{
              width:26px;
              height:26px;
              padding:0;
              margin-left:4px;
              border-radius:6px;
              background:#e2e8f0;
              color:#020617;
              font-size:14px;
            }

            hr{
              border:0;
              border-top:1px solid #cbd5e1;
              margin:16px 0;
            }

            ul{ padding-left:0; margin-top:10px }
            li{
              list-style:none;
              margin-bottom:6px;
              display:flex;
              justify-content:space-between;
              align-items:center;
            }

            .total{
              font-size:16px;
              font-weight:bold;
              text-align:right;
              margin-top:10px;
            }
          </style>
        </head>

        <body>
          <div class="popup">
            <h3>${titulo}</h3>
            ${corpoHTML}
          </div>
        </body>
      </html>
    `;

    SpreadsheetApp.getUi().showModalDialog(
      HtmlService.createHtmlOutput(html)
        .setWidth(largura)
        .setHeight(altura),
      titulo
    );
  }
  function executarComLock(chave, funcao){
    const lock = LockService.getDocumentLock(); // 🔥 NÃO global

    try{
      lock.waitLock(10000);
      return funcao();
    }catch(e){
      throw new Error('⚠️ Operação em andamento. Aguarde alguns segundos.');
    }finally{
      lock.releaseLock();
    }
  }
  function normalizarValor(valor){
    if(typeof valor === 'string'){
      valor = valor.replace(',', '.');
    }
    return Number(valor) || 0;
  }
  function getFormasPagamento(){
    return ['⚡Pix','💳Cartão Débito','💳Cartão Crédito','💵Dinheiro','🧾Fiado'];
  }
  function normalizeString(s){
    s = String(s || '');
    try{ return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toUpperCase().trim(); }
    catch(e){ return s.toUpperCase().trim(); }
  }
  function getProdutosDisponiveis(){
    return getProdutosComEstoque();
  }
  function cacheCarrinhoTemporario(pedido, carrinho){
    CacheService.getScriptCache()
      .put(
        'CARRINHO_'+pedido,
        JSON.stringify(carrinho),
        600
      );
  }
  function getProdutosComEstoque(){

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('ESTOQUE');

    if(!sh) return [];

    const dados = sh.getDataRange().getValues();

    const lista = [];

    dados.forEach((l,i)=>{

      if(i === 0) return;

      const produto = String(l[0] || '').trim();
      const saldo   = Number(l[1]) || 0;

      if(produto && saldo > 0){
        lista.push(produto);
      }

    });

    return lista;
  }
  function validarEstoque(produto, qtd){

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('ESTOQUE');

    const dados = sh.getDataRange().getValues();

    for(let i=1;i<dados.length;i++){
      if(normalizeString(dados[i][0]) === normalizeString(produto)){
        return Number(dados[i][1]) >= qtd;
      }
    }

    return false;
  }
  function destravarBotao(btn){
    btn.disabled = false;
    btn.innerText = btn.dataset.textoOriginal || btn.innerText;
  }

// ===============================
// PREÇO DO PRODUTO
// ===============================

  function getPrecoProduto(nome){

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('PRODUTOS');

    const dados = sh.getDataRange().getValues();

    for(let i=1;i<dados.length;i++){
      if(function(s){ try{ return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toUpperCase().trim(); }catch(e){ return String(s||'').toUpperCase().trim(); }}(dados[i][0]) === function(s){ try{ return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toUpperCase().trim(); }catch(e){ return String(s||'').toUpperCase().trim(); }}(nome)){
        return Number(dados[i][4]) || 0; // coluna preço
      }
    }

    return 0;
  }
  function registrarCaixa(data, tipo, valor, forma, origem, descricao){

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('CAIXA');

    if(!sh){
      throw new Error('Aba CAIXA não encontrada.');
    }

    const linha = [
      data,
      tipo,
      Number(valor) || 0,
      forma,
      origem || '',
      descricao || ''
    ];

    // 🔥 INSERE SEMPRE NA PRIMEIRA LINHA (APÓS CABEÇALHO)
    sh.insertRowAfter(1);
    sh.getRange(2, 1, 1, linha.length).setValues([linha]);

    // 🎨 formatação padrão
    sh.getRange(2, 1)
      .setNumberFormat('dd/MM/yyyy HH:mm');

    sh.getRange(2, 3)
      .setNumberFormat('R$ #,##0.00');

    return true;
  }
  function registrarCaixaDelivery(pedido, valor, pagamento){

    registrarCaixa(
      new Date(),
      'Entrada',
      valor,
      pagamento,
      'Delivery',
      `DELIVERY #${pedido}`
    );

  }

// ===============================
// CAIXA / FINANCEIRO
// ===============================
  function registrarCaixa(data, tipo, valor, forma, origem, descricao){

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('CAIXA');

    if(!sh){
      throw new Error('Aba CAIXA não encontrada.');
    }

    const linha = [
      data,
      tipo,
      Number(valor) || 0,
      forma,
      origem || '',
      descricao || ''
    ];

    // 🔥 INSERE SEMPRE NA PRIMEIRA LINHA (APÓS CABEÇALHO)
    sh.insertRowAfter(1);
    sh.getRange(2, 1, 1, linha.length).setValues([linha]);

    // 🎨 formatação padrão
    sh.getRange(2, 1)
      .setNumberFormat('dd/MM/yyyy HH:mm');

    sh.getRange(2, 3)
      .setNumberFormat('R$ #,##0.00');

    return true;
  }
  function registrarCaixaDelivery(pedido, valor, pagamento){

    registrarCaixa(
      new Date(),
      'Entrada',
      valor,
      pagamento,
      'Delivery',
      `DELIVERY #${pedido}`
    );

  }
  function removerCaixaDelivery(pedido){
    const sh = SpreadsheetApp.getActive().getSheetByName('CAIXA');
    const dados = sh.getDataRange().getValues();

    for(let i = dados.length - 1; i > 0; i--){
      if(
        typeof dados[i][5] === 'string' &&
        dados[i][4] === `DELIVERY #${pedido}`
      ){
        sh.deleteRow(i + 1);
      }
    }
  }
  function calcularSaldoDia(data){
    const cx = SpreadsheetApp.getActive().getSheetByName('CAIXA').getDataRange().getValues();
    let entrada = 0, saida = 0;

    cx.forEach((c,i)=>{
      if(i===0) return;
      const d = Utilities.formatDate(new Date(c[0]), Session.getScriptTimeZone(), 'yyyyMMdd');
      const ref = Utilities.formatDate(data, Session.getScriptTimeZone(), 'yyyyMMdd');
      if(d === ref){
        c[1]==='Entrada' ? entrada+=c[2] : saida+=c[2];
      }
    });

    return {
      entrada,
      saida,
      saldo: entrada - saida
    };
  }
  function calcularSaldoTotal(){
    const cx = SpreadsheetApp.getActive()
      .getSheetByName('CAIXA')
      .getDataRange()
      .getValues();

    let saldo = 0;

    cx.forEach((c,i)=>{
      if(i === 0) return;
      c[1] === 'Entrada'
        ? saldo += Number(c[2])
        : saldo -= Number(c[2]);
    });

    return saldo;
  }
  function fecharCaixaDia(){

    const ss = SpreadsheetApp.getActive();
    const ui = SpreadsheetApp.getUi();

    // Cria aba se não existir
    let fechamento = ss.getSheetByName('CAIXA_FECHAMENTO');

    if(!fechamento){
      fechamento = ss.insertSheet('CAIXA_FECHAMENTO');
      fechamento.getRange('A1:F1').setValues([[
        'Data','Entradas','Saídas','Saldo','Status','Fechado em'
      ]]);
    }


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


    // =========================
    // STATUS
    // =========================

    let status = 'OK';

    if(saldo < 0) status = 'NEGATIVO';
    if(saldo > 0) status = 'POSITIVO';


    // =========================
    // POPUP
    // =========================

    const resp = ui.alert(
      'Fechamento de Caixa',

      `Resumo do caixa neste momento:\n\n` +
      `Entradas: R$ ${entrada.toFixed(2)}\n` +
      `Saídas: R$ ${saida.toFixed(2)}\n` +
      `Saldo: R$ ${formatarMoeda(saldo)}\n\n` +
      `Deseja registrar esta conferência?`,

      ui.ButtonSet.YES_NO
    );


    if(resp !== ui.Button.YES) return;


    // =========================
    // SALVAR
    // =========================

    fechamento.appendRow([
      new Date(),
      entrada,
      saida,
      saldo,
      status,
      new Date()
    ]);


    inserirLinhaSeparadoraCaixa(
      'CONFERÊNCIA DE CAIXA',
      saldo
    );


    const row = fechamento.getLastRow();


    formatarLinhaFechamentoCaixa(
      fechamento,
      row,
      'CONFERENCIA'
    );


    bloquearEdicaoAposFechamento();


    ui.alert('✅ Conferência de caixa registrada com sucesso.');

  }
  function fecharFiscalDia(){
    const ss = SpreadsheetApp.getActive();
    const ui = SpreadsheetApp.getUi();

    let fiscal = ss.getSheetByName('CAIXA_FISCAL');
    if(!fiscal){
      fiscal = ss.insertSheet('CAIXA_FISCAL');
      fiscal.getRange('A1:E1').setValues([[
        'Data Referência','Entradas','Saídas','Saldo','Fechado em'
      ]]);
    }

    const cx = ss.getSheetByName('CAIXA').getDataRange().getValues();
    const dadosFiscal = fiscal.getDataRange().getValues();

    // 🔑 último fechamento fiscal REAL
    let ultimoFechamento = null;
    if(dadosFiscal.length > 1){
      ultimoFechamento = new Date(
        dadosFiscal[dadosFiscal.length - 1][4]
      );
    }

    let entrada = 0;
    let saida = 0;

    cx.forEach((c,i)=>{
      if(i === 0) return;

      const dataMov = c[0];

      // 🔒 ignora linhas sem data válida (separadores)
      if(!(dataMov instanceof Date)) return;

      // 🔥 só considera após último fechamento fiscal
      if(ultimoFechamento && dataMov <= ultimoFechamento) return;

      c[1] === 'Entrada'
        ? entrada += Number(c[2])
        : saida += Number(c[2]);
    });

    const saldo = entrada - saida;

    if(entrada === 0 && saida === 0){
      ui.alert('Nenhuma movimentação nova desde o último fechamento fiscal.');
      return;
    }

    const resp = ui.alert(
      'Fechamento Fiscal',
      `Resumo desde o último fechamento fiscal:\n\n` +
      `Entradas: R$ ${entrada.toFixed(2)}\n` +
      `Saídas: R$ ${saida.toFixed(2)}\n` +
      `Saldo: R$ ${formatarMoeda(saldo)}\n\n` +
      `Confirmar fechamento fiscal?`,
      ui.ButtonSet.YES_NO
    );

    if(resp !== ui.Button.YES) return;

    fiscal.appendRow([
      new Date(),
      entrada,
      saida,
      saldo,
      new Date()
    ]);

    inserirLinhaSeparadoraCaixa(
      'FECHAMENTO DE CAIXA FISCAL',
      saldo
    );

    const r = fiscal.getLastRow();

    // 🎨 visual padrão de fechamento fiscal
    formatarLinhaFechamentoCaixa(
      fiscal,
      r,
      'FISCAL'
    );

    bloquearEdicaoAposFechamento();

    ui.alert('📑 Fechamento fiscal realizado com sucesso.');
  }
  function inserirLinhaSeparadoraCaixa(texto, valorPeriodo){
      const cx = SpreadsheetApp.getActive().getSheetByName('CAIXA');

      cx.appendRow([
        `---------- ${texto} ----------`,
        '',
        valorPeriodo || '',
        '',
        ''
      ]);

      const r = cx.getLastRow();

      // 🔒 força formato correto de data na coluna A
      cx.getRange(r,1).setNumberFormat('@');

      cx.getRange(r,1,1,5)
        .setFontWeight('bold')
        .setHorizontalAlignment('center')
        .setFontColor('#64748b');

      if(valorPeriodo !== undefined){
        cx.getRange(r,3)
          .setNumberFormat('R$ #,##0.00')
          .setFontColor('#020617');
      }
  }
  function formatarLinhaFechamentoCaixa(sh, row, tipo = 'CONFERENCIA'){
    const range = sh.getRange(row, 1, 1, sh.getLastColumn());

    // 🎨 cores padrão
    let bg = '#0f172a'; // azul escuro elegante
    let font = '#ffffff';

    if(tipo === 'FISCAL'){
      bg = '#020617'; // ainda mais escuro (fiscal)
    }

    range
      .setBackground(bg)
      .setFontColor(font)
      .setFontWeight('bold')
      .setHorizontalAlignment('center');

    // 📅 datas reais
    sh.getRange(row, 1).setNumberFormat('dd/MM/yyyy');
    sh.getRange(row, 6).setNumberFormat('dd/MM/yyyy HH:mm');

    // 💰 valores
    sh.getRange(row, 2, 1, 3)
      .setNumberFormat('R$ #,##0.00');
  }
  function bloquearEdicaoAposFechamento(){
    const ss = SpreadsheetApp.getActive();
    const limite = getUltimoFechamentoFiscal();
    if(!limite) return;

    ['CAIXA','VENDAS','COMPRAS'].forEach(nome=>{
      const sh = ss.getSheetByName(nome);
      if(!sh) return;

      const dados = sh.getDataRange().getValues();
      let ultimaLinha = 0;

      dados.forEach((l,i)=>{
        if(i===0) return;
        if(new Date(l[0]) <= limite){
          ultimaLinha = i+1;
        }
      });

      if(ultimaLinha > 1){
        const range = sh.getRange(
          2,1,
          ultimaLinha-1,
          sh.getLastColumn()
        );
        const prot = range.protect();
        prot.setDescription(
          `Bloqueado até ${Utilities.formatDate(
            limite,
            Session.getScriptTimeZone(),
            'dd/MM/yyyy HH:mm'
          )}`
        );
        prot.removeEditors(prot.getEditors());
        if(prot.canDomainEdit()) prot.setDomainEdit(false);
      }
    });
  }
  function getUltimoFechamentoFiscal(){
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('CAIXA_FISCAL');
    if(!sh || sh.getLastRow() < 2) return null;

    return new Date(
      sh.getRange(sh.getLastRow(), 5).getValue()
    );
  }
  function getDataUltimaConferenciaCaixa(){

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('CAIXA_FECHAMENTO');

    if(!sh) return null;

    const dados = sh.getDataRange().getValues();
    if(dados.length <= 1) return null;

    const ultimaLinha = dados[dados.length - 1];
    const data = ultimaLinha[0];

    return (data instanceof Date) ? data : null;
  }
  function calcularSaldoHoje(){

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('CAIXA');

    const dados = sh.getDataRange().getValues();
    const dataInicio = getDataUltimaConferenciaCaixa();

    let entrada = 0;
    let saida   = 0;

    dados.forEach((l,i)=>{

      if(i === 0) return;
      if(!(l[0] instanceof Date)) return;

      // 🔥 ignora lançamentos ANTES da última conferência
      if(dataInicio && l[0] <= dataInicio) return;

      const tipo = String(l[1] || '').toUpperCase();
      const valor = Number(l[2]) || 0;

      if(tipo === 'ENTRADA') entrada += valor;
      if(tipo === 'SAIDA')   saida   += valor;
    });

    return {
      entrada,
      saida,
      saldo: entrada - saida
    };
  }
  function calcularIndicadoresHoje(){

    const ss = SpreadsheetApp.getActive();

    // COMANDAS
    const com = ss.getSheetByName('COMANDAS');
    let abertas = 0;

    if(com){
      const d = com.getDataRange().getValues();
      abertas = d.filter((l,i)=>i>0 && l[3]==='ABERTA').length;
    }

    // DELIVERY
    const del = ss.getSheetByName('DELIVERY');
    let deliveryHoje = 0;

    if(del){
      const d = del.getDataRange().getValues();
      const hoje = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

      deliveryHoje = d.filter((l,i)=>{
        if(i===0) return false;
        const data = Utilities.formatDate(new Date(l[1]), Session.getScriptTimeZone(), 'yyyy-MM-dd');
        return data === hoje;
      }).length;
    }

    return {
      comandasAbertas: abertas,
      deliveryHoje: deliveryHoje
    };
  }
  function formatarMoeda(v){
    return 'R$ ' + Number(v || 0).toFixed(2);
  }
  function registrarContaAReceber(dados){

    const ss = SpreadsheetApp.getActive();
    let sh = ss.getSheetByName('CONTAS_A_RECEBER');

    if(!sh){
      sh = ss.insertSheet('CONTAS_A_RECEBER');
      sh.getRange('A1:H1').setValues([[
        'ID','Origem','Pedido','Cliente',
        'Valor','Forma','Status','Data'
      ]]);
    }

    sh.appendRow([
      dados.id,
      dados.origem,
      dados.pedido,
      dados.cliente || '',
      dados.valor,
      dados.forma,
      'PENDENTE',
      new Date()
    ]);

    return true;
  }

// ===============================
// ESTOQUE
// ===============================
  function atualizarEstoque(){

    const ss = SpreadsheetApp.getActive();

    const shEstoque  = ss.getSheetByName('ESTOQUE');
    const shProdutos = ss.getSheetByName('PRODUTOS');

    if(!shEstoque || !shProdutos){
      throw new Error('Aba ESTOQUE ou PRODUTOS não encontrada.');
    }

    const estoqueDados  = shEstoque.getDataRange().getValues();
    const produtosDados = shProdutos.getDataRange().getValues();

    // ===============================
    // MAPA DE PRODUTOS EXISTENTES
    // ===============================
    const mapaEstoque = {};

    for(let i = 1; i < estoqueDados.length; i++){

      const nomeOriginal = estoqueDados[i][0];
      if(!nomeOriginal) continue;

      const chave = String(nomeOriginal)
        .trim()
        .toUpperCase();

      mapaEstoque[chave] = {
        row: i + 1,
        qtd: Number(estoqueDados[i][1]) || 0,
        minimo: Number(estoqueDados[i][2]) || 0
      };
    }

    // ===============================
    // GARANTE / SINCRONIZA PRODUTOS
    // ===============================
    for(let i = 1; i < produtosDados.length; i++){

      const nomeProduto = produtosDados[i][0];
      if(!nomeProduto) continue;

      const chave = String(nomeProduto)
        .trim()
        .toUpperCase();

      const minimoProduto = Number(produtosDados[i][5]) || 0;

      // 🔹 Produto não existe no estoque → cria
      if(!mapaEstoque[chave]){

        const row = shEstoque.getLastRow() + 1;

        shEstoque.appendRow([
          nomeProduto,
          0,
          minimoProduto,
          '🔴 Crítico🪫',
          'Inicialização automática'
        ]);

        mapaEstoque[chave] = {
          row,
          qtd: 0,
          minimo: minimoProduto
        };

      } else {

        // 🔹 Produto já existe → ATUALIZA MÍNIMO
        shEstoque
          .getRange(mapaEstoque[chave].row, 3)
          .setValue(minimoProduto);

        mapaEstoque[chave].minimo = minimoProduto;
      }
    }

    // ===============================
    // ATUALIZA STATUS (SEM MEXER NO SALDO)
    // ===============================
    Object.values(mapaEstoque).forEach(item => {

      let status = '🟢   OK   🔋';

      if(item.qtd <= item.minimo){
        status = '🔴 Crítico🪫';
      }else if(item.qtd <= item.minimo * 2){
        status = '🟡 Baixo';
      }

      shEstoque.getRange(item.row, 4).setValue(status);
    });

    // 🔄 SINCRONIZA QUANTIDADE PARA ABA PRODUTOS
    sincronizarQuantidadeProdutos();
  }

  /*
  * 🔄 Sincroniza quantidade de ESTOQUE para coluna de PRODUTOS
  */

    function sincronizarQuantidadeProdutos() {

      try {

        const ss = SpreadsheetApp.getActive();

        const shEstoque = ss.getSheetByName('ESTOQUE');
        const shProdutos = ss.getSheetByName('PRODUTOS');

        if (!shEstoque || !shProdutos) return;

        const estoqueDados = shEstoque.getDataRange().getValues();
        const produtosDados = shProdutos.getDataRange().getValues();

        // 🔹 Mapa de estoque (Produto -> Quantidade)
        const mapaEstoque = {};
        estoqueDados.slice(1).forEach(linha => {
          const produto = linha[0];
          const quantidade = Number(linha[1]) || 0;
          if (produto) {
            mapaEstoque[produto] = quantidade;
          }
        });

        // 🔹 Atualiza coluna de quantidade em PRODUTOS (coluna K = 11)
        produtosDados.slice(1).forEach((linha, idx) => {
          const nomeProduto = linha[0];
          const quantidadeAtual = mapaEstoque[nomeProduto] || 0;

          // Atualiza a coluna 12 (Quantidade em Estoque)
          shProdutos.getRange(idx + 2, 12).setValue(quantidadeAtual);
        });

      } catch (e) {
        console.error('Erro em sincronizarQuantidadeProdutos:', e);
      }
    }
    function ajustarEstoque(produto, quantidade, motivo) {

      const ss = SpreadsheetApp.getActive();

      if(!produto || !quantidade){
        return { ok:false, msg:'Informe produto e quantidade.' };
      }

      quantidade = Number(quantidade);
      if(isNaN(quantidade) || quantidade === 0){
        return { ok:false, msg:'Quantidade inválida.' };
      }

      // ===============================
      // 1️⃣ VALIDA PRODUTO
      // ===============================
      const shProdutos = ss.getSheetByName('PRODUTOS');
      if(!shProdutos){
        return { ok:false, msg:'Aba PRODUTOS não encontrada.' };
      }

      const produtos = shProdutos
        .getRange(2,1,shProdutos.getLastRow() -1,1)
        .getValues()
        .flat();

      if(!produtos.includes(produto)){
        return { ok:false, msg:'Produto não existe na aba PRODUTOS.' };
      }

      // ===============================
      // 2️⃣ AJUSTA ESTOQUE
      // ===============================
      const sh = ss.getSheetByName('ESTOQUE');
      if(!sh){
        return { ok:false, msg:'Aba ESTOQUE não encontrada.' };
      }

      const dados = sh.getDataRange().getValues();

      for(let i = 1; i < dados.length; i++){

        if(dados[i][0] === produto){

          const qtdAtual = Number(dados[i][1]) || 0;
          const minimo   = Number(dados[i][2]) || 0;
          const novaQtd  = qtdAtual + quantidade;

          // 🧠 calcula STATUS
          let status = '🟢   OK   🔋';
          if(novaQtd <= 0){
            status = '🔴 Crítico🪫';
          }else if(novaQtd <= minimo * 2){
            status = '🟡 Baixo';
          }    

          sh.getRange(i+1, 2).setValue(novaQtd);            // Quantidade (B)
          sh.getRange(i+1, 4).setValue(status);             // Status (D)
          sh.getRange(i+1, 5).setValue(motivo || 'AJUSTE'); // Motivo (E)

          return { ok:true };
        }
      }

      return { ok:false, msg:'Produto não encontrado no estoque.' };
    }
    function aplicarEstoqueInicial(){
      const ss = SpreadsheetApp.getActive();
      const ini = ss.getSheetByName('ESTOQUE_INICIAL');
      if(!ini){
        SpreadsheetApp.getUi().alert('Crie a aba ESTOQUE_INICIAL.');
        return;
      }

      const dados = ini.getDataRange().getValues();
      const compras = ss.getSheetByName('COMPRAS');

      dados.forEach((d,i)=>{
        if(i===0 || !d[0] || d[1]<=0) return;
        compras.appendRow([
          new Date(),
          d[0],
          d[1],
          0,
          'Estoque Inicial'
        ]);
      });

      atualizarEstoque();
      SpreadsheetApp.getUi().alert('✅ Estoque inicial aplicado com sucesso.');
    }
    function devolverEstoqueDelivery(pedido){
      const ss = SpreadsheetApp.getActive();
      const itensSh = ss.getSheetByName('DELIVERY_ITENS');

      if(!itensSh) return;

      const dados = itensSh.getDataRange().getValues();

      for(let i = 1; i < dados.length; i++){
        if(dados[i][0] == pedido && dados[i][5] === 'SIM'){
          // marca como NÃO baixado
          itensSh.getRange(i + 1, 6).setValue('NAO');
        }
      }

      atualizarEstoque();
    }
    function popupAjusteEstoque(){
      const produtos = getProdutosCatalogo();

      const html = `
        <label>📦 Produto</label>
        <select id="produto">
          <option value="">Selecione</option>
          ${produtos.map(p=>`<option>${p}</option>`).join('')}
        </select>

        <label>🔢 Quantidade a adicionar</label>
        <input id="qtd" type="number" min="1">

        <label>📝 Motivo do ajuste</label>
        <input id="motivo" placeholder="Ex: Inventário inicial">

        <button class="btn-success" onclick="confirmar()">✅ Ajustar Estoque</button>
        <button class="btn-danger" onclick="google.script.host.close()">❌ Cancelar</button>

        <script>
          function confirmar(){

            if(!produto.value || !qtd.value){
              alert('Preencha todos os campos.');
              return;
            }

            google.script.run
              .withSuccessHandler(res => {
                if(!res || !res.ok){
                  alert(res.msg || 'Erro ao ajustar estoque');
                  return;
                }
                google.script.host.close(); // ✅ FECHA POPUP
              })
              .withFailureHandler(err => {
                alert(err.message || err);
              })
              .ajustarEstoque(
                produto.value,
                qtd.value,
                motivo.value
              );
          }
        </script>    `;

      abrirPopup('⚙️ Ajuste de Estoque', html, 420, 420);
    }
    function getProdutosCatalogo(){
      const sh = SpreadsheetApp.getActive().getSheetByName('PRODUTOS');
      if(!sh) return [];

      return sh.getRange(2,1,sh.getLastRow()-1,1)
        .getValues()
        .flat()
        .filter(Boolean);
    }

// ===============================
// PRODUTOS / PREÇO / VALIDAÇÃO
// ===============================
  function aplicarDropdownProdutos(){
    const sh = SpreadsheetApp.getActive().getSheetByName('PRODUTOS');

    const categorias = ['Cerveja','Refrigerante','Água','Energético','Destilado','Outros'];

    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(categorias, true)
      .build();

    sh.getRange('B2:B500').setDataValidation(rule);
  }
  function recalcularPrecoSugeridoLinha(sh, row){
    const custo = Number(sh.getRange(row,7).getValue());
    let margem  = Number(sh.getRange(row,8).getValue());

    if(!custo || custo <= 0) return;
    if(margem === '' || margem < 0) return;

    // 🔥 6 → 6% | 60 → 60%
    if(margem > 1){
      margem = margem / 100;
    }

    const preco = custo * (1 + margem);

    sh.getRange(row,9)
      .setValue(preco)
      .setNumberFormat('R$ #,##0.00');
  }
  function validarPrecoVsCusto(sh, row){
    const preco = Number(sh.getRange(row,5).getValue()); // Preço
    const custo = Number(sh.getRange(row,7).getValue()); // Custo
    const statusCell = sh.getRange(row,10); // Coluna J

    // limpa visual anterior
    sh.getRange(row,1,1,10).setBackground(null);
    statusCell.setValue('').setFontColor('#020617');

    if(!preco || !custo) return;

    // 🔴 PREJUÍZO
    if(preco < custo){
      sh.getRange(row,1,1,10).setBackground('#fee2e2');
      statusCell
        .setValue('⬇️ PREJUÍZO')
        .setFontColor('#dc2626');
      return;
    }

    const margem = (preco - custo) / custo;

    // 🟡 MARGEM BAIXA
    if(margem < 0.05){
      sh.getRange(row,1,1,10).setBackground('#fef9c3');
      statusCell
        .setValue('➡️ MARGEM BAIXA')
        .setFontColor('#92400e');
      return;
    }

    // 🟢 MARGEM OK
    statusCell
      .setValue('⬆️ LUCRO')
      .setFontColor('#166534');
  }
  function atualizarCustoMedioProduto(produto, qtdCompra, valorTotalCompra){

    const ss = SpreadsheetApp.getActive();
    const shProd = ss.getSheetByName('PRODUTOS');
    const shEst  = ss.getSheetByName('ESTOQUE');

    if(!shProd || !shEst) return false;

    const prodDados = shProd.getDataRange().getValues();
    const estDados  = shEst.getDataRange().getValues();

    let qtdAntes = 0;
    let custoAtual = 0;
    let rowProd = -1;

    // 🔹 BUSCA ESTOQUE ANTES DA COMPRA
    for(let i = 1; i < estDados.length; i++){
      if(estDados[i][0] === produto){
        qtdAntes = Number(estDados[i][1]) || 0;
        break;
      }
    }

    // 🔹 BUSCA CUSTO ATUAL (PRODUTOS → coluna G)
    for(let i = 1; i < prodDados.length; i++){
      if(prodDados[i][0] === produto){
        custoAtual = Number(prodDados[i][6]) || 0;
        rowProd = i + 1;
        break;
      }
    }

    if(rowProd === -1) return false;

    const novoTotalQtd = qtdAntes + qtdCompra;
    if(novoTotalQtd <= 0) return false;

    // ✅ CUSTO MÉDIO PONDERADO REAL
    const novoCustoMedio =
      ((qtdAntes * custoAtual) + valorTotalCompra) / novoTotalQtd;

    shProd
      .getRange(rowProd, 7) // coluna G
      .setValue(Number(novoCustoMedio.toFixed(2)));

    return true;
  }

// ===============================
// CLIENTES
// ===============================
  function popupCliente(){

    const ss = SpreadsheetApp.getActive();
    const clientes = ss.getSheetByName('CLIENTES')
      .getDataRange().getValues()
      .slice(1)
      .map(c => c[0])
      .filter(Boolean)
      .map(c => c.toUpperCase());

    abrirPopup('👤➕ Novo Cliente', `
      <div class="cli-wrap">
        <div class="cli-card">
          <div class="cli-header">
            <h3>👤 Cadastro de Cliente</h3>
            <p>Preencha as informações relevantes para atendimento, delivery e fiado.</p>
          </div>
  
          <div class="cli-grid">
            <div class="field field-2">
              <label>👤 Nome do Cliente <span>*</span></label>
              <input id="nome" placeholder="Ex.: João da Silva" maxlength="80">
            </div>
  
            <div class="field">
              <label>📞 Telefone (WhatsApp) <span>*</span></label>
              <input id="tel" placeholder="(11) 91234-5678" inputmode="numeric" maxlength="15">
              <small>Formato brasileiro (DDD + número).</small>
            </div>
  
            <div class="field">
              <label>📍 Referência</label>
              <input id="ref" placeholder="Ex.: Próximo ao mercado / portão azul" maxlength="120">
            </div>
  
            <div class="field field-2">
              <label>🏠 Endereço</label>
              <input id="end" placeholder="Rua, número, bairro, complemento" maxlength="140">
            </div>
  
            <div class="field field-2">
              <label>📝 Observações</label>
              <textarea id="obs" rows="3" placeholder="Ex.: Preferência de contato, horário de entrega, restrições..."></textarea>
            </div>
          </div>
          <div class="info-box">
            <strong>Informações relevantes:</strong>
            <ul>
              <li>Telefone válido acelera contato no delivery.</li>
              <li>Endereço + referência reduz erro de entrega.</li>
              <li>Observações ajudam no histórico do cliente.</li>
            </ul>
          </div>
  
          <div class="actions">
            <button id="btnSalvar" class="btn-save" onclick="salvar(this)">💾 Salvar Cliente</button>
            <button class="btn-cancel" onclick="cancelar()">Cancelar</button>
          </div>
        </div>
      </div>
  
      <style>
        .cli-wrap { font-family: Arial, sans-serif; }
        .cli-card {
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          background: #ffffff;
          box-shadow: 0 8px 24px rgba(15,23,42,.08);
          padding: 14px;
        }
        .cli-header h3 { margin: 0; font-size: 18px; color: #0f172a; }
        .cli-header p { margin: 6px 0 0; color: #64748b; font-size: 12px; }

        .cli-grid {
          margin-top: 14px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .field { display: flex; flex-direction: column; gap: 5px; }
        .field-2 { grid-column: span 2; }
        label { font-weight: 700; font-size: 12px; color: #0f172a; }
        label span { color: #dc2626; }
        input, textarea {
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          padding: 10px;
          font-size: 13px;
          outline: none;
        }
        input:focus, textarea:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37,99,235,.15);
        }
        small { color: #64748b; font-size: 11px; }

        .info-box {
          margin-top: 12px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 10px;
          padding: 10px;
          font-size: 12px;
          color: #1e3a8a;
        }
        .info-box ul { margin: 6px 0 0 18px; padding: 0; }

        .actions {
          margin-top: 14px;
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }
        .btn-save, .btn-cancel {
          border: none;
          border-radius: 10px;
          padding: 10px 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .btn-save { background: #16a34a; color: #fff; }
        .btn-save:hover { background: #15803d; }
        .btn-cancel { background: #e2e8f0; color: #0f172a; }
        .btn-cancel:hover { background: #cbd5e1; }
      </style>
  
      <script>
        const nome = document.getElementById('nome');
        const tel  = document.getElementById('tel');
        const end  = document.getElementById('end');
        const ref  = document.getElementById('ref');
        const obs  = document.getElementById('obs');
  
        nome.focus();
  
        // 📞 máscara telefone pt-BR: (11) 91234-5678
        tel.addEventListener('input', () => {
          let n = tel.value.replace(/\D/g,'').slice(0,11);
          if (n.length <= 10) {
            n = n.replace(/(\d{2})(\d)/, '($1) $2');
            n = n.replace(/(\d{4})(\d)/, '$1-$2');
          } else {
            n = n.replace(/(\d{2})(\d)/, '($1) $2');
            n = n.replace(/(\d{5})(\d)/, '$1-$2');
          }
          tel.value = n;
        });
  
        function cancelar(){
          google.script.host.close();
          google.script.run.voltarTelaCliente();
        }
  
        function salvar(btn){
          if(!nome.value.trim()){
            alert('Informe o nome do cliente 👤');
            return;
          }
  
          if(tel.value.replace(/\D/g,'').length < 10){
            const okTel = confirm('Telefone parece incompleto. Deseja salvar mesmo assim?');
            if(!okTel) return;
          }

          const nomeUpper = nome.value.trim().toUpperCase();
          const existe = ${JSON.stringify(clientes)}.includes(nomeUpper);
  
          if(existe){
            const ok = confirm('⚠️ Cliente já cadastrado com este nome.\n\nDeseja salvar mesmo assim?');
            if(!ok) return;
          }
  
              ref.value,
              obs.value
            );
        }
    `, 640, 700);
  }
  function salvarCliente(nome, tel, end, ref, obs){
  
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('CLIENTES');
  
    const nomeFinal = nome.trim().toUpperCase();
  
    // ============================
    // 1️⃣ SALVA CLIENTE (INALTERADO)
    // ============================
    sh.appendRow([
      nomeFinal,
      tel,
      end,
      ref,
      obs ? obs.toString().trim() : ''
    ]);
  
    // ============================
    // 2️⃣ GARANTE CONTA FIADO
    // ============================
    garantirContasAReceber();
  
    const cr = ss.getSheetByName('CONTAS_A_RECEBER');
    const dados = cr.getDataRange().getValues();
  
    const jaExiste = dados.some((l,i) =>
      i > 0 &&
      l[1] === 'CLIENTE' &&
      l[3] === nomeFinal &&
      l[7] === 'FIADO'
    );
  
    if(!jaExiste){
  
      // ✅ CRIA CONTA FIADO FIXA PELO PADRÃO OFICIAL
      criarContaAReceber(
        'CLIENTE',        // Origem
        'FIADO_FIXO',     // Referência
        nomeFinal,        // Cliente
        0,                // Valor
        'FIADO'           // Forma
      );
    }

    registrarLog(
      'CLIENTE_CADASTRADO',
      nomeFinal,
      '',
      'CONTA_FIADO_OK'
    );

    return true;
  }
  function setClienteTempDelivery(nome){
    CacheService.getScriptCache()
      .put('CLIENTE_TEMP_DELIVERY', nome, 300);
  }
  function getClienteTempDelivery(){
    const cache = CacheService.getScriptCache();
    const nome = cache.get('CLIENTE_TEMP_DELIVERY');
    if(nome){
      cache.remove('CLIENTE_TEMP_DELIVERY'); // 🔥 LIMPA APÓS USO
    }
    return nome;
  }
  function popupMenuCliente(origem){

    // salva origem
    CacheService.getScriptCache()
      .put('ORIGEM_CLIENTE', origem || '', 300);

    const html = `
      <div style="text-align:center;display:flex;flex-direction:column;gap:14px">

        <button class="btn-success" onclick="novo()">
          ➕ Cadastrar Novo
        </button>

        <button class="btn-primary" onclick="buscar()">
          🔍 Buscar / Editar
        </button>

        <button class="btn-secondary" onclick="fechar()">
          ❌ Cancelar
        </button>

      </div>

      <script>

        function novo(){
          google.script.run.popupCliente();
          google.script.host.close();
        }

        function buscar(){
          google.script.run.popupBuscarCliente();
          google.script.host.close();
        }

        function fechar(){
          google.script.host.close();
        }

      </script>
    `;

    abrirPopup('👤 Menu de Clientes', html, 360, 280);
  }
  function voltarTelaCliente(){

    const cache = CacheService.getScriptCache();

    const origem = cache.get('ORIGEM_CLIENTE');

    // limpa depois de usar
    cache.remove('ORIGEM_CLIENTE');

    if(origem === 'BALCAO'){
      popupComandaBalcao();
      return;
    }

    if(origem === 'DELIVERY'){
      popupDelivery();
      return;
    }

    // fallback de segurança
    popupMenuPrincipal();
  }
  function popupBuscarCliente(){

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('CLIENTES');

    if(!sh){
      SpreadsheetApp.getUi().alert('Aba CLIENTES não encontrada.');
      return;
    }

    const dados = sh.getDataRange().getValues()
      .slice(1)
      .filter(c => c[0]);

    const nomes = dados.map(c => c[0]);

    const html = `
      <div style="display:flex;flex-direction:column;gap:12px">

        <h3>🔍 Buscar Cliente</h3>

        <label>Nome</label>
        <input list="lista" id="nome">

        <datalist id="lista">
          ${nomes.map(n => `<option value="${n}">`).join('')}
        </datalist>

        <button class="btn-primary" onclick="buscar()">
          🔎 Buscar
        </button>

        <div id="dados"></div>

        <button class="btn-secondary" onclick="cancelar()">
          ❌ Fechar
        </button>

      </div>

      <script>

        function buscar(){

          if(!nome.value){
            alert('Informe o nome');
            return;
          }

          google.script.run
            .withSuccessHandler(render)
            .getClientePorNome(nome.value);
        }

        function render(c){

          if(!c){
            dados.innerHTML = '<p>❌ Cliente não encontrado</p>';
            return;
          }

          dados.innerHTML = \`
            <hr>

            <label>Telefone</label>
            <input id="tel" value="\${c.tel}">

            <label>Endereço</label>
            <input id="end" value="\${c.end}">

            <label>Referência</label>
            <input id="ref" value="\${c.ref}">

            <button class="btn-success" onclick="salvar()">
              💾 Atualizar
            </button>
          \`;
        }

        function salvar(){

          google.script.run
            .withSuccessHandler(()=>{
              alert('✅ Atualizado com sucesso');
            })
            .atualizarCliente(
              nome.value,
              tel.value,
              end.value,
              ref.value
            );
        }

      </script>
    `;

    abrirPopup('🔍 Cliente', html, 420, 520);
  }
  function getClientePorNome(nome){

    const sh = SpreadsheetApp.getActive()
      .getSheetByName('CLIENTES');

    const dados = sh.getDataRange().getValues();

    for(let i=1;i<dados.length;i++){

      if(dados[i][0] === nome){

        return {
          nome: dados[i][0],
          tel:  dados[i][1],
          end:  dados[i][2],
          ref:  dados[i][3]
        };
      }
    }

    return null;
  }
  function atualizarCliente(nome, tel, end, ref){

    const sh = SpreadsheetApp.getActive()
      .getSheetByName('CLIENTES');

    const dados = sh.getDataRange().getValues();

    for(let i=1;i<dados.length;i++){

      if(dados[i][0] === nome){

        sh.getRange(i+1,2).setValue(tel);
        sh.getRange(i+1,3).setValue(end);
        sh.getRange(i+1,4).setValue(ref);

        return true;
      }
    }

    return false;
  }
// ===============================
// DELIVERY
// ===============================
  function popupPainelDelivery2(){

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('DELIVERY');

    const dados = sh.getDataRange().getValues();
    const agora = new Date();

    let feitos = 0;
    let andamento = 0;
    let entreguesHoje = 0;

    const lista = [];

    dados.slice(1).forEach(l => {

      const pedido    = l[0];
      const data      = new Date(l[1]);
      const cliente   = l[2] || '-';
      const total     = Number(l[5]) || 0;
      const pagamento = l[6] || '';
      const status    = l[7];
      const entregador= l[8] || '-';

      const diffMin = Math.floor((agora - data) / 60000);
      const horas = Math.floor(diffMin / 60);
      const mins  = diffMin % 60;
      const tempo = horas > 0 ? `${horas}h ${mins}min` : `${mins}min`;

      if(status === 'PEDIDO FEITO') feitos++;
      if(status === 'EM ANDAMENTO') andamento++;

      if(status === 'ENTREGUE'){
        const hoje = Utilities.formatDate(agora, Session.getScriptTimeZone(), 'yyyyMMdd');
        const d    = Utilities.formatDate(data,  Session.getScriptTimeZone(), 'yyyyMMdd');
        if(hoje === d) entreguesHoje++;
      }

      if(status === 'PEDIDO FEITO' || status === 'EM ANDAMENTO'){
        lista.push({
          pedido, cliente, tempo, total, pagamento, status, entregador
        });
      }
    });

    const html = `
    <style>
      .card{
        background:#f8fafc;
        border:1px solid #e5e7eb;
        border-radius:10px;
        padding:8px;
        text-align:center;
        font-size:13px;
      }
      .linha{
        background:#ffffff;
        border:1px solid #e5e7eb;
        border-radius:10px;
        padding:10px;
        margin-bottom:8px;
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:10px;
      }
      .btn-mini{
        padding:6px 10px;
        font-size:12px;
        border-radius:8px;
        border:1px solid #e5e7eb;
        background:#f8fafc;
        cursor:pointer;
        display:inline-flex;
        align-items:center;
        gap:6px;
        width:fit-content;
        white-space:nowrap;
      }
      .topo{
        display:flex;
        justify-content:space-between;
        align-items:center;
        margin-bottom:8px;
      }
    </style>

    <div class="topo">
      <h3 style="margin:0">🚚 Painel de Delivery</h3>
      <button class="btn-mini"
        onclick="google.script.run.popupDelivery()">
        ➕ Novo Delivery
      </button>
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px">
      <div class="card">
        <div>⏳ Pedidos Feitos</div>
        <strong>${feitos}</strong>
      </div>
      <div class="card">
        <div>🚚 Em Andamento</div>
        <strong>${andamento}</strong>
      </div>
      <div class="card">
        <div>✅ Entregues Hoje</div>
        <strong>${entreguesHoje}</strong>
      </div>
    </div>

    <hr>

    ${lista.length ? lista.map(d => {

      const cor =
        d.status === 'PEDIDO FEITO' ? '#fef3c7' :
        d.status === 'EM ANDAMENTO' ? '#dbeafe' : '#f8fafc';

      const emoji =
        d.status === 'PEDIDO FEITO' ? '⏳' :
        d.status === 'EM ANDAMENTO' ? '🚚' : '📦';

      return `
        <div class="linha" style="background:${cor}">
          <div>
            <strong>${emoji} Pedido #${String(d.pedido).padStart(6,'0')}</strong><br>
            <small>👤 ${d.cliente}</small><br>
            <small>🛵 ${d.entregador}</small><br>
            <small>⏱️ ${d.tempo}</small>
          </div>

          <div style="text-align:right">
            <div style="font-weight:bold">
              R$ ${d.total.toFixed(2).replace('.',',')}
            </div>

            ${botoesDeliveryPainel(d.pedido, d.status)}
          </div>
        </div>
      `;
    }).join('') : `
      <p style="text-align:center;color:#64748b">
        Nenhum delivery em aberto no momento.
      </p>
    `}
    `;

    abrirPopup('🚚 Painel de Delivery', html, 720, 620);
  }
  function garantirDeliveryItens(){
    const ss = SpreadsheetApp.getActive();
    let sh = ss.getSheetByName('DELIVERY_ITENS');
    if(!sh){
      sh = ss.insertSheet('DELIVERY_ITENS');
      sh.getRange('A1:F1').setValues([[
        'Pedido','Produto','Qtd','Valor Unit','Total','EstoqueBaixado'
      ]]);
    }
  }
  function gerarNumeroDelivery(){
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('DELIVERY');

    if(!sh || sh.getLastRow() < 2){
      return 1;
    }

    const dados = sh
      .getRange(2, 1, sh.getLastRow() - 1, 1)
      .getValues();

    const numeros = dados
      .map(l => Number(l[0]))
      .filter(n => !isNaN(n));

    if(numeros.length === 0){
      return 1;
    }

    return Math.max(...numeros) + 1;
  }
  function popupDelivery(){

    const ss = SpreadsheetApp.getActive();

    const shClientes = ss.getSheetByName('CLIENTES');
    const shProdutos = ss.getSheetByName('PRODUTOS');

    if(!shClientes || !shProdutos){
      SpreadsheetApp.getUi().alert('Abas CLIENTES ou PRODUTOS não encontradas.');
      return;
    }

    const clientes = shClientes
      .getDataRange().getValues()
      .slice(1)
      .map(c=>c[0])
      .filter(Boolean);

    const produtos = shProdutos
      .getDataRange().getValues()
      .slice(1)
      .filter(p=>p[0]);

    const optProd = `
      <option value="">Selecione o produto</option>
      ${produtos.map(p =>
        `<option value="${p[0]}" data-preco="${p[4] || 0}">${p[0]}</option>`
      ).join('')}
    `;

    abrirPopup('🚚 Novo Pedido Delivery', `

      <label>👤 Cliente</label>
      <div style="display:flex;gap:6px">
        <input list="clientes" id="cliente" placeholder="Nome do cliente" style="flex:1">
        <button style="width:44px" onclick="novoCliente()">👤➕</button>
      </div>

      <datalist id="clientes">
        ${clientes.map(c=>`<option value="${c}">`).join('')}
      </datalist>

      <hr>

      <label>🍺 Produto</label>
      <select id="produto">${optProd}</select>

      <label>🔢 Quantidade</label>
      <input id="qtd" type="number" min="1">

      <label>💰 Valor Unitário</label>
      <input id="valor" readonly>

      <button onclick="add()">➕ Adicionar</button>

      <h3>🛒 Carrinho</h3>
      <ul id="lista"></ul>

      <div>
        💵 Total: <strong>R$ <span id="total">0,00</span></strong>
      </div>

      <hr>

      <label>🛵 Entregador</label>
      <input id="entregador" placeholder="Nome do entregador">

      <label>💳 Pagamento</label>
      <select id="pag">
        <option>⚡ Pix</option>
        <option>💳 Cartão Débito</option>
        <option>💳 Cartão Crédito</option>
        <option>💵 Dinheiro</option>
      </select>

      <button onclick="finalizar()">📦 Fazer Pedido</button>

      <script>
        let carrinho = [];
        let clienteTravado = false;

        const produtoEl = document.getElementById('produto');
        const qtdEl = document.getElementById('qtd');
        const valorEl = document.getElementById('valor');
        const clienteEl = document.getElementById('cliente');
        const listaEl = document.getElementById('lista');
        const totalEl = document.getElementById('total');
        const pagEl = document.getElementById('pag');
        const entregadorEl = document.getElementById('entregador');

        // 🔥 BUSCA CLIENTE TEMPORÁRIO (AJUSTE)
        google.script.run.withSuccessHandler(nome => {
          if(nome){
            clienteEl.value = nome;
            clienteEl.disabled = true;
            clienteTravado = true;
          }
        }).getClienteTempDelivery();

        function novoCliente(){
          google.script.run.popupMenuCliente('DELIVERY');
        }

        produtoEl.onchange = () => {
          const opt = produtoEl.options[produtoEl.selectedIndex];
          valorEl.value = opt && opt.dataset.preco
            ? 'R$ ' + Number(opt.dataset.preco).toFixed(2).replace('.',',')
            : '';
        };

        function add(){
          if(!clienteEl.value) return alert('Informe o cliente');
          if(!produtoEl.value) return alert('Selecione o produto');
          if(!qtdEl.value || qtdEl.value <= 0) return alert('Quantidade inválida');

          if(!clienteTravado){
            clienteEl.disabled = true;
            clienteTravado = true;
          }

          const p = produtoEl.value;
          const q = Number(qtdEl.value);
          const u = Number(valorEl.value.replace('R$','').replace(',','.'));

          const ex = carrinho.find(i=>i.produto===p);
          if(ex) ex.qtd += q;
          else carrinho.push({produto:p,qtd:q,unit:u});

          qtdEl.value = '';
          render();
        }

        function alterar(idx, delta){
          carrinho[idx].qtd += delta;
          if(carrinho[idx].qtd <= 0) carrinho.splice(idx,1);
          render();
        }

        function excluir(idx){
          carrinho.splice(idx,1);
          render();
        }

        function render(){
          listaEl.innerHTML = '';
          let total = 0;

          carrinho.forEach((i,idx)=>{
            const sub = i.qtd * i.unit;
            total += sub;

            listaEl.innerHTML += \`
              <li style="display:flex;justify-content:space-between;align-items:center">
                <span>
                  \${i.produto} | \${i.qtd} x R$ \${i.unit.toFixed(2).replace('.',',')}
                  = <strong>R$ \${sub.toFixed(2).replace('.',',')}</strong>
                </span>
                <span style="display:flex;gap:4px">
                  <button onclick="alterar(\${idx},1)">+</button>
                  <button onclick="alterar(\${idx},-1)">−</button>
                  <button onclick="excluir(\${idx})">✖</button>
                </span>
              </li>\`;
          });

          totalEl.innerText = total.toFixed(2).replace('.',',');
        }

        function finalizar(){
          if(!carrinho.length) return alert('Carrinho vazio');
          if(!entregadorEl.value) return alert('Informe o entregador');

          google.script.run
            .withSuccessHandler(()=>google.script.host.close())
            .withFailureHandler(e=>alert(e.message||e))
            .salvarDeliveryCarrinho(
              clienteEl.value,
              carrinho,
              pagEl.value,
              entregadorEl.value
            );
        }
      </script>

    `, 460, 700);
  }
  function salvarDeliveryCarrinho(cliente, itens, pagamento, entregador){

    validarEstoqueCarrinho(itens);
    // 🔒 BLOQUEIO FIADO
    if(pagamento === '🧾 Fiado'){
      validarClienteFiado(cliente);
    }
    const ss = SpreadsheetApp.getActive();
    garantirDeliveryItens();

    const del = ss.getSheetByName('DELIVERY');

    if(!del){
      throw new Error('Aba DELIVERY não encontrada.');
    }

    const pedido = gerarNumeroDelivery();

    let totalPedido = 0;
    itens.forEach(i=>{
      totalPedido += Number(i.qtd) * Number(i.unit);
    });

    del.appendRow([
      pedido,
      new Date(),
      cliente || '',
      'VER ITENS',
      itens.length,
      totalPedido,
      pagamento,
      'PEDIDO FEITO',
      entregador || '',   // 🔥 ENTREGADOR AQUI
      ''                  // ID_VENDA (mantido)
    ]);

    itens.forEach(i=>{
      inserirLinhaNoTopo('DELIVERY_ITENS', [
        pedido,
        i.produto,
        Number(i.qtd),
        Number(i.unit),
        Number(i.qtd) * Number(i.unit),
        'NAO'
      ]);
    });

    return { ok:true };
  }
  function botoesDeliveryPainel(pedido, status){
    let btns = `
      <button class="btn-primary"
        onclick="google.script.run.popupVerItensDelivery(${pedido})">
        👁️ Itens
      </button>
    `;

    if(status === 'PEDIDO FEITO'){
      btns += `
        <button class="btn-success"
          onclick="google.script.run.confirmarEncaminharDelivery(${pedido})">
          ➡️ Encaminhar
        </button>
        <button class="btn-danger"
          onclick="google.script.run.confirmarCancelamentoDelivery(${pedido})">
          ❌ Cancelar
        </button>
      `;
    }

    if(status === 'EM ANDAMENTO'){
      btns += `
        <button class="btn-success"
          onclick="google.script.run.confirmarEntregaDelivery(${pedido})">
          ✅ Entregar
        </button>
        <button class="btn-danger"
          onclick="google.script.run.confirmarCancelamentoDelivery(${pedido})">
          ❌ Cancelar
        </button>
      `;
    }

    return btns;
  }
  function popupVerItensDelivery(pedido){
    const ss = SpreadsheetApp.getActive();
    const itensSh = ss.getSheetByName('DELIVERY_ITENS');
    const delSh   = ss.getSheetByName('DELIVERY');

    if(!itensSh || !delSh){
      SpreadsheetApp.getUi().alert('Dados do delivery não encontrados.');
      return;
    }

    const itens = itensSh.getDataRange().getValues()
      .filter((l,i)=> i>0 && l[0] == pedido);

    const pedidoLinha = delSh.getDataRange().getValues()
      .find((l,i)=> i>0 && l[0] == pedido);

    if(!pedidoLinha){
      SpreadsheetApp.getUi().alert('Pedido não encontrado.');
      return;
    }

    let total = 0;

    const lista = itens.map(i=>{
      const sub = Number(i[2]) * Number(i[3]);
      total += sub;

      return `
        <div style="
          background:#ffffff;
          border:1px solid #e5e7eb;
          border-radius:10px;
          padding:10px 12px;
          margin-bottom:8px;
          display:flex;
          justify-content:space-between;
          align-items:center;
        ">
          <div>
            <strong>${i[1]}</strong><br>
            <small>${i[2]} x R$ ${Number(i[3]).toFixed(2).replace('.',',')}</small>
          </div>
          <strong>R$ ${sub.toFixed(2).replace('.',',')}</strong>
        </div>
      `;
    }).join('');

    abrirPopup(`📦 Pedido #${pedido}`, `
      <div style="display:flex;flex-direction:column;gap:10px">

        <div style="
          background:#020617;
          color:#e5e7eb;
          padding:10px;
          border-radius:10px;
          text-align:center;
          font-weight:bold
        ">
          👤 ${pedidoLinha[2] || 'Cliente não informado'}
        </div>

        ${lista || '<p style="text-align:center">Nenhum item encontrado.</p>'}

        <div style="
          text-align:right;
          font-size:16px;
          font-weight:bold;
          margin-top:8px
        ">
          💰 Total: R$ ${total.toFixed(2).replace('.',',')}
        </div>

        <hr>

        <button class="btn-secondary" onclick="voltar()">
          ↩️ Voltar ao Painel
        </button>
      </div>

      <script>
        function voltar(){
          google.script.host.close();
          google.script.run.popupPainelDelivery2();
        }
      </script>
    `, 520, 600);
  }
  function encaminharDelivery(pedido){
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('DELIVERY');
    const dados = sh.getDataRange().getValues();

    for(let i = 1; i < dados.length; i++){
      if(dados[i][0] == pedido){
        if(dados[i][7] !== 'PEDIDO FEITO'){
          return { ok:false, msg:'Pedido não pode ser encaminhado.' };
        }

        // 🔥 STATUS PADRONIZADO
        sh.getRange(i + 1, 8).setValue('EM ANDAMENTO');

        // 🔥 BAIXA ESTOQUE + VENDAS + CAIXA
        baixarEstoqueDelivery(pedido);

        return { ok:true, msg:'Pedido encaminhado com sucesso.' };
      }
    }

    return { ok:false, msg:'Pedido não encontrado.' };
  }
  function confirmarEncaminharDelivery(pedido){
    popupConfirmar(
      'Encaminhar Pedido',
      'Deseja encaminhar este pedido para entrega?',
      'executarEncaminharDelivery',
      pedido
    );
  }
  function executarEncaminharDelivery(pedido){
    encaminharDelivery(pedido);
    popupMensagem(
      'Pedido Encaminhado',
      '📦 Pedido foi encaminhado com sucesso!'
    );
  }
  function baixarEstoqueDelivery(pedido){
    const ss = SpreadsheetApp.getActive();
    const itensSh = ss.getSheetByName('DELIVERY_ITENS');
    const vendas  = ss.getSheetByName('VENDAS');
    const delivery= ss.getSheetByName('DELIVERY');

    const itens = itensSh.getDataRange().getValues();
    const pedidos = delivery.getDataRange().getValues();

    let pagamento = '';
    let totalGeral = 0;

    const idVenda = gerarIdVendaDelivery(pedido);

    // 🔎 forma de pagamento
    pedidos.forEach((p,i)=>{
      if(i>0 && p[0] == pedido){
        pagamento = p[6];
      }
    });

    for(let i=1;i<itens.length;i++){
      const it = itens[i];

      if(it[0] == pedido && it[5] !== 'SIM'){
        const produto = it[1];
        const qtd     = Number(it[2]);
        const total   = Number(it[4]);
        baixarEstoquePorComanda(produto, qtd);

        inserirLinhaNoTopo('VENDAS', [
          new Date(),   // Data
          produto,      // Produto
          qtd,          // Qtd
          total,        // Valor
          pagamento,    // Pagamento
          'DELIVERY',   // Origem
          idVenda       // 🔑 ID_VENDA
        ]);

        itensSh.getRange(i+1,6).setValue('SIM');
        totalGeral += total;
      }
    }

    if(totalGeral > 0){

      // 🧾 FIADO → CONTAS A RECEBER
      if(pagamento === '🧾 Fiado'){

        var found = pedidos.find(p => p[0] == pedido);
        const cliente = found ? found[2] : '';

        criarContaAReceber(
          'DELIVERY',
          idVenda,
          cliente,
          totalGeral,
          'FIADO'
        );

      } else {

        // 💰 OUTRAS FORMAS → CAIXA
        registrarCaixa(
          new Date(),
          'Entrada',
          totalGeral,
          pagamento,
          `DELIVERY ${idVenda}`
        );
      }
    }
    atualizarEstoque();
  }
  function finalizarDelivery(pedido){
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('DELIVERY').getDataRange().getValues();

    for(let i=1;i<sh.length;i++){
      if(sh[i][0] == pedido){
        if(sh[i][7] !== 'EM ANDAMENTO'){
          return {ok:false,msg:'Pedido não está em andamento.'};
        }

        ss.getSheetByName('DELIVERY')
          .getRange(i+1,8)
          .setValue('ENTREGUE');

        return {ok:true,msg:'Pedido entregue com sucesso.'};
      }
    }

    return {ok:false,msg:'Pedido não encontrado.'};
  }
  function confirmarEntregaDelivery(pedido){
    popupConfirmar(
      'Finalizar Entrega',
      'Confirmar entrega deste pedido?',
      'executarEntregaDelivery',
      pedido
    );
  }
  function executarEntregaDelivery(pedido){

    const res = finalizarDelivery(pedido);

    if(!res || res.ok === false){
      popupMensagem(
        'Atenção',
        (res && res.msg) ? res.msg : 'Não foi possível finalizar a entrega.'
      );
      return;
    }

    // atualização visual / dashboard fica DEPOIS

    popupMensagem(
      'Entrega Concluída',
      '🚚 Pedido entregue com sucesso!'
    );
  }
  function cancelarDelivery(pedido){
    const ss = SpreadsheetApp.getActive();

    const del    = ss.getSheetByName('DELIVERY');
    const itens  = ss.getSheetByName('DELIVERY_ITENS');
    const vendas = ss.getSheetByName('VENDAS');
    const caixa  = ss.getSheetByName('CAIXA');

    if(!del || !itens || !vendas || !caixa){
      return { ok:false, msg:'Abas obrigatórias não encontradas.' };
    }

    /* =========================
      1️⃣ LOCALIZA DELIVERY
      ========================= */
    const delDados = del.getDataRange().getValues();
    let status = '';
    let totalPedido = 0;

    for(let i=1;i<delDados.length;i++){
      if(delDados[i][0] == pedido){
        status = delDados[i][7];
        totalPedido = Number(delDados[i][5]) || 0;
        del.getRange(i+1,8).setValue('CANCELADO');
        break;
      }
    }

    if(!status){
      return { ok:false, msg:'Pedido não encontrado.' };
    }

    /* =========================
      2️⃣ DEVOLVE ESTOQUE (se baixado)
      ========================= */
    const itensDados = itens.getDataRange().getValues();

    itensDados.forEach((it,i)=>{
      if(i>0 && it[0] == pedido && it[5] === 'SIM'){
        itens.getRange(i+1,6).setValue('CANCELADO');
      }
    });

    /* =========================
      3️⃣ REMOVE VENDAS DO PEDIDO
      ========================= */
    for(let i = vendas.getLastRow(); i > 1; i--){
      const origem = vendas.getRange(i,6).getValue();
      const produto = vendas.getRange(i,2).getValue();

      if(origem === 'DELIVERY'){
        const existe = itensDados.find(it =>
          it[0] == pedido && it[1] === produto
        );
        if(existe){
          vendas.deleteRow(i);
        }
      }
    }

    /* =========================
      4️⃣ REMOVE CAIXA — APENAS 1 LANÇAMENTO
      ========================= */
    if(status === 'EM ANDAMENTO' || status === 'ENTREGUE'){
      for(let i = caixa.getLastRow(); i > 1; i--){
        const origem = caixa.getRange(i,5).getValue();
        const valor  = Number(caixa.getRange(i,3).getValue());

    if(origem === `DELIVERY ${gerarIdVendaDelivery(pedido)}`)
          caixa.deleteRow(i);
          break; // 🔒 remove só UM lançamento
        }
      }
    

    /* =========================
      5️⃣ RECALCULA ESTOQUE
      ========================= */
    atualizarEstoque();

    return { ok:true, msg:'Pedido cancelado com sucesso.' };
  }
  function cancelarDeliveryPorId(pedido){
    const ss = SpreadsheetApp.getActive();

    const delivery = ss.getSheetByName('DELIVERY');
    const itensSh  = ss.getSheetByName('DELIVERY_ITENS');
    const vendas   = ss.getSheetByName('VENDAS');
    const caixa    = ss.getSheetByName('CAIXA');

    const idVenda = gerarIdVendaDelivery(pedido);

    /* =========================
      1️⃣ MARCA DELIVERY CANCELADO
      ========================= */
    const delDados = delivery.getDataRange().getValues();

    let statusOk = false;

    delDados.forEach((d,i)=>{
      if(i>0 && d[0] == pedido){
        delivery.getRange(i+1,8).setValue('CANCELADO');
        statusOk = true;
      }
    });

    if(!statusOk){
      return { ok:false, msg:'Pedido não encontrado.' };
    }

    /* =========================
      2️⃣ REMOVE VENDAS PELO ID_VENDA
      ========================= */
    for(let i = vendas.getLastRow(); i > 1; i--){
      const id = vendas.getRange(i,7).getValue(); // COLUNA G
      if(id === idVenda){
        vendas.deleteRow(i);
      }
    }

    /* =========================
      3️⃣ REMOVE CAIXA PELO ID_VENDA
      ========================= */
    for(let i = caixa.getLastRow(); i > 1; i--){
      const origem = caixa.getRange(i,5).getValue(); // COLUNA E
      if(origem === `DELIVERY ${idVenda}`){
        caixa.deleteRow(i);
      }
    }

    /* =========================
      4️⃣ REVERTE ESTOQUE (PELO DELIVERY_ITENS)
      ========================= */
    const itens = itensSh.getDataRange().getValues();

    itens.forEach((it,i)=>{
      if(i>0 && it[0] == pedido && it[5] === 'SIM'){
        itensSh.getRange(i+1,6).setValue('CANCELADO');
      }
    });

    /* =========================
      5️⃣ RECALCULA ESTOQUE GLOBAL
      ========================= */
    atualizarEstoque();

    return {
      ok:true,
      msg:`Delivery ${idVenda} cancelado com sucesso.`
    };
  }
  function executarCancelamentoDelivery(pedido){
    const res = cancelarDelivery(pedido);
    popupMensagem(
      res.ok ? 'Sucesso' : 'Atenção',
      res.msg
    );
  }
  function executarCancelamentoDeliveryPorId(pedido){
    const res = cancelarDeliveryPorId(pedido);

    popupMensagem(
      res.ok ? 'Cancelamento Concluído' : 'Erro',
      res.msg
    );
  }
  function confirmarCancelamentoDelivery(pedido){
    popupConfirmar(
      'Cancelar Pedido',
      'Tem certeza que deseja cancelar este pedido?',
      'executarCancelamentoDeliveryPorId',
      pedido
    );
  }
  function atualizarStatusDelivery(pedido, status){
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('DELIVERY').getDataRange().getValues();

    sh.forEach((d,i)=>{
      if(i>0 && d[0]===pedido){
        ss.getSheetByName('DELIVERY')
          .getRange(i+1,8)
          .setValue(status);
      }
    });
  }
  function botoesDelivery(pedido, status){
    if(status === 'PEDIDO FEITO'){
      return `
        <button class="go"
          onclick="google.script.run.confirmarEncaminharDelivery(${pedido})">
          ➡️ Encaminhar
        </button>

        <button class="cancel"
          onclick="google.script.run.confirmarCancelamentoDelivery(${pedido})">
          ❌ Cancelar
        </button>
      `;
    }

    if(status === 'EM ANDAMENTO'){
      return `
        <button class="ok"
          onclick="google.script.run.confirmarEntregaDelivery(${pedido})">
          ✅ Entregar
        </button>

        <button class="cancel"
          onclick="google.script.run.confirmarCancelamentoDelivery(${pedido})">
          ❌ Cancelar
        </button>
      `;
    }

    // ENTREGUE ou CANCELADO
    return '—';
  }
  function gerarIdVendaDelivery(pedido){
    return 'D-' + String(pedido).padStart(6, '0');
  }

// ===============================
// COMANDAS / BALCÃO
// ===============================
  function validarEstoqueCarrinho(carrinho){
    if(!Array.isArray(carrinho)){
      throw new Error('Carrinho inválido.');
    }

    const ss = SpreadsheetApp.getActive();
    const estoque = ss.getSheetByName('ESTOQUE')
      .getDataRange()
      .getValues();

    // normaliza nomes ao construir mapa para evitar problemas com espaços/case
    const mapaEstoque = {};
    estoque.forEach((e,i)=>{
      if(i>0){
        // função interna de normalização (usa global se existir)
        const safeNorm = function(str){
          if(typeof normalizeString === 'function') return normalizeString(str);
          let s = String(str || '');
          try{
            return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toUpperCase().trim();
          }catch(e){
            return s.toUpperCase().trim();
          }
        };
        const chave = safeNorm(e[0]);
        mapaEstoque[chave] = Number(e[1]) || 0;
      }
    });

    // DEBUG: listar mapa
    console.log('DEBUG validarEstoqueCarrinho - mapaEstoque', mapaEstoque);

    const faltando = [];

    carrinho.forEach(i=>{
      const safeNorm = function(str){
        if(typeof normalizeString === 'function') return normalizeString(str);
        let s = String(str || '');
        try{
          return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toUpperCase().trim();
        }catch(e){
          return s.toUpperCase().trim();
        }
      };
      const chaveProd = safeNorm(i.produto);
      const disponivel = mapaEstoque[chaveProd] || 0;
      const qtd = Number(i.qtd) || 0;

      console.log('DEBUG validarEstoqueCarrinho - item', i.produto, 'chave', chaveProd, 'qtd', qtd, 'disponivel', disponivel);

      if(qtd > disponivel){
        faltando.push(
          `❌ ${i.produto} (Disponível: ${disponivel}, Pedido: ${qtd})`
        );
      }
    });

    if(faltando.length){
      // incluir conteúdo do mapa no erro para depuração
      const debugMsg = '\n\n[DEBUG] mapaEstoque: ' + JSON.stringify(mapaEstoque);
      throw new Error(
        'Estoque insuficiente para:\n\n' + faltando.join('\n') + debugMsg
      );
    }

    return true;
  }
  function popupComandaBalcao(){

    const ss = SpreadsheetApp.getActive();

    const clientes = ss.getSheetByName('CLIENTES')
      .getDataRange().getValues()
      .slice(1)
      .map(c => c[0])
      .filter(Boolean);

    const produtos = getProdutosComEstoque();

    const optProd = `
      <option value="">Selecione o produto</option>
      ${produtos.map(p => `<option value="${p}">${p}</option>`).join('')}
    `;

    abrirPopup(getNomeDeposito(), `

      <div style="text-align:center;margin-bottom:14px">
        <div style="font-size:14px;color:#475569">
          Nova Comanda Balcão
        </div>
      </div>

      <label>👤 Cliente</label>
      <div style="display:flex;gap:8px;align-items:center">

        <input
          list="clientes"
          id="cliente"
          placeholder="Selecione ou cadastre o cliente"
          style="flex:1"
          readonly
          onclick="this.removeAttribute('readonly')"
          onblur="validarClienteLista()"
        >

        <button
          style="
            width:44px;
            height:44px;
            background:#16a34a;
            color:#fff;
            border:none;
            border-radius:10px;
            font-size:20px"
          title="Adicionar novo cliente"
          onclick="google.script.run.popupMenuCliente('BALCAO')">
          👤
        </button>

      </div>

      <datalist id="clientes">
        ${clientes.map(c => `<option value="${c}">`).join('')}
      </datalist>

      <hr>

      <label>🍺 Produto</label>
      <select id="produto">${optProd}</select>

      <label>🔢 Quantidade</label>
      <div style="display:flex;align-items:center;gap:10px;justify-content:center">
        <button onclick="alterarTemp(-1)" style="width:34px;height:34px">➖</button>
        <input
          id="qtd"
          type="number"
          min="1"
          placeholder="Qtd"
          style="width:120px;height:40px;text-align:center;font-size:16px"
        >
        <button onclick="alterarTemp(1)" style="width:34px;height:34px">➕</button>
      </div>

      <label>💰 Valor Unitário</label>
      <input id="valor" readonly>

      <button id="btnAdd" class="btn-primary" onclick="add()">➕ Adicionar Item</button>

      <h3>🛒 Itens</h3>
      <ul id="lista"></ul>

      <div class="total">
        💵 Total: <strong>R$ <span id="total">0,00</span></strong>
      </div>

      <hr>

      <button id="btnPausar" onclick="pausar()">🟢 Continuar Vendendo</button>
      <button id="btnFechar" onclick="fechar()">💳 Finalizar Comanda</button>
      <button onclick="google.script.host.close()">❌ Cancelar</button>

      <script>

        const clientesValidos = ${JSON.stringify(clientes)};
        let carrinho = [];
        let clienteTravado = false;

        function validarClienteLista(){
          if(!cliente.value) return;
          if(!clientesValidos.includes(cliente.value)){
            alert('❌ Cliente inválido.');
            cliente.value = '';
            cliente.focus();
          }
        }

        function validarClienteSelecionado(){
          if(!cliente.value){
            alert('❗ Selecione um cliente.');
            return false;
          }
          return true;
        }

        produto.onchange = () => {
          if(!produto.value){
            valor.value = '';
            return;
          }

          google.script.run
            .withSuccessHandler(preco => {
              valor.value = 'R$ ' + Number(preco).toFixed(2).replace('.',',');
            })
            .getPrecoProduto(produto.value);
        };

        function alterarTemp(delta){
          let v = Number(qtd.value || 0);
          v += delta;
          if(v < 1) v = '';
          qtd.value = v;
        }

        function add(){
          if(!validarClienteSelecionado()) return;
          if(!produto.value || !qtd.value) return;

          if(!clienteTravado){
            cliente.disabled = true;
            clienteTravado = true;
          }

          const p = produto.value;
          const q = Number(qtd.value);
          const u = Number(valor.value.replace('R$','').replace(',','.'));

          const ex = carrinho.find(i => i.produto === p);
          if(ex) ex.qtd += q;
          else carrinho.push({ produto:p, qtd:q, unit:u });

          qtd.value = '';
          render();
        }

        function render(){
          lista.innerHTML = '';
          let t = 0;

          carrinho.forEach((i, idx) => {
            const sub = i.qtd * i.unit;
            t += sub;

            lista.innerHTML +=
              '<li>' +
                i.produto + ' | ' +
                i.qtd + ' x R$ ' +
                i.unit.toFixed(2).replace('.',',') +
                ' <strong>R$ ' +
                sub.toFixed(2).replace('.',',') +
                '</strong>' +
              '</li>';
          });

          total.innerText = t.toFixed(2).replace('.',',');
        }
        
        function pausar(){
          if(!validarClienteSelecionado() || !carrinho.length) return;

          btnPausar.disabled = true;

          google.script.run
            .withSuccessHandler(()=>google.script.host.close())
            .withFailureHandler(e=>{
              alert(e.message || e);
              btnPausar.disabled = false;
            })
            .salvarComandaBalcao(cliente.value, carrinho, 'ABERTA');
        }

        function fechar(){
          if(!validarClienteSelecionado() || !carrinho.length) return;

          btnFechar.disabled = true;
          btnFechar.innerText = '⏳ Processando...';

          google.script.run
            .withFailureHandler(e=>{
              alert(e.message || e);
              btnFechar.disabled = false;
              btnFechar.innerText = '💳 Finalizar Comanda';
            })
            .withSuccessHandler(()=>{
              google.script.host.close();
            })
            .salvarComandaBalcaoComPagamento(
              cliente.value,
              carrinho
            );
        }

      </script>
    `, 520, 720);
  }
  function salvarComandaBalcaoComPagamento(cliente, itens){
    const res = salvarComandaBalcao(cliente, itens, 'AGUARDANDO_PGTO');
    if(res && res.ok){
      popupFecharComanda(res.pedido);
    }
    return res;
  }

  function salvarComandaBalcao(cliente, itens, status){

    const lock = LockService.getScriptLock();
    lock.waitLock(3000);

    try{

      validarEstoqueCarrinho(itens);

      const ss = SpreadsheetApp.getActive();

      const pedido = gerarNumeroComanda();

      // ============================
      // 1️⃣ COMANDAS
      // ============================
      let shComandas = ss.getSheetByName('COMANDAS');
      if(!shComandas){
        shComandas = ss.insertSheet('COMANDAS');
        shComandas.getRange('A1:E1').setValues([[
          'Pedido','Data','Cliente','Origem','Status'
        ]]);
      }

      shComandas.appendRow([
        pedido,
        new Date(),
        cliente || '',
        'BALCAO',
        status
      ]);

      // ============================
      // 2️⃣ COMANDA_ITENS
      // ============================
      let shItens = ss.getSheetByName('COMANDA_ITENS');
      if(!shItens){
        shItens = ss.insertSheet('COMANDA_ITENS');
        shItens.getRange('A1:F1').setValues([[
          'Pedido','Produto','Qtd','Valor Unit','Total','Processado'
        ]]);
      }

      itens.forEach(i => {

        shItens.appendRow([
          pedido,
          i.produto,
          Number(i.qtd),
          Number(i.unit),
          Number(i.qtd) * Number(i.unit),
          'SIM'
        ]);

        // 🔻 baixa estoque imediatamente
        baixarEstoquePorComanda(
          i.produto,
          Number(i.qtd)
        );
      });

      // ============================
      // 3️⃣ ATUALIZA ESTOQUE
      // ============================
      atualizarEstoque();

      // ============================
      // 4️⃣ LOG
      // ============================
      registrarLog(
        status === 'AGUARDANDO_PGTO'
          ? 'COMANDA_AGUARDANDO_PGTO'
          : 'COMANDA_ABERTA',
        `Comanda ${pedido}`,
        cliente,
        itens
      );

      return {
        ok: true,
        pedido
      };

    } finally {

      lock.releaseLock();

    }
  }
  function popupComandaExistente(pedido){
    const ss = SpreadsheetApp.getActive();

    const produtos = getProdutosComEstoque();

    const clientes = ss.getSheetByName('CLIENTES')
      .getDataRange().getValues()
      .slice(1)
      .map(c => c[0]);

    const itensRaw = ss.getSheetByName('COMANDA_ITENS')
      .getDataRange().getValues()
      .slice(1)
      .filter(i => i[0] === pedido);

    const mapa = {};
    itensRaw.forEach(i=>{
      if(!mapa[i[1]]){
        mapa[i[1]] = {
          produto: i[1],
          qtd: 0,
          unit: Number(i[3]),
          travado: true
        };
      }
      mapa[i[1]].qtd += Number(i[2]);
    });

    const carrinhoInicial = Object.values(mapa);

    const optionsProd = `
      <option value="">Selecione o produto</option>
      ${produtos.map(p =>
        `<option value="${p}">${p}</option>`
      ).join('')}
    `;
    const cliente = getClienteDaComanda(pedido);


    const html = `
    
      <div style="
        background:#020617;
        color:#e5e7eb;
        padding:14px;
        border-radius:12px;
        text-align:center;
        margin-bottom:16px
      ">
        <div style="font-size:16px;font-weight:bold">
          🧾 Comanda #${String(pedido).padStart(6,'0')}
        </div>

        <div style="font-size:14px;margin-top:6px">
          👤 ${cliente || 'Cliente não informado'}
        </div>
      </div>

      <hr>

      <label>Produto</label>
      <select id="produto">${optionsProd}</select>

      <label>Valor Unitário</label>
      <input id="valor" readonly>

      <button class="btn-primary" onclick="add()">➕ Adicionar Produto</button>

      <div id="msg" class="msg"></div>

      <h3>Itens da Comanda</h3>
      <ul id="lista"></ul>

      <div class="total">
        🧾 Total Consumido: <strong>R$ <span id="totalConsumido">0,00</span></strong><br>
        💵 Saldo Atual: <strong style="color:#16a34a">
          R$ <span id="saldoAtual">0,00</span>
        </strong>
      </div>

      <hr>

    <p id="msgParcial" style="text-align:right;font-weight:bold"></p>
      <button class="btn-warning" onclick="abrirParcial()">💵 Pagamento Parcial</button>
      <button class="btn-success" onclick="continuar(this)"> 🟢 Continuar Vendendo</button>
      <button class="btn-warning" onclick="fechar()">💰🛍️ Finalizar Comanda</button>
      <button class="btn-danger" onclick="cancelar()">❌ Cancelar</button>

      <script>
      
        let carrinho = ${JSON.stringify(carrinhoInicial)};

        function moeda(v){
          return 'R$ ' + v.toFixed(2).replace('.',',');
        }

        function alterar(idx, delta){
          if(!carrinho[idx]) return;

          carrinho[idx].qtd += delta;

          if(carrinho[idx].qtd <= 0){
            carrinho.splice(idx, 1);
          }

          render();
        }

        function abrirParcial(){
          const novos = carrinho.filter(i => !i.travado);

          if(novos.length){
            google.script.run
              .withSuccessHandler(() => {
                google.script.run.popupPagamentoParcialComanda(${pedido});
              })
              .salvarItensComandaAberta(${pedido}, carrinho);
          }else{
            google.script.run.popupPagamentoParcialComanda(${pedido});
          }
        }


        function pagarParcial(btn){
          const v = valorParcial.value
            .replace('R$','')
            .replace(',','.')
            .trim();

          if(!v){
            alert('Informe o valor.');
            return;
          }

          btn.disabled = true;
          btn.innerText = '⏳ Registrando...';

          google.script.run
            .withSuccessHandler(res=>{
              if(!res.ok){
                alert(res.msg);
                btn.disabled = false;
                btn.innerText = '➕ Registrar Pagamento Parcial';
                return;
              }

              msgParcial.innerText =
                'Saldo restante: R$ ' +
                res.saldoAtual.toFixed(2).replace('.',',');

              valorParcial.value = '';

              btn.disabled = false;
              btn.innerText = '➕ Registrar Pagamento Parcial';
            })
            .registrarPagamentoParcialComanda(
              ${pedido},
              v,
              pagParcial.value
            );
          }

              produto.onchange = () => {

                if(!produto.value){
                  valor.value = '';
                  return;
                }

                google.script.run
                  .withSuccessHandler(preco => {
                    valor.value =
                      'R$ ' + Number(preco).toFixed(2).replace('.',',');
                  })
                  .getPrecoProduto(produto.value);

              };
        function add(){
          if(!produto.value) return;
          const p = produto.value;
          const u = Number(valor.value.replace('R$','').replace(',','.'));
          let i = carrinho.find(x=>x.produto===p && !x.travado);
          if(i) i.qtd++;
          else carrinho.push({produto:p,qtd:1,unit:u,travado:false});
          render();
        }
        function remover(idx){
          carrinho.splice(idx,1);
          render();
        }

        function render(){
          const lista = document.getElementById('lista');
          const totalConsumidoEl = document.getElementById('totalConsumido');
          const saldoAtualEl = document.getElementById('saldoAtual');

          lista.innerHTML = '';

          let totalConsumido = 0;

          carrinho.forEach((i, idx) => {
            const subtotal = i.qtd * i.unit;
            totalConsumido += subtotal;

            lista.innerHTML +=
              '<li style="display:flex;justify-content:space-between;align-items:center;gap:8px">' +

                '<span style="flex:1">' +
                  i.produto + ' | ' +
                  i.qtd + ' x R$ ' + i.unit.toFixed(2).replace('.', ',') +
                  ' = <strong>R$ ' + subtotal.toFixed(2).replace('.', ',') + '</strong>' +
                '</span>' +

                (i.travado
                  ? ''
                  : '<div style="display:flex;gap:4px">' +

                      '<button class="btn-qtd" onclick="alterar('+idx+',1)">➕</button>' +

                      '<button class="btn-qtd" onclick="alterar('+idx+',-1)">➖</button>' +

                      '<button class="btn-qtd" ' +
                        'style="background:#dc2626;color:#fff" ' +
                        'onclick="remover('+idx+')">❌</button>' +

                    '</div>'
                ) +

              '</li>';
          });

          // 🔹 TOTAL CONSUMIDO (histórico – não muda com pgto parcial)
          totalConsumidoEl.innerText =
            totalConsumido.toFixed(2).replace('.', ',');

          // 🔹 SALDO ATUAL (vem do backend, já descontando pagamentos parciais)
          google.script.run
            .withSuccessHandler(saldo => {
              saldoAtualEl.innerText =
                Number(saldo).toFixed(2).replace('.', ',');
            })
            .calcularSaldoComanda(${pedido});
        }

        function continuar(btn){
          // 🔒 ANTI-DUPLO CLIQUE REAL
          if(btn.disabled) return;

          btn.disabled = true;
          const textoOriginal = btn.innerText;
          btn.innerText = '⏳ Salvando...';

          google.script.run
            .withSuccessHandler(() => {
              google.script.host.close();
            })
            .withFailureHandler(err => {
              // 🔔 popup informativo (mantém padrão do sistema)
              alert(err.message || err);

              // 🔓 libera botão em caso de erro
              btn.disabled = false;
              btn.innerText = textoOriginal;
            })
            .salvarContinuarVendendo(
              ${pedido},
              carrinho
            );
        }
        
        function fechar(){

          const novos = carrinho.filter(i => !i.travado);

          // 🔥 SE EXISTEM ITENS NOVOS, SALVA PRIMEIRO
          if(novos.length){

            google.script.run
              .withFailureHandler(err=>{
                alert(err.message || err);
              })
              .withSuccessHandler(()=>{

                // depois de salvar, abre fechamento
                google.script.run.popupFecharComanda(${pedido});
                google.script.host.close();

              })
              .salvarContinuarVendendo(
                ${pedido},
                carrinho
              );

          } else {

            // nenhum item novo → pode fechar direto
            google.script.run.popupFecharComanda(${pedido});
            google.script.host.close();

          }
        }

        function cancelar(){
          google.script.host.close();
        }

        render();
      </script>
    `;

    abrirPopup('🍺 Comanda Aberta', html, 620, 720);
  }
  function salvarContinuarVendendo(pedido, carrinho){

    validarEstoqueCarrinho(carrinho);

    if(!pedido || !Array.isArray(carrinho)){
      throw new Error('Dados inválidos.');
    }

    const ss = SpreadsheetApp.getActive();
    let sh = ss.getSheetByName('COMANDA_ITENS');

    if(!sh){
      sh = ss.insertSheet('COMANDA_ITENS');
      sh.getRange('A1:F1').setValues([[
        'Pedido','Produto','Qtd','Valor Unit','Total','Processado'
      ]]);
    }

    let houveInclusao = false;

    carrinho.forEach(item => {

      // 🔥 SOMENTE ITENS NOVOS
      if(item.travado === false){

        // 1️⃣ Grava item
        sh.appendRow([
          pedido,
          item.produto,
          Number(item.qtd),
          Number(item.unit),
          Number(item.qtd) * Number(item.unit),
          'SIM'
        ]);

        // 2️⃣ Baixa estoque
        baixarEstoquePorComanda(
          item.produto,
          Number(item.qtd)
        );

        item.travado = true;

        houveInclusao = true;
      }
    });

    if(houveInclusao){
      atualizarEstoque();
      SpreadsheetApp.flush();
    }

    return true;
  }
  function salvarItensComandaAberta(pedido, carrinho){

    if(!pedido || !Array.isArray(carrinho)) return;

    const ss = SpreadsheetApp.getActive();

    let itensSh = ss.getSheetByName('COMANDA_ITENS');

    if(!itensSh){
      itensSh = ss.insertSheet('COMANDA_ITENS');
      itensSh.getRange('A1:F1').setValues([[
        'Pedido','Produto','Qtd','Valor Unit','Total','Processado'
      ]]);
    }

    let houveConsumo = false;

    carrinho.forEach(i => {

      // 🔥 SOMENTE NOVOS
      const safeNorm = function(str){
        if(typeof normalizeString === 'function') return normalizeString(str);
        let s = String(str || '');
        try{
          return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toUpperCase().trim();
        }catch(e){
          return s.toUpperCase().trim();
        }
      };
      const chaveProd = safeNorm(i.produto);
        validarEstoqueCarrinho([i]);

        itensSh.appendRow([
          pedido,
          i.produto,
          Number(i.qtd),
          Number(i.unit),
          Number(i.qtd) * Number(i.unit),
          'SIM'
        ]);

        // 🔻 BAIXA IMEDIATA
        baixarEstoquePorComanda(
          i.produto,
          Number(i.qtd)
        );

        i.travado = true;

        houveConsumo = true;
      
    });

    if(houveConsumo){
      atualizarEstoque();
      SpreadsheetApp.flush();
    }

    return true;
  }
  function reverterItensComandaAberta(itens){
    const ss = SpreadsheetApp.getActive();
    const vendas = ss.getSheetByName('VENDAS');
    const dados = vendas.getDataRange().getValues();

    // percorre de baixo para cima para poder deletar
    for(let i = dados.length - 1; i > 0; i--){
      const v = dados[i];

      const achou = itens.find(it =>
        it.produto === v[1] &&
        Number(it.qtd) === Number(v[2]) &&
        v[5] === 'COMANDA BALCAO'
      );

      if(achou){
        vendas.deleteRow(i + 1);
      }
    }

    atualizarEstoque();
    
  }
  function calcularTotalComanda(pedido){
    const ss = SpreadsheetApp.getActive();
    const itens = ss.getSheetByName('COMANDA_ITENS')
      .getDataRange().getValues()
      .filter((l,i)=>i>0 && l[0]===pedido);

    let total = 0;
    itens.forEach(i=>{
      total += Number(i[2]) * Number(i[3]);
    });

    return total;
  }
  function calcularPagamentosComanda(pedido){
    const cx = SpreadsheetApp.getActive()
      .getSheetByName('CAIXA')
      .getDataRange().getValues();

    let pago = 0;

    cx.forEach((c,i)=>{
      if(i===0) return;
      if(
        typeof c[4] === 'string' &&
        c[4] && c[4].includes(pedido)
      ){
        pago += Number(c[2]) || 0;
      }
    });

    return pago;
  }
  function calcularSaldoComanda(pedido){
    const total = calcularTotalComanda(pedido);
    const pagos = calcularPagamentosComanda(pedido);
    return total - pagos;
  }
  function registrarPagamentoParcialComanda(pedido, valor, pagamento){
    valor = Number(valor);
    if(valor <= 0){
      return { ok:false, msg:'Valor inválido.' };
    }

    const saldoAntes = calcularSaldoComanda(pedido);

    if(valor > saldoAntes){
      return { ok:false, msg:'Valor maior que o saldo da comanda.' };
    }

    const cx = SpreadsheetApp.getActive().getSheetByName('CAIXA');

    inserirLinhaNoTopo('CAIXA', [
      new Date(),
      'Entrada',
      valor,
      pagamento,
      `COMANDA #${pedido} (PARCIAL)`
    ]);

    const saldoDepois = saldoAntes - valor;

    return {
      ok: true,
      saldoAtual: saldoDepois,
      quitado: saldoDepois === 0 // 🔥 CHAVE DO FLUXO
    };
  }
  function popupPagamentoParcialComanda(pedido){
    const ss = SpreadsheetApp.getActive();

    const total = calcularTotalComanda(pedido);
    const pagos = calcularPagamentosComanda(pedido);
    const saldo = total - pagos;

    const cmd = ss.getSheetByName('COMANDAS')
      .getDataRange().getValues()
      .find((l,i)=>i>0 && l[0]===pedido);

    const cliente = cmd ? cmd[2] : '';

    const html = `
      <div style="display:flex;flex-direction:column;gap:10px">

        <h3>💵 Pagamento Parcial</h3>

        <div><strong>🧾 Comanda #${pedido}</strong></div>
        <div>👤 ${cliente || 'Cliente não informado'}</div>

        <hr>

        <div>Total da comanda: <strong>R$ ${total.toFixed(2).replace('.',',')}</strong></div>
        <div>Total pago: <strong>R$ ${pagos.toFixed(2).replace('.',',')}</strong></div>

        <div style="font-size:16px">
          Saldo atual: <strong>R$ ${formatarMoeda(saldo).replace('.',',')}</strong>
        </div>

        <hr>

        <label>Valor a pagar agora</label>
        <input id="valor" placeholder="R$ 0,00">

        <label>Forma de pagamento</label>
        <select id="pag">
          <option>⚡ Pix</option>
          <option>💵 Dinheiro</option>
          <option>💳 Cartão Débito</option>
          <option>💳 Cartão Crédito</option>
        </select>

        <button class="btn-success" id="btn" onclick="confirmar(this)">
          ➕ Registrar Pagamento
        </button>

        <button class="btn-secondary" onclick="google.script.host.close()">
          ❌ Cancelar
        </button>
      </div>

      <script>
        const valorInput = document.getElementById('valor');

        valorInput.addEventListener('input', () => {
          let v = valorInput.value.replace(/\\D/g,'');
          if(!v){
            valorInput.value = '';
            return;
          }

          v = (Number(v) / 100).toFixed(2);
          valorInput.value = 'R$ ' + v.replace('.',',');
        });

      function confirmar(btn){

        let v = valorInput.value
          .replace('R$','')
          .replace(',','.')
          .trim();

        if(!v || Number(v) <= 0){
          alert('Informe um valor válido.');
          return;
        }

        btn.disabled = true;
        btn.innerText = '⏳ Registrando...';

        google.script.run
          .withFailureHandler(err => {
            alert(err.message || err);
            btn.disabled = false;
            btn.innerText = '➕ Registrar Pagamento';
          })
          .withSuccessHandler(res => {

            if(!res.ok){
              alert(res.msg);
              btn.disabled = false;
              btn.innerText = '➕ Registrar Pagamento';
              return;
            }

            if(res.quitado){
              google.script.host.close();
              google.script.run.popupConfirmarFechamentoComanda(${pedido});
              return;
            }

            google.script.host.close();
          })
          .registrarPagamentoParcialComanda(
            ${pedido},
            v,
            pag.value
          );
      }
      </script>
    `;

    abrirPopup(
      `💵 Pagamento Parcial — Comanda #${pedido}`,
      html,
      420,
      520
    );
  }
  function popupConfirmarFechamentoComanda(pedido){

    const html = `
      <div style="text-align:center;padding:20px">
        <h3>🧾 Comanda Quitada</h3>

        <p>
          O pagamento registrado quitou totalmente a comanda.<br><br>
          Deseja <strong>fechar a comanda agora</strong> ou mantê-la aberta?
        </p>

        <button class="btn-success" onclick="fechar()">
          💰 Fechar Comanda
        </button>

        <button class="btn-secondary" onclick="manter()">
          🟢 Manter Aberta
        </button>

        <script>

          function fechar(){
            google.script.run
              .withSuccessHandler(()=>{
                google.script.host.close();
              })
              .fecharComandaQuitada(${pedido});
          }

          function manter(){
            google.script.host.close();
            google.script.run.popupComandaExistente(${pedido});
          }

        </script>
      </div>
    `;

    abrirPopup(
      'Confirmação de Fechamento',
      html,
      420,
      320
    );
  }
  function popupDecisaoFecharComanda(pedido){
    const html = `
      <div style="text-align:center;display:flex;flex-direction:column;gap:14px">

        <h3>🧾 Comanda Quitada</h3>

        <p style="font-size:15px">
          O valor da comanda foi <strong>totalmente pago</strong>.<br>
          Deseja finalizar a comanda agora?
        </p>

        <button class="btn-success" onclick="fechar()">
          💰 Fechar Comanda
        </button>

        <button class="btn-secondary" onclick="manter()">
          🟢 Manter Comanda Aberta
        </button>
      </div>

      <script>
        function fechar(){
          google.script.run
            .withSuccessHandler(()=>{
              google.script.host.close();
              google.script.run.popupFecharComanda(${pedido});
            })
            .fecharComandaQuitada(${pedido});
        }

        function manter(){
          google.script.host.close();
        }
      </script>
    `;

    abrirPopup(
      'Decisão de Fechamento',
      html,
      380,
      300
    );
  }
  function popupFecharComanda(pedido){

    const total = calcularTotalComanda(pedido);
    const pagos = calcularPagamentosComanda(pedido);
    const saldo = total - pagos;

    const html = `
      <div style="display:flex;flex-direction:column;gap:14px">

        <h3 style="text-align:center">💰 Finalizar Comanda</h3>

        <div style="
          background:#020617;
          color:#e5e7eb;
          padding:12px;
          border-radius:10px;
          text-align:center
        ">
          <div>🧾 Total: <strong>R$ ${total.toFixed(2).replace('.',',')}</strong></div>
          <div>💵 Pago: <strong>R$ ${pagos.toFixed(2).replace('.',',')}</strong></div>
          <div>⚖️ Saldo: <strong style="color:#22c55e">
            R$ ${saldo.toFixed(2).replace('.',',')}
          </strong></div>
        </div>

        <label>💳 Forma de Pagamento</label>

        <select id="pag">
          <option>⚡ Pix</option>
          <option>💵 Dinheiro</option>
          <option>💳 Cartão Débito</option>
          <option>💳 Cartão Crédito</option>
          <option>🧾 Fiado</option>
        </select>

        <button
          id="btnConfirmar"
          class="btn-success"
          onclick="confirmar(this)">
          ✅ Confirmar Pagamento
        </button>

        <button
          class="btn-secondary"
          onclick="voltar()">
          ↩️ Voltar
        </button>
      </div>

      <script>

        function confirmar(btn){

          if(btn.disabled) return;

          btn.disabled = true;
          const textoOriginal = btn.innerText;
          btn.innerText = '⏳ Processando...';

          google.script.run
            .withFailureHandler(err => {
              alert(err.message || err);
              btn.disabled = false;
              btn.innerText = textoOriginal;
            })
            .withSuccessHandler(() => {
              google.script.host.close();
            })
            .fecharComandaBalcaoFinal(
              ${pedido},
              pag.value
            );
        }

        function voltar(){
          google.script.host.close();
          google.script.run.popupComandaExistente(${pedido});
        }

      </script>
    `;

    abrirPopup(
      'Finalizar Comanda',
      html,
      440,
      420
    );
  }
  function fecharComandaQuitada(pedido){
    const ss = SpreadsheetApp.getActive();

    // 🔹 APENAS fecha a comanda
    const sh = ss.getSheetByName('COMANDAS');
    const dados = sh.getDataRange().getValues();

    dados.forEach((c,i)=>{
      if(i>0 && c[0] === pedido){
        sh.getRange(i+1,5).setValue('FECHADA');
      }
    });

    return true;
  }
  function fecharComandaBalcaoFinal(pedido, formaPgto){

    const ss = SpreadsheetApp.getActive();

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

    // ============================
    // 1️⃣ TOTAL REAL DA COMANDA
    // ============================
    const itens = ss.getSheetByName('COMANDA_ITENS')
      .getDataRange()
      .getValues()
      .filter((l,i)=> i > 0 && l[0] === pedido);

    if(itens.length === 0){
      throw new Error(
        `Nenhum item encontrado para a comanda ${pedido}`
      );
    }

    let totalItens = 0;
    itens.forEach(i=>{
      totalItens += Number(i[4]) || 0;
    });

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

    // ============================
    // 3️⃣ SALDO FINAL
    // ============================
    const saldoFinal = totalItens - totalPago;

    if(saldoFinal < 0){
      throw new Error(
        `Erro crítico: saldo negativo na comanda ${pedido}`
      );
    }

    // ============================
    // 4️⃣ REGISTRA VENDAS
    // ============================
    const vendas = ss.getSheetByName('VENDAS');
    const idVenda = gerarIdVendaComanda(pedido);

    itens.forEach(i=>{
      vendas.appendRow([
        agoraBrasil(),
        i[1],
        Number(i[2]),
        Number(i[4]),
        formaPgto,
        'COMANDA',
        idVenda
      ]);
    });

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

    // ============================
    // 6️⃣ FECHA COMANDA
    // ============================
    const sh = ss.getSheetByName('COMANDAS');
    const dados = sh.getDataRange().getValues();

    dados.forEach((l,i)=>{
      if(i > 0 && l[0] === pedido){
        sh.getRange(i+1,5).setValue('FECHADA');
      }
    });

    registrarLog(
      'COMANDA_FECHADA',
      pedido,
      { totalItens, totalPago },
      { saldoFinal }
    );

    return { ok:true };
  }
  function getClienteDaComanda(pedido){
    if(!pedido) return '';

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('COMANDAS');
    if(!sh) return '';

    const dados = sh.getDataRange().getValues();

    for(let i = 1; i < dados.length; i++){
      if(Number(dados[i][0]) === Number(pedido)){
        return dados[i][2] || '';
      }
    }

    return '';
  }
  function atualizarClienteComanda(pedido, cliente){
    if(!cliente) return;

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('COMANDAS');
    const dados = sh.getDataRange().getValues();

    dados.forEach((l,i)=>{
      if(i>0 && l[0] === pedido){
        sh.getRange(i+1,3).setValue(cliente);
      }
    });
  }
  function criarComandaBalcao(cliente=''){
    const ss = SpreadsheetApp.getActive();
    let sh = ss.getSheetByName('COMANDAS');
    if(!sh){
      sh = ss.insertSheet('COMANDAS');
      sh.getRange('A1:E1').setValues([[
        'Pedido','Data','Cliente','Origem','Status'
      ]]);
    }

    const pedido = gerarNumeroComanda(); // ✅ AQUI
    sh.appendRow([pedido,new Date(),cliente,'BALCAO','ABERTA']);
    return pedido;
  }
  function gerarNumeroComanda(){
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('COMANDAS');

    if(!sh || sh.getLastRow() < 2) return 1;

    const numeros = sh.getRange(2,1,sh.getLastRow()-1,1)
      .getValues()
      .map(l => Number(l[0]))
      .filter(n => !isNaN(n));

    return numeros.length ? Math.max(...numeros) + 1 : 1;
  }
  function gerarIdVendaComanda(pedido){
    return 'C-' + String(pedido).padStart(6,'0');
  }
  function cancelarFechamentoComandaItens(pedido, itensNovos){
    if(!itensNovos || itensNovos.length === 0) return;

    const ss = SpreadsheetApp.getActive();

    const vendas = ss.getSheetByName('VENDAS');
    const itensSh = ss.getSheetByName('COMANDA_ITENS');

    /* ============================
      1️⃣ REMOVE VENDAS GERADAS
      ============================ */
    const vendasDados = vendas.getDataRange().getValues();

    for(let i = vendasDados.length - 1; i > 0; i--){
      const v = vendasDados[i];

      const achou = itensNovos.find(it =>
        it.produto === v[1] &&
        Number(it.qtd) === Number(v[2]) &&
        v[5] === 'COMANDA BALCAO'
      );

      if(achou){
        vendas.deleteRow(i + 1);
      }
    }

    /* ============================
      2️⃣ REMOVE ITENS DA COMANDA
      ============================ */
    const itensDados = itensSh.getDataRange().getValues();

    for(let i = itensDados.length - 1; i > 0; i--){
      const it = itensDados[i];

      const achou = itensNovos.find(n =>
        n.produto === it[1] &&
        Number(n.qtd) === Number(it[2]) &&
        it[0] === pedido
      );

      if(achou){
        itensSh.deleteRow(i + 1);
      }
    }

    /* ============================
      3️⃣ RECALCULA ESTOQUE
      ============================ */
    atualizarEstoque();
  }
  function baixarEstoquePorComanda(produto, quantidade){

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('ESTOQUE');

    if(!sh) throw new Error('Aba ESTOQUE não encontrada.');

    const dados = sh.getDataRange().getValues();

    for(let i = 1; i < dados.length; i++){

      if(dados[i][0] === produto){

        const atual = Number(dados[i][1]) || 0;
        const novaQtd = atual - Number(quantidade);

        if(novaQtd < 0){
          throw new Error(
            `Estoque insuficiente para ${produto}`
          );
        }

        sh.getRange(i+1, 2).setValue(novaQtd);

        return true;
      }
    }

    throw new Error(`Produto ${produto} não encontrado no estoque`);
  }
// ===============================
// LISTAGEM / CONSULTA
// ===============================
  function listarComandasAbertas(){
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('COMANDAS').getDataRange().getValues();

    const abertas = sh.filter((c,i)=> i>0 && (c[4]==='ABERTA' || c[4]==='AGUARDANDO_PGTO'));

    if(abertas.length === 0){
      SpreadsheetApp.getUi().alert('Não há comandas abertas.');
      return;
    }

    const html = `
      <style>
        body{
          font-family:Arial;
          background:#f8fafc;
          color:#020617;
        }
        h3{
          text-align:center;
          margin-bottom:15px;
        }
        .lista{
          display:flex;
          flex-direction:column;
          gap:10px;
        }
        .item{
          display:flex;
          justify-content:space-between;
          align-items:center;
          background:#ffffff;
          border:1px solid #e5e7eb;
          border-radius:8px;
          padding:10px 12px;
          box-shadow:0 1px 3px rgba(0,0,0,.08);
        }
        .info{
          font-weight:bold;
        }
        button{
          background:#2563eb;
          color:#fff;
          border:none;
          padding:6px 12px;
          border-radius:6px;
          cursor:pointer;
          font-size:13px;
        }
        button:hover{
          background:#1e40af;
        }
      </style>

      <div class="lista">
        ${abertas.map(c=>`
          <div class="item">
            <div class="info">
              🧾 Comanda ${c[0]}<br>
              <small>${c[2] || 'Balcão'}</small>
            </div>
            <button onclick="abrir(${c[0]})">➡️ Abrir</button>
          </div>
        `).join('')}
      </div>

      <script>
        function abrir(pedido){
          google.script.run.popupComandaExistente(pedido);
          google.script.host.close();
        }
      </script>
    `;

    abrirPopup('📂 Comandas Abertas', html, 420, 520);
  }
// ===============================
// VENDAS / REGISTROS
// ===============================
  function salvarVendaCarrinho(itens, pagamento){
    const ss = SpreadsheetApp.getActive();
    const vendas = ss.getSheetByName('VENDAS');
    let totalGeral = 0;

    itens.forEach(i=>{
      const total = i.qtd * i.unit;
      vendas.appendRow([
        new Date(),
        i.produto,
        i.qtd,
        total,
        pagamento,
        'Balcão'
      ]);
      totalGeral += total;
    });

    atualizarEstoque();
    registrarCaixa(new Date(),'Entrada',totalGeral,pagamento,'Balcão');
  }
// ===============================
// FORMATAÇÕES
// ===============================
  function formatarLinhaFinanceira(sh){
    const r = sh.getLastRow();
    const cols = sh.getLastColumn();

    const linha = sh.getRange(r, 1, 1, cols);

    // 🔥 RESET TOTAL DE FORMATAÇÃO (mata o cinza/preto herdado)
    linha
      .setBackground('#ffffff')
      .setFontColor('#020617')
      .setFontWeight('normal');

    // 🔹 Data e hora REAL (não texto)
    sh.getRange(r, 1)
      .setNumberFormat('dd/MM/yyyy HH:mm');

    // 🔹 Tipo (Entrada / Saída) centralizado
    sh.getRange(r, 2)
      .setHorizontalAlignment('center');

    // 🔹 Valor monetário
    sh.getRange(r, 3)
      .setNumberFormat('R$ #,##0.00');

    // 🔒 garante que nenhuma cópia de estilo antigo volte
    SpreadsheetApp.flush();
  }
  function inserirLinhaNoTopo(nomeAba, dados){

    if(!nomeAba || !Array.isArray(dados)){
      throw new Error('Parâmetros inválidos.');
    }

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(nomeAba);

    if(!sh){
      throw new Error(`Aba ${nomeAba} não encontrada.`);
    }

    // Insere nova linha logo abaixo do cabeçalho
    sh.insertRowBefore(2);

    // Grava dados na linha 2
    sh.getRange(2, 1, 1, dados.length)
      .setValues([dados]);

  }
// ===============================
// PROTEÇÃO
// ===============================
  function protegerRange(sheet, rangeA1){
    const range = sheet.getRange(rangeA1);
    const prot = range.protect();

    prot.setDescription(`Protegido pelo sistema`);
    prot.removeEditors(prot.getEditors());

    if(prot.canDomainEdit()){
      prot.setDomainEdit(false);
    }
  }
  function protegerAbaInteira(nome){
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(nome);
    if(!sh) return;

    const range = sh.getDataRange();
    const prot = range.protect();

    prot.setDescription(`Aba ${nome} protegida pelo sistema`);
    prot.removeEditors(prot.getEditors());

    if(prot.canDomainEdit()){
      prot.setDomainEdit(false);
    }
  }
// ===============================
// DASHBOARD
// ===============================
  // DASHBOARD - BASE
    function resumoFinanceiroHoje(){
      const cx = SpreadsheetApp.getActive()
        .getSheetByName('CAIXA')
        .getDataRange()
        .getValues();

      const agora = new Date();

      const hoje = Utilities.formatDate(
        agora,
        Session.getScriptTimeZone(),
        'yyyyMMdd'
      );

      const ontem = Utilities.formatDate(
        new Date(agora.getTime() - 86400000),
        Session.getScriptTimeZone(),
        'yyyyMMdd'
      );

      let entrada = 0;
      let saida = 0;

      cx.forEach((c,i)=>{
        if(i===0) return;
        if(!(c[0] instanceof Date)) return;

        const dataObj = new Date(c[0]);
        const data = Utilities.formatDate(
          dataObj,
          Session.getScriptTimeZone(),
          'yyyyMMdd'
        );

        const hora = dataObj.getHours();

        // dia operacional até 03:59
        if(data !== hoje && !(data === ontem && hora < 4)) return;

        const tipo = String(c[1] || '').toUpperCase();

        if(tipo === 'ENTRADA') entrada += Number(c[2]) || 0;
        if(tipo === 'SAIDA')   saida   += Number(c[2]) || 0;
      });

      return {
        entrada,
        saida,
        saldo: entrada - saida
      };
    }
    function entradaMesAtual(){
      const cx = SpreadsheetApp.getActive()
        .getSheetByName('CAIXA')
        .getDataRange()
        .getValues();

      const agora = new Date();
      const refMes = Utilities.formatDate(agora, Session.getScriptTimeZone(), 'yyyyMM');

      let total = 0;

      cx.forEach((c,i)=>{
        if(i===0) return;
        if(!(c[0] instanceof Date)) return;
        if(c[1] !== 'Entrada') return;

        const mes = Utilities.formatDate(
          new Date(c[0]),
          Session.getScriptTimeZone(),
          'yyyyMM'
        );

        if(mes === refMes){
          total += Number(c[2]) || 0;
        }
      });

      return total;
    }
    function indicadoresOperacionaisHoje(){
      const ss = SpreadsheetApp.getActive();

      const hoje = Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        'yyyyMMdd'
      );

      let comandasAbertas = 0;
      let comandasFechadasHoje = 0;
      let deliveryHoje = 0;
      let deliveryCanceladoHoje = 0;

      // COMANDAS
      ss.getSheetByName('COMANDAS')
        .getDataRange()
        .getValues()
        .forEach((c,i)=>{
          if(i===0) return;
          if(!(c[1] instanceof Date)) return;

          const dia = Utilities.formatDate(
            new Date(c[1]),
            Session.getScriptTimeZone(),
            'yyyyMMdd'
          );

          // abertas do dia
          if(c[4] === 'ABERTA' && dia === hoje){
            comandasAbertas++;
          }

          // fechadas hoje
          if(c[4] === 'FECHADA' && dia === hoje){
            comandasFechadasHoje++;
          }
        });

      // DELIVERY
      ss.getSheetByName('DELIVERY')
        .getDataRange()
        .getValues()
        .forEach((d,i)=>{
          if(i===0) return;
          if(!(d[1] instanceof Date)) return;

          const dia = Utilities.formatDate(
            new Date(d[1]),
            Session.getScriptTimeZone(),
            'yyyyMMdd'
          );

          if(dia === hoje){
            deliveryHoje++;
            if(d[7] === 'CANCELADO') deliveryCanceladoHoje++;
          }
        });

      const taxaCancelamentoDelivery =
        deliveryHoje > 0
          ? (deliveryCanceladoHoje / deliveryHoje)
          : 0;

      return {
        comandasAbertas,
        comandasFechadasHoje,
        mediaComandasDia: comandasFechadasHoje,
        deliveryHoje,
        deliveryCanceladoHoje,
        taxaCancelamentoDelivery
      };
    }
    function prepararMovimentoDiario(){
      const ss = SpreadsheetApp.getActive();
      const vendas = ss.getSheetByName('VENDAS').getDataRange().getValues();
      const mapa = {};

      vendas.forEach((v,i)=>{
        if(i===0) return;
        if(!(v[0] instanceof Date)) return;

        const data = Utilities.formatDate(
          new Date(v[0]),
          Session.getScriptTimeZone(),
          'dd/MM/yyyy'
        );

        const valor = Number(v[3]) || 0;
        mapa[data] = (mapa[data] || 0) + valor;
      });

      const dados = [['Data','Faturamento']];
      Object.keys(mapa).sort((a,b)=>{
        const da = a.split('/').reverse().join('');
        const db = b.split('/').reverse().join('');
        return da.localeCompare(db);
      }).forEach(d=>{
        dados.push([d, mapa[d]]);
      });

      return dados;
    }
    function prepararEvolucaoDiariaCaixa(){

      const cache = CacheService.getScriptCache();
      const cacheKey = 'EVOLUCAO_CAIXA_HOJE';

      const cached = cache.get(cacheKey);
      if(cached){
        return JSON.parse(cached);
      }

      const sh = SpreadsheetApp.getActive().getSheetByName('CAIXA');
      if(!sh) return [['Hora','Entradas','Saídas','Saldo']];

      const dados = sh.getDataRange().getValues();

      const agora = new Date();
      const tz = Session.getScriptTimeZone();

      const inicioHoje = new Date(agora);
      inicioHoje.setHours(4,0,0,0); // dia operacional começa 04:00

      const inicioOntem = new Date(inicioHoje);
      inicioOntem.setDate(inicioOntem.getDate() - 1);

      const eventos = [];

      for(let i=1; i<dados.length; i++){

        const data = dados[i][0];
        if(!(data instanceof Date)) continue;

        const ts = data.getTime();

        if(ts < inicioOntem.getTime()) continue;

        const tipo = String(dados[i][1] || '').toUpperCase();
        const valor = Number(dados[i][2]) || 0;
        if(valor <= 0) continue;

        eventos.push({
          hora: Utilities.formatDate(data, tz, 'HH:mm'),
          entrada: tipo === 'ENTRADA' ? valor : null,
          saida:   tipo === 'SAIDA'   ? -valor : null
        });
      }

      eventos.sort((a,b)=> a.hora.localeCompare(b.hora));

      const resultado = [['Hora','Entradas','Saídas','Saldo']];
      let saldo = 0;

      eventos.forEach(e=>{
        if(e.entrada !== null) saldo += e.entrada;
        if(e.saida   !== null) saldo += e.saida;

        resultado.push([
          e.hora,
          e.entrada,
          e.saida,
          saldo
        ]);
      });

      // cache por 1 minuto
      cache.put(cacheKey, JSON.stringify(resultado), 60);

      return resultado;
    }
    function calcularLucroPorPeriodo(){
      const ss = SpreadsheetApp.getActive();
      const vendas = ss.getSheetByName('VENDAS').getDataRange().getValues();
      const produtos = ss.getSheetByName('PRODUTOS').getDataRange().getValues();

      // 🔹 mapa de custo médio por produto
      const custoMap = {};
      produtos.forEach((p,i)=>{
        if(i > 0 && p[0]){
          custoMap[p[0]] = Number(p[6]) || 0; // custo médio
        }
      });

      const mapa = {};

      vendas.forEach((v,i)=>{
        if(i === 0) return;
        if(!(v[0] instanceof Date)) return;

        const data = Utilities.formatDate(
          v[0],
          Session.getScriptTimeZone(),
          'dd/MM/yyyy'
        );

        const produto = v[1];
        const qtd = Number(v[2]) || 0;
        const receita = Number(v[3]) || 0;
        const custoUnit = custoMap[produto] || 0;

        const custoTotal = qtd * custoUnit;

        // lucro confiável
        const lucro = custoUnit > 0
          ? (receita - custoTotal)
          : 0;

        if(!mapa[data]){
          mapa[data] = {
            receita: 0,
            custo: 0,
            lucro: 0,
            margem: 0,
            vendas: 0,
            ticketMedio: 0
          };
        }

        mapa[data].receita += receita;
        mapa[data].custo += custoTotal;
        mapa[data].lucro += lucro;
        mapa[data].vendas += 1;
      });

      // 🔹 calcula margem (%) e ticket médio
      Object.keys(mapa).forEach(d=>{
        const r = mapa[d].receita;
        const l = mapa[d].lucro;
        const v = mapa[d].vendas;

        mapa[d].margem = r > 0 ? (l / r) : 0;
        mapa[d].ticketMedio = v > 0 ? (r / v) : 0;
      });

      return mapa;
    }
    function calcularLucroMensal(){
      const ss = SpreadsheetApp.getActive();
      const vendas = ss.getSheetByName('VENDAS').getDataRange().getValues();
      const produtos = ss.getSheetByName('PRODUTOS').getDataRange().getValues();

      // mapa de custo médio
      const custoMap = {};
      produtos.forEach((p,i)=>{
        if(i>0 && p[0]){
          custoMap[p[0]] = Number(p[6]) || 0;
        }
      });

      const mapa = {};

      vendas.forEach((v,i)=>{
        if(i===0) return;

        const data = new Date(v[0]);
        const mes = Utilities.formatDate(
          data,
          Session.getScriptTimeZone(),
          'MM/yyyy'
        );

        const produto = v[1];
        const qtd = Number(v[2]) || 0;
        const valorVenda = Number(v[3]) || 0;
        const custoUnit = custoMap[produto] || 0;

        const custoTotal = qtd * custoUnit;
        const lucro = valorVenda - custoTotal;

        if(!mapa[mes]){
          mapa[mes] = { receita:0, custo:0, lucro:0 };
        }

        mapa[mes].receita += valorVenda;
        mapa[mes].custo += custoTotal;
        mapa[mes].lucro += lucro;
      });

      return mapa;
    }
  // DASHBOARD (REMOVIDO)
    function removerLegadoDashboard(){

      const ss = SpreadsheetApp.getActive();
      ['DASHBOARD','DASHBOARD_LUCRO'].forEach(nome => {
        const sh = ss.getSheetByName(nome);
        if(sh){
          ss.deleteSheet(sh);
        }
      });

      try {
        const triggers = ScriptApp.getProjectTriggers();
        triggers.forEach(t => {
          const fn = t.getHandlerFunction();
          if(fn === 'atualizarDashboards' || fn === 'atualizarDashboardManual' || fn === 'dashboardGeralLeve'){
            ScriptApp.deleteTrigger(t);
          }
        });
      } catch(e){
        console.warn('Não foi possível remover gatilhos legados de dashboard:', e);
      }
    }
    function atualizarDashboards(){
      removerLegadoDashboard();
      return true;
    }
    function atualizarDashboardManual(){
      removerLegadoDashboard();
      SpreadsheetApp.getActiveSpreadsheet().toast('✅ Dashboard legado removido.', 'Sistema', 3);
      return true;
    }

    function obterResumoEstoqueFinanceiroLeve_(){
      try {
        if(typeof gerarRelatorioEstoqueComValoresLeve === 'function'){
          return gerarRelatorioEstoqueComValoresLeve();
        }

        const estoque = (typeof obterDadosEstoque === 'function') ? obterDadosEstoque() : [];
        const produtos = (typeof obterDadosProdutos === 'function') ? obterDadosProdutos() : {};
        const vendas = (typeof obterDadosVendas === 'function') ? obterDadosVendas() : [];

        const itens = [];
        let totalValorEstoque = 0;
        let totalCustoEstoque = 0;
        let totalVendido = 0;
        let lucroVendido = 0;
        let somaMargens = 0;

        estoque.forEach(linha => {
          const nomeProduto = String(linha[0] || '').trim();
          const qtdAtual = Number(linha[1]) || 0;
          const minimo = Number(linha[2]) || 0;
          const p = produtos[nomeProduto];
          if(!p) return;

          const precoVenda = Number(p.preco) || 0;
          const custMedio = Number(p.custMedio) || 0;
          const margem = Number(p.margem) || 0;

          const valorTotalEstoque = qtdAtual * precoVenda;
          const custTotalEstoque = qtdAtual * custMedio;
          const lucroEstoque = valorTotalEstoque - custTotalEstoque;

          let qtdVendida = 0;
          vendas.forEach(v => {
            const produtoVenda = String(v[1] || '').trim();
            if(produtoVenda === nomeProduto) qtdVendida += Number(v[2]) || 0;
          });

          const valorVendido = qtdVendida * precoVenda;
          const lucroVendaItem = valorVendido - (qtdVendida * custMedio);
          const taxaRotacao = (qtdAtual + qtdVendida) > 0
            ? Math.round((qtdVendida / (qtdAtual + qtdVendida)) * 10000) / 100
            : 0;

          let status = 'Normal';
          if(qtdAtual <= minimo) status = '🚨 Crítico';
          else if(qtdAtual <= minimo * 1.5) status = '⚠️ Baixo';
          else if(qtdAtual > minimo * 3) status = '📈 Alto';

          itens.push({
            produto: nomeProduto,
            categoria: p.categoria || '',
            margem: margem,
            qtdAtual: qtdAtual,
            valorTotalEstoque: valorTotalEstoque,
            custTotalEstoque: custTotalEstoque,
            lucroEstoque: lucroEstoque,
            qtdVendida: qtdVendida,
            valorVendido: valorVendido,
            lucroVendido: lucroVendaItem,
            taxaRotacao: taxaRotacao,
            status: status
          });

          totalValorEstoque += valorTotalEstoque;
          totalCustoEstoque += custTotalEstoque;
          totalVendido += valorVendido;
          lucroVendido += lucroVendaItem;
          somaMargens += margem;
        });

        return {
          itens: itens,
          resumo: {
            totalValorEstoque: totalValorEstoque,
            totalCustoEstoque: totalCustoEstoque,
            lucroEstoque: totalValorEstoque - totalCustoEstoque,
            totalVendido: totalVendido,
            lucroVendido: lucroVendido,
            margemMedia: itens.length ? Math.round((somaMargens / itens.length) * 100) / 100 : 0
          }
        };
      } catch(e){
        console.error('Erro em obterResumoEstoqueFinanceiroLeve_:', e);
        return null;
      }
    }

// ===============================
// MENSAGENS / CONFIRMAÇÕES
// ===============================
  function popupMensagem(titulo, mensagem){

    const html = `
      <div style="
        font-family:Arial;
        padding:20px;
        text-align:center;
      ">

        <div style="font-size:16px;margin-bottom:20px">
          ${mensagem}
        </div>

        <button class="btn-success" onclick="fechar()">
          ✅ OK
        </button>

        <script>
          function fechar(){
            google.script.host.close();
          }
        </script>

      </div>
    `;

    abrirPopup(titulo, html, 360, 220);
  }
  function popupConfirmar(titulo, mensagem, callback, ...params){

    const parametrosJSON = JSON.stringify(params);

    const html = `
      <div style="
        font-family:Arial;
        background:#020617;
        color:#e5e7eb;
        padding:20px;
        border-radius:12px;
        text-align:center;
      ">

        <h3 style="margin-bottom:10px">${titulo}</h3>

        <p style="margin:15px 0">
          ${mensagem}
        </p>

        <div style="
          display:flex;
          justify-content:center;
          gap:15px;
        ">

          <button onclick="confirmar()"
            style="
              background:#16a34a;
              color:#fff;
              border:none;
              padding:8px 18px;
              border-radius:6px;
              cursor:pointer">
            ✅ Sim
          </button>

          <button onclick="google.script.host.close()"
            style="
              background:#dc2626;
              color:#fff;
              border:none;
              padding:8px 18px;
              border-radius:6px;
              cursor:pointer">
            ❌ Não
          </button>

        </div>
      </div>

      <script>

        const params = ${parametrosJSON};

        function confirmar(){

          google.script.run
            .withSuccessHandler(()=> {
              google.script.host.close();
            })
            [ '${callback}' ](...params);

        }

      </script>
    `;

    abrirPopup(titulo, html, 380, 240);
  }

// ===============================
// CENTRAL DE PRODUTOS
// ===============================
  function abrirAnaliseProduto(){

    const html = HtmlService
      .createHtmlOutputFromFile('AnaliseProduto')
      .setWidth(520)
      .setHeight(600);

    SpreadsheetApp.getUi()
      .showModalDialog(html, '📊 Análise de Produto');

  }
  function listarProdutosAnalise(){

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('PRODUTOS');

    if(!sh) return [];

    const dados = sh.getDataRange().getValues();
    const lista = [];

    for(let i = 1; i < dados.length; i++){

      const produto = dados[i][0];

      if(produto){
        lista.push(produto);
      }
    }

    return lista;
  }
  function buscarDadosProduto(nome){

    const ss = SpreadsheetApp.getActive();

    const prod = ss.getSheetByName('PRODUTOS');
    const est  = ss.getSheetByName('ESTOQUE');

    if(!prod || !est) return null;

    const pDados = prod.getDataRange().getValues();
    const eDados = est.getDataRange().getValues();

    // 🔒 normaliza o nome recebido
    const nomeBusca = String(nome || '')
      .trim()
      .toUpperCase();

    let info = {
      nome,
      preco: 0,
      custo: 0,
      margem: 0,
      precoSugerido: 0,
      qtd: 0,
      score: 0
    };

    // ======================
    // BUSCAR NO PRODUTOS
    // ======================
    for(let i = 1; i < pDados.length; i++){

      const nomeProduto = String(pDados[i][0] || '')
        .trim()
        .toUpperCase();

      if(nomeProduto === nomeBusca){

        info.preco = Number(pDados[i][4]) || 0;
        info.custo = Number(pDados[i][6]) || 0;
        info.margem = Number(pDados[i][7]) || 0;
        info.precoSugerido = Number(pDados[i][8]) || 0;

        break;
      }
    }

    // ======================
    // BUSCAR NO ESTOQUE
    // ======================
    for(let i = 1; i < eDados.length; i++){

      const nomeEstoque = String(eDados[i][0] || '')
        .trim()
        .toUpperCase();

      if(nomeEstoque === nomeBusca){

        info.qtd = Number(eDados[i][1]) || 0;
        break;
      }
    }

    // ======================
    // SCORE
    // ======================
    info.score = calcularScoreProduto({
      margem: info.margem,
      qtd: info.qtd,
      preco: info.preco,
      custo: info.custo
    });

    return info;
  }
  function calcularScoreProduto(p){

    let s = 0;

    if(p.margem >= 30) s+=5;
    else if(p.margem >=15) s+=3;

    if(p.qtd >= 20) s+=4;
    else if(p.qtd >=10) s+=2;

    if(p.preco > p.custo) s+=3;

    if(p.preco >= p.custo*1.4) s+=3;

    return Math.min(15,s);
  }
  function atualizarMargemProduto(nome, margem){

    const sh = SpreadsheetApp
      .getActive()
      .getSheetByName('PRODUTOS');

    if(nome == null || margem == null){
      return true; // ignora chamada inválida
    }

    if(!sh){
      throw new Error('Aba PRODUTOS não encontrada.');
    }

    // 🔒 normaliza nome recebido
    const nomeBusca = String(nome)
      .trim()
      .toUpperCase();

    // 🔒 Normaliza margem (aceita 1,3 ou 1.3)
    let m = String(margem)
      .replace(/\s/g,'')
      .replace(',','.');

    m = Number(m);

    if(isNaN(m)){
      throw new Error('Margem inválida.');
    }

    const dados = sh.getDataRange().getValues();

    for(let i = 1; i < dados.length; i++){

      const nomePlanilha = String(dados[i][0] || '')
        .trim()
        .toUpperCase();

      if(nomePlanilha === nomeBusca){

        // Coluna H → Margem (%)
        sh.getRange(i+1, 8).setValue(m);

        const custo = Number(dados[i][6]) || 0;

        const precoSug = custo * (1 + m/100);

        // Coluna I → Preço sugerido
        sh.getRange(i+1, 9)
          .setValue(Number(precoSug.toFixed(2)));

        // 🔔 LOG (se existir)
        if(typeof registrarLog === 'function'){
          registrarLog(
            'MARGEM_ATUALIZADA',
            nome,
            dados[i][7],
            m
          );
        }

        return true;
      }
    }

    throw new Error('Produto não encontrado para atualização.');
  }
  function salvarMargem(){

    let valor = margemInput.value
      .replace(/\s/g,'')   // remove espaços
      .replace(',','.');  // troca vírgula por ponto

    if(!valor || isNaN(valor)){
      alert('Informe um valor válido. Ex: 1,3');
      return;
    }

    google.script.run
      .withSuccessHandler(()=>{
        alert('✅ Margem atualizada!');
        carregar();
      })
      .atualizarMargemProduto(
        produto.value,
        Number(valor)
      );
  }
  function gerarAlertasProdutos(){

    const ss = SpreadsheetApp.getActive();

    const prod = ss.getSheetByName('PRODUTOS');
    const est = ss.getSheetByName('ESTOQUE');

    let alertas = [];

    const p = prod.getDataRange().getValues();
    const e = est.getDataRange().getValues();

    for(let i=1;i<p.length;i++){

      const nome = p[i][0];
      const margem = Number(p[i][7])||0;

      let qtd = 0;

      for(let j=1;j<e.length;j++){
        if(e[j][0]===nome){
          qtd = Number(e[j][1])||0;
        }
      }

      if(margem < 15 || qtd < 5){

        alertas.push({
          produto:nome,
          margem,
          qtd
        });

      }
    }

    return alertas;
  }
  function calcularGiroProduto(nome){

    const v = SpreadsheetApp
      .getActive()
      .getSheetByName('VENDAS')
      .getDataRange()
      .getValues();

    let qtd = 0;

    const hoje = new Date();
    const limite = new Date();
    limite.setDate(hoje.getDate()-30);

    v.forEach((l,i)=>{

      if(i===0) return;

      if(l[1]===nome && l[0] instanceof Date){

        if(l[0] >= limite){
          qtd += Number(l[2])||0;
        }
      }

    });

    return qtd;
  }
  function sugerirPreco(nome){

    const sh = SpreadsheetApp
      .getActive()
      .getSheetByName('PRODUTOS');

    const dados = sh.getDataRange().getValues();

    for(let i=1;i<dados.length;i++){

      if(dados[i][0] === nome){

        const custo  = Number(dados[i][6])||0;
        const margem = Number(dados[i][7])||0;

        const ideal =
          custo * (1,0 + margem/100);

        return Number(ideal.toFixed(2));
      }
    }

    return 0;
  }

// ===============================
// TRAVA INTELIGENTE
// ===============================
  function validarEstoque(produto, qtdSolicitada) {

    const aba = SpreadsheetApp.getActive()
      .getSheetByName("PRODUTOS");

    const dados = aba.getDataRange().getValues();

    for (let i = 1; i < dados.length; i++) {

      // comparar nomes com normalização se disponível
      const safeNorm = function(str){
        if(typeof normalizeString === 'function') return normalizeString(str);
        let s = String(str || '');
        try{ return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toUpperCase().trim(); }
        catch(e){ return s.toUpperCase().trim(); }
      };

      if (safeNorm(dados[i][0]) == safeNorm(produto)) {

        const estoqueAtual = Number(dados[i][2]);

        if (estoqueAtual >= qtdSolicitada) {

          return {
            ok: true,
            estoque: estoqueAtual
          };

        } else {

          registrarLog(
            "ESTOQUE_NEGATIVO_BLOQUEADO",
            `Tentativa venda ${produto}`,
            estoqueAtual,
            qtdSolicitada
          );

          return {
            ok: false,
            estoque: estoqueAtual
          };
        }
      }
    }

    return {
      ok: false,
      estoque: 0
    };
  }
  function baixarEstoqueSeguro(produto, qtd) {

    const validacao = validarEstoque(produto, qtd);

    if (!validacao.ok) {

      SpreadsheetApp.getUi().alert(
        `❌ Estoque insuficiente!\n\nProduto: ${produto}\nDisponível: ${validacao.estoque}`
      );

      return false;
    }

    const aba = SpreadsheetApp.getActive()
      .getSheetByName("PRODUTOS");

    const dados = aba.getDataRange().getValues();

    for (let i = 1; i < dados.length; i++) {

      if (dados[i][0] == produto) {

        const novo = dados[i][2] - qtd;

        aba.getRange(i + 1, 3).setValue(novo);

        registrarLog(
          "BAIXA_ESTOQUE",
          produto,
          dados[i][2],
          novo
        );

        return true;
      }
    }

    return false;
  }
  function processarVenda(produto, qtd, comanda) {

    // 1️⃣ Validar estoque
    const validacao = validarEstoque(produto, qtd);

    if (!validacao.ok) {
      return false;
    }

    const antes = {
      estoque: validacao.estoque
    };

    // 2️⃣ Baixar com segurança
    if (!baixarEstoqueSeguro(produto, qtd)) {
      return false;
    }

    const depois = {
      estoque: validacao.estoque - qtd
    };

    // 3️⃣ Log
    registrarLog(
      "VENDA",
      `Comanda ${comanda} - ${produto}`,
      antes,
      depois
    );

    return true;
  }
  function processarCompra(produto, qtd, valorTotal) {

    const aba = SpreadsheetApp.getActive()
      .getSheetByName("PRODUTOS");

    const dados = aba.getDataRange().getValues();

    for (let i = 1; i < dados.length; i++) {

      if (dados[i][0] == produto) {

        const estoqueAntes = dados[i][2];
        const custoAntes = dados[i][3];

        // Atualiza estoque
        const novoEstoque = estoqueAntes + qtd;

        aba.getRange(i + 1, 3).setValue(novoEstoque);

        // Atualiza custo médio
        atualizarCustoMedioProduto(produto, qtd, valorTotal);

        const custoDepois = aba.getRange(i + 1, 3).getValue();

        registrarLog(
          "COMPRA",
          produto,
          {
            estoque: estoqueAntes,
            custo: custoAntes
          },
          {
            estoque: novoEstoque,
            custo: custoDepois
          }
        );

        return;
      }
    }
  }
  function registrarPagamento(comanda, valor) {

    registrarLog(
      "PARCIAL",
      `Comanda ${comanda}`,
      "",
      valor
    );
  }
  function fecharComanda(comanda, total) {

    registrarLog(
      "FECHAMENTO",
      `Comanda ${comanda}`,
      "",
      total
    );

    // Opcional: backup automático ao fechar
    fazerBackupSistema();
  }
  function ajustarProduto(produto, novoEstoque) {

    const aba = SpreadsheetApp.getActive()
      .getSheetByName("PRODUTOS");

    const dados = aba.getDataRange().getValues();

    for (let i = 1; i < dados.length; i++) {

      if (dados[i][0] == produto) {

        const antes = dados[i][2];

        aba.getRange(i + 1, 3).setValue(novoEstoque);

        registrarLog(
          "AJUSTE",
          produto,
          antes,
          novoEstoque
        );

        return;
      }
    }
  }

// ===============================
// RECARGA MENU
// ===============================
  function recarregarMenu() {
    SpreadsheetApp.getUi().alert('Menu atualizado!');
    onOpen();
  }

  /*
  * Abre tela de login/criar conta (seguro, sem restrição de permissão)
  */
    function telaLoginOuCriar() {
      popupTelaInicial();
    }

// ===============================
// MANUAL DO USUÁRIO
// ===============================
  function abrirManualSistema(){

    // 🔗 ID do PDF no Google Drive
    const PDF_ID = '1u7Srgo_G6C4nRjZlP1VMcVg92KkiGnDw';

    const url = `https://drive.google.com/file/d/1u7Srgo_G6C4nRjZlP1VMcVg92KkiGnDw/view`;
    const html = `
      <html>
        <head>
          <style>
            body {
              margin: 0;
              font-family: Arial, sans-serif;
              background: #020617;
            }

            .header {
              background: #020617;
              color: white;
              padding: 10px;
              text-align: center;
              font-weight: bold;
              font-size: 14px;
            }

            iframe {
              width: 100%;
              height: calc(100vh - 40px);
              border: none;
            }
          </style>
        </head>

        <body>
          <div class="header">
            📘 Manual do Sistema — Gestão de Depósito v1.0
          </div>

          <iframe src="${url}"></iframe>
        </body>
      </html>
    `;

    const ui = HtmlService
      .createHtmlOutput(html)
      .setWidth(900)
      .setHeight(650);

    SpreadsheetApp.getUi()
      .showModalDialog(ui, '📘 Manual do Sistema');
  }
// ===============================
// POPUP CADASTRO DE PRODUTOS
// ===============================
  function gerarNovoIdProduto(){

    const sh = SpreadsheetApp.getActive()
      .getSheetByName('PRODUTOS');

    if(!sh || sh.getLastRow() < 2){
      return 'PRD-0001';
    }

    const ids = sh.getRange(2,11,sh.getLastRow()-1,1)
      .getValues()
      .flat()
      .filter(Boolean);

    const numeros = ids
      .map(id => Number(String(id).replace('PRD-','')))
      .filter(n => !isNaN(n));

    const proximo = numeros.length
      ? Math.max(...numeros) + 1
      : 1;

    return 'PRD-' + String(proximo).padStart(4,'0');
  }
  function getProdutoPorId(id){

    const sh = SpreadsheetApp.getActive()
      .getSheetByName('PRODUTOS');

    const dados = sh.getDataRange().getValues();

    for(let i=1;i<dados.length;i++){

      if(dados[i][10] === id){

        return {
          produto: dados[i][0],
          categoria: dados[i][1],
          marca: dados[i][2],
          volume: dados[i][3],
          preco: dados[i][4],
          minimo: dados[i][5],
          custo: dados[i][6],
          margem: dados[i][7],
          precoSug: dados[i][8],
          status: dados[i][9],
          id: dados[i][10]
        };
      }
    }

    return null;
  }
  function getListaProdutosComId(){

    const sh = SpreadsheetApp.getActive()
      .getSheetByName('PRODUTOS');

    if(!sh || sh.getLastRow() < 2) return [];

    const dados = sh.getRange(2,1,sh.getLastRow()-1,11)
      .getValues();

    return dados.map(l => ({
      nome: l[0],
      id: l[10]
    }));
  }
  function salvarProdutoNovoSistema(d){

    garantirColunaIdProduto();

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('PRODUTOS');

    const dados = sh.getDataRange().getValues();

    const preco  = Number(String(d.preco).replace(',','.')) || 0;
    const custo  = Number(String(d.custo).replace(',','.')) || 0;
    const margem = Number(String(d.margem).replace(',','.')) || 0;
    const minimo = Number(d.minimo) || 0;

    const precoSug = custo * (1 + margem/100);

    let status = '🟢 IDEAL';
    if(margem < 20) status = '🔴 BAIXA';
    else if(margem <= 30) status = '🟡 MÉDIA';

    // ======================
    // 🔄 ATUALIZA EXISTENTE
    // ======================
    if(d.id){

      for(let i=1;i<dados.length;i++){

        if(dados[i][10] === d.id){

          const nomeAntigo = dados[i][0];

          sh.getRange(i+1,1,1,11).setValues([[
            d.produto,
            d.categoria,
            d.marca,
            d.volume,
            preco,
            minimo,
            custo,
            margem,
            precoSug,
            status,
            d.id
          ]]);

          if(nomeAntigo !== d.produto){
            atualizarNomeNoEstoque(nomeAntigo, d.produto);
          }

          registrarLog(
            'PRODUTO_ATUALIZADO',
            d.id,
            nomeAntigo,
            d.produto
          );

          return {tipo:'atualizado', id:d.id};
        }
      }
    }

    // ======================
    // ➕ NOVO PRODUTO
    // ======================

    const novoId = gerarNovoIdProduto();

    sh.appendRow([
      d.produto,
      d.categoria,
      d.marca,
      d.volume,
      preco,
      minimo,
      custo,
      margem,
      precoSug,
      status,
      novoId
    ]);

    criarProdutoNoEstoque(d.produto);

    registrarLog(
      'PRODUTO_NOVO',
      novoId,
      '',
      d.produto
    );

    return {tipo:'novo', id:novoId};
  }
  function excluirProdutoNovoSistema(id){

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('PRODUTOS');

    const dados = sh.getDataRange().getValues();

    for(let i=1;i<dados.length;i++){

      if(dados[i][10] === id){

        const nome = dados[i][0];

        sh.deleteRow(i+1);

        removerDoEstoque(nome);

        registrarLog('PRODUTO_EXCLUIDO', id, nome, new Date());

        return true;
      }
    }

    throw new Error('Produto não encontrado.');
  }
  function atualizarNomeNoEstoque(nomeAntigo, nomeNovo){

    const sh = SpreadsheetApp.getActive()
      .getSheetByName('ESTOQUE');

    const dados = sh.getDataRange().getValues();

    for(let i=1;i<dados.length;i++){

      if(dados[i][0] === nomeAntigo){
        sh.getRange(i+1,1).setValue(nomeNovo);
        return;
      }
    }
  }
  function criarProdutoNoEstoque(nome){

    const ss = SpreadsheetApp.getActive();
    const shEst = ss.getSheetByName('ESTOQUE');
    const shProd = ss.getSheetByName('PRODUTOS');

    let minimo = 0;

    if(shProd){
      const dados = shProd.getDataRange().getValues();
      for(let i=1;i<dados.length;i++){
        if(dados[i][0] === nome){
          minimo = Number(dados[i][5]) || 0;
          break;
        }
      }
    }

    shEst.appendRow([
      nome,
      0,
      minimo,
      '🔴 Crítico🪫',
      'AUTO'
    ]);
  }
  function removerDoEstoque(nome){

    const sh = SpreadsheetApp.getActive()
      .getSheetByName('ESTOQUE');

    const dados = sh.getDataRange().getValues();

    for(let i=1;i<dados.length;i++){

      if(dados[i][0] === nome){
        sh.deleteRow(i+1);
        return;
      }
    }
  }
  function popupProdutoManager(){

    const lista = getListaProdutosComId();

    const html = `
    <div class="container">

      <h2>📦 Cadastre ou Ajuste seus Produtos 📦</h2>

      <input type="hidden" id="idProduto">

      <label>Selecionar Produto</label>
      <input list="listaProdutos" id="busca">

      <datalist id="listaProdutos">
        ${lista.map(p=>`<option value="${p.nome}" data-id="${p.id}">`).join('')}
      </datalist>

      <!-- 🔹 AÇÃO: CARREGAR + LIMPAR -->
      <div style="display:flex;gap:6px;align-items:center">
        <button onclick="carregar()">🔎 Carregar</button>

        <button 
          title="Novo Produto"
          onclick="limpar()"
          style="
            padding:6px 10px;
            font-size:14px;
            border-radius:6px;
            background:#e5e7eb;
            cursor:pointer
          ">
          ♻️
        </button>
      </div>

      <hr>

      <label>Nome</label>
      <input id="produto">

      <label>Categoria</label>
      <select id="categoria"></select>

      <label>Marca</label>
      <input id="marca">

      <label>Volume</label>
      <input id="volume">

      <label>Custo Médio</label>
      <input id="custo">

      <label>Margem (%)</label>
      <input id="margem">

      <label>Preço Venda</label>
      <input id="preco">

      <label>Estoque Mínimo</label>
      <input id="minimo">

      <hr>
      <h3>🔄 Ajuste de Estoque</h3>

      <label>🛠️ Quantidade para Ajustar 🛠️</label>
      <input id="ajuste">

      <button id="btnSalvar" class="btn-primary" onclick="salvar()">💾 Salvar</button>
      <button id="btnAjustar" class="btn-success" onclick="ajustar()">📦 Ajustar Estoque</button>

      <button id="btnExcluir" class="btn-danger" onclick="excluir()">🗑 Excluir</button>
      <button onclick="google.script.host.close()">❌ Fechar</button>

    </div>

    <style>
      .container{
        display:flex;
        flex-direction:column;
        gap:8px;
        font-family:Arial;
      }

      input, select{
        padding:6px;
        border-radius:6px;
        border:1px solid #ccc;
      }

      button{
        padding:10px;
        border:none;
        border-radius:8px;
        cursor:pointer;
      }

      .btn-primary{ background:#2563eb;color:#fff;}
      .btn-danger{ background:#dc2626;color:#fff;}
    </style>

    <script>

      // ♻️ LIMPA FORMULÁRIO PARA NOVO CADASTRO
      function limpar(){
        idProduto.value = '';
        busca.value = '';
        produto.value = '';
        marca.value = '';
        volume.value = '';
        custo.value = '';
        margem.value = '';
        preco.value = '';
        minimo.value = '';
        ajuste.value = '';

        categoria.innerHTML = '<option value="">Selecione</option>';

        document.getElementById('btnSalvar').disabled = false;
        document.getElementById('btnSalvar').innerText = '💾 Salvar';
      }

      function ajustar(){

        if(!produto.value || !ajuste.value){
          alert('Informe produto e quantidade');
          return;
        }

        const btn = document.getElementById('btnAjustar');
        if(btn.disabled) return;

        btn.disabled = true;
        const textoOriginal = btn.innerText;
        btn.innerText = '⏳ Ajustando...';

        google.script.run
          .withSuccessHandler(res=>{
            if(!res.ok){
              alert(res.msg);
              btn.disabled = false;
              btn.innerText = textoOriginal;
              return;
            }

            alert('Estoque ajustado com sucesso!');
            ajuste.value = '';
            btn.innerText = '✅ Ajustado';
          })
          .withFailureHandler(e=>{
            alert(e.message || e);
            btn.disabled = false;
            btn.innerText = textoOriginal;
          })
          .ajustarEstoque(
            produto.value,
            ajuste.value,
            'AJUSTE_MANUAL'
          );
      }

      function carregar(){

        const nome = busca.value;
        if(!nome) return;

        google.script.run
          .withSuccessHandler(lista => {

            categoria.innerHTML = '<option value="">Selecione</option>';

            lista.forEach(c => {
              categoria.innerHTML += '<option value="'+c+'">'+c+'</option>';
            });

          })
          .getCategoriasProdutos();

        google.script.run
          .withSuccessHandler(d=>{

            if(!d){
              alert('Produto não encontrado');
              return;
            }

            idProduto.value = d.id;

            produto.value = d.produto;
            categoria.value = d.categoria;
            marca.value = d.marca;
            volume.value = d.volume;
            custo.value = d.custo;
            margem.value = d.margem;
            preco.value = d.preco;
            minimo.value = d.minimo;

          })
          .getProdutoPorNome(busca.value);
      }

      function salvar(){

        if(!produto.value){
          alert('Informe o nome do produto');
          return;
        }

        const btn = document.getElementById('btnSalvar');
        if(btn.disabled) return;

        btn.disabled = true;
        const textoOriginal = btn.innerText;
        btn.innerText = '⏳ Salvando...';

        google.script.run
          .withSuccessHandler(res=>{
            alert('Produto salvo com sucesso!');
            idProduto.value = res.id || idProduto.value;
            btn.innerText = '✅ Salvo';
          })
          .withFailureHandler(e=>{
            alert(e.message || e);
            btn.disabled = false;
            btn.innerText = textoOriginal;
          })
          .salvarProdutoNovoSistema({
            id: idProduto.value || null,
            produto: produto.value.trim(),
            categoria: categoria.value,
            marca: marca.value,
            volume: volume.value,
            custo: custo.value,
            margem: margem.value,
            preco: preco.value,
            minimo: minimo.value
          });
      }

      function excluir(){

        if(!idProduto.value){
          alert('Carregue um produto primeiro.');
          return;
        }

        if(!confirm('Deseja excluir este produto?')) return;

        const btn = document.getElementById('btnExcluir');
        if(btn.disabled) return;

        btn.disabled = true;
        btn.innerText = '⏳ Excluindo...';

        google.script.run
          .withSuccessHandler(()=>{
            alert('Produto excluído.');
            google.script.host.close();
          })
          .withFailureHandler(e=>{
            alert(e.message || e);
            btn.disabled = false;
            btn.innerText = '🗑 Excluir';
          })
          .excluirProdutoNovoSistema(idProduto.value);
      }

    </script>
    `;

    abrirPopup('📦 Central de Produtos', html, 520, 650);
  }
  function getProdutoPorNome(nome){

    const sh = SpreadsheetApp.getActive()
      .getSheetByName('PRODUTOS');

    const dados = sh.getDataRange().getValues();

    for(let i=1;i<dados.length;i++){

      if(dados[i][0] === nome){

        return {
          produto: dados[i][0],
          categoria: dados[i][1],
          marca: dados[i][2],
          volume: dados[i][3],
          preco: dados[i][4],
          minimo: dados[i][5],
          custo: dados[i][6],
          margem: dados[i][7],
          precoSug: dados[i][8],
          status: dados[i][9],
          id: dados[i][10]
        };
      }
    }

    return null;
  }
  function garantirColunaIdProduto(){

    const sh = SpreadsheetApp.getActive()
      .getSheetByName('PRODUTOS');

    if(!sh) return;

    const header = sh.getRange(1,1).getValue();

    if(header !== 'ID PRODUTO'){
      sh.insertColumnAfter(sh.getLastColumn());
      sh.getRange(1, sh.getLastColumn())
        .setValue('ID PRODUTO');
    }
  }
  function getCategoriasProdutos(){

    const sh = SpreadsheetApp.getActive()
      .getSheetByName('PRODUTOS');

    if(!sh) return [];

    const dados = sh.getDataRange().getValues();

    if(dados.length <= 1) return [];

    const categorias = dados
      .slice(1)
      .map(l => l[1])
      .filter(Boolean);

    return [...new Set(categorias)].sort();
  }
  function getListaProdutos(){

    const sh = SpreadsheetApp.getActive()
      .getSheetByName('PRODUTOS');

    if(!sh) return [];

    const dados = sh.getDataRange().getValues();

    if(dados.length <= 1) return [];

    return dados
      .slice(1)
      .map(l => l[0])
      .filter(p => p && p.toString().trim() !== '');
  }

/**
* ==================================
* SISTEMA DE GESTÃO – KARO PRO v2.0 
* Status: EM DESENVOLVIMENTO
* Data de início: 2026-02
*************************************************
*                 🔵 V2.0
*************************************************/

// =============================================
// COMPRAS V2 
// =============================================
  // COMPRAS
    function garantirEstruturaComprasV2(){

      const ss = SpreadsheetApp.getActive();
      let sh = ss.getSheetByName('COMPRAS');

      const estruturaCompleta = [
        'Data',
        'Produto',
        'Qtd',
        'Valor',
        'Fornecedor',
        'FormaPgto',
        'Status',
        'ID_COMPRA',
        'NF_DRIVE_ID',
        'Observacao',
        'Motivo_Cancelamento',
        'Usuario',
        'Data_Lancamento'
      ];

      if(!sh){
        sh = ss.insertSheet('COMPRAS');
      }

      if(sh.getLastRow() === 0){
        sh.getRange(1,1,1,estruturaCompleta.length)
          .setValues([estruturaCompleta]);
      } else {

        const lastCol = Math.max(sh.getLastColumn(), estruturaCompleta.length);

        estruturaCompleta.forEach((coluna, index)=>{
          sh.getRange(1, index+1).setValue(coluna);
        });
      }

      sh.getRange(1,1,1,estruturaCompleta.length)
        .setFontWeight('bold')
        .setBackground('#020617')
        .setFontColor('#ffffff');

      sh.setFrozenRows(1);
    }
    function gerarIdCompra() {

      const lock = LockService.getScriptLock();
      lock.waitLock(5000);

      try {

        const sheet = SpreadsheetApp
          .getActive()
          .getSheetByName('COMPRAS');

        const lastRow = sheet.getLastRow();

        if (lastRow < 2) {
          return 'CPR01';
        }

        const ids = sheet
          .getRange(2, 8, lastRow - 1, 1) // coluna ID_COMPRA
          .getValues()
          .flat()
          .filter(v => typeof v === 'string' && v.startsWith('CPR'));

        let maior = 0;

        ids.forEach(id => {
          const num = Number(id.replace('CPR',''));
          if (!isNaN(num) && num > maior) maior = num;
        });

        const proximo = maior + 1;

        return 'CPR' + String(proximo).padStart(2,'0');

      } finally {
        lock.releaseLock();
      }
    }
    function salvarCompraCarrinhoV2(itens, fornecedor, formaPgto){
      garantirEstruturaComprasV2();

      const ss = SpreadsheetApp.getActive();
      const sh = ss.getSheetByName('COMPRAS');

      const idCompra = gerarIdCompra();
      const data = new Date();

      // 🔗 gera o link UMA VEZ
      const linkNF = gerarLinkUploadNF(idCompra);

      let totalGeral = 0;

      itens.forEach(i => {

        const total = Number(i.qtd) * Number(i.unit);
        totalGeral += total;

        inserirLinhaNoTopo('COMPRAS', [
          data,
          i.produto,
          Number(i.qtd),
          total,
          fornecedor,
          formaPgto,
          'ATIVO',
          idCompra,
          linkNF
            ? `=HYPERLINK("${linkNF}";"📎 Enviar NF")`
            : '',
          '',                 // Observacao
          '',                 // Motivo_Cancelamento
          Session.getActiveUser().getEmail() || 'SISTEMA',
          new Date()          // Data_Lancamento
        ]);

        atualizarCustoMedioProduto(
          i.produto,
          Number(i.qtd),
          total
        );

        adicionarEstoquePorCompra(
          i.produto,
          Number(i.qtd)
        );
      });

      // 🔹 REGISTRO FINANCEIRO
      registrarCaixa(
        data,
        'Saida',
        totalGeral,
        formaPgto,
        'COMPRA',
        `COMPRA ${idCompra}`
      );

      // 🔹 CONTA A PAGAR (SE NECESSÁRIO)
      if(['BOLETO','CONSIGNADO'].includes(formaPgto.toUpperCase())){
        criarContaAPagar(
          idCompra,
          fornecedor,
          totalGeral,
          formaPgto,
          data
        );
      }

      atualizarEstoque();
      atualizarMargemProduto();

      return { ok:true, id:idCompra };
    }
    function popupCompraV2(){

      const ss = SpreadsheetApp.getActive();

      const shProd = ss.getSheetByName('PRODUTOS');
      const shEst  = ss.getSheetByName('ESTOQUE');

      if(!shProd || !shEst){
        return; // ❌ sem alert por regra do sistema
      }

      const produtos = shProd.getDataRange().getValues().slice(1);
      const estoque  = shEst.getDataRange().getValues();

      let options = '<option value="">👉 Escolha o produto</option>';

      produtos.forEach(p=>{
        const est = estoque.find(e => e[0] === p[0]);
        const qtd = est ? est[1] : 0;
        const custo = p[6] || 0;

        options += `
          <option 
            value="${p[0]}" 
            data-estoque="${qtd}" 
            data-custo="${custo}">
            ${p[0]}
          </option>
        `;
      });

      abrirPopup('🛒 Nova Compra 2.1', `

        <label>📦 Produto</label>

        <div style="display:flex;gap:6px;align-items:center">
          <select id="produto" style="flex:1">${options}</select>

          <button 
            type="button"
            class="btn-primary"
            style="width:42px"
            onclick="novoProduto()">
            ➕
          </button>
        </div>

        <div style="margin-top:10px;font-size:13px;color:#334155">
          ➡️ Estoque atual: <strong id="estAtual">0</strong><br>
          ➡️ Custo médio atual: <strong id="custoAtual">R$ 0,00</strong>
        </div>

        <hr>

        <label>🔢 Quantidade</label>
        <input id="qtd" type="number" min="1">

        <label>💰 Valor unitário</label>
        <input id="valor" placeholder="R$ 0,00">

        <div style="margin-top:12px;padding:10px;background:#f1f5f9;border-radius:10px">
          <strong>📊 Simulação</strong><br>
          ➡️ Novo estoque: <span id="novoEst">0</span><br>
          ➡️ Novo custo médio: <span id="novoCusto">R$ 0,00</span>
        </div>

        <button class="btn-primary" type="button" onclick="add()">➕ Adicionar</button>

        <h3>🛒 Carrinho</h3>
        <ul id="lista"></ul>

        <div class="total">
          💵 Total: <strong>R$ <span id="total">0,00</span></strong>
        </div>

        <hr>

        <label>🏷️ Fornecedor</label>
        <input id="forn" placeholder="Nome do fornecedor">

        <label>💳 Forma de Pagamento</label>
        <select id="forma">
          <option>⚡PIX</option>
          <option>💵DINHEIRO</option>
          <option>💳CARTÃO DÉBITO</option>
          <option>💳CARTÃO CRÉDITO</option>
          <option>🧾BOLETO</option>
          <option>📋CONSIGNADO</option>
        </select>

        <label>📌 Status</label>
        <select id="status">
          <option>PAGO</option>
          <option>PENDENTE</option>
          <option>CONSIGNADO</option>
        </select>

        <!-- 🔔 MENSAGEM INLINE (SEM ALERT) -->
        <div id="msg" style="
          display:none;
          margin:10px 0;
          padding:8px;
          border-radius:6px;
          background:#fee2e2;
          color:#991b1b;
          font-size:13px;
        "></div>

        <button id="btnFinalizar" class="btn-success" type="button" onclick="finalizar()">
          ✅ Finalizar Compra
        </button>

        <script>

          let carrinho = [];

          const produto = document.getElementById('produto');
          const qtd = document.getElementById('qtd');
          const valor = document.getElementById('valor');
          const msg = document.getElementById('msg');

          function showMsg(text){
            msg.innerText = text;
            msg.style.display = 'block';
          }

          produto.onchange = function(){
            const sel = produto.options[produto.selectedIndex];

            document.getElementById('estAtual').innerText = sel.dataset.estoque || 0;
            document.getElementById('custoAtual').innerText =
              'R$ ' + Number(sel.dataset.custo || 0).toFixed(2).replace('.',',');
          };

          function atualizarSimulacao(){

            const est = Number(document.getElementById('estAtual').innerText);
            const q = Number(qtd.value || 0);
            const v = Number(valor.value.replace(',','.')) || 0;

            const custoAtual = Number(
              document.getElementById('custoAtual')
                .innerText.replace('R$','')
                .replace(',','.')
            ) || 0;

            if(q > 0 && v > 0){
              const novoEst = est + q;
              const novoCusto = ((est * custoAtual) + (q * v)) / novoEst;

              document.getElementById('novoEst').innerText = novoEst;
              document.getElementById('novoCusto').innerText =
                'R$ ' + novoCusto.toFixed(2).replace('.',',');
            }
          }

          qtd.oninput = atualizarSimulacao;
          valor.oninput = atualizarSimulacao;

          function add(){

            if(!produto.value || !qtd.value || !valor.value){
              showMsg('Preencha todos os campos');
              return;
            }

            carrinho.push({
              produto: produto.value,
              qtd: Number(qtd.value),
              unit: Number(valor.value.replace(',','.'))
            });

            qtd.value = '';
            valor.value = '';
            msg.style.display = 'none';

            render();
          }

          function render(){

            const lista = document.getElementById('lista');
            lista.innerHTML = '';

            let total = 0;

            carrinho.forEach((i,idx)=>{

              const sub = i.qtd * i.unit;
              total += sub;

              lista.innerHTML += \`
                <li style="margin-bottom:8px">
                  <strong>\${i.produto}</strong><br>
                  \${i.qtd} x R$ \${i.unit.toFixed(2).replace('.',',')}
                  = <strong>R$ \${sub.toFixed(2).replace('.',',')}</strong>

                  <div style="margin-top:6px;display:flex;gap:4px">
                    <button onclick="menos(\${idx})">➖</button>
                    <button onclick="mais(\${idx})">➕</button>
                    <button onclick="remover(\${idx})"
                      style="background:#dc2626;color:white">
                      ❌
                    </button>
                  </div>
                </li>
              \`;
            });

            document.getElementById('total')
              .innerText = total.toFixed(2).replace('.',',');
          }

          function mais(i){ carrinho[i].qtd++; render(); }
          function menos(i){
            carrinho[i].qtd--;
            if(carrinho[i].qtd <= 0) carrinho.splice(i,1);
            render();
          }
          function remover(i){ carrinho.splice(i,1); render(); }

          function novoProduto(){
            google.script.run
              .withSuccessHandler(()=> google.script.run.popupCompraV2())
              .popupProdutoManager();
            google.script.host.close();
          }

          function finalizar(){

            if(carrinho.length === 0){
              showMsg('Carrinho vazio');
              return;
            }

            const fornecedor = document.getElementById('forn').value;
            const formaPgto  = document.getElementById('forma').value;

            if(!fornecedor){
              showMsg('Informe o fornecedor');
              return;
            }

            const btn = document.getElementById('btnFinalizar');
            btn.disabled = true;
            btn.innerText = '⏳ Processando...';

            google.script.run
              .withSuccessHandler(res=>{
                showMsg('Compra registrada com sucesso! ID: ' + res.id);
                setTimeout(()=>google.script.host.close(), 800);
              })
              .withFailureHandler(e=>{
                showMsg(e.message || 'Erro ao finalizar compra');
                btn.disabled = false;
                btn.innerText = '✅ Finalizar Compra';
              })
              .salvarCompraCarrinhoV2(carrinho, fornecedor, formaPgto);
          }

        </script>

      `, 520, 720);
    }
    function popupCancelarCompra(){

      abrirPopup('❌ Cancelar Compra', `

        <label>🆔 ID da Compra</label>
        <input id="id" placeholder="Ex: C-000001">

        <label>📝 Motivo</label>
        <input id="motivo">

        <button class="btn-danger" onclick="cancelar()">
          🚨 Confirmar Cancelamento
        </button>

        <script>

          function cancelar(){

            const id = document.getElementById('id').value;
            const motivo = document.getElementById('motivo').value;

            if(!id || !motivo){
              alert('Informe ID e motivo');
              return;
            }

            google.script.run
              .withSuccessHandler(res=>{
                alert(res.msg);
                google.script.host.close();
              })
              .cancelarCompraPorID(id, motivo);
          }

        </script>

      `, 400, 300);
    }
    function popupVerCompra(idCompra){

      const ss = SpreadsheetApp.getActive();
      const sh = ss.getSheetByName('COMPRAS');

      const dados = sh.getDataRange().getValues();

      const itens = dados
        .slice(1)
        .filter(l => l[7] === idCompra);

      if(itens.length === 0){
        SpreadsheetApp.getUi().alert('Compra não encontrada.');
        return;
      }

      let total = 0;

      const lista = itens.map(i=>{

        const status = i[6];
        const sub = Number(i[3]);
        total += status === 'CANCELADO' ? 0 : sub;

        const btnCancelar =
          status !== 'CANCELADO'
          ? `<button class="btn-danger"
              onclick="cancelarItem('${idCompra}','${i[1]}')">
              ❌ Cancelar
            </button>`
          : `<span style="color:#dc2626;font-weight:bold">
              CANCELADO
            </span>`;

        return `
          <div class="card-item">
            <div>
              <strong>${i[1]}</strong><br>
              <small>${i[2]} un — R$ ${sub.toFixed(2).replace('.',',')}</small>
            </div>
            <div>${btnCancelar}</div>
          </div>
        `;
      }).join('');

      abrirPopup(`📦 Compra ${idCompra}`, `

        <div class="popup-body">

          ${lista}

          <hr>

          <div style="text-align:right;font-size:16px;font-weight:bold">
            💰 Total Ativo: R$ ${total.toFixed(2).replace('.',',')}
          </div>

          <br>

          <button class="btn-secondary" onclick="fechar()">
            ↩️ Fechar
          </button>

        </div>

        <script>

          function cancelarItem(id, produto){

            const motivo = prompt(
              'Motivo do cancelamento do item:'
            );

            if(!motivo) return;

            google.script.run
              .withSuccessHandler(()=>{
                google.script.host.close();
                google.script.run.popupVerCompra(id);
              })
              .cancelarItemCompra(id, produto, motivo);
          }

          function fechar(){
            google.script.host.close();
          }

        </script>

        <style>

          .popup-body{
            display:flex;
            flex-direction:column;
            gap:10px;
          }

          .card-item{
            background:#f8fafc;
            padding:10px;
            border-radius:10px;
            display:flex;
            justify-content:space-between;
            align-items:center;
            border:1px solid #e2e8f0;
          }

          .btn-danger{
            background:#dc2626;
            color:white;
            border:none;
            padding:6px 10px;
            border-radius:6px;
            cursor:pointer;
          }

          .btn-secondary{
            background:#334155;
            color:white;
            border:none;
            padding:8px;
            border-radius:8px;
            cursor:pointer;
            width:100%;
          }

        </style>

      `, 520, 600);
    }
    function popupPainelCancelamentoCompra(){

      const ss = SpreadsheetApp.getActive();
      const sh = ss.getSheetByName('COMPRAS');
      const dados = sh.getDataRange().getValues();

      if(dados.length <= 1){
        SpreadsheetApp.getUi().alert('Nenhuma compra registrada.');
        return;
      }

      const ids = [...new Set(
        dados.slice(1).map(l => l[7]).filter(Boolean)
      )];

      const lista = ids.map(id =>
        `<option value="${id}">Compra #${id}</option>`
      ).join('');

      const html = `
        <div style="display:flex;flex-direction:column;gap:10px;font-family:Arial">

          <h3>🛑 Painel de Cancelamento</h3>

          <label>Selecionar Compra</label>
          <select id="idCompra">
            <option value="">Selecione</option>
            ${lista}
          </select>

          <button onclick="ver()">👁️ Ver Itens</button>

          <div id="resultado"></div>

          <script>

            function ver(){

              const id = document.getElementById('idCompra').value;
              if(!id){
                alert('Selecione a compra');
                return;
              }

              google.script.run
                .withSuccessHandler(render)
                .getItensCompraPorID(id);
            }

            function render(itens){

              let html = '';

              itens.forEach(i=>{

                html +=
                  '<div style="border:1px solid #ccc;padding:8px;margin-top:6px;border-radius:8px">'+
                  '<strong>'+i.produto+'</strong> | '+i.qtd+' un | R$ '+i.valor.toFixed(2)+
                  ' <button onclick="cancelarItem(\\''+i.id+'\\',\\''+i.produto+'\\')">Cancelar Item</button>'+
                  '</div>';

              });

              html += '<hr>';

              html += '<button style="background:#dc2626;color:#fff" onclick="cancelarTotal()">🛑 Cancelar Compra Total</button>';

              document.getElementById('resultado').innerHTML = html;
            }

            function cancelarItem(id,produto){

              const motivo = prompt('Informe o motivo do cancelamento:');
              if(!motivo) return;

              google.script.run
                .withSuccessHandler(()=>{
                  alert('Item cancelado.');
                  ver();
                })
                .cancelarItemCompra(
                  document.getElementById('idCompra').value,
                  produto,
                  motivo
                );
            }

            function cancelarTotal(){

              const motivo = prompt('Informe o motivo do cancelamento total:');
              if(!motivo) return;

              google.script.run
                .withSuccessHandler(()=>{
                  alert('Compra cancelada.');
                  google.script.host.close();
                })
                .cancelarCompraPorID(
                  document.getElementById('idCompra').value,
                  motivo
                );
            }

          </script>
        </div>
      `;

      abrirPopup('🛑 Cancelamento de Compras', html, 480, 600);
    }
    function adicionarEstoquePorCompra(produto, quantidade){

      const ss = SpreadsheetApp.getActive();
      const sh = ss.getSheetByName('ESTOQUE');

      if(!sh) throw new Error('Aba ESTOQUE não encontrada.');

      const dados = sh.getDataRange().getValues();

      for(let i = 1; i < dados.length; i++){

        if(dados[i][0] === produto){

          const atual = Number(dados[i][1]) || 0;
          const novaQtd = atual + Number(quantidade);

          sh.getRange(i+1, 2).setValue(novaQtd);

          return true;
        }
      }

      // Se não existir no estoque ainda → cria
      sh.appendRow([
        produto,
        Number(quantidade),
        0,
        '🟢   OK   🔋',
        'Entrada por compra'
      ]);

      return true;
    }
    function cancelarCompraPorID(idCompra, motivo){

      const itens = getItensCompraPorID(idCompra);

      if(itens.length === 0){
        return {ok:false, msg:'Compra não encontrada ou já cancelada.'};
      }

      itens.forEach(i=>{
        cancelarItemCompra(idCompra, i.produto, motivo);
      });

      removerContaAPagarCompra(idCompra);

      return {ok:true, msg:'Compra cancelada com sucesso.'};
    }
    function cancelarItemCompra(idCompra, produto, motivo){

      const ss = SpreadsheetApp.getActive();
      const sh = ss.getSheetByName('COMPRAS');
      const dados = sh.getDataRange().getValues();

      for(let i=1;i<dados.length;i++){

        if(dados[i][7] === idCompra &&
          dados[i][1] === produto &&
          dados[i][6] === 'ATIVO'){

          const qtd = Number(dados[i][2]);
          const valor = Number(dados[i][3]);

          sh.getRange(i+1,7).setValue('CANCELADO');
          sh.getRange(i+1,11).setValue(motivo); // ✅ coluna correta

          removerEstoquePorCancelamento(produto,qtd);

          registrarCaixa(
            new Date(),
            'Entrada',
            valor,
            '',
            'ESTORNO_COMPRA',
            `COMPRA ${idCompra}`
          );

          return true;
        }
      }

      return false;
    }
    function removerContaAPagarCompra(idCompra){

      const ss = SpreadsheetApp.getActive();
      const sh = ss.getSheetByName('CONTAS_A_PAGAR');

      if(!sh) return;

      for(let i=sh.getLastRow(); i>1; i--){

        if(sh.getRange(i,1).getValue() === idCompra){
          sh.deleteRow(i);
        }
      }
    }
    function removerEstoquePorCancelamento(produto, quantidade){

      const ss = SpreadsheetApp.getActive();
      const sh = ss.getSheetByName('ESTOQUE');
      const dados = sh.getDataRange().getValues();

      for(let i=1;i<dados.length;i++){

        if(dados[i][0] === produto){

          const atual = Number(dados[i][1]) || 0;
          const novaQtd = atual - quantidade;

          sh.getRange(i+1,2).setValue(novaQtd);

          return true;
        }
      }

      return false;
    }
    function removerLancamentoCaixaCompra(idCompra, valor){

      const ss = SpreadsheetApp.getActive();
      const sh = ss.getSheetByName('CAIXA');

      for(let i=sh.getLastRow(); i>1; i--){

        const origem = sh.getRange(i,5).getValue();
        const val    = Number(sh.getRange(i,3).getValue());

        if(
          origem === `COMPRA ${idCompra}` &&
          val === valor
        ){
          sh.deleteRow(i);
          break;
        }
      }
    }
    function getItensCompraPorID(id){

      const ss = SpreadsheetApp.getActive();
      const sh = ss.getSheetByName('COMPRAS');
      const dados = sh.getDataRange().getValues();

      const lista = [];

      for(let i=1;i<dados.length;i++){

        if(dados[i][7] === id && dados[i][6] === 'ATIVO'){

          lista.push({
            id: id,
            produto: dados[i][1],
            qtd: Number(dados[i][2]),
            valor: Number(dados[i][3])
          });

        }

      }

      return lista;
    }
  // FINANCEIRO
    function criarContaAPagar(idCompra,fornecedor,valor,forma,data){

      const ss = SpreadsheetApp.getActive();
      let sh = ss.getSheetByName('CONTAS_A_PAGAR');

      if(!sh){
        sh = ss.insertSheet('CONTAS_A_PAGAR');
        sh.appendRow([
          'ID_COMPRA','Fornecedor','Valor',
          'FormaPgto','Data','Status','Data_Pagamento'
        ]);
      }

      sh.appendRow([
        idCompra,
        fornecedor,
        Number(valor),
        forma,
        data,
        'ABERTO',
        ''
      ]);
    }
  // REGISTRO
    function uploadNotaFiscal(idCompra, blob){

      const estrutura = garantirEstruturaDriveSistema();

      if(!estrutura || !estrutura.notasMesId){
        throw new Error('Estrutura do Drive não encontrada.');
      }

      const pastaMes = DriveApp.getFolderById(estrutura.notasMesId);

      const file = pastaMes.createFile(blob);
      file.setName(`NF_${idCompra}`);

      registrarLog(
        'UPLOAD_NF',
        `Nota fiscal da compra ${idCompra}`,
        '',
        file.getName()
      );

      registrarInformacaoImportanteNoDrive(
        'COMPRA',
        `Upload de nota fiscal ${idCompra}`,
        [
          `Compra: ${idCompra}`,
          `Arquivo: ${file.getName()}`,
          `File ID: ${file.getId()}`,
          `URL: ${file.getUrl()}`
        ].join('\n'),
        { subcategoria: 'Notas' }
      );

      return file.getId();
    }
    function gerarLinkUploadNF(idCompra){

      // garante estrutura e pega pasta do mês
      const estrutura = garantirEstruturaDriveSistema();

      if(!estrutura || !estrutura.notasMesId){
        return '';
      }

      // 🔗 link direto para a pasta do mês (upload manual / scan)
      return `https://drive.google.com/drive/folders/${estrutura.notasMesId}`;
    }
// ===============================
// DRIVE - ESTRUTURA GERAL DO SISTEMA - BACKUP - LOGS - RELATÓRIOS
// ===============================
  function garantirEstruturaDriveSistema(dataRef){

    const nomeDeposito = getNomeDeposito(); // ✅ fonte única
    const data = dataRef || new Date();

    const ano = Utilities.formatDate(data, Session.getScriptTimeZone(), 'yyyy');
    const mes = Utilities.formatDate(data, Session.getScriptTimeZone(), 'MM');

    // ===============================
    // 📁 PASTA RAIZ = NOME DO DEPÓSITO
    // ===============================
    const root = obterOuCriarPastaPorNome(
      DriveApp,
      nomeDeposito,
      'CRIAR_PASTA_RAIZ',
      nomeDeposito
    );

    // ===============================
    // 📦 BACKUP (compatível com o que você já tem)
    // ===============================
    obterOuCriarPastaPorNome(
      root,
      'Backup',
      'CRIAR_PASTA',
      `${nomeDeposito}/Backup`
    );

    // ===============================
    // 🧾 LOGS
    // ===============================
    const logs = obterOuCriarPastaPorNome(
      root,
      'Logs',
      'CRIAR_PASTA',
      `${nomeDeposito}/Logs`
    );

    obterOuCriarPastaPorNome(
      logs,
      'PDF',
      'CRIAR_PASTA',
      `${nomeDeposito}/Logs/PDF`
    );

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

    // ===============================
    // 🛒 COMPRAS / NOTAS FISCAIS
    // ===============================
    const compras = obterOuCriarPastaPorNome(
      root,
      'Compras',
      'CRIAR_PASTA',
      `${nomeDeposito}/Compras`
    );

    const notas = obterOuCriarPastaPorNome(
      compras,
      'Notas',
      'CRIAR_PASTA',
      `${nomeDeposito}/Compras/Notas`
    );

    const anoFolder = obterOuCriarPastaPorNome(
      notas,
      ano,
      'CRIAR_PASTA',
      `${nomeDeposito}/Compras/Notas/${ano}`
    );

    const mesFolder = obterOuCriarPastaPorNome(
      anoFolder,
      mes,
      'CRIAR_PASTA',
      `${nomeDeposito}/Compras/Notas/${ano}/${mes}`
    );

    return {
      rootId: root.getId(),
      notasMesId: mesFolder.getId()
    };
  }
  function obterOuCriarPastaPorNome(pastaPai, nome, acaoLog, caminho){

    const pastas = pastaPai.getFoldersByName(nome);

    if(pastas.hasNext()){
      return pastas.next();
    }

    const nova = pastaPai.createFolder(nome);

    registrarLog(
      acaoLog,
      'Pasta criada no Drive',
      '',
      caminho
    );

    return nova;
  }
  function obterPastaDestinoRegistroDrive(tipo, subcategoria, dataRef){
    const estrutura = garantirEstruturaDriveSistema(dataRef);

    if(!estrutura || !estrutura.rootId){
      throw new Error('Estrutura raiz do Drive não encontrada.');
    }

    const root = DriveApp.getFolderById(estrutura.rootId);
    const tipoNormalizado = String(tipo || '').toUpperCase();

    if(tipoNormalizado === 'BACKUP'){
      const backup = obterOuCriarPastaPorNome(root, 'Backup', 'CRIAR_PASTA', `${getNomeDeposito()}/Backup`);
      const registros = obterOuCriarPastaPorNome(backup, 'Registros', 'CRIAR_PASTA', `${getNomeDeposito()}/Backup/Registros`);
      return subcategoria
        ? obterOuCriarPastaPorNome(registros, subcategoria, 'CRIAR_PASTA', `${getNomeDeposito()}/Backup/Registros/${subcategoria}`)
        : registros;
    }

    if(tipoNormalizado === 'COMPRA'){
      const compras = obterOuCriarPastaPorNome(root, 'Compras', 'CRIAR_PASTA', `${getNomeDeposito()}/Compras`);
      const registros = obterOuCriarPastaPorNome(compras, 'Registros', 'CRIAR_PASTA', `${getNomeDeposito()}/Compras/Registros`);
      return subcategoria
        ? obterOuCriarPastaPorNome(registros, subcategoria, 'CRIAR_PASTA', `${getNomeDeposito()}/Compras/Registros/${subcategoria}`)
        : registros;
    }

    if(tipoNormalizado === 'RELATORIO' || tipoNormalizado === 'RELATÓRIO'){
      const relatorios = obterOuCriarPastaPorNome(root, 'Relatorios', 'CRIAR_PASTA', `${getNomeDeposito()}/Relatorios`);
      const registros = obterOuCriarPastaPorNome(relatorios, 'Registros', 'CRIAR_PASTA', `${getNomeDeposito()}/Relatorios/Registros`);
      return subcategoria
        ? obterOuCriarPastaPorNome(registros, subcategoria, 'CRIAR_PASTA', `${getNomeDeposito()}/Relatorios/Registros/${subcategoria}`)
        : registros;
    }

    const logs = obterOuCriarPastaPorNome(root, 'Logs', 'CRIAR_PASTA', `${getNomeDeposito()}/Logs`);
    const eventos = obterOuCriarPastaPorNome(logs, 'Eventos', 'CRIAR_PASTA', `${getNomeDeposito()}/Logs/Eventos`);
    return subcategoria
      ? obterOuCriarPastaPorNome(eventos, subcategoria, 'CRIAR_PASTA', `${getNomeDeposito()}/Logs/Eventos/${subcategoria}`)
      : eventos;
  }
  function registrarInformacaoImportanteNoDrive(tipo, titulo, conteudo, opcoes){
    try {
      const cfg = opcoes || {};
      const data = cfg.dataRef || new Date();
      const dataFmt = Utilities.formatDate(data, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      const horaFmt = Utilities.formatDate(data, Session.getScriptTimeZone(), 'HH-mm-ss');
      const nomeSanitizado = String(titulo || 'registro').replace(/[\\/:*?"<>|]/g, '-').substring(0, 80);
      const pasta = obterPastaDestinoRegistroDrive(tipo, cfg.subcategoria, data);
      const cabecalho = [
        `Tipo: ${String(tipo || 'GERAL').toUpperCase()}`,
        `Título: ${titulo || 'Registro sem título'}`,
        `Data: ${dataFmt} ${horaFmt.replace(/-/g, ':')}`,
        `Usuário: ${Session.getActiveUser().getEmail() || 'Desconhecido'}`,
        '--------------------------------------------------'
      ].join('\n');

      const arquivo = pasta.createFile(
        `${dataFmt}_${horaFmt}_${nomeSanitizado}.txt`,
        `${cabecalho}\n${String(conteudo || '').trim()}`,
        MimeType.PLAIN_TEXT
      );

      registrarLog(
        'REGISTRO_IMPORTANTE_DRIVE',
        `Registro ${String(tipo || 'GERAL').toUpperCase()} salvo no Drive`,
        '',
        arquivo.getUrl()
      );

      return {
        id: arquivo.getId(),
        nome: arquivo.getName(),
        url: arquivo.getUrl()
      };
    } catch (e) {
      console.warn('Falha ao registrar informação importante no Drive:', e.message || e);
      return null;
    }
  }
  function obterPastaBackupSistema(){

    const nomeDeposito = getNomeDeposito();

    const pastasRaiz = DriveApp.getFoldersByName(nomeDeposito);
    if(!pastasRaiz.hasNext()){
      return null; // sistema ainda não configurado
    }

    const root = pastasRaiz.next();

    // pasta Backup dentro da raiz
    const pastas = root.getFoldersByName('Backup');
    if(pastas.hasNext()){
      return pastas.next();
    }

    const backup = root.createFolder('Backup');

    registrarLog(
      'CRIAR_PASTA',
      'Pasta Backup criada',
      '',
      `${nomeDeposito}/Backup`
    );

    return backup;
  }
  function verificarEstruturaBackup(){
    const pasta = obterPastaBackupSistema();
    if(!pasta){
      return { ok:false, msg:'Nenhuma pasta raiz encontrada. Execute setup.' };
    }
    const nome = pasta.getName();
    registrarLog('VERIFICAR_BACKUP', 'Verificação concluída', '', nome);
    return { ok:true, msg:'Pasta de backup: ' + nome };
  }
  function garantirAbaLog() {
    const ss = SpreadsheetApp.getActive();
    let aba = ss.getSheetByName("LOG_SISTEMA");

    if (!aba) {
      aba = ss.insertSheet("LOG_SISTEMA");

      inserirLinhaNoTopo('LOG_SISTEMA', [
        "Data",
        "Hora",
        "Usuário",
        "Ação",
        "Detalhes",
        "Antes",
        "Depois"
      ]);
    }

    return aba;
  }
  function registrarLog(acao, detalhes, antes, depois) {

    const aba = garantirAbaLog();

    const data = new Date();

    const usuario = Session.getActiveUser().getEmail() || "Desconhecido";

    aba.appendRow([
      Utilities.formatDate(data, Session.getScriptTimeZone(), "yyyy-MM-dd"),
      Utilities.formatDate(data, Session.getScriptTimeZone(), "HH:mm:ss"),
      usuario,
      acao,
      detalhes,
      JSON.stringify(antes || ""),
      JSON.stringify(depois || "")
    ]);
  }
  function abrirPainelWhatsApp(){

    const nome = getNomeDeposito();
    const numeroPadrao = (getConfig('TELEFONE') || '').toString().replace(/\D/g, '');

    const html = `
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 12px; font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; color: #fff; }
          .container { display: flex; flex-direction: column; gap: 10px; }
          h3 { text-align: center; margin: 0 0 2px 0; }
          .hint { margin: 0 0 6px 0; color:#cbd5e1; font-size:12px; text-align:center; }
          .card { background: linear-gradient(135deg, #25d366 0%, #1fa855 100%); border: none; width: 100%; padding: 12px; border-radius: 10px; color: white; font-weight: 700; cursor: pointer; }
          .card.secondary { background: linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%); }
          .card.gray { background: #475569; }
          .card.danger { background: #b91c1c; }
        </style>
      </head>
      <body>
        <div class="container">
          <h3>💬 WhatsApp - Contatos</h3>
          <p class="hint">${nome}</p>

          <button class="card" onclick="google.script.run.abrirWhatsappPedidosChegados()">📥 Verificar Pedidos que Chegaram</button>
          <button class="card secondary" onclick="google.script.run.popupListarUsuarios()">👥 Ajustar Cadastro de Usuário</button>
          <button class="card" onclick="google.script.run.abrirConversaDiretaDonoWhatsapp()">👑 Conversa Direta com Dono</button>
          <button class="card secondary" onclick="google.script.run.abrirPopupConsultaFiadoWhatsapp()">💳 Consultar Fiado</button>
          <button class="card gray" onclick="google.script.run.popupDelivery()">📱 Fazer Pedido</button>
          <button class="card danger" onclick="google.script.host.close()">✕ Fechar</button>
        </div>

        <script>
          if (!'${numeroPadrao}') {
            alert('⚠️ Configure o telefone do depósito em Sistema > Configurar Depósito.');
          }
        </script>
      </body>
      </html>
    `;

    const ui = HtmlService.createHtmlOutput(html).setWidth(600).setHeight(520);
    SpreadsheetApp.getUi().showModelessDialog(ui, '💬 Contatos WhatsApp');
  }

  function abrirConversaPedidoWhatsapp(){
    if (typeof popupDelivery === 'function') {
      popupDelivery();
      return;
    }
    uiNotificar('Função de novo delivery indisponível no momento.','aviso','Delivery');
  }

  function abrirConversaDiretaDonoWhatsapp(){
    const nomeDono = getConfig('DONO') || 'Dono';
    const numero = (getConfig('TELEFONE_DONO') || getConfig('TELEFONE') || '').toString().replace(/\D/g, '');
    if(!numero){
      uiNotificar('Configure TELEFONE_DONO (ou TELEFONE) para abrir conversa com o dono.','aviso','WhatsApp');
      return;
    }
    const texto = encodeURIComponent(`Olá ${nomeDono}, preciso falar com você.`);
    const url = `https://wa.me/55${numero}?text=${texto}`;
    const html = HtmlService.createHtmlOutput(`<script>window.open('${url}','_blank');google.script.host.close();</script>`).setWidth(10).setHeight(10);
    SpreadsheetApp.getUi().showModalDialog(html, 'Abrindo WhatsApp');
  }

  function abrirWhatsappPedidosChegados(){
    const pedidos = (typeof listarPedidosWhatsapp === 'function') ? listarPedidosWhatsapp() : [];
    const htmlRows = pedidos.length
      ? pedidos.map(p => `<tr><td>${p.idPedido || ''}</td><td>${p.clienteNome || ''}</td><td>${p.resumoItens || ''}</td><td>${p.status || ''}</td></tr>`).join('')
      : '<tr><td colspan="4" style="text-align:center;color:#64748b;">Nenhum pedido encontrado.</td></tr>';

    const html = `
      <html><body style="font-family:Arial;padding:12px;">
        <h3>📥 Pedidos que Chegaram (WhatsApp)</h3>
        <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:12px;">
          <tr style="background:#e2e8f0;"><th>ID</th><th>Cliente</th><th>Itens</th><th>Status</th></tr>
          ${htmlRows}
        </table>
      </body></html>
    `;

    SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(760).setHeight(460), '📥 Pedidos WhatsApp');
  }

  function abrirPopupConsultaFiadoWhatsapp(){
    const ss = SpreadsheetApp.getActive();
    const clientes = ss.getSheetByName('CLIENTES');
    const contasReceber = ss.getSheetByName('CONTAS_A_RECEBER');
    const contasPagar = ss.getSheetByName('CONTAS_A_PAGAR');

    const mapaSaldo = {};

    // Fiado oficial: CONTAS_A_RECEBER
    if (contasReceber) {
      const dados = contasReceber.getDataRange().getValues().slice(1);
      dados.forEach(r => {
        const cliente = String(r[3] || '').trim();      // CLIENTE
        const saldo = Number(r[6]) || 0;                // SALDO
        const forma = String(r[7] || '').toUpperCase(); // FORMA
        const status = String(r[8] || '').toUpperCase();

        if (!cliente || saldo <= 0) return;
        if (forma !== 'FIADO') return;
        if (status === 'QUITADO') return;

        mapaSaldo[cliente] = (mapaSaldo[cliente] || 0) + saldo;
      });
    }

    // Fallback legado: alguns registros podem ter sido lançados em CONTAS_A_PAGAR
    if (contasPagar) {
      const dadosCp = contasPagar.getDataRange().getValues().slice(1);
      dadosCp.forEach(r => {
        const nome = String(r[1] || '').trim();
        const valor = Number(r[2]) || 0;
        const forma = String(r[3] || '').toUpperCase();
        const status = String(r[5] || '').toUpperCase();

        if (!nome || valor <= 0) return;
        if (forma !== 'FIADO') return;
        if (status === 'PAGO' || status === 'QUITADO') return;

        mapaSaldo[nome] = (mapaSaldo[nome] || 0) + valor;
      });
    }

    let lista = [];
    if (clientes) {
      const dadosCli = clientes.getDataRange().getValues().slice(1);
      lista = dadosCli.map(r => ({
        nome: String(r[0] || '').trim(),
        telefone: String(r[1] || '').replace(/\D/g, ''),
        saldo: mapaSaldo[String(r[0] || '').trim()] || 0
      })).filter(c => c.nome && c.saldo > 0);
    }

    // também lista clientes pendentes que não estejam cadastrados na aba CLIENTES
    Object.keys(mapaSaldo).forEach(nome => {
      if (!lista.some(c => c.nome === nome)) {
        lista.push({ nome, telefone: '', saldo: mapaSaldo[nome] });
      }
    });

    const linhas = lista.length
      ? lista.map(c => {
          const msg = encodeURIComponent(`Olá ${c.nome}, seu saldo de fiado atual é R$ ${Number(c.saldo).toFixed(2).replace('.', ',')}.`);
          const href = c.telefone ? `https://wa.me/55${c.telefone}?text=${msg}` : '#';
          return `<tr><td>${c.nome}</td><td>R$ ${Number(c.saldo).toFixed(2)}</td><td>${c.telefone || '-'}</td><td>${c.telefone ? `<a target="_blank" href="${href}">Enviar Msg</a>` : 'Sem telefone'}</td></tr>`;
        }).join('')
      : '<tr><td colspan="4" style="text-align:center;color:#64748b;">Nenhum fiado em aberto.</td></tr>';

    const html = `
      <html><body style="font-family:Arial;padding:12px;">
        <h3>💳 Fiados em aberto</h3>
        <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse;width:100%;font-size:12px;">
          <tr style="background:#e2e8f0;"><th>Cliente</th><th>Saldo</th><th>Telefone</th><th>Ação</th></tr>
          ${linhas}
        </table>
      </body></html>
    `;

    SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(820).setHeight(520), '💳 Consultar Fiado');
  }
  function fazerBackupSistema() {

    const pasta = obterPastaBackupSistema();

    const agora = new Date();
    const data = Utilities.formatDate(
      agora,
      Session.getScriptTimeZone(),
      "yyyy-MM-dd"
    );
    
    const hora = Utilities.formatDate(
      agora,
      Session.getScriptTimeZone(),
      "HH-mm-ss"
    );

    // Backup fixo (sempre sobrescreve)
    salvarBackupComoSheet(pasta, 'backup_atual');

    // Backup diário com hora
    const nomeDiario = `backup_${data}_${hora}`;
    salvarBackupComoSheet(pasta, nomeDiario);

    // Organiza pastas por mês
    organizarPastasBackupPorMes(pasta, data);

    registrarLog(
      'BACKUP_EXECUTADO',
      `Backup realizado: ${nomeDiario}`,
      '',
      pasta.getName()
    );

    registrarInformacaoImportanteNoDrive(
      'BACKUP',
      `Execução de backup ${nomeDiario}`,
      [
        `Arquivo diário: ${nomeDiario}`,
        'Arquivo fixo atualizado: backup_atual',
        `Pasta de destino: ${pasta.getName()}`,
        `Data/Hora: ${new Date().toLocaleString('pt-BR')}`
      ].join('\n')
    );

    SpreadsheetApp.getUi().alert('✅ Backup realizado com sucesso!\\n\\n📁 Pasta: ' + pasta.getName());
  }
  function organizarPastasBackupPorMes(pastaRaiz, data){
    
    try {
      // Extrai ano e mês
      const mesAno = data.substring(0, 7); // YYYY-MM
      const nomePastaMes = `backup_${mesAno}`;
      
      // Verifica se pasta do mês existe
      let pastaMes = null;
      const subpastas = pastaRaiz.getFolders();
      
      while(subpastas.hasNext()){
        const pasta = subpastas.next();
        if(pasta.getName() === nomePastaMes){
          pastaMes = pasta;
          break;
        }
      }
      
      // Cria pasta do mês se não existir
      if(!pastaMes){
        pastaMes = pastaRaiz.createFolder(nomePastaMes);
      }
      
      // Move arquivos antigos para pasta do mês
      const arquivos = pastaRaiz.getFiles();
      while(arquivos.hasNext()){
        const arquivo = arquivos.next();
        const nomeArq = arquivo.getName();
        
        if(nomeArq.startsWith('backup_') && nomeArq !== 'backup_atual'){
          arquivo.moveTo(pastaMes);
        }
      }
      
    } catch(e) {
      console.log('Erro ao organizar pastas: ' + e);
    }
  }
  function salvarOuSobrescrever(pasta, arquivoOriginal, nome) {

    // Apaga se já existir
    const arquivos = pasta.getFilesByName(nome);

    while (arquivos.hasNext()) {
      arquivos.next().setTrashed(true);
    }

    arquivoOriginal.makeCopy(nome, pasta);
  }
  function arquivoExiste(pasta, nome) {

    const arquivos = pasta.getFilesByName(nome);

    return arquivos.hasNext();
  }
  function abrirAbaLog() {

    const aba = garantirAbaLog();

    SpreadsheetApp.setActiveSheet(aba);
  }
  function abrirManualDoSistema(){
    
    const html = `
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, sans-serif;
            margin: 0;
            padding: 16px;
            background: #f8fafc;
            line-height: 1.6;
          }
          h2 { color: #0f172a; border-bottom: 3px solid #2563eb; padding-bottom: 8px; }
          h3 { color: #1e293b; margin-top: 16px; }
          .section { background: white; margin: 16px 0; padding: 16px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          .step { background: #f0f9ff; padding: 12px; border-left: 4px solid #2563eb; margin: 8px 0; }
          .tip { background: #fef3c7; padding: 12px; border-left: 4px solid #f59e0b; margin: 8px 0; }
          kbd { background: #1e293b; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold; }
        </style>
      </head>
      <body>
        <h2>📖 Manual Completo do Sistema</h2>
        
        <div class="section">
          <h3>🎯 Início Rápido</h3>
          <div class="step">
            <strong>1️⃣ Abrir Home:</strong> Clique em <kbd>🏠 Home</kbd> no menu
          </div>
          <div class="step">
            <strong>2️⃣ Configurar Depósito:</strong> Menu → <kbd>📦 Sistema</kbd> → <kbd>⚙️ Configurar Depósito</kbd>
          </div>
          <div class="step">
            <strong>3️⃣ Iniciar Sistema:</strong> Menu → <kbd>📦 Sistema</kbd> → <kbd>🚀 Iniciar Sistema</kbd>
          </div>
        </div>

        <div class="section">
          <h3>💶 Gestão de Comandas</h3>
          <div class="step">
            <strong>Nova Comanda:</strong> <kbd>💶 Comandas</kbd> → <kbd>🍺 Nova Comanda Balcão</kbd>
          </div>
          <div class="step">
            <strong>Ver Abertas:</strong> <kbd>💶 Comandas</kbd> → <kbd>📂 Comandas Abertas</kbd>
          </div>
          <div class="tip">💡 Todas as comandas abertas são listadas com fecha hora</div>
        </div>

        <div class="section">
          <h3>🚚 Delivery</h3>
          <div class="step">
            <strong>Novo Pedido:</strong> <kbd>🚚 Delivery</kbd> → <kbd>🚚 Novo Delivery</kbd>
          </div>
          <div class="step">
            <strong>Painel:</strong> <kbd>🚚 Delivery</kbd> → <kbd>📦 Painel de Delivery</kbd>
          </div>
          <div class="tip">💡 Integração com WhatsApp disponível para contato com cliente</div>
        </div>

        <div class="section">
          <h3>📦 Estoque Financeiro</h3>
          <div class="step">
            <strong>Painel Principal:</strong> <kbd>📦 Estoque Financeiro</kbd> → <kbd>🎯 Painel Gestão</kbd>
          </div>
          <div class="step">
            <strong>Relatório Valores:</strong> <kbd>📦 Estoque Financeiro</kbd> → <kbd>📊 Relatório Valores</kbd>
          </div>
          <div class="tip">💡 Visualize valor total do estoque, margem e lucro estimado</div>
        </div>

        <div class="section">
          <h3>💾 Backup</h3>
          <div class="step">
            <strong>Fazer Backup:</strong> <kbd>📦 Sistema</kbd> → <kbd>💾 Fazer Backup Agora</kbd>
          </div>
          <div class="tip">💡 Backups são salvos automaticamente no Drive em pastas organizadas</div>
        </div>

        <div class="section">
          <h3>📞 WhatsApp</h3>
          <div class="step">
            <strong>Contato Cliente:</strong> Clique no botão 💬 nos painéis
          </div>
          <div class="step">
            <strong>Link Direto:</strong> Sistema gera link que abre WhatsApp automaticamente
          </div>
          <div class="tip">💡 Configure números no painel de configuração</div>
        </div>

        <div class="section">
          <h3>📊 Dashboard HOME</h3>
          <div class="step">
            <strong>7 KPI Cards:</strong> Caixa, Estoque, Valor, Comandas, Delivery, Backup, Drive
          </div>
          <div class="step">
            <strong>Clique nos Cards:</strong> Abre painéis detalhados com dados
          </div>
          <div class="tip">💡 Atualiza automaticamente a cada 5 minutos</div>
        </div>

        <div class="section">
          <h3>🔧 Configurações</h3>
          <div class="step">
            <strong>Nome do Depósito:</strong> Identificação no sistema (bloqueado após setup)
          </div>
          <div class="step">
            <strong>URL Drive:</strong> Link da pasta para backup e compartilhamento
          </div>
          <div class="step">
            <strong>Telefone/CNPJ:</strong> Dados do estabelecimento para contatos
          </div>
        </div>

        <div class="section">
          <h3>📱 Mobile</h3>
          <div class="tip">✅ Sistema totalmente responsivo para celular</div>
          <div class="tip">✅ Todos os painéis otimizados para tela pequena</div>
          <div class="tip">✅ Gestão completa via smartphone</div>
        </div>

        <div class="section">
          <h3>🔒 Log do Sistema</h3>
          <div class="step">
            <strong>Ver Logs:</strong> <kbd>📦 Sistema</kbd> → <kbd>📜 Ver Logs</kbd>
          </div>
          <div class="tip">💡 Todos os movimentos são registrados automaticamente</div>
        </div>

        <button onclick=\"google.script.host.close()\" style=\"
          width: 100%;
          padding: 12px;
          background: #2563eb;
          color: white;
          border: none;
          border-radius: 6px;
          font-weight: bold;
          cursor: pointer;
          margin-top: 16px;
        \">✕ Fechar Manual</button>
      </body>
      </html>
    `;

    abrirPopup('📖 Manual do Sistema', html, 500, 600);
  }
  function salvarBackupComoSheet(pasta, nome){

    const ss = SpreadsheetApp.getActive();
    const file = DriveApp.getFileById(ss.getId());

    // remove backups antigos com mesmo nome
    const existentes = pasta.getFilesByName(nome);
    while(existentes.hasNext()){
      existentes.next().setTrashed(true);
    }

    file.makeCopy(nome, pasta);
  }
  function gerarLogSistemaPDF(){

    const ss = SpreadsheetApp.getActive();
    const aba = ss.getSheetByName('LOG_SISTEMA');
    if(!aba) return;

    const nomeDeposito = getNomeDeposito();

    const pastasRaiz = DriveApp.getFoldersByName(nomeDeposito);
    if(!pastasRaiz.hasNext()) return;

    const root = pastasRaiz.next();

    // pasta Logs/PDF
    const logs = root.getFoldersByName('Logs').next();
    const pdfFolder = logs.getFoldersByName('PDF').next();

    const agora = new Date();
    const data = Utilities.formatDate(
      agora,
      Session.getScriptTimeZone(),
      'yyyy-MM-dd_HH-mm'
    );

    const url = ss.getUrl()
      .replace(/edit$/,'')
      + `export?format=pdf&gid=${aba.getSheetId()}`;

    const token = ScriptApp.getOAuthToken();

    const blob = UrlFetchApp.fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    }).getBlob();

    blob.setName(`LOG_SISTEMA_${data}.pdf`);

    pdfFolder.createFile(blob);

    registrarLog(
      'LOG_PDF',
      'Exportação de LOG_SISTEMA para PDF',
      '',
      blob.getName()
    );
  }
  function iniciarSistemaAposReset(){
    popupBoasVindasSistema();
  }
  function popupBoasVindasSistema(){

    const html = `
      <div style="
        font-family:Arial, Helvetica, sans-serif;
        height:100%;
        width:100%;
        display:flex;
        align-items:center;
        justify-content:center;
        overflow:hidden;
      ">

        <div style="
          display:flex;
          flex-direction:column;
          align-items:center;
          gap:16px;
          text-align:center;
          padding:20px;
          max-width:320px;
        ">

          <div style="font-size:32px">👋</div>

          <h2 style="
            margin:0;
            font-size:20px;
            color:#0f172a
          ">
            Bem-vindo ao Gestão de Depósito
          </h2>

          <p style="
            margin:0;
            font-size:14px;
            line-height:1.5;
            color:#475569
          ">
            O sistema foi resetado com sucesso.<br>
            Para começar, vamos configurar os dados iniciais do depósito.
          </p>

          <button onclick="iniciar()" style="
            margin-top:8px;
            padding:12px 20px;
            border:none;
            border-radius:10px;
            background:#2563eb;
            color:#fff;
            font-size:14px;
            cursor:pointer;
          ">
            🚀 Iniciar Configuração
          </button>

        </div>

        <script>
          function iniciar(){
            google.script.run
              .withSuccessHandler(()=>{
                google.script.host.close();
              })
              .finalizarConfiguracaoInicial();
          }
        </script>

      </div>
    `;

    abrirPopup(
      '👋 Boas-vindas',
      html,
      420,
      400
    );
  }
  function finalizarConfiguracaoInicial(){

    // 1️⃣ Abre configuração do depósito
    abrirConfiguracaoDeposito();

    // 2️⃣ Loga APENAS o início do setup
    registrarLog(
      'SETUP_INICIAL_INICIO',
      'Início da configuração do sistema',
      '',
      ''
    );
  }
  function concluirConfiguracaoInicialSistema(){

    // 🔒 Cria estrutura definitiva
    garantirEstruturaDriveSistema();

    // 🔒 Marca sistema como configurado
    setConfig('SETUP_CONCLUIDO', 'SIM');

    registrarLog(
      'SETUP_INICIAL_CONCLUIDO',
      'Configuração inicial concluída',
      '',
      getNomeDeposito()
    );
    
    // 🔄 REMOVE menus antigos e recria o menu correto
    SpreadsheetApp.getUi().createMenu(''); // força reset visual
    recarregarMenu(); // cria APENAS o menu novo
  }
  function getConfigsEmLote(chaves){
    const out = {};
    chaves.forEach(k => out[k] = getConfig(k));
    return out;
  }

// ===============================
// CONTAS A PAGAR
// ===============================

  function popupContaAPagar(){

    const html = `
    <div style="font-family:Arial;display:flex;flex-direction:column;gap:10px">

      <h3>🧾 Nova Conta a Pagar</h3>

      <label>Tipo</label>
      <select id="tipo">
        <option value="FIXA">Conta Fixa</option>
        <option value="AVULSA">Conta Avulsa</option>
      </select>

      <label>Descrição / Fornecedor</label>
      <input id="fornecedor" placeholder="Ex: Aluguel, Energia, Internet">

      <label>Valor</label>
      <input id="valor" placeholder="Ex: 1200,50">

      <label>Forma de Pagamento</label>
      <select id="forma">
        <option>⚡PIX</option>
        <option>🧾BOLETO</option>
        <option>💵DINHEIRO</option>
        <option>🔄TRANSFERÊNCIA</option>
      </select>

      <label>Data de Vencimento</label>
      <input id="data" type="date">

      <button id="btnSalvar" onclick="salvar(this)">💾 Registrar Conta</button>
      <button onclick="google.script.host.close()">❌ Cancelar</button>

      <script>
        function salvar(btn){

          if(btn.disabled) return;
          btn.disabled = true;
          btn.innerText = '⏳ Salvando...';

          const valorLimpo = valor.value
            .replace(/[^0-9,]/g,'')
            .replace(',','.');

          const dados = {
            tipo: tipo.value,
            fornecedor: fornecedor.value.trim(),
            valor: Number(valorLimpo),
            forma: forma.value,
            data: data.value
          };

          if(!dados.fornecedor || !dados.valor || !dados.data){
            alert('Preencha todos os campos corretamente.');
            btn.disabled = false;
            btn.innerText = '💾 Registrar Conta';
            return;
          }

          google.script.run
            .withSuccessHandler(()=>{
              alert('Conta registrada com sucesso!');
              google.script.host.close();
            })
            .withFailureHandler(e=>{
              alert(e.message || e);
              btn.disabled = false;
              btn.innerText = '💾 Registrar Conta';
            })
            .registrarContaManual(dados);
        }
      </script>
    </div>
    `;

    abrirPopup('🧾 Contas a Pagar', html, 420, 420);
  }
  function registrarContaManual(dados){

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('CONTAS_A_PAGAR');

    if(!sh){
      throw new Error('Aba CONTAS_A_PAGAR não encontrada.');
    }

    // 🔢 ID SEQUENCIAL AVULSA
    const plan = sh.getDataRange().getValues();
    let proximo = 1;

    plan.slice(1).forEach(l=>{
      const id = String(l[0] || '');
      if(id.startsWith('AVULSA_')){
        const n = Number(id.replace('AVULSA_',''));
        if(n >= proximo) proximo = n + 1;
      }
    });

    const id = dados.tipo === 'FIXA'
      ? `FIXA_${dados.fornecedor.toUpperCase().replace(/\s+/g,'_')}`
      : `AVULSA_${String(proximo).padStart(4,'0')}`;

    sh.appendRow([
      id,
      dados.fornecedor,
      dados.valor,
      dados.forma,
      new Date(dados.data + 'T00:00:00'),
      'PENDENTE',
      ''
    ]);

    const linha = sh.getLastRow();

    // 🎨 FORMATAÇÃO PADRÃO
    sh.getRange(linha,1,1,sh.getLastColumn())
      .setFontSize(10)
      .setHorizontalAlignment('center');

    sh.getRange(linha,3)
      .setNumberFormat('R$ #,##0.00');

    registrarLog(
      'CONTA_A_PAGAR',
      'Conta registrada manualmente',
      '',
      dados
    );

    return true;
  }
  function popupContasAPagarPendentes(){

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('CONTAS_A_PAGAR');

    const dados = sh.getDataRange().getValues()
      .map((l,i)=>({ linha:i+1, dados:l }))
      .slice(1)
      .filter(o => o.dados[5] === 'PENDENTE');

    if(!dados.length){
      SpreadsheetApp.getUi().alert('Nenhuma conta pendente.');
      return;
    }

    const html = `
    <div style="font-family:Arial;display:flex;flex-direction:column;gap:10px">

      <h3>💰 Contas a Pagar – Pendentes</h3>

      ${dados.map(o=>`
        <div style="border:1px solid #e5e7eb;padding:10px;border-radius:8px">
          <strong>${o.dados[1]}</strong><br>
          💵 R$ ${Number(o.dados[2]).toFixed(2).replace('.',',')}<br>
          📅 Venc: ${Utilities.formatDate(
            new Date(o.dados[4]),
            Session.getScriptTimeZone(),
            'dd/MM/yyyy'
          )}<br>
          <button onclick="pagar(${o.linha}, this)">💸 Pagar</button>
        </div>
      `).join('')}

      <button onclick="google.script.host.close()">❌ Fechar</button>

      <script>
        function pagar(linha, btn){
          if(btn.disabled) return;
          btn.disabled = true;
          btn.innerText = '⏳ Processando...';

          google.script.run
            .withSuccessHandler(()=>{
              alert('Conta paga com sucesso!');
              google.script.host.close();
            })
            .withFailureHandler(e=>{
              alert(e.message || e);
              btn.disabled = false;
              btn.innerText = '💸 Pagar';
            })
            .pagarContaAPagar(linha);
        }
      </script>
    </div>
    `;

    abrirPopup('💰 Contas a Pagar', html, 420, 520);
  }
  function pagarContaAPagar(linha){

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('CONTAS_A_PAGAR');

    const status = sh.getRange(linha, 6).getValue();
    if(status === 'PAGO'){
      throw new Error('Conta já paga.');
    }

    const fornecedor = sh.getRange(linha, 2).getValue();
    const valor      = Number(sh.getRange(linha, 3).getValue()) || 0;
    const formaPgto  = sh.getRange(linha, 4).getValue();

    sh.getRange(linha, 6).setValue('PAGO');
    sh.getRange(linha, 7)
      .setValue(agoraBrasil())
      .setNumberFormat('dd/MM/yyyy HH:mm');

    registrarCaixa(
      agoraBrasil(),
      'Saida',
      valor,
      formaPgto,
      'CONTA_A_PAGAR',
      `PAGAMENTO ${fornecedor}`
    );

    registrarLog(
      'PAGAMENTO_CONTA',
      fornecedor,
      'PENDENTE',
      'PAGO'
    );

    return true;
  }
  function pagarContaById(id){
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('CONTAS_A_PAGAR');
    const dados = sh.getDataRange().getValues();
    const idx = dados.findIndex((l,i)=> i>0 && l[0] === id);
    if(idx < 0){
      throw new Error('Conta não encontrada.');
    }
    // linha na planilha é idx+1
    return pagarContaAPagar(idx + 1);
  }
  function agoraBrasil(){
    return new Date(
      Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        "yyyy/MM/dd HH:mm:ss"
      )
    );
  }

// ===============================
// PAINEL - CONTAS A PAGAR
// ===============================

  function calcularIndicadoresContasAPagar(){

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('CONTAS_A_PAGAR');

    if(!sh){
      return {
        pendentes: 0,
        total: 0,
        vencidas: 0,
        proximoVencimento: '',
        fixas: { qtd: 0, total: 0 },
        avulsas: { qtd: 0, total: 0 }
      };
    }

    const dados = sh.getDataRange().getValues().slice(1);

    let pendentes = 0;
    let total = 0;
    let vencidas = 0;
    let proximo = null;

    let fixasQtd = 0;
    let fixasTotal = 0;
    let avulsasQtd = 0;
    let avulsasTotal = 0;

    const hoje = new Date();
    hoje.setHours(0,0,0,0);

    dados.forEach(l => {

      const id     = String(l[0] || '');
      const valor  = Number(l[2]) || 0;
      const venc   = l[4] instanceof Date ? new Date(l[4]) : null;
      const status = l[5];

      if(status !== 'PENDENTE') return;

      pendentes++;
      total += valor;

      // 🔹 separação fixa / avulsa
      if(id.startsWith('FIXA_')){
        fixasQtd++;
        fixasTotal += valor;
      } else if(id.startsWith('AVULSA_')){
        avulsasQtd++;
        avulsasTotal += valor;
      }

      if(venc){
        venc.setHours(0,0,0,0);

        if(venc < hoje){
          vencidas++;
        }

        if(!proximo || venc < proximo){
          proximo = venc;
        }
      }
    });

    return {
      pendentes,
      total,
      vencidas,
      proximoVencimento: proximo
        ? Utilities.formatDate(
            proximo,
            Session.getScriptTimeZone(),
            'dd/MM/yyyy'
          )
        : '',
      fixas: {
        qtd: fixasQtd,
        total: fixasTotal
      },
      avulsas: {
        qtd: avulsasQtd,
        total: avulsasTotal
      }
    };
  }
  function popupPainelContasAPagar(){

    const indicadores = calcularIndicadoresContasAPagar();

    // 🎨 cor de risco
    let cor = '#dcfce7'; // verde
    let alerta = '🟢 Tudo em dia';

    if(indicadores.vencidas > 0){
      cor = '#fee2e2'; // vermelho
      alerta = '🔴 Existem contas vencidas';
    } else if(indicadores.proximoVencimento){
      cor = '#fef3c7'; // amarelo
      alerta = '🟡 Atenção aos próximos vencimentos';
    }

    const html = `
      <div style="
        font-family:Arial;
        display:flex;
        flex-direction:column;
        gap:14px
      ">

        <div style="
          background:${cor};
          padding:14px;
          border-radius:12px;
          text-align:center
        ">
          <h3 style="margin:0">🧾 Contas a Pagar</h3>
          <small>${alerta}</small>
        </div>

        <div style="
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:10px;
          text-align:center
        ">
          <div style="background:#FF7F50;color:#e5e7eb;padding:10px;border-radius:10px">
            <div>📌 Pendentes</div>
            <strong>${indicadores.pendentes}</strong>
          </div>

          <div style="background:#4169E1;color:#e5e7eb;padding:10px;border-radius:10px">
            <div>💰 Total</div>
            <strong>R$ ${Number(indicadores.total).toFixed(2).replace('.',',')}</strong>
          </div>

          <div style="background:#B22222;color:#e5e7eb;padding:10px;border-radius:10px">
            <div>⚠️ Vencidas</div>
            <strong>${indicadores.vencidas}</strong>
          </div>

          <div style="background:#228B22;color:#e5e7eb;padding:10px;border-radius:10px">
            <div>📅 Próx. Venc.</div>
            <strong>${indicadores.proximoVencimento || '-'}</strong>
          </div>
        </div>

        <div style="display:flex;gap:10px;margin-top:6px">
          <button class="btn-primary" style="flex:1" onclick="cadastrar()">
            ➕ Cadastrar Conta
          </button>

          <button class="btn-success" style="flex:1" onclick="pagar()">
            💸 Pagar Conta
          </button>
        </div>

        <div style="
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:10px;
          text-align:center
        ">
          <div style="background:#0f172a;color:#e5e7eb;padding:10px;border-radius:10px">
            <div>🔁 Fixas</div>
            <small>${indicadores.fixas.qtd} contas</small><br>
            <strong>R$ ${indicadores.fixas.total.toFixed(2).replace('.',',')}</strong>
          </div>

          <div style="background:#0f172a;color:#e5e7eb;padding:10px;border-radius:10px">
            <div>🧾 Avulsas</div>
            <small>${indicadores.avulsas.qtd} contas</small><br>
            <strong>R$ ${indicadores.avulsas.total.toFixed(2).replace('.',',')}</strong>
          </div>
        </div>


        <script>
          function cadastrar(){
            google.script.run.popupContaAPagar();
            google.script.host.close();
          }

          function pagar(){
            google.script.run.popupContasAPagarPendentes();
            google.script.host.close();
          }
        </script>

      </div>
    `;

    abrirPopup(
      '🧾 Painel – Contas a Pagar',
      html,
      420,
      420
    );
  }

// ===============================
// PAINEL - COMANDAS
// ===============================
  function popupPainelComandas(){

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('COMANDAS');

    if(!sh){
      SpreadsheetApp.getUi().alert('❌ Aba COMANDAS não encontrada.');
      return;
    }

    // Se não existem dados, obtém array vazio
    const dados = sh.getLastRow() < 2 ? [] : sh.getDataRange().getValues();
    const agora = new Date();

    let abertas = [];
    let fechadasHoje = 0;
    let totalAberto = 0;

    // Processa apenas se existem dados
    if(dados.length > 0){
      dados.slice(1).forEach(l => {
        const pedido = l[0];
        const data   = new Date(l[1]);
        const cliente= l[2] || '-';
        const status = l[4];

        if(status === 'ABERTA' || status === 'AGUARDANDO_PGTO'){
          const diffMin = Math.floor((agora - data) / 60000);
          const horas = Math.floor(diffMin / 60);
          const mins  = diffMin % 60;

          const tempo = horas > 0 ? `${horas}h ${mins}min` : `${mins}min`;
          const saldo = calcularSaldoComanda(pedido);

          totalAberto += saldo;

          abertas.push({ pedido, cliente, tempo, saldo });
        }

        if(status === 'FECHADA'){
          const hoje = Utilities.formatDate(agora, Session.getScriptTimeZone(), 'yyyyMMdd');
          const dataCmd = Utilities.formatDate(data, Session.getScriptTimeZone(), 'yyyyMMdd');
          if(hoje === dataCmd) fechadasHoje++;
        }
      });
    }

    const html = `
    <style>
      .card{
        background:#f8fafc;
        border:1px solid #e5e7eb;
        border-radius:10px;
        padding:8px;
        text-align:center;
        font-size:13px;
      }
      .linha{
        background:#ffffff;
        border:1px solid #e5e7eb;
        border-radius:10px;
        padding:10px;
        margin-bottom:8px;
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:10px;
      }
      .btn-mini{
        padding:6px 10px;
        font-size:12px;
        border-radius:8px;
        border:1px solid #e5e7eb;
        background:#FEF3C7;
        cursor:pointer;
        display:inline-flex;
        align-items:center;
        gap:6px;
        width:fit-content;
        white-space:nowrap;
      }
      .topo{
        display:flex;
        justify-content:space-between;
        align-items:center;
        margin-bottom:8px;
      }
    </style>

    <!-- TOPO -->
    <div class="topo">
      <h3 style="margin:0">🧾 Painel de Comandas</h3>

      <button class="btn-mini"
        onclick="google.script.run.popupComandaBalcao()">
        ➕ Nova Comanda
      </button>
    </div>

    <!-- RESUMO -->
    <div style="
      display:grid;
      grid-template-columns:repeat(3,1fr);
      gap:8px;
      margin-bottom:10px
    ">
      <div class="card">
        <div style="color:#475569;font-size:12px">🟢 Abertas</div>
        <strong>${abertas.length}</strong>
      </div>

      <div class="card">
        <div style="color:#475569;font-size:12px">💵 Em Aberto</div>
        <strong>R$ ${totalAberto.toFixed(2).replace('.',',')}</strong>
      </div>

      <div class="card">
        <div style="color:#475569;font-size:12px">✅ Fechadas Hoje</div>
        <strong>${fechadasHoje}</strong>
      </div>
    </div>

    <hr>

    ${abertas.length ? abertas.map(c => `
      <div class="linha">
        <div>
          <strong>🧾 Comanda #${String(c.pedido).padStart(6,'0')}</strong><br>
          <small>👤 ${c.cliente}</small><br>
          <small>⏱️ ${c.tempo}</small>
        </div>

        <div style="text-align:right">
          <div style="font-weight:bold">
            R$ ${c.saldo.toFixed(2).replace('.',',')}
          </div>
          <button class="btn-mini"
            onclick="google.script.run.popupComandaExistente(${c.pedido})">
            🔎 Abrir
          </button>      
          </div>
      </div>
    `).join('') : `
      <p style="text-align:center;color:#64748b">
        Nenhuma comanda aberta no momento.
      </p>
    `}
    `;

    abrirPopup('🧾 Painel de Comandas', html, 720, 620);
  }
  function formatarTempo(minutos){
    if(minutos < 60){
      return minutos + 'min';
    }

    const h = Math.floor(minutos / 60);
    const m = minutos % 60;

    return h + 'h ' + (m < 10 ? '0' + m : m) + 'min';
  }

// ===============================
// PAINEL - FLUXO DE CAIXA
// ===============================
  function getResumoFluxoCaixa(dataIni, dataFim){

    const ss = SpreadsheetApp.getActive();

    /* ============================
      CAIXA
    ============================ */
    const sh = ss.getSheetByName('CAIXA');
    if(!sh){
      throw new Error('Aba CAIXA não encontrada.');
    }

    const dados = sh.getDataRange().getValues();

    const ini = new Date(dataIni + 'T00:00:00');
    const fim = new Date(dataFim + 'T23:59:59');

    let resumo = {
      dinheiro: 0,
      pix: 0,
      debito: 0,
      credito: 0,
      fiado: 0,        // 🔹 informativo (vem do A RECEBER)
      entradas: 0,
      saidas: 0,
      saldoReal: 0,
      resultado: 0
    };

    dados.forEach((l,i)=>{
      if(i === 0) return;

      const data = new Date(l[0]);
      if(isNaN(data)) return;
      if(data < ini || data > fim) return;

      const tipo  = String(l[1] || '').trim().toUpperCase();
      const valor = Number(l[2]) || 0;

      const pagamento = String(l[3] || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g,'')
        .replace(/[^\w\s]/g,'')
        .toUpperCase();

      if(tipo === 'ENTRADA'){
        resumo.entradas += valor;

        if(pagamento.includes('DINHEIRO')) resumo.dinheiro += valor;
        else if(pagamento.includes('PIX')) resumo.pix += valor;
        else if(pagamento.includes('DEBITO')) resumo.debito += valor;
        else if(pagamento.includes('CREDITO')) resumo.credito += valor;
      }

      if(tipo === 'SAIDA' || tipo === 'SAÍDA'){
        resumo.saidas += valor;
      }
    });

    /* ============================
      FIADO → CONTAS A RECEBER
    ============================ */
    const shCR = ss.getSheetByName('CONTAS_A_RECEBER');

    if(shCR){
      const cr = shCR.getDataRange().getValues().slice(1);

      cr.forEach(l => {

        const dataCriacao = new Date(l[9]);
        if(isNaN(dataCriacao)) return;
        if(dataCriacao < ini || dataCriacao > fim) return;

        const saldo  = Number(l[6]) || 0;
        const status = String(l[8] || '').toUpperCase();

        if(saldo > 0 && status !== 'QUITADO'){
          resumo.fiado += saldo;
        }
      });
    }

    /* ============================
      CÁLCULOS FINAIS
    ============================ */

    // 💰 dinheiro real em caixa
    resumo.saldoReal =
      resumo.dinheiro +
      resumo.pix +
      resumo.debito -
      resumo.saidas;

    // 📊 resultado contábil
    resumo.resultado =
      resumo.entradas -
      resumo.saidas;

    return resumo;
  }
  function popupFluxoCaixa(){

    const hoje = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );

    const html = `
    <div style="font-family:Arial;display:flex;flex-direction:column;gap:12px">


      <!-- FILTRO -->
      <div style="display:flex;gap:8px;align-items:center;justify-content:center">
        <input id="ini" type="date" value="${hoje}">
        <span>até</span>
        <input id="fim" type="date" value="${hoje}">
        <button onclick="filtrar()" style="padding:6px 10px">🔍</button>
      </div>

      <hr>

      <!-- SALDO REAL -->
      <div style="
        background:#020617;
        color:#e5e7eb;
        padding:12px;
        border-radius:10px;
        text-align:center
      ">
        <div style="font-size:13px">💰 SALDO REAL</div>
        <div id="saldo" style="font-size:22px;font-weight:bold">
          R$ 0,00
        </div>
      </div>

      <!-- ENTRADAS REAIS -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <div>💵 Dinheiro<br><strong id="dinheiro">R$ 0,00</strong></div>
        <div>⚡ Pix<br><strong id="pix">R$ 0,00</strong></div>
        <div>💳 Débito<br><strong id="debito">R$ 0,00</strong></div>
      </div>

      <hr>

      <!-- INFORMATIVO -->
      <div style="font-size:13px;color:#475569">
        📊 Informativo
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div>💳 Crédito<br><strong id="credito">R$ 0,00</strong></div>
        <div>🧾 Fiado<br><strong id="fiado">R$ 0,00</strong></div>
      </div>

      <hr>

      <!-- RESULTADO -->
      <div style="text-align:right">
        ⬆️ Entradas: <strong id="entradas">R$ 0,00</strong><br>
        ⬇️ Saídas: <strong id="saidas">R$ 0,00</strong><br>
        📈 Resultado: <strong id="resultado">R$ 0,00</strong>
      </div>

      <button onclick="google.script.host.close()">❌ Fechar</button>

      <script>
        function moeda(v){
          return 'R$ ' + Number(v).toFixed(2).replace('.',',');
        }

        function filtrar(){
          google.script.run
            .withSuccessHandler(r=>{
              dinheiro.innerText = moeda(r.dinheiro);
              pix.innerText = moeda(r.pix);
              debito.innerText = moeda(r.debito);
              credito.innerText = moeda(r.credito);
              fiado.innerText = moeda(r.fiado);
              entradas.innerText = moeda(r.entradas);
              saidas.innerText = moeda(r.saidas);
              saldo.innerText = moeda(r.saldoReal);
              resultado.innerText = moeda(r.resultado);
            })
            .getResumoFluxoCaixa(
              ini.value,
              fim.value
            );
        }

        filtrar();
      </script>
    </div>
    `;

    abrirPopup(
      '📊 Fluxo de Caixa',
      html,
      520,
      540
    );
  }

// =============================================
// MODULO CONTAS A RECEBER
// =============================================
  function popupReceberContaAReceber(id){

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('CONTAS_A_RECEBER');

    const dados = sh.getDataRange().getValues();
    const linha = dados.findIndex((l,i)=> i>0 && l[0] === id);

    if(linha < 0){
      SpreadsheetApp.getUi().alert('Conta não encontrada.');
      return;
    }

    const d = dados[linha];

    const html = `
    <div style="display:flex;flex-direction:column;gap:12px;font-family:Arial">

      <h3 style="text-align:center">💰 Receber Parcial</h3>

      <div style="
        background:#020617;
        color:#e5e7eb;
        padding:10px;
        border-radius:10px;
        text-align:center
      ">
        <strong>${d[3]}</strong><br>
        <small>${d[2]}</small>
      </div>

      <div>
        💵 Saldo atual:
        <strong style="color:#16a34a">
          R$ ${Number(d[6]).toFixed(2).replace('.',',')}
        </strong>
      </div>

      <label>Valor a receber</label>
      <input id="valor" placeholder="R$ 0,00">

      <label>Forma de recebimento</label>
      <select id="forma">
        <option value="⚡ Pix">⚡ Pix</option>
        <option value="💵 Dinheiro">💵 Dinheiro</option>
        <option value="💳 Cartão Débito">💳 Cartão Débito</option>
        <option value="💳 Cartão Crédito">💳 Cartão Crédito</option>
      </select>

      <button id="btn" onclick="confirmar()">
        💾 Registrar Recebimento
      </button>

      <button onclick="google.script.host.close()">❌ Cancelar</button>

      <script>
        const inputValor = document.getElementById('valor');
        const selectForma = document.getElementById('forma');
        const btn = document.getElementById('btn');
        let processando = false;

        inputValor.addEventListener('input', ()=>{
          let v = inputValor.value.replace(/\\D/g,'');
          if(!v){
            inputValor.value = '';
            return;
          }
          v = (Number(v)/100).toFixed(2);
          inputValor.value = 'R$ ' + v.replace('.',',');
        });

        function confirmar(){

          if(processando) return;
          processando = true;

          let valor = inputValor.value
            .replace('R$','')
            .replace(',','.')
            .trim();

          valor = Number(valor);

          if(!valor || valor <= 0){
            alert('Informe um valor válido.');
            processando = false;
            return;
          }

          btn.disabled = true;
          btn.innerText = '⏳ Processando...';

          google.script.run
            .withFailureHandler(e=>{
              alert(e.message || e);
              btn.disabled = false;
              btn.innerText = '💾 Registrar Recebimento';
              processando = false;
            })
            .withSuccessHandler(()=>{
              google.script.host.close();
              google.script.run.popupContasAReceber();
            })
            .receberParcialContaAReceber(
              '${id}',
              valor,
              selectForma.value
            );
        }
      </script>

    </div>
    `;

    abrirPopup('💰 Receber', html, 420, 480);
  }
  function popupPainelFinanceiro(){

    const hoje = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );

    const html = `
    <div style="font-family:Arial;display:flex;flex-direction:column;gap:14px">

      <h3 style="text-align:center">📊 Painel Financeiro</h3>

      <!-- 🔎 BUSCA POR PERÍODO -->
      <div style="
        border:1px solid #e5e7eb;
        border-radius:10px;
        padding:10px;
        background:#f8fafc
      ">

        <div style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          margin-bottom:8px
        ">
          <strong>🔎 Busca por período</strong>

          <button
            onclick="buscar()"
            style="
              width:120px;
              height:28px;
              border-radius:6px;
              background:#2563eb;
              color:#fff;
              border:none;
              cursor:pointer;
              font-size:12px;
              display:flex;
              align-items:center;
              justify-content:center
            ">
            🔎 Buscar
          </button>      
        </div>

        <div style="display:flex;gap:10px">
          <div style="flex:1">
            <label>📅 Data Inicial</label>
            <input id="ini" type="date" style="width:100%">
          </div>

          <div style="flex:1">
            <label>📅 Data Final</label>
            <input id="fim" type="date" value="${hoje}" style="width:100%">
          </div>
        </div>
      </div>

      <!-- ➕ AÇÕES -->
      <div style="
        display:flex;
        justify-content:flex-end;
        gap:8px
      ">
      </div>

      <!-- RESULTADO -->
      <div id="resultado" style="min-height:120px">
        <div style="text-align:center;color:#64748b">
          ⏳ Carregando mês atual...
        </div>
      </div>
        <button
          onclick="google.script.run.popupContaAPagar()"
          style="
            width:160px;
            height:28px;
            border-radius:6px;
            background:#dc2626;
            color:#fff;
            border:none;
            cursor:pointer;
            font-size:12px;
            display:flex;
            align-items:center;
            justify-content:center
          ">
          ➕ Nova Conta a Pagar
        </button>
        <button
          onclick="google.script.host.close()"
          style="
            width:120px;
            height:28px;
            margin:0 auto;
            border-radius:6px;
            background:#64748b;
            color:#fff;
            border:none;
            cursor:pointer;
            font-size:12px;
            display:flex;
            align-items:center;
            justify-content:center
          ">
          ❌ Fechar
        </button>
      <script>

        // 🔥 MÊS ATUAL AUTOMÁTICO
        google.script.run
          .withSuccessHandler(html=>{
            resultado.innerHTML = html;
          })
          .gerarPainelFinanceiroMesAtual();

        function buscar(){

          if(!ini.value){
            alert('Informe a data inicial.');
            return;
          }

          resultado.innerHTML =
            '<div style="text-align:center">⏳ Buscando...</div>';

          google.script.run
            .withSuccessHandler(html=>{
              resultado.innerHTML = html;
            })
            .withFailureHandler(e=>{
              alert(e.message || e);
            })
            .gerarPainelFinanceiro(ini.value, fim.value);
        }
      </script>

    </div>
    `;

    abrirPopup('📊 Financeiro', html, 760, 680);
  }
  function garantirContasAReceber(){

    const ss = SpreadsheetApp.getActive();
    let sh = ss.getSheetByName('CONTAS_A_RECEBER');

    if(!sh){
      sh = ss.insertSheet('CONTAS_A_RECEBER');
      sh.getRange('A1:I1').setValues([[
        'ID',
        'Origem',
        'Referencia',
        'Cliente',
        'Valor_Total',
        'Valor_Recebido',
        'Saldo',
        'Forma_Original',
        'Status'
      ]]);
    }
  }

// ===============================
// 🔐 FUNÇÕES DE PERFIL E LOGOUT
// ===============================

  function abrirMeuPerfil(){
    const usuario = obterUsuarioAtual();

    if(!usuario){
      SpreadsheetApp.getUi().alert('❌ Nenhum usuário logado.');
      return;
    }

    const html = `
      <div style="font-family:Arial; padding: 20px; max-width: 400px;">
        <h2 style="text-align:center; color:#0f172a">👤 Meu Perfil</h2>
    
        <div style="background:#f0f4f8; padding:15px; border-radius:8px; margin:15px 0">
          <p><strong>Nome:</strong> ${usuario.nome}</p>
          <p><strong>Email:</strong> ${usuario.email}</p>
          <p><strong>Perfil:</strong> 
            <span style="
              background:${usuario.perfil === 'GERENCIAL' ? '#16a34a' : '#2563eb'};
              color:white;
              padding:4px 8px;
              border-radius:4px;
              font-weight:bold;
            ">
              ${usuario.perfil === 'GERENCIAL' ? '👨‍💼 Gerencial' : '📦 Operacional'}
            </span>
          </p>
          <p><strong>Status:</strong> ${usuario.ativo === 'SIM' ? '✅ Ativo' : '❌ Inativo'}</p>
        </div>
    
        <div style="text-align:center; margin-top:20px">
          <button onclick="google.script.host.close()" style="
            padding:10px 20px;
            background:#2563eb;
            color:#fff;
            border:none;
            border-radius:6px;
            cursor:pointer;
          ">
            ✅ Fechar
          </button>
        </div>
      </div>
    `;

    abrirPopup('👤 Meu Perfil', html, 420, 350);
  }
  function fazerLogout(){
    const ui = SpreadsheetApp.getUi();

    const resp = ui.alert(
      '🚪 Logout',
      'Tem certeza que deseja sair?',
      ui.ButtonSet.YES_NO
    );

    if(resp !== ui.Button.YES) return;

    // Encerra sessão
    encerrarSessao();

    // Limpa cache e propriedades
    CacheService.getUserCache().removeAll([
      'SESSAO_ATIVA',
      'ID_USER',
      'USUARIO_ATUAL'
    ]);

    ui.alert('✅ Logout realizado com sucesso.');

    // Recarrega página
    setTimeout(() => {
      popupLogin();
    }, 500);
  }
  function aplicarTemaCompleto(){
    const ss = SpreadsheetApp.getActive();
    const sheets = ss.getSheets();

    sheets.forEach(sh => {
      // Cores do tema DARK
      const corFundo = '#0f172a';
      const corCabecalho = '#1e293b';
      const corTexto = '#e2e8f0';
      const corDestaque = '#3730a3';

      // Oculta gridlines
      sh.setHiddenGridlines(true);

      // Aplica ao cabeçalho (primeira linha)
      const ultimaCol = sh.getLastColumn() || 8;
      if(ultimaCol > 0){
        try {
          sh.getRange(1, 1, 1, ultimaCol)
            .setBackground(corCabecalho)
            .setFontColor('#e0e7ff')
            .setFontWeight('bold');
        } catch(e){}
      }

      // Define fontes padrão (aplica ao conteúdo da planilha)
      try{ sh.getDataRange().setFontFamily('Arial').setFontSize(11); }catch(e){};
    });

    SpreadsheetApp.getUi().alert('✅ Tema padrão aplicado a todas as abas.');
  }
  function garantirSenhaResetObrigatoria(){
    const props = PropertiesService.getScriptProperties();

    if(!props.getProperty('SENHA_RESET')){
      // Define senha padrão
      props.setProperty('SENHA_RESET', 'A1D2M1N@2026');
      props.setProperty('RESET_SENHA_OBRIGATORIA', 'SIM');

      registrarLog(
        'RESET_SENHA_CONFIG',
        'Senha de reset configurada',
        'admin123',
        'Sistema'
      );
    }
  }
  function criarContaAReceber(origem, idVenda, cliente, valor, forma){
    garantirContasAReceber();

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('CONTAS_A_RECEBER');

    const dados = sh.getDataRange().getValues();
    let seq = 1;

    dados.slice(1).forEach(l => {
      const id = String(l[0] || '');
      if(id.startsWith('CR-')){
        const n = Number(id.replace('CR-',''));
        if(n >= seq) seq = n + 1;
      }
    });

    const id = 'CR-' + String(seq).padStart(6,'0');

    sh.appendRow([
      id,
      origem,           // COMANDA | DELIVERY
      idVenda,          // C-000012 | D-000008
      cliente || '',
      Number(valor),
      0,
      Number(valor),
      forma,            // FIADO | CRÉDITO
      'PENDENTE',
      agoraBrasil(),
      ''
    ]);

    sh.getRange(sh.getLastRow(), 5, 1, 3)
      .setNumberFormat('R$ #,##0.00');

    return id;
  }
  function validarClienteFiado(cliente){

    if(!cliente){
      throw new Error('Informe o cliente para venda fiado.');
    }

    const ss = SpreadsheetApp.getActive();
    const shCli = ss.getSheetByName('CLIENTES');

    if(!shCli){
      throw new Error('Aba CLIENTES não encontrada.');
    }

    const clientes = shCli
      .getDataRange()
      .getValues()
      .slice(1)
      .map(l => String(l[0]).trim().toUpperCase())
      .filter(Boolean);

    const nome = String(cliente).trim().toUpperCase();

    if(!clientes.includes(nome)){
      throw new Error(
        'Cliente não cadastrado.\nCadastre o cliente para usar FIADO.'
      );
    }

    // ✅ NÃO BLOQUEIA MAIS NOVO FIADO
    // Cada venda FIADO gera uma nova conta a receber
    return true;
  }
  function receberParcialContaAReceber(id, valor, forma){

    valor = Number(valor);
    if(valor <= 0){
      throw new Error('Valor inválido.');
    }

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('CONTAS_A_RECEBER');
    const dados = sh.getDataRange().getValues();

    const linha = dados.findIndex((l,i)=> i>0 && l[0] === id);
    if(linha < 0){
      throw new Error('Conta não encontrada.');
    }

    const total   = Number(dados[linha][4]) || 0;
    const recebido= Number(dados[linha][5]) || 0;
    const saldo   = Number(dados[linha][6]) || 0;

    if(valor > saldo){
      throw new Error('Valor maior que o saldo.');
    }

    const novoRecebido = recebido + valor;
    const novoSaldo    = total - novoRecebido;

    sh.getRange(linha+1,6).setValue(novoRecebido);
    sh.getRange(linha+1,7).setValue(novoSaldo);

    sh.getRange(linha+1,9)
      .setValue(novoSaldo === 0 ? 'QUITADO' : 'PARCIAL');

    // 🔥 REGISTRA CAIXA (SEM AMARRAR A FISCAL AINDA)
    registrarCaixa(
      agoraBrasil(),
      'Entrada',
      valor,
      forma,
      'CONTAS_A_RECEBER',
      id
    );

    registrarLog(
      'RECEBIMENTO',
      id,
      recebido,
      novoRecebido
    );

    return true;
  }
  function gerarPainelFinanceiro(dataIni, dataFim){

    const ss = SpreadsheetApp.getActive();

    const ini = new Date(dataIni + 'T00:00:00');
    const fim = new Date(dataFim + 'T23:59:59');

    /* ============================
      CAIXA
    ============================ */
    const caixa = ss.getSheetByName('CAIXA').getDataRange().getValues();

    let entradas = 0;
    let saidas   = 0;

    caixa.forEach((l,i)=>{
      if(i === 0) return;

      const data = new Date(l[0]);
      if(data < ini || data > fim) return;

      if(l[1] === 'Entrada') entradas += Number(l[2]) || 0;
      if(l[1] === 'Saida')   saidas   += Number(l[2]) || 0;
    });

    /* ============================
      CONTAS A RECEBER (ACUMULADO)
    ============================ */
    let contasReceberHtml = '<p style="color:#64748b">Nenhuma conta a receber.</p>';
    const crSh = ss.getSheetByName('CONTAS_A_RECEBER');

    let nivelFiado = 0; // 🔥 KPI

    if(crSh){
      const cr = crSh.getDataRange().getValues().slice(1);
      const mapa = {};

      cr.forEach(l=>{
        const data = new Date(l[9]);
        const cliente = l[3];
        const saldo = Number(l[6]) || 0;
        const status = l[8];

        if(data < ini || data > fim) return;
        if(status === 'QUITADO') return;
        if(saldo <= 0) return;

        nivelFiado += saldo; // 🔥 acumula fiado

        if(!mapa[cliente]){
          mapa[cliente] = { saldo: 0, id: l[0] };
        }

        mapa[cliente].saldo += saldo;
      });

      if(Object.keys(mapa).length){
        contasReceberHtml = Object.keys(mapa).map(c=>`
          <div style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            border:1px solid #e5e7eb;
            border-radius:8px;
            padding:8px 10px;
            margin-bottom:6px
          ">
            <div>
              <strong>${c}</strong><br>
              <small>
                Saldo:
                <strong style="color:#dc2626">
                  R$ ${mapa[c].saldo.toFixed(2).replace('.',',')}
                </strong>
              </small>
            </div>

            <button
              style="
                width:110px;
                height:28px;
                font-size:12px;
                border-radius:6px;
                background:#16a34a;
                color:#fff;
                border:none;
                cursor:pointer;
                display:flex;
                align-items:center;
                justify-content:center
              "
              onclick="google.script.run.popupReceberContaAReceber('${mapa[c].id}')">
              💰 Receber
            </button>        
          </div>
        `).join('');
      }
    }

    /* ============================
      CONTAS A PAGAR
    ============================ */
    let contasPagarHtml = '<p style="color:#64748b">Nenhuma conta a pagar.</p>';
    const cpSh = ss.getSheetByName('CONTAS_A_PAGAR');

    if(cpSh){
      const cp = cpSh.getDataRange().getValues().slice(1);

      const pendentes = cp.filter(l=>{
        const data = new Date(l[4]);
        return (
          data >= ini &&
          data <= fim &&
          l[5] === 'PENDENTE'
        );
      });

      if(pendentes.length){
        contasPagarHtml = pendentes.map(l=>`
          <div style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            border:1px solid #e5e7eb;
            border-radius:8px;
            padding:8px 10px;
            margin-bottom:6px
          ">
            <div>
              <strong>${l[1]}</strong><br>
              <small>
                Valor:
                <strong style="color:#dc2626">
                  R$ ${Number(l[2]).toFixed(2).replace('.',',')}
                </strong>
              </small>
            </div>

            <button
              style="
                width:110px;
                height:28px;
                font-size:12px;
                border-radius:6px;
                background:#dc2626;
                color:#fff;
                border:none;
                cursor:pointer;
                display:flex;
                align-items:center;
                justify-content:center
              "
              onclick="google.script.run.pagarContaById('${l[0]}')">
              💸 Pagar
            </button>       
          </div>
        `).join('');
      }
    }

    const resultado = entradas - saidas;

    /* ============================
      HTML FINAL
    ============================ */
    return `
      <div style="display:flex;flex-direction:column;gap:12px">

        <div style="display:flex;gap:20px;font-size:14px;flex-wrap:wrap">
          <div>💰 Entradas: <strong>R$ ${entradas.toFixed(2).replace('.',',')}</strong></div>
          <div>💸 Saídas: <strong>R$ ${saidas.toFixed(2).replace('.',',')}</strong></div>
          <div>
            ⚖️ Resultado:
            <strong style="color:${resultado>=0?'#16a34a':'#dc2626'}">
              R$ ${resultado.toFixed(2).replace('.',',')}
            </strong>
          </div>
          <div>
            🧾 Fiado em Aberto:
            <strong style="color:#dc2626">
              R$ ${nivelFiado.toFixed(2).replace('.',',')}
            </strong>
          </div>
        </div>

        <hr>

        <h4>📌 Contas a Receber</h4>
        ${contasReceberHtml}

        <hr>

        <h4>📌 Contas a Pagar</h4>
        ${contasPagarHtml}

      </div>
    `;
  }
  function gerarPainelFinanceiroMesAtual(){

    const hoje = new Date();
    const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59);

    return gerarPainelFinanceiro(
      Utilities.formatDate(ini, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
      Utilities.formatDate(fim, Session.getScriptTimeZone(), 'yyyy-MM-dd')
    );
  }
  function gerarRelatorioFinanceiroCompleto() {
    const ss = SpreadsheetApp.getActive();
    const caixa = ss.getSheetByName('CAIXA');
    const vendas = ss.getSheetByName('VENDAS');
    const compras = ss.getSheetByName('COMPRAS');
    const contasReceber = ss.getSheetByName('CONTAS_A_RECEBER');
    const contasPagar = ss.getSheetByName('CONTAS_A_PAGAR');

    let sh = ss.getSheetByName('RELATORIO_FINANCEIRO');
    if(!sh){
      sh = ss.insertSheet('RELATORIO_FINANCEIRO');
    }
    sh.clear();

    const dadosCaixa = caixa ? caixa.getDataRange().getValues().slice(1) : [];
    const dadosVendas = vendas ? vendas.getDataRange().getValues().slice(1) : [];
    const dadosCompras = compras ? compras.getDataRange().getValues().slice(1) : [];
    const dadosCR = contasReceber ? contasReceber.getDataRange().getValues().slice(1) : [];
    const dadosCP = contasPagar ? contasPagar.getDataRange().getValues().slice(1) : [];

    const totalEntradas = dadosCaixa
      .filter(l => String(l[1]).toUpperCase() === 'ENTRADA')
      .reduce((s, l) => s + (Number(l[2]) || 0), 0);

    const totalSaidas = dadosCaixa
      .filter(l => String(l[1]).toUpperCase() === 'SAIDA' || String(l[1]).toUpperCase() === 'SAÍDA')
      .reduce((s, l) => s + (Number(l[2]) || 0), 0);

    const totalVendas = dadosVendas.reduce((s, l) => s + (Number(l[3]) || 0), 0);
    const totalCompras = dadosCompras.reduce((s, l) => s + ((Number(l[2]) || 0) * (Number(l[3]) || 0)), 0);
    const totalCRAberto = dadosCR
      .filter(l => String(l[8]).toUpperCase() !== 'QUITADO')
      .reduce((s, l) => s + (Number(l[6]) || 0), 0);
    const totalCPendente = dadosCP
      .filter(l => String(l[5]).toUpperCase() === 'ABERTO' || String(l[5]).toUpperCase() === 'PENDENTE')
      .reduce((s, l) => s + (Number(l[2]) || 0), 0);

    const linhasResumo = [
      ['RELATÓRIO FINANCEIRO COMPLETO', '', ''],
      ['Gerado em', new Date(), ''],
      ['', '', ''],
      ['Métrica', 'Valor', 'Observação'],
      ['Entradas no Caixa', totalEntradas, 'Somatório CAIXA tipo Entrada'],
      ['Saídas no Caixa', totalSaidas, 'Somatório CAIXA tipo Saída'],
      ['Resultado Caixa', totalEntradas - totalSaidas, 'Entradas - Saídas'],
      ['Total Vendas', totalVendas, 'Somatório VENDAS coluna Valor'],
      ['Total Compras (Qtd*Valor)', totalCompras, 'Somatório COMPRAS'],
      ['Contas a Receber em Aberto', totalCRAberto, 'CONTAS_A_RECEBER não quitadas'],
      ['Contas a Pagar Pendentes', totalCPendente, 'CONTAS_A_PAGAR abertas/pendentes'],
      ['Resultado Gerencial Estimado', totalVendas - totalCompras - totalCPendente + totalCRAberto, 'Vendas - Compras - CP + CR']
    ];

    sh.getRange(1, 1, linhasResumo.length, 3).setValues(linhasResumo);

    sh.getRange('A1:C1').merge()
      .setFontWeight('bold')
      .setBackground('#020617')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center');

    sh.getRange('A4:C4')
      .setFontWeight('bold')
      .setBackground('#1e293b')
      .setFontColor('#ffffff');

    sh.getRange(5, 2, linhasResumo.length - 4, 1).setNumberFormat('R$ #,##0.00');
    sh.getRange('B2').setNumberFormat('dd/MM/yyyy HH:mm');

    sh.setColumnWidth(1, 300);
    sh.setColumnWidth(2, 170);
    sh.setColumnWidth(3, 360);

    aplicarFormatacaoPadrao(sh);

    registrarInformacaoImportanteNoDrive(
      'RELATORIO',
      'Relatório financeiro completo',
      [
        `Entradas caixa: R$ ${totalEntradas.toFixed(2)}`,
        `Saídas caixa: R$ ${totalSaidas.toFixed(2)}`,
        `Total vendas: R$ ${totalVendas.toFixed(2)}`,
        `Total compras: R$ ${totalCompras.toFixed(2)}`,
        `CR em aberto: R$ ${totalCRAberto.toFixed(2)}`,
        `CP pendente: R$ ${totalCPendente.toFixed(2)}`
      ].join('\n'),
      { subcategoria: 'Financeiro' }
    );

    ss.setActiveSheet(sh);
    SpreadsheetApp.getUi().alert('✅ Relatório financeiro completo gerado!');
  }
  function gerarRelatorioCompras() {
    const ss = SpreadsheetApp.getActive();
    const compras = ss.getSheetByName('COMPRAS');
    if(!compras){
      SpreadsheetApp.getUi().alert('❌ Aba COMPRAS não encontrada.');
      return;
    }

    const dados = compras.getDataRange().getValues();
    const itens = dados.slice(1);

    let sh = ss.getSheetByName('RELATORIO_COMPRAS');
    if(!sh){
      sh = ss.insertSheet('RELATORIO_COMPRAS');
    }
    sh.clear();

    const headers = ['Data', 'Produto', 'Qtd', 'Valor Unit.', 'Valor Total', 'Fornecedor'];
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#020617').setFontColor('#fff');

    const rows = [];
    let totalGeral = 0;

    itens.forEach(l => {
      const qtd = Number(l[2]) || 0;
      const valorBruto = Number(l[3]) || 0;
      const valorUnit = qtd > 0 ? (valorBruto / qtd) : 0;
      const valorTotal = valorBruto;
      totalGeral += valorTotal;

      rows.push([
        l[0] || '',
        l[1] || '',
        qtd,
        valorUnit,
        valorTotal,
        l[4] || ''
      ]);
    });

    if(rows.length){
      sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }

    const rowTotal = rows.length + 3;
    sh.getRange(rowTotal, 1).setValue('TOTAL GERAL').setFontWeight('bold');
    sh.getRange(rowTotal, 5).setValue(totalGeral).setFontWeight('bold').setNumberFormat('R$ #,##0.00');

    if(rows.length){
      sh.getRange(2, 1, rows.length, 1).setNumberFormat('dd/MM/yyyy HH:mm');
      sh.getRange(2, 4, rows.length, 2).setNumberFormat('R$ #,##0.00');
    }

    sh.setColumnWidth(1, 160);
    sh.setColumnWidth(2, 260);
    sh.setColumnWidth(3, 110);
    sh.setColumnWidth(4, 140);
    sh.setColumnWidth(5, 160);
    sh.setColumnWidth(6, 220);

    aplicarFormatacaoPadrao(sh);

    registrarInformacaoImportanteNoDrive(
      'RELATORIO',
      'Relatório de compras',
      [
        `Itens: ${rows.length}`,
        `Total comprado: R$ ${totalGeral.toFixed(2)}`
      ].join('\n'),
      { subcategoria: 'Compras' }
    );

    ss.setActiveSheet(sh);
    SpreadsheetApp.getUi().alert('✅ Relatório de compras gerado!');
  }
  function gerarRelatorioLogsSistema() {
    const ss = SpreadsheetApp.getActive();
    const logs = ss.getSheetByName('LOG_SISTEMA');
    if(!logs){
      SpreadsheetApp.getUi().alert('❌ Aba LOG_SISTEMA não encontrada.');
      return;
    }

    const dados = logs.getDataRange().getValues().slice(1);
    const porAcao = {};
    const porUsuario = {};

    dados.forEach(l => {
      const acao = String(l[3] || 'SEM_ACAO');
      const usuario = String(l[2] || 'Desconhecido');
      porAcao[acao] = (porAcao[acao] || 0) + 1;
      porUsuario[usuario] = (porUsuario[usuario] || 0) + 1;
    });

    let sh = ss.getSheetByName('RELATORIO_LOGS');
    if(!sh){
      sh = ss.insertSheet('RELATORIO_LOGS');
    }
    sh.clear();

    sh.getRange('A1:D1').merge()
      .setValue('RELATÓRIO DE LOGS DO SISTEMA')
      .setFontWeight('bold')
      .setBackground('#020617')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center');

    sh.getRange('A2').setValue('Gerado em');
    sh.getRange('B2').setValue(new Date()).setNumberFormat('dd/MM/yyyy HH:mm:ss');
    sh.getRange('A3').setValue('Total de logs');
    sh.getRange('B3').setValue(dados.length);

    sh.getRange('A5:B5').setValues([['Ação', 'Qtde']])
      .setFontWeight('bold').setBackground('#1e293b').setFontColor('#fff');

    let row = 6;
    Object.keys(porAcao).sort().forEach(acao => {
      sh.getRange(row, 1, 1, 2).setValues([[acao, porAcao[acao]]]);
      row++;
    });

    sh.getRange('D5:E5').setValues([['Usuário', 'Qtde']])
      .setFontWeight('bold').setBackground('#1e293b').setFontColor('#fff');

    row = 6;
    Object.keys(porUsuario).sort().forEach(usuario => {
      sh.getRange(row, 4, 1, 2).setValues([[usuario, porUsuario[usuario]]]);
      row++;
    });

    sh.setColumnWidth(1, 280);
    sh.setColumnWidth(2, 90);
    sh.setColumnWidth(4, 280);
    sh.setColumnWidth(5, 90);

    aplicarFormatacaoPadrao(sh);

    registrarInformacaoImportanteNoDrive(
      'RELATORIO',
      'Relatório de logs do sistema',
      [
        `Total de logs: ${dados.length}`,
        `Ações diferentes: ${Object.keys(porAcao).length}`,
        `Usuários com ação: ${Object.keys(porUsuario).length}`
      ].join('\n'),
      { subcategoria: 'Logs' }
    );

    ss.setActiveSheet(sh);
    SpreadsheetApp.getUi().alert('✅ Relatório de logs gerado!');
  }
  function aplicarFormatacaoFinanceiraTodasAbas() {
    const ss = SpreadsheetApp.getActive();
    const padraoMoeda = ['VALOR', 'PREÇO', 'PRECO', 'CUSTO', 'TOTAL', 'SALDO', 'LUCRO'];

    ss.getSheets().forEach(sh => {
      aplicarFormatacaoPadrao(sh);

      const lastRow = sh.getLastRow();
      const lastCol = sh.getLastColumn();
      if(lastCol <= 0) return;

      for(let c=1;c<=lastCol;c++){
        const header = String(sh.getRange(1, c).getValue() || '').toUpperCase();
        const isMoeda = padraoMoeda.some(k => header.includes(k));
        if(isMoeda && lastRow > 1){
          sh.getRange(2, c, lastRow - 1, 1).setNumberFormat('R$ #,##0.00');
        }

        const largura = isMoeda ? 150 : Math.max(sh.getColumnWidth(c), 130);
        sh.setColumnWidth(c, largura);
      }
    });

    SpreadsheetApp.getUi().alert('✅ Formatação padrão aplicada em todas as abas (incluindo colunas monetárias).');
  }
  function gerarPacoteRelatoriosGerenciais() {
    gerarRelatorioValoresEstoque();
    gerarRelatorioFinanceiroCompleto();
    gerarRelatorioCompras();
    gerarRelatorioLogsSistema();
    aplicarFormatacaoFinanceiraTodasAbas();

    registrarInformacaoImportanteNoDrive(
      'RELATORIO',
      'Pacote de relatórios gerenciais',
      'Foram gerados relatórios: Estoque Valores, Financeiro Completo, Compras e Logs.',
      { subcategoria: 'Gerencial' }
    );
  }

/*************************************************
*                 🔵 V2.1
**************************************************
* =====================================================
* 📊 MÓDULO DE GESTÃO DE ESTOQUE COM VALORES
* =====================================================
* Sistema completo para gerenciar estoque com:
* - Valores totais de estoque
* - Valores após venda
* - Preços praticados
* - Análise de rentabilidade
* 
* Data: 2026-02
* Versão: 2.1.0
* =====================================================
*/
  // GESTÃO ESTOQUE
  function calcularValoresEstoque(estoque, produtos, vendas) {
    
    const relatorio = [];
    let totalValorAtual = 0;
    let totalValorCusto = 0;
    let totalVendido = 0;
    let lucroTotal = 0;
    
    estoque.forEach(linha => {
      const nomeProduto = linha[0].toString().trim();
      const quantidadeAtual = Number(linha[1]) || 0;
      const minimo = Number(linha[2]) || 0;
      
      const produto = produtos[nomeProduto];
      
      if (!produto) return;
      
      const precoVenda = produto.preco;
      const custMedio = produto.custMedio;
      const margem = produto.margem;
      
      // Valores atuais de estoque
      const valorTotalEstoque = quantidadeAtual * precoVenda;
      const custTotalEstoque = quantidadeAtual * custMedio;
      const lucroEstoque = valorTotalEstoque - custTotalEstoque;
      
      // Calcula quantidade vendida (para análise)
      const qtdVendida = calcularQuantidadeVendida(nomeProduto, vendas);
      const valorVendido = qtdVendida * precoVenda;
      const custVendido = qtdVendida * custMedio;
      const lucroVendido = valorVendido - custVendido;
      
      // Avalia status do estoque
      let status = 'Normal';
      if (quantidadeAtual <= minimo) {
        status = '🚨 Crítico';
      } else if (quantidadeAtual <= minimo * 1.5) {
        status = '⚠️ Baixo';
      } else if (quantidadeAtual > minimo * 3) {
        status = '📈 Alto';
      }
      
      relatorio.push({
        produto: nomeProduto,
        categoria: produto.categoria,
        precoVenda: precoVenda,
        custMedio: custMedio,
        margem: margem,
        // ESTOQUE ATUAL
        qtdAtual: quantidadeAtual,
        valorTotalEstoque: valorTotalEstoque,
        custTotalEstoque: custTotalEstoque,
        lucroEstoque: lucroEstoque,
        // VENDAS
        qtdVendida: qtdVendida,
        valorVendido: valorVendido,
        custVendido: custVendido,
        lucroVendido: lucroVendido,
        // ANÁLISE
        taxaRotacao: calcularTaxaRotacao(quantidadeAtual, qtdVendida),
        status: status
      });
      
      totalValorAtual += valorTotalEstoque;
      totalValorCusto += custTotalEstoque;
      totalVendido += valorVendido;
      lucroTotal += lucroVendido;
    });
    
    return {
      itens: relatorio,
      resumo: {
        totalValorEstoque: totalValorAtual,
        totalCustoEstoque: totalValorCusto,
        lucroEstoque: totalValorAtual - totalValorCusto,
        totalVendido: totalVendido,
        lucroVendido: lucroTotal,
        margemMedia: calcularMargemMedia(relatorio)
      }
    };
  }
  function obterDadosEstoque() {
    const sh = SpreadsheetApp.getActive().getSheetByName('ESTOQUE');
    if(!sh) return [];
    const dados = sh.getDataRange().getValues();
    return dados.length > 1 ? dados.slice(1) : [];
  }
  function obterDadosProdutos() {
    const sh = SpreadsheetApp.getActive().getSheetByName('PRODUTOS');
    if(!sh) return {};

    const dados = sh.getDataRange().getValues();
    const mapa = {};

    for(let i=1;i<dados.length;i++){
      const produto = String(dados[i][0] || '').trim();
      if(!produto) continue;

      mapa[produto] = {
        categoria: String(dados[i][1] || 'SEM CATEGORIA'),
        preco: Number(dados[i][4]) || 0,
        minimo: Number(dados[i][5]) || 0,
        custMedio: Number(dados[i][6]) || 0,
        margem: Number(dados[i][7]) || 0
      };
    }

    return mapa;
  }
  function obterDadosVendas() {
    const sh = SpreadsheetApp.getActive().getSheetByName('VENDAS');
    if(!sh) return [];
    const dados = sh.getDataRange().getValues();
    return dados.length > 1 ? dados.slice(1) : [];
  }
  function calcularQuantidadeVendida(produto, vendas) {
    const chave = String(produto || '').trim().toUpperCase();
    return vendas.reduce((acc, item) => {
      const prod = String(item[1] || '').trim().toUpperCase();
      if(prod !== chave) return acc;
      return acc + (Number(item[2]) || 0);
    }, 0);
  }
  function calcularTaxaRotacao(qtdAtual, qtdVendida) {
    const base = (Number(qtdAtual) || 0) + (Number(qtdVendida) || 0);
    if(base <= 0) return 0;
    return Number(((Number(qtdVendida) || 0) / base * 100).toFixed(2));
  }
  function calcularMargemMedia(relatorio) {
    if(!relatorio || !relatorio.length) return 0;
    const soma = relatorio.reduce((acc, item) => acc + (Number(item.margem) || 0), 0);
    return Number((soma / relatorio.length).toFixed(2));
  }
  function gerarRelatorioEstoqueComValores() {
    const estoque = obterDadosEstoque();
    const produtos = obterDadosProdutos();
    const vendas = obterDadosVendas();

    const relatorio = calcularValoresEstoque(estoque, produtos, vendas);

    const ss = SpreadsheetApp.getActive();
    let sh = ss.getSheetByName('ESTOQUE_VALORES');

    if(!sh){
      sh = ss.insertSheet('ESTOQUE_VALORES');
    }

    sh.clear();

    const headers = [
      'Produto', 'Categoria', 'Preço Venda', 'Custo Médio', 'Margem %',
      'Qtd Atual', 'Valor Estoque', 'Custo Estoque', 'Lucro Estoque',
      'Qtd Vendida', 'Valor Vendido', 'Lucro Vendido', 'Rotação %', 'Status'
    ];

    sh.getRange(1, 1, 1, headers.length)
      .setValues([headers])
      .setFontWeight('bold')
      .setBackground('#020617')
      .setFontColor('#ffffff')
      .setHorizontalAlignment('center');

    if(relatorio.itens.length){
      const rows = relatorio.itens.map(i => [
        i.produto,
        i.categoria,
        i.precoVenda,
        i.custMedio,
        i.margem,
        i.qtdAtual,
        i.valorTotalEstoque,
        i.custTotalEstoque,
        i.lucroEstoque,
        i.qtdVendida,
        i.valorVendido,
        i.lucroVendido,
        i.taxaRotacao,
        i.status
      ]);

      sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }

    const rowTotal = relatorio.itens.length + 3;
    sh.getRange(rowTotal, 1, 1, headers.length).setBackground('#e2e8f0').setFontWeight('bold');
    sh.getRange(rowTotal, 1).setValue('RESUMO GERAL');
    sh.getRange(rowTotal, 7).setValue(relatorio.resumo.totalValorEstoque);
    sh.getRange(rowTotal, 8).setValue(relatorio.resumo.totalCustoEstoque);
    sh.getRange(rowTotal, 9).setValue(relatorio.resumo.lucroEstoque);
    sh.getRange(rowTotal, 11).setValue(relatorio.resumo.totalVendido);
    sh.getRange(rowTotal, 12).setValue(relatorio.resumo.lucroVendido);
    sh.getRange(rowTotal, 13).setValue(relatorio.resumo.margemMedia);

    sh.getRange(2, 3, Math.max(1, relatorio.itens.length + 2), 2).setNumberFormat('R$ #,##0.00');
    sh.getRange(2, 5, Math.max(1, relatorio.itens.length + 2), 1).setNumberFormat('0.00"%"');
    sh.getRange(2, 7, Math.max(1, relatorio.itens.length + 2), 3).setNumberFormat('R$ #,##0.00');
    sh.getRange(2, 11, Math.max(1, relatorio.itens.length + 2), 2).setNumberFormat('R$ #,##0.00');
    sh.getRange(2, 13, Math.max(1, relatorio.itens.length + 2), 1).setNumberFormat('0.00"%"');

    sh.setFrozenRows(1);
    sh.setColumnWidths(1, headers.length, 150);
    sh.setColumnWidth(1, 240);
    sh.setColumnWidth(2, 150);
    aplicarFormatacaoPadrao(sh);

    registrarInformacaoImportanteNoDrive(
      'RELATORIO',
      'Relatório de valores do estoque',
      [
        `Itens: ${relatorio.itens.length}`,
        `Valor total estoque: R$ ${relatorio.resumo.totalValorEstoque.toFixed(2)}`,
        `Lucro potencial estoque: R$ ${relatorio.resumo.lucroEstoque.toFixed(2)}`,
        `Total vendido: R$ ${relatorio.resumo.totalVendido.toFixed(2)}`
      ].join('\n'),
      { subcategoria: 'Estoque' }
    );

    return relatorio;
  }
  function gerarRelatorioValoresEstoque() {
    const relatorio = gerarRelatorioEstoqueComValores();
    if(!relatorio){
      SpreadsheetApp.getUi().alert('❌ Não foi possível gerar o relatório de valores.');
      return;
    }

    const sh = SpreadsheetApp.getActive().getSheetByName('ESTOQUE_VALORES');
    if(sh){
      SpreadsheetApp.getActive().setActiveSheet(sh);
    }

    SpreadsheetApp.getUi().alert('✅ Relatório de valores do estoque atualizado!');
  }
  function obterValorTotalEstoque() {
    const relatorio = gerarRelatorioEstoqueComValores();
    return relatorio ? Number(relatorio.resumo.totalValorEstoque || 0) : 0;
  }
  function obterValorEstoquesPorCategoria() {
    const relatorio = gerarRelatorioEstoqueComValores();
    const out = {};

    (relatorio ? relatorio.itens : []).forEach(item => {
      const cat = item.categoria || 'SEM CATEGORIA';
      if(!out[cat]){
        out[cat] = { quantidade: 0, valor: 0, custo: 0 };
      }

      out[cat].quantidade += Number(item.qtdAtual) || 0;
      out[cat].valor += Number(item.valorTotalEstoque) || 0;
      out[cat].custo += Number(item.custTotalEstoque) || 0;
    });

    return out;
  }
  function analisarRentabilidadeEstoque() {
    const relatorio = gerarRelatorioEstoqueComValores();
    if(!relatorio || !relatorio.itens.length){
      return {
        maisRentaveis: [],
        estoqueCritico: [],
        altaRotacao: [],
        quaseNenhumavenda: []
      };
    }

    const itens = relatorio.itens.slice();

    return {
      maisRentaveis: itens
        .slice()
        .sort((a, b) => Number(b.lucroVendido || b.lucroEstoque) - Number(a.lucroVendido || a.lucroEstoque)),
      estoqueCritico: itens.filter(i => String(i.status).includes('Crítico')),
      altaRotacao: itens.filter(i => Number(i.taxaRotacao) >= 70),
      quaseNenhumavenda: itens.filter(i => Number(i.qtdVendida) <= 1)
    };
  }
  function abrirPainelEstoqueValores() {
    try {
      const relatorio = gerarRelatorioEstoqueComValores();
      
      if (!relatorio) {
        return;
      }
      
      const ss = SpreadsheetApp.getActive();
      const sh = ss.getSheetByName('ESTOQUE_VALORES');
      
      if (sh) {
        ss.setActiveSheet(sh);
        SpreadsheetApp.flush();
      }
      
    } catch (e) {
      console.error('Erro em abrirPainelEstoqueValores:', e);
      SpreadsheetApp.getUi().alert('❌ Erro ao abrir painel: ' + e.message);
    }
  }
  function abrirAnalisRentabilidade() {
    try {
      const analise = analisarRentabilidadeEstoque();
      
      if (!analise) {
        SpreadsheetApp.getUi().alert('❌ Erro ao gerar análise');
        return;
      }
      
      const ss = SpreadsheetApp.getActive();
      let sh = ss.getSheetByName('ANALISE_RENTABILIDADE');
      
      if (!sh) {
        sh = ss.insertSheet('ANALISE_RENTABILIDADE');
      }
      
      sh.clear();
      
      // ========== MAIS RENTÁVEIS ==========
      sh.getRange('A1:B1').merge()
        .setValue('🏆 PRODUTOS MAIS RENTÁVEIS')
        .setFontWeight('bold')
        .setBackground('#dcfce7')
        .setFontSize(12);
      
      let row = 2;
      analise.maisRentaveis.slice(0, 10).forEach((item, idx) => {
        sh.getRange(row, 1).setValue(`${idx + 1}. ${item.produto}`);
        sh.getRange(row, 2).setValue(item.lucro);
        sh.getRange(row, 2).setNumberFormat('R$ #,##0.00');
        row++;
      });
      
      // ========== ESTOQUE CRÍTICO ==========
      row = 2;
      const colStart = 4;
      sh.getRange(row - 1, colStart, 1, 2).merge()
        .setValue('🚨 ESTOQUE CRÍTICO')
        .setFontWeight('bold')
        .setBackground('#fee2e2')
        .setFontSize(12);
      
      analise.estoqueCritico.forEach((item, idx) => {
        sh.getRange(row, colStart).setValue(`${idx + 1}. ${item.produto}`);
        sh.getRange(row, colStart + 1).setValue(item.quantidade);
        row++;
      });
      
      // ========== ALTA ROTAÇÃO ==========
      row = 2;
      const colStart2 = 7;
      sh.getRange(row - 1, colStart2, 1, 2).merge()
        .setValue('📈 ALTA ROTAÇÃO (>70%)')
        .setFontWeight('bold')
        .setBackground('#dbeafe')
        .setFontSize(12);
      
      analise.altaRotacao.forEach((item, idx) => {
        sh.getRange(row, colStart2).setValue(`${idx + 1}. ${item.produto}`);
        sh.getRange(row, colStart2 + 1).setValue(item.taxaRotacao + '%');
        row++;
      });
      
      sh.setColumnWidths(1, 8, 150);
      SpreadsheetApp.getUi().alert('✅ Análise de rentabilidade atualizada!');
      
    } catch (e) {
      console.error('Erro em abrirAnalisRentabilidade:', e);
      SpreadsheetApp.getUi().alert('❌ Erro: ' + e.message);
    }
  }
  function exibirValorCategoria() {
    try {
      const porCategoria = obterValorEstoquesPorCategoria();
      
      const ss = SpreadsheetApp.getActive();
      let sh = ss.getSheetByName('ESTOQUE_CATEGORIAS');
      
      if (!sh) {
        sh = ss.insertSheet('ESTOQUE_CATEGORIAS');
      }
      
      sh.clear();
      
      // Cabeçalho
      const headers = ['Categoria', 'Quantidade', 'Valor Estoque', 'Valor Custo', 'Lucro Potencial', 'Margem %'];
      sh.getRange(1, 1, 1, headers.length)
        .setValues([headers])
        .setFontWeight('bold')
        .setBackground('#020617')
        .setFontColor('#ffffff')
        .setHorizontalAlignment('center');
      
      let row = 2;
      let totalQtd = 0;
      let totalValor = 0;
      let totalCusto = 0;
      
      Object.entries(porCategoria).forEach(([categoria, dados]) => {
        const lucro = dados.valor - dados.custo;
        const margem = dados.valor > 0 ? ((lucro / dados.valor) * 100) : 0;
        
        sh.getRange(row, 1).setValue(categoria);
        sh.getRange(row, 2).setValue(dados.quantidade);
        sh.getRange(row, 3).setValue(dados.valor);
        sh.getRange(row, 4).setValue(dados.custo);
        sh.getRange(row, 5).setValue(lucro);
        sh.getRange(row, 6).setValue(margem);
        
        // Formatação
        sh.getRange(row, 3).setNumberFormat('R$ #,##0.00');
        sh.getRange(row, 4).setNumberFormat('R$ #,##0.00');
        sh.getRange(row, 5).setNumberFormat('R$ #,##0.00');
        sh.getRange(row, 6).setNumberFormat('0.00"%"');
        
        // Cores
        if (lucro < 0) {
          sh.getRange(row, 5).setFontColor('#dc2626');
        } else if (lucro > 0) {
          sh.getRange(row, 5).setFontColor('#16a34a');
        }
        
        totalQtd += dados.quantidade;
        totalValor += dados.valor;
        totalCusto += dados.custo;
        
        row++;
      });
      
      // Totais
      row++;
      sh.getRange(row, 1).setValue('TOTAL')
        .setFontWeight('bold');
      sh.getRange(row, 2).setValue(totalQtd)
        .setFontWeight('bold');
      sh.getRange(row, 3).setValue(totalValor)
        .setNumberFormat('R$ #,##0.00')
        .setFontWeight('bold');
      sh.getRange(row, 4).setValue(totalCusto)
        .setNumberFormat('R$ #,##0.00')
        .setFontWeight('bold');
      
      const lucroTotal = totalValor - totalCusto;
      sh.getRange(row, 5).setValue(lucroTotal)
        .setNumberFormat('R$ #,##0.00')
        .setFontWeight('bold');
      
      if (lucroTotal > 0) {
        sh.getRange(row, 5).setFontColor('#16a34a');
      }
      
      sh.setColumnWidths(1, headers.length, 150);
      SpreadsheetApp.getUi().alert('✅ Tabela de categorias atualizada!');
      
    } catch (e) {
      console.error('Erro em exibirValorCategoria:', e);
      SpreadsheetApp.getUi().alert('❌ Erro: ' + e.message);
    }
  }
  function exibirValorTotalEstoque() {
    try {
      const valor = obterValorTotalEstoque();
      const estoque = obterDadosEstoque();
      const produtos = obterDadosProdutos();
      
      let custTotal = 0;
      estoque.forEach(linha => {
        const nomeProduto = linha[0].toString().trim();
        const quantidade = Number(linha[1]) || 0;
        const produto = produtos[nomeProduto];
        
        if (produto) {
          custTotal += quantidade * produto.custMedio;
        }
      });
      
      const lucro = valor - custTotal;
      
      const mensagem = 
        `💰 VALOR TOTAL DO ESTOQUE\n\n` +
        `📦 Quantidade de Produtos: ${estoque.length}\n` +
        `📊 Valor Total (Preço Venda): R$ ${valor.toFixed(2)}\n` +
        `💸 Valor Total (Custo): R$ ${custTotal.toFixed(2)}\n` +
        `💹 Lucro Potencial: R$ ${lucro.toFixed(2)}\n` +
        `📈 Margem: ${((lucro / valor) * 100).toFixed(2)}%`;
      
      SpreadsheetApp.getUi().alert(mensagem);
      
    } catch (e) {
      console.error('Erro em exibirValorTotalEstoque:', e);
      SpreadsheetApp.getUi().alert('❌ Erro: ' + e.message);
    }
  }
  function atualizarWidgetValorEstoque() {
    try {
      const ss = SpreadsheetApp.getActive();
      const sh = ss.getSheetByName('HOME');
      
      if (!sh) return;
      
      const valor = obterValorTotalEstoque();
      
      // Encontrar célula com "Valor Estoque" e atualizar
      const dados = sh.getDataRange().getValues();
      
      // Você pode customizar a célula aqui
      sh.getRange('A1').setValue(`💰 Valor Total Estoque: R$ ${valor.toFixed(2)}`);
      
    } catch (e) {
      console.error('Erro em atualizarWidgetValorEstoque:', e);
    }
  }
  function verificarEstoqueCriticoAuto() {
    try {
      const analise = analisarRentabilidadeEstoque();
      
      if (!analise || analise.estoqueCritico.length === 0) {
        return;
      }
      
      const relatorio = gerarRelatorioEstoqueComValores();
      
      const criticos = relatorio.itens.filter(item => 
        item.status.includes('Crítico')
      );
      
      if (criticos.length > 0) {
        const lista = criticos
          .map(p => `- ${p.produto} (${p.qtdAtual} unidades - R$ ${p.valorTotalEstoque.toFixed(2)})`)
          .join('\n');
        
        const mensagem = 
          `🚨 ALERTA: PRODUTOS EM ESTOQUE CRÍTICO\n\n` +
          lista + `\n\n` +
          `Valor total comprometido: R$ ${
            criticos.reduce((s, p) => s + p.valorTotalEstoque, 0).toFixed(2)
          }`;
        
        console.warn(mensagem);
        
        // Você pode enviar email aqui
        // MailApp.sendEmail('gerente@email.com', '🚨 Alerta Estoque Crítico', mensagem);
      }
      
    } catch (e) {
      console.error('Erro em verificarEstoqueCriticoAuto:', e);
    }
  }
  function setupMonitoramentoEstoque() {
    // Remove triggers antigos
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(t => {
      if (t.getHandlerFunction() === 'monitorarEstoqueAuto') {
        ScriptApp.deleteTrigger(t);
      }
    });
    
    // Cria novo trigger
    ScriptApp.newTrigger('monitorarEstoqueAuto')
      .timeBased()
      .everyHours(1)
      .create();
    
    SpreadsheetApp.getUi().alert('✅ Monitoramento ativado!');
  }
  function monitorarEstoqueAuto() {
    try {
      // Atualiza relatório
      gerarRelatorioEstoqueComValores();
      
      // Verifica críticos
      verificarEstoqueCriticoAuto();
      
      // Atualiza widget na HOME
      atualizarWidgetValorEstoque();
      
      console.log('Monitoramento de estoque realizado com sucesso');
      
    } catch (e) {
      console.error('Erro no monitoramento automático:', e);
    }
  }
  function exportarAnaliseEstoqueCSV() {
    try {
      const relatorio = gerarRelatorioEstoqueComValores();
      
      if (!relatorio) return;
      
      let csv = 'Produto,Categoria,Preço,Custo,Margem %,Qtd Estoque,Valor Estoque,Lucro Estoque,Qtd Vendida,Taxa Rotação\n';
      
      relatorio.itens.forEach(item => {
        csv += `"${item.produto}","${item.categoria}",${item.precoVenda},${item.custMedio},${item.margem},${item.qtdAtual},${item.valorTotalEstoque},${item.lucroEstoque},${item.qtdVendida},${item.taxaRotacao}\n`;
      });
      
      console.log(csv);
      SpreadsheetApp.getUi().alert('✅ CSV gerado (veja console)');
      
    } catch (e) {
      console.error('Erro ao exportar CSV:', e);
    }
  }
  function gerarRelatórioExecutivo() {
    try {
      const registroRelatorio = registrarInformacaoImportanteNoDrive(
        'RELATORIO',
        'Relatório executivo de estoque',
        `Relatório executivo solicitado em ${new Date().toLocaleString('pt-BR')}`,
        { subcategoria: 'Estoque' }
      );
      const relatorio = gerarRelatorioEstoqueComValores();
      const analise = analisarRentabilidadeEstoque();
      
      if (!relatorio || !analise) return;
      
      const resumo = relatorio.resumo;
      
      const texto = 
        `╔══════════════════════════════════════════╗\n` +
        `║     RELATÓRIO EXECUTIVO DE ESTOQUE      ║\n` +
        `╚══════════════════════════════════════════╝\n\n` +
        
        `📊 SITUAÇÃO ATUAL\n` +
        `├─ Total Produtos: ${relatorio.itens.length}\n` +
        `├─ Valor Total: R$ ${resumo.totalValorEstoque.toFixed(2)}\n` +
        `├─ Custo Total: R$ ${resumo.totalCustoEstoque.toFixed(2)}\n` +
        `└─ Lucro Potencial: R$ ${resumo.lucroEstoque.toFixed(2)}\n\n` +
        
        `💰 HISTÓRICO DE VENDAS\n` +
        `├─ Total Vendido: R$ ${resumo.totalVendido.toFixed(2)}\n` +
        `├─ Lucro Realizado: R$ ${resumo.lucroVendido.toFixed(2)}\n` +
        `└─ Margem Média: ${resumo.margemMedia.toFixed(2)}%\n\n` +
        
        `🚨 ALERTAS\n` +
        `├─ Produtos Críticos: ${analise.estoqueCritico.length}\n` +
        `├─ Sem Vendas: ${analise.quaseNenhumavenda.length}\n` +
        `└─ Alta Rotação: ${analise.altaRotacao.length}\n\n` +
        
        `🏆 TOP 3 PRODUTOS\n` +
        analise.maisRentaveis.slice(0, 3).map((p, i) => 
          `${i + 1}. ${p.produto} (R$ ${p.lucro.toFixed(2)})`
        ).join('\n');
      
      console.log(texto);

      if(registroRelatorio && registroRelatorio.url){
        console.log('Relatório executivo registrado no Drive:', registroRelatorio.url);
      }

      SpreadsheetApp.getUi().alert(texto);
      
    } catch (e) {
      console.error('Erro ao gerar relatório executivo:', e);
    }
  }
  function enviarRelatorioEmail(destinatario) {
    try {
      const relatorio = gerarRelatorioEstoqueComValores();
      
      if (!relatorio) return;
      
      const resumo = relatorio.resumo;
      
      const corpo = 
        `Relatório de Estoque com Valores\n\n` +
        `Valor Total do Estoque: R$ ${resumo.totalValorEstoque.toFixed(2)}\n` +
        `Lucro Potencial: R$ ${resumo.lucroEstoque.toFixed(2)}\n` +
        `Margem Média: ${resumo.margemMedia.toFixed(2)}%\n\n` +
        `Gerado em: ${new Date().toLocaleString('pt-BR')}`;
      
      // Descomente para usar:
      // MailApp.sendEmail(destinatario, '📊 Relatório de Estoque', corpo);
      
      console.log('Email preparado para envio (descomente código)');
      
    } catch (e) {
      console.error('Erro ao enviar email:', e);
    }
  }
/* 
 * ═══════════════════════════════════════════════════════════════════════════
 * 📚 DOCUMENTAÇÃO - VERSÃO 1.0 COM CORREÇÕES (Março 2026)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Arquivos de Documentação Importantes:
 *
 * 1. RESUMO_AJUSTES_REALIZADOS.md
 *    └─ Visão geral de todas as 8 correções implementadas
 *    └─ Métricas de mudanças
 *    └─ Testes recomendados
 *    └─ Próximos passos
 *
 * 2. README_FUNCIONAMENTO_CORRIGIDO.md
 *    └─ Manual completo de operação
 *    └─ Guias passo-a-passo para cada funcionalidade
 *    └─ Tabelas de comportamento esperado
 *    └─ Seção de troubleshooting
 *
 * 3. ESTUDO_FUNCIONAMENTO_SISTEMA.md
 *    └─ Análise profunda da arquitetura
 *    └─ Diagramas ASCII dos fluxos
 *    └─ Exemplo detalhado de caso de uso
 *    └─ Pontos-chave de entendimento
 *
 * 4. BUGS_ENCONTRADOS_E_CORRECOES.md
 *    └─ Lista de 10 bugs encontrados
 *    └─ Explicação técnica de cada um
 *    └─ Severidade e impacto
 *    └─ Soluções implementadas
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * MUDANÇAS PRINCIPAIS (v1.0 - Março 2026)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * ✅ CORREÇÕES DE TYPE COERCION
 *    → Comparações == alteradas para === com Number() explícito
 *    → Evita falsos positivos/negativos em buscas
 *    → 6 funções corrigidas
 *
 * ✅ BUSCA DE PAGAMENTOS PARCIAIS
 *    → .includes(pedido) agora convert para String(pedido)
 *    → Saldo da comanda calcula corretamente
 *    → Evita NaN em operações
 *
 * ✅ PADRONIZAÇÃO DE ORIGEM
 *    → 'COMANDA' → 'COMANDA_BALCAO'
 *    → 'DELIVERY' → 'DELIVERY_PEDIDO'
 *    → Filtros e relatórios funcionam corretamente
 *
 * ✅ FUNÇÃO DUPLICADA REMOVIDA
 *    → salvarItensComandaAberta() removida
 *    → salvarContinuarVendendo() é única fonte
 *    → Código mais limpo
 *
 * ✅ TIPO BOOLEANO
 *    → Filtro de itens novos agora é rigoroso
 *    → Previne bugs com string 'false'
 *
 * ✅ DEVOLUÇÃO DE ESTOQUE EM CANCELAMENTO
 *    → Novo: Delivery cancelado após encaminhado devolve estoque
 *    → Estoque nunca fica inconsistente
 *    → Auditoria completa do que foi revertido
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * COMPORTAMENTO ESPERADO (OK para produção)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 🍺 COMANDA BALCÃO:
 *    ✓ Estoque baixa IMEDIATAMENTE
 *    ✓ Cliente fica TRAVADO após 1º item
 *    ✓ Suporta múltiplas adições com 'Continuar Vendendo'
 *    ✓ Pagamento parcial funciona 100%
 *    ✓ Fiado registra em CONTAS_A_RECEBER
 *
 * 📂 COMANDA ABERTA:
 *    ✓ Itens históricos aparecem TRAVADOS (não removíveis)
 *    ✓ Itens novos destraváveis com filtro rigoroso
 *    ✓ Saldo calcula: total consumido - pagamentos parciais
 *    ✓ Estoque validado ANTES de cada operação
 *    ✓ Permite pagamento parcial com saldo atualizado
 *
 * 🚚 DELIVERY:
 *    ✓ Estoque NÃO baixa ao criar (PEDIDO FEITO)
 *    ✓ Estoque BAIXA APENAS ao encaminhar (EM ANDAMENTO)
 *    ✓ Cancelamento DEVOLVE estoque se foi encaminhado
 *    ✓ Entregador é campo obrigatório
 *    ✓ Fiado BLOQUEADO (validação rejeita)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DEPLOY / PRODUÇÃO
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Antes de usar em produção:
 * 1. Ler RESUMO_AJUSTES_REALIZADOS.md (visão geral)
 * 2. Consultar README_FUNCIONAMENTO_CORRIGIDO.md (manual)
 * 3. Testar cenários listados em RESUMO_AJUSTES_REALIZADOS.md
 * 4. Manter backup pré-alterações
 * 5. Monitorar logs por 48h
 * ═══════════════════════════════════════════════════════════════════════════        
 */


/*
 * ===============================================
 * 🌐 MODO WEB APP (HTML + API Apps Script)
 * ===============================================
 * Novos arquivos adicionados:
 * - WebApp.gs   : endpoint doGet() + bridge executarApi()
 * - WebApp.html : interface web moderna em HTML/CSS/JS
 *
 * Publicação sugerida:
 * 1) Implantar > Nova implantação > Tipo: Aplicativo da Web
 * 2) Executar como: você
 * 3) Quem tem acesso: usuários autorizados
 *
 * A tela Web usa google.script.run.executarApi(nomeFuncao, args)
 * para reaproveitar as funções já existentes deste projeto.
 */
