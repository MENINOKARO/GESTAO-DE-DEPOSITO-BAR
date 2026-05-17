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
      return { ok:true, msg:'Sistema resetado com sucesso.' };

    }
    function limparAbasSistemaParaReset(ss){

      const planilhas = (ss || SpreadsheetApp.getActive()).getSheets();

      planilhas.forEach(sh => {

        const nome = sh.getName();
        const lastRow = sh.getLastRow();
        const lastCol = sh.getLastColumn();

        // CONFIG é recriada no próximo passo.
        if(nome === 'CONFIG'){
          sh.clear();
          return;
        }

        if(lastRow <= 1 || lastCol === 0) return;

        // Mantém cabeçalho, limpa completamente o restante.
        sh.getRange(2, 1, lastRow - 1, lastCol)
          .clearContent();
      });
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

                google.script.host.close();
                google.script.run
                  .withFailureHandler(e=>{
                    alert('Erro ao resetar: ' + (e.message || e));
                  })
                  .resetarSistema(false);

              })
              .withFailureHandler(e=>{
                alert('Erro ao resetar: ' + (e.message || e));
              })
              .confirmarResetComSenha(senha);
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
    function getResetProps(){
      return PropertiesService.getScriptProperties();
    }
    function normalizarSenha(valor){
      return String(valor || '').trim();
    }
    function alterarSenhaReset(senhaAtual, novaSenha){

      const props = getResetProps();
      const senhaSalva = normalizarSenha(props.getProperty('SENHA_RESET'));
      const senhaAtualLimpa = normalizarSenha(senhaAtual);
      const novaSenhaLimpa = normalizarSenha(novaSenha);

      if(!senhaSalva){
        return { ok:false, msg:'Senha não configurada.' };
      }

      if(senhaAtualLimpa !== senhaSalva){
        return { ok:false, msg:'Senha atual incorreta.' };
      }

      if(novaSenhaLimpa.length < 4){
        return { ok:false, msg:'Nova senha inválida.' };
      }

      if(novaSenhaLimpa === senhaSalva){
        return { ok:false, msg:'A nova senha deve ser diferente da atual.' };
      }

      // 🔥 salva nova senha
      props.setProperty('SENHA_RESET', novaSenhaLimpa);

      // remove flag obrigatória
      props.setProperty('RESET_SENHA_OBRIGATORIA', 'NAO');

      return {
        ok:true,
        msg:'Senha alterada.'
      };
    }
    function garantirSenhaReset(){

      const props = getResetProps();

      let senha = props.getProperty('SENHA_RESET');

      if(!senha){

        // 🔑 senha padrão inicial
        props.setProperty('SENHA_RESET', SENHA_RESET_PADRAO);

        // 🔁 flag de troca obrigatória
        props.setProperty('RESET_SENHA_OBRIGATORIA', 'SIM');
      }

    }

    function confirmarResetComSenha(senhaDigitada){

      const validacao = validarSenhaReset(senhaDigitada);

      if(!validacao.ok){
        return validacao;
      }

      return resetarSistema(false);
    }
    function validarSenhaReset(senhaDigitada){

      if(typeof garantirSenhaResetObrigatoria === 'function'){
        garantirSenhaResetObrigatoria();
      } else if(typeof garantirSenhaReset === 'function'){
        garantirSenhaReset();
      }

      const props = getResetProps();
      const senhaSalva = normalizarSenha(props.getProperty('SENHA_RESET'));
      const senhaDigitadaLimpa = normalizarSenha(senhaDigitada);

      if(!senhaSalva){
        return { ok:false, msg:'Senha não configurada.' };
      }

      if(senhaDigitadaLimpa !== senhaSalva){
        return { ok:false, msg:'Senha incorreta.' };
      }

      const obrigatoria = props.getProperty('RESET_SENHA_OBRIGATORIA') === 'SIM';

      return { ok:true, trocar: obrigatoria };
    }
    function definirNovaSenhaReset(nova){

      const props = getResetProps();

      props.setProperty('SENHA_RESET', normalizarSenha(nova));
      props.setProperty('RESET_SENHA_OBRIGATORIA', 'NAO');

      return true;
    }
    function debugSenha(){
      const props = getResetProps();
      Logger.log(props.getProperty('SENHA_RESET'));
    }
    function limparSenhaReset(){

      const props = getResetProps();

      // remove e recria com senha padrão conhecida
      props.deleteProperty('SENHA_RESET');
      props.setProperty('SENHA_RESET', SENHA_RESET_PADRAO);
      props.setProperty('RESET_SENHA_OBRIGATORIA', 'SIM');

      return {
        ok: true,
        msg: 'Senha de reset redefinida para o padrão e troca obrigatória ativada.'
      };
    }
    function limparSenhaResetSolicitandoTroca(){

      const resultado = limparSenhaReset();

      if(typeof popupMensagem === 'function'){
        popupMensagem('🔐 Segurança', resultado.msg + ' Defina uma nova senha agora.');
      }

      popupTrocarSenhaReset();
      return resultado;
    }
  // FUNÇÕES PARA ABRIR ABAS
    function abrirHome(){
      abrirAba('HOME');
    }
    function abrirCaixa(){
      // Mantém compatibilidade com chamadas antigas e
      // padroniza o fluxo para o painel de opções do caixa.
      if(typeof abrirCaixaOpcoes === 'function'){
        abrirCaixaOpcoes();
        return;
      }
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

