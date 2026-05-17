      // ===============================
      // 2️⃣ AJUSTA ESTOQUE
      // ===============================
      const sh = ss.getSheetByName('ESTOQUE');
      if(!sh){
        return { ok:false, msg:'Aba ESTOQUE não encontrada.' };
      }

      const dados = sh.getDataRange().getValues();

      for(let i = 1; i < dados.length; i++){

        if(dados[i][0] === produto){

          const qtdAtual = Number(dados[i][1]) || 0;
          const minimo   = Number(dados[i][2]) || 0;
          const novaQtd  = qtdAtual + quantidade;

          // 🧠 calcula STATUS
          let status = '🟢   OK   🔋';
          if(novaQtd <= 0){
            status = '🔴 Crítico🪫';
          }else if(novaQtd <= minimo * 2){
            status = '🟡 Baixo';
          }    

          sh.getRange(i+1, 2).setValue(novaQtd);            // Quantidade (B)
          sh.getRange(i+1, 4).setValue(status);             // Status (D)
          sh.getRange(i+1, 5).setValue(motivo || 'AJUSTE'); // Motivo (E)

          return { ok:true };
        }
      }

      return { ok:false, msg:'Produto não encontrado no estoque.' };
    }
    function aplicarEstoqueInicial(){
      const ss = SpreadsheetApp.getActive();
      const ini = ss.getSheetByName('ESTOQUE_INICIAL');
      if(!ini){
        SpreadsheetApp.getUi().alert('Crie a aba ESTOQUE_INICIAL.');
        return;
      }

      const dados = ini.getDataRange().getValues();
      const compras = ss.getSheetByName('COMPRAS');

      dados.forEach((d,i)=>{
        if(i===0 || !d[0] || d[1]<=0) return;
        compras.appendRow([
          new Date(),
          d[0],
          d[1],
          0,
          'Estoque Inicial'
        ]);
      });

      atualizarEstoque();
      SpreadsheetApp.getUi().alert('✅ Estoque inicial aplicado com sucesso.');
    }
    function devolverEstoqueDelivery(pedido){
      const ss = SpreadsheetApp.getActive();
      const itensSh = ss.getSheetByName('DELIVERY_ITENS');

      if(!itensSh) return;

      const dados = itensSh.getDataRange().getValues();

      for(let i = 1; i < dados.length; i++){
        if(dados[i][0] == pedido && dados[i][5] === 'SIM'){
          // marca como NÃO baixado
          itensSh.getRange(i + 1, 6).setValue('NAO');
        }
      }

      atualizarEstoque();
    }
    function popupAjusteEstoque(){
      const produtos = getProdutosCatalogo();

      const html = `
        <label>📦 Produto</label>
        <select id="produto">
          <option value="">Selecione</option>
          ${produtos.map(p=>`<option>${p}</option>`).join('')}
        </select>

        <label>🔢 Quantidade a adicionar</label>
        <input id="qtd" type="number" min="1">

        <label>📝 Motivo do ajuste</label>
        <input id="motivo" placeholder="Ex: Inventário inicial">

        <button class="btn-success" onclick="confirmar()">✅ Ajustar Estoque</button>
        <button class="btn-danger" onclick="google.script.host.close()">❌ Cancelar</button>

        <script>
          function confirmar(){

            if(!produto.value || !qtd.value){
              alert('Preencha todos os campos.');
              return;
            }

            google.script.run
              .withSuccessHandler(res => {
                if(!res || !res.ok){
                  alert(res.msg || 'Erro ao ajustar estoque');
                  return;
                }
                google.script.host.close(); // ✅ FECHA POPUP
              })
              .withFailureHandler(err => {
                alert(err.message || err);
              })
              .ajustarEstoque(
                produto.value,
                qtd.value,
                motivo.value
              );
          }
        </script>    `;

      abrirPopup('⚙️ Ajuste de Estoque', html, 420, 420);
    }
    function getProdutosCatalogo(){
      const sh = SpreadsheetApp.getActive().getSheetByName('PRODUTOS');
      if(!sh) return [];

      return sh.getRange(2,1,sh.getLastRow()-1,1)
        .getValues()
        .flat()
        .filter(Boolean);
    }

