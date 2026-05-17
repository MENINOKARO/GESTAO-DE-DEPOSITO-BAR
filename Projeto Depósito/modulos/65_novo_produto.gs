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

