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
