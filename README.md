# GESTÃO DE DEPÓSITO

Este repositório contém a configuração do **Painel Inteligente** para organizar atalhos por área funcional.

## ✅ Ajustes implementados nesta atualização

Foram aplicados ajustes estruturais para facilitar a integração com front-end/API:

- Inclusão de `versao` no objeto `painel_inteligente`.
- Inclusão de `icone` em cada botão principal.
- Evolução de `funcoes` de lista simples para objetos com:
  - `nome`
  - `rota`
  - `categoria`

Arquivo principal:

- `painel-inteligente-config.json`

## Botões disponíveis

### 1) Botão: **Estoque**
Funções cadastradas:
- Gestão de produto
- Painel de gestão
- Relatório de valores
- Análise de rentabilidade
- Valor por categoria
- Valor total do estoque
- Análise de lucratividade

### 2) Botão: **Configurações do sistema**
Funções cadastradas:
- Dados do depósito
- Usuários e permissões
- Parâmetros gerais
- Integrações
- Backup e restauração
- Resetar sistema
- Logs e auditoria
- Preferências de notificação

## Exemplo de uso (leitura da configuração)

A aplicação pode ler o JSON e renderizar menu/botões por `titulo`, com navegação por `rota`.

## Publicação no GitHub

```bash
git add README.md painel-inteligente-config.json
git commit -m "Implementa ajustes estruturais no painel inteligente"
git push
```

Primeiro push da branch:

```bash
git push -u origin work
```
