// ===============================
// DASHBOARD
// ===============================
  // DASHBOARD - BASE
    function resumoFinanceiroHoje(){
      const cx = SpreadsheetApp.getActive()
        .getSheetByName('CAIXA')
        .getDataRange()
        .getValues();

      const agora = new Date();

      const hoje = Utilities.formatDate(
        agora,
        Session.getScriptTimeZone(),
        'yyyyMMdd'
      );

      const ontem = Utilities.formatDate(
        new Date(agora.getTime() - 86400000),
        Session.getScriptTimeZone(),
        'yyyyMMdd'
      );

      let entrada = 0;
      let saida = 0;

      cx.forEach((c,i)=>{
        if(i===0) return;
        if(!(c[0] instanceof Date)) return;

        const dataObj = new Date(c[0]);
        const data = Utilities.formatDate(
          dataObj,
          Session.getScriptTimeZone(),
          'yyyyMMdd'
        );

        const hora = dataObj.getHours();

        // dia operacional até 03:59
        if(data !== hoje && !(data === ontem && hora < 4)) return;

        const tipo = String(c[1] || '').toUpperCase();

        if(tipo === 'ENTRADA') entrada += Number(c[2]) || 0;
        if(tipo === 'SAIDA')   saida   += Number(c[2]) || 0;
      });

      return {
        entrada,
        saida,
        saldo: entrada - saida
      };
    }
    function entradaMesAtual(){
      const cx = SpreadsheetApp.getActive()
        .getSheetByName('CAIXA')
        .getDataRange()
        .getValues();

      const agora = new Date();
      const refMes = Utilities.formatDate(agora, Session.getScriptTimeZone(), 'yyyyMM');

      let total = 0;

      cx.forEach((c,i)=>{
        if(i===0) return;
        if(!(c[0] instanceof Date)) return;
        if(c[1] !== 'Entrada') return;

        const mes = Utilities.formatDate(
          new Date(c[0]),
          Session.getScriptTimeZone(),
          'yyyyMM'
        );

        if(mes === refMes){
          total += Number(c[2]) || 0;
        }
      });

      return total;
    }
    function indicadoresOperacionaisHoje(){
      const ss = SpreadsheetApp.getActive();

      const hoje = Utilities.formatDate(
        new Date(),
        Session.getScriptTimeZone(),
        'yyyyMMdd'
      );

      let comandasAbertas = 0;
      let comandasFechadasHoje = 0;
      let deliveryHoje = 0;
      let deliveryCanceladoHoje = 0;

      // COMANDAS
      ss.getSheetByName('COMANDAS')
        .getDataRange()
        .getValues()
        .forEach((c,i)=>{
          if(i===0) return;
          if(!(c[1] instanceof Date)) return;

          const dia = Utilities.formatDate(
            new Date(c[1]),
            Session.getScriptTimeZone(),
            'yyyyMMdd'
          );

          // abertas do dia
          if(c[4] === 'ABERTA' && dia === hoje){
            comandasAbertas++;
          }

          // fechadas hoje
          if(c[4] === 'FECHADA' && dia === hoje){
            comandasFechadasHoje++;
          }
        });

      // DELIVERY
      ss.getSheetByName('DELIVERY')
        .getDataRange()
        .getValues()
        .forEach((d,i)=>{
          if(i===0) return;
          if(!(d[1] instanceof Date)) return;

          const dia = Utilities.formatDate(
            new Date(d[1]),
            Session.getScriptTimeZone(),
            'yyyyMMdd'
          );

          if(dia === hoje){
            deliveryHoje++;
            if(d[7] === 'CANCELADO') deliveryCanceladoHoje++;
          }
        });

      const taxaCancelamentoDelivery =
        deliveryHoje > 0
          ? (deliveryCanceladoHoje / deliveryHoje)
          : 0;

      return {
        comandasAbertas,
        comandasFechadasHoje,
        mediaComandasDia: comandasFechadasHoje,
        deliveryHoje,
        deliveryCanceladoHoje,
        taxaCancelamentoDelivery
      };
    }
    function prepararMovimentoDiario(){
      const ss = SpreadsheetApp.getActive();
      const vendas = ss.getSheetByName('VENDAS').getDataRange().getValues();
      const mapa = {};

      vendas.forEach((v,i)=>{
        if(i===0) return;
        if(!(v[0] instanceof Date)) return;

        const data = Utilities.formatDate(
          new Date(v[0]),
          Session.getScriptTimeZone(),
          'dd/MM/yyyy'
        );

        const valor = Number(v[3]) || 0;
        mapa[data] = (mapa[data] || 0) + valor;
      });

      const dados = [['Data','Faturamento']];
      Object.keys(mapa).sort((a,b)=>{
        const da = a.split('/').reverse().join('');
        const db = b.split('/').reverse().join('');
        return da.localeCompare(db);
      }).forEach(d=>{
        dados.push([d, mapa[d]]);
      });

      return dados;
    }
    function prepararEvolucaoDiariaCaixa(){

      const cache = CacheService.getScriptCache();
      const cacheKey = 'EVOLUCAO_CAIXA_HOJE';

      const cached = cache.get(cacheKey);
      if(cached){
        return JSON.parse(cached);
      }

      const sh = SpreadsheetApp.getActive().getSheetByName('CAIXA');
      if(!sh) return [['Hora','Entradas','Saídas','Saldo']];

      const dados = sh.getDataRange().getValues();

      const agora = new Date();
      const tz = Session.getScriptTimeZone();

      const inicioHoje = new Date(agora);
      inicioHoje.setHours(4,0,0,0); // dia operacional começa 04:00

      const inicioOntem = new Date(inicioHoje);
      inicioOntem.setDate(inicioOntem.getDate() - 1);

      const eventos = [];

      for(let i=1; i<dados.length; i++){

        const data = dados[i][0];
        if(!(data instanceof Date)) continue;

        const ts = data.getTime();

        if(ts < inicioOntem.getTime()) continue;

        const tipo = String(dados[i][1] || '').toUpperCase();
        const valor = Number(dados[i][2]) || 0;
        if(valor <= 0) continue;

        eventos.push({
          hora: Utilities.formatDate(data, tz, 'HH:mm'),
          entrada: tipo === 'ENTRADA' ? valor : null,
          saida:   tipo === 'SAIDA'   ? -valor : null
        });
      }

      eventos.sort((a,b)=> a.hora.localeCompare(b.hora));

      const resultado = [['Hora','Entradas','Saídas','Saldo']];
      let saldo = 0;

      eventos.forEach(e=>{
        if(e.entrada !== null) saldo += e.entrada;
        if(e.saida   !== null) saldo += e.saida;

        resultado.push([
          e.hora,
          e.entrada,
          e.saida,
          saldo
        ]);
      });

      // cache por 1 minuto
      cache.put(cacheKey, JSON.stringify(resultado), 60);

      return resultado;
    }
    function calcularLucroPorPeriodo(){
      const ss = SpreadsheetApp.getActive();
      const vendas = ss.getSheetByName('VENDAS').getDataRange().getValues();
      const produtos = ss.getSheetByName('PRODUTOS').getDataRange().getValues();

      // 🔹 mapa de custo médio por produto
      const custoMap = {};
      produtos.forEach((p,i)=>{
        if(i > 0 && p[0]){
          custoMap[p[0]] = Number(p[6]) || 0; // custo médio
        }
      });

      const mapa = {};

      vendas.forEach((v,i)=>{
        if(i === 0) return;
        if(!(v[0] instanceof Date)) return;

        const data = Utilities.formatDate(
          v[0],
          Session.getScriptTimeZone(),
          'dd/MM/yyyy'
        );

        const produto = v[1];
        const qtd = Number(v[2]) || 0;
        const receita = Number(v[3]) || 0;
        const custoUnit = custoMap[produto] || 0;

        const custoTotal = qtd * custoUnit;

        // lucro confiável
        const lucro = custoUnit > 0
          ? (receita - custoTotal)
          : 0;

        if(!mapa[data]){
          mapa[data] = {
            receita: 0,
            custo: 0,
            lucro: 0,
            margem: 0,
            vendas: 0,
            ticketMedio: 0
          };
        }

        mapa[data].receita += receita;
        mapa[data].custo += custoTotal;
        mapa[data].lucro += lucro;
        mapa[data].vendas += 1;
      });

      // 🔹 calcula margem (%) e ticket médio
      Object.keys(mapa).forEach(d=>{
        const r = mapa[d].receita;
        const l = mapa[d].lucro;
        const v = mapa[d].vendas;

        mapa[d].margem = r > 0 ? (l / r) : 0;
        mapa[d].ticketMedio = v > 0 ? (r / v) : 0;
      });

      return mapa;
    }
    function calcularLucroMensal(){
      const ss = SpreadsheetApp.getActive();
      const vendas = ss.getSheetByName('VENDAS').getDataRange().getValues();
      const produtos = ss.getSheetByName('PRODUTOS').getDataRange().getValues();

      // mapa de custo médio
      const custoMap = {};
      produtos.forEach((p,i)=>{
        if(i>0 && p[0]){
          custoMap[p[0]] = Number(p[6]) || 0;
        }
      });

      const mapa = {};

      vendas.forEach((v,i)=>{
        if(i===0) return;

        const data = new Date(v[0]);
        const mes = Utilities.formatDate(
          data,
          Session.getScriptTimeZone(),
          'MM/yyyy'
        );

        const produto = v[1];
        const qtd = Number(v[2]) || 0;
        const valorVenda = Number(v[3]) || 0;
        const custoUnit = custoMap[produto] || 0;

        const custoTotal = qtd * custoUnit;
        const lucro = valorVenda - custoTotal;

        if(!mapa[mes]){
          mapa[mes] = { receita:0, custo:0, lucro:0 };
        }

        mapa[mes].receita += valorVenda;
        mapa[mes].custo += custoTotal;
        mapa[mes].lucro += lucro;
      });

      return mapa;
    }
  // DASHBOARD (REMOVIDO)
    function removerLegadoDashboard(){

      const ss = SpreadsheetApp.getActive();
      ['DASHBOARD','DASHBOARD_LUCRO'].forEach(nome => {
        const sh = ss.getSheetByName(nome);
        if(sh){
          ss.deleteSheet(sh);
        }
      });

      try {
        const triggers = ScriptApp.getProjectTriggers();
        triggers.forEach(t => {
          const fn = t.getHandlerFunction();
          if(fn === 'atualizarDashboards' || fn === 'atualizarDashboardManual' || fn === 'dashboardGeralLeve'){
            ScriptApp.deleteTrigger(t);
          }
        });
      } catch(e){
        console.warn('Não foi possível remover gatilhos legados de dashboard:', e);
      }
    }
    function atualizarDashboards(){
      removerLegadoDashboard();
      return true;
    }
    function atualizarDashboardManual(){
      removerLegadoDashboard();
      SpreadsheetApp.getActiveSpreadsheet().toast('✅ Dashboard legado removido.', 'Sistema', 3);
      return true;
    }

    function obterResumoEstoqueFinanceiroLeve_(){
      try {
        if(typeof gerarRelatorioEstoqueComValoresLeve === 'function'){
          return gerarRelatorioEstoqueComValoresLeve();
        }

        const estoque = (typeof obterDadosEstoque === 'function') ? obterDadosEstoque() : [];
        const produtos = (typeof obterDadosProdutos === 'function') ? obterDadosProdutos() : {};
        const vendas = (typeof obterDadosVendas === 'function') ? obterDadosVendas() : [];

        const itens = [];
        let totalValorEstoque = 0;
        let totalCustoEstoque = 0;
        let totalVendido = 0;
        let lucroVendido = 0;
        let somaMargens = 0;

        estoque.forEach(linha => {
          const nomeProduto = String(linha[0] || '').trim();
          const qtdAtual = Number(linha[1]) || 0;
          const minimo = Number(linha[2]) || 0;
          const p = produtos[nomeProduto];
          if(!p) return;

          const precoVenda = Number(p.preco) || 0;
          const custMedio = Number(p.custMedio) || 0;
          const margem = Number(p.margem) || 0;

          const valorTotalEstoque = qtdAtual * precoVenda;
          const custTotalEstoque = qtdAtual * custMedio;
          const lucroEstoque = valorTotalEstoque - custTotalEstoque;

          let qtdVendida = 0;
          vendas.forEach(v => {
            const produtoVenda = String(v[1] || '').trim();
            if(produtoVenda === nomeProduto) qtdVendida += Number(v[2]) || 0;
          });

          const valorVendido = qtdVendida * precoVenda;
          const lucroVendaItem = valorVendido - (qtdVendida * custMedio);
          const taxaRotacao = (qtdAtual + qtdVendida) > 0
            ? Math.round((qtdVendida / (qtdAtual + qtdVendida)) * 10000) / 100
            : 0;

          let status = 'Normal';
          if(qtdAtual <= minimo) status = '🚨 Crítico';
          else if(qtdAtual <= minimo * 1.5) status = '⚠️ Baixo';
          else if(qtdAtual > minimo * 3) status = '📈 Alto';

          itens.push({
            produto: nomeProduto,
            categoria: p.categoria || '',
            margem: margem,
            qtdAtual: qtdAtual,
            valorTotalEstoque: valorTotalEstoque,
            custTotalEstoque: custTotalEstoque,
            lucroEstoque: lucroEstoque,
            qtdVendida: qtdVendida,
            valorVendido: valorVendido,
            lucroVendido: lucroVendaItem,
            taxaRotacao: taxaRotacao,
            status: status
          });

          totalValorEstoque += valorTotalEstoque;
          totalCustoEstoque += custTotalEstoque;
          totalVendido += valorVendido;
          lucroVendido += lucroVendaItem;
          somaMargens += margem;
        });

        return {
          itens: itens,
          resumo: {
            totalValorEstoque: totalValorEstoque,
            totalCustoEstoque: totalCustoEstoque,
            lucroEstoque: totalValorEstoque - totalCustoEstoque,
            totalVendido: totalVendido,
            lucroVendido: lucroVendido,
            margemMedia: itens.length ? Math.round((somaMargens / itens.length) * 100) / 100 : 0
          }
        };
      } catch(e){
        console.error('Erro em obterResumoEstoqueFinanceiroLeve_:', e);
        return null;
      }
    }

