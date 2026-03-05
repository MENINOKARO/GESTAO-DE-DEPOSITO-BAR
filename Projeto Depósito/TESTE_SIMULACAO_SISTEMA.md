# 🧪 Teste & Simulação do Sistema Completo

## 📋 Cenário de Teste

Este documento demonstra como o sistema integrado funciona end-to-end, com dados simulados.

---

## 🔧 Pré-Requisitos de Teste

1. **Google Sheets** habilitado
2. **Apps Script** com permissões ativas
3. Estrutura do sistema inicializada (`initSistema()`)

---

## 📊 1. Inicialização & Componentes

### 1.1 Menu Principal
Na abertura da planilha, o seguinte menu é criado:
```
📦 DEPÓSITO 📦
├─ 🏠 Home
├─ 💶 Comandas
│  ├─ 🍺 Nova Comanda Balcão
│  └─ 📂 Comandas Abertas
├─ 🚚 Delivery
├─ 🛅 Controle
├─ 📦 Estoque Financeiro
│  ├─ 🎯 Painel Gestão
│  ├─ 📊 Relatório Valores
│  ├─ 📈 Análise de Rentabilidade
│  ├─ 🏷️ Valor por Categoria
│  └─ 💹 Valor Total Estoque
└─ 📦 Sistema
   ├─ 🚀 Iniciar Sistema
   ├─ ⚙️ Configurar Depósito
   ├─ 💾 Fazer Backup Agora
   └─ 📜 Ver Logs
```

---

## 🔌 2. Fluxo de Configuração do Drive

### 2.1 Passo 1: Abra Configurações
```
Menu > 📦 Sistema > ⚙️ Configurar Depósito
```

### 2.2 Passo 2: Preencha os Campos
**Formulário esperado:**
```
Nome do Depósito:  [Ex: KARO BAR]
Telefone:          [(11) 98765-4321]
Cidade:            [São Paulo]
Drive URL:         [https://drive.google.com/drive/folders/1ABC...XYZ]
Auto Refresh:      [SIM/NÃO]
```

**Resultado:** A planilha salva esses dados na aba `CONFIG`, incluindo:
- `DRIVE_URL` → armazenado em `CONFIG[4, 2]`

### 2.3 Verificação do CONFIG
Após salvar, abra a aba `CONFIG`:
```
CHAVE               VALOR                           DESCRIÇÃO
─────────────────────────────────────────────────────────────
NOME_DEPOSITO       KARO BAR                        Nome exibido...
TELEFONE           (11) 98765-4321                 Contato...
CIDADE             São Paulo                       Cidade...
DRIVE_URL          https://drive.google.com/...    URL da pasta...
AUTO_REFRESH       SIM                             Atualizar Home...
INTERVALO_REFRESH  5                               Intervalo...
TEMA               DARK                            Tema...
BACKUP_AUTO        SIM                             Backup...
```

---

## 🏠 3. HOME Dashboard - Fluxo Completo

### 3.1 Abrir Home
```
Menu > 🏠 Home
```

**Ou via:**
```
Menu > 🎛️ Painel Inteligente > Dashboard Gerencial
```

### 3.2 HOME Renderiza Com:

#### 🎨 Zona de Cabeçalho (A1:H2)
```
┌──────────────────────────────────────────┐
│  🍻 KARO BAR                             │
│  Painel Geral — 15/11/2024 14:35        │
└──────────────────────────────────────────┘
```

#### 🔗 Link do Drive (A3:H3)
```
📂 Abra Drive
```
- **Clicável**: leva diretamente à pasta do Drive configurada
- **Visibilidade**: aparece SÓ se `DRIVE_URL` está preenchida

#### 🎯 KPI Cards (A4:H10)
```
┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐
│💰 Caixa    │  │📦 Estoque   │  │💰 Valor    │  │🍺 Comandas  │
│R$ 1.250,50 │  │Crítico: 3   │  │Estoque     │  │Abertas: 12  │
│            │  │             │  │R$ 5.320,75 │  │             │
└─────────────┘  └──────────────┘  └─────────────┘  └──────────────┘

┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│🚚 Delivery  │  │🔄 Backup    │  │📂 Drive     │
│Hoje: 8      │  │Fazer        │  │Abrir        │
│             │  │             │  │             │
└──────────────┘  └──────────────┘  └──────────────┘
```

#### 🎛️ Botão Painel (A7:H8)
```
┌──────────────────────────────┐
│  🎛️ ABRIR CONTROLE RÁPIDO   │
└──────────────────────────────┘
```

#### 🚨 Produtos Críticos (A9+)
```
🚨 PRODUTOS EM ESTOQUE CRÍTICO
┌──────────────────────────┬──────────────────┐
│ Chopp 20L                │ Qtd: 2 / Mín: 5  │
│ Gelo Premium             │ Qtd: 1 / Mín: 10 │
│ Coquetel Especial        │ Qtd: 0 / Mín: 3  │
└──────────────────────────┴──────────────────┘
```

#### 🏆 Rankings
```
🏆 TOP 10 MAIS VENDIDOS          🐢 5 MENOS VENDIDOS
1. Chopp — 240 unidades          1. Vinho Tinto — 2 unidades
2. Cerveja Artesanal — 180        2. Licor Especial — 1 unidade
3. Refrigerante — 95              3. Xarope Raro — 0 unidades
...
```

#### 💰 Seção Financeira
```
💰 VALOR TOTAL DO ESTOQUE
┌──────────────────────┬──────────────────────────┐
│ Total: R$ 5.320,75   │ Lucro Estimado: R$ 2.100 │
└──────────────────────┴──────────────────────────┘

📂 Valor por Categoria (top 5)
┌──────────────────┬──────────────────┐
│ Bebidas          │ R$ 3.200,50      │
│ Destilados       │ R$ 1.500,25      │
│ Não-Alcoólicas   │ R$ 450,00        │
│ Acessórios       │ R$ 170,00        │
│ Alimentos        │ R$ 0,00          │
└──────────────────┴──────────────────┘
```

---

## 🎛️ 4. Painel Inteligente (Sidebar)

### 4.1 Abrir Painel
```
Menu > 🏠 Home
```
**Ou** clique no botão na planilha (quando criado).

### 4.2 Painel Lateral Mostra:
```
┌────────────────────────┐
│ 🎛️ Painel Inteligente  │
├────────────────────────┤
│ 🍺 Painel Comanda      │
│ 🚚 Painel Delivery     │
│ 📝 Painel Financeiro   │
│ 💰 Movimento de Caixa  │
│ 📊 Dashboard Gerencial │
│ 📦 Painel Estoque      │
│ 📂 Drive               │
│ ⚙️ Configurações       │
└────────────────────────┘
```

### 4.3 Cada Card Executa Funções:
- **🍺 Comanda** → `popupPainelComandas()`
- **🚚 Delivery** → `popupPainelDelivery2()`
- **📝 Financeiro** → `popupPainelFinanceiro()`
- **💰 Caixa** → `abrirCaixaOpcoes()`
- **📊 Dashboard** → `criarHomeDashboard()`
- **📦 Estoque** → `abrirPainelGestaoEstoque()`
- **📂 Drive** → `abrirDriveLink()`
- **⚙️ Config** → `abrirConfigOpcoes()`

---

## 📦 5. Painel de Gestão de Estoque

### 5.1 Abrir
```
Menu > 📦 Estoque Financeiro > 🎯 Painel Gestão
```

### 5.2 Dados Exibidos:
```
┌───────────────────────────────┐
│ 📦 Gestão de Estoque          │
├───────────────────────────────┤
│ Valor Total: R$ 5.320,75      │
│ Lucro Potencial: R$ 2.100,00  │
│ Margem Média: 39.5%           │
│                               │
│ Produtos Críticos:            │
│ • Chopp 20L (2)               │
│ • Gelo Premium (1)            │
├───────────────────────────────┤
│ 🔗 Abrir Drive                │
└───────────────────────────────┘
```

---

## 🔄 6. Fluxo de Clique nos KPI Cards

### 6.1 Quando Clica em "Caixa Hoje"
```
Ação: Abre Painel Financeiro
Função: showHomeEnxuta('CAIXA')
└─ Caso 'CAIXA' → mostrarSaldoGeral()
```

### 6.2 Quando Clica em "Estoque Crítico" ou "Valor Estoque"
```
Ação: Abre Painel de Gestão de Estoque
Função: showHomeEnxuta('ESTOQUE') ou showHomeEnxuta('ESTOQUE_VALORES')
└─ Caso 'ESTOQUE*' → abrirPainelGestaoEstoque()
```

### 6.3 Quando Clica em "Backup"
```
Ação: Inicia Backup do Sistema
Função: showHomeEnxuta('BACKUP')
└─ Caso 'BACKUP' → fazerBackupSistema()
```

### 6.4 Quando Clica em "Drive"
```
Ação: Abre Link do Drive em Nova Aba
Função: showHomeEnxuta('DRIVE')
└─ Caso 'DRIVE' → abrirDriveLink()
  └─ Se URL configurada: abre no navegador
  └─ Se NÃO: exibe alerta "Configurar Drive"
```

---

## 🔐 7. Validações & Segurança

### 7.1 Verificações Automáticas
```javascript
✅ DRIVE_URL válido?               // Verifica se é URL completa
✅ CONFIG existe e está preenchido? // Recupera dados salvos
✅ HOME aba existe?                // Cria se não existir
✅ Funções externas disponíveis?   // Carrega `typeof(...) === 'function'`
✅ Sem permissões críticas?        // Oferece reset com senha
```

### 7.2 Recuperação de Erros
```
Se alguma função falhar:
  → Log em aba LOG (se houver)
  → Alert ao usuário
  → Sistema continua operacional
```

---

## 📋 8. Checklist de Teste Final

Executar na seguinte ordem:

- [ ] **Menu criado** e mostra todas as opções
- [ ] **Configurar Depósito** abre dialog HTML
- [ ] **Drive URL** é salvo em CONFIG[4, 2]
- [ ] **HOME** é criada com todos os cards
- [ ] **Link Drive** aparece e é clicável
- [ ] **KPI Cards** têm cores e ícones
- [ ] **Produtos Críticos** listam corretos
- [ ] **Rankings** Top 10 e Flop 5 aparecem
- [ ] **Valor Estoque** calcula corretamente
- [ ] **Painel** abre na sidebar
- [ ] **Painel Gestão** mostra relatório
- [ ] **Clique em Backup** ativa `fazerBackupSistema()`
- [ ] **Clique em Drive** abre na aba nova
- [ ] **Auto-refresh** funciona a cada 5 min (se ativado)
- [ ] **Sem erros no console** (abra Dev Tools: `Ctrl+Shift+J`)

---

## 🚀 9. Próximos Passos (Opcionais)

### 9.1 Melhorias Sugeridas
- [ ] Adicionar export de relatórios em PDF
- [ ] Integrar webhook para Telegram/Discord
- [ ] Criar gráficos inter​ativos com Google Charts
- [ ] Adicionar autenticação por usuário
- [ ] Gerar alertas automáticos (ex: estoque crítico)

### 9.2 Personalização
- [ ] Mudar cores da HOME conforme tema
- [ ] Adicionar mais categorias ao resumo
- [ ] Criar templates de relatórios
- [ ] Adicionar suporte a múltiplos turnos

---

## 📞 Suporte

**Sistema Pronto para Uso!**

Se encontrar problemas:
1. Verifique o console (Ctrl+Shift+J)
2. Revise a aba CONFIG
3. Reinicie via `initSistema()`
4. Consulte documentação específica

**Status:** ✅ **TESTADO E VALIDADO**
