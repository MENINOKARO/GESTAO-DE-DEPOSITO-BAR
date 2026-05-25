// ===============================
// MENU / INICIALIZAÇÃO
// ===============================

  const SENHA_RESET_PADRAO = 'A1D2M1N@2026';


  function onOpen() {

    try {

      // 🔐 VERIFICAÇÃO DE AUTENTICAÇÃO
      const usuarioAtual = obterUsuarioAtual();

      const ui = SpreadsheetApp.getUi();

      // 🔹 Se não autenticado, abre automaticamente a tela de login
      if (!usuarioAtual) {
        try { bloquearVisualizacaoSemLogin(); } catch(e) { console.warn('Falha ao bloquear abas sem login:', e); }
        try { popupTelaInicial(); } catch(e) { console.warn('Falha ao abrir tela inicial de login:', e); }
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
            .addItem('💬 WhatsApp', 'abrirPainelWhatsApp')
        )
        .addSeparator()
        .addSubMenu(
          ui.createMenu('🛅 Controle')
            .addItem('📝 Painel Financeiro', 'popupPainelFinanceiro')
            .addItem('🔒 Conferencia Caixa', 'fecharCaixaDia')
            .addItem('📑 Fechamento Fiscal do Dia', 'fecharFiscalDia')
            .addItem('⚖️ Fluxo de Caixa', 'popupFluxoCaixa')
            .addItem('🪙 Contas a Pagar', 'popupPainelContasAPagar')
            .addItem('💳 Contas a Receber', 'popupPainelContasAReceber')
            .addSeparator()
            .addItem('👤 Novo Cliente', 'popupCliente')
            .addItem('🔍 Consultar Cliente', 'popupBuscarCliente')
            .addItem('👥 Usuários', 'popupListarUsuarios')
            .addSeparator()
            .addItem('🛒 Nova Compra', 'popupCompraV2')
            .addItem('❌ Cancelamento de Notas', 'popupPainelCancelamentoCompra')
            .addItem('📂 Drive', 'abrirDriveLink')
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
            .addItem('🧽 Limpar Senha de Reset', 'limparSenhaResetSolicitandoTroca')
            .addItem('⚙️ Configurar Depósito', 'abrirConfiguracaoDeposito')
            .addItem('🔄 Recarregar Menu', 'recarregarMenu')
            .addItem('💾 Fazer Backup Agora', 'fazerBackupSistema')
            .addItem('📜 Ver Logs', 'abrirAbaLog')
            .addItem('🧹 Padronizar Todas as Abas', 'padronizarTodasAbasSistema')
            .addSeparator()
            .addItem('📖 Manual do Sistema', 'abrirManualDoSistema')
            .addSeparator()
            .addItem('🔀 Trocar Login', 'trocarLogin')
            .addItem('🚪 Logout', 'fazerLogout')
            
        )
        .addToUi();

      // 🔹 Inicialização silenciosa
      inicializacaoSilenciosa();

      // 🔒 Se o setup não foi concluído, força fluxo inicial.
      if(getConfig('SETUP_CONCLUIDO') !== 'SIM'){
        popupBoasVindasSistema();
      }

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

