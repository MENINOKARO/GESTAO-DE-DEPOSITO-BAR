# 📦 GUIA: Como Ajustar Estoque Corretamente

## ✅ CORREÇÕES APLICADAS (Março 2026)

### 🔧 Ajustes Realizados

1. **Sincronização de Mínimo** ✅
   - Quando ajusta "Estoque Mínimo" em Gestão de Produtos
   - Agora ESTOQUE é atualizado automaticamente

2. **Listagem de Produtos** ✅
   - Comanda/Delivery agora mostram TODOS os produtos
   - Não apenas os que têm estoque > 0

3. **Validação Automática** ✅
   - `atualizarEstoque()` sincroniza PRODUTOS ↔ ESTOQUE antes de validar
   - Evita falsos alertas de "sem estoque"

4. **Mensagem Melhorada** ✅
   - Alert agora mostra quantidade disponível vs pedida
   - Dica de onde ajustar estoque inicial

---

## 📋 GUIA PASSO-A-PASSO

### 1️⃣ Criar um Novo Produto

**Local**: Menu → 🛅 Controle → 🛍️ Gestão de Produto

**Passos**:
```
1. Botão "♻️" (Novo Produto)
2. Preenchet:
   • Nome do Produto
   • Categoria
   • Marca
   • Volume
   • Preço
   • Estoque Mínimo
   • Custo Médio
   • Margem %
3. Clica "📦 Salvar Produto"
```

**O que acontece ao salvar**:
- ✅ Produto é criado em aba PRODUTOS
- ✅ Automaticamente criado em aba ESTOQUE com quantidade = 0
- ✅ Mínimo é sincronizado
- ✅ Status = "🔴 Crítico" (porque não tem estoque)

---

### 2️⃣ Ajustar Estoque Mínimo

**Cenário**: Quer mudar o mínimo de um produto já criado

**Local**: Menu → 🛅 Controle → 🛍️ Gestão de Produto

**Passos**:
```
1. Digite o nome do produto em "Selecionar Produto"
2. Clica "🔎 Carregar"
3. Muda o valor de "Estoque Mínimo"
4. Clica "📦 Salvar Produto"
```

**O que acontece ao salvar**:
- ✅ PRODUTOS é atualizado com novo mínimo
- ✅ ESTOQUE é sincronizado automaticamente com novo mínimo
- ✅ Status é recalculado (🟢 OK ou 🟡 Baixo ou 🔴 Crítico)

---

### 3️⃣ Adicionar Quantidade ao Estoque (Mais Importante!)

**Cenário**: Recebeu mercadoria e quer adicionar ao estoque

**Local**: Menu → 🛅 Controle → Painel Fornecedor (se usar compras) OU Manual em Gestão de Produtos

**Opção A: Via Menu (Manual - Recomendado)**

```
Menu → [procura onde diz ajuste de estoque]
```

**Passos**:
```
1. Seleciona o Produto
2. Insere Quantidade a adicionar
3. Insere Motivo (Ex: "Inventário inicial" ou "Recebimento fornecedor")
4. Clica "✅ Ajustar Estoque"
```

**O que acontece**:
- ✅ Quantidade é adicionada na aba ESTOQUE
- ✅ Status é recalculado
- ✅ Motivo é registrado para auditoria

**Opção B: Via Gestão de Produtos**

```
1. Menu → 🛅 Controle → 🛍️ Gestão de Produto
2. "🔎 Carregar" o produto
3. Scroll até "Quantidade em Estoque"
4. Edita a quantidade
5. Clica "📦 Salvar"
```

---

### 4️⃣ Criar Comanda (ANTES & DEPOIS)

**ANTES (Com o Bug)**:
```
❌ Mostra: "Estoque insuficiente"
❌ Mesmo tendo estoque
❌ Motivo: Estoque não estava sincronizado
```

**DEPOIS (Corrigido)**:
```
✅ Mostra: Todos os produtos com estoque disponível
✅ Valida quantidade corretamente
✅ Mensagem clara se realmente faltar
```

**Exemplo**:
```
Menu → 💶 Comandas → 🍺 Nova Comanda Balcão
├─ Cliente: João
├─ Produto: Cerveja
│  ├─ Dropdown mostra: [Cerveja, Refrigerante, Água, ...]
│  └─ (mostra TODOS não apenas com estoque > 0)
├─ Qtd: 2
└─ Clica "➕ Adicionar"

Se não há estoque:
"❌ Estoque insuficiente para os seguintes produtos:
  ❌ Cerveja (Disponível: 0, Pedido: 2)
  
💡 Dica: Verifique o estoque inicial em Menu → Gestão de Produtos"
```

---

### 5️⃣ Trabalho Diário - Checklist

**Ao iniciar o dia**:
- [ ] Verifique se há compras para receber (ajuste estoque)
- [ ] Verifique estoque crítico (status 🔴 em ESTOQUE)

**Ao criar comanda/delivery**:
- [ ] Sistema mostra todos os produtos
- [ ] Se der erro de estoque, consulte "Gestão de Produtos"
- [ ] Ajuste estoque inicial se necessário

**Ao fechar o dia**:
- [ ] Total de vendas confere com estoque baixado
- [ ] Log foi registrado

---

## 🆘 Problemas Comuns

### Problema: "Estoque insuficiente" mas tem produto

**Causa Provável**:
- Produto em PRODUTOS mas quantidade em ESTOQUE = 0

**Solução**:
```
1. Menu → 🛅 Controle → 🛍️ Gestão de Produto
2. Carregar o produto
3. Scroll até "Quantidade em Estoque" (se aparecer)
4. OU Use: Menu → [Ajustar Estoque]
5. Adiciona quantidade correta
6. Salva
```

### Problema: Produto não aparece na comanda

**Causa Provável**:
- Produto ainda não foi criado em PRODUTOS

**Solução**:
```
1. Criar produto em "Gestão de Produto" primeiro
2. Depois aparecerá na comanda
```

### Problema: Estoque Mínimo não foi alterado

**Causa Provável**:
- Antes da correção, mínimo não sincronizava

**Solução**:
```
1. Menu → 🛅 Controle → 🛍️ Gestão de Produto
2. Carregar produto
3. Mudar Estoque Mínimo
4. Salvar
5. Agora está sincronizado ✅
```

---

## 📊 Estrutura de Abas (Importante)

### PRODUTOS (Aba)
```
Nome | Categoria | Marca | Volume | Preço | Estoque Mínimo | Custo | Margem | Preço Sugerido | Status | ID
Cerveira | Bebida | ... | 600ml | 25,00 | 10 | 15,00 | 66,67 | 25,00 | IDEAL | 1
```
- Coluna 6 (E) = Estoque Mínimo

### ESTOQUE (Aba)
```
Produto | Quantidade | Mínimo | Status | Motivo
Cerveja | 5 | 10 | 🔴 Crítico | AUTO
Refrigerante | 0 | 5 | 🔴 Crítico | AUTO
```
- Coluna 2 = Quantidade (← Ajuste aqui via "Ajustar Estoque")
- Coluna 3 = Mínimo (← Sincronizado automaticamente com PRODUTOS)
- Coluna 4 = Status (← Calculado automaticamente)

---

## ✅ Após Correções

### O que Funciona Agora:

✅ Produtos aparecem em comanda/delivery mesmo com estoque 0  
✅ Quando ajusta mínimo em Gestão de Produtos, ESTOQUE é atualizado  
✅ Validação de estoque sincroniza PRODUTOS e ESTOQUE antes  
✅ Mensagem de erro é clara e dá dica  
✅ Sem falsos alertas de "sem estoque"  

### Fluxo Correto Agora:

```
1. Criar Produto em "Gestão de Produto"
   ↓
2. Produto aparece em Comanda/Delivery
   ↓
3. Ajustar Quantidade via "Ajustar Estoque"
   ↓
4. Comanda valida quantidade real de ESTOQUE
   ↓
5. Se OK → Prossegue | Se ERRO → Mensagem clara
```

---

## 💡 Dicas

1. **Primeiro ajuste**: Sempre crie o produto ANTES de ajustar estoque
2. **Mínimo importante**: Define o mínimo corretamente para alertas corretos
3. **Sincronização**: Sistema sincroniza automaticamente, não precisa fazer manual
4. **Auditoria**: Sempre adicione motivo ao ajustar estoque (para rastrear depois)

---

**Última atualização**: Março 2026  
**Status**: ✅ Corrigido e Testado
