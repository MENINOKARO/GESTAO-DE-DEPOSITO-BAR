# Checklist de Paridade Funcional do App

## Objetivo

Este documento inventaria as funções e os comportamentos já existentes no sistema legado de **Gestão de Depósito** para servir como checklist de paridade funcional do novo app no repositório `APP-GESTAO-DEPOSITO`.

A ideia aqui não é copiar tela por tela da planilha. A meta é copiar o que realmente importa:
- regras de negócio;
- fluxos operacionais;
- controles de segurança;
- rastreabilidade;
- relatórios essenciais;
- integrações críticas.

---

## Recomendação executiva para o novo app

### Stack recomendada

Para usar uma linguagem mais simples e reduzir complexidade de manutenção, a recomendação principal passa a ser:

- **Frontend mobile:** Expo + React Native
- **Linguagem principal:** TypeScript
- **Backend:** NestJS ou API Node.js estruturada em TypeScript
- **Banco de dados:** PostgreSQL gerenciado
- **Autenticação:** JWT com refresh token + controle de perfis
- **Armazenamento de arquivos:** bucket privado (S3/Supabase Storage)
- **Observabilidade:** logs centralizados e trilha de auditoria

### Por que essa stack é a mais indicada aqui

- usa **uma linguagem só** no app e no backend;
- TypeScript costuma ser mais fácil de manter do que Apps Script espalhado em planilha;
- React Native com Expo acelera MVP e publicação mobile;
- PostgreSQL é muito mais seguro e confiável do que usar planilha como base transacional;
- permite criar API, permissões, logs, filas e integrações de forma profissional.

### Banco de dados seguro: recomendação prática

Usar **PostgreSQL gerenciado** com os seguintes requisitos mínimos:

- criptografia em repouso;
- criptografia em trânsito (SSL);
- backup automático diário;
- point-in-time recovery, se disponível;
- ambientes separados: dev / homologação / produção;
- usuário de banco com privilégio mínimo;
- auditoria de alterações críticas;
- nunca salvar senha em texto puro;
- hash forte de senha (`bcrypt` ou `argon2`);
- secrets fora do código-fonte.

### Opções práticas de banco

#### Opção mais simples
- **Supabase (PostgreSQL)**
- bom para acelerar autenticação, storage e ambiente inicial.

#### Opção mais controlada
- **PostgreSQL gerenciado em AWS / GCP / Railway / Render / Neon**
- melhor quando quiser separar autenticação, banco, storage e observabilidade.

---

## Regras de negócio críticas já identificadas no legado

Estas regras precisam existir no novo app desde cedo, porque impactam diretamente operação e caixa:

### Comandas balcão
- a baixa de estoque é **imediata**;
- depois do primeiro item, o cliente fica vinculado/travado à comanda;
- a comanda pode continuar recebendo itens depois;
- pagamento parcial é permitido;
- a validação de estoque precisa considerar normalização de nomes/chaves.

### Comandas abertas
- itens antigos ficam bloqueados no histórico;
- itens novos podem ser removidos antes do fechamento;
- saldo deve considerar `total - pagamentos parciais`;
- estoque deve ser validado antes de cada nova operação.

### Delivery
- ao criar pedido, o estoque **não baixa ainda**;
- o estoque baixa quando o pedido vai para **em andamento / preparo / transporte**;
- cancelamento deve devolver estoque quando a baixa já ocorreu;
- **fiado é bloqueado** no delivery;
- o catálogo não deve esconder produto só porque o estoque está baixo.

### Segurança e operação
- sistema possui login, sessão, perfis e bloqueio visual sem autenticação;
- há auditoria de ações de usuários;
- existem proteções de planilha e restrição por perfil;
- backup e logout fazem parte do fluxo operacional.

---

## Inventário funcional do legado por módulo

> Legenda de prioridade:
> - **P0** = obrigatório para virar produção
> - **P1** = importante para operação assistida
> - **P2** = melhoria gerencial / conveniência

### 1. Inicialização, setup e navegação

#### Paridade obrigatória
- [ ] **P0** Criar fluxo de bootstrap do sistema no primeiro acesso.
- [ ] **P0** Mostrar menu inicial / dashboard inicial conforme usuário autenticado.
- [ ] **P0** Executar inicialização silenciosa de recursos essenciais.
- [ ] **P0** Garantir setup inicial do depósito quando a configuração ainda não foi concluída.
- [ ] **P1** Permitir recarregar sessão/menu sem reiniciar o sistema inteiro.
- [ ] **P1** Ter tela Home central para atalhos operacionais.
- [ ] **P1** Manter separação clara entre operação, controle, relatórios, estoque e sistema.

#### Itens mapeados no legado
- `onOpen`, `inicializacaoSilenciosa`, `initSistema`.
- Menus para Home, Comandas, Delivery, Controle, Relatórios, Estoque Financeiro e Sistema.

---

### 2. Configuração do depósito

#### Paridade obrigatória
- [ ] **P0** Cadastrar e editar nome do depósito.
- [ ] **P1** Cadastrar dono / responsável.
- [ ] **P1** Cadastrar CNPJ.
- [ ] **P1** Cadastrar telefone.
- [ ] **P1** Cadastrar cidade.
- [ ] **P1** Salvar URL de Drive ou storage equivalente.
- [ ] **P1** Configurar auto refresh / sincronização.
- [ ] **P1** Configurar intervalo de atualização.
- [ ] **P1** Configurar tema da interface.
- [ ] **P1** Configurar backup automático.
- [ ] **P0** Validar campos obrigatórios antes de salvar.

#### Observação de migração
No novo app, estas configurações devem virar uma entidade própria (`depositos` / `organizacoes`) com controle de edição por perfil gerencial.

---

### 3. Autenticação, usuários, sessão e permissões

#### Paridade obrigatória
- [ ] **P0** Login com usuário e senha.
- [ ] **P0** Criar usuário novo.
- [ ] **P0** Perfis pelo menos `GERENCIAL` e `OPERACIONAL`.
- [ ] **P0** Usuário ativo/inativo.
- [ ] **P0** Troca obrigatória de senha no primeiro acesso ou reset.
- [ ] **P0** Sessão com login, logout e troca de login.
- [ ] **P0** Recuperar usuário atual autenticado.
- [ ] **P0** Controle de permissão por perfil.
- [ ] **P0** Auditoria de login, criação, edição, exclusão e ações sensíveis.
- [ ] **P0** Bloquear acesso ao sistema quando não autenticado.
- [ ] **P1** Listar usuários com filtros.
- [ ] **P1** Editar usuário.
- [ ] **P1** Excluir usuário.
- [ ] **P1** Resetar senha de usuário.
- [ ] **P1** Aplicar visibilidade de recursos por perfil.
- [ ] **P1** Registrar último acesso.
- [ ] **P1** Manter histórico de sessões.

#### Requisitos técnicos do novo app
- [ ] **P0** Nunca armazenar senha com hash simples legado.
- [ ] **P0** Usar `bcrypt` ou `argon2`.
- [ ] **P0** Implementar refresh token e expiração de sessão.
- [ ] **P0** Ter trilha de auditoria em banco.
- [ ] **P0** Criar RBAC básico para perfis.

#### Itens mapeados no legado
- Estrutura das abas `USUARIOS`, `SESSOES`, `AUDITORIA_USUARIOS`.
- Funções: `garantirEstruturausuarios`, `autenticarUsuario`, `alterarSenhaObrigatoria`, `popupCriarUsuario`, `salvarUsuario`, `criarNovoUsuario`, `popupListarUsuarios`, `editarUsuario`, `atualizarUsuario`, `deletarUsuario`, `criarSessao`, `encerrarSessao`, `rotinaLogout`, `trocarLogin`, `obterUsuarioAtual`, `temPermissao`, `registrarAuditoria`, `aplicarVisibilidadeAbasPorPerfil`, `bloquearVisualizacaoSemLogin`.

---

### 4. Produtos

#### Paridade obrigatória
- [ ] **P0** Cadastrar produto.
- [ ] **P0** Editar produto.
- [ ] **P0** Consultar produto.
- [ ] **P0** Manter categoria.
- [ ] **P0** Manter marca.
- [ ] **P0** Manter volume/unidade.
- [ ] **P0** Manter preço de venda.
- [ ] **P0** Manter estoque mínimo.
- [ ] **P0** Manter custo médio.
- [ ] **P0** Manter margem percentual.
- [ ] **P0** Calcular preço sugerido.
- [ ] **P0** Identificar status de margem.
- [ ] **P1** Manter ID único de produto.
- [ ] **P1** Exibir quantidade em estoque junto do cadastro.
- [ ] **P1** Listar produtos para análise e para catálogo do delivery.

#### Regras importantes
- [ ] **P0** Normalizar nomes/chaves de produto para evitar falha por diferença de espaço ou capitalização.
- [ ] **P0** Produto precisa ser reutilizável em vendas, compras, comandas, delivery e relatórios.

---

### 5. Estoque

#### Paridade obrigatória
- [ ] **P0** Manter saldo atual por produto.
- [ ] **P0** Manter estoque mínimo.
- [ ] **P0** Status de estoque (normal, baixo, crítico, alto).
- [ ] **P0** Entrada de estoque por compra.
- [ ] **P0** Baixa por venda.
- [ ] **P0** Baixa por comanda balcão.
- [ ] **P0** Baixa por delivery no momento correto do fluxo.
- [ ] **P0** Estorno de estoque em cancelamento, quando aplicável.
- [ ] **P0** Bloqueio de estoque negativo.
- [ ] **P1** Ajuste manual com log de auditoria.
- [ ] **P1** Monitoramento automático de estoque crítico.
- [ ] **P1** Atualização automática de indicadores de estoque.

#### Itens mapeados no legado
- Estrutura da aba `ESTOQUE`.
- Relatórios e painéis calculados sobre estoque e produtos.

---

### 6. Compras

#### Paridade obrigatória
- [ ] **P0** Registrar nova compra.
- [ ] **P0** Lançar data, produto, quantidade, valor e fornecedor.
- [ ] **P0** Atualizar estoque após compra.
- [ ] **P0** Recalcular custo médio do produto.
- [ ] **P0** Registrar impacto financeiro da compra.
- [ ] **P1** Cancelar nota/compra.
- [ ] **P1** Estornar estoque e financeiro no cancelamento.
- [ ] **P1** Emitir relatório de compras.

#### Observação
O legado expõe menu para nova compra e cancelamento de notas; isso indica que a modelagem nova precisa prever `compras` e `itens_compra`, não só um lançamento simples.

---

### 7. Vendas

#### Paridade obrigatória
- [ ] **P0** Registrar venda balcão.
- [ ] **P0** Persistir produto, quantidade, valor, pagamento e origem.
- [ ] **P0** Atualizar estoque na venda.
- [ ] **P0** Registrar entrada de caixa correspondente.
- [ ] **P1** Classificar origem da venda.
- [ ] **P1** Conciliar venda com relatórios financeiros e de estoque.

---

### 8. Comandas

#### Paridade obrigatória
- [ ] **P0** Abrir nova comanda de balcão.
- [ ] **P0** Listar comandas abertas.
- [ ] **P0** Abrir uma comanda existente.
- [ ] **P0** Adicionar itens na comanda.
- [ ] **P0** Remover apenas itens elegíveis do fluxo atual.
- [ ] **P0** Calcular total da comanda.
- [ ] **P0** Registrar pagamento parcial.
- [ ] **P0** Registrar quitação total.
- [ ] **P0** Finalizar/fechar comanda.
- [ ] **P0** Baixar estoque no momento correto.
- [ ] **P0** Impedir fechamento inconsistente.
- [ ] **P1** Preservar histórico de itens antigos bloqueados.
- [ ] **P1** Exibir saldo remanescente corretamente.

#### Regra crítica
- [ ] **P0** O saldo sempre deve respeitar pagamentos parciais já lançados.

---

### 9. Clientes

#### Paridade obrigatória
- [ ] **P0** Cadastrar cliente.
- [ ] **P0** Consultar cliente.
- [ ] **P0** Editar cliente.
- [ ] **P0** Manter nome, telefone, endereço, referência e observações.
- [ ] **P1** Vincular cliente a comandas e delivery.
- [ ] **P1** Evitar duplicidade por telefone/documento, quando possível.

---

### 10. Delivery operacional

#### Paridade obrigatória
- [ ] **P0** Criar novo pedido delivery.
- [ ] **P0** Vincular cliente ao pedido.
- [ ] **P0** Registrar itens, quantidade, total, pagamento, status e entregador.
- [ ] **P0** Ter painel de delivery.
- [ ] **P0** Permitir mudança de status do pedido.
- [ ] **P0** Baixar estoque quando o pedido entrar na etapa operacional definida.
- [ ] **P0** Devolver estoque no cancelamento, se a baixa já aconteceu.
- [ ] **P0** Bloquear fiado no delivery.
- [ ] **P1** Registrar eventos do ciclo do pedido.
- [ ] **P1** Separar pedidos recebidos, em preparo, transporte e entregues.

#### Regra crítica
- [ ] **P0** A criação do pedido e a baixa do estoque são momentos diferentes.

---

### 11. WhatsApp / atendimento automatizado

#### Paridade obrigatória
- [ ] **P1** Receber pedido via webhook.
- [ ] **P1** Validar assinatura do webhook.
- [ ] **P1** Ter flag para ativar/desativar integração.
- [ ] **P1** Aplicar rate limit.
- [ ] **P1** Registrar eventos da integração.
- [ ] **P1** Listar pedidos originados do WhatsApp.
- [ ] **P1** Atualizar status do pedido e notificar cliente.
- [ ] **P1** Montar cardápio de produtos.
- [ ] **P1** Interpretar mensagem livre do cliente.
- [ ] **P1** Salvar estado de atendimento por telefone.
- [ ] **P1** Criar pré-pedido a partir da conversa.
- [ ] **P1** Converter conversa em pedido delivery interno.
- [ ] **P2** Simular mensagens do bot em painel interno.

#### Requisitos técnicos do novo app/backend
- [ ] **P0** Segredo de webhook em variável segura.
- [ ] **P0** Logs de integração separados.
- [ ] **P1** Fila para envio de mensagens e retentativa.

#### Itens mapeados no legado
- `doPost`, `receberPedidoWhatsapp`, `atualizarStatusPedidoWhatsapp`, `listarPedidosWhatsapp`, `validarSegurancaWebhook_`, `simularMensagemBotWhatsapp`, `aplicarRateLimitWhatsapp_`, `processarMensagemClienteWhatsapp`, `criarPedidoDeliveryWhatsapp_`, `registrarPrePedidoNoDelivery_`.

---

### 12. Financeiro, caixa e contas

#### Paridade obrigatória
- [ ] **P0** Painel financeiro.
- [ ] **P0** Fluxo de caixa.
- [ ] **P0** Contas a pagar.
- [ ] **P0** Contas a receber.
- [ ] **P0** Conferência/fechamento de caixa do dia.
- [ ] **P0** Fechamento fiscal do dia.
- [ ] **P0** Lançamentos de entrada e saída.
- [ ] **P0** Conciliação com vendas, compras e pagamentos parciais.
- [ ] **P1** Histórico de fechamentos.
- [ ] **P1** Alertas de pendência antes do fechamento.

#### Observação
Mesmo quando a implementação do legado estiver espalhada em outros arquivos não presentes aqui, o menu principal deixa claro que esse bloco é parte obrigatória da paridade do app.

---

### 13. Relatórios gerenciais

#### Paridade obrigatória
- [ ] **P0** Relatório de valores do estoque.
- [ ] **P0** Relatório financeiro completo.
- [ ] **P0** Relatório de compras.
- [ ] **P0** Relatório de logs.
- [ ] **P1** Pacote consolidado de relatórios gerenciais.
- [ ] **P1** Exportar CSV de análise de estoque.
- [ ] **P1** Enviar relatório por e-mail ou equivalente.

---

### 14. Gestão de estoque com valores e rentabilidade

#### Paridade obrigatória
- [ ] **P0** Calcular valor total do estoque pelo preço de venda.
- [ ] **P0** Calcular custo total do estoque.
- [ ] **P0** Calcular lucro potencial do estoque.
- [ ] **P0** Calcular quantidade vendida por produto.
- [ ] **P0** Calcular valor vendido e lucro vendido.
- [ ] **P0** Calcular taxa de rotação.
- [ ] **P0** Calcular margem média.
- [ ] **P0** Gerar relatório estruturado de estoque com valores.
- [ ] **P1** Exibir valor por categoria.
- [ ] **P1** Analisar produtos mais rentáveis.
- [ ] **P1** Identificar estoque crítico.
- [ ] **P1** Identificar alta rotação.
- [ ] **P1** Mostrar valor total do estoque em painel executivo.
- [ ] **P1** Atualizar widget/indicador na Home.
- [ ] **P2** Monitoramento automático por agendamento.

#### Itens mapeados no legado
- `gerarRelatorioEstoqueComValores`, `obterValorTotalEstoque`, `obterValorEstoquesPorCategoria`, `analisarRentabilidadeEstoque`, `abrirPainelEstoqueValores`, `abrirPainelGestaoEstoque`, `abrirAnalisRentabilidade`, `exibirValorCategoria`, `exibirValorTotalEstoque`, `atualizarWidgetValorEstoque`, `verificarEstoqueCriticoAuto`, `setupMonitoramentoEstoque`, `monitorarEstoqueAuto`, `exportarAnaliseEstoqueCSV`, `enviarRelatorioEmail`.

---

### 15. Dashboard e indicadores

#### Paridade obrigatória
- [ ] **P1** Home com visão rápida do negócio.
- [ ] **P1** Resumo executivo de estoque e financeiro.
- [ ] **P1** Indicadores simples, rápidos e sob demanda.
- [ ] **P2** Não recriar dashboard pesado que prejudique desempenho.

#### Regra de arquitetura
O legado já sinaliza que dashboards pesados foram removidos por lentidão. O novo app deve priorizar consultas rápidas, cache controlado e indicadores enxutos.

---

### 16. Backup, logs e administração do sistema

#### Paridade obrigatória
- [ ] **P0** Backup manual.
- [ ] **P0** Registro de logs do sistema.
- [ ] **P0** Visualização de logs.
- [ ] **P0** Logout estável.
- [ ] **P1** Backup automático agendado.
- [ ] **P1** Reset seguro do sistema com confirmação forte.
- [ ] **P1** Alteração de senha de reset.
- [ ] **P1** Limpeza/troca de senha de reset.
- [ ] **P1** Padronização de estruturas internas.
- [ ] **P1** Acesso ao manual do sistema dentro da interface.

---

## Modelo de dados mínimo sugerido para o novo app

Para atingir paridade sem depender de planilha, o novo backend deve nascer pelo menos com estas entidades:

- `organizacoes` / `depositos`
- `usuarios`
- `perfis`
- `sessoes`
- `auditoria_usuarios`
- `produtos`
- `categorias`
- `estoque_movimentos`
- `estoque_saldos`
- `clientes`
- `compras`
- `itens_compra`
- `vendas`
- `itens_venda`
- `comandas`
- `comanda_itens`
- `comanda_pagamentos`
- `pedidos_delivery`
- `pedido_itens`
- `pedido_eventos`
- `caixa_lancamentos`
- `contas_pagar`
- `contas_receber`
- `fechamentos_caixa`
- `fechamentos_fiscais`
- `relatorios_gerados`
- `integracoes_whatsapp`
- `webhook_logs`
- `backups`
- `configuracoes`

---

## Ordem recomendada de implementação no novo repositório

### Fase 1 — Fundação segura
- [ ] Autenticação
- [ ] Perfis e permissões
- [ ] Organização / depósito
- [ ] Usuários
- [ ] Auditoria
- [ ] Configurações

### Fase 2 — Núcleo operacional
- [ ] Produtos
- [ ] Clientes
- [ ] Estoque
- [ ] Compras
- [ ] Vendas

### Fase 3 — Fluxos críticos do negócio
- [ ] Comandas
- [ ] Delivery
- [ ] Caixa
- [ ] Contas a pagar / receber

### Fase 4 — Gestão e inteligência
- [ ] Relatórios
- [ ] Rentabilidade
- [ ] Indicadores executivos
- [ ] Fechamentos

### Fase 5 — Integrações
- [ ] WhatsApp
- [ ] Webhooks
- [ ] Exportações
- [ ] Backup automatizado

---

## Critério de pronto para migração

O app novo só deve assumir a operação quando estes itens estiverem validados:

- [ ] Login e permissões funcionando em produção.
- [ ] Cadastro de produtos, clientes e usuários estabilizado.
- [ ] Estoque consistente em compra, venda, comanda e delivery.
- [ ] Comandas com pagamento parcial funcionando sem divergência.
- [ ] Delivery com baixa de estoque no momento certo.
- [ ] Caixa e financeiro fechando sem diferença material.
- [ ] Relatórios principais batendo com a operação real.
- [ ] Auditoria e logs disponíveis.
- [ ] Backup e restauração testados.
- [ ] Homologação paralela concluída.

---

## Decisão recomendada

Se a prioridade é **linguagem mais fácil + banco seguro + velocidade de implantação**, a melhor escolha para o novo repositório é:

**TypeScript em toda a stack + React Native (Expo) + backend Node estruturado + PostgreSQL gerenciado.**

Isso simplifica o time, melhora segurança, reduz retrabalho e deixa a migração do legado para o app muito mais controlável.
