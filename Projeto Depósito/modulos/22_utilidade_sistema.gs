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

