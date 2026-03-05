# 🚀 GUIA RÁPIDO - IMPLEMENTAÇÃO DO MÓDULO DE ESTOQUE COM VALORES

## ⚡ 5 MINUTOS PARA COMEÇAR

### 1️⃣ Copie os Arquivos de Código

Dois novos arquivos foram criados em seu projeto:
- `gestao_estoque_valores.gs` - Módulo principal
- `integracao_estoque_valores.gs` - Integrações e dashboards

**Ação**: Nenhuma! Os arquivos já estão no projeto.

---

### 2️⃣ Adicione ao Menu (OPCIONAL)

Adicione este código à função `onOpen()` no seu arquivo principal:

```javascript
.addSubMenu(
  ui.createMenu('� Estoque Financeiro')
    .addItem('📋 Painel Gestão', 'abrirPainelGestaoEstoque')
    .addItem('📊 Relatório Completo', 'abrirPainelEstoqueValores')
    .addItem('📈 Análise de Rentabilidade', 'abrirAnalisRentabilidade')
    .addItem('🏷️ Valor por Categoria', 'exibirValorCategoria')
    .addItem('💹 Valor Total Estoque', 'exibirValorTotalEstoque')
)
```

---


> **Configuração Drive**: insira `DRIVE_URL` no arquivo CONFIG para ativar o link direto ao Drive na Home e no painel.

### 3️⃣ Use as Funções Principais

**Opção A - Interface Completa:**
```javascript
gerarRelatorioEstoqueComValores()
```
✅ Gera aba completa com todos os dados

**Opção B - Valor Rápido:**
```javascript
const valor = obterValorTotalEstoque();
```
✅ Retorna apenas o valor total

**Opção C - Análise Profunda:**
```javascript
const analise = analisarRentabilidadeEstoque();
```
✅ Agrupa por rentabilidade

---

## 📊 EXEMPLOS DE USO RÁPIDO

### Exemplo 1: Mostrar valor total na HOME
```javascript
function atualizarValorNaHome() {
  const valor = obterValorTotalEstoque();
  SpreadsheetApp.getActive()
    .getRange('B5')
    .setValue('Valor Estoque: R$ ' + valor.toFixed(2));
}
```

### Exemplo 2: Alertar sobre críticos
```javascript
function alertarCriticos() {
  const analise = analisarRentabilidadeEstoque();
  if (analise.estoqueCritico.length > 0) {
    const nomes = analise.estoqueCritico.map(p => p.produto).join(', ');
    alert('🚨 Críticos: ' + nomes);
  }
}
```

### Exemplo 3: Exportar para aba
```javascript
function exportarAnalise() {
  abrirAnalisRentabilidade();  // Pronto!
}
```

---

## 🎯 CASOS DE USO

| Necessidade | Função | Resultado |
|-------------|--------|-----------|
| Saber quanto de dinheiro tem em estoque | `obterValorTotalEstoque()` | Número |
| Ver valor por categoria | `exibirValorCategoria()` | Nova aba |
| Descobrir produtos bons para vender | `analisarRentabilidadeEstoque()` | Objeto com análise |
| Listar o que está faltando | `verificarEstoqueCriticoAuto()` | Console + Alert |
| Relatório completo impresso | `gerarRelatorioEstoqueComValores()` | Nova aba formatada |

---

## 💡 DICAS PROFISSIONAIS

### Dica 1: Monitoramento Automático (Opcional)
```javascript
// Executa em tempo real (a cada hora)
function setupMonitoramentoEstoque() {
  setupMonitoramentoEstoque();  // Ativa a cada 1h
}
```

### Dica 2: Dashboard na HOME
```javascript
function adicionarWidgetEstoqueNaHome() {
  const valor = obterValorTotalEstoque();
  const porCategoria = obterValorEstoquesPorCategoria();
  
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('HOME');
  
  sh.getRange('A10').setValue('Valor Total: R$ ' + valor.toFixed(2));
  
  let row = 11;
  Object.entries(porCategoria).forEach(([cat, dados]) => {
    sh.getRange(row, 1).setValue(`${cat}: R$ ${dados.valor.toFixed(2)}`);
    row++;
  });
}
```

### Dica 3: Notificação por Email
```javascript
function notificarGerente() {
  const analise = analisarRentabilidadeEstoque();
  
  if (analise.estoqueCritico.length > 0) {
    const lista = analise.estoqueCritico
      .map(p => p.produto).join(', ');
    
    MailApp.sendEmail(
      'gerente@email.com',
      '🚨 Alerta Estoque Crítico',
      'Produtos: ' + lista
    );
  }
}
```

---

## 🔍 VERIFICAR SE ESTÁ FUNCIONANDO

Execute este teste:
```javascript
function testarModulo() {
  console.log('1️⃣ Obtendo valor total...');
  const valor = obterValorTotalEstoque();
  console.log('✅ Valor: R$ ' + valor);
  
  console.log('2️⃣ Obtendo estoque por categoria...');
  const cat = obterValorEstoquesPorCategoria();
  console.log('✅ Categorias:', Object.keys(cat).length);
  
  console.log('3️⃣ Gerando análise...');
  const analise = analisarRentabilidadeEstoque();
  console.log('✅ Críticos:', analise.estoqueCritico.length);
  
  console.log('🎉 TUDO FUNCIONANDO!');
}
```

**Para rodar**: Abra o Apps Script Editor (Extensões > Apps Script) e execute `testarModulo()`

---

## 📞 PRECISA DE AJUDA?

### Erro: "ESTOQUE não encontrada"
→ Execute `initSistema()` no menu

### Nomes dos produtos não batem
→ Compare exactamente entre ESTOQUE e PRODUTOS (maiúsculas/minúsculas)

### Valores zerados
→ Verifique se coluna E (Preço) em PRODUTOS tem valores

### Lento com muitos produtos
→ Normal. >2000 produtos pode levar 10-30 segundos

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

- [ ] Criei novo menu em `onOpen()`
- [ ] Testei com `testarModulo()`
- [ ] Verifiquei dados em ESTOQUE, PRODUTOS e VENDAS
- [ ] Executei `gerarRelatorioEstoqueComValores()` uma vez
- [ ] Aba ESTOQUE_VALORES foi criada
- [ ] Adicionei widget na HOME (opcional)
- [ ] Ativei monitoramento (opcional)

---

## 🎓 PRÓXIMOS PASSOS

### Nível 1 - Básico ✅ (VOCÊ ESTÁ AQUI)
- Relatório manual
- Valor total do estoque
- Lista de críticos

### Nível 2 - Intermediário
- Dashboard de categorias
- Análise de rentabilidade
- Widgets na HOME

### Nível 3 - Avançado
- Monitoramento automático (1h/1h)
- Alertas por email
- Integração com outras abas

---

## 📚 REFERÊNCIA RÁPIDA DE FUNÇÕES

```javascript
// LEITURA DE DADOS
obterDadosEstoque()                  // Array com estoque
obterDadosProdutos()                 // Map com produtos
obterDadosVendas()                   // Array com vendas

// CÁLCULOS SIMPLES
obterValorTotalEstoque()             // R$ total
calcularQuantidadeVendida(nome, vendas)    // Qtd vendida
calcularTaxaRotacao(qtdAtual, qtdVendida)  // %

// RELATÓRIOS
gerarRelatorioEstoqueComValores()    // Completo
obterValorEstoquesPorCategoria()     // Por categoria
analisarRentabilidadeEstoque()       // Análise profunda

// DASHBOARDS (INTERFACE)
abrirPainelEstoqueValores()          // Abre aba
abrirAnalisRentabilidade()           // Análise financeira
exibirValorCategoria()               // Tabela de categorias
exibirValorTotalEstoque()            // Alert com valor

// MONITORAMENTO
verificarEstoqueCriticoAuto()        // Checa críticos
monitorarEstoqueAuto()               // Executa rotina
setupMonitoramentoEstoque()          // Ativa a cada 1h
```

---

## 🎉 VOCÊ ESTÁ PRONTO!

Comece simples:
1. Execute `testarModulo()` 
2. Depois `gerarRelatorioEstoqueComValores()`
3. Aproveite! 📊

---

**Versão**: 1.0  
**Data**: Fevereiro 2026  
**Status**: ✅ Pronto para Usar
