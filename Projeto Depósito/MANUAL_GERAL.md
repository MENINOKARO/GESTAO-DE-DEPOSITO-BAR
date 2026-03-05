# 📘 Manual Geral do Sistema de Gestão de Depósito

Este manual reúne todas as funções e operações disponíveis no sistema, em linguagem prática. Utilize-o como referência rápida.

---

## 🔐 Autenticação e Usuários

### popupLogin()
Exibe o formulário de login (email + senha). Invocado automaticamente se não existir sessão ativa.

### popupCriarUsuario()
Formulário para cadastrar novo usuário. Requer:
- nome completo
- email único
- senha (mín. 6 caracteres)
- confirmação da senha
- perfil (OPERACIONAL ou GERENCIAL)

### autenticarUsuario(usuario, senha)
Valida credenciais. Retorna `{ok:true,...}` ou `{ok:false,msg}`. Cria sessão e registra auditoria.

### criarNovoUsuario(nome, senha, perfil)
Cria usuário na aba `USUARIOS`. Realiza verificações e gera ID.

### obterUsuarioAtual()
Retorna objeto com dados do usuário logado (`id`,`nome`,`email`,`perfil`,`ativo`) ou `null`.

### temPermissao(perfilRequerido)
Retorna `true` se o usuário atual tiver o perfil exigido (ou for GERENCIAL).

### abrirMeuPerfil()
Popup com informações do usuário: nome, email, perfil, status. Acessível em `Menu > Sistema`.

### fazerLogout()
Encerra a sessão atual, remove propriedades e volta ao popup de login.

### encerrarSessao()
Função interna que registra logout e atualiza aba `SESSOES`.

### criarSessao(idUser)
Registra login, guarda em propriedades de usuário.

---

## 🔒 Proteções de Planilha

### aplicarProtecoesPlanilhas()
Protege todas as abas (warning=false) com descrição "Protegido pelo sistema". Executado na inicialização e após login de usuário operacional.

### removerProtecoes()
Remove as proteções geradas acima. Deve ser chamado por perfil GERENCIAL quando for preciso alterar manualmente.

---

## 🚀 Inicialização e Setup

### initSistema()
Garante a estrutura básica de abas (`PRODUTOS`, `ESTOQUE`, etc), organiza CONFIG, aplica tema e proteções, inicializa autenticação e senha de reset.

### inicializacaoSilenciosa()
Carrega rapidamente abas essenciais, atualiza dashboards, e garante estrutura de autenticação e tema em segundo plano.

### popupBoasVindasSistema()
Exibe diálogo de boas-vindas após reset total.

### finalizarConfiguracaoInicial()
Abre diálogo de configuração de depósito e registra log de início.

### concluirConfiguracaoInicialSistema()
Marca configuração como concluída, garante estrutura de Drive, registra log e recria menu.

### iniciarSistemaAposReset()
Chama `popupBoasVindasSistema()` após um reset.

---

## 🏠 Home e Interface

### abrirPainelFlutuante()
Mostra sidebar com cards para acessar rapidamente as funções principais do sistema.

### criarHomeDashboard()
Gera dashboard completo na aba `HOME` com KPIs, rankings, gráficos e botões. Ajusta o tema e cores automaticamente.

### atualizarHome()
Versão simplificada de atualização da aba `HOME` (sem dashboard completo).

### criarHomeComBotoes()
Gera uma versão de HOME com botões simples (sem dados dinamicos).

---

## ⚙️ Funções de Configuração

### abrirConfiguracaoDeposito()
Abre o HTML do arquivo `ConfigDeposito.html` em dialog modal para editar dados do depósito.

### salvarConfiguracaoDeposito(dados)
Grava dados fornecidos e atualiza CONFIG. Chama `garantirEstruturaDriveSistema()` se for a primeira vez.

### organizarConfig()
Recria a aba CONFIG com um conjunto padrão de chaves e descrições.

### getConfig(chave)
Lê uma configuração da aba CONFIG.

### setConfig(chave, valor)
Escreve/atualiza uma configuração (função já existe no script). [não mostrada mas assumimos]

---

## 📦 Estoque e Produtos

As funções de gerenciamento de estoque em detalhes estão em módulos separados (`gestao_estoque_valores.gs` etc). Principais utilitários:

- `obterDadosEstoque()`
- `obterDadosProdutos()`
- `gerarRelatorioEstoqueComValores()`
- `exibirValorCategoria()`
- `exibirValorTotalEstoque()`
- `abrirPainelEstoqueValores()`
- `abrirAnalisRentabilidade()`
- `analisarRentabilidadeEstoque()`

---

## 📊 Finanças e Caixa

- `popupPainelFinanceiro()` – painel financeiro com busca por período.
- `gerarPainelFinanceiro(dataIni, dataFim)`
- `gerarPainelFinanceiroMesAtual()`
- `popupContaAPagar()`
- `criarContaAReceber(...)`, `receberParcialContaAReceber(...)` – para contas a receber/pagar

---

## 📦 Backup e Drive

### fazerBackupSistema()
Salva backup atual e diário em formato Google Sheets na pasta de backup do Drive. Registra log.

### obterPastaBackupSistema()
Retorna o objeto Drive da pasta de backup, criando se necessário.

### verificarEstruturaBackup()
Verifica/cria pasta de backup e retorna status.

### garantirEstruturaDriveSistema(dataRef)
Garante a árvore de pastas descrita anteriormente.


---

## 🔁 Reset e Segurança

### popupSenhaReset()
Exibe popup para pedir senha administrativa antes de resetar o sistema.

### validarSenhaReset(senhaDigitada)
Verifica contra propriedade `SENHA_RESET`.

### resetarSistema()
Executa reset total após confirmação e senha. Limpa abas, recria CONFIG, recria SYSTEM e registra log.

### popupTrocarSenhaReset(), alterarSenhaReset(), definirNovaSenhaReset()
Fluxo para atualizar a senha de reset.

### garantirSenhaReset()
Inicializa senha padrão (`admin123`) e marca flag de troca obrigatória.

---

## 📎 Utilitários Gerais

- `abrirAba(nome)` – ativa aba especificada.
- `abrirDriveLink()` – abre URL do Drive configurado.
- `recarregarMenu()` – força reconstrução do menu.
- `registrarLog(acao, detalhes, antes, depois)` – escreve entrada na aba de log.
- `agoraBrasil()` – retorna timestamp local (utilizar em outros scripts).
- `configTriggerAtualizacao()` – provavelmente cria triggers de atualização.


---

## 📱 Considerações para Uso Móvel

- Popups podem não fechar automaticamente no app mobile; se ficar travado, reinicie a planilha.
- Sidebars (painéis laterais) tendem a funcionar melhor.
- Sempre use os menus ou o painel em vez de editar células diretamente.
- Proteções de planilha garantem que o sistema não seja comprometido mesmo se o usuário tentar editar no celular.

---

Completa a lista? Se quiser pesquisar por uma função específica, digite seu nome no editor do Apps Script e use `Ctrl+F`.

Boa sorte e bons negócios! 🚀
