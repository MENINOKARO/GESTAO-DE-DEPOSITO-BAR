# Plano de Reestruturação Modular (sem refatorar código)

## Objetivo
Reduzir complexidade de manutenção reorganizando o repositório por módulos, **sem alterar lógica de negócio** dos códigos atuais.

## Resultado da varredura completa (inventário)

### Métricas gerais
- Arquivos versionados (fora de `.git`): **21**.
- Tamanho total do repositório: **~1.6 MB**.
- Tamanho da pasta `Projeto Depósito`: **~552 KB**.
- Arquivo mais pesado: `Projeto Depósito/CODIGO.md` (**13.363 linhas**, ~364 KB).

### Inventário por arquivo (linhas)

#### Código (Google Apps Script / UI)
- `Projeto Depósito/autenticacao_usuarios.gs`: **2.324** linhas.
- `Projeto Depósito/whatsapp_delivery.gs`: **654** linhas.
- `Projeto Depósito/gestao_estoque_valores.gs`: **529** linhas.
- `Projeto Depósito/integracao_estoque_valores.gs`: **772** linhas.
- `Projeto Depósito/dashboard_otimizado.gs`: **21** linhas.
- `Projeto Depósito/AnaliseProduto.html`: **226** linhas.
- `Projeto Depósito/ConfigDeposito.html`: **389** linhas.
- `Projeto Depósito/backup_dialog.html`: **45** linhas.
- `Projeto Depósito/trocar_login_dialog.html`: **26** linhas.
- `Projeto Depósito/ui_popup_padrao`: **53** linhas (arquivo sem extensão).

#### Documentação
- `Projeto Depósito/CODIGO.md`: **13.363** linhas.
- `README.md`: **37** linhas.
- `documento/*`: 49 a 515 linhas por arquivo.

### Módulos funcionais identificados
1. **Autenticação e segurança**
   - `autenticacao_usuarios.gs`
   - `trocar_login_dialog.html`
2. **Estoque e valor financeiro**
   - `gestao_estoque_valores.gs`
   - `integracao_estoque_valores.gs`
   - `AnaliseProduto.html`
3. **Operação WhatsApp / Delivery**
   - `whatsapp_delivery.gs`
4. **Dashboard e utilitários de interface**
   - `dashboard_otimizado.gs`
   - `ConfigDeposito.html`
   - `backup_dialog.html`
   - `ui_popup_padrao`
5. **Base documental e governança**
   - `README.md`
   - `documento/*`
   - `Projeto Depósito/CODIGO.md`

---

## Problemas de manutenção observados

1. **Centralização excessiva** em um único diretório (`Projeto Depósito`) com múltiplos domínios misturados.
2. **Arquivo documental monolítico** (`CODIGO.md`) muito grande, dificultando navegação e revisão.
3. **Padrões de nomenclatura heterogêneos** (acentos, espaços e arquivo sem extensão), com risco de atrito em automações.
4. **Fronteiras de módulo implícitas** (dependem de conhecimento tácito do time), sem “contratos” claros.

---

## Proposta de nova estrutura (sem mexer na lógica)

> Estratégia: apenas mover/renomear arquivos e organizar documentação. Sem alteração de implementação.

```text
/
├─ README.md
├─ apps-script/
│  ├─ auth/
│  │  ├─ autenticacao_usuarios.gs
│  │  └─ trocar_login_dialog.html
│  ├─ estoque/
│  │  ├─ gestao_estoque_valores.gs
│  │  ├─ integracao_estoque_valores.gs
│  │  └─ AnaliseProduto.html
│  ├─ delivery/
│  │  └─ whatsapp_delivery.gs
│  ├─ dashboard/
│  │  ├─ dashboard_otimizado.gs
│  │  └─ ConfigDeposito.html
│  └─ shared-ui/
│     ├─ backup_dialog.html
│     └─ ui_popup_padrao.html
├─ docs/
│  ├─ arquitetura/
│  ├─ migracao/
│  ├─ checklist/
│  ├─ operacao/
│  └─ codigo-base/
│     ├─ CODIGO_INDEX.md
│     └─ modulos/
│        ├─ auth.md
│        ├─ estoque.md
│        ├─ delivery.md
│        └─ dashboard.md
└─ scripts/
   └─ inventario_repo.py
```

---

## Varredura do que é necessário vs. potencialmente desnecessário

### Necessário (manter)
- Todos os `.gs` atuais: contêm regras de negócio ativas por domínio.
- Todos os `.html` de popup/painel: apoiam operação via UI Apps Script.
- `documento/CHECKLIST_PARIDADE_FUNCIONAL_APP.md` e planos de migração: essenciais para evolução controlada.

### Revisão necessária (candidatos a redução)
1. **`Projeto Depósito/CODIGO.md`**
   - Recomenda-se quebrar em módulos com índice e links.
   - Manter conteúdo, mas dividir em arquivos menores.
2. **Arquivos sem extensão e nomes inconsistentes**
   - `ui_popup_padrao` deveria ser `ui_popup_padrao.html`.
3. **Duplicidade documental potencial**
   - Há múltiplos checklists/planos que podem convergir por tema (arquitetura, migração, operação).

---

## Plano de execução em 4 fases (baixo risco)

### Fase 1 — Inventário e congelamento
- Gerar mapa de arquivos e dependências (menus, chamadas de função e include HTML).
- Definir convenção de nomes: `snake_case`, sem acento e sem espaço.

### Fase 2 — Reorganização física
- Criar pastas modulares.
- Mover arquivos para os novos módulos.
- Renomear `ui_popup_padrao` para `ui_popup_padrao.html`.

### Fase 3 — Ajuste de referências (sem mudar regra)
- Corrigir apenas caminhos/nomes em chamadas de UI e loaders.
- Validar deploy e execução de todos os fluxos principais.

### Fase 4 — Higienização documental
- Fragmentar `CODIGO.md` por módulo.
- Criar índice navegável e matriz “arquivo → responsabilidade”.

---

## Critérios de aceite
- Nenhuma regra de negócio alterada.
- Todos os fluxos principais funcionando após reorganização.
- Redução do tempo de localização de código por domínio.
- Documentação com índice modular e sem monolito único.

---

## Checklist operacional sugerido
- [ ] Backup da versão atual antes dos moves.
- [ ] Aplicar reorganização em branch dedicada.
- [ ] Rodar checklist funcional após cada fase.
- [ ] Atualizar README com nova árvore.
- [ ] Registrar owners por módulo (auth, estoque, delivery, dashboard).

