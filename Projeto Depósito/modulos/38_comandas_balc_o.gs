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

    const produtos = ss.getSheetByName('PRODUTOS')
      .getDataRange().getValues()
      .slice(1)
      .filter(p => p[0]);

    const optProd = `
      <option value="">Selecione o produto</option>
      ${produtos.map(p => `<option value="${p[0]}" data-preco="${p[4] || 0}">${p[0]}</option>`).join('')}
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
          onclick="novoCliente()">
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
        google.script.run.withSuccessHandler((estado) => {
          if(!estado) return;
          if(estado.cliente) cliente.value = estado.cliente;
          if(estado.produto){
            produto.value = estado.produto;
            produto.onchange();
          }
          if(estado.qtd) qtd.value = estado.qtd;
          if(estado.carrinho && Array.isArray(estado.carrinho)){
            carrinho = estado.carrinho;
            if(carrinho.length){
              cliente.disabled = true;
              clienteTravado = true;
            }
            render();
          }
        }).getEstadoTempBalcao();

        produto.onchange = () => {
          const opt = produto.options[produto.selectedIndex];
          valor.value = opt && opt.dataset.preco
            ? 'R$ ' + Number(opt.dataset.preco).toFixed(2).replace('.',',')
            : '';
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
        function novoCliente(){
          const estado = {
            cliente: cliente.value || '',
            produto: produto.value || '',
            qtd: qtd.value || '',
            carrinho
          };
          google.script.run
            .withSuccessHandler(() => google.script.run.popupMenuCliente('BALCAO'))
            .setEstadoTempBalcao(estado);
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
              // Mantém esta janela aberta: o backend abre o popup de finalização.
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
    return salvarComandaBalcao(cliente, itens, 'AGUARDANDO_PGTO');
  }

  function salvarComandaBalcao(cliente, itens, status){

    const lock = LockService.getScriptLock();
    lock.waitLock(3000);

    try{

      validarEstoqueCarrinho(itens);

      const ss = SpreadsheetApp.getActive();

      const pedido = gerarNumeroComanda();

