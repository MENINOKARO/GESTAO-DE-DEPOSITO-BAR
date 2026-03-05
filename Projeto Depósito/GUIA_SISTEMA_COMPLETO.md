/**
 * =====================================================
 * 🎯 GUIA DE IMPLEMENTAÇÃO - SISTEMA COMPLETO
 * =====================================================
 * 
 * ✅ NOVIDADES IMPLEMENTADAS:
 * 
 * 1. 🔐 SISTEMA DE LOGIN COM AUTENTICAÇÃO
 *    - Login obrigatório ao abrir o sistema
 *    - Registro de novo usuário com email e senha
 *    - Sessões gerenciadas
 *    - Auditoria de acessos
 * 
 * 2. 👥 GERENCIAMENTO DE USUÁRIOS
 *    - Criação de usuários com perfis
 *    - Dois tipos de perfil:
 *      • OPERACIONAL: Acesso limitado (registros)
 *      • GERENCIAL: Acesso completo (tudo)
 *    - Ativação/Desativação de usuários
 *    - Histórico de último acesso
 * 
 * 3. 🏠 HOME DASHBOARD COMPLETO
 *    - Tema DARK MODE padrão (profissional)
 *    - Informações essenciais centralizadas
 *    - KPIs em tempo real:
 *      • Saldo de caixa hoje
 *      • Produtos em estoque crítico
 *      • Valor total do estoque
 *      • Comandas abertas
 *      • Pedidos de delivery
 *    - Ranking de produtos (top 10 + low 5)
 *    - Análise de estoque por categoria
 *    - Controle rápido via botão flutuante
 * 
 * 4. 🎨 TEMA PADRÃO DARK PARA TODAS ABAS
 *    - Cores consistentes e profissionais
 *    - Tipografia padronizada
 *    - Gridlines ocultas
 *    - Cabeçalhos com destaque
 * 
 * 5. 🔑 SENHA DE RESET OBRIGATÓRIA
 *    - Senha padrão: A1D2M1N@2026
 *    - Obrigatório trocar na primeira execução
 *    - Proteção contra reset não autorizado
 * 
 * 6. 🚀 FLUXO AUTOMÁTICO POS-RESET
 *    - Tela de boas-vindas
 *    - Configuração automática do depósito
 *    - Abertura automática do HOME
 *    - Menu atualizado
 * 
 * =====================================================
 * 📋 COMO USAR - PASSO A PASSO
 * =====================================================
 * 
 * 🔴 PRIMEIRA EXECUÇÃO:
 * 
 * 1. Abra o Google Sheets da "Gestão de Depósito"
 * 2. Clique em Menu > Extensões > Apps Script
 * 3. Copie o conteúdo de README.md para o editor
 * 4. Copie o conteúdo de autenticacao_usuarios.gs para novo arquivo
 * 5. Salve (Ctrl+S)
 * 6. Volte para o Sheets e recarregue (F5)
 * 7. Menu > Sistema > Iniciar Sistema
 * 
 * 🟡 PRIMEIRA ABERTURA DO SISTEMA:
 * 
 * 1. Você verá um popup de LOGIN
 * 2. Clique em "Criar Conta"
 * 3. Preencha:
 *    - Nome completo
 *    - Email
 *    - Senha (mínimo 6 caracteres)
 *    - Confirme a senha
 *    - Perfil de Acesso (Operacional ou Gerencial)
 * 4. Clique em "Criar Usuário"
 * 
 * 🟢 ENTRAR NO SISTEMA:
 * 
 * 1. Popup de LOGIN solicitará:
 *    - Email
 *    - Senha
 * 2. Clique em "Entrar"
 * 3. Se for primeira vez no sistema:
 *    - Verá tela de "Boas-vindas"
 *    - Configure os dados do depósito
 *    - Sistema abrirá HOME automaticamente
 * 4. Se já tiver configurado:
 *    - HOME abre direto
 *    - Painel de controle rápido disponível
 * 
 * =====================================================
 * 🎮 FUNCIONALIDADES NO HOME
 * =====================================================
 * 
 * 💰 CAIXA HOJE
 * └─ Mostra saldo total do caixa de hoje
 * └─ Clique para ver movimentações detalhadas
 * 
 * 📦 ESTOQUE CRÍTICO
 * └─ Produtos com quantidade abaixo do mínimo
 * └─ Alerta visual em vermelho
 *└─ Clique para acessar aba de estoque
 * 
 * 💰 VALOR ESTOQUE
 * └─ Valor total do estoque em reais
 * └─ Baseado no preço de venda
 * └─ Com lucro estimado
 * 
 * 🍺 COMANDAS / 🚚 DELIVERY
 * └─ Quantidade aberta no período
 * └─ Acesso rápido aos painéis
 * 
 * 🔄 BACKUP / 📂 DRIVE
 * └─ Fazer backup agora (salva cópia em Drive)
 * └─ Abrir pasta do Drive
 * 
 * 📁 **Estrutura de pastas**
 *   └─ O sistema cria automaticamente no Drive as pastas:
 *       /<NomeDeposito>/Backup
 *       /<NomeDeposito>/Logs
 *       /<NomeDeposito>/Relatorios
 *       /<NomeDeposito>/Compras/Notas/<Ano>/<Mês>
 *   └─ `garantirEstruturaDriveSistema()` faz essa verificação.
*   └─ Para checar manualmente a pasta de backup use a função `verificarEstruturaBackup()` no editor de script.
 * 
 * 🧾 **Logs**
 *   └─ Toda movimentação, login, backup, etc. é gravada na aba `LOG_SISTEMA`.
 *   └─ Arquivos de log também ficam na pasta Drive/Logs.
 * 
 * 🔒 **Proteção de planilhas**
 *   └─ Usuários não podem editar as abas diretamente; o sistema bloqueia
 *       cada aba (somente o script pode alterar). Isso mantém a integridade:
 *       utilize apenas os popups e menus para inserir dados.
 *   └─ Perfil GERENCIAL pode remover proteções se necessário com
 *       `removerProtecoes()`.
 * 
 * 📱 **Uso no celular**
 *   └─ O sistema funciona no app Google Sheets (iOS/Android).
 *   └─ Menus e botões são acessíveis, mas alerta modais podem se comportar
 *       de forma diferente; prefira sidebars (painéis) quando possível.
 *   └─ Sempre use o menu para navegar em vez de editar células diretamente.
 * 
 * 🎛️ ABRIR CONTROLE RÁPIDO
 * └─ Acesso a todas as funções principais
 * └─ Menu lateral flutuante
 * └─ Acesso rápido sem menu principal
 * 
 * 🚨 ESTOQUE CRÍTICO (Seção completa)
 * └─ Lista todos os produtos críticos
 * └─ Quantidade e mínimo para cada
 * └─ Fácil identificação
 * 
 * 🏆 TOP 10 + LOW 5
 * └─ Produtos mais vendidos
 * └─ Produtos menos vendidos
 * └─ Análise de rotação
 * 
 * 💰 VALOR POR CATEGORIA
 * └─ Distribuição de estoque por categoria
 * └─ Top 5 categorias
 * └─ Valores comparativos
 * 
 * =====================================================
 * 👤 GERENCIAMENTO DE PERFIL
 * =====================================================
 * 
 * ACESSAR MEU PERFIL:
 * 1. Menu > Sistema > Meu Perfil
 * 2. Verá informações do usuário logado:
 *    - Nome
 *    - Email
 *    - Perfil (Operacional ou Gerencial)
 *    - Status (Ativo/Inativo)
 * 
 * FAZER LOGOUT:
 * 1. Menu > Sistema > Fazer Logout
 * 2. Confirme a ação
 * 3. Será redirecionado para LOGIN
 * 4. Pode fazer login com outra conta
 * 
 * =====================================================
 * 🔐 RESET DO SISTEMA COM SENHA
 * =====================================================
 * 
 * PARA RESETAR:
 * 1. Menu > Sistema > Resetar Sistema
 * 2. Será solicitado a SENHA DE RESET
 * 3. Senha padrão: admin123 (na primeira vez)
 * 4. Digite a senha
 * 5. Confirme (confirmação extra)
 * 6. Sistema será resetado
 * 7. Tela de boas-vindas aparecerá
 * 
 * TROCAR SENHA DE RESET:
 * 1. Execute Menu > Sistema > Resetar Sistema
 * 2. Se for a primeira vez, opção para trocar senha
 * 3. Informe:
 *    - Senha atual
 *    - Nova senha (mínimo 4 caracteres)
 * 4. Salve
 * 
 * =====================================================
 * ⚙️ PERMISSÕES POR PERFIL
 * =====================================================
 * 
 * PERFIL OPERACIONAL:
 * ✅ Ver HOME dashboard
 * ✅ Registrar vendas e compras
 * ✅ Abrir comandas
 * ✅ Registrar delivery
 * ❌ Resetar sistema
 * ❌ Configurar depósito
 * ❌ Ver relatórios gerenciais
 * ❌ Gerenciar usuários
 * 
 * PERFIL GERENCIAL:
 * ✅ Acesso TOTAL a todas as funções
 * ✅ Resetar sistema
 * ✅ Configurar depósito
 * ✅ Ver todos os relatórios
 * ✅ Gerenciar usuários
 * ✅ Modificar configurações
 * ✅ Acessar auditoria
 * 
 * =====================================================
 * 🎨 TEMA ESCURO (PADRÃO)
 * =====================================================
 * 
 * Cores Aplicadas:
 * 
 * • Fundo Principal: #0f172a (Azul escuro)
 * • Cabeçalho: #1e293b (Cinza escuro)
 * • Texto Principal: #e2e8f0 (Cinza claro)
 * • Destaque: #3730a3 (Roxo)
 * 
 * Outras Cores Temáticas:
 * • Sucesso (Verde): #16a34a
 * • Erro (Vermelho): #dc2626
 * • Aviso (Laranja): #f59e0b
 * • Info (Azul): #2563eb
 * 
 * =====================================================
 * 📊 DADOS CAPTURADOS NA AUDITORIA
 * =====================================================
 * 
 * Cada ação registra:
 * • Timestamp (data/hora)
 * • ID do Usuário
 * • Ação (LOGIN, LOGOUT, CREATE, etc)
 * • Detalhes da ação
 * • Email do usuário
 * • Status (OK/ERRO)
 * 
 * =====================================================
 * 🆘 TROUBLESHOOTING
 * =====================================================
 * 
 * ❌ HOME APARECE EM BRANCO?
 * → Execute: Menu > Sistema > Iniciar Sistema
 * → Recarregue a página (F5)
 * → Faça logout e login novamente
 * 
 * ❌ LOGIN NÃO APARECE?
 * → Verifique se autenticacao_usuarios.gs foi adicionado
 * → Recarregue sem cache (Ctrl+F5)
 * → Verifique se a estrutura de USUÁRIOS existe
 * 
 * ❌ ERRO NA SENHA DE RESET?
 * → Abra o Console (Apps Script > Logs)
 * → Procure por erros de autenticação
 * → Reinicie o sistema
 * 
 * ❌ USUÁRIO NÃO CRIADO?
 * → Verifique se email já não está cadastrado
 * → Confira se senha tem mínimo 6 caracteres
 * → Verifique conexão com internet
 * 
 * ❌ TEMA NÃO APLICOU?
 * → Execute: Menu > Sistema > Iniciar Sistema
 * → Aplique manualmente: Menu > Sistema > (nova opção)
 * → Recarregue todas as abas
 * 
 * =====================================================
 * ✅ CHECKLIST FINAL
 * =====================================================
 * 
 * [ ] Arquivo README.md atualizado
 * [ ] Arquivo autenticacao_usuarios.gs adicionado
 * [ ] Apps Script salvo e recarregado
 * [ ] Menu > Sistema > Iniciar Sistema executado
 * [ ] Usuário criado com sucesso
 * [ ] Primeiro login realizado
 * [ ] HOME dashboard aparecendo com dados
 * [ ] Tema escuro aplicado
 * [ ] Recuperar senha de reset funcionando
 * [ ] Logout/Login alternado com sucesso
 * [ ] Todos os botões do HOME clicáveis
 * [ ] Dados aparecem corretamente
 * 
 * =====================================================
 * 📞 SUPORTE
 * =====================================================
 * 
 * Se encontrar problemas:
 * 
 * 1. Verifique o Console (Apps Script > Logs)
 * 2. Procure por mensagens de erro
 * 3. Tente recarregar (Ctrl+F5)
 * 4. Execute novamente: Menu > Sistema > Iniciar Sistema
 * 5. Se persistir, faça logout e login novamente
 * 
 * =====================================================
 * 🎉 PARABÉNS!
 * =====================================================
 * 
 * Seu sistema agora tem:
 * ✅ Autenticação robusta
 * ✅ Gerenciamento de usuários
 * ✅ HOME profissional e completo
 * ✅ Tema padrão consistente
 * ✅ Segurança com senha de reset
 * ✅ Auditoria de acessos
 * ✅ Fluxo automático de inicialização
 * 
 * APROVEITE! 🚀
 * 
 * =====================================================
 */
