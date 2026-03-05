# 📊 MÓDULO DE GESTÃO DE ESTOQUE COM VALORES

## 📋 Descrição
Este módulo fornece um sistema completo para gerenciar estoque com cálculo automático de valores totais, valores após venda e preços praticados. Ideal para análise financeira do inventário.

---

## 🎯 Funções Principais

### 1. `gerarRelatorioEstoqueComValores()`
**Descrição:** Gera um relatório completo com estoque atual e histórico de vendas. Essa função alimenta também o novo painel de gestão e o dashboard da HOME.

**Retorno:**
```javascript
{
  itens: [
    {
      produto: "Nome do Produto",
      categoria: "Categoria",
      precoVenda: 10.50,
      custMedio: 5.00,
      margem: 50,
      // ESTOQUE ATUAL
      qtdAtual: 100,
      valorTotalEstoque: 1050,
      custTotalEstoque: 500,
      lucroEstoque: 550,
      // VENDAS
      qtdVendida: 250,
      valorVendido: 2625,
      custVendido: 1250,
      lucroVendido: 1375,
      // ANÁLISE
      taxaRotacao: 71.43,
      status: "📈 Alto"
    }
  ],
  resumo: {
    totalValorEstoque: 50000,
    totalCustoEstoque: 25000,
    lucroEstoque: 25000,
    totalVendido: 125000,
    lucroVendido: 62500,
    margemMedia: 45.5
  }
}
```

**Uso:**
```javascript
const relatorio = gerarRelatorioEstoqueComValores();
```

---

### 2. `obterValorTotalEstoque()`
**Descrição:** Retorna o valor total do estoque em reais (quantidade × preço de venda).

**Retorno:** `Number` - Valor total em reais

**Exemplo:**
```javascript
const valorTotal = obterValorTotalEstoque();
console.log(`Valor total do estoque: R$ ${valorTotal.toFixed(2)}`);
// Output: Valor total do estoque: R$ 50000.00
```

---

### 3. `obterValorEstoquesPorCategoria()`
**Descrição:** Agrupa valor do estoque por categoria de produto. Os primeiros 5 resultados aparecem automaticamente no **HOME** como resumo.

**Retorno:**
```javascript
{
  "Bebidas": {
    quantidade: 500,
    valor: 2500,
    custo: 1000
  },
  "Alimentos": {
    quantidade: 1200,
    valor: 4800,
    custo: 2400
  }
}
```

**Uso:**
```javascript
const porCategoria = obterValorEstoquesPorCategoria();
Object.entries(porCategoria).forEach(([categoria, dados]) => {
  console.log(`${categoria}: R$ ${dados.valor}`);
});
```

---

### 4. `analisarRentabilidadeEstoque()`
**Descrição:** Análise detalhada de rentabilidade, agrupando produtos por desempenho.

**Retorno:**
```javascript
{
  maisRentaveis: [
    { produto: "Cerveja Premium", lucro: 5000, margem: 60 }
  ],
  estoqueCritico: [
    { produto: "Refrigerante Cola", quantidade: 5, valor: 50 }
  ],
  altaRotacao: [
    { produto: "Agua", taxaRotacao: 95.5 }
  ],
  quaseNenhumavenda: [
    { produto: "Produto Obsoleto", quantidade: 100, valor: 500 }
  ]
}
```

---

### 5. `calcularQuantidadeVendida(nomeProduto, vendas)`
**Descrição:** Calcula total vendido de um produto específico.

**Parâmetros:**
- `nomeProduto` (String): Nome do produto
- `vendas` (Array): Array de vendas (resultado de `obterDadosVendas()`)

**Retorno:** `Number` - Quantidade total vendida

---

### 6. `calcularTaxaRotacao(qtdAtual, qtdVendida)`
**Descrição:** Calcula taxa de rotação do produto (% de movimentação).

**Parâmetros:**
- `qtdAtual` (Number): Quantidade em estoque
- `qtdVendida` (Number): Quantidade vendida

**Retorno:** `Number` - Percentual de rotação

---


## 🔧 Configuração Adicional

### 🔐 Drive
Inclua no `CONFIG` do sistema uma chave chamada `DRIVE_URL` com o link da pasta no Google Drive utilizada pelo depósito. Esse link aparece na HOME e no painel lateral.

### 📂 Menu Atualizado
O menu principal agora possui o submenu **📦 Estoque Financeiro** com as seguintes funções:

- 📋 **Painel Gestão** – abre uma barra lateral com os principais indicadores de estoque
- 📊 **Relatório Valores** – gera aba completa com dados financeiros
- 📈 **Análise de Rentabilidade**
- 🏷️ **Valor por Categoria**
- 💹 **Valor Total Estoque**

Use `onOpen()` para regenerar o menu quando fizer alterações.

## 📊 Estrutura de Dados Esperados

### Aba ESTOQUE
| Coluna | Nome | Tipo | Descrição |
|--------|------|------|-----------|
| A | Produto | String | Nome do produto |
| B | Quantidade | Number | Quantidade em estoque |
| C | Mínimo | Number | Quantidade mínima |
| D | Status | String | Status do estoque |

### Aba PRODUTOS
| Coluna | Nome | Tipo | Descrição |
|--------|------|------|-----------|
| A | Produto | String | Nome do produto |
| B | Categoria | String | Categoria |
| C | Marca | String | Marca |
| D | Volume | String | Volume/Tamanho |
| E | Preço | Number | Preço de venda |
| F | Estoque Mínimo | Number | Quantidade mínima |
| G | Custo Médio | Number | Custo unitário médio |
| H | Margem % | Number | Margem de lucro % |

### Aba VENDAS
| Coluna | Nome | Tipo | Descrição |
|--------|------|------|-----------|
| A | Data | Date | Data da venda |
| B | Produto | String | Nome do produto |
| C | Qtd | Number | Quantidade vendida |
| D | Valor | Number | Valor total |
| E | Pagamento | String | Forma de pagamento |

---

## 💰 Fórmulas e Cálculos

### Valor Total do Estoque
```
Valor Total = Quantidade em Estoque × Preço de Venda
```

### Custo Total do Estoque
```
Custo Total = Quantidade em Estoque × Custo Médio
```

### Lucro Potencial
```
Lucro Potencial = Valor Total - Custo Total
```

### Taxa de Rotação
```
Taxa Rotação = (Quantidade Vendida / (Quantidade Atual + Quantidade Vendida)) × 100%
```

### Margem de Lucro
```
Margem % = ((Preço de Venda - Custo Médio) / Preço de Venda) × 100%
```

---

## 🚀 Como Usar

### 1. Integração com Menu (Adicionar ao onOpen)
```javascript
.addSubMenu(
  ui.createMenu('💰 Estoque com Valores')
    .addItem('📊 Relatório Completo', 'abrirPainelEstoqueValores')
    .addItem('📈 Análise de Rentabilidade', 'analisarRentabilidadeEstoque')
    .addItem('🏷️ Valor por Categoria', 'exibirValorPorCategoria')
)
```

### 2. Código para Exibir Análise
```javascript
function exibirRelatorioEstoque() {
  const relatorio = gerarRelatorioEstoqueComValores();
  
  console.log('=== RELATÓRIO DE ESTOQUE ===');
  console.log('Valor Total: R$ ' + relatorio.resumo.totalValorEstoque);
  console.log('Lucro Potencial: R$ ' + relatorio.resumo.lucroEstoque);
  console.log('Margem Média: ' + relatorio.resumo.margemMedia + '%');
}
```

### 3. Exportar para Planilha
```javascript
function exportarAnaliseRentabilidade() {
  const analise = analisarRentabilidadeEstoque();
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName('ANALISE_RENTABILIDADE');
  
  if (!sh) sh = ss.insertSheet('ANALISE_RENTABILIDADE');
  
  // Produtos mais rentáveis
  sh.getRange('A1').setValue('PRODUTOS MAIS RENTÁVEIS');
  let row = 2;
  analise.maisRentaveis.forEach(item => {
    sh.getRange(row, 1).setValue(item.produto);
    sh.getRange(row, 2).setValue(item.lucro);
    row++;
  });
}
```

---

## 📈 Exemplos de Uso

### Exemplo 1: Obter valor total do estoque
```javascript
function atualizarValorTotalHome() {
  const valor = obterValorTotalEstoque();
  const ss = SpreadsheetApp.getActive();
  ss.getRange('A1').setValue('Valor Estoque: R$ ' + valor.toFixed(2));
}
```

### Exemplo 2: Alertar sobre estoque crítico
```javascript
function verificarEstoqueCritico() {
  const analise = analisarRentabilidadeEstoque();
  
  if (analise.estoqueCritico.length > 0) {
    const produtos = analise.estoqueCritico
      .map(p => p.produto)
      .join(', ');
    
    SpreadsheetApp.getUi().alert(
      '🚨 Produtos em estoque crítico:\n' + produtos
    );
  }
}
```

### Exemplo 3: Listar produtos com alta rotação
```javascript
function listarAltaRotacao() {
  const analise = analisarRentabilidadeEstoque();
  
  console.log('=== PRODUTOS COM ALTA ROTAÇÃO ===');
  analise.altaRotacao.forEach(item => {
    console.log(`${item.produto}: ${item.taxaRotacao}%`);
  });
}
```

---

## 🔧 Configuração

### Uso com Aba ESTOQUE_VALORES
Após chamar `gerarRelatorioEstoqueComValores()`, uma aba **ESTOQUE_VALORES** é criada automaticamente com:
- ✅ Lista completa de produtos
- ✅ Quantidades em estoque
- ✅ Valores totais (preço × quantidade)
- ✅ Custos totais
- ✅ Lucro estimado
- ✅ Histórico de vendas
- ✅ Taxa de rotação
- ✅ Status do produto

---

## 📊 Indicadores Importantes

| Indicador | Interpretação |
|-----------|---------------|
| **Status = 📈 Alto** | Estoque acima de 3× o mínimo - Pode reduzir compras |
| **Status = Normal** | Estoque dentro do esperado |
| **Status = ⚠️ Baixo** | Estoque entre 1× e 1.5× o mínimo - Reabastecer em breve |
| **Status = 🚨 Crítico** | Estoque no mínimo ou abaixo - Comprar URGENTE |
| **Taxa Rotação > 70%** | Produto move bem - Aumentar estoque |
| **Taxa Rotação < 20%** | Produto move devagar - Considerar descontinuar |
| **Margem < 20%** | Margem baixa - Revisar preço ou fornecedor |

---

## ⚠️ Observações Importantes

1. **Sincronização**: As funções leem dados das abas ESTOQUE, PRODUTOS e VENDAS em tempo real.
2. **Performance**: Com muitos produtos (>1000), a execução pode levar alguns segundos.
3. **Precisão**: Garanta que preços e custos estejam sempre atualizados na aba PRODUTOS.
4. **Formatação moeda**: A aba ESTOQUE_VALORES formata automaticamente como moeda.

---

## 🐛 Troubleshooting

### Erro: "Aba ESTOQUE não encontrada"
- Certifique-se que a aba ESTOQUE existe
- Execute `initSistema()` para criar estrutura padrão

### Erro: "Nenhum produto encontrado"
- Verifique se existe dados na aba ESTOQUE
- Confirme se há correspondência de nomes entre ESTOQUE e PRODUTOS

### Valores zerados
- Confirme se a coluna E (Preço) da aba PRODUTOS está preenchida
- Verifique se os nomes dos produtos estão exatamente iguais

---

## 📞 Suporte
Para dúvidas, consulte a documentação do módulo ou revise as funções via Apps Script editor.

**Versão:** 1.0  
**Última atualização:** Fevereiro 2026  
**Status:** ✅ Estável
