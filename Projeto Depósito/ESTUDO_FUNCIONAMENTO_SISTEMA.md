# 📊 ESTUDO: Funcionamento do Sistema de Gestão de Depósito

## Status: ✅ ESTÁVEL - Versão 1.0 (2026-02)

---

## 📱 VISÃO GERAL

O arquivo **"datasheet para verificação"** é na verdade um arquivo Google Apps Script (.gs) que contém a COLA ESTRUTURAL do sistema. Este documento analisa as 3 funcionalidades principais:

1. **🍺 COMANDA BALCÃO (Nova comanda)**
2. **📂 COMANDAS ABERTAS (Comandas da comanda existentes)**
3. **🚚 DELIVERY (Novo pedido de entrega)**

---

## 1️⃣ COMANDA BALCÃO - "Nova Comanda" 🍺

### Fluxo de Entrada
```
Menu Principal 
   ↓
💶 Comandas → 🍺 Nova Comanda Balcão
   ↓
popupComandaBalcao() função é acionada
```

### Arquitetura da Função

#### **A. Inicialização: `popupComandaBalcao()`** (linha 4009)

**O que faz:**
- Cria um POPUP HTML interativo (modal dialog)
- Carrega lista de CLIENTES da aba CLIENTES
- Carrega lista de PRODUTOS COM ESTOQUE da aba ESTOQUE (apenas produtos com qtd > 0)
- Apresenta Interface para montar O CARRINHO

**Estrutura visual:**
```
┌─────────────────────────────┐
│ 🏪 Nome do Depósito         │ (título dinâmico)
├─────────────────────────────┤
│                             │
│  👤 CLIENTE:     [Seletor]  │ (AutoComplete com CLIENTES)
│  👤➕ [Botão novo cliente]  │
│                             │
│  🍺 PRODUTO:     [Dropdown] │ (Toda ESTOQUE > 0)
│  🔢 QUANTIDADE:  [+] [qtd]  │ (controle de quantidade)
│  💰 VALOR:       [R$ xxx]   │ (preço calculado auto)
│                             │
│  ➕ [Adicionar Item]        │
│                             │
├─────── 🛒 CARRINHO ─────────┤
│                             │
│  • Produto A ... R$ 100,00  │ (com botões +, -, ❌)
│  • Produto B ... R$ 200,00  │
│                             │
│  💵 Total: R$ 300,00        │
│                             │
├─────────────────────────────┤
│ 🟢 [Continuar Vendendo]     │
│ 💰 [Finalizar Comanda]      │
│ ❌ [Cancelar]               │
└─────────────────────────────┘
```

#### **B. Lógica de Adição ao Carrinho**

**JavaScript no popup:**
- Quando usuário clica em **"➕ Adicionar Item"**:
  1. Valida se cliente foi selecionado ❗
  2. Valida se produto foi selecionado ✓
  3. Valida se quantidade > 0 ✓
  4. **TRAVA o cliente** (não pode mudar cliente após 1º item)
  5. Adiciona ou soma à quantidade se produto já existe
  6. RE-RENDERIZA a lista visual

**Anti-duplo clique:** Botão desabilitado durante processamento

#### **C. Estados da Comanda**

| Ação | Função | Status | Resultado |
|------|--------|--------|-----------|
| 🟢 Continuar Vendendo | `salvarComandaBalcao(..., 'ABERTA')` | ABERTA | Salva e deixa comanda aberta |
| 💰 Finalizar Comanda | `salvarComandaBalcao(..., 'FECHADA')` | FECHADA | Vai para popup de fechamento |

### Backend: `salvarComandaBalcao(cliente, itens, status)` (linha ~4400)

```javascript
FLUXO EXECUTIVO:
1. 🔒 LOCK: Usa LockService para evitar race conditions
2. 📋 VALIDAÇÃO: Chama validarEstoqueCarrinho()
3. 🆔 GERAÇÃO: Cria número de comanda (gerarNumeroComanda())
4. 💾 REGISTRO COMANDA:
   - Abre/cria aba COMANDAS
   - Append row: [Pedido, Data, Cliente, 'BALCAO', Status]
5. 📦 REGISTRO ITENS:
   - Abre/cria aba COMANDA_ITENS
   - Para cada item: append row com [Pedido, Produto, Qtd, ValorUnit, Total, 'SIM']
6. 🔻 BAIXA ESTOQUE:
   - Chama baixarEstoquePorComanda() para cada produto
7. 📊 ATUALIZA GERAL:
   - atualizarEstoque() recalcula status de estoque
8. 📝 REGISTRA LOG: evento do sistema
9. LIBERA LOCK
```

### 🔄 Ciclo de Dados

```
CLIENTES (Aba)
├─ Nome, Telefone, Endereço...
└─ → Carregado no AutoComplete do popup

PRODUTOS (Aba)
├─ Produto, Categoria, Preço [col 5]...
└─ → Carregado como dropdown (via getPrecoProduto())

ESTOQUE (Aba)
├─ Produto, Quantidade [col 2], Mínimo...
└─ → Validado e BAIXADO quando item adicionado

COMANDA_ITENS (Aba - criada se não existe)
├─ Pedido, Produto, Qtd, Valor Unit, Total, 'SIM'
└─ → Gerada quando comanda é salva

VENDAS (Aba) ← ✅ APENAS se FECHADA
├─ Data, Produto, Qtd, Valor, Pagamento, 'COMANDA', ID_VENDA
└─ → Inserida apenas ao FECHAR comanda

CAIXA (Aba) ← ✅ APENAS se FECHADA
├─ Data, Tipo='Entrada', Valor, Pagamento, "COMANDA #X"
└─ → Inserida apenas ao FECHAR comanda (se pagto ≠ FIADO)

CONTAS_A_RECEBER ← ✅ APENAS se FIADO
├─ ID, Origem='COMANDA', Pedido, Cliente, Valor, Forma='FIADO'
└─ → Inserida apenas ao FECHAR comanda (se pagto = FIADO)
```

---

## 2️⃣ COMANDAS ABERTAS - "Gerenciar Comanda Existente" 📂

### Fluxo de Entrada
```
Menu Principal 
   ↓
💶 Comandas → 📂 Comandas Abertas
   ↓
listarComandasAbertas() função é acionada
```

### Dois Caminhos Possíveis

#### **Caminho A: Selecionar Comanda Aberta**

O sistema **lista TODAS as comandas com status ABERTA** em uma tabela/grid:

```
┌──────────────────────────────┐
│ 📂 COMANDAS ABERTAS          │
├────┬──────┬───────┬─────────┤
│ ID │ DATA │CLIENTE│ TOTAL   │
├────┼──────┼───────┼─────────┤
│ 1  │12:30 │JOÃO   │R$ 150   │ ← clicável
│ 2  │14:00 │MARIA  │R$ 300   │ ← clicável
└────┴──────┴───────┴─────────┘
```

Ao clicar em uma comanda:
```
listarComandasAbertas()
   ↓ (usuário clica na comanda #1)
popupComandaExistente(1)
```

#### **Caminho B: HOME Dashboard**

Na HOME, existe um CARD clicável que dispara:
```javascript
onSelectionChange(e)
  ↓ (se clicou na área Comandas - linhas 4-6, colunas 5-6)
listarComandasAbertas()
```

### `popupComandaExistente(pedido)` - Interface Detalhada

**O que CARREGA:**
1. **Itens já consumidos** (da aba COMANDA_ITENS com Processado='SIM')
   - Estes itens ficam **TRAVADOS** (não podem ser removidos, apenas visualizados)
2. **Permite NOVOS itens** (não travados, podem ser adicionados/removidos)
3. **Calcula saldo** em tempo real

**Interface Visual:**
```
┌──────────────────────────────────┐
│ 🧾 Comanda #000001              │
│ 👤 JOÃO SILVA                    │
├──────────────────────────────────┤
│                                  │
│ PRODUTO:    [Dropdown]           │
│ UNITÁRIO:   [R$ calculado]       │
│ ➕ [Adicionar Produto]           │
│                                  │
├────── ITENS DA COMANDA ──────────┤
│                                  │
│ ✅ Cerveja 600ml x2 = R$ 50     │ (TRAVADO - histórico)
│ ✅ Refrigerante x1 = R$ 8       │ (TRAVADO - histórico)
│ 🆕 Água x1 = R$ 5               │ (NOVO - pode remover)
│                                  │
├──────────────────────────────────┤
│ 📊 Total Consumido: R$ 63        │
│ ⚖️ Saldo Atual: R$ 63           │
│                                  │
├──────────────────────────────────┤
│ 💵 [Pagamento Parcial]           │
│ 🟢 [Continuar Vendendo]          │
│ 💰🛍️ [Finalizar Comanda]         │
│ ❌ [Cancelar]                    │
└──────────────────────────────────┘
```

### 3 Funções Principais de Comanda Aberta

#### **1. `salvarContinuarVendendo(pedido, carrinho)`**

```
AÇÃO: Usuário clica em 🟢 Continuar Vendendo
      (ou em 💵 Pagamento Parcial → Voltar)

FLUXO:
1. Filtra apenas ITENS NOVOS (travado === false)
2. Para cada novo item:
   ✓ Valida estoque disponível
   ✓ Append em COMANDA_ITENS com Processado='SIM'
   ✓ Baixa estoque via baixarEstoquePorComanda()
   ✓ Marca item como travado=true (histórico agora)
3. Atualiza estoque geral
4. FECHA O POPUP (volta à HOME ou lista)
```

#### **2. `registrarPagamentoParcialComanda(pedido, valor, pagamento)`**

```
AÇÃO: Usuário clica em 💵 Pagamento Parcial

FLUXO:
1. Calcula saldo atual da comanda:
   saldo = Total - (Pagamentos já registrados no CAIXA)
2. Valida se valor ≤ saldo
3. Insere linha no TOPO da aba CAIXA:
   [Data, 'Entrada', valor, pagamento, 'COMANDA #X (PARCIAL)']
4. Recalcula saldo pós-pagamento
5. Se saldo = 0 (comanda quitada):
   → Retorna quitado=true
   → Abre popup de confirmação de fechamento
6. Se saldo > 0:
   → Atualiza display do saldo
   → Deixa comanda aberta
```

#### **3. `fecharComandaBalcaoFinal(pedido, formaPgto)`**

```
AÇÃO: Usuário clica em 💰🛍️ Finalizar Comanda

FLUXO (COMPLEXO):
1. 🔒 VALIDAÇÃO PRÉVIA:
   ├─ Se FIADO → valida cliente existente
   └─ Chama validarClienteFiado()

2. 📊 CÁLCULO TOTAL:
   ├─ Sum de COMANDA_ITENS.Total para este pedido
   └─ Busca pagamentos parciais no CAIXA

3. 💾 REGISTRA VENDAS:
   ├─ Para cada item da comanda:
   │  ├─ Append em VENDAS com:
   │  │  [Data, Produto, Qtd, Total, Pagamento, 'COMANDA', ID_VENDA]
   │  └─ Gera ID único: 'C-000001'
   
4. 💰 ESTRATÉGIA FINANCEIRA:
   ├─ Se FIADO:
   │  ├─ Cria conta em CONTAS_A_RECEBER
   │  └─ Saldo fica aberto até quitação
   │
   └─ Se NÃO FIADO:
      ├─ Insere em CAIXA:
      │  [Data, 'Entrada', SaldoFinal, Pagamento, 'COMANDA #X']
      │  (APENAS o saldo não pago antes)
      └─ Se pago anteriormente, ajusta valor

5. ✅ MARCA FECHADA:
   └─ Atualiza aba COMANDAS: Status='FECHADA'

6. 📝 LOG:
   └─ Registra evento COMANDA_FECHADA
```

### 🔄 Estados de Comanda Aberta

```
Estado         Processado  Travado   Ação Possível
────────────────────────────────────────────────
HISTÓRICO      'SIM'       true      Apenas visualizar
NOVO/ADIÇÃO    'SIM'       false     Remover ou aguardar
PAGO PARCIAL   'SIM'       true      Visualizar saldo
QUITADA        'SIM'       -         Fechar
FECHADA        'SIM'       -         Nenhuma (read-only)
```

---

## 3️⃣ DELIVERY - "Novo Delivery" 🚚

### Fluxo de Entrada
```
Menu Principal 
   ↓
🚚 Delivery → 🚚 Novo Delivery
   ↓
popupDelivery() função é acionada
```

### Interface Principal

```
┌──────────────────────────┐
│ 🚚 Novo Pedido Delivery  │
├──────────────────────────┤
│                          │
│ 👤 CLIENTE:  [AutoComp] │
│ 👤➕ [Novo]             │
│                          │
│ 🍺 PRODUTO:  [Dropdown] │
│ 🔢 QTD:      [número]   │
│ 💰 UNITÁRIO: [R$ xxx]   │
│ ➕ [Adicionar]          │
│                          │
├─── 🛒 CARRINHO DELIVERY ───┤
│                          │
│ • Item 1 ... R$ 100     │
│ • Item 2 ... R$ 150     │
│                          │
│ 💵 Total: R$ 250        │
│                          │
├──────────────────────────┤
│ 🛵 ENTREGADOR: [campo]  │
│ 💳 PAGAMENTO: [opções]  │
│ 📦 [Fazer Pedido]       │
│ ❌ [Cancelar]           │
└──────────────────────────┘
```

### Backend: `salvarDeliveryCarrinho(cliente, itens, pagamento, entregador)` (linha ~4600)

```javascript
SEQUENCE:
1. VALIDAÇÃO:
   ├─ validarEstoqueCarrinho(itens) → checa disponibilidade
   ├─ Se FIADO → validarClienteFiado(cliente)
   
2. ESTRUTURA DE DADOS:
   ├─ Garante aba DELIVERY_ITENS existe
   └─ Gera número de pedido: gerarNumeroDelivery()

3. REGISTRO DA ENTREGA:
   └─ Append em DELIVERY:
      [Pedido, Data, Cliente, 'VER ITENS', Qtd_Itens, 
       Total, Pagamento, 'PEDIDO FEITO', Entregador, '']

4. REGISTRO DOS ITENS:
   └─ Para cada item:
      Append em DELIVERY_ITENS:
      [Pedido, Produto, Qtd, ValorUnit, Total, 'NAO']
      
   ⚠️ NOTA: EstoqueBaixado = 'NAO'
   (estoque só baixa quando encaminhar o pedido!)

5. LOG:
   └─ Registra novo pedido
```

### 🔄 Estados do Delivery

| Estado | Ação | Trigger | Resultado |
|--------|------|---------|-----------|
| **PEDIDO FEITO** | Visualizar/Encaminhar/Cancelar | Criação | Aguarda ação |
| **EM ANDAMENTO** | Visualizar/Entregar/Cancelar | Encaminhar | Estoque baixado ✓ |
| **ENTREGUE** | Visualizar/Cancelar | Confir. entrega | Finalizado ✓ |
| **CANCELADO** | Visualizar | Cancelamento | Estoque devolvido ✓ |

### Transições de Estado

```
┌─────────────┐
│ PEDIDO FEITO│
│             │
│  🚚 Botões  │
│  ➡️ Encaminh│
│  ❌ Cancela │
└─────┬───────┘
      │
      │ baixarEstoqueDelivery()
      │ ├─ Busca itens não processados
      │ ├─ Baixa estoque
      │ ├─ Registra em VENDAS
      │ ├─ Registra CAIXA ou CONTAS_A_RECEBER
      │ └─ Marca cada item com EstoqueBaixado='SIM'
      ↓
┌─────────────┐
│EM ANDAMENTO │
│             │
│  🚚 Botões  │
│  ✅ Entreg  │
│  ❌ Cancela │
└─────┬───────┘
      │
      │ finalizarDelivery()
      │ └─ Apenas marca como ENTREGUE
      ↓
┌─────────────┐
│  ENTREGUE   │
│             │
│  Finalizado │
└─────────────┘
```

### Fluxo Financeiro do Delivery

```
PAGAMENTO NORMAL (Pix/Dinheiro/Cartão):
  1. registrarCaixa()
  2. Insere em CAIXA:
     [Data, 'Entrada', Total, Pagamento, 'DELIVERY #NNNNN']

FIADO:
  1. criarContaAReceber()
  2. Insere em CONTAS_A_RECEBER:
     [ID='D-000001', Origem='DELIVERY', Pedido, Cliente,
      Valor, Forma='FIADO', Status='PENDENTE']
```

### ID Gerado

```javascript
gerarIdVendaDelivery(pedido)
  → Exemplo: Pedido=5 
  → Retorna: 'D-000005' (D = Delivery)
```

---

## 🔗 ESTRUTURA DE RELACIONAMENTO

```
┌─────────────┐
│  CLIENTES   │  (Aba base de clientes)
└─────┬───────┘
      │
      ├─→ COMANDA_BALCAO (popup)
      │   ├─→ COMANDAS (Aba)
      │   ├─→ COMANDA_ITENS (Aba)
      │   └─→ VENDAS (Aba - se fechada)
      │
      └─→ DELIVERY (popup)
          ├─→ DELIVERY (Aba)
          ├─→ DELIVERY_ITENS (Aba)
          └─→ VENDAS (Aba - se encaminhado)

TABELAS TRANSVERSAIS:
├─ ESTOQUE (consumida por todas - validation & lowering)
├─ PRODUTOS (lista de preços para todos)
├─ CAIXA (registra entradas de pagto)
└─ CONTAS_A_RECEBER (registra débitos-fiado)
```

---

## 🔐 Mecanismos de Segurança

### 1. **LockService (Comanda)**
```javascript
lock.waitLock(3000)  // Aguarda até 3 segundos
try {
  // operações críticas
} finally {
  lock.releaseLock()  // sempre libera
}
```
**Por quê?** Evitar race conditions se 2 usuários abrissem comanda simultânea

### 2. **Validação de Estoque**
```javascript
validarEstoqueCarrinho(carrinho)
  ├─ Mapeia estoque ATUAL
  ├─ Compara com pedido
  └─ Lança erro se insuficiente
```

### 3. **Travamento de Campos**
```javascript
// Cliente fica TRAVADO após 1º item
clienteTravado = true
cliente.disabled = true  // no HTML
```

### 4. **Anti-Duplo-Clique**
```javascript
btn.disabled = true
btn.innerText = '⏳ Processando...'
// ... após sucesso ...
btn.disabled = false  // (em failure handler também)
```

### 5. **Marca de Processamento**
```javascript
Processado='SIM'  // marca item como "já consumido"
Processado='NAO'  // marca item como "ainda não baixado"
```

---

## 📊 Fluxo de Dados: Resumo Visual

```
NOVO PEDIDO
  ↓
┌─────────────────────────────────┐
│ 1. COLETA DADOS                 │
│    Cliente + Produtos/Qtd       │
└────────┬────────────────────────┘
         ↓
┌─────────────────────────────────┐
│ 2. VALIDAÇÃO                    │
│    • Estoque?                   │
│    • Cliente (se FIADO)?        │
│    • Quantidade > 0?            │
└────────┬────────────────────────┘
         ↓
┌─────────────────────────────────┐
│ 3. BAIXA ESTOQUE                │
│    ESTOQUE:Qtd -= pedido        │
└────────┬────────────────────────┘
         ↓
┌─────────────────────────────────┐
│ 4. REGISTRA VENDAS              │
│    VENDAS: append novo registro │
└────────┬────────────────────────┘
         ↓
┌─────────────────────────────────┐
│ 5. FINANCEIRO                   │
│    CAIXA ou CONTAS_A_RECEBER    │
└────────┬────────────────────────┘
         ↓
┌─────────────────────────────────┐
│ 6. CLOSE POPUP                  │
│    ✅ Sucesso!                  │
└─────────────────────────────────┘
```

---

## 🎯 PONTOS-CHAVE DE ENTENDIMENTO

### ✅ O que funciona bem
1. **Separação Clara de Responsabilidades**
   - Comanda Balcão = vendas no local
   - Delivery = vendas para entrega
   - Cada um com seu fluxo

2. **Estoque como Verdade Central**
   - ESTOQUE é a fonte de verdade
   - Sempre validado antes de consumo
   - Recalculado após operações

3. **Rastreabilidade Total**
   - Cada venda gera ID único (C-000001 ou D-000001)
   - LOG registra todas as transações
   - Histórico em COMANDA_ITENS e DELIVERY_ITENS

4. **Flexibilidade Financeira**
   - Pix/Dinheiro/Cartão → CAIXA (entrada imediata)
   - FIADO → CONTAS_A_RECEBER (débito aberto)
   - Pagamento parcial em comanda aberta

### ⚠️ Particularidades
1. **Comanda Aberta permite MÚLTIPLAS ADIÇÕES**
   - Pode continuar vendendo depois
   - Calcula saldo correto em tempo real

2. **Delivery baixa estoque APENAS ao Encaminhar**
   - Não ao criar o pedido
   - Permite cancelamento "gratuito" antes de enviar

3. **FIADO é bloqueado para Delivery**
   - Vendedor não pode escolher FIADO no delivery
   - Sistema valida cliente se tentar

---

## 🧪 SIMULAÇÃO DE CASO DE USO

### Cenário Real: João pede Cerveja na Comanda

```
T=00:00 | AÇÃO: Abre "Nova Comanda" → seleciona JOÃO + Cerveja 600ml x2
        │ ESTADO: Popup é criado, carrinho tem [Cerveja x2]
        │ SISTEMA:
        │  • Cliente está TRAVADO
        │  • Estoque de Cerveja = 10 (não baixado ainda)
        │
└───────┴─→ Clica 🟢 Continuar Vendendo
        │ AÇÃO: Salva comanda como ABERTA
        │ SISTEMA:
        │  • COMANDAS: [Pedido=1, Data, Cliente=JOÃO, Status=ABERTA]
        │  • COMANDA_ITENS: [1, Cerveja, 2, 25.00, 50.00, SIM]
        │  • ESTOQUE: Cerveja qtd = 8 (baixou!)
        │  • Popup fecha
        │
└───────┴─→ T=01:00 | AÇÃO: Clica "Comandas Abertas" → Abre Comanda #1
        │ SISTEMA:
        │  • Popup carrega itens históricos (TRAVADOS):
        │    [✅ Cerveja x2 = R$ 50 (não pode mudar)]
        │  • Podia adicionar NOVO produto aqui
        │
└───────┴─→ Seleciona Refrigerante x1 → clica ➕
        │ SISTEMA:
        │  • Item novo adicionado (travado=false)
        │  • Na lista: [Refrigerante x1 = R$ 8 (pode remover)]
        │
└───────┴─→ T=01:05 | Clica 🟢 Continuar Vendendo
        │ SISTEMA:
        │  • Valida Refrigerante em estoque? SIM
        │  • COMANDA_ITENS append: [1, Refrigerante, 1, 8, 8, SIM]
        │  • ESTOQUE: Refrigerante qtd -= 1
        │  • Item travado=true (agora é histórico)
        │  • Popup fecha
        │
└───────┴─→ T=02:00 | João paga R$ 60 em Dinheiro
        │ AÇÃO: Clica 💰🛍️ Finalizar Comanda → Form de pagamento
        │ SISTEMA: Calcula
        │  • Total Consumido = R$ 50 + R$ 8 = R$ 58
        │  • Pago Parcial = R$ 0 (não havia pagto anterior)
        │  • Saldo = R$ 58 - 0 = R$ 58
        │  • (João vai pagar R$ 60, sobra R$ 2)
        │
└───────┴─→ Seleciona "💵 Dinheiro" → Confirma
        │ SISTEMA:
        │  • VENDAS append 2 linhas:
        │    [Data, Cerveja, 2, 50, Dinheiro, COMANDA, C-000001]
        │    [Data, Refrigerante, 1, 8, Dinheiro, COMANDA, C-000001]
        │  • CAIXA append:
        │    [Data, Entrada, 58, Dinheiro, COMANDA C-000001]
        │  • COMANDAS: [1, ..., JOÃO, ..., Status=FECHADA]
        │  • LOG: registra COMANDA_FECHADA
        │  • Popup fecha ✅
        │
└──────────→ FIM: Comanda quitada e fechada
```

---

## 📈 MÉTRICAS DE RASTREABILIDADE

Para cada pedido, podemos recuperar:
- **Quando**: Data/Hora exata
- **Quem**: Cliente, Entregador (se delivery)
- **O Quê**: Produtos, Quantidades, Preços
- **Quanto**: Total, Pago, Saldo
- **Como**: Forma de pagamento, Origem (Comanda/Delivery)
- **Status**: PEDIDO FEITO → FECHADA/ENTREGUE/CANCELADO

---

## 🎓 CONCLUSÃO

O sistema KARO PRO v1.0 é uma solução robusta de gestão de vendas que:

✅ Diferencia dois canais de venda (Balcão e Delivery)
✅ Valida estoque ANTES de cada consumo
✅ Permite venda parcial e continuada
✅ Suporta múltiplas formas de pagamento (incluso FIADO)
✅ Mantém histórico completo e rastreável
✅ Protege contra concorrência e erros

A dinâmica é intuitiva e reflete como um depósito/bar real funcionaria! 🍺📦🚚
