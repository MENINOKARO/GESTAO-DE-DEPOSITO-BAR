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
    function abrirConfiguracaoDeposito(forcarConclusao){

      const template = HtmlService.createTemplateFromFile('ConfigDeposito');
      template.setupObrigatorio = forcarConclusao === true;

      const html = template
        .evaluate()
        .setWidth(500)
        .setHeight(550);

      SpreadsheetApp.getUi()
        .showModalDialog(html, '⚙️ Configuração do Depósito');

    }
  // MODULO DRIVE
    function abrirDriveLink(){
      const urlConfig = getConfig('DRIVE_URL');
      const estrutura = garantirEstruturaDriveSistema();
      const url = normalizarDriveUrl(urlConfig, estrutura && estrutura.rootId ? estrutura.rootId : '');

      if(url){
        const urlSegura = String(url).replace(/'/g, "%27");
        const html = HtmlService
          .createHtmlOutput(`<script>window.open('${urlSegura}','_blank');google.script.host.close();</script>`);
        SpreadsheetApp.getUi().showModalDialog(html,'Abrindo Drive...');
      }else{
        SpreadsheetApp.getUi().alert('🔗 Link do Drive não configurado em CONFIG.');
      }
    }

    function normalizarDriveUrl(url, pastaPadraoId){
      const raw = String(url || '').trim();
      if(raw){
        if(/^https?:\/\//i.test(raw)) return raw;
        const id = (raw.match(/[-\w]{25,}/) || [])[0];
        if(id){
          if(/\/file\//i.test(raw) || /\/d\//i.test(raw)){
            return `https://drive.google.com/file/d/${id}/view`;
          }
          return `https://drive.google.com/drive/folders/${id}`;
        }
      }

      if(pastaPadraoId){
        return `https://drive.google.com/drive/folders/${pastaPadraoId}`;
      }

      return '';
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

          // 🚀 GARANTE ESTRUTURA + CONCLUSÃO DO SETUP
          concluirConfiguracaoInicialSistema();

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
    function resetarSistema(ignorarConfirmacao){

      const ss = SpreadsheetApp.getActive();

