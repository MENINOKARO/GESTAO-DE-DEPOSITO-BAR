# Gestão de Negócios 360° (SaaS Multi-Empresa)

Sistema completo de gestão comercial, PDV, comandas, delivery, estoque, financeiro e operação multi-unidade, com versões **Web**, **Desktop Windows (`.exe`)**, **App Android (`.aab`)** e **Integração Google Sheets / Telegram**.

---

## Principais Funcionalidades

### 1. PDV & Vendas
- Frente de caixa rápido com busca por nome/código, leitura de código de barras, atalhos e carrinho.
- Múltiplas formas de pagamento (`PIX`, `Dinheiro`, `Cartão Débito`, `Cartão Crédito`, `Fiado`, `Outro`).
- Geração automática de **QR Code PIX** e **comprovante/cupom** imprimível ou em PDF.
- Baixa automática de estoque e lançamento automático no caixa/contas a receber.

### 2. Comandas & Mesas
- Abertura, edição, adição/remoção de itens e transferência de comandas em tempo real.
- Fechamento parcial ou total com divisão de pagamento e impressão de conferência.

### 3. Delivery & Central Operacional
- Gestão de pedidos de entrega por status (`Recebido`, `Preparando`, `Em Rota`, `Entregue`, `Cancelado`).
- Controle de entregador, taxa de entrega, endereço e resumo operacional unificado.

### 4. Estoque & Compras
- Cadastro de produtos, categorias, preço de custo/venda, estoque mínimo e alertas de reposição.
- Entrada de mercadorias (compras/fornecedores) com atualização automática de custo e saldo.

### 5. Financeiro 360° & Relatórios
- **Caixa:** abertura, sangria, suprimento, conferência e fechamento de caixa com resumo por forma de pagamento.
- **Contas a Pagar & Receber:** controle de vencimentos, fiado de clientes, baixas e quitações.
- **Dashboard & Relatórios:** faturamento, ticket médio, lucro estimado, curva de produtos, exportação em **PDF A4** e impressão.

### 6. Clientes, Equipe & Multi-Unidade (Matriz/Filial)
- Cadastro de clientes com histórico de compras e saldo de fiado.
- Gestão de usuários por perfil (`ADMIN`, `DONO`, `GERENTE`, `VENDEDOR`) com permissões granulares.
- Suporte a múltiplas empresas e filiais com alternância de unidade.

### 7. Painel Master SaaS & Controle de Licenças
- Painel exclusivo do administrador técnico (`ADMIN`) com visão global de empresas e usuários.
- Controle de acesso por empresa (`ATIVO`, `TRIAL`, `INADIMPLENTE`, `BLOQUEADO`), planos (`START`, `PRO`, `ENTERPRISE`) e faturas SaaS.
- Fluxo de pagamento e **envio/aprovação de comprovantes** integrado (PIX, Cartão, Boleto, Transferência) com notificação no Telegram.
- Acesso de suporte técnico às empresas com código de autorização temporário enviado ao dono via Telegram.

### 8. Integrações
- **Supabase:** banco de dados PostgreSQL multi-tenant com autenticação e configurações centralizadas.
- **Telegram Bot:** alertas de vendas, fechamento de caixa, comprovantes SaaS e códigos de suporte.
- **Google Drive & Planilha Espelho:** backup/sincronização com conector seguro (`Edge Function sync-planilha` + `conector_planilha_cliente.gs`).

---

## Estrutura do Projeto

- `saas-app/` — Aplicação principal em **React + TypeScript + Vite**:
  - `src/components/` — Telas e módulos (`PdvTab`, `ComandasTab`, `DeliveryTab`, `EstoqueTab`, `FinanceiroTab`, `ClientesTab`, `DashboardTab`, `RelatoriosTab`, `EquipeTab`, `ConfigTab`, `AdminMasterTab`, etc.).
  - `src/services/` — Repositório de dados (`dataRepository.ts`), Supabase, PDF, Telegram e Drive.
  - `electron/` — Empacotamento **Desktop Windows** (`Electron` + `electron-builder` NSIS).
  - `android/` — Projeto nativo **Android** (`Capacitor`) para geração do `.aab` da Google Play Store.
  - `supabase/schema_saas_v2.sql` — Schema SQL multi-tenant do banco de dados.
  - `supabase/functions/sync-planilha/` — Edge Function segura para sincronização com planilhas.
- `planilha-conector/` — Script conector mínimo para planilhas de clientes (`conector_planilha_cliente.gs`).
- `*.gs` / `*.html` (raiz) — Scripts legados do Google Apps Script.

---

## Como Rodar e Gerar os Instaladores

> **Pré-requisitos:** Node.js 20+, JDK 21 (para Android) e arquivo `.env` configurado a partir de `saas-app/.env.example`.

```powershell
cd saas-app
npm install
```

### Desenvolvimento Web
```powershell
npm run dev
```

### Build de Produção (Web)
```powershell
npm run build
```

### Gerar Instalador Windows (`.exe`)
```powershell
npm run dist:win
# Saída: saas-app/release/Gestao-Negocios-360-Setup-2.0.0.exe
```

### Gerar App Android (`.aab` para Google Play Store)
> Requer `android/upload-keystore.jks` e `android/keystore.properties` configurados localmente (não versionados no Git).
```powershell
npm run android:sync
cd android
.\gradlew.bat bundleRelease
# Saída: saas-app/android/app/build/outputs/bundle/release/app-release.aab
```

---

## Segurança e Boas Práticas
- Nunca versione arquivos `.env`, `.env.local`, `keystore.properties`, `*.jks` ou `*.keystore`.
- Chaves administrativas (`SUPABASE_SERVICE_ROLE_KEY`, tokens de bot e senhas de assinatura) devem permanecer apenas nos **Secrets do Supabase**, em **ScriptProperties** ou em cofre local seguro.
