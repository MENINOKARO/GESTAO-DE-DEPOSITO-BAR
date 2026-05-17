// =============================================
// MODULO CONTAS A RECEBER
// =============================================
  function popupReceberContaAReceber(id){

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('CONTAS_A_RECEBER');

    const dados = sh.getDataRange().getValues();
    const idx = dados.findIndex((l,i)=> i>0 && l[0] === id);

    if(idx < 0){
      SpreadsheetApp.getUi().alert('Conta não encontrada.');
      return;
    }

    const base = dados[idx];
    const cliente = String(base[3] || '').trim();

    if(!cliente){
      SpreadsheetApp.getUi().alert('Cliente não informado nesta conta.');
      return;
    }

    const abertas = dados
      .slice(1)
      .filter(l=>{
        const cli = String(l[3] || '').trim().toUpperCase();
        const status = String(l[8] || '').toUpperCase();
        const saldo = Number(l[6]) || 0;
        return cli === cliente.toUpperCase() && (status === 'PENDENTE' || status === 'PARCIAL') && saldo > 0;
      })
      .map(l=>({
        id: String(l[0] || ''),
        idVenda: String(l[2] || '-'),
        valorTotal: Number(l[4]) || 0,
        recebido: Number(l[5]) || 0,
        saldo: Number(l[6]) || 0,
        data: l[9] ? new Date(l[9]) : null
      }))
      .sort((a,b)=>{
        const da = a.data && !isNaN(a.data.getTime()) ? a.data.getTime() : Number.MAX_SAFE_INTEGER;
        const db = b.data && !isNaN(b.data.getTime()) ? b.data.getTime() : Number.MAX_SAFE_INTEGER;
        return da - db;
      });

    if(!abertas.length){
      SpreadsheetApp.getUi().alert('Não há débitos em aberto para este cliente.');
      return;
    }

    const totalAberto = abertas.reduce((acc,o)=> acc + o.saldo, 0);

    const html = `
    <div style="display:flex;flex-direction:column;gap:12px;font-family:Arial">

      <h3 style="text-align:center">💰 Receber Parcial</h3>

      <div style="
        background:#020617;
        color:#e5e7eb;
        padding:10px;
        border-radius:10px;
        text-align:center
      ">
        <strong>${cliente}</strong><br>
        <small>${abertas.length} débito(s) em aberto</small>
      </div>

      <div>
        💵 Saldo total em aberto:
        <strong style="color:#16a34a">
          R$ ${Number(totalAberto).toFixed(2).replace('.',',')}
        </strong>
      </div>

      <div style="border:1px solid #e5e7eb;border-radius:10px;padding:8px;max-height:120px;overflow:auto;background:#f8fafc">
        <strong>🧾 Comandas em débito</strong>
        ${abertas.map(o=>`
          <div style="margin-top:6px;padding-top:6px;border-top:1px dashed #cbd5e1">
            <small>
              ${o.idVenda} · ${o.id}<br>
              Total: R$ ${o.valorTotal.toFixed(2).replace('.',',')} ·
              Recebido: R$ ${o.recebido.toFixed(2).replace('.',',')} ·
              Saldo: <strong style="color:#dc2626">R$ ${o.saldo.toFixed(2).replace('.',',')}</strong>
            </small>
          </div>
        `).join('')}
      </div>

      <label>Valor a receber</label>
      <input id="valor" placeholder="R$ 0,00">

      <label>Forma de recebimento</label>
      <select id="forma">
        <option value="⚡ Pix">⚡ Pix</option>
        <option value="💵 Dinheiro">💵 Dinheiro</option>
        <option value="💳 Cartão Débito">💳 Cartão Débito</option>
        <option value="💳 Cartão Crédito">💳 Cartão Crédito</option>
      </select>

      <button id="btn" onclick="confirmar()">
        💾 Registrar Recebimento
      </button>

      <button onclick="google.script.host.close()">❌ Cancelar</button>

      <script>
        const inputValor = document.getElementById('valor');
        const selectForma = document.getElementById('forma');
        const btn = document.getElementById('btn');
        let processando = false;

        inputValor.addEventListener('input', ()=>{
          let v = inputValor.value.replace(/\\D/g,'');
          if(!v){
            inputValor.value = '';
            return;
          }

          v = (Number(v) / 100).toFixed(2);
          inputValor.value = 'R$ ' + v.replace('.',',');
        });

        function confirmar(){

          if(processando) return;
          processando = true;

          const valor = Number(
            inputValor.value
              .replace('R$','')
              .replace(',', '.')
              .trim()
          );

          if(!Number.isFinite(valor) || valor <= 0){
            alert('Informe um valor válido.');
            processando = false;
            return;
          }

          btn.disabled = true;
          btn.innerText = '⏳ Processando...';

          google.script.run
            .withFailureHandler(e=>{
              alert(e.message || e);
              btn.disabled = false;
              btn.innerText = '💾 Registrar Recebimento';
              processando = false;
            })
            .withSuccessHandler(()=>{
              google.script.host.close();
              if(google && google.script && google.script.run && google.script.run.popupPainelContasAReceber){
                google.script.run.popupPainelContasAReceber();
              }
            })
            .receberParcialContaAReceberCliente(
              decodeURIComponent('${encodeURIComponent(cliente)}'),
              valor,
              selectForma.value
            );
        }
      </script>

    </div>
    `;

    abrirPopup('💰 Receber', html, 470, 620);
  }
  function gerarResumoContasAReceberPendentes(){

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('CONTAS_A_RECEBER');

    if(!sh || sh.getLastRow() < 2){
      return [];
    }

    const dados = sh.getDataRange().getValues().slice(1);
    const mapa = {};

    dados.forEach(l=>{
      const status = String(l[8] || '').toUpperCase();
      if(status !== 'PENDENTE' && status !== 'PARCIAL') return;

      const saldo = Number(l[6]) || 0;
      if(saldo <= 0) return;

      const id = String(l[0] || '').trim();
      const cliente = String(l[3] || 'SEM NOME').trim() || 'SEM NOME';
      const clienteKey = cliente.toUpperCase();
      const dataFiado = l[9] ? new Date(l[9]) : null;
      const dataValida = dataFiado && !isNaN(dataFiado.getTime());

      if(!mapa[clienteKey]){
        mapa[clienteKey] = {
          cliente,
          clienteKey,
          totalFiado: 0,
          idReferencia: id,
          dataPrimeiroFiado: dataValida ? dataFiado : null
        };
      }

      mapa[clienteKey].totalFiado += saldo;

      if(dataValida){
        if(!mapa[clienteKey].dataPrimeiroFiado || dataFiado < mapa[clienteKey].dataPrimeiroFiado){
          mapa[clienteKey].dataPrimeiroFiado = dataFiado;
          mapa[clienteKey].idReferencia = id;
        }
      }
    });

    return Object.keys(mapa)
      .map(k=>mapa[k])
      .sort((a,b)=>{
        const da = a.dataPrimeiroFiado ? a.dataPrimeiroFiado.getTime() : Number.MAX_SAFE_INTEGER;
        const db = b.dataPrimeiroFiado ? b.dataPrimeiroFiado.getTime() : Number.MAX_SAFE_INTEGER;
        return da - db;
      });
  }
  function popupPainelContasAReceber(){

    const contas = gerarResumoContasAReceberPendentes();

    if(!contas.length){
      SpreadsheetApp.getUi().alert('Nenhuma conta a receber pendente/parcial.');
      return;
    }

    const tz = Session.getScriptTimeZone();

    const html = `
    <div style="font-family:Arial;display:flex;flex-direction:column;gap:10px">

      <h3>💳 Contas a Receber – Pendentes/Parciais</h3>

      ${contas.map(c=>`
        <div style="border:1px solid #e5e7eb;padding:10px;border-radius:8px">
          <strong>${c.cliente}</strong><br>
          📅 1º Fiado: ${c.dataPrimeiroFiado
            ? Utilities.formatDate(c.dataPrimeiroFiado, tz, 'dd/MM/yyyy')
            : '-'}<br>
          💵 Total em aberto: <strong style="color:#dc2626">R$ ${Number(c.totalFiado).toFixed(2).replace('.',',')}</strong><br>
          <button onclick="receber(decodeURIComponent('${encodeURIComponent(c.cliente)}'), this)">💰 Receber</button>
        </div>
      `).join('')}

      <button onclick="google.script.host.close()">❌ Fechar</button>

      <script>
        function receber(cliente, btn){
          if(btn.disabled) return;
          btn.disabled = true;
          btn.innerText = '⏳ Abrindo...';

          google.script.run
            .withFailureHandler(e=>{
              alert(e.message || e);
              btn.disabled = false;
              btn.innerText = '💰 Receber';
            })
            .withSuccessHandler(()=>{
              google.script.host.close();
            })
            .popupReceberClienteContaAReceber(cliente);
        }
      </script>
    </div>
    `;

    abrirPopup('💳 Contas a Receber', html, 460, 520);
  }

  function popupReceberClienteContaAReceber(cliente){

    const nomeCliente = String(cliente || '').trim();
    const clienteKeyBusca = normalizeString(nomeCliente);
    if(!nomeCliente){
      SpreadsheetApp.getUi().alert('Cliente inválido.');
      return;
    }

    const contas = gerarResumoContasAReceberPendentes();
    const item = contas.find(c => normalizeString(c.clienteKey || '') === clienteKeyBusca);

    if(!item){
      SpreadsheetApp.getUi().alert('Nenhuma conta pendente/parcial encontrada para este cliente.');
      return;
    }

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('CONTAS_A_RECEBER');
    const abertas = sh.getDataRange().getValues()
      .slice(1)
      .filter(l=>{
        const cli = String(l[3] || '').trim().toUpperCase();
        const status = String(l[8] || '').toUpperCase();
        const saldo = Number(l[6]) || 0;
        return cli === nomeCliente.toUpperCase() && (status === 'PENDENTE' || status === 'PARCIAL') && saldo > 0;
      })
      .map(l=>({
        id: String(l[0] || ''),
        idVenda: String(l[2] || '-'),
        valorTotal: Number(l[4]) || 0,
        recebido: Number(l[5]) || 0,
        saldo: Number(l[6]) || 0,
        data: l[9] ? new Date(l[9]) : null
      }))
      .sort((a,b)=>{
        const da = a.data && !isNaN(a.data.getTime()) ? a.data.getTime() : Number.MAX_SAFE_INTEGER;
        const db = b.data && !isNaN(b.data.getTime()) ? b.data.getTime() : Number.MAX_SAFE_INTEGER;
        return da - db;
      });

    const html = `
    <div style="display:flex;flex-direction:column;gap:12px;font-family:Arial">

      <h3 style="text-align:center">💰 Receber Parcial (Cliente)</h3>

      <div style="
        background:#020617;
        color:#e5e7eb;
        padding:10px;
        border-radius:10px;
        text-align:center
      ">
        <strong>${item.cliente}</strong><br>
        <small>Recebimento consolidado de múltiplos fiados</small>
      </div>

      <div>
        💵 Saldo total em aberto:
        <strong style="color:#16a34a">
          R$ ${Number(item.totalFiado).toFixed(2).replace('.',',')}
        </strong>
      </div>

      <div style="border:1px solid #e5e7eb;border-radius:10px;padding:8px;max-height:120px;overflow:auto;background:#f8fafc">
        <strong>🧾 Comandas em débito</strong>
        ${abertas.map(o=>`
          <div style="margin-top:6px;padding-top:6px;border-top:1px dashed #cbd5e1">
            <small>
              ${o.idVenda} · ${o.id}<br>
              Total: R$ ${o.valorTotal.toFixed(2).replace('.',',')} ·
              Recebido: R$ ${o.recebido.toFixed(2).replace('.',',')} ·
              Saldo: <strong style="color:#dc2626">R$ ${o.saldo.toFixed(2).replace('.',',')}</strong>
            </small>
          </div>
        `).join('')}
      </div>

      <label>Valor a receber</label>
      <input id="valor" placeholder="R$ 0,00">

      <label>Forma de recebimento</label>
      <select id="forma">
        <option value="⚡ Pix">⚡ Pix</option>
        <option value="💵 Dinheiro">💵 Dinheiro</option>
        <option value="💳 Cartão Débito">💳 Cartão Débito</option>
        <option value="💳 Cartão Crédito">💳 Cartão Crédito</option>
      </select>

      <button id="btn" onclick="confirmar()">
        💾 Registrar Recebimento
      </button>

      <button onclick="google.script.host.close()">❌ Cancelar</button>

      <script>
        const inputValor = document.getElementById('valor');
        const selectForma = document.getElementById('forma');
        const btn = document.getElementById('btn');
        let processando = false;

        inputValor.addEventListener('input', ()=>{
          let v = inputValor.value.replace(/\\D/g,'');
          if(!v){
            inputValor.value = '';
            return;
          }

          v = (Number(v) / 100).toFixed(2);
          inputValor.value = 'R$ ' + v.replace('.',',');
        });

        function confirmar(){
          if(processando) return;
          processando = true;

          const valor = Number(
            inputValor.value
              .replace('R$','')
              .replace(',', '.')
              .trim()
          );

          if(!Number.isFinite(valor) || valor <= 0){
            alert('Informe um valor válido.');
            processando = false;
            return;
          }

          btn.disabled = true;
          btn.innerText = '⏳ Processando...';

          google.script.run
            .withFailureHandler(e=>{
              alert(e.message || e);
              btn.disabled = false;
              btn.innerText = '💾 Registrar Recebimento';
              processando = false;
            })
            .withSuccessHandler(()=>{
              google.script.host.close();
              google.script.run.popupPainelContasAReceber();
            })
            .receberParcialContaAReceberCliente(
              decodeURIComponent('${encodeURIComponent(nomeCliente)}'),
              valor,
              selectForma.value
            );
        }
      </script>

    </div>
    `;

    abrirPopup('💰 Receber', html, 470, 620);
  }
  function receberParcialContaAReceberCliente(cliente, valor, forma){

    valor = Number(valor);
    if(valor <= 0){
      throw new Error('Valor inválido.');
    }

    const nomeCliente = String(cliente || '').trim().toUpperCase();
    if(!nomeCliente){
      throw new Error('Cliente inválido.');
    }

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('CONTAS_A_RECEBER');
    const dados = sh.getDataRange().getValues();

    const contas = dados
      .map((l,i)=>({ linha:i+1, dados:l }))
      .slice(1)
      .filter(o=>{
        const cli = String(o.dados[3] || '').trim().toUpperCase();
        const status = String(o.dados[8] || '').toUpperCase();
        const saldo = Number(o.dados[6]) || 0;
        return cli === nomeCliente && (status === 'PENDENTE' || status === 'PARCIAL') && saldo > 0;
      })
      .sort((a,b)=>{
        const da = a.dados[9] ? new Date(a.dados[9]).getTime() : Number.MAX_SAFE_INTEGER;
        const db = b.dados[9] ? new Date(b.dados[9]).getTime() : Number.MAX_SAFE_INTEGER;
        return da - db;
      });

    if(!contas.length){
      throw new Error('Nenhuma conta pendente/parcial encontrada para o cliente.');
    }

    const saldoTotal = contas.reduce((acc,o)=> acc + (Number(o.dados[6]) || 0), 0);
    if(valor > saldoTotal){
      throw new Error('Valor maior que o saldo total em aberto do cliente.');
    }

    let restante = valor;
    const resumo = [];

    contas.forEach(o=>{
      if(restante <= 0) return;

      const id = String(o.dados[0] || '');
      const total = Number(o.dados[4]) || 0;
      const recebido = Number(o.dados[5]) || 0;
      const saldo = Number(o.dados[6]) || 0;

      const abatimento = Math.min(restante, saldo);
      const novoRecebido = recebido + abatimento;
      const novoSaldo = total - novoRecebido;

      sh.getRange(o.linha, 6).setValue(novoRecebido);
      sh.getRange(o.linha, 7).setValue(novoSaldo);
      const statusAtualizado = novoSaldo === 0 ? 'QUITADO' : 'PARCIAL';
      sh.getRange(o.linha, 9).setValue(statusAtualizado);
      sh.getRange(o.linha, 12).setValue(statusAtualizado === 'QUITADO' ? agoraBrasil() : '');

      resumo.push(`${id}: +${abatimento.toFixed(2)}`);
      restante -= abatimento;
    });

    registrarCaixa(
      agoraBrasil(),
      'Entrada',
      valor,
      forma,
      'CONTAS_A_RECEBER',
      `CLIENTE:${nomeCliente}`
    );

    registrarLog(
      'RECEBIMENTO_CLIENTE',
      nomeCliente,
      `SaldoTotal:${saldoTotal.toFixed(2)}`,
      `Recebido:${valor.toFixed(2)} | ${resumo.join(' | ')}`
    );

    return true;
  }

  function gerarResumoContasAReceberPendentes(){

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName('CONTAS_A_RECEBER');

    if(!sh || sh.getLastRow() < 2){
      return [];
    }

    const dados = sh.getDataRange().getValues().slice(1);
    const mapa = {};

    dados.forEach(l=>{
      const status = String(l[8] || '').toUpperCase();
      if(status !== 'PENDENTE' && status !== 'PARCIAL') return;

      const saldo = Number(l[6]) || 0;
      if(saldo <= 0) return;

      const id = String(l[0] || '').trim();
      const cliente = String(l[3] || 'SEM NOME').trim() || 'SEM NOME';
      const dataFiado = l[9] ? new Date(l[9]) : null;
      const dataValida = dataFiado && !isNaN(dataFiado.getTime());

      if(!mapa[cliente]){
        mapa[cliente] = {
          cliente,
          totalFiado: 0,
          idReferencia: id,
          dataPrimeiroFiado: dataValida ? dataFiado : null
        };
      }

      mapa[cliente].totalFiado += saldo;

      if(dataValida){
        if(!mapa[cliente].dataPrimeiroFiado || dataFiado < mapa[cliente].dataPrimeiroFiado){
          mapa[cliente].dataPrimeiroFiado = dataFiado;
          mapa[cliente].idReferencia = id;
        }
      }
    });

    return Object.keys(mapa)
      .map(nome=>mapa[nome])
      .sort((a,b)=>{
        const da = a.dataPrimeiroFiado ? a.dataPrimeiroFiado.getTime() : Number.MAX_SAFE_INTEGER;
        const db = b.dataPrimeiroFiado ? b.dataPrimeiroFiado.getTime() : Number.MAX_SAFE_INTEGER;
        return da - db;
      });
  }
  function popupPainelContasAReceber(){

    const contas = gerarResumoContasAReceberPendentes();

    if(!contas.length){
      SpreadsheetApp.getUi().alert('Nenhuma conta a receber pendente/parcial.');
      return;
    }

    const tz = Session.getScriptTimeZone();

    const html = `
    <div style="font-family:Arial;display:flex;flex-direction:column;gap:10px">

      <h3>💳 Contas a Receber – Pendentes/Parciais</h3>

      ${contas.map(c=>`
        <div style="border:1px solid #e5e7eb;padding:10px;border-radius:8px">
          <strong>${c.cliente}</strong><br>
          📅 1º Fiado: ${c.dataPrimeiroFiado
            ? Utilities.formatDate(c.dataPrimeiroFiado, tz, 'dd/MM/yyyy')
            : '-'}<br>
          💵 Total em aberto: <strong style="color:#dc2626">R$ ${Number(c.totalFiado).toFixed(2).replace('.',',')}</strong><br>
          <button onclick="receber('${c.idReferencia}', this)">💰 Receber</button>
        </div>
      `).join('')}

      <button onclick="google.script.host.close()">❌ Fechar</button>

      <script>
        function receber(id, btn){
          if(btn.disabled) return;
          btn.disabled = true;
          btn.innerText = '⏳ Abrindo...';

          google.script.run
            .withFailureHandler(e=>{
              alert(e.message || e);
              btn.disabled = false;
              btn.innerText = '💰 Receber';
            })
            .withSuccessHandler(()=>{
              google.script.host.close();
            })
            .popupReceberContaAReceber(id);
        }
      </script>
    </div>
    `;

    abrirPopup('💳 Contas a Receber', html, 460, 520);
  }
  function popupPainelFinanceiro(){

    const hoje = Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'yyyy-MM-dd'
    );

    const html = `
    <div style="font-family:Arial;display:flex;flex-direction:column;gap:14px">

      <h3 style="text-align:center">📊 Painel Financeiro</h3>

      <!-- 🔎 BUSCA POR PERÍODO -->
      <div style="
        border:1px solid #e5e7eb;
        border-radius:10px;
        padding:10px;
        background:#f8fafc
      ">

        <div style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          margin-bottom:8px
        ">
          <strong>🔎 Busca por período</strong>

          <button
            onclick="buscar()"
            style="
              width:120px;
              height:28px;
              border-radius:6px;
              background:#2563eb;
              color:#fff;
              border:none;
              cursor:pointer;
              font-size:12px;
              display:flex;
              align-items:center;
              justify-content:center
            ">
            🔎 Buscar
          </button>      
        </div>

        <div style="display:flex;gap:10px">
          <div style="flex:1">
            <label>📅 Data Inicial</label>
            <input id="ini" type="date" style="width:100%">
          </div>

          <div style="flex:1">
            <label>📅 Data Final</label>
            <input id="fim" type="date" value="${hoje}" style="width:100%">
          </div>
        </div>
      </div>

      <!-- ➕ AÇÕES -->
      <div style="
        display:flex;
        justify-content:flex-end;
        gap:8px
      ">
      </div>

      <!-- RESULTADO -->
      <div id="resultado" style="min-height:120px">
        <div style="text-align:center;color:#64748b">
          ⏳ Carregando mês atual...
        </div>
      </div>
        <button
          onclick="google.script.run.popupContaAPagar()"
          style="
            width:160px;
            height:28px;
            border-radius:6px;
            background:#dc2626;
            color:#fff;
            border:none;
            cursor:pointer;
            font-size:12px;
            display:flex;
            align-items:center;
            justify-content:center
          ">
          ➕ Nova Conta a Pagar
        </button>
        <button
          onclick="google.script.host.close()"
          style="
            width:120px;
            height:28px;
            margin:0 auto;
            border-radius:6px;
            background:#64748b;
            color:#fff;
            border:none;
            cursor:pointer;
            font-size:12px;
            display:flex;
            align-items:center;
            justify-content:center
          ">
          ❌ Fechar
        </button>
      <script>

        // 🔥 MÊS ATUAL AUTOMÁTICO
        google.script.run
          .withSuccessHandler(html=>{
            resultado.innerHTML = html;
          })
          .gerarPainelFinanceiroMesAtual();

        function buscar(){

          if(!ini.value){
            alert('Informe a data inicial.');
            return;
          }

          resultado.innerHTML =
            '<div style="text-align:center">⏳ Buscando...</div>';

          google.script.run
            .withSuccessHandler(html=>{
              resultado.innerHTML = html;
            })
            .withFailureHandler(e=>{
              alert(e.message || e);
            })
            .gerarPainelFinanceiro(ini.value, fim.value);
        }
      </script>

    </div>
    `;

    abrirPopup('📊 Financeiro', html, 760, 680);
  }
  function garantirContasAReceber(){

    const ss = SpreadsheetApp.getActive();
    let sh = ss.getSheetByName('CONTAS_A_RECEBER');

    if(!sh){
      sh = ss.insertSheet('CONTAS_A_RECEBER');
      sh.getRange('A1:L1').setValues([[
        'ID',
        'Origem',
        'Referencia',
        'Cliente',
        'Valor_Total',
        'Valor_Recebido',
        'Saldo',
        'Forma_Original',
        'Status',
        'Data',
        'Obs',
        'Data_Quitacao'
      ]]);
    }

    const ultimaColuna = sh.getLastColumn();
    if(ultimaColuna < 12){
      sh.insertColumnAfter(ultimaColuna);
      sh.getRange(1, 12).setValue('Data_Quitacao');
    }
  }

