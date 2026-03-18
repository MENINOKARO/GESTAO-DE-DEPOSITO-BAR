# Plano de Migração para App Privado

## Objetivo

Transformar o sistema atual de **Gestão de Depósito**, hoje operando em **Google Apps Script + Google Sheets**, em um **aplicativo mobile completo**, mantendo este repositório atual como base de **produção estável** e abrindo um **novo repositório privado** exclusivamente para evolução do app.

## Decisão de arquitetura

### Recomendação principal

Criar um novo repositório privado para o app, sem reaproveitar este repositório como base de desenvolvimento mobile.

**Motivos:**
- este repositório atual está focado na operação em produção via Google Sheets + Apps Script;
- o app exigirá arquitetura diferente, com camadas próprias de interface, backend, autenticação, sincronização e publicação mobile;
- separar os repositórios reduz risco de quebrar a operação atual;
- a migração poderá acontecer por fases, com validação funcional módulo a módulo.

### Estrutura recomendada

- **Repositório atual:** manutenção da produção web/planilha.
- **Novo repositório privado:** app mobile + backend da nova plataforma.

## O que precisa ser copiado fielmente para o app

Com base na estrutura atual, a versão mobile precisa contemplar integralmente:

### Núcleo do sistema
- autenticação de usuários;
- perfis e controle de acesso;
- logs e auditoria;
- configurações do depósito;
- backup e rotinas administrativas.

### Operação
- estoque;
- compras;
- vendas;
- comandas de balcão;
- comandas abertas;
- delivery;
- clientes;
- usuários.

### Controle gerencial
- painel financeiro;
- fluxo de caixa;
- contas a pagar;
- contas a receber;
- fechamento de caixa;
- fechamento fiscal.

### Gestão e inteligência
- relatórios gerenciais;
- análise de lucratividade;
- rentabilidade;
- valor do estoque;
- dashboards e indicadores.

### Integrações
- WhatsApp delivery;
- integrações externas futuras;
- APIs e webhooks previstos na arquitetura alvo.

## Premissa importante

A migração para app **não deve ser uma conversão visual isolada**. O sistema atual possui regras de negócio importantes, como:
- comportamento diferente entre balcão e delivery;
- baixa de estoque em momentos específicos do fluxo;
- controle de permissões por perfil;
- auditoria e rastreabilidade;
- relatórios financeiros e operacionais.

Ou seja: o app deve copiar **a experiência funcional e as regras do sistema**, não apenas telas.

## Stack recomendada para o novo app

### Opção recomendada

**Flutter + backend próprio + banco relacional**.

### Justificativa

- entrega app Android e iOS a partir de uma base única;
- facilita manter interface consistente com o sistema atual;
- suporta operação com múltiplas telas, formulários, dashboards e fluxos offline/online;
- permite escalar sem ficar preso às limitações do Apps Script para app mobile.

### Backend recomendado

- **API própria** para regras de negócio;
- **PostgreSQL** como banco principal;
- autenticação com controle de sessão;
- storage para backups, comprovantes e anexos;
- webhooks para integrações.

### Observação

Durante a transição, o Google Sheets pode continuar como fonte de operação do ambiente atual, mas o app novo deve nascer com **modelo de dados próprio**, evitando dependência permanente da planilha.

## Estratégia de separação entre produção e app

### Repositório atual
Manter este repositório com a seguinte política:
- apenas correções críticas de produção;
- documentação do sistema legado;
- sem refatorações profundas voltadas ao app;
- sem misturar código mobile com o código Apps Script existente.

### Novo repositório privado
Criar um repositório privado com algo como:
- `gestao-deposito-app`
- `karo-app-mobile`
- `gestao-deposito-mobile`

### Estrutura inicial sugerida do novo repositório

```text
/app
  /mobile
  /backend
  /docs
  /migrations
```

Ou, se preferir monorepo:

```text
/mobile
/backend
/docs
/infra
```

## Fases recomendadas da migração

### Fase 1 — Levantamento funcional completo
Mapear todas as funções existentes no sistema atual e classificá-las por:
- módulo;
- prioridade;
- regra de negócio;
- dependência de planilha;
- dependência de interface HTML interna;
- impacto operacional.

### Fase 2 — Modelagem do novo backend
Criar o domínio do app com entidades equivalentes a:
- usuários;
- sessões;
- produtos;
- estoque;
- vendas;
- compras;
- clientes;
- pedidos delivery;
- caixa;
- contas a pagar/receber;
- logs;
- configurações.

### Fase 3 — Paridade funcional do núcleo
Implementar primeiro:
- login;
- permissões;
- cadastro de produtos;
- estoque;
- clientes;
- usuários.

### Fase 4 — Paridade operacional
Implementar:
- comandas balcão;
- comandas abertas;
- delivery;
- compras;
- vendas;
- financeiro diário.

### Fase 5 — Paridade gerencial
Implementar:
- relatórios;
- dashboards;
- análise de lucratividade;
- fluxo de caixa;
- fechamentos.

### Fase 6 — Integrações
Implementar:
- WhatsApp;
- webhook;
- exportações;
- rotinas de backup;
- integrações externas.

### Fase 7 — Homologação assistida
Executar operação paralela:
- sistema atual continua em produção;
- app roda em homologação com base espelhada;
- comparar resultados de estoque, caixa, delivery e relatórios;
- só migrar após validação integral.

## Critério de “cópia fiel”

A versão app só pode ser considerada pronta quando houver:
- mesmas regras de negócio do sistema atual;
- mesma cobertura funcional dos módulos críticos;
- mesmos perfis de acesso;
- mesmos relatórios essenciais ou equivalentes superiores;
- rastreabilidade de ações;
- consistência de estoque, caixa e pedidos.

## Riscos que precisam ser tratados

### 1. Dependência implícita do Google Sheets
Parte das regras atuais está acoplada à estrutura das abas e aos menus do Apps Script.

### 2. Regras espalhadas em múltiplos arquivos
Será necessário inventariar e consolidar comportamentos para evitar divergência entre o legado e o app.

### 3. Diferenças de experiência
Menus, popups e sidebars da planilha precisarão ser reconstruídos como navegação mobile.

### 4. Validação operacional
Delivery, comandas e estoque precisam ser validados com cenários reais antes da virada.

## Procedimento sugerido para abrir o novo repositório privado

### Se for usar GitHub CLI

```bash
gh repo create gestao-deposito-app --private --source=. --disable-wiki --disable-issues
```

> Observação: esse comando só deve ser executado no diretório do novo projeto mobile, não neste repositório de produção.

### Fluxo recomendado
1. criar o novo repositório privado vazio;
2. inicializar a base do app nesse novo repositório;
3. copiar apenas documentação e mapa funcional necessários;
4. reimplementar o sistema em stack mobile apropriada;
5. validar por fases até substituir a operação atual.

## Próximas ações recomendadas

1. congelar este repositório como **produção assistida**;
2. abrir o novo repositório privado do app;
3. documentar inventário funcional do sistema legado;
4. definir a stack final do app e backend;
5. iniciar pelo núcleo: autenticação, usuários, produtos e estoque;
6. seguir para vendas, comandas, delivery e financeiro;
7. homologar antes de qualquer migração definitiva.

## Decisão executiva recomendada

**Sim, o correto é criar um novo repositório privado para o app e manter este repositório atual como produção.**

Essa é a estratégia mais segura para preservar a operação do depósito e, ao mesmo tempo, permitir uma reconstrução profissional, escalável e fiel do sistema em formato mobile.
