// ===============================
// CLIENTES
// ===============================
function popupMenuCliente(origem){
  const origemNorm = String(origem || '').trim().toUpperCase();

  CacheService.getScriptCache().put('ORIGEM_CLIENTE', origemNorm, 300);

  if(origemNorm === 'DELIVERY'){
    try{
      const nomeAtual = CacheService.getScriptCache().get('CLIENTE_TEMP_DELIVERY') || '';
      if(nomeAtual){
        CacheService.getScriptCache().put('CLIENTE_TEMP_DELIVERY', nomeAtual, 300);
      }
    }catch(e){}
  }

  popupCliente();
}
function popupMenuClienteComEstado(origem, estado){
  const origemNorm = String(origem || '').trim().toUpperCase();
  if(origemNorm === 'BALCAO'){
    setEstadoTempBalcao(estado || {});
  }
  if(origemNorm === 'DELIVERY'){
    setEstadoTempDelivery(estado || {});
  }
  popupMenuCliente(origemNorm);
}
function popupCliente(){

  const ss = SpreadsheetApp.getActive();
  const clientes = ss.getSheetByName('CLIENTES')
    .getDataRange().getValues()
    .slice(1)
    .map(c => c[0])
    .filter(Boolean)
    .map(c => c.toUpperCase());

  abrirPopup('👤➕ Novo Cliente', `
    <div style="display:flex;flex-direction:column;gap:12px">

      <div>
        <label>👤 Nome do Cliente</label>
        <input id="nome" placeholder="Digite o nome completo">
      </div>

      <div>
        <label>📞 Telefone</label>
        <input id="tel" placeholder="Digite apenas números">
      </div>

      <div>
        <label>🏠 Endereço</label>
        <input id="end" placeholder="Rua, número, bairro">
      </div>

      <div>
        <label>📍 Referência</label>
        <input id="ref" placeholder="Ponto de referência (opcional)">
      </div>

      <hr>

      <button id="btnSalvar" class="btn-success" onclick="salvar(this)">
        💾 Salvar Cliente
      </button>

      <button class="btn-secondary" onclick="cancelar()">
        ❌ Cancelar
      </button>
    </div>

    <script>

      const nome = document.getElementById('nome');
      const tel  = document.getElementById('tel');
      const end  = document.getElementById('end');
      const ref  = document.getElementById('ref');

      // 🎯 foco automático
      nome.focus();

      // 📞 máscara progressiva
      tel.addEventListener('input', () => {

        let n = tel.value.replace(/\\D/g,'').slice(0,11);
        let f = '';

        if(n.length >= 1){
          f = '(' + n.slice(0,2);
        }
        if(n.length >= 3){
          f = '(' + n.slice(0,2) + ') ' + n.slice(2,3);
        }
        if(n.length >= 4){
          f = '(' + n.slice(0,2) + ') ' + n.slice(2,3) + '.' + n.slice(3,7);
        }
        if(n.length >= 8){
          f = '(' + n.slice(0,2) + ') ' + n.slice(2,3) + '.' + n.slice(3,7) + '-' + n.slice(7,11);
        }

        tel.value = f;
      });

      // ✅ cancelar correto
      function cancelar(){
        google.script.host.close();
        google.script.run.voltarTelaCliente();
      }

      function salvar(btn){

        if(!nome.value){
          alert('Informe o nome do cliente 👤');
          return;
        }

        const nomeUpper = nome.value.trim().toUpperCase();
        const existe = ${JSON.stringify(clientes)}.includes(nomeUpper);

        if(existe){
          const ok = confirm(
            '⚠️ Cliente já cadastrado com este nome.\\n\\nDeseja salvar mesmo assim?'
          );
          if(!ok) return;
        }

        // 🔒 bloqueia clique duplo
        btn.disabled = true;
        btn.innerText = '⏳ Salvando...';

        google.script.run
          .withFailureHandler(err => {

            alert(err.message || err);

            btn.disabled = false;
            btn.innerText = '💾 Salvar Cliente';

          })
          .withSuccessHandler(() => {

            google.script.host.close();
            google.script.run.voltarTelaCliente();

          })
          .salvarCliente(
            nome.value.trim(),
            tel.value,
            end.value,
            ref.value
          );
      }

    </script>
  `, 520, 600);
}
function salvarCliente(nome,tel,end,ref){
  SpreadsheetApp.getActive().getSheetByName('CLIENTES')
    .appendRow([nome,tel,end,ref,'']);
}
function setClienteTempDelivery(nome){
  CacheService.getScriptCache()
    .put('CLIENTE_TEMP_DELIVERY', nome, 300);
}
function setEstadoTempBalcao(payload){
  CacheService.getScriptCache()
    .put('ESTADO_TEMP_BALCAO', JSON.stringify(payload || {}), 300);
}
function getEstadoTempBalcao(){
  const cache = CacheService.getScriptCache();
  const raw = cache.get('ESTADO_TEMP_BALCAO');
  if(raw) cache.remove('ESTADO_TEMP_BALCAO');
  try{
    return raw ? JSON.parse(raw) : null;
  }catch(e){
    return null;
  }
}
function setEstadoTempDelivery(payload){
  CacheService.getScriptCache()
    .put('ESTADO_TEMP_DELIVERY', JSON.stringify(payload || {}), 300);
}
function getEstadoTempDelivery(){
  const cache = CacheService.getScriptCache();
  const raw = cache.get('ESTADO_TEMP_DELIVERY');
  if(raw) cache.remove('ESTADO_TEMP_DELIVERY');
  try{
    return raw ? JSON.parse(raw) : null;
  }catch(e){
    return null;
  }
}
function getClienteTempDelivery(){
  const cache = CacheService.getScriptCache();
  const nome = cache.get('CLIENTE_TEMP_DELIVERY');
  if(nome){
    cache.remove('CLIENTE_TEMP_DELIVERY'); // 🔥 LIMPA APÓS USO
  }
  return nome;
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
