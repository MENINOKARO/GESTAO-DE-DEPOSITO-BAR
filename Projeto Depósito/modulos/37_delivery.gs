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
        <button style="width:44px" onclick="novoCliente()">👤</button>
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

      <button id="btnFinalizar" onclick="finalizar()">📦 Fazer Pedido</button>

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
        const btnFinalizarEl = document.getElementById('btnFinalizar');
        let processandoPedido = false;

        // 🔥 BUSCA CLIENTE TEMPORÁRIO (AJUSTE)
        google.script.run.withSuccessHandler(nome => {
          if(nome){
            clienteEl.value = nome;
            clienteEl.disabled = true;
            clienteTravado = true;
          }
        }).getClienteTempDelivery();
        google.script.run.withSuccessHandler((estado) => {
          if(!estado) return;
          if(estado.cliente) clienteEl.value = estado.cliente;
          if(estado.produto){
            produtoEl.value = estado.produto;
            produtoEl.onchange();
          }
          if(estado.qtd) qtdEl.value = estado.qtd;
          if(estado.entregador) entregadorEl.value = estado.entregador;
          if(estado.pagamento) pagEl.value = estado.pagamento;
          if(estado.carrinho && Array.isArray(estado.carrinho)){
            carrinho = estado.carrinho;
            if(carrinho.length){
              clienteEl.disabled = true;
              clienteTravado = true;
            }
            render();
          }
        }).getEstadoTempDelivery();

        function novoCliente(){
          const estado = {
            cliente: clienteEl.value || '',
            produto: produtoEl.value || '',
            qtd: qtdEl.value || '',
            entregador: entregadorEl.value || '',
            pagamento: pagEl.value || '',
            carrinho
          };
          google.script.run
            .withSuccessHandler(() => google.script.run.popupMenuCliente('DELIVERY'))
            .setEstadoTempDelivery(estado);
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
          if(processandoPedido) return;
          if(!carrinho.length) return alert('Carrinho vazio');
          if(!entregadorEl.value) return alert('Informe o entregador');

          processandoPedido = true;
          btnFinalizarEl.disabled = true;
          btnFinalizarEl.innerText = '⏳ Registrando pedido...';

          google.script.run
            .withSuccessHandler(()=>google.script.host.close())
            .withFailureHandler(e=>{
              alert(e.message||e);
              processandoPedido = false;
              btnFinalizarEl.disabled = false;
              btnFinalizarEl.innerText = '📦 Fazer Pedido';
            })
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

    const lock = LockService.getDocumentLock();
    lock.waitLock(10000);
    try {

      const cache = CacheService.getScriptCache();
      const assinatura = Utilities.base64EncodeWebSafe(JSON.stringify([
        String(cliente || '').trim().toUpperCase(),
        String(entregador || '').trim().toUpperCase(),
        String(pagamento || '').trim().toUpperCase(),
        (itens || []).map(i => [String(i.produto || '').trim().toUpperCase(), Number(i.qtd) || 0, Number(i.unit) || 0])
      ]));

      const chaveRepeticao = 'DELIVERY_DUP_' + assinatura;
      if(cache.get(chaveRepeticao)){
        throw new Error('Pedido já está sendo processado. Aguarde alguns segundos.');
      }
      cache.put(chaveRepeticao, '1', 8);

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
    } finally {
      lock.releaseLock();
    }
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

