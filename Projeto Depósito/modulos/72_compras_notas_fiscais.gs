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
          <button class="card gray" onclick="google.script.run.abrirConversaPedidoWhatsapp()">📱 Fazer Pedido</button>
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
    const nome = getNomeDeposito();
    const numero = (getConfig('TELEFONE') || '').toString().replace(/\D/g, '');
    if(!numero){
      uiNotificar('Configure o TELEFONE do depósito para usar WhatsApp.','aviso','WhatsApp');
      return;
    }
    const texto = encodeURIComponent(`Olá ${nome}! Quero fazer um pedido.`);
    const url = `https://wa.me/55${numero}?text=${texto}`;
    const html = HtmlService.createHtmlOutput(`<script>window.open('${url}','_blank');google.script.host.close();</script>`).setWidth(10).setHeight(10);
    SpreadsheetApp.getUi().showModalDialog(html, 'Abrindo WhatsApp');
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

  function popupSimuladorBotWhatsapp(){
    const html = `
      <div style="font-family:Arial;padding:10px;display:flex;flex-direction:column;gap:8px">
        <h3 style="margin:0">🤖 Conversar com Bot WhatsApp (Simulação)</h3>
        <small>Use para testar a conversa e criação automática de pedido no Delivery.</small>

        <label>📞 Telefone do cliente</label>
        <input id="tel" placeholder="(11) 91234-5678" />

        <label>💬 Mensagem</label>
        <textarea id="msg" rows="4" placeholder="Ex.: quero fazer pedido de 2 caixas de cerveja"></textarea>

        <button id="btn" class="btn-success" onclick="enviar()">Enviar para Bot</button>
      </div>

      <script>
        function enviar(){
          const tel = document.getElementById('tel').value;
          const msg = document.getElementById('msg').value;
          const btn = document.getElementById('btn');
          if(!tel || !msg){
            alert('Preencha telefone e mensagem.');
            return;
          }
          btn.disabled = true;
          btn.innerText = '⏳ Processando...';

          google.script.run
            .withSuccessHandler((r)=>{
              alert('✅ Bot respondeu com sucesso. ' + (r && r.msg ? r.msg : ''));
              google.script.host.close();
            })
            .withFailureHandler((e)=>{
              alert('Erro: ' + (e.message || e));
              btn.disabled = false;
              btn.innerText = 'Enviar para Bot';
            })
            .simularMensagemBotWhatsapp(tel, msg);
        }
      </script>
    `;

    abrirPopup('🤖 Simular conversa do bot', html, 460, 420);
  }

  function abrirPopupConsultaFiadoWhatsapp(){
    const ss = SpreadsheetApp.getActive();
    const clientes = ss.getSheetByName('CLIENTES');
    const contas = ss.getSheetByName('CONTAS_A_RECEBER');

    const mapaSaldo = {};
    if (contas) {
      const dados = contas.getDataRange().getValues().slice(1);
      dados.forEach(r => {
        const cliente = String(r[3] || '').trim();
        const valor = Number(r[6]) || 0;
        const status = String(r[8] || '').toUpperCase();
        if (!cliente || status === 'QUITADO') return;
        mapaSaldo[cliente] = (mapaSaldo[cliente] || 0) + valor;
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

    const linhas = lista.length
      ? lista.map(c => {
          const msg = encodeURIComponent(`Olá ${c.nome}, tudo bem❓, vamos resover aquele fiado❓ seu saldo atual é R$ ${Number(c.saldo).toFixed(2).replace('.', ',')}.`);
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

    // 1️⃣ Abre configuração obrigatória do depósito
    abrirConfiguracaoDeposito(true);

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

