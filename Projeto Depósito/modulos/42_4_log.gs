      // ============================
      // 4️⃣ LOG
      // ============================
      registrarLog(
        status === 'AGUARDANDO_PGTO'
          ? 'COMANDA_AGUARDANDO_PGTO'
          : 'COMANDA_ABERTA',
        `Comanda ${pedido}`,
        cliente,
        itens
      );

      return {
        ok: true,
        pedido
      };

    } finally {

      lock.releaseLock();

    }
  }
  function popupComandaExistente(pedido){
    const ss = SpreadsheetApp.getActive();

    const produtos = getProdutosComEstoque();

    const clientes = ss.getSheetByName('CLIENTES')
      .getDataRange().getValues()
      .slice(1)
      .map(c => c[0]);

    const itensRaw = ss.getSheetByName('COMANDA_ITENS')
      .getDataRange().getValues()
      .slice(1)
      .filter(i => i[0] === pedido);

    const mapa = {};
    itensRaw.forEach(i=>{
      if(!mapa[i[1]]){
        mapa[i[1]] = {
          produto: i[1],
          qtd: 0,
          unit: Number(i[3]),
          travado: true
        };
      }
      mapa[i[1]].qtd += Number(i[2]);
    });

    const carrinhoInicial = Object.values(mapa);

    const optionsProd = `
      <option value="">Selecione o produto</option>
      ${produtos.map(p =>
        `<option value="${p}">${p}</option>`
      ).join('')}
    `;
    const cliente = getClienteDaComanda(pedido);


    const html = `
    
      <div style="
        background:#020617;
        color:#e5e7eb;
        padding:14px;
        border-radius:12px;
        text-align:center;
        margin-bottom:16px
      ">
        <div style="font-size:16px;font-weight:bold">
          🧾 Comanda #${String(pedido).padStart(6,'0')}
        </div>

        <div style="font-size:14px;margin-top:6px">
          👤 ${cliente || 'Cliente não informado'}
        </div>
      </div>

      <hr>

      <label>Produto</label>
      <select id="produto">${optionsProd}</select>

      <label>Valor Unitário</label>
      <input id="valor" readonly>

      <button class="btn-primary" onclick="add()">➕ Adicionar Produto</button>

      <div id="msg" class="msg"></div>

      <h3>Itens da Comanda</h3>
      <ul id="lista"></ul>

      <div class="total">
        🧾 Total Consumido: <strong>R$ <span id="totalConsumido">0,00</span></strong><br>
        💵 Saldo Atual: <strong style="color:#16a34a">
          R$ <span id="saldoAtual">0,00</span>
        </strong>
      </div>

      <hr>

    <p id="msgParcial" style="text-align:right;font-weight:bold"></p>
      <button class="btn-warning" onclick="abrirParcial()">💵 Pagamento Parcial</button>
      <button class="btn-success" onclick="continuar(this)"> 🟢 Continuar Vendendo</button>
      <button class="btn-warning" onclick="fechar()">💰🛍️ Finalizar Comanda</button>
      <button class="btn-danger" onclick="cancelar()">❌ Cancelar</button>

      <script>
      
        let carrinho = ${JSON.stringify(carrinhoInicial)};

        function moeda(v){
          return 'R$ ' + v.toFixed(2).replace('.',',');
        }

        function alterar(idx, delta){
          if(!carrinho[idx]) return;

          carrinho[idx].qtd += delta;

          if(carrinho[idx].qtd <= 0){
            carrinho.splice(idx, 1);
          }

          render();
        }

        function abrirParcial(){
          const novos = carrinho.filter(i => !i.travado);

          if(novos.length){
            google.script.run
              .withSuccessHandler(() => {
                google.script.run.popupPagamentoParcialComanda(${pedido});
              })
              .salvarItensComandaAberta(${pedido}, carrinho);
          }else{
            google.script.run.popupPagamentoParcialComanda(${pedido});
          }
        }


        function pagarParcial(btn){
          const v = valorParcial.value
            .replace('R$','')
            .replace(',','.')
            .trim();

          if(!v){
            alert('Informe o valor.');
            return;
          }

          btn.disabled = true;
          btn.innerText = '⏳ Registrando...';

          google.script.run
            .withSuccessHandler(res=>{
              if(!res.ok){
                alert(res.msg);
                btn.disabled = false;
                btn.innerText = '➕ Registrar Pagamento Parcial';
                return;
              }

              msgParcial.innerText =
                'Saldo restante: R$ ' +
                res.saldoAtual.toFixed(2).replace('.',',');

              valorParcial.value = '';

              btn.disabled = false;
              btn.innerText = '➕ Registrar Pagamento Parcial';
            })
            .registrarPagamentoParcialComanda(
              ${pedido},
              v,
              pagParcial.value
            );
          }

              produto.onchange = () => {

                if(!produto.value){
                  valor.value = '';
                  return;
                }

                google.script.run
                  .withSuccessHandler(preco => {
                    valor.value =
                      'R$ ' + Number(preco).toFixed(2).replace('.',',');
                  })
                  .getPrecoProduto(produto.value);

              };
        function add(){
          if(!produto.value) return;
          const p = produto.value;
          const u = Number(valor.value.replace('R$','').replace(',','.'));
          let i = carrinho.find(x=>x.produto===p && !x.travado);
          if(i) i.qtd++;
          else carrinho.push({produto:p,qtd:1,unit:u,travado:false});
          render();
        }
        function remover(idx){
          carrinho.splice(idx,1);
          render();
        }

        function render(){
          const lista = document.getElementById('lista');
          const totalConsumidoEl = document.getElementById('totalConsumido');
          const saldoAtualEl = document.getElementById('saldoAtual');

          lista.innerHTML = '';

          let totalConsumido = 0;

          carrinho.forEach((i, idx) => {
            const subtotal = i.qtd * i.unit;
            totalConsumido += subtotal;

            lista.innerHTML +=
              '<li style="display:flex;justify-content:space-between;align-items:center;gap:8px">' +

                '<span style="flex:1">' +
                  i.produto + ' | ' +
                  i.qtd + ' x R$ ' + i.unit.toFixed(2).replace('.', ',') +
                  ' = <strong>R$ ' + subtotal.toFixed(2).replace('.', ',') + '</strong>' +
                '</span>' +

                (i.travado
                  ? ''
                  : '<div style="display:flex;gap:4px">' +

                      '<button class="btn-qtd" onclick="alterar('+idx+',1)">➕</button>' +

                      '<button class="btn-qtd" onclick="alterar('+idx+',-1)">➖</button>' +

                      '<button class="btn-qtd" ' +
                        'style="background:#dc2626;color:#fff" ' +
                        'onclick="remover('+idx+')">❌</button>' +

                    '</div>'
                ) +

              '</li>';
          });

          // 🔹 TOTAL CONSUMIDO (histórico – não muda com pgto parcial)
          totalConsumidoEl.innerText =
            totalConsumido.toFixed(2).replace('.', ',');

          // 🔹 SALDO ATUAL (vem do backend, já descontando pagamentos parciais)
          google.script.run
            .withSuccessHandler(saldo => {
              saldoAtualEl.innerText =
                Number(saldo).toFixed(2).replace('.', ',');
            })
            .calcularSaldoComanda(${pedido});
        }

        function continuar(btn){
          // 🔒 ANTI-DUPLO CLIQUE REAL
          if(btn.disabled) return;

          btn.disabled = true;
          const textoOriginal = btn.innerText;
          btn.innerText = '⏳ Salvando...';

          google.script.run
            .withSuccessHandler(() => {
              google.script.host.close();
            })
            .withFailureHandler(err => {
              // 🔔 popup informativo (mantém padrão do sistema)
              alert(err.message || err);

              // 🔓 libera botão em caso de erro
              btn.disabled = false;
              btn.innerText = textoOriginal;
            })
            .salvarContinuarVendendo(
              ${pedido},
              carrinho
            );
        }
        
        function fechar(){

          const novos = carrinho.filter(i => !i.travado);

          // 🔥 SE EXISTEM ITENS NOVOS, SALVA PRIMEIRO
          if(novos.length){

            google.script.run
              .withFailureHandler(err=>{
                alert(err.message || err);
              })
              .withSuccessHandler(()=>{

                // depois de salvar, abre fechamento
                google.script.run
                  .withSuccessHandler(()=>{ google.script.host.close(); })
                  .popupFecharComanda(${pedido});

              })
              .salvarContinuarVendendo(
                ${pedido},
                carrinho
              );

          } else {

            // nenhum item novo → pode fechar direto
            google.script.run
              .withSuccessHandler(()=>{ google.script.host.close(); })
              .popupFecharComanda(${pedido});

          }
        }

        function cancelar(){
          google.script.host.close();
        }

        render();
      </script>
    `;

    abrirPopup('🍺 Comanda Aberta', html, 620, 720);
  }
  function salvarContinuarVendendo(pedido, carrinho){

    validarEstoqueCarrinho(carrinho);

    if(!pedido || !Array.isArray(carrinho)){
      throw new Error('Dados inválidos.');
    }

    const ss = SpreadsheetApp.getActive();
    let sh = ss.getSheetByName('COMANDA_ITENS');

    if(!sh){
      sh = ss.insertSheet('COMANDA_ITENS');
      sh.getRange('A1:F1').setValues([[
        'Pedido','Produto','Qtd','Valor Unit','Total','Processado'
      ]]);
    }

    let houveInclusao = false;

    carrinho.forEach(item => {

      // 🔥 SOMENTE ITENS NOVOS
      if(item.travado === false){

        // 1️⃣ Grava item
        sh.appendRow([
          pedido,
          item.produto,
          Number(item.qtd),
          Number(item.unit),
          Number(item.qtd) * Number(item.unit),
          'SIM'
        ]);

        // 2️⃣ Baixa estoque
        baixarEstoquePorComanda(
          item.produto,
          Number(item.qtd)
        );

        item.travado = true;

        houveInclusao = true;
      }
    });

    if(houveInclusao){
      atualizarEstoque();
      SpreadsheetApp.flush();
    }

    return true;
  }
  function salvarItensComandaAberta(pedido, carrinho){

    if(!pedido || !Array.isArray(carrinho)) return;

    const ss = SpreadsheetApp.getActive();

    let itensSh = ss.getSheetByName('COMANDA_ITENS');

    if(!itensSh){
      itensSh = ss.insertSheet('COMANDA_ITENS');
      itensSh.getRange('A1:F1').setValues([[
        'Pedido','Produto','Qtd','Valor Unit','Total','Processado'
      ]]);
    }

    let houveConsumo = false;

    carrinho.forEach(i => {

      // 🔥 SOMENTE NOVOS
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
        validarEstoqueCarrinho([i]);

        itensSh.appendRow([
          pedido,
          i.produto,
          Number(i.qtd),
          Number(i.unit),
          Number(i.qtd) * Number(i.unit),
          'SIM'
        ]);

        // 🔻 BAIXA IMEDIATA
        baixarEstoquePorComanda(
          i.produto,
          Number(i.qtd)
        );

        i.travado = true;

        houveConsumo = true;
      
    });

    if(houveConsumo){
      atualizarEstoque();
      SpreadsheetApp.flush();
    }

    return true;
  }
  function reverterItensComandaAberta(itens){
    const ss = SpreadsheetApp.getActive();
    const vendas = ss.getSheetByName('VENDAS');
    const dados = vendas.getDataRange().getValues();

    // percorre de baixo para cima para poder deletar
    for(let i = dados.length - 1; i > 0; i--){
      const v = dados[i];

      const achou = itens.find(it =>
        it.produto === v[1] &&
        Number(it.qtd) === Number(v[2]) &&
        v[5] === 'COMANDA BALCAO'
      );

      if(achou){
        vendas.deleteRow(i + 1);
      }
    }

    atualizarEstoque();
    
  }
  function calcularTotalComanda(pedido){
    const ss = SpreadsheetApp.getActive();
    const itens = ss.getSheetByName('COMANDA_ITENS')
      .getDataRange().getValues()
      .filter((l,i)=>i>0 && l[0]===pedido);

    let total = 0;
    itens.forEach(i=>{
      total += Number(i[2]) * Number(i[3]);
    });

    return total;
  }
  function calcularPagamentosComanda(pedido){
    const cx = SpreadsheetApp.getActive()
      .getSheetByName('CAIXA')
      .getDataRange().getValues();

    let pago = 0;

    cx.forEach((c,i)=>{
      if(i===0) return;
      if(
        typeof c[4] === 'string' &&
        c[4] && c[4].includes(pedido)
      ){
        pago += Number(c[2]) || 0;
      }
    });

    return pago;
  }
  function calcularSaldoComanda(pedido){
    const total = calcularTotalComanda(pedido);
    const pagos = calcularPagamentosComanda(pedido);
    return total - pagos;
  }
  function registrarPagamentoParcialComanda(pedido, valor, pagamento){
    valor = Number(valor);
    if(valor <= 0){
      return { ok:false, msg:'Valor inválido.' };
    }

    const saldoAntes = calcularSaldoComanda(pedido);

    if(valor > saldoAntes){
      return { ok:false, msg:'Valor maior que o saldo da comanda.' };
    }

    const cx = SpreadsheetApp.getActive().getSheetByName('CAIXA');

    inserirLinhaNoTopo('CAIXA', [
      new Date(),
      'Entrada',
      valor,
      pagamento,
      `COMANDA #${pedido} (PARCIAL)`
    ]);

    const saldoDepois = saldoAntes - valor;

    return {
      ok: true,
      saldoAtual: saldoDepois,
      quitado: saldoDepois === 0 // 🔥 CHAVE DO FLUXO
    };
  }
  function popupPagamentoParcialComanda(pedido){
    const ss = SpreadsheetApp.getActive();

    const total = calcularTotalComanda(pedido);
    const pagos = calcularPagamentosComanda(pedido);
    const saldo = total - pagos;

    const cmd = ss.getSheetByName('COMANDAS')
      .getDataRange().getValues()
      .find((l,i)=>i>0 && l[0]===pedido);

    const cliente = cmd ? cmd[2] : '';

    const html = `
      <div style="display:flex;flex-direction:column;gap:10px">

        <h3>💵 Pagamento Parcial</h3>

        <div><strong>🧾 Comanda #${pedido}</strong></div>
        <div>👤 ${cliente || 'Cliente não informado'}</div>

        <hr>

        <div>Total da comanda: <strong>R$ ${total.toFixed(2).replace('.',',')}</strong></div>
        <div>Total pago: <strong>R$ ${pagos.toFixed(2).replace('.',',')}</strong></div>

        <div style="font-size:16px">
          Saldo atual: <strong>R$ ${formatarMoeda(saldo).replace('.',',')}</strong>
        </div>

        <hr>

        <label>Valor a pagar agora</label>
        <input id="valor" placeholder="R$ 0,00">

        <label>Forma de pagamento</label>
        <select id="pag">
          <option>⚡ Pix</option>
          <option>💵 Dinheiro</option>
          <option>💳 Cartão Débito</option>
          <option>💳 Cartão Crédito</option>
        </select>

        <button class="btn-success" id="btn" onclick="confirmar(this)">
          ➕ Registrar Pagamento
        </button>

        <button class="btn-secondary" onclick="google.script.host.close()">
          ❌ Cancelar
        </button>
      </div>

      <script>
        const valorInput = document.getElementById('valor');

        valorInput.addEventListener('input', () => {
          let v = valorInput.value.replace(/\\D/g,'');
          if(!v){
            valorInput.value = '';
            return;
          }

          v = (Number(v) / 100).toFixed(2);
          valorInput.value = 'R$ ' + v.replace('.',',');
        });

      function confirmar(btn){

        let v = valorInput.value
          .replace('R$','')
          .replace(',','.')
          .trim();

        if(!v || Number(v) <= 0){
          alert('Informe um valor válido.');
          return;
        }

        btn.disabled = true;
        btn.innerText = '⏳ Registrando...';

        google.script.run
          .withFailureHandler(err => {
            alert(err.message || err);
            btn.disabled = false;
            btn.innerText = '➕ Registrar Pagamento';
          })
          .withSuccessHandler(res => {

            if(!res.ok){
              alert(res.msg);
              btn.disabled = false;
              btn.innerText = '➕ Registrar Pagamento';
              return;
            }

            if(res.quitado){
              google.script.host.close();
              google.script.run.popupConfirmarFechamentoComanda(${pedido});
              return;
            }

            google.script.host.close();
          })
          .registrarPagamentoParcialComanda(
            ${pedido},
            v,
            pag.value
          );
      }
      </script>
    `;

    abrirPopup(
      `💵 Pagamento Parcial — Comanda #${pedido}`,
      html,
      420,
      520
    );
  }
  function popupConfirmarFechamentoComanda(pedido){

    const html = `
      <div style="text-align:center;padding:20px">
        <h3>🧾 Comanda Quitada</h3>

        <p>
          O pagamento registrado quitou totalmente a comanda.<br><br>
          Deseja <strong>fechar a comanda agora</strong> ou mantê-la aberta?
        </p>

        <button class="btn-success" onclick="fechar()">
          💰 Fechar Comanda
        </button>

        <button class="btn-secondary" onclick="manter()">
          🟢 Manter Aberta
        </button>

        <script>

          function fechar(){
            google.script.run
              .withSuccessHandler(()=>{
                google.script.host.close();
              })
              .fecharComandaQuitada(${pedido});
          }

          function manter(){
            google.script.host.close();
            google.script.run.popupComandaExistente(${pedido});
          }

        </script>
      </div>
    `;

    abrirPopup(
      'Confirmação de Fechamento',
      html,
      420,
      320
    );
  }
  function popupDecisaoFecharComanda(pedido){
    const html = `
      <div style="text-align:center;display:flex;flex-direction:column;gap:14px">

        <h3>🧾 Comanda Quitada</h3>

        <p style="font-size:15px">
          O valor da comanda foi <strong>totalmente pago</strong>.<br>
          Deseja finalizar a comanda agora?
        </p>

        <button class="btn-success" onclick="fechar()">
          💰 Fechar Comanda
        </button>

        <button class="btn-secondary" onclick="manter()">
          🟢 Manter Comanda Aberta
        </button>
      </div>

      <script>
        function fechar(){
          google.script.run
            .withSuccessHandler(()=>{
              google.script.host.close();
              google.script.run.popupFecharComanda(${pedido});
            })
            .fecharComandaQuitada(${pedido});
        }

        function manter(){
          google.script.host.close();
        }
      </script>
    `;

    abrirPopup(
      'Decisão de Fechamento',
      html,
      380,
      300
    );
  }
  function popupFecharComanda(pedido){

    const total = calcularTotalComanda(pedido);
    const pagos = calcularPagamentosComanda(pedido);
    const saldo = total - pagos;

    const html = `
      <div style="display:flex;flex-direction:column;gap:14px">

        <h3 style="text-align:center">💰 Finalizar Comanda</h3>

        <div style="
          background:#020617;
          color:#e5e7eb;
          padding:12px;
          border-radius:10px;
          text-align:center
        ">
          <div>🧾 Total: <strong>R$ ${total.toFixed(2).replace('.',',')}</strong></div>
          <div>💵 Pago: <strong>R$ ${pagos.toFixed(2).replace('.',',')}</strong></div>
          <div>⚖️ Saldo: <strong style="color:#22c55e">
            R$ ${saldo.toFixed(2).replace('.',',')}
          </strong></div>
        </div>

        <label>💳 Forma de Pagamento</label>

        <select id="pag">
          <option>⚡ Pix</option>
          <option>💵 Dinheiro</option>
          <option>💳 Cartão Débito</option>
          <option>💳 Cartão Crédito</option>
          <option>🧾 Fiado</option>
        </select>

        <button
          id="btnConfirmar"
          class="btn-success"
          onclick="confirmar(this)">
          ✅ Confirmar Pagamento
        </button>

        <button
          class="btn-secondary"
          onclick="voltar()">
          ↩️ Voltar
        </button>
      </div>

      <script>

        function confirmar(btn){

          if(btn.disabled) return;

          btn.disabled = true;
          const textoOriginal = btn.innerText;
          btn.innerText = '⏳ Processando...';

          google.script.run
            .withFailureHandler(err => {
              alert(err.message || err);
              btn.disabled = false;
              btn.innerText = textoOriginal;
            })
            .withSuccessHandler(() => {
              google.script.host.close();
            })
            .fecharComandaBalcaoFinal(
              ${pedido},
              pag.value
            );
        }

        function voltar(){
          google.script.host.close();
          google.script.run.popupComandaExistente(${pedido});
        }

      </script>
    `;

    abrirPopup(
      'Finalizar Comanda',
      html,
      440,
      420
    );
  }
  function fecharComandaQuitada(pedido){
    const ss = SpreadsheetApp.getActive();

    // 🔹 APENAS fecha a comanda
    const sh = ss.getSheetByName('COMANDAS');
    const dados = sh.getDataRange().getValues();

    dados.forEach((c,i)=>{
      if(i>0 && c[0] === pedido){
        sh.getRange(i+1,5).setValue('FECHADA');
      }
    });

    return true;
  }
  function fecharComandaBalcaoFinal(pedido, formaPgto){

    const ss = SpreadsheetApp.getActive();

