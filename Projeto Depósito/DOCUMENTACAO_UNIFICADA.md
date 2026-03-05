# 📘 Documentação Unificada — Gestão de Depósito

Este arquivo consolida as informações essenciais que estavam espalhadas em vários arquivos de resumo, checklist, índices e guias rápidos.

## 1) Estrutura mínima do projeto

Arquivos funcionais (código):
- `README.md` → código principal Apps Script
- `autenticacao_usuarios.gs` → autenticação e controle de usuários
- `integracao_estoque_valores.gs` → integração de estoque e valores
- `gestao_estoque_valores.gs` → regras de gestão de estoque financeiro
- `ConfigDeposito.html` → interface/configurações
- `backup_dialog.html` e `trocar_login_dialog.html` → diálogos auxiliares

## 2) Fluxo de implantação (resumo)

1. Copiar o conteúdo dos arquivos `.gs`/`README.md` para o projeto Apps Script.
2. Publicar e vincular à planilha Google Sheets do depósito.
3. Validar login e permissões de usuários.
4. Testar atualização de estoque, estoque mínimo e cálculo financeiro.
5. Confirmar telas auxiliares (configuração, backup e troca de login).

## 3) O que foi padronizado nesta limpeza

- Remoção de documentos repetidos/parecidos (índices duplicados, resumos equivalentes e checklists redundantes).
- Centralização da orientação operacional neste arquivo.
- Preservação dos arquivos de código e UI necessários para funcionamento.

## 4) Quando criar novos documentos

Criar novo `.md` apenas quando houver:
- mudança funcional relevante (novo recurso),
- mudança de operação (novo procedimento obrigatório),
- ou necessidade de histórico técnico (decisões importantes).

Evitar criar múltiplos arquivos com o mesmo propósito (ex.: vários “resumos finais” e “índices”).

## 5) Situação atual

✅ Repositório simplificado e com foco em arquivos realmente necessários para manutenção e execução do sistema.
