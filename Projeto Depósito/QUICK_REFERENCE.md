# ⚡ QUICK REFERENCE - KARO PRO v1.0

## 🚀 ATALHO RÁPIDO

**Primeira vez usando?**  
→ Abra: [INDICE_DOCUMENTACAO.md](INDICE_DOCUMENTACAO.md)

**Precisa do manual?**  
→ Abra: [README_FUNCIONAMENTO_CORRIGIDO.md](README_FUNCIONAMENTO_CORRIGIDO.md)

**Quer entender os bug?**  
→ Abra: [BUGS_ENCONTRADOS_E_CORRECOES.md](BUGS_ENCONTRADOS_E_CORRECOES.md)

---

## 📌 O QUE MUDOU? (8 CORREÇÕES)

```
✅ Type Coercion        (== → ===)
✅ Pagamentos Parciais  (.includes fix)
✅ Origem em VENDAS     (padronizada)
✅ Função Duplicada     (removida)
✅ Booleano             (=== false)
✅ Estoque Devolução    (novo)
✅ Sincronização Tipo   (delivery)
✅ Referências          (atualizadas)
```

---

## 🏃 COMO USAR? (3 CENÁRIOS)

### 🍺 Nova Comanda Balcão
```
Menu → 💶 Comandas → 🍺 Nova Comanda Balcão
├─ Seleciona Cliente (TRAVADO após 1º item)
├─ Adiciona Produtos
├─ Clica "Continuar Vendendo"
└─ Estoque BAIXA IMEDIATAMENTE ✓
```

### 📂 Comanda Aberta
```
Menu → 💶 Comandas → 📂 Comandas Abertas
├─ Abre comanda #XXXX
├─ Visualiza itens HISTÓRICOS (cinza, travados)
├─ Adiciona ITENS NOVOS (colorido, removíveis)
├─ Pagamento Parcial OU Continuar OU Finalizar
└─ Estoque validado ANTES ✓
```

### 🚚 Novo Delivery
```
Menu → 🚚 Delivery → 🚚 Novo Delivery
├─ Cliente: OBRIGATÓRIO
├─ Produtos: Múltiplos
├─ Entregador: OBRIGATÓRIO
├─ Pagamento: (NÃO permite Fiado)
├─ "Fazer Pedido" → Status PEDIDO FEITO
├─ Encaminhar DEPOIS → Estoque BAIXA (EM ANDAMENTO)
└─ Cancelamento DEVOLVE estoque ✓
```

---

## 🔍 PROCURANDO ALGO?

| Preciso... | Consulte... |
|---|---|
| Entender comanda balcão | [README_FUNCIONAMENTO_CORRIGIDO.md](README_FUNCIONAMENTO_CORRIGIDO.md#1️⃣-comanda-balcão---nova-comanda-) |
| Entender comanda aberta | [README_FUNCIONAMENTO_CORRIGIDO.md](README_FUNCIONAMENTO_CORRIGIDO.md#2️⃣-comandas-abertas---gerenciar-comanda-existente-) |
| Entender delivery | [README_FUNCIONAMENTO_CORRIGIDO.md](README_FUNCIONAMENTO_CORRIGIDO.md#3️⃣-delivery---novo-delivery-) |
| Saber que bugs foram corrigidos | [RESUMO_AJUSTES_REALIZADOS.md](RESUMO_AJUSTES_REALIZADOS.md) |
| Detalhes técnicos de um bug | [BUGS_ENCONTRADOS_E_CORRECOES.md](BUGS_ENCONTRADOS_E_CORRECOES.md) |
| Ver fluxos visuais | [ESTUDO_FUNCIONAMENTO_SISTEMA.md](ESTUDO_FUNCIONAMENTO_SISTEMA.md) |
| Troubleshooting | [README_FUNCIONAMENTO_CORRIGIDO.md](README_FUNCIONAMENTO_CORRIGIDO.md#-troubleshooting) |

---

## ✅ VERIFICAÇÃO RÁPIDA

**Está funcionando corretamente se:**

- [x] Comanda: Estoque baixa ao clicar "Continuar Vendendo"
- [x] Comanda Aberta: Itens históricos ficam cinza/travados
- [x] Comanda Aberta: Pagamento parcial atualiza saldo em tempo real
- [x] Delivery: Estoque NÃO baixa ao criar (PEDIDO FEITO)
- [x] Delivery: Estoque BAIXA ao encaminhar (EM ANDAMENTO)
- [x] Delivery: Cancelamento devolve estoque se foi encaminhado
- [x] Delivery: Fiado é bloqueado (não permite escolher)
- [x] Nenhum erro de NaN ou undefined

---

## 🐛 BUGS CORRIGIDOS

| # | Bug | Severidade | Status |
|---|---|---|---|
| 1 | Type Coercion | 🔴 CRÍTICO | ✅ |
| 2 | Pagamentos Parciais | 🔴 CRÍTICO | ✅ |
| 3 | Origem em VENDAS | 🟠 MÉDIO | ✅ |
| 4 | Função Duplicada | 🟠 MÉDIO | ✅ |
| 5 | Booleano | 🔴 CRÍTICO | ✅ |
| 6 | Estoque Devolução | 🔴 CRÍTICO | ✅ |
| 7 | Sincronização Tipo | 🟠 MÉDIO | ✅ |
| 8 | Referências | 🟡 BAIXO | ✅ |

Mais detalhes: [BUGS_ENCONTRADOS_E_CORRECOES.md](BUGS_ENCONTRADOS_E_CORRECOES.md)

---

## 📊 ESTRUTURA DE ABAS

```
CLIENTES          → Base de clientes
PRODUTOS          → Catálogo com preços
ESTOQUE           → Quantidade atual (validada)
COMANDAS          → Pedido, Data, Cliente, Status
COMANDA_ITENS     → Itens detalhados por pedido
DELIVERY          → Pedidos delivery
DELIVERY_ITENS    → Itens detalhados por delivery
VENDAS            → Histórico de vendas (origem padronizada)
CAIXA             → Entradas de pagamento
CONTAS_A_RECEBER  → Débitos (Fiado)
```

---

## 🎯 FLUXOS PRINCIPAIS

### Comanda: Estoque
```
PEDIDO CRIADO
    ↓
item.travado = true
    ↓
ESTOQUE BAIXA IMEDIATAMENTE
    ↓
Registrado em COMANDA_ITENS
```

### Delivery: Estoque (DIFERENTE!)
```
PEDIDO CRIADO (PEDIDO FEITO)
    ↓
ESTOQUE NÃO BAIXA
    ↓
Encaminhado (EM ANDAMENTO)
    ↓
ESTOQUE BAIXA AGORA
    ↓
Registrado em DELIVERY_ITENS
```

### Cancelamento Delivery
```
Status EM ANDAMENTO OU ENTREGUE
    ↓
Cancelar
    ↓
ESTOQUE DEVOLVIDO
    ↓
Removido de VENDAS e CAIXA
    ↓
Status = CANCELADO
```

---

## 💡 DICAS

1. **Cliente em comanda**: Se esquecer, popup abre de novo
2. **Pagamento parcial**: Use para receber parte antes de fechar
3. **Delivery precisa encaminhar**: Estoque só baixa depois
4. **Cancelamento é seguro**: Estoque sempre volta
5. **Fiado em comanda**: OK. Fiado em delivery: BLOQUEADO
6. **Saldo negativo**: Sistema bloqueia (não permite)

---

## 🆘 PROBLEMA?

**Se algo não funcionar:**

1. Menu → 🖥️ Sistema → 🚀 Iniciar Sistema
2. Menu → 🖥️ Sistema → Ver Logs
3. Consulte [Troubleshooting](README_FUNCIONAMENTO_CORRIGIDO.md#-troubleshooting)
4. Revise [BUGS_ENCONTRADOS_E_CORRECOES.md](BUGS_ENCONTRADOS_E_CORRECOES.md)

---

## 📞 DOCUMENTAÇÃO COMPLETA

Visite [INDICE_DOCUMENTACAO.md](INDICE_DOCUMENTACAO.md) para mapa completo.

---

**Versão**: 1.0  
**Status**: ✅ ESTÁVEL  
**Última atualização**: Março 2026
