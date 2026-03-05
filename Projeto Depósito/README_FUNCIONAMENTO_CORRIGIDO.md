# 📦 KARO PRO v1.0 - MANUAL DE FUNCIONAMENTO CORRIGIDO

## ✅ Status: ESTÁVEL (Versão 1.0 - 2026-02)

---

## 🔧 CORREÇÕES IMPLEMENTADAS

### ✅ Correção #1: Type Coercion em Comparações
**Problema**: Comparações `==` causavam falsos positivos/negativos quando tipos diferiam (string vs number)  
**Solução**: Alteradas para `===` com `Number()` explícito em:
- `baixarEstoqueDelivery()` 
- `cancelarDelivery()`
- `calcularPagamentosComanda()`
- `finalizarDelivery()`
- `cancelarDeliveryPorId()`

### ✅ Correção #2: Busca de Pagamentos Parciais
**Problema**: `.includes(pedido)` não funcionava quando pedido era número  
**Solução**: Converter para `String(pedido)` antes de usar `.includes()`

### ✅ Correção #3: Padronização de Origem em VENDAS
**Problema**: Inconsistência entre `'COMANDA'`, `'COMANDA BALCAO'` e `'DELIVERY'`  
**Solução**: Padronizado para:
- `'COMANDA_BALCAO'` → para comandas de balcão
- `'DELIVERY_PEDIDO'` → para pedidos de delivery

### ✅ Correção #4: Remoção de Função Duplicada
**Problema**: `salvarItensComandaAberta()` era duplicata de `salvarContinuarVendendo()`  
**Solução**: Removida; todos os locais agora chamam `salvarContinuarVendendo()`

### ✅ Correção #5: Comparação de Tipo booleano
**Problema**: Filtro `!i.travado` falhava se travado fosse string  
**Solução**: Alterado para `i.travado === false` em ambos os locais

### ✅ Correção #6: Devolução de Estoque em Cancelamento
**Problema**: Ao cancelar delivery após encaminhado (EM ANDAMENTO), estoque não era devolvido  
**Solução**: Adicionada lógica de reversão `qtdAtual + qtd` na função `cancelarDelivery()`

---

## 📋 GUIA DE FUNCIONAMENTO

### 1️⃣ NOVA COMANDA BALCÃO 🍺

**Acessar**: `Menu → 💶 Comandas → 🍺 Nova Comanda Balcão`

**Fluxo**:
```
1. Seleciona CLIENTE (AutoComplete)
   └─ Cliente fica TRAVADO após 1º item
   
2. Seleciona PRODUTOS e QUANTIDADE
   ├─ Estoque é validado ANTES de adicionar
   └─ Pode adicionar múltiplos itens
   
3. Visualiza carrinho em tempo real
   └─ R$ total atualiza automaticamente
   
4. Escolhe ação:
   ├─ 🟢 Continuar Vendendo
   │  └─ Salva como ABERTA (pode adicionar depois)
   │  └─ Estoque é BAIXADO IMEDIATAMENTE
   │
   └─ 💰🛍️ Finalizar Comanda
      └─ Abre popup de pagamento
```

**Comportamento do Estoque**:
- ✅ Baixado IMEDIATAMENTE ao clicar "Continuar Vendendo"
- ✅ Registrado em aba `COMANDA_ITENS` com `Processado='SIM'`
- ✅ Registrado em aba `VENDAS` com `Origem='COMANDA_BALCAO'`

**Suporte a Fiado**:
- ✅ SIM - Ao finalizar, pode escolher "🧾 Fiado"
- ✅ Cria conta em `CONTAS_A_RECEBER` se não pagar

---

### 2️⃣ COMANDAS ABERTAS 📂

**Acessar**: `Menu → 💶 Comandas → 📂 Comandas Abertas`

**O que vê**:
- Lista de TODAS as comandas com status `ABERTA`
- Card com: #ID, Data, Cliente, Total

**Abrindo uma Comanda Existente**:

```
1. Clica no #ID da comanda
   └─ Abre popup com HISTÓRICO + NOVOS ITENS
   
2. Visualiza itens com status:
   ├─ ✅ Itens HISTÓRICOS (cinza - TRAVADOS)
   │  └─ Campo: travado=true
   │  └─ Não pode remover
   │
   └─ 🆕 Itens NOVOS (colorido - DESTRAVÁVEIS)
      └─ Campo: travado=false
      └─ Pode remover com botão ❌
      
3. Calcula saldo:
   ├─ Total consumido = SUM(COMANDA_ITENS para este pedido)
   ├─ Total pago = SUM(CAIXA onde origem contém pedido#)
   └─ Saldo = Total - Pago
   
4. Escolhe ação:
   ├─ 💵 Pagamento Parcial
   │  ├─ Registra em CAIXA
   │  ├─ Atualiza saldo em tempo real
   │  └─ Se saldo = 0 → popup quitado
   │
   ├─ 🟢 Continuar Vendendo
   │  ├─ Salva itens NOVOS em COMANDA_ITENS
   │  ├─ Marca como travado=true (agora são histórico)
   │  ├─ Baixa estoque IMEDIATAMENTE
   │  └─ Fecha popup
   │
   └─ 💰🛍️ Finalizar Comanda
      ├─ Se há itens NOVOS: salva primeiro
      └─ Abre popup de fechamento
```

**Funcionamento de Saldo**:
- Total Consumido: Não muda durante sessão (histórico imutável)
- Saldo Atual: Recalculado a cada ação (descontando pagamentos parciais)
- Se saldo < 0: Sistema bloqueia com erro

**Validações**:
- ✅ Estoque validado cada vez que adiciona novo item
- ✅ Cliente não pode ser alterado (travado no ato da criação)
- ✅ Não permite salvar se estoque insuficiente

---

### 3️⃣ DELIVERY 🚚

**Acessar**: `Menu → 🚚 Delivery → 🚚 Novo Delivery`

**Fluxo**:
```
1. Seleciona CLIENTE
   └─ Campo obrigatório
   
2. Seleciona PRODUTOS e QUANTIDADE
   ├─ Estoque é VALIDADO mas NÃO BAIXADO AINDA
   └─ Pode adicionar múltiplos itens
   
3. Insere ENTREGADOR
   └─ Campo obrigatório
   
4. Escolhe FORMA DE PAGAMENTO
   ├─ ⚡ Pix
   ├─ 💵 Dinheiro
   ├─ 💳 Cartão Débito
   ├─ 💳 Cartão Crédito
   └─ ❌ 🧾 Fiado (BLOQUEADO - não permitido)
   
5. Clica 📦 Fazer Pedido
   └─ Status inicial: PEDIDO FEITO
```

**Ciclo de Vida do Delivery**:

| Status | Ação Possível | Estoque | CAIXA |
|--------|---|---|---|
| PEDIDO FEITO | ➡️ Encaminhar ou ❌ Cancelar | Não baixado | - |
| EM ANDAMENTO | ✅ Entregar ou ❌ Cancelar | ✅ Baixado AQUI | ✅ Registrado |
| ENTREGUE | Apenas visualizar | - | - |
| CANCELADO | Apenas visualizar | ✅ Devolvido | ✅ Removido |

**Estoque - Behavioral Diferenciado**:
- ⏳ **Estado PEDIDO FEITO**: Estoque NÃO é baixado
  - Permite cancelamento "sem custo"
  - Pode ser usado para simular pedidos
  
- ✅ **Estado EM ANDAMENTO**: Estoque é BAIXADO
  - Função: `baixarEstoqueDelivery()` é acionada
  - Registra em `DELIVERY_ITENS` com `EstoqueBaixado='SIM'`
  - Insere em `VENDAS` com `Origem='DELIVERY_PEDIDO'`
  - Cria lançamento em `CAIXA`
  
- ❌ **Cancelamento após EM ANDAMENTO**: Estoque é DEVOLVIDO
  - Reverte `EstoqueBaixado` de `'SIM'` para `'CANCELADO'`
  - Remove de `VENDAS`
  - Remove de `CAIXA`
  - **NOVO**: Adiciona qty de volta à aba `ESTOQUE`

**Operações no Painel de Delivery**:

| Ação | Condição | Resultado |
|------|----------|-----------|
| ➡️ Encaminhar | Status = PEDIDO FEITO | Muda para EM ANDAMENTO + baixa estoque + registra CAIXA |
| ✅ Entregar | Status = EM ANDAMENTO | Muda para ENTREGUE |
| ❌ Cancelar | Qualquer status | Muda para CANCELADO + devolve estoque (se EM ANDAMENTO) |

---

## 🛡️ Validações e Proteções

### Validação de Estoque
```javascript
// Ocorre ANTES de qualquer consumo
validarEstoqueCarrinho(carrinho)
  └─ Compara com mapa atual de ESTOQUE
  └─ Se insuficiente → lança Error
  └─ Impede continuidade
```

### Lock Mechanism (Concorrência)
```javascript
const lock = LockService.getScriptLock();
lock.waitLock(3000);  // Aguarda até 3 seg
try {
  // operações críticas
} finally {
  lock.releaseLock();  // SEMPRE libera
}
```

### Anti-Duplo-Clique
- Botões desabilitados durante processamento
- Texto muda para "⏳ Processando..."
- Reabilitados apenas após sucesso

### Validação de Fiado
- **Comanda**: Permite fiado se cliente existir (valida em `CLIENTES`)
- **Delivery**: Bloqueia fiado completamente
  - Se usuário tentar forçar, sistema rejeita
  - Mensagem: "Fiado não permitido para Delivery"

---

## 📊 Estrutura de Dados

### Abas Principais (Após Operações)

#### COMANDAS
```
Pedido | Data | Cliente | Origem | Status
1      | ... | JOÃO    | BALCAO | ABERTA
2      | ... | MARIA   | BALCAO | FECHADA
```

#### COMANDA_ITENS
```
Pedido | Produto | Qtd | Valor Unit | Total | Processado
1      | Cerveja | 2   | 25         | 50    | SIM
1      | Refrig  | 1   | 8          | 8     | SIM
```

#### DELIVERY
```
Pedido | Data | Cliente | Produto | Qtd | Total | Pagamento | Status | Entregador
5      | ...  | CARLOS  | VER IT  | 3   | 150   | Pix       | PEDIDO FEITO | JOÃO
6      | ...  | ANA     | VER IT  | 2   | 80    | Dinheiro  | EM ANDAMENTO | PEDRO
```

#### DELIVERY_ITENS
```
Pedido | Produto | Qtd | Valor Unit | Total | EstoqueBaixado
5      | Cerveja | 3   | 25         | 75    | NAO
5      | Água    | 2   | 15         | 30    | NAO
6      | Cerveja | 2   | 25         | 50    | SIM
```

#### VENDAS (Após Finalização)
```
Data | Produto | Qtd | Valor | Pagamento | Origem | ID_VENDA
...  | Cerveja | 2   | 50    | Dinheiro  | COMANDA_BALCAO | C-000001
...  | Cerveja | 3   | 75    | Pix       | DELIVERY_PEDIDO | D-000005
```

#### CAIXA
```
Data | Tipo | Valor | Pagamento | Origem
...  | Ent  | 50    | Dinheiro  | COMANDA C-000001 (FECHAMENTO)
...  | Ent  | 75    | Pix       | DELIVERY D-000005
...  | Ent  | 20    | Dinheiro  | COMANDA #1 (PARCIAL)
```

#### CONTAS_A_RECEBER
```
ID | Origem | Pedido | Cliente | Valor | Forma | Status
1  | COMANDA | 1    | JOÃO    | 30    | FIADO | PENDENTE
```

---

## 🚨 Comportamentos Esperados (Após Correções)

### ✅ Comanda Balcão
- [x] Estoque baixa IMEDIATAMENTE
- [x] Cliente fica travado após 1º item
- [x] Pode continuar vendendo depois
- [x] Pagamento parcial funciona corretamente
- [x] Fiado registra em CONTAS_A_RECEBER
- [x] Saldo nunca fica negativo

### ✅ Comanda Aberta
- [x] Itens históricos aparecem travados (cinza)
- [x] Itens novos podem ser removidos (coloridos)
- [x] Saldo calcula corretamente = total - pago
- [x] Pagamento parcial atualiza saldo em tempo real
- [x] Continuar vendendo falha se estoque insuficiente
- [x] Estoque validado ANTES de cada operação

### ✅ Delivery
- [x] Estoque NÃO baixa ao criar (PEDIDO FEITO)
- [x] Estoque BAIXA ao encaminhar (EM ANDAMENTO)
- [x] Entregador é campo obrigatório
- [x] Fiado é BLOQUEADO (não permitido)
- [x] Cancelamento devolve estoque se foi encaminhado
- [x] ID_VENDA padronizado (D-000001)

---

## 🐛 Troubleshooting

### Problema: Estoque fica inconsistente
**Causa Provável**: Cancelamento de delivery não devolveu estoque  
**Solução**: ✅ Agora corrigido na v1.0 - devolução automática

### Problema: Saldo fica negativo em comanda
**Causa Provável**: Type coercion em cálculos  
**Solução**: ✅ Corrigido com `Number()` explícito

### Problema: Pagamento parcial não é encontrado
**Causa Provável**: `.includes()` falhando com número  
**Solução**: ✅ Convertido para `String(pedido)`

### Problema: Itens novos não salvam em comanda aberta
**Causa Provável**: Filtro `!i.travado` falhando  
**Solução**: ✅ Alterado para `i.travado === false`

---

## 📝 Notas Importantes

1. **🔐 Segurança**: Sistema usa `LockService` para evitar race conditions
2. **💾 Persistência**: `SpreadsheetApp.flush()` garante salvamento
3. **🔔 Feedback**: Popup de erro mostra mensagem clara ao usuário
4. **📊 Rastreabilidade**: Cada venda tem ID único (C-XXXXXX ou D-XXXXXX)
5. **🧮 Cálculos**: Todos os valores numéricos convertidos com `Number()`

---

## ✨ Versão 1.0 - Release Notes

✅ Correções de Type Coercion
✅ Devolução de Estoque em Cancelamento
✅ Padronização de Origem em VENDAS
✅ Remoção de Função Duplicada
✅ Melhorada Comparação de Booleano
✅ Todos os casos de uso testados

---

**Última atualização**: Março 2026  
**Status**: ✅ ESTÁVEL - Pronto para Produção
