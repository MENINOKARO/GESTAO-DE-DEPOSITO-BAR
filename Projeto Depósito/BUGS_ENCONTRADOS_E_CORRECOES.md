# 🔴 BUGS ENCONTRADOS NO SISTEMA DE COMANDAS E DELIVERY

## Status: ÀS CORRIGIR

---

## BUG #1: 🔴 Comparações Inconsistentes de Tipo (Type Coercion)

### Problema
Há comparações usando `==` (loose equality) em vez de `===` (strict equality) em várias funções críticas:

- **Linha 3603**: `if(dados[i][0] == pedido)` - Pode não encontrar se houver mismatch de tipo
- **Linha 3651**: `if(i>0 && p[0] == pedido)` - Em `baixarEstoqueDelivery`
- **Linha 3659**: `if(it[0] == pedido && it[5] !== 'SIM')` - Comparação mista
- **Linha 3714**: `if(sh[i][0] == pedido)` - Em `finalizarDelivery`
- **Linha 3765**: `if(delDados[i][0] == pedido)` - Em `cancelarDelivery`
- **Linha 3845**: `if(i>0 && d[0] == pedido)` - Em outra função

### Impacto
❌ Se o número de pedido vem como string "000001" e na planilha está como número 1, as comparações falham silenciosamente

### Solução
✅ Usar `===` com `Number()` explícito ou garantir que ambos sejam do mesmo tipo

---

## BUG #2: 🔴 Busca de Pagamentos Parciais Quebrada

### Código Problemático
```javascript
// Linha ~4806-4818 (calcularPagamentosComanda)
cx.forEach((c,i)=>{
  if(i===0) return;
  if(
    typeof c[4] === 'string' &&
    c[4] && c[4].includes(pedido)  // ❌ includes() é string; pedido pode ser número
  ){
    pago += Number(c[2]) || 0;
  }
});
```

### Problema
- Se `pedido` = `1` (número) e `c[4]` = `"COMANDA #000001 (PARCIAL)"` (string), `.includes()` vai procurar por "1" dentro da string
- Pode encontrar "1" em "000001" (falso positivo) ou não encontrar se o número for diferente

### Impacto
❌ Cálculo de saldo da comanda pode estar incorreto, afetando pagamentos parciais

### Solução
✅ Converter `pedido` to string antes de .includes(): `c[4].includes(String(pedido))`

---

## BUG #3: 🔴 Inconsistência no Registro de Origem em VENDAS

### Problema
A origem está sendo registrada de formas diferentes:
- Comanda: `'COMANDA'` (linha 5257)
- Comanda (em outras funções): `'COMANDA BALCAO'`
- Delivery: `'DELIVERY'` (linha 3676)

### Impacto
❌ Filtros e relatórios que procuram por `origem='COMANDA'` vão perder registros que estão como `'COMANDA BALCAO'`

### Solução
✅ Padronizar sempre para `'COMANDA'` ou `'COMANDA_BALCAO'` (com underscore)

---

## BUG #4: 🔴 Função `salvarItensComandaAberta` Duplicada

### Problema
Há duas funções muito similares:
- `salvarContinuarVendendo()` (linha 4661)
- `salvarItensComandaAberta()` (linha 4715)

Ambas fazem EXATAMENTE a mesma coisa. No popup, a função `abrirParcial()` chama `salvarItensComandaAberta` mas deveria chamar `salvarContinuarVendendo`.

### Impacto
❌ Confusão no código, possível desincronização se uma for atualizada e a outra não

### Solução
✅ Remover `salvarItensComandaAberta()` e usar apenas `salvarContinuarVendendo()`

---

## BUG #5: 🔴 Comparação de `travado` Quebrada por Tipo

### Código
```javascript
// Linha ~4461 em popupComandaExistente
carrinho[idx].qtd += delta;
if(carrinho[idx].qtd <= 0){
  carrinho.splice(idx, 1);
}

// Linha ~4472
const novos = carrinho.filter(i => !i.travado);
```

### Problema
Se `i.travado` for string `"false"` em vez de boolean `false`, o filtro `!i.travado` falha
- `!"false"` = `false` (problema!)
- `!false` = `true` (correto)

### Impacto
❌ Itens novos podem não ser salvos quando há pagamento parcial

### Solução
✅ Usar `i.travado === false` em vez de `!i.travado`

---

## BUG #6: 🔴 Sem Sincronização de Tipo em `baixarEstoqueDelivery`

### Código (Linha 3659)
```javascript
if(it[0] == pedido && it[5] !== 'SIM'){
```

### Problema
Mistura `==` com `!==`. Deveria ser:
```javascript
if(Number(it[0]) === Number(pedido) && it[5] !== 'SIM')
```

### Impacto
❌ Estoque pode não ser baixado se houver mismatch de tipo

### Solução
✅ Usar `===` com `Number()` explícito

---

## BUG #7: 🔴 Falta de Tratamento de Erro em `getPrecoProduto`

### Problema
Várias funções chamam `getPrecoProduto()` mas se o produto não existir, retorna `undefined`

### Impacto
⚠️ Campo de valor fica vazio ou mostra NaN

### Solução
✅ Adicionar validação: se produto não encontrado, retornar 0 ou erro

---

## BUG #8: 🔴 `cancelarDelivery` Sem Compensação de Estoque

### Código (Linha ~3760)
```javascript
function cancelarDelivery(pedido){
  // ... marca como CANCELADO
  // MAS NÃO DEVOLVE O ESTOQUE!
}
```

### Problema
Se delivery foi encaminhado (EM ANDAMENTO), estoque já foi baixado. Ao cancelar, precisa DEVOLVER o estoque.

### Impacto
❌ Estoque fica inconsistente - produtos desaparecem quando não deveriam

### Solução
✅ Adicionar função que reverte `EstoqueBaixado='SIM'` para `'NAO'` e re-calcula estoque

---

## BUG #9: 🔴 `validarEstoqueCarrinho` Sem Tratamento Explícito

### Problema
Se a validação falha, a função lança `Error()` mas não há garantia de que todos os caminhos têm try/catch

### Impacto
⚠️ Erros podem quebrar o popup sem feedback claro ao usuário

### Solução
✅ Garantir que todas as APIs do Google Apps Script têm try/catch

---

## BUG #10: 🔴 Sem Flush Explícito Após Operações em Batch

### Código
```javascript
itens.forEach(i=>{
  itensSh.appendRow([...]);  // 1 request por item 🔥
});
atualizarEstoque();          // Outro batch
```

### Problema
Cada `appendRow()` é uma requisição separada, muito lento e pode falhar parcialmente

### Impacto
⚠️ Performance ruim, possível inconsistência se falhar no meio

### Solução
✅ Usar `getRangeList()` ou `insert` único com múltiplas linhas

---

## Resumo de Correções Necessárias

| Bug | Severidade | Local | Correção |
|-----|-----------|-------|----------|
| Type Coercion | 🔴 Alto | 6 linhas | Usar `Number(x) === Number(y)` |
| includes() quebrada | 🔴 Alto | 1 linha | Converter para string |
| Origem inconsistente | 🟠 Médio | 2-3 linhas | Padronizar para 'COMANDA' |
| Função duplicada | 🟠 Médio | 1 função | Remover `salvarItensComandaAberta` |
| travado tipo | 🔴 Alto | 2 linhas | Usar `=== false` |
| Sem compensação estoque | 🔴 Alto | `cancelarDelivery` | Adicionar reversão |
| Tratamento erro | 🟡 Baixo | Vários | Melhorar feedback |
| Batch operations | 🟠 Médio | Vários | Usar insert em batch |

---

## Próximos Passos

1. ✅ Corrigir todas as comparações de tipo
2. ✅ Remover função duplicada  
3. ✅ Adicionar compensação de estoque em cancelamento
4. ✅ Padronizar origem em VENDAS
5. ✅ Melhorar tratamento de erro
6. ✅ Atualizar README com instruções corretas
