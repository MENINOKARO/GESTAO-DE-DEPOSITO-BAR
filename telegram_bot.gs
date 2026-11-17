/**
 * ====================================================================
 * 🤖 MÓDULO TELEGRAM BOT 2.0 - GESTÃO DE DEPÓSITO (RBAC & MOBILE-FIRST)
 * ====================================================================
 * Interface principal do sistema via Telegram com suporte a:
 * - Controle de Acesso Baseado em Perfis (RBAC): VENDEDOR, GERENTE, DONO
 * - 🍺 Comandas Balcão: Abertura, Lançamento de Itens, Pagamentos e Fechamento
 * - 🚚 Delivery Completo: Novo Pedido, Painel de Status, Despacho e Conclusão
 * - 📦 Estoque & Compras: Estoque Crítico, Busca Rápida de Preço e Saldo
 * - 💰 Financeiro: Resumo Diário de Caixa e Fechamento
 * - 👥 Gestão de Acessos: Aprovação/Bloqueio de Usuários Remotamente
 * ====================================================================
 */

/**
 * Normaliza Chat ID removendo pontos decimais gerados por células numéricas
 */
function normalizarChatId(id) {
  if (!id) return "";
  let s = String(id).trim();
  if (s.indexOf('.') !== -1) {
    s = s.split('.')[0];
  }
  return s;
}

/**
 * Normaliza ID de comanda/delivery removendo prefixos e pontuações
 */
function normalizarIdPedido(id) {
  if (!id) return "";
  let s = String(id).trim().toUpperCase();
  let digits = s.replace(/[^0-9]/g, '');
  if (digits) {
    return String(parseInt(digits, 10));
  }
  return s;
}

/**
 * Compara dois IDs de pedido com tolerância a formatos como CMD-000001, CMD-1, 1, etc.
 */
function pedidosCorrespondem(id1, id2) {
  if (!id1 || !id2) return false;
  const s1 = String(id1).trim().toUpperCase();
  const s2 = String(id2).trim().toUpperCase();
  if (s1 === s2) return true;
  const n1 = normalizarIdPedido(s1);
  const n2 = normalizarIdPedido(s2);
  if (n1 && n2 && n1 === n2) return true;
  return false;
}

/**
 * Envia uma mensagem em HTML formatado para um Chat ID específico (ou para o Dono por padrão)
 */
function enviarMensagemTelegram(texto, replyMarkup, targetChatId) {
  try {
    const token = typeof getConfig === 'function' ? getConfig('TELEGRAM_BOT_TOKEN') : '';
    let chatId = targetChatId || (typeof getConfig === 'function' ? getConfig('TELEGRAM_DONO_CHAT_ID') : '');
    chatId = normalizarChatId(chatId);

    if (!token || !chatId || String(token).trim() === '') {
      console.warn("[TELEGRAM] Token ou Chat ID ausente para envio.");
      return false;
    }

    const url = "https://api.telegram.org/bot" + String(token).trim() + "/sendMessage";
    const payload = {
      chat_id: String(chatId).trim(),
      text: texto,
      parse_mode: 'HTML'
    };

    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseData = JSON.parse(response.getContentText());
    
    if (responseData.ok) {
      return true;
    } else {
      console.error("[TELEGRAM] Falha ao enviar mensagem:", responseData.description);
      return false;
    }
  } catch (e) {
    console.error("[TELEGRAM] Erro em enviarMensagemTelegram:", e.message);
    return false;
  }
}

/**
 * Edita uma mensagem existente para atualizar seu conteúdo e botões inline.
 * Se a mensagem original for uma foto, realiza fallback automático para editMessageCaption.
 */
function editarMensagemTelegram(messageId, texto, replyMarkup, targetChatId) {
  try {
    const token = typeof getConfig === 'function' ? getConfig('TELEGRAM_BOT_TOKEN') : '';
    let chatId = targetChatId || (typeof getConfig === 'function' ? getConfig('TELEGRAM_DONO_CHAT_ID') : '');
    chatId = normalizarChatId(chatId);

    if (!token || !chatId || String(token).trim() === '') {
      return false;
    }

    const url = "https://api.telegram.org/bot" + String(token).trim() + "/editMessageText";
    const payload = {
      chat_id: String(chatId).trim(),
      message_id: Number(messageId),
      text: texto,
      parse_mode: 'HTML'
    };

    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const resObj = JSON.parse(response.getContentText());
    if (resObj.ok) return true;

    // Se o erro for porque a mensagem original é uma Foto (sem texto, apenas legenda)
    if (resObj.description && resObj.description.includes('no text in the message')) {
      const urlCaption = "https://api.telegram.org/bot" + String(token).trim() + "/editMessageCaption";
      const payloadCaption = {
        chat_id: String(chatId).trim(),
        message_id: Number(messageId),
        caption: texto,
        parse_mode: 'HTML'
      };
      if (replyMarkup) payloadCaption.reply_markup = replyMarkup;
      const resCap = UrlFetchApp.fetch(urlCaption, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payloadCaption),
        muteHttpExceptions: true
      });
      return JSON.parse(resCap.getContentText()).ok;
    }

    return false;
  } catch(e) {
    console.error("[TELEGRAM] Erro ao editar mensagem:", e.message);
    return false;
  }
}

/**
 * Envia uma foto com legenda e botões inline via API do Telegram.
 * Aceita URL externa (ex: QR Code) ou file_id do Telegram.
 */
function enviarFotoTelegram(photoUrlOrFileId, caption, replyMarkup, targetChatId) {
  try {
    const token = typeof getConfig === 'function' ? getConfig('TELEGRAM_BOT_TOKEN') : '';
    let chatId = targetChatId || (typeof getConfig === 'function' ? getConfig('TELEGRAM_DONO_CHAT_ID') : '');
    chatId = normalizarChatId(chatId);

    if (!token || !chatId || String(token).trim() === '') {
      console.warn("[TELEGRAM] Token ou ChatId ausente para envio de foto.");
      return false;
    }

    const url = "https://api.telegram.org/bot" + String(token).trim() + "/sendPhoto";
    const payload = {
      chat_id: String(chatId).trim(),
      photo: String(photoUrlOrFileId).trim(),
      caption: caption || '',
      parse_mode: 'HTML'
    };

    if (replyMarkup) {
      payload.reply_markup = replyMarkup;
    }

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseData = JSON.parse(response.getContentText());
    
    if (responseData.ok) {
      return true;
    } else {
      console.error("[TELEGRAM] Falha ao enviar foto:", responseData.description);
      if (caption) {
        enviarMensagemTelegram(caption, replyMarkup, chatId);
      }
      return false;
    }
  } catch (e) {
    console.error("[TELEGRAM] Erro em enviarFotoTelegram:", e.message);
    if (caption) {
      try { enviarMensagemTelegram(caption, replyMarkup, targetChatId); } catch(err) {}
    }
    return false;
  }
}

/**
 * Normaliza a chave PIX segundo a regulamentação do Banco Central do Brasil (DICT/BR Code).
 * Adiciona o código internacional +55 para números de celular.
 */
function normalizarChavePixTelegram(chave) {
  let c = String(chave || '').trim();
  if (!c) return '';
  if (c.includes('@')) return c.toLowerCase().trim();
  
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c);
  if (isUuid) return c.toLowerCase().trim();

  const digitos = c.replace(/\D/g, '');
  if (digitos.length === 14) return digitos; // CNPJ
  if (c.startsWith('+55')) return '+' + digitos;
  if (digitos.length === 10) return '+55' + digitos;

  if (digitos.length === 11) {
    if (c.includes('.') && c.includes('-')) return digitos; // CPF formatado
    if (digitos.charAt(2) === '9') {
      return '+55' + digitos; // Celular brasileiro exige +55
    }
    return digitos;
  }

  return c;
}

/**
 * Gera o Payload Oficial Pix Copia e Cola (BR Code EMVCo) com valor, recebedor e CRC-16
 */
function gerarPayloadPixBRCodeTelegram(chave, nomeRecebedor, cidadeRecebedor, valor, txId) {
  chave = normalizarChavePixTelegram(chave);
  nomeRecebedor = (nomeRecebedor || 'DEPOSITO').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9 ]/g, '').trim().slice(0, 25).toUpperCase();
  cidadeRecebedor = (cidadeRecebedor || 'SALVADOR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9 ]/g, '').trim().slice(0, 15).toUpperCase();
  txId = (txId || '***').replace(/[^a-zA-Z0-9]/g, '').slice(0, 25);
  if (!txId) txId = '***';

  function emv(id, value) {
    const valStr = String(value);
    const len = valStr.length.toString().padStart(2, '0');
    return id + len + valStr;
  }

  // 00 = Payload Format Indicator
  let payload = emv('00', '01');

  // 26 = Merchant Account Information - Pix
  const merchantAccount = emv('00', 'br.gov.bcb.pix') + emv('01', chave);
  payload += emv('26', merchantAccount);

  // 52 = Merchant Category Code (0000 = não informado)
  payload += emv('52', '0000');

  // 53 = Transaction Currency (986 = BRL)
  payload += emv('53', '986');

  // 54 = Transaction Amount (Valor com 2 decimais com ponto)
  if (Number(valor) > 0) {
    payload += emv('54', Number(valor).toFixed(2));
  }

  // 58 = Country Code (BR)
  payload += emv('58', 'BR');

  // 59 = Merchant Name (máx 25 caracteres)
  payload += emv('59', nomeRecebedor || 'DEPOSITO');

  // 60 = Merchant City (máx 15 caracteres)
  payload += emv('60', cidadeRecebedor || 'SALVADOR');

  // 62 = Additional Data Field Template (txId)
  const additionalData = emv('05', txId);
  payload += emv('62', additionalData);

  // 63 = CRC16 (4 hexadecimais ao final)
  payload += '6304';

  // Cálculo oficial CRC-16/CCITT-FALSE (Polinômio 0x1021, Init 0xFFFF)
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= (payload.charCodeAt(i) << 8);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  const crcHex = (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
  return payload + crcHex;
}

/**
 * Cria ou obtém a pasta de Comprovantes PIX Delivery no Google Drive
 */
function obterOuCriarPastaComprovantesDelivery() {
  try {
    let rootFolder;
    try {
      rootFolder = DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID);
    } catch(e) {
      rootFolder = DriveApp.getRootFolder();
    }
    const pastaDeliv = (typeof obterOuCriarSubpastaPorNome === 'function') 
      ? obterOuCriarSubpastaPorNome(rootFolder, 'Delivery') 
      : rootFolder;
    const pastaComp = (typeof obterOuCriarSubpastaPorNome === 'function')
      ? obterOuCriarSubpastaPorNome(pastaDeliv, 'Comprovantes_PIX')
      : pastaDeliv;
    return pastaComp;
  } catch(err) {
    console.error('Erro em obterOuCriarPastaComprovantesDelivery:', err);
    return DriveApp.getRootFolder();
  }
}

/**
 * Responde a uma callback query para remover o ícone de carregamento do botão do Telegram
 */
function responderCallbackQuery(callbackQueryId, textoAlerta) {
  try {
    const token = typeof getConfig === 'function' ? getConfig('TELEGRAM_BOT_TOKEN') : '';
    if (!token || String(token).trim() === '') return;

    const url = "https://api.telegram.org/bot" + String(token).trim() + "/answerCallbackQuery";
    const payload = {
      callback_query_id: String(callbackQueryId),
      text: textoAlerta || undefined,
      show_alert: !!textoAlerta
    };

    UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch(e) {
    console.error("[TELEGRAM] Erro ao responder callback query:", e.message);
  }
}

/**
 * Configura o Webhook do Telegram e os comandos de menu
 */
function configurarTelegramWebhook() {
  try {
    const token = getConfig('TELEGRAM_BOT_TOKEN');
    if (!token || String(token).trim() === '') {
      SpreadsheetApp.getUi().alert("❌ Configuração ausente:\n\nPor favor, insira o TELEGRAM_BOT_TOKEN nas Configurações do Depósito primeiro.");
      return;
    }

    const ui = SpreadsheetApp.getUi();
    const webAppUrl = "https://script.google.com/macros/s/AKfycbzsVlZgA_M9Xqf_VCmA57XHH3iEa_YHOo0-qfSNvl3F5Xrtiuf-9QJ_sm97atoPureH/exec";

    const url = "https://api.telegram.org/bot" + String(token).trim() + "/setWebhook?url=" + encodeURIComponent(webAppUrl);
    const response = UrlFetchApp.fetch(url);
    const result = JSON.parse(response.getContentText());

    if (result.ok) {
      // Configura Menu de Comandos no Telegram
      try {
        const commandsUrl = "https://api.telegram.org/bot" + String(token).trim() + "/setMyCommands";
        const commandsPayload = {
          commands: [
            { command: "start", description: "🏠 Painel Principal do Sistema" },
            { command: "menu", description: "📋 Menu de Operações" },
            { command: "novacomanda", description: "🍺 Criar nova comanda" },
            { command: "comandas", description: "📂 Listar comandas abertas" },
            { command: "delivery", description: "🚚 Painel de Deliveries" },
            { command: "busca", description: "🔍 Consultar preço e saldo de produto" },
            { command: "status", description: "📊 Resumo financeiro do dia" },
            { command: "estoque", description: "🚨 Alertas de estoque crítico" },
            { command: "login", description: "🔐 Vincular conta: /login usuario senha" },
            { command: "logout", description: "🚪 Desvincular conta do Telegram" }
          ]
        };
        UrlFetchApp.fetch(commandsUrl, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify(commandsPayload),
          muteHttpExceptions: true
        });
      } catch(eCmd) {
        console.warn("Erro ao configurar comandos do menu do Telegram:", eCmd.message);
      }

      ui.alert("✅ Telegram Webhook Ativado com Sucesso!\n\nSeu bot está pronto e responderá aos comandos com controle por perfil de usuário.");
    } else {
      ui.alert("❌ Falha na ativação com o Telegram:\n\n" + result.description);
    }
  } catch (e) {
    SpreadsheetApp.getUi().alert("❌ Erro ao configurar Webhook:\n\n" + e.message);
  }
}

/**
 * Monta o Menu Principal de acordo com o Perfil do Usuário (RBAC)
 */
function montarMenuPrincipal(usuario, chatId) {
  const nomeDeposito = typeof getNomeDeposito === 'function' ? getNomeDeposito() : 'Gestão de Depósito';

  if (!usuario) {
    let txtCart = '';
    if (chatId) {
      const cart = (typeof obterCarrinhoCliente === 'function') ? obterCarrinhoCliente(chatId) : { itens: [] };
      const qtdTotal = (cart.itens || []).reduce((acc, it) => acc + (Number(it.qtd) || 0), 0);
      const totalValor = (cart.itens || []).reduce((acc, it) => acc + (Number(it.qtd) * Number(it.preco) || 0), 0);
      if (qtdTotal > 0) {
        txtCart = ` (${qtdTotal} itens | R$ ${totalValor.toFixed(2).replace('.', ',')})`;
      }
    }

    const txt = `👋 <b>Olá! Bem-vindo(a) ao ${nomeDeposito}</b> 🍻\n\n` +
                `🛵 <i>Faça seu pedido de bebidas e conveniência com entrega rápida no seu endereço!</i>\n\n` +
                `Escolha uma das opções abaixo para começar:`;
    const markup = {
      inline_keyboard: [
        [
          { text: "🛒 Fazer Pedido / Ver Cardápio", callback_data: "client_menu_cats" }
        ],
        [
          { text: `🛍️ Ver Carrinho${txtCart}`, callback_data: "client_view_cart" },
          { text: "📦 Meus Pedidos", callback_data: "client_my_orders" }
        ],
        [
          { text: "💬 Falar com Atendente", callback_data: "client_contact" },
          { text: "🔐 Acesso Funcionários", callback_data: "auth_start_login" }
        ]
      ]
    };
    return { texto: txt, markup: markup };
  }

  const perfil = String(usuario.perfil || 'VENDEDOR').toUpperCase();
  const nome = usuario.nome || 'Usuário';

  if (perfil === 'DONO' || perfil === 'GERENCIAL') {
    const txt = `👑 <b>Painel do Dono - ${nomeDeposito}</b>\n` +
                `👤 <b>Usuário:</b> ${nome} | <b>Perfil:</b> ${perfil}\n\n` +
                `Selecione uma operação abaixo:`;
    const markup = {
      inline_keyboard: [
        [
          { text: "🍺 Comandas Balcão", callback_data: "cmd_menu" },
          { text: "🚚 Painel Delivery", callback_data: "deliv_menu" }
        ],
        [
          { text: "🛒 Compras / Entradas", callback_data: "comp_menu" },
          { text: "📦 Gestão de Produtos", callback_data: "prod_menu" }
        ],
        [
          { text: "📊 Análise de Produtos", callback_data: "prod_analise_menu" },
          { text: "🚨 Estoque Crítico", callback_data: "estoque" }
        ],
        [
          { text: "🧾 Contas a Receber (Fiado)", callback_data: "cr_menu" },
          { text: "📊 Resumo Financeiro", callback_data: "status" }
        ],
        [
          { text: "🔍 Buscar Produto", callback_data: "prod_search_prompt" },
          { text: "👥 Gestão de Usuários", callback_data: "manage_users" }
        ],
        [
          { text: "💾 Fazer Backup", callback_data: "do_backup" },
          { text: "🔄 Atualizar Relatórios", callback_data: "update_reports" }
        ],
        [
          { text: "🚪 Desvincular Conta", callback_data: "auth_logout" }
        ]
      ]
    };
    return { texto: txt, markup: markup };
  }

  if (perfil === 'GERENTE') {
    const txt = `👔 <b>Painel Gerencial - ${nomeDeposito}</b>\n` +
                `👤 <b>Usuário:</b> ${nome} | <b>Perfil:</b> GERENTE\n\n` +
                `Selecione uma operação abaixo:`;
    const markup = {
      inline_keyboard: [
        [
          { text: "🍺 Comandas Balcão", callback_data: "cmd_menu" },
          { text: "🚚 Painel Delivery", callback_data: "deliv_menu" }
        ],
        [
          { text: "🛒 Compras / Entradas", callback_data: "comp_menu" },
          { text: "📦 Gestão de Produtos", callback_data: "prod_menu" }
        ],
        [
          { text: "📊 Análise de Produtos", callback_data: "prod_analise_menu" },
          { text: "🚨 Estoque Crítico", callback_data: "estoque" }
        ],
        [
          { text: "🧾 Contas a Receber (Fiado)", callback_data: "cr_menu" },
          { text: "📊 Resumo Financeiro", callback_data: "status" }
        ],
        [
          { text: "🔍 Buscar Produto", callback_data: "prod_search_prompt" },
          { text: "🚪 Desvincular Conta", callback_data: "auth_logout" }
        ]
      ]
    };
    return { texto: txt, markup: markup };
  }

  // Perfil Vendedor / Operacional
  const txt = `🧑‍💼 <b>Painel de Vendas - ${nomeDeposito}</b>\n` +
              `👤 <b>Vendedor:</b> ${nome}\n\n` +
              `Selecione uma operação para iniciar o atendimento:`;
  const markup = {
    inline_keyboard: [
      [
        { text: "🍺 Comandas Balcão", callback_data: "cmd_menu" },
        { text: "🚚 Painel Delivery", callback_data: "deliv_menu" }
      ],
      [
        { text: "➕ Nova Comanda", callback_data: "cmd_new" },
        { text: "🛒 Compras / Entrada", callback_data: "comp_menu" }
      ],
      [
        { text: "🧾 Contas a Receber", callback_data: "cr_menu" },
        { text: "🔍 Consultar Preço", callback_data: "prod_search_help" }
      ],
      [
        { text: "🚪 Desvincular Conta", callback_data: "auth_logout" }
      ]
    ]
  };
  return { texto: txt, markup: markup };
}

// =============================================
// 🛒 MÓDULO ÁREA DO CLIENTE & PEDIDOS DELIVERY
// =============================================

function obterMapaEstoqueReal() {
  // 0. Cache em memória temporário (60s)
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get('mapa_est_real');
    if (cached) return JSON.parse(cached);
  } catch(e) {}

  // 1. Tenta carregar em alta velocidade pelo Supabase
  if (typeof supabaseObterMapaEstoque === 'function') {
    try {
      const mapaSupa = supabaseObterMapaEstoque();
      if (mapaSupa && Object.keys(mapaSupa).length > 0) {
        try { CacheService.getScriptCache().put('mapa_est_real', JSON.stringify(mapaSupa), 60); } catch(e) {}
        return mapaSupa;
      }
    } catch(eSupa) {
      console.warn('Fallback para Sheets em obterMapaEstoqueReal:', eSupa);
    }
  }

  // 2. Fallback pela Planilha Google
  const mapa = {};
  try {
    const ss = SpreadsheetApp.getActive();
    const shEst = ss.getSheetByName('ESTOQUE');
    if (shEst) {
      const dados = shEst.getDataRange().getValues();
      const safeNorm = str => String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toUpperCase().trim();
      for (let i = 1; i < dados.length; i++) {
        const nome = String(dados[i][0] || '').trim();
        const qtd = Number(dados[i][1]) || 0;
        if (nome) {
          mapa[nome.toLowerCase()] = qtd;
          mapa[nome.toUpperCase()] = qtd;
          mapa[safeNorm(nome)] = qtd;
        }
      }
    }
  } catch(e) {
    console.error('Erro em obterMapaEstoqueReal:', e);
  }

  try { CacheService.getScriptCache().put('mapa_est_real', JSON.stringify(mapa), 60); } catch(e) {}
  return mapa;
}

function obterCarrinhoCliente(chatId) {
  try {
    const cache = CacheService.getScriptCache();
    const raw = cache.get('CART_' + chatId);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return { itens: [], nomeCliente: '', telefone: '', endereco: '', pagamento: '', troco: '' };
}

function salvarCarrinhoCliente(chatId, cart) {
  try {
    const cache = CacheService.getScriptCache();
    cache.put('CART_' + chatId, JSON.stringify(cart), 7200); // 2 horas de validade
  } catch(e) {}
}

function limparCarrinhoCliente(chatId) {
  try {
    const cache = CacheService.getScriptCache();
    cache.remove('CART_' + chatId);
  } catch(e) {}
}

function adicionarItemCarrinhoCliente(chatId, rowIdx, qtd) {
  try {
    const ss = SpreadsheetApp.getActive();
    const shProd = ss.getSheetByName('PRODUTOS');
    if (!shProd) return { ok: false, msg: 'Cardápio indisponível' };
    const row = shProd.getRange(rowIdx, 1, 1, shProd.getLastColumn()).getValues()[0];
    const nome = String(row[0] || '').trim();
    const preco = Number(row[4]) || 0;

    if (!nome || preco <= 0) return { ok: false, msg: 'Produto indisponível' };

    // Valida estoque real na aba ESTOQUE
    const mapaEst = obterMapaEstoqueReal();
    const estDisponivel = mapaEst[nome.toLowerCase()] !== undefined ? mapaEst[nome.toLowerCase()] : 0;

    if (estDisponivel <= 0) {
      return { ok: false, msg: `❌ ${nome} está esgotado no estoque!` };
    }

    const cart = obterCarrinhoCliente(chatId);
    let achou = false;
    let qtdExistente = 0;
    for (let it of cart.itens) {
      if (it.nome.toLowerCase() === nome.toLowerCase()) {
        qtdExistente = it.qtd;
        if (qtdExistente + qtd > estDisponivel) {
          return { ok: false, msg: `Estoque insuficiente! Disponível: ${estDisponivel} un. (Você já tem ${qtdExistente} no carrinho)` };
        }
        it.qtd += qtd;
        achou = true;
        break;
      }
    }
    if (!achou) {
      if (qtd > estDisponivel) {
        return { ok: false, msg: `Estoque insuficiente! Disponível: ${estDisponivel} un.` };
      }
      cart.itens.push({ rowIdx: rowIdx, nome: nome, preco: preco, qtd: qtd });
    }
    salvarCarrinhoCliente(chatId, cart);
    return { ok: true, nome: nome, preco: preco, qtd: qtd };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}

function exibirMenuCategoriasCliente(chatId, messageId) {
  const ss = SpreadsheetApp.getActive();
  const shProd = ss.getSheetByName('PRODUTOS');
  const dados = shProd ? shProd.getDataRange().getValues() : [];
  const mapaEst = obterMapaEstoqueReal();
  const categoriasMap = {};

  for (let i = 1; i < dados.length; i++) {
    const nome = String(dados[i][0] || '').trim();
    const cat = String(dados[i][1] || 'Geral').trim();
    const preco = Number(dados[i][4]) || 0;
    const est = mapaEst[nome.toLowerCase()] !== undefined ? mapaEst[nome.toLowerCase()] : 0;

    // Apenas produtos ativos com preço E ESTOQUE DISPONÍVEL (> 0)
    if (nome && preco > 0 && est > 0) {
      categoriasMap[cat] = (categoriasMap[cat] || 0) + 1;
    }
  }

  const cats = Object.keys(categoriasMap);
  const keyboard = [];

  if (cats.length === 0) {
    const txtVazio = `📋 <b>Cardápio Temporariamente Indisponível</b>\n\n` +
                     `No momento todos os produtos estão com estoque zerado.\n` +
                     `Por favor, tente novamente mais tarde ou fale com um atendente!`;
    const markupVazio = {
      inline_keyboard: [
        [{ text: "💬 Falar com Atendente", callback_data: "client_contact" }],
        [{ text: "◀️ Menu Inicial", callback_data: "menu" }]
      ]
    };
    if (messageId) editarMensagemTelegram(messageId, txtVazio, markupVazio, chatId);
    else enviarMensagemTelegram(txtVazio, markupVazio, chatId);
    return;
  }

  for (let cat of cats) {
    let icon = '📦';
    const cLow = cat.toLowerCase();
    if (cLow.includes('cerveja') || cLow.includes('chopp')) icon = '🍺';
    else if (cLow.includes('destilado') || cLow.includes('whisky') || cLow.includes('vodka') || cLow.includes('gin')) icon = '🥃';
    else if (cLow.includes('vinho') || cLow.includes('espumante')) icon = '🍷';
    else if (cLow.includes('refrigerante') || cLow.includes('suco') || cLow.includes('agua') || cLow.includes('água') || cLow.includes('energetico')) icon = '🥤';
    else if (cLow.includes('gelo') || cLow.includes('carvao') || cLow.includes('carvão')) icon = '🧊';
    else if (cLow.includes('petisco') || cLow.includes('snack') || cLow.includes('salgadinho')) icon = '🍿';
    else if (cLow.includes('cigarro') || cLow.includes('tabacaria')) icon = '🚬';

    keyboard.push([{ text: `${icon} ${cat} (${categoriasMap[cat]})`, callback_data: `cl_cat_${cat}` }]);
  }

  keyboard.push([
    { text: "🛍️ Ver Meu Carrinho", callback_data: "client_view_cart" },
    { text: "◀️ Menu Inicial", callback_data: "menu" }
  ]);

  const nomeDeposito = typeof getNomeDeposito === 'function' ? getNomeDeposito() : 'Gestão de Depósito';
  const txt = `📋 <b>Cardápio de Bebidas & Conveniência</b>\n<i>${nomeDeposito}</i>\n\n` +
              `Selecione uma categoria abaixo para ver os produtos e adicionar ao seu pedido:`;

  if (messageId) {
    editarMensagemTelegram(messageId, txt, { inline_keyboard: keyboard }, chatId);
  } else {
    enviarMensagemTelegram(txt, { inline_keyboard: keyboard }, chatId);
  }
}

function exibirProdutosCategoriaCliente(chatId, categoria, messageId) {
  const ss = SpreadsheetApp.getActive();
  const shProd = ss.getSheetByName('PRODUTOS');
  const dados = shProd ? shProd.getDataRange().getValues() : [];
  const mapaEst = obterMapaEstoqueReal();
  const produtos = [];

  for (let i = 1; i < dados.length; i++) {
    const nome = String(dados[i][0] || '').trim();
    const cat = String(dados[i][1] || 'Geral').trim();
    const preco = Number(dados[i][4]) || 0;
    const est = mapaEst[nome.toLowerCase()] !== undefined ? mapaEst[nome.toLowerCase()] : 0;

    // Apenas produtos da categoria com estoque disponível (> 0)
    if (nome && preco > 0 && cat.toLowerCase() === categoria.toLowerCase() && est > 0) {
      produtos.push({ rowIdx: i + 1, nome: nome, preco: preco, est: est });
    }
  }

  if (produtos.length === 0) {
    const keyboard = [[{ text: "◀️ Voltar às Categorias", callback_data: "client_menu_cats" }]];
    const msg = `⚠️ Todos os itens da categoria <b>${categoria}</b> estão com estoque zerado no momento.`;
    if (messageId) editarMensagemTelegram(messageId, msg, { inline_keyboard: keyboard }, chatId);
    else enviarMensagemTelegram(msg, { inline_keyboard: keyboard }, chatId);
    return;
  }

  let txt = `📂 <b>Categoria: ${categoria}</b>\n` +
            `<i>Toque nos botões para adicionar ao seu carrinho:</i>\n\n`;

  const keyboard = [];

  produtos.forEach((p, idx) => {
    txt += `<b>${idx + 1}. ${p.nome}</b>\n` +
           `   💵 R$ ${p.preco.toFixed(2).replace('.', ',')}  |  📦 <i>Estoque: ${p.est} un.</i>\n\n`;
    
    const botoesLinha = [
      { text: `➕1 ${p.nome.slice(0, 16)}`, callback_data: `cadd_${p.rowIdx}_1` }
    ];
    if (p.est >= 6) {
      botoesLinha.push({ text: `➕6`, callback_data: `cadd_${p.rowIdx}_6` });
    }
    if (p.est >= 12) {
      botoesLinha.push({ text: `➕12`, callback_data: `cadd_${p.rowIdx}_12` });
    }
    keyboard.push(botoesLinha);
  });

  keyboard.push([
    { text: "🛍️ Ver Meu Carrinho", callback_data: "client_view_cart" },
    { text: "📂 Outras Categorias", callback_data: "client_menu_cats" }
  ]);

  if (messageId) {
    editarMensagemTelegram(messageId, txt, { inline_keyboard: keyboard }, chatId);
  } else {
    enviarMensagemTelegram(txt, { inline_keyboard: keyboard }, chatId);
  }
}

function exibirCarrinhoCliente(chatId, messageId) {
  const cart = obterCarrinhoCliente(chatId);
  const itens = cart.itens || [];

  if (itens.length === 0) {
    const txt = `🛍️ <b>Seu Carrinho está Vazio!</b>\n\n` +
                `Você ainda não adicionou nenhum item ao seu pedido.\n` +
                `Explore o cardápio e escolha suas bebidas favoritas!`;
    const markup = {
      inline_keyboard: [
        [{ text: "🛒 Ver Cardápio / Comprar", callback_data: "client_menu_cats" }],
        [{ text: "◀️ Menu Inicial", callback_data: "menu" }]
      ]
    };
    if (messageId) editarMensagemTelegram(messageId, txt, markup, chatId);
    else enviarMensagemTelegram(txt, markup, chatId);
    return;
  }

  let totalGeral = 0;
  let qtdTotal = 0;
  let txt = `🛍️ <b>Seu Carrinho de Compras</b>\n\n`;

  itens.forEach((it, idx) => {
    const sub = Number(it.qtd) * Number(it.preco);
    totalGeral += sub;
    qtdTotal += Number(it.qtd);
    txt += `<b>${idx + 1}. ${it.nome}</b>\n` +
           `   ${it.qtd}x de R$ ${Number(it.preco).toFixed(2).replace('.', ',')} = <b>R$ ${sub.toFixed(2).replace('.', ',')}</b>\n`;
  });

  txt += `\n━━━━━━━━━━━━━━━━━━━━\n` +
         `📦 <b>Total de Itens:</b> ${qtdTotal}\n` +
         `💰 <b>TOTAL DO PEDIDO: R$ ${totalGeral.toFixed(2).replace('.', ',')}</b>\n` +
         `━━━━━━━━━━━━━━━━━━━━\n\n` +
         `Deseja finalizar ou adicionar mais itens?`;

  const markup = {
    inline_keyboard: [
      [{ text: `✅ Finalizar Pedido (R$ ${totalGeral.toFixed(2).replace('.', ',')})`, callback_data: "client_checkout_step1" }],
      [
        { text: "➕ Adicionar Mais Itens", callback_data: "client_menu_cats" },
        { text: "🗑️ Esvaziar Carrinho", callback_data: "client_clear_cart" }
      ],
      [{ text: "◀️ Menu Inicial", callback_data: "menu" }]
    ]
  };

  if (messageId) editarMensagemTelegram(messageId, txt, markup, chatId);
  else enviarMensagemTelegram(txt, markup, chatId);
}

function iniciarCheckoutCliente(chatId, messageId) {
  const cart = obterCarrinhoCliente(chatId);
  if (!cart.itens || cart.itens.length === 0) {
    exibirCarrinhoCliente(chatId, messageId);
    return;
  }

  const cache = CacheService.getScriptCache();
  cache.put('state_' + chatId, 'AWAITING_CLIENT_NAME', 600);

  const txt = `🛵 <b>Finalização do Pedido Delivery (Passo 1/3)</b>\n\n` +
              `👤 <b>Para quem devemos entregar?</b>\n` +
              `Por favor, <b>digite o seu Nome Completo</b> no chat abaixo:`;
  const markup = {
    inline_keyboard: [[{ text: "❌ Cancelar Pedido", callback_data: "client_view_cart" }]]
  };

  if (messageId) editarMensagemTelegram(messageId, txt, markup, chatId);
  else enviarMensagemTelegram(txt, markup, chatId);
}

function exibirOpcoesPagamentoCliente(chatId, messageId) {
  const cart = obterCarrinhoCliente(chatId);
  const total = (cart.itens || []).reduce((acc, it) => acc + (Number(it.qtd) * Number(it.preco) || 0), 0);

  const txt = `💳 <b>Forma de Pagamento (Passo 3/3)</b>\n\n` +
              `👤 <b>Cliente:</b> ${cart.nomeCliente || 'Cliente'}\n` +
              `📞 <b>Telefone:</b> ${cart.telefone || 'Não informado'}\n` +
              `📍 <b>Endereço:</b> ${cart.endereco || 'A combinar'}\n` +
              `💰 <b>Total a Pagar: R$ ${total.toFixed(2).replace('.', ',')}</b>\n\n` +
              `Como você deseja realizar o pagamento?`;

  const markup = {
    inline_keyboard: [
      [{ text: "📱 PIX (Chave Instantânea)", callback_data: "client_pay_PIX" }],
      [{ text: "💳 Cartão (Débito/Crédito na Entrega)", callback_data: "client_pay_CARTAO" }],
      [{ text: "💵 Dinheiro", callback_data: "client_pay_DINHEIRO" }],
      [{ text: "❌ Cancelar", callback_data: "client_view_cart" }]
    ]
  };

  if (messageId) editarMensagemTelegram(messageId, txt, markup, chatId);
  else enviarMensagemTelegram(txt, markup, chatId);
}

function garantirEstruturaDelivery() {
  const ss = SpreadsheetApp.getActive();
  let del = ss.getSheetByName('DELIVERY');
  if (!del) {
    del = ss.insertSheet('DELIVERY');
  }
  const headersEsperados = ['Pedido','Data','Cliente','Produto','Qtd','Total','Pagamento','Status','Entregador','Endereço','ID_PEDIDO'];
  const lastCol = Math.max(del.getLastColumn(), 1);
  const atual = del.getRange(1, 1, 1, Math.max(lastCol, 11)).getValues()[0];

  // Se a coluna J (10) for ID_VENDA ou ID_PEDIDO e não houver Endereço
  if (String(atual[9] || '').toUpperCase().includes('ID_')) {
    del.insertColumnBefore(10);
  }
  del.getRange(1, 1, 1, headersEsperados.length).setValues([headersEsperados]);
  del.getRange(1, 1, 1, headersEsperados.length)
     .setBackground('#0f172a')
     .setFontColor('#ffffff')
     .setFontWeight('bold');
  return del;
}

function obterChatIdsGerentesEDono() {
  const ids = new Set();
  try {
    const ss = SpreadsheetApp.getActive();
    // 1. Pega do CONFIG
    const donoConfig = typeof getConfig === 'function' ? getConfig('TELEGRAM_DONO_CHAT_ID') : '';
    if (donoConfig) {
      const clean = String(donoConfig).trim().split('.')[0];
      if (clean) ids.add(clean);
    }

    // 2. Pega de todos os DONO / GERENTE / GERENCIAL na aba USUARIOS
    const shUsuarios = ss.getSheetByName('USUARIOS');
    if (shUsuarios) {
      const dados = shUsuarios.getDataRange().getValues();
      for (let i = 1; i < dados.length; i++) {
        const perfil = String(dados[i][4] || '').toUpperCase().trim();
        const ativo = String(dados[i][5] || '').toUpperCase().trim();
        const chatIdUser = String(dados[i][8] || '').trim().split('.')[0]; // Coluna 9 (index 8)
        if (ativo === 'SIM' && (perfil === 'DONO' || perfil === 'GERENTE' || perfil === 'GERENCIAL' || perfil === 'ADMIN') && chatIdUser) {
          ids.add(chatIdUser);
        }
      }
    }
  } catch(e) {
    console.error('Erro em obterChatIdsGerentesEDono:', e);
  }
  return Array.from(ids);
}

function finalizarPedidoCliente(chatId, formaPgto, trocoInfo) {
  try {
    const cart = obterCarrinhoCliente(chatId);
    if (!cart.itens || cart.itens.length === 0) {
      enviarMensagemTelegram("❌ Seu carrinho está vazio.", null, chatId);
      return;
    }

    const ss = SpreadsheetApp.getActive();
    const del = garantirEstruturaDelivery();

    let itensSh = ss.getSheetByName('DELIVERY_ITENS');
    if (!itensSh) {
      itensSh = ss.insertSheet('DELIVERY_ITENS');
      itensSh.getRange('A1:F1').setValues([[
        'Pedido','Produto','Qtd','Valor Unit','Total','EstoqueBaixado'
      ]]);
      itensSh.getRange('A1:F1')
        .setBackground('#0f172a')
        .setFontColor('#ffffff')
        .setFontWeight('bold');
    }

    const pedido = typeof gerarNumeroDelivery === 'function' ? gerarNumeroDelivery() : (del.getLastRow() + 1);
    const idPedido = typeof gerarIdVendaDelivery === 'function' ? gerarIdVendaDelivery(pedido) : ('DEL-' + String(pedido).padStart(6, '0'));
    const qtdTotal = cart.itens.reduce((acc, it) => acc + Number(it.qtd), 0);
    const totalGeral = cart.itens.reduce((acc, it) => acc + (Number(it.qtd) * Number(it.preco)), 0);
    const pagamentoFinal = formaPgto + (trocoInfo ? ` (${trocoInfo})` : '');
    const enderecoFormatado = (cart.endereco || '') + (cart.telefone ? ` | Tel: ${cart.telefone}` : '');

    const statusInicial = (formaPgto === 'PIX') ? 'AGUARDANDO PAGAMENTO' : 'PEDIDO FEITO';

    // Salva o chatId do cliente para notificações posteriores (aprovação/rejeição de PIX)
    try {
      PropertiesService.getScriptProperties().setProperty('deliv_chat_' + pedido, String(chatId));
    } catch(eProp) {}

    // 1. Grava na aba DELIVERY com as 11 colunas corretas incluindo ID_PEDIDO
    del.appendRow([
      pedido,            // 1. Pedido
      new Date(),        // 2. Data
      cart.nomeCliente || 'Cliente Telegram', // 3. Cliente
      'VER ITENS',       // 4. Produto
      qtdTotal,          // 5. Qtd
      totalGeral,        // 6. Total
      pagamentoFinal,    // 7. Pagamento
      statusInicial,     // 8. Status
      'Não atribuído',   // 9. Entregador
      enderecoFormatado, // 10. Endereço
      idPedido           // 11. ID_PEDIDO
    ]);

    // 2. Grava na aba DELIVERY_ITENS e DÁ BAIXA REAL NO ESTOQUE (aba ESTOQUE)
    let resumoItens = '';
    const shEst = ss.getSheetByName('ESTOQUE');
    const dadosEst = shEst ? shEst.getDataRange().getValues() : [];

    cart.itens.forEach((it, idx) => {
      const sub = Number(it.qtd) * Number(it.preco);
      resumoItens += `• ${it.qtd}x ${it.nome} - R$ ${sub.toFixed(2).replace('.', ',')}\n`;
      itensSh.appendRow([
        pedido,
        it.nome,
        Number(it.qtd),
        Number(it.preco),
        sub,
        'SIM'
      ]);

      // 🔹 Baixa real na aba ESTOQUE (Coluna B / 2)
      if (shEst) {
        for (let i = 1; i < dadosEst.length; i++) {
          const nomeEst = String(dadosEst[i][0] || '').trim().toLowerCase();
          if (nomeEst === it.nome.trim().toLowerCase()) {
            const estAtual = Number(dadosEst[i][1]) || 0;
            const novaQtd = Math.max(0, estAtual - Number(it.qtd));
            shEst.getRange(i + 1, 2).setValue(novaQtd);

            // Atualiza status do estoque
            const min = Number(dadosEst[i][2]) || 0;
            let status = '🟢   OK   🔋';
            if (novaQtd <= 0 || novaQtd <= min) {
              status = '🔴 Crítico🪫';
            } else if (novaQtd <= min * 2) {
              status = '🟡 Baixo';
            }
            shEst.getRange(i + 1, 4).setValue(status);
            break;
          }
        }
      }
    });

    // 🔄 Sincroniza estoque global e dashboards
    if (typeof atualizarEstoque === 'function') {
      try { atualizarEstoque(); } catch(e) {}
    }

    // 3. Limpa o carrinho
    limparCarrinhoCliente(chatId);

    // 4. Mensagem para o Cliente
    const nomeDeposito = typeof getNomeDeposito === 'function' ? getNomeDeposito() : 'Gestão de Depósito';
    const chavePix = typeof getConfig === 'function' ? (getConfig('CHAVE_PIX') || getConfig('PIX_CHAVE') || '') : '';

    const markupCliente = {
      inline_keyboard: [
        [{ text: "📦 Acompanhar Meus Pedidos", callback_data: "client_my_orders" }],
        [{ text: "🏠 Voltar ao Início", callback_data: "menu" }]
      ]
    };

    if (formaPgto === 'PIX' && chavePix) {
      const nomeRecebedor = typeof getConfig === 'function' ? (getConfig('DONO') || 'DEPOSITO') : 'DEPOSITO';
      const cidadeRecebedor = typeof getConfig === 'function' ? (getConfig('CIDADE') || 'SALVADOR') : 'SALVADOR';
      const txId = ('DEL' + pedido).replace(/[^A-Za-z0-9]/g, '').slice(0, 25);
      const payloadPix = gerarPayloadPixBRCodeTelegram(chavePix, nomeRecebedor, cidadeRecebedor, totalGeral, txId);
      const qrCodeUrl = "https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&ecc=M&data=" + encodeURIComponent(payloadPix);

      const captionPix = `🎉 <b>PEDIDO RECEBIDO COM SUCESSO!</b>\n\n` +
                         `📦 <b>Pedido:</b> <code>#DEL-${pedido}</code>\n` +
                         `🏢 <b>Estabelecimento:</b> ${nomeDeposito}\n` +
                         `👤 <b>Cliente:</b> ${cart.nomeCliente}\n` +
                         `📍 <b>Entrega:</b> ${cart.endereco}\n` +
                         `💰 <b>TOTAL: R$ ${totalGeral.toFixed(2).replace('.', ',')}</b>\n\n` +
                         `📱 <b>PAGAMENTO VIA PIX (QR CODE & COPIA E COLA):</b>\n` +
                         `Escaneie a imagem do QR Code acima no app do seu banco ou use a chave abaixo:\n\n` +
                         `🔑 <b>PIX Copia e Cola:</b>\n` +
                         `<code>${payloadPix}</code>\n\n` +
                         `📸 <b>ENVIO DO COMPROVANTE:</b>\n` +
                         `Após pagar, <b>envie a foto ou print do comprovante aqui no chat</b>. Assim que confirmarmos, seu pedido será despachado! 🛵💨`;

      enviarFotoTelegram(qrCodeUrl, captionPix, markupCliente, chatId);

      // Salva estado para interceptar a foto do comprovante enviada pelo cliente
      const cache = CacheService.getScriptCache();
      cache.put('state_' + chatId, 'AWAITING_DELIVERY_PIX_RECEIPT:' + pedido, 3600);
    } else {
      let msgCliente = `🎉 <b>PEDIDO RECEBIDO COM SUCESSO!</b>\n\n` +
                       `📦 <b>Pedido:</b> <code>#DEL-${pedido}</code>\n` +
                       `🏢 <b>Estabelecimento:</b> ${nomeDeposito}\n` +
                       `👤 <b>Cliente:</b> ${cart.nomeCliente}\n` +
                       `📍 <b>Entrega:</b> ${cart.endereco}\n` +
                       `💳 <b>Pagamento:</b> ${pagamentoFinal}\n\n` +
                       `📋 <b>Itens do Pedido:</b>\n${resumoItens}\n` +
                       `💰 <b>TOTAL: R$ ${totalGeral.toFixed(2).replace('.', ',')}</b>\n\n` +
                       `⏳ <i>Seu pedido já foi enviado para a nossa equipe e está sendo preparado!</i>`;
      enviarMensagemTelegram(msgCliente, markupCliente, chatId);
    }

    // 5. Notificação para o Dono / Gerentes
    const gestoresChatIds = obterChatIdsGerentesEDono();
    const avisoPagto = (formaPgto === 'PIX') ? ' (⏳ Aguardando Comprovante PIX)' : '';
    const msgDono = `🚨 <b>NOVO PEDIDO DELIVERY #DEL-${pedido} RECEBIDO!</b>\n\n` +
                    `👤 <b>Cliente:</b> ${cart.nomeCliente} (${cart.telefone || 'Sem tel'})\n` +
                    `📍 <b>Endereço:</b> ${cart.endereco}\n` +
                    `💳 <b>Pagamento:</b> ${pagamentoFinal}${avisoPagto}\n\n` +
                    `📋 <b>Itens:</b>\n${resumoItens}\n` +
                    `💰 <b>TOTAL: R$ ${totalGeral.toFixed(2).replace('.', ',')}</b>\n\n` +
                    `<i>Toque no botão abaixo para gerenciar o pedido:</i>`;
    const markupDono = {
      inline_keyboard: [
        [{ text: `🛵 Ver Pedido #${pedido}`, callback_data: `deliv_info_${pedido}` }],
        [{ text: "📦 Painel Delivery", callback_data: "deliv_menu" }]
      ]
    };

    if (gestoresChatIds.length > 0) {
      gestoresChatIds.forEach(targetId => {
        try {
          enviarMensagemTelegram(msgDono, markupDono, targetId);
        } catch(errNotif) {
          console.warn('Falha ao notificar gestor ' + targetId, errNotif);
        }
      });
    } else {
      try {
        enviarMensagemTelegram(msgDono, markupDono, chatId);
      } catch(e) {}
    }

  } catch(e) {
    enviarMensagemTelegram("❌ Erro ao registrar pedido: " + e.message, null, chatId);
  }
}

function exibirMeusPedidosCliente(chatId, messageId) {
  const ss = SpreadsheetApp.getActive();
  const shDel = ss.getSheetByName('DELIVERY');
  if (!shDel) {
    enviarMensagemTelegram("Nenhum pedido encontrado.", null, chatId);
    return;
  }

  const dados = shDel.getDataRange().getValues();
  const pedidos = [];

  for (let i = dados.length - 1; i >= 1; i--) {
    const obs = String(dados[i][9] || '');
    const status = String(dados[i][7] || 'PEDIDO FEITO').toUpperCase();
    // Identifica se é do cliente pelo chatId ou lista os mais recentes
    pedidos.push({
      pedido: dados[i][0],
      data: dados[i][1],
      cliente: dados[i][2],
      total: Number(dados[i][5]) || 0,
      pagamento: dados[i][6],
      status: status
    });
    if (pedidos.length >= 5) break;
  }

  if (pedidos.length === 0) {
    const txt = `📦 <b>Meus Pedidos</b>\n\nVocê ainda não possui pedidos recentes registrados.`;
    const markup = {
      inline_keyboard: [
        [{ text: "🛒 Fazer Pedido Agora", callback_data: "client_menu_cats" }],
        [{ text: "◀️ Menu Inicial", callback_data: "menu" }]
      ]
    };
    if (messageId) editarMensagemTelegram(messageId, txt, markup, chatId);
    else enviarMensagemTelegram(txt, markup, chatId);
    return;
  }

  let txt = `📦 <b>Histórico de Pedidos Recentes</b>\n\n`;
  pedidos.forEach(p => {
    let iconStatus = '⏳';
    if (p.status.includes('PREPAR')) iconStatus = '🧑‍🍳';
    else if (p.status.includes('SAIU') || p.status.includes('ROTA') || p.status.includes('ENTREGA')) iconStatus = '🛵';
    else if (p.status.includes('ENTREGUE') || p.status.includes('FINALIZ')) iconStatus = '✅';
    else if (p.status.includes('CANCEL')) iconStatus = '❌';

    txt += `• <b>#DEL-${p.pedido}</b> - R$ ${p.total.toFixed(2).replace('.', ',')}\n` +
           `   Status: ${iconStatus} <b>${p.status}</b> | ${p.pagamento}\n\n`;
  });

  const markup = {
    inline_keyboard: [
      [{ text: "🛒 Fazer Novo Pedido", callback_data: "client_menu_cats" }],
      [{ text: "◀️ Menu Inicial", callback_data: "menu" }]
    ]
  };

  if (messageId) editarMensagemTelegram(messageId, txt, markup, chatId);
  else enviarMensagemTelegram(txt, markup, chatId);
}

function exibirContatoAtendente(chatId, messageId) {
  const nomeDeposito = typeof getNomeDeposito === 'function' ? getNomeDeposito() : 'Gestão de Depósito';
  const tel = typeof getConfig === 'function' ? (getConfig('TELEFONE') || '') : '';
  const dono = typeof getConfig === 'function' ? (getConfig('DONO') || 'Atendimento') : 'Atendimento';
  const cidade = typeof getConfig === 'function' ? (getConfig('CIDADE') || '') : '';

  const txt = `💬 <b>Central de Atendimento - ${nomeDeposito}</b>\n\n` +
              `👤 <b>Responsável:</b> ${dono}\n` +
              `📞 <b>Telefone / WhatsApp:</b> ${tel || 'Não configurado'}\n` +
              `🏙️ <b>Cidade / Localização:</b> ${cidade || 'Central'}\n\n` +
              `Precisa de ajuda com seu pedido ou tirar dúvidas? Envie uma mensagem pelo WhatsApp ou aguarde nosso retorno por aqui!`;

  const markup = {
    inline_keyboard: [
      [{ text: "🛒 Fazer Pedido", callback_data: "client_menu_cats" }],
      [{ text: "◀️ Menu Inicial", callback_data: "menu" }]
    ]
  };

  if (messageId) editarMensagemTelegram(messageId, txt, markup, chatId);
  else enviarMensagemTelegram(txt, markup, chatId);
}

/**
 * Obtém a lista de comandas abertas formatada para o Telegram
 */
function obterComandasAbertasTelegram() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('COMANDAS');
  if(!sh) return [];
  const dados = sh.getDataRange().getValues();
  const abertas = [];
  for(let i=1; i<dados.length; i++){
    const status = String(dados[i][4]).toUpperCase().trim();
    if(status === 'ABERTA' || status === 'AGUARDANDO_PGTO'){
      abertas.push({
        pedido: dados[i][0],
        data: dados[i][1],
        cliente: dados[i][2],
        origem: dados[i][3],
        status: status
      });
    }
  }
  return abertas;
}

/**
 * Obtém a lista de pedidos de delivery ativos
 */
function obterDeliveriesAtivosTelegram() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('DELIVERY');
  if(!sh) return [];
  const dados = sh.getDataRange().getValues();
  const ativos = [];
  for(let i=1; i<dados.length; i++){
    const status = String(dados[i][7] || '').toUpperCase().trim();
    // Apenas pedidos que NÃO foram ENTREGUE, FINALIZADO ou CANCELADO
    if(status && status !== 'ENTREGUE' && status !== 'CANCELADO' && status !== 'FINALIZADO'){
      ativos.push({
        pedido: dados[i][0],
        data: dados[i][1],
        cliente: dados[i][2] || 'Consumidor',
        total: Number(dados[i][5]) || 0,
        pagamento: dados[i][6] || 'Dinheiro',
        status: status,
        entregador: dados[i][8] || 'Não atribuído'
      });
    }
  }
  return ativos;
}

/**
 * Obtém a lista detalhada de produtos em estoque crítico lendo a aba ESTOQUE
 */
function obterProdutosEstoqueCriticoTelegram() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('ESTOQUE');
  if (!sh) return [];
  const dados = sh.getDataRange().getValues();
  if (dados.length <= 1) return [];

  const criticos = [];
  for (let i = 1; i < dados.length; i++) {
    const nome = String(dados[i][0] || '').trim();
    if (!nome) continue;

    const qtd = Number(dados[i][1]) || 0;
    const min = Number(dados[i][2]) || 0;
    const status = String(dados[i][3] || '').trim();
    const statusNorm = status.toLowerCase();

    const isCritico = statusNorm.includes('crítico') || 
                      statusNorm.includes('critico') || 
                      status.includes('🔴') || 
                      status.includes('🪫') ||
                      qtd <= min || 
                      qtd <= 0;

    if (isCritico) {
      criticos.push({
        produto: nome,
        qtd: qtd,
        minimo: min,
        status: status || (qtd <= 0 ? '🔴 Zerado' : '🔴 Crítico')
      });
    }
  }

  // Ordena os que têm menor estoque primeiro
  criticos.sort((a, b) => a.qtd - b.qtd);
  return criticos;
}

/**
 * Exibe o diagnóstico completo de lucratividade de um produto no Telegram
 */
function exibirAnaliseProdutoTelegram(rowIdx, chatId, messageId) {
  try {
    const ss = SpreadsheetApp.getActive();
    const shProd = ss.getSheetByName('PRODUTOS');
    if (!shProd) return;
    const rowData = shProd.getRange(rowIdx, 1, 1, shProd.getLastColumn()).getValues()[0];
    const nome = String(rowData[0] || '').trim();

    const info = typeof buscarDadosProduto === 'function' ? buscarDadosProduto(nome) : null;
    if (!info) {
      enviarMensagemTelegram(`❌ Produto não localizado na planilha.`, null, chatId);
      return;
    }

    const margemPct = Number(info.margem || 0).toFixed(1);
    const totalBlocos = 10;
    const scoreVal = Number(info.score) || 0;
    const preenchidos = Math.max(0, Math.min(10, Math.round((scoreVal / 15) * 10)));
    const blocoCor = scoreVal <= 7 ? '🟥' : (scoreVal <= 11 ? '🟨' : '🟩');
    const barraGauge = blocoCor.repeat(preenchidos) + '⬜'.repeat(totalBlocos - preenchidos);
    const statusSaude = scoreVal <= 7 ? '🔴 Baixo Desempenho / Risco' : (scoreVal <= 11 ? '🟡 Regular / Atenção' : '🟢 Excelente Lucratividade');

    const msg = `📊 <b>Análise de Produto</b>\n\n` +
                `🏷️ <b>Produto:</b> <b>${info.nome || nome}</b>\n\n` +
                `📦 <b>Estoque Atual:</b> <b>${info.qtd} unidade(s)</b>\n` +
                `💰 <b>Preço Unitário:</b> <b>R$ ${Number(info.preco).toFixed(2)}</b>\n` +
                `📉 <b>Custo Unitário:</b> <b>R$ ${Number(info.custo).toFixed(2)}</b>\n` +
                `📈 <b>Margem Atual:</b> <b>${margemPct}%</b>\n` +
                `💡 <b>Preço Sugerido:</b> <b>R$ ${Number(info.precoSugerido).toFixed(2)}</b>\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n` +
                `📈 <b>ÍNDICE DE GANHO (SCORE):</b>\n` +
                `${barraGauge} <b>(${scoreVal}/15)</b>\n` +
                `🩺 <b>Status:</b> ${statusSaude}\n` +
                `━━━━━━━━━━━━━━━━━━━━━`;

    const buttons = {
      inline_keyboard: [
        [
          { text: "📈 Ajustar Margem %", callback_data: `prod_chg_margem_${rowIdx}` },
          { text: "💵 Alterar Preço", callback_data: `prod_chg_price_${rowIdx}` }
        ],
        [
          { text: "🔍 Analisar Outro Produto", callback_data: "prod_analise_search" },
          { text: "📋 Lista de Análise", callback_data: "prod_analise_menu" }
        ],
        [
          { text: "◀️ Menu Principal", callback_data: "menu" }
        ]
      ]
    };

    if (messageId && Number(messageId) > 0) {
      editarMensagemTelegram(messageId, msg, buttons, chatId);
    } else {
      enviarMensagemTelegram(msg, buttons, chatId);
    }
  } catch(err) {
    enviarMensagemTelegram("❌ Erro ao exibir análise: " + err.message, null, chatId);
  }
}

/**
 * Cria um pedido de delivery simples no Telegram
 */
function criarDeliverySimplesTelegram(cliente, formaPgto) {
  const ss = SpreadsheetApp.getActive();
  const del = typeof garantirEstruturaDelivery === 'function' ? garantirEstruturaDelivery() : ss.getSheetByName('DELIVERY');
  const pedido = typeof gerarNumeroDelivery === 'function' ? gerarNumeroDelivery() : (del.getLastRow() + 1);
  const idPedido = typeof gerarIdVendaDelivery === 'function' ? gerarIdVendaDelivery(pedido) : ('DEL-' + String(pedido).padStart(6, '0'));
  del.appendRow([
    pedido,
    new Date(),
    cliente || 'Consumidor',
    'VER ITENS',
    0,
    0,
    formaPgto || 'Dinheiro',
    'PEDIDO FEITO',
    'Não atribuído',
    'Balcão / A combinar',
    idPedido
  ]);
  return pedido;
}

/**
 * Obtém o resumo e clientes com fiados em aberto da aba CONTAS_A_RECEBER
 */
function obterContasReceberTelegram() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('CONTAS_A_RECEBER');
  if (!sh) return { totalGeral: 0, clientes: [] };

  const dados = sh.getDataRange().getValues();
  const mapaClientes = {};
  let totalGeral = 0;

  for (let i = 1; i < dados.length; i++) {
    const id = String(dados[i][0] || '').trim();
    const origem = String(dados[i][1] || 'COMANDA');
    const ref = String(dados[i][2] || '');
    const cliente = String(dados[i][3] || '').trim();
    const total = Number(dados[i][4]) || 0;
    const recebido = Number(dados[i][5]) || 0;
    const saldo = Number(dados[i][6]) || 0;
    const status = String(dados[i][8] || '').toUpperCase().trim();
    const data = dados[i][9];

    if (!cliente || status === 'QUITADO' || saldo <= 0) continue;

    totalGeral += saldo;
    if (!mapaClientes[cliente]) {
      mapaClientes[cliente] = {
        nome: cliente,
        saldoTotal: 0,
        contas: []
      };
    }
    mapaClientes[cliente].saldoTotal += saldo;
    mapaClientes[cliente].contas.push({
      id: id,
      rowIdx: i + 1,
      origem: origem,
      referencia: ref,
      total: total,
      recebido: recebido,
      saldo: saldo,
      data: data
    });
  }

  const clientesArray = Object.values(mapaClientes);
  // Ordena os maiores devedores primeiro
  clientesArray.sort((a, b) => b.saldoTotal - a.saldoTotal);

  return {
    totalGeral: totalGeral,
    clientes: clientesArray
  };
}

/**
 * Registra o recebimento (total ou parcial) de fiado de um cliente
 */
function receberFiadoClienteTelegram(nomeCliente, valor, forma) {
  valor = Number(valor);
  if (isNaN(valor) || valor <= 0) {
    return { ok: false, msg: "Valor inválido informado." };
  }

  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('CONTAS_A_RECEBER');
  if (!sh) return { ok: false, msg: "Aba CONTAS_A_RECEBER não encontrada." };

  const dados = sh.getDataRange().getValues();
  const safeNorm = str => String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
  const cliNorm = safeNorm(nomeCliente);

  let restante = valor;
  let baixas = 0;

  for (let i = 1; i < dados.length; i++) {
    const cli = String(dados[i][3] || '').trim();
    const status = String(dados[i][8] || '').toUpperCase().trim();
    const saldo = Number(dados[i][6]) || 0;

    if (safeNorm(cli) === cliNorm && status !== 'QUITADO' && saldo > 0) {
      const id = String(dados[i][0]);
      const valorParaEstaConta = Math.min(saldo, restante);
      const recebidoAtual = Number(dados[i][5]) || 0;
      const totalConta = Number(dados[i][4]) || 0;

      const novoRecebido = recebidoAtual + valorParaEstaConta;
      const novoSaldo = Math.max(0, totalConta - novoRecebido);

      sh.getRange(i + 1, 6).setValue(novoRecebido);
      sh.getRange(i + 1, 7).setValue(novoSaldo);
      sh.getRange(i + 1, 9).setValue(novoSaldo <= 0.001 ? 'QUITADO' : 'PARCIAL');

      // Registra no Caixa
      if (typeof inserirLinhaNoTopo === 'function') {
        inserirLinhaNoTopo('CAIXA', [
          agoraBrasil(),
          'Entrada',
          valorParaEstaConta,
          forma || 'Pix',
          `RECEBIMENTO FIADO - ${nomeCliente} (${id})`
        ]);
      }

      if (typeof registrarLog === 'function') {
        registrarLog('RECEBIMENTO_FIADO', nomeCliente, id, `R$ ${valorParaEstaConta.toFixed(2)} (${forma})`);
      }

      baixas++;
      restante -= valorParaEstaConta;
      if (restante <= 0) break;
    }
  }

  if (baixas === 0) {
    return { ok: false, msg: `Nenhum fiado em aberto localizado para ${nomeCliente}.` };
  }

  return { ok: true, valorRecebido: valor - restante };
}

/**
 * Lança item no delivery no Telegram
 */
function salvarItemDeliveryTelegram(pedido, produto, qtd, unit) {
  const ss = SpreadsheetApp.getActive();
  let itensSh = ss.getSheetByName('DELIVERY_ITENS');
  if(!itensSh){
    itensSh = ss.insertSheet('DELIVERY_ITENS');
    itensSh.getRange('A1:F1').setValues([[
      'Pedido','Produto','Qtd','Valor Unit','Total','EstoqueBaixado'
    ]]);
  }
  const totalItem = Number(qtd) * Number(unit);
  itensSh.appendRow([
    pedido,
    produto,
    Number(qtd),
    Number(unit),
    totalItem,
    'NAO'
  ]);

  // Atualiza o total e quantidade de itens na aba DELIVERY
  const del = ss.getSheetByName('DELIVERY');
  if(del){
    const dados = del.getDataRange().getValues();
    for(let i=1; i<dados.length; i++){
      if(pedidosCorrespondem(dados[i][0], pedido) || String(dados[i][0]) === String(pedido) || Number(dados[i][0]) == Number(pedido)){
        const totalAtual = Number(dados[i][5]) || 0;
        const qtdAtual = Number(dados[i][4]) || 0;
        del.getRange(i+1, 5).setValue(qtdAtual + Number(qtd));
        del.getRange(i+1, 6).setValue(totalAtual + totalItem);
        break;
      }
    }
  }
}

// =============================================
// 🛒 MÓDULO DE COMPRAS & ENTRADA DE MERCADORIAS
// =============================================

const DRIVE_ROOT_FOLDER_ID = '1z5JjtXhuuC5z_qUjpfW91vy8_dlWN4Sq';

function obterOuCriarSubpastaPorNome(parentFolder, nomeSubpasta) {
  const pastas = parentFolder.getFoldersByName(nomeSubpasta);
  if (pastas.hasNext()) {
    return pastas.next();
  }
  return parentFolder.createFolder(nomeSubpasta);
}

function obterOuCriarPastaNotasMesVigente(dataRef) {
  try {
    const data = dataRef || new Date();
    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
    const ano = Utilities.formatDate(data, "America/Sao_Paulo", "yyyy");
    const mesNum = Utilities.formatDate(data, "America/Sao_Paulo", "MM");
    const mesNome = meses[data.getMonth()];
    const nomePastaMes = `${mesNum} - ${mesNome} ${ano}`; // Ex: "08 - Agosto 2026"

    let rootFolder;
    try {
      rootFolder = DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID);
    } catch(e) {
      console.warn('Não foi possível abrir pasta por ID, buscando por raiz do Drive:', e);
      rootFolder = DriveApp.getRootFolder();
    }

    const pastaCompras = obterOuCriarSubpastaPorNome(rootFolder, 'Compras');
    const pastaNotas = obterOuCriarSubpastaPorNome(pastaCompras, 'Notas');
    const pastaMes = obterOuCriarSubpastaPorNome(pastaNotas, nomePastaMes);

    return pastaMes;
  } catch(err) {
    console.error('Erro em obterOuCriarPastaNotasMesVigente:', err);
    return null;
  }
}

function obterLinkPastaNotasMesVigente() {
  const pastaMes = obterOuCriarPastaNotasMesVigente();
  if (pastaMes) {
    return `https://drive.google.com/drive/folders/${pastaMes.getId()}`;
  }
  return `https://drive.google.com/drive/folders/${DRIVE_ROOT_FOLDER_ID}`;
}

function getTelegramToken() {
  if (typeof getConfig === 'function') {
    return getConfig('TELEGRAM_BOT_TOKEN') || getConfig('TELEGRAM_TOKEN') || '';
  }
  return '';
}

function baixarArquivoTelegram(fileId) {
  try {
    const token = getTelegramToken();
    if (!token) {
      console.error('TELEGRAM_BOT_TOKEN não encontrado nas configurações.');
      return null;
    }
    const res = UrlFetchApp.fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    const json = JSON.parse(res.getContentText());
    if (json.ok && json.result && json.result.file_path) {
      const fileUrl = `https://api.telegram.org/file/bot${token}/${json.result.file_path}`;
      const fileRes = UrlFetchApp.fetch(fileUrl);
      return fileRes.getBlob();
    }
  } catch(e) {
    console.error('Erro em baixarArquivoTelegram:', e);
  }
  return null;
}

// =============================================
// 🧠 LEITURA DE NOTAS FISCAIS POR IA (GEMINI VISION)
// =============================================

function normalizarTextoParaBusca(t) {
  return String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, ' ').toLowerCase().trim();
}

function encontrarMelhorProdutoCorrespondente(nomeIA, listaProdutos) {
  if (!listaProdutos || listaProdutos.length === 0) return nomeIA;
  const normIA = normalizarTextoParaBusca(nomeIA);
  const palavrasIA = normIA.split(/\s+/).filter(p => p.length > 1);
  
  let melhorProd = nomeIA;
  let maiorPontuacao = 0;

  for (let i = 0; i < listaProdutos.length; i++) {
    const prodDb = listaProdutos[i];
    const normDb = normalizarTextoParaBusca(prodDb);
    if (normDb === normIA) return prodDb;

    let score = 0;
    palavrasIA.forEach(w => {
      if (normDb.includes(w)) score += 2;
    });
    const palavrasDb = normDb.split(/\s+/).filter(p => p.length > 1);
    palavrasDb.forEach(w => {
      if (normIA.includes(w)) score += 1;
    });

    if (score > maiorPontuacao && score >= 2) {
      maiorPontuacao = score;
      melhorProd = prodDb;
    }
  }
  return melhorProd;
}

function obterListaNomesProdutosCadastrados() {
  try {
    const ss = SpreadsheetApp.getActive();
    const shProd = ss.getSheetByName('PRODUTOS');
    if (!shProd) return [];
    const dados = shProd.getDataRange().getValues();
    const lista = [];
    for (let i = 1; i < dados.length; i++) {
      const n = String(dados[i][0] || '').trim();
      if (n) lista.push(n);
    }
    return lista;
  } catch(e) {
    return [];
  }
}

function analisarNotaFiscalComIA(blobImagem) {
  try {
    let apiKey = '';
    if (typeof getConfig === 'function') {
      apiKey = getConfig('GEMINI_API_KEY') || getConfig('GOOGLE_API_KEY') || '';
    }
    if (!apiKey) {
      apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') || '';
    }

    if (!apiKey) {
      return {
        sucesso: false,
        motivo: 'SEM_API_KEY',
        msg: 'Chave GEMINI_API_KEY não configurada na aba CONFIG ou Script Properties.'
      };
    }

    const base64Data = Utilities.base64Encode(blobImagem.getBytes());
    let mimeType = blobImagem.getContentType() || 'image/jpeg';
    if (mimeType.includes('pdf')) mimeType = 'application/pdf';
    else if (!mimeType.includes('image')) mimeType = 'image/jpeg';

    const prodsDb = obterListaNomesProdutosCadastrados();
    const listaExemplos = prodsDb.slice(0, 60).join(', ');

    const prompt = `Você é um especialista em OCR e leitura inteligente de Notas Fiscais, NFC-e, DANFE, Cupons Fiscais e QR Codes de Depósitos e Lojas de Construção/Bebidas.
Analise com extrema precisão a imagem da nota fiscal/cupom (inclusive textos, números, QR Code e Chave de Acesso de 44 dígitos) e extraia:
1. Fornecedor / Empresa emissora no cabeçalho (Razão Social ou Nome Fantasia).
2. Número do documento ou da NFC-e / Danfe.
3. Chave de acesso de 44 dígitos (ex: 2926 0810 2304 8000 0300 6500 2015 8303 9212 0471 0225) se visível.
4. Data de emissão.
5. Forma de Pagamento (PIX, DINHEIRO, BOLETO, CARTAO, A PRAZO).
6. Valor total pago/a pagar.
7. Lista completa de itens/produtos comprados, contendo:
   - produto: Descrição do produto clara e sem abreviações confusas
   - qtd: Quantidade numérica de unidades/jogos/caixas
   - unit: Valor unitário pago em R$
   - total: Valor total do item em R$

Lista de produtos cadastrados no depósito para referência de nomes: [${listaExemplos}].

Retorne EXCLUSIVAMENTE um JSON estrito (sem texto explicativo e sem formatação adicional fora de JSON) com este formato exato:
{
  "sucesso": true,
  "fornecedor": "Nome da Empresa / Fornecedor",
  "numero_nf": "Número da Nota",
  "chave_acesso": "Chave de 44 dígitos",
  "data_emissao": "DD/MM/AAAA",
  "forma_pagamento": "CARTAO",
  "valor_total": 0.00,
  "itens": [
    {
      "produto": "Nome do item",
      "qtd": 1,
      "unit": 10.00,
      "total": 10.00
    }
  ],
  "observacao": ""
}`;

    const payload = {
      contents: [{
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data
            }
          }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        response_mime_type: "application/json"
      }
    };

    const opt = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'x-goog-api-key': apiKey.trim()
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    // Lista de modelos e versões com fallback automático
    const modelCandidates = [
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent',
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent',
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-latest:generateContent',
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent'
    ];

    let lastErrorMsg = '';
    let resText = '';
    let code = 0;

    for (let i = 0; i < modelCandidates.length; i++) {
      const endpoint = `${modelCandidates[i]}?key=${apiKey.trim()}`;
      const res = UrlFetchApp.fetch(endpoint, opt);
      code = res.getResponseCode();
      resText = res.getContentText();

      if (code === 200) {
        break; // Sucesso!
      } else {
        lastErrorMsg = `(${code}): ${resText.substring(0, 140)}`;
      }
    }

    if (code !== 200) {
      console.error('Erro na API Gemini Vision:', code, resText);
      return {
        sucesso: false,
        motivo: 'ERRO_API',
        msg: `Erro na API Gemini ${lastErrorMsg}`
      };
    }

    const jsonRes = JSON.parse(resText);
    const rawContent = jsonRes?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!rawContent) {
      return { sucesso: false, motivo: 'RESPOSTA_VAZIA', msg: 'A IA não retornou dados legíveis da imagem.' };
    }

    const cleanJson = rawContent.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(cleanJson);

    // Ajusta produtos com base no banco de dados existente
    if (parsedData.itens && Array.isArray(parsedData.itens)) {
      parsedData.itens = parsedData.itens.map(item => {
        const prodCorrigido = encontrarMelhorProdutoCorrespondente(item.produto, prodsDb);
        const qtdNum = Number(item.qtd) || 1;
        const unitNum = Number(item.unit) || 0;
        const totNum = Number(item.total) || (qtdNum * unitNum);
        return {
          produto: prodCorrigido,
          qtd: qtdNum,
          unit: unitNum,
          total: totNum
        };
      });
    }

    parsedData.sucesso = true;
    return parsedData;
  } catch(e) {
    console.error('Exceção em analisarNotaFiscalComIA:', e);
    return {
      sucesso: false,
      motivo: 'EXCECAO',
      msg: e.message
    };
  }
}

/**
 * =========================================================================
 * 🧠 COPILOTO IA CONVERSACIONAL & EXECUTOR DE AÇÕES (FUNCTION CALLING)
 * =========================================================================
 */

function obterContextoCompletoParaIA() {
  const ss = SpreadsheetApp.getActive();
  const nomeDeposito = (typeof getNomeDeposito === 'function') ? getNomeDeposito() : 'Gestão de Depósito';
  
  // 1. Resumo dos Produtos (Preço, Custo, Margem, Estoque)
  const produtosResumo = [];
  const shProd = ss.getSheetByName('PRODUTOS');
  const mapaEst = (typeof obterMapaEstoqueReal === 'function') ? obterMapaEstoqueReal() : {};
  const safeNorm = str => String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toUpperCase().trim();

  if (shProd) {
    const dadosProd = shProd.getDataRange().getValues();
    for (let i = 1; i < dadosProd.length; i++) {
      const nome = String(dadosProd[i][0] || '').trim();
      if (!nome) continue;
      const cat = dadosProd[i][1] || 'Geral';
      const custo = Number(dadosProd[i][2]) || Number(dadosProd[i][6]) || 0;
      const preco = Number(dadosProd[i][4]) || 0;
      const min = Number(dadosProd[i][5]) || 0;
      const margem = Number(dadosProd[i][7]) || 0;
      const est = mapaEst[safeNorm(nome)] ?? (Number(dadosProd[i][11]) || 0);

      produtosResumo.push({
        nome: nome,
        categoria: cat,
        precoVenda: preco,
        custo: custo,
        estoque: est,
        minimo: min,
        margemPct: margem
      });
    }
  }

  // 2. Resumo do Caixa
  let saldoCaixa = 0;
  let entradasHoje = 0;
  let saidasHoje = 0;
  try {
    const shCaixa = ss.getSheetByName('CAIXA');
    if (shCaixa) {
      const dadosCx = shCaixa.getDataRange().getValues();
      const hojeStr = Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyy-MM-dd");
      for (let i = 1; i < dadosCx.length; i++) {
        const d = dadosCx[i][0];
        const tipo = String(dadosCx[i][1] || '').toLowerCase();
        const valor = Number(dadosCx[i][2]) || 0;
        if (tipo === 'entrada') saldoCaixa += valor;
        else if (tipo === 'saida') saldoCaixa -= valor;

        const dataRowStr = (d instanceof Date) ? Utilities.formatDate(d, "America/Sao_Paulo", "yyyy-MM-dd") : String(d).substring(0, 10);
        if (dataRowStr === hojeStr) {
          if (tipo === 'entrada') entradasHoje += valor;
          else if (tipo === 'saida') saidasHoje += valor;
        }
      }
    }
  } catch(e) {}

  // 3. Contas a Receber (Fiados)
  let totalFiados = 0;
  let qtdDevedores = 0;
  try {
    const cr = (typeof obterContasReceberTelegram === 'function') ? obterContasReceberTelegram() : { totalGeral: 0, clientes: [] };
    totalFiados = cr.totalGeral || 0;
    qtdDevedores = (cr.clientes || []).length;
  } catch(e) {}

  return {
    nomeDeposito: nomeDeposito,
    saldoCaixa: saldoCaixa,
    entradasHoje: entradasHoje,
    saidasHoje: saidasHoje,
    totalFiados: totalFiados,
    qtdDevedores: qtdDevedores,
    produtos: produtosResumo
  };
}

function executarAcaoIA(nomeFuncao, args, usuario) {
  const ss = SpreadsheetApp.getActive();
  const shProd = ss.getSheetByName('PRODUTOS');
  const shEst = ss.getSheetByName('ESTOQUE');
  const prodsDb = (typeof obterListaNomesProdutosCadastrados === 'function') ? obterListaNomesProdutosCadastrados() : [];
  const safeNorm = str => String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toUpperCase().trim();

  // 1. ALTERAR PREÇO DE VENDA
  if (nomeFuncao === 'alterar_preco_venda') {
    const prodBusca = String(args.produto || '').trim();
    const novoPreco = Number(args.novo_preco);
    if (!prodBusca || isNaN(novoPreco) || novoPreco < 0) {
      return { sucesso: false, msg: 'Produto ou preço inválido.' };
    }

    const prodNome = (typeof encontrarMelhorProdutoCorrespondente === 'function') ? encontrarMelhorProdutoCorrespondente(prodBusca, prodsDb) : prodBusca;
    const prodNorm = safeNorm(prodNome);

    if (shProd) {
      const dados = shProd.getDataRange().getValues();
      for (let i = 1; i < dados.length; i++) {
        if (safeNorm(dados[i][0]) === prodNorm) {
          const precoAntigo = Number(dados[i][4]) || 0;
          const custo = Number(dados[i][6]) || Number(dados[i][2]) || 0;
          shProd.getRange(i + 1, 5).setValue(novoPreco);

          let novaMargem = 0;
          if (novoPreco > 0) {
            novaMargem = ((novoPreco - custo) / novoPreco) * 100;
            shProd.getRange(i + 1, 8).setValue(novaMargem / 100);
          }

          return {
            sucesso: true,
            produto: dados[i][0],
            precoAntigo: precoAntigo,
            novoPreco: novoPreco,
            custo: custo,
            margem: novaMargem.toFixed(1) + '%'
          };
        }
      }
    }
    return { sucesso: false, msg: `Produto "${prodBusca}" não encontrado na planilha.` };
  }

  // 2. ALTERAR PREÇO DE CUSTO
  if (nomeFuncao === 'alterar_preco_custo') {
    const prodBusca = String(args.produto || '').trim();
    const novoCusto = Number(args.novo_custo);
    if (!prodBusca || isNaN(novoCusto) || novoCusto < 0) {
      return { sucesso: false, msg: 'Produto ou custo inválido.' };
    }

    const prodNome = (typeof encontrarMelhorProdutoCorrespondente === 'function') ? encontrarMelhorProdutoCorrespondente(prodBusca, prodsDb) : prodBusca;
    const prodNorm = safeNorm(prodNome);

    if (shProd) {
      const dados = shProd.getDataRange().getValues();
      for (let i = 1; i < dados.length; i++) {
        if (safeNorm(dados[i][0]) === prodNorm) {
          const custoAntigo = Number(dados[i][6]) || Number(dados[i][2]) || 0;
          const preco = Number(dados[i][4]) || 0;
          shProd.getRange(i + 1, 3).setValue(novoCusto);
          shProd.getRange(i + 1, 7).setValue(novoCusto);

          let novaMargem = 0;
          if (preco > 0) {
            novaMargem = ((preco - novoCusto) / preco) * 100;
            shProd.getRange(i + 1, 8).setValue(novaMargem / 100);
          }

          return {
            sucesso: true,
            produto: dados[i][0],
            custoAntigo: custoAntigo,
            novoCusto: novoCusto,
            preco: preco,
            margem: novaMargem.toFixed(1) + '%'
          };
        }
      }
    }
    return { sucesso: false, msg: `Produto "${prodBusca}" não encontrado.` };
  }

  // 3. AJUSTAR ESTOQUE FÍSICO
  if (nomeFuncao === 'ajustar_estoque_fisico') {
    const prodBusca = String(args.produto || '').trim();
    const novaQtd = Number(args.nova_quantidade);
    if (!prodBusca || isNaN(novaQtd) || novaQtd < 0) {
      return { sucesso: false, msg: 'Produto ou quantidade de estoque inválida.' };
    }

    const prodNome = (typeof encontrarMelhorProdutoCorrespondente === 'function') ? encontrarMelhorProdutoCorrespondente(prodBusca, prodsDb) : prodBusca;
    const prodNorm = safeNorm(prodNome);

    let qtdAntiga = 0;
    let nomeFinal = prodNome;

    if (shEst) {
      const dadosEst = shEst.getDataRange().getValues();
      let achou = false;
      for (let i = 1; i < dadosEst.length; i++) {
        if (safeNorm(dadosEst[i][0]) === prodNorm) {
          nomeFinal = dadosEst[i][0];
          qtdAntiga = Number(dadosEst[i][1]) || 0;
          shEst.getRange(i + 1, 2).setValue(novaQtd);

          const min = Number(dadosEst[i][2]) || 0;
          let status = '🟢   OK   🔋';
          if (novaQtd <= 0 || novaQtd <= min) status = '🔴 Crítico🪫';
          else if (novaQtd <= min * 2) status = '🟡 Baixo';
          shEst.getRange(i + 1, 4).setValue(status);
          achou = true;
          break;
        }
      }
      if (!achou) {
        shEst.appendRow([prodNome, novaQtd, 10, '🟢   OK   🔋', 'Ajustado via IA']);
      }
    }

    if (shProd) {
      const dadosP = shProd.getDataRange().getValues();
      for (let i = 1; i < dadosP.length; i++) {
        if (safeNorm(dadosP[i][0]) === prodNorm) {
          shProd.getRange(i + 1, 12).setValue(novaQtd);
          break;
        }
      }
    }

    if (typeof atualizarEstoque === 'function') {
      try { atualizarEstoque(); } catch(e) {}
    }

    return {
      sucesso: true,
      produto: nomeFinal,
      qtdAntiga: qtdAntiga,
      novaQtd: novaQtd
    };
  }

  // 4. ALTERAR ESTOQUE MÍNIMO
  if (nomeFuncao === 'alterar_estoque_minimo') {
    const prodBusca = String(args.produto || '').trim();
    const novoMin = Number(args.novo_minimo);
    if (!prodBusca || isNaN(novoMin) || novoMin < 0) {
      return { sucesso: false, msg: 'Produto ou estoque mínimo inválido.' };
    }

    const prodNome = (typeof encontrarMelhorProdutoCorrespondente === 'function') ? encontrarMelhorProdutoCorrespondente(prodBusca, prodsDb) : prodBusca;
    const prodNorm = safeNorm(prodNome);

    if (shProd) {
      const dados = shProd.getDataRange().getValues();
      for (let i = 1; i < dados.length; i++) {
        if (safeNorm(dados[i][0]) === prodNorm) {
          shProd.getRange(i + 1, 6).setValue(novoMin);
          break;
        }
      }
    }

    if (shEst) {
      const dadosEst = shEst.getDataRange().getValues();
      for (let i = 1; i < dadosEst.length; i++) {
        if (safeNorm(dadosEst[i][0]) === prodNorm) {
          shEst.getRange(i + 1, 3).setValue(novoMin);
          break;
        }
      }
    }

    if (typeof atualizarEstoque === 'function') {
      try { atualizarEstoque(); } catch(e) {}
    }

    return {
      sucesso: true,
      produto: prodNome,
      novoMinimo: novoMin
    };
  }

  // 5. CADASTRAR NOVO PRODUTO
  if (nomeFuncao === 'cadastrar_novo_produto') {
    const nome = String(args.nome || '').trim();
    const cat = String(args.categoria || 'Cerveja').trim();
    const marca = String(args.marca || 'LATA').trim();
    const volume = String(args.volume || '350ML').trim();
    const preco = Number(args.preco_venda) || 0;
    const custo = Number(args.preco_custo) || 0;
    const est = Number(args.estoque_inicial) || 0;
    const min = Number(args.estoque_minimo) || (cat.toLowerCase().includes('cerveja') ? 120 : 10);

    if (!nome) return { sucesso: false, msg: 'Nome do produto obrigatório.' };

    if (shProd) {
      const nextRow = shProd.getLastRow() + 1;
      const idProd = 'PRD-' + Utilities.formatString('%04d', nextRow - 1);
      const margem = preco > 0 ? ((preco - custo) / preco) : 0;

      shProd.appendRow([
        nome,                                 // Col A (1): Produto
        cat,                                  // Col B (2): Categoria
        marca,                                // Col C (3): Marca / Tipo
        volume,                               // Col D (4): Volume
        preco,                                // Col E (5): Preço Venda
        min,                                  // Col F (6): Estoque Mínimo
        custo,                                // Col G (7): Custo Médio
        margem,                               // Col H (8): Margem %
        `=G${nextRow}*(1+H${nextRow})`,       // Col I (9): Preço Sugerido (Fórmula)
        '🟢 OK',                              // Col J (10): Status Margem
        idProd,                               // Col K (11): ID PRODUTO
        est                                   // Col L (12): Estoque
      ]);
    }

    if (shEst) {
      shEst.appendRow([
        nome,
        est,
        min,
        est <= min ? '🔴 Crítico🪫' : '🟢   OK   🔋',
        'Cadastrado via IA'
      ]);
    }

    if (typeof atualizarEstoque === 'function') {
      try { atualizarEstoque(); } catch(e) {}
    }

    return {
      sucesso: true,
      produto: nome,
      categoria: cat,
      preco: preco,
      custo: custo,
      estoque: est,
      minimo: min
    };
  }

  // 6. ABRIR NOVA COMANDA
  if (nomeFuncao === 'abrir_nova_comanda') {
    const cliente = String(args.cliente || 'Balcão').trim();
    try {
      if (typeof criarComandaBalcao === 'function') {
        const pedido = criarComandaBalcao(cliente);
        return { sucesso: true, pedido: pedido, cliente: cliente };
      }
    } catch(e) {
      return { sucesso: false, msg: e.message };
    }
  }

  return { sucesso: false, msg: 'Ação não reconhecida.' };
}

function processarMensagemComIA(textoUsuario, chatId, usuario) {
  try {
    let apiKey = '';
    if (typeof getConfig === 'function') {
      apiKey = getConfig('GEMINI_API_KEY') || getConfig('GOOGLE_API_KEY') || '';
    }
    if (!apiKey) {
      apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') || '';
    }

    if (!apiKey) {
      enviarMensagemTelegram(
        `🔑 <b>Chave da IA não configurada</b>\n\n` +
        `Para conversar com o Copiloto e executar ações por texto, adicione sua <code>GEMINI_API_KEY</code> na aba <b>CONFIG</b> da planilha.`,
        null,
        chatId
      );
      return;
    }

    const contexto = obterContextoCompletoParaIA();
    const nomeDep = contexto.nomeDeposito;
    const nomeUsuario = usuario ? usuario.nome : 'Usuário';
    const perfilUsuario = usuario ? usuario.perfil : 'CLIENTE';

    // Lista de produtos formatada para o prompt do sistema
    const listaProdsTexto = contexto.produtos.slice(0, 80).map(p => 
      `- ${p.nome} (Cat: ${p.categoria} | Preço Venda: R$ ${p.precoVenda.toFixed(2)} | Custo: R$ ${p.custo.toFixed(2)} | Estoque: ${p.estoque} un. | Mín: ${p.minimo})`
    ).join('\n');

    const systemPrompt = `Você é o Copiloto Inteligente do ${nomeDep}.
Você atende o usuário ${nomeUsuario} (Perfil: ${perfilUsuario}).
Seja objetivo, prestativo, use emojis e formate sempre com HTML seguro do Telegram (<b>, <i>, <code>).

DADOS EM TEMPO REAL DO DEPÓSITO:
• Saldo em Caixa Atual: R$ ${contexto.saldoCaixa.toFixed(2)}
• Vendas/Entradas Hoje: R$ ${contexto.entradasHoje.toFixed(2)}
• Saídas/Despesas Hoje: R$ ${contexto.saidasHoje.toFixed(2)}
• Fiados em Aberto: R$ ${contexto.totalFiados.toFixed(2)} (${contexto.qtdDevedores} devedores)
• Catálogo e Estoque dos Produtos:
${listaProdsTexto}

FERRAMENTAS / AÇÕES REAIS DISPONÍVEIS:
Se o usuário pedir para alterar preço, custo, estoque, mínimo, abrir comanda ou cadastrar produto, VOCÊ DEVE EXECUTAR a ferramenta adequada através de Function Calling.
Se for apenas uma pergunta/consulta ou conversa, responda amigavelmente com base nos dados reais acima.`;

    const tools = [
      {
        function_declarations: [
          {
            name: "alterar_preco_venda",
            description: "Altera o preço de venda de um produto no sistema e recalcula a margem de lucro na aba PRODUTOS.",
            parameters: {
              type: "OBJECT",
              properties: {
                produto: { type: "STRING", description: "Nome do produto (Ex: Amstel, Heineken 330ml, Brahma Latão)" },
                novo_preco: { type: "NUMBER", description: "Novo preço de venda em reais (Ex: 4.55 ou 9.50)" }
              },
              required: ["produto", "novo_preco"]
            }
          },
          {
            name: "alterar_preco_custo",
            description: "Altera o preço de custo / compra de um produto e recalcula as margens.",
            parameters: {
              type: "OBJECT",
              properties: {
                produto: { type: "STRING", description: "Nome do produto" },
                novo_custo: { type: "NUMBER", description: "Novo preço de custo em reais" }
              },
              required: ["produto", "novo_custo"]
            }
          },
          {
            name: "ajustar_estoque_fisico",
            description: "Ajusta diretamente a quantidade física em estoque de um produto nas abas ESTOQUE e PRODUTOS.",
            parameters: {
              type: "OBJECT",
              properties: {
                produto: { type: "STRING", description: "Nome do produto" },
                nova_quantidade: { type: "NUMBER", description: "Quantidade física final em estoque" }
              },
              required: ["produto", "nova_quantidade"]
            }
          },
          {
            name: "alterar_estoque_minimo",
            description: "Altera o limite de estoque mínimo para disparo de alertas de reposição.",
            parameters: {
              type: "OBJECT",
              properties: {
                produto: { type: "STRING", description: "Nome do produto" },
                novo_minimo: { type: "NUMBER", description: "Nova quantidade mínima de segurança" }
              },
              required: ["produto", "novo_minimo"]
            }
          },
          {
            name: "cadastrar_novo_produto",
            description: "Cadastra um produto novo no catálogo com categoria, marca/embalagem, volume, preços e estoque inicial.",
            parameters: {
              type: "OBJECT",
              properties: {
                nome: { type: "STRING", description: "Nome completo do novo produto (Ex: BRAHMA LITRINHO, HEINEKEN LONG NECK, RED BULL)" },
                categoria: { type: "STRING", description: "Categoria (Ex: Cerveja, Destilado, Refrigerante, Energético, Gelo, Outros)" },
                marca: { type: "STRING", description: "Tipo/Embalagem (Ex: LATA, LITRO, LONG, PET, LITRINHO)" },
                volume: { type: "STRING", description: "Volume ou tamanho (Ex: 300ML, 350ML, 600ML, 1L, 2L)" },
                preco_venda: { type: "NUMBER", description: "Preço de venda ao cliente em reais" },
                preco_custo: { type: "NUMBER", description: "Preço de custo unitário em reais" },
                estoque_inicial: { type: "NUMBER", description: "Quantidade inicial em estoque (opcional, padrão 0)" },
                estoque_minimo: { type: "NUMBER", description: "Estoque mínimo de segurança (opcional, padrão 120 para cervejas ou 10)" }
              },
              required: ["nome", "preco_venda"]
            }
          },
          {
            name: "abrir_nova_comanda",
            description: "Abre uma nova comanda de balcão para um cliente.",
            parameters: {
              type: "OBJECT",
              properties: {
                cliente: { type: "STRING", description: "Nome do cliente ou número da mesa" }
              },
              required: ["cliente"]
            }
          }
        ]
      }
    ];

    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: textoUsuario }]
        }
      ],
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      tools: tools,
      generationConfig: {
        temperature: 0.2
      }
    };

    const modelCandidates = [
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent',
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent',
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent'
    ];

    const opt = {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-goog-api-key': apiKey.trim() },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    let resText = '';
    let code = 0;
    for (let i = 0; i < modelCandidates.length; i++) {
      const endpoint = `${modelCandidates[i]}?key=${apiKey.trim()}`;
      const res = UrlFetchApp.fetch(endpoint, opt);
      code = res.getResponseCode();
      resText = res.getContentText();
      if (code === 200) break;
    }

    if (code !== 200) {
      enviarMensagemTelegram(`⚠️ <b>Assistente IA:</b> Não foi possível processar no momento (${code}).`, null, chatId);
      return;
    }

    const jsonRes = JSON.parse(resText);
    const candidate = jsonRes?.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    let respostaTexto = '';

    for (let p of parts) {
      if (p.text) {
        respostaTexto += p.text + '\n';
      }
      if (p.functionCall) {
        const fnName = p.functionCall.name;
        const fnArgs = p.functionCall.args || {};
        const resultAcao = executarAcaoIA(fnName, fnArgs, usuario);

        if (fnName === 'alterar_preco_venda') {
          if (resultAcao.sucesso) {
            respostaTexto += `✅ <b>Preço de Venda Alterado com Sucesso!</b>\n\n` +
                             `📦 <b>Produto:</b> <b>${resultAcao.produto}</b>\n` +
                             `💵 <b>Preço Anterior:</b> R$ ${resultAcao.precoAntigo.toFixed(2).replace('.', ',')}\n` +
                             `🏷️ <b>Novo Preço de Venda:</b> <b>R$ ${resultAcao.novoPreco.toFixed(2).replace('.', ',')}</b>\n` +
                             `📊 <b>Nova Margem de Lucro:</b> ${resultAcao.margem}\n`;
          } else {
            respostaTexto += `❌ ${resultAcao.msg}\n`;
          }
        } else if (fnName === 'alterar_preco_custo') {
          if (resultAcao.sucesso) {
            respostaTexto += `✅ <b>Preço de Custo Atualizado!</b>\n\n` +
                             `📦 <b>Produto:</b> <b>${resultAcao.produto}</b>\n` +
                             `💵 <b>Custo Anterior:</b> R$ ${resultAcao.custoAntigo.toFixed(2).replace('.', ',')}\n` +
                             `🏷️ <b>Novo Custo:</b> <b>R$ ${resultAcao.novoCusto.toFixed(2).replace('.', ',')}</b>\n` +
                             `📊 <b>Margem Recalculada:</b> ${resultAcao.margem}\n`;
          } else {
            respostaTexto += `❌ ${resultAcao.msg}\n`;
          }
        } else if (fnName === 'ajustar_estoque_fisico') {
          if (resultAcao.sucesso) {
            respostaTexto += `✅ <b>Estoque Físico Ajustado!</b>\n\n` +
                             `📦 <b>Produto:</b> <b>${resultAcao.produto}</b>\n` +
                             `🔢 <b>Estoque Anterior:</b> ${resultAcao.qtdAntiga} un.\n` +
                             `🔋 <b>Novo Saldo em Estoque:</b> <b>${resultAcao.novaQtd} un.</b>\n`;
          } else {
            respostaTexto += `❌ ${resultAcao.msg}\n`;
          }
        } else if (fnName === 'alterar_estoque_minimo') {
          if (resultAcao.sucesso) {
            respostaTexto += `✅ <b>Estoque Mínimo Atualizado!</b>\n\n` +
                             `📦 <b>Produto:</b> <b>${resultAcao.produto}</b>\n` +
                             `🎯 <b>Novo Limite Mínimo:</b> <b>${resultAcao.novoMinimo} un.</b>\n`;
          } else {
            respostaTexto += `❌ ${resultAcao.msg}\n`;
          }
        } else if (fnName === 'cadastrar_novo_produto') {
          if (resultAcao.sucesso) {
            respostaTexto += `🎉 <b>Novo Produto Cadastrado com Sucesso!</b>\n\n` +
                             `📦 <b>Produto:</b> <b>${resultAcao.produto}</b>\n` +
                             `📂 <b>Categoria:</b> ${resultAcao.categoria}\n` +
                             `💵 <b>Preço de Venda:</b> R$ ${resultAcao.preco.toFixed(2).replace('.', ',')}\n` +
                             `🏷️ <b>Preço de Custo:</b> R$ ${resultAcao.custo.toFixed(2).replace('.', ',')}\n` +
                             `🔋 <b>Estoque Inicial:</b> ${resultAcao.estoque} un. (Mín: ${resultAcao.minimo})\n`;
          } else {
            respostaTexto += `❌ ${resultAcao.msg}\n`;
          }
        } else if (fnName === 'abrir_nova_comanda') {
          if (resultAcao.sucesso) {
            respostaTexto += `✅ <b>Comanda Balcão #${resultAcao.pedido} criada com sucesso para "${resultAcao.cliente}"!</b>\n`;
          } else {
            respostaTexto += `❌ ${resultAcao.msg}\n`;
          }
        }
      }
    }

    if (respostaTexto.trim()) {
      enviarMensagemTelegram(respostaTexto.trim(), null, chatId);
    } else {
      enviarMensagemTelegram("🤖 Entendido!", null, chatId);
    }

  } catch(errIA) {
    console.error('Erro em processarMensagemComIA:', errIA);
    enviarMensagemTelegram("❌ Erro ao conversar com o assistente: " + errIA.message, null, chatId);
  }
}

/**
 * Salva uma compra em lote identificada pela IA com todos os impactos contábeis e de estoque
 */
function salvarCompraLoteIA(draftData, emailUsuario) {
  try {
    const ss = SpreadsheetApp.getActive();
    let shComp = ss.getSheetByName('COMPRAS');
    if (!shComp) {
      shComp = ss.insertSheet('COMPRAS');
      shComp.getRange('A1:M1').setValues([[
        'Data','Produto','Qtd','Valor','Fornecedor','Forma_Pagamento','Status','ID_COMPRA','Comprovante_NF','Observacao','Motivo_Cancelamento','Email_Lancamento','Data_Lancamento'
      ]]);
      shComp.getRange('A1:M1').setBackground('#020617').setFontColor('#ffffff').setFontWeight('bold');
    }

    const idCompra = typeof gerarIdCompra === 'function' ? gerarIdCompra() : ('CPR' + String(shComp.getLastRow()));
    const data = new Date();
    const fornecedor = draftData.fornecedor || 'Fornecedor';
    const formaPgto = draftData.forma_pagamento || 'Boleto';
    const fileUrl = draftData.fileUrl || '';
    const obs = `NF: ${draftData.numero_nf || 'S/N'} (Lido por IA)`;
    let totalGeral = 0;

    const itens = draftData.itens || [];
    if (itens.length === 0) {
      return { ok: false, msg: 'Nenhum item válido para lançar.' };
    }

    itens.forEach(item => {
      const qtd = Number(item.qtd) || 1;
      const unit = Number(item.unit) || 0;
      const totalItem = Number(item.total) || (qtd * unit);
      totalGeral += totalItem;

      if (typeof inserirLinhaNoTopo === 'function') {
        inserirLinhaNoTopo('COMPRAS', [
          data,
          item.produto,
          qtd,
          totalItem,
          fornecedor,
          formaPgto,
          'ATIVO',
          idCompra,
          fileUrl ? `=HYPERLINK("${fileUrl}";"📎 Ver NF (${idCompra})")` : '',
          obs,
          '',
          emailUsuario || 'IA_GEMINI',
          data
        ]);
      } else {
        shComp.appendRow([
          data,
          item.produto,
          qtd,
          totalItem,
          fornecedor,
          formaPgto,
          'ATIVO',
          idCompra,
          fileUrl ? `=HYPERLINK("${fileUrl}";"📎 Ver NF (${idCompra})")` : '',
          obs,
          '',
          emailUsuario || 'IA_GEMINI',
          data
        ]);
      }

      // 1. Aumenta Estoque (aba ESTOQUE)
      try {
        if (typeof adicionarEstoquePorCompra === 'function') {
          adicionarEstoquePorCompra(item.produto, qtd);
        } else {
          const shEst = ss.getSheetByName('ESTOQUE');
          if (shEst) {
            const dadosEst = shEst.getDataRange().getValues();
            for (let i = 1; i < dadosEst.length; i++) {
              if (String(dadosEst[i][0] || '').toUpperCase().trim() === item.produto.toUpperCase().trim()) {
                const atual = Number(dadosEst[i][1]) || 0;
                shEst.getRange(i + 1, 2).setValue(atual + qtd);
                break;
              }
            }
          }
        }
      } catch(eEst) {}

      // 2. Recalcula Custo Médio e Margem (aba PRODUTOS)
      try {
        if (typeof atualizarCustoMedioProduto === 'function') {
          atualizarCustoMedioProduto(item.produto, qtd, totalItem);
        }
      } catch(eProd) {}
    });

    // 3. Registra saída no CAIXA
    try {
      if (typeof registrarCaixa === 'function') {
        registrarCaixa(data, 'Saida', totalGeral, formaPgto, 'COMPRA', `COMPRA ${idCompra} - ${fornecedor}`);
      }
    } catch(eCx) {}

    // 4. Registra em CONTAS A PAGAR se for Boleto / A Prazo
    if (['BOLETO', 'A PRAZO', 'CONSIGNADO', 'PRAZO'].includes(String(formaPgto).toUpperCase().trim())) {
      try {
        if (typeof criarContaAPagar === 'function') {
          criarContaAPagar(idCompra, fornecedor, totalGeral, formaPgto, new Date(Date.now() + 30 * 86400000));
        }
      } catch(eCp) {}
    }

    if (typeof atualizarEstoque === 'function') {
      try { atualizarEstoque(); } catch(eUp) {}
    }

    return {
      ok: true,
      id: idCompra,
      total: totalGeral,
      itensCount: itens.length,
      fornecedor: fornecedor
    };
  } catch(e) {
    console.error('Erro em salvarCompraLoteIA:', e);
    return { ok: false, msg: e.message };
  }
}

function obterResumoComprasTelegram() {
  let totalMes = 0;
  let qtdMes = 0;
  let totalGeral = 0;
  let ultimasCompras = [];
  try {
    const ss = SpreadsheetApp.getActive();
    const shComp = ss.getSheetByName('COMPRAS');
    if (shComp) {
      const dados = shComp.getDataRange().getValues();
      const agora = new Date();
      const mesAtual = agora.getMonth();
      const anoAtual = agora.getFullYear();

      for (let i = 1; i < dados.length; i++) {
        const row = dados[i];
        const dataRaw = row[0];
        const prod = String(row[1] || '').trim();
        const qtd = Number(row[2]) || 0;
        const total = Number(row[3]) || 0;
        const forn = String(row[4] || 'Geral').trim();
        const forma = String(row[5] || 'Dinheiro').trim();
        const status = String(row[6] || 'ATIVO').toUpperCase().trim();
        const idComp = String(row[7] || '');

        if (!prod || status === 'CANCELADO') continue;

        totalGeral += total;
        let dataObj = (dataRaw instanceof Date) ? dataRaw : new Date(dataRaw);
        if (!isNaN(dataObj.getTime()) && dataObj.getMonth() === mesAtual && dataObj.getFullYear() === anoAtual) {
          totalMes += total;
          qtdMes += qtd;
        }

        if (ultimasCompras.length < 10) {
          ultimasCompras.push({
            id: idComp,
            data: dataObj,
            produto: prod,
            qtd: qtd,
            total: total,
            fornecedor: forn,
            forma: forma,
            status: status
          });
        }
      }
    }
  } catch(e) {
    console.error('Erro em obterResumoComprasTelegram:', e);
  }
  return {
    totalMes: totalMes,
    qtdMes: qtdMes,
    totalGeral: totalGeral,
    ultimasCompras: ultimasCompras
  };
}

function exibirMenuComprasTelegram(chatId, messageId) {
  const resumo = obterResumoComprasTelegram();
  const nomeDeposito = typeof getNomeDeposito === 'function' ? getNomeDeposito() : 'Gestão de Depósito';

  const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const mesNome = meses[new Date().getMonth()];
  const linkDriveMes = (typeof obterLinkPastaNotasMesVigente === 'function') ? obterLinkPastaNotasMesVigente() : 'https://drive.google.com/drive/folders/1z5JjtXhuuC5z_qUjpfW91vy8_dlWN4Sq';

  let txt = `🛒 <b>Painel de Compras & Entrada de Mercadorias</b>\n` +
            `<i>${nomeDeposito}</i>\n\n` +
            `📊 <b>Balanço do Mês (${mesNome}):</b>\n` +
            `• <b>Total Investido:</b> R$ ${resumo.totalMes.toFixed(2).replace('.', ',')}\n` +
            `• <b>Volume de Itens:</b> ${resumo.qtdMes} un.\n\n` +
            `📁 <b>Pasta de NFs do Mês no Drive:</b>\n` +
            `<i>Compras / Notas / ${mesNome}</i>\n\n` +
            `Escolha uma das ações abaixo:`;

  const keyboard = [
    [
      { text: "🤖 Ler Nota Fiscal por IA (Foto)", callback_data: "comp_prompt_upload_general" }
    ],
    [
      { text: "➕ Lançar Compra Manual", callback_data: "comp_new_step1" },
      { text: "📂 Pasta no Drive", url: linkDriveMes }
    ],
    [
      { text: "🚨 Sugestões (Estoque Baixo)", callback_data: "comp_sugestoes" },
      { text: "📋 Histórico Recente", callback_data: "comp_history" }
    ],
    [
      { text: "📦 Gestão de Produtos", callback_data: "prod_menu" },
      { text: "◀️ Menu Principal", callback_data: "menu" }
    ]
  ];

  if (messageId) {
    editarMensagemTelegram(messageId, txt, { inline_keyboard: keyboard }, chatId);
  } else {
    enviarMensagemTelegram(txt, { inline_keyboard: keyboard }, chatId);
  }
}

function exibirHistoricoComprasTelegram(chatId, messageId) {
  const resumo = obterResumoComprasTelegram();
  const compras = resumo.ultimasCompras;

  if (!compras || compras.length === 0) {
    const txtVazio = `📋 <b>Histórico de Compras</b>\n\n` +
                     `<i>Nenhuma compra registrada até o momento.</i>`;
    const back = {
      inline_keyboard: [
        [{ text: "➕ Lançar Nova Compra", callback_data: "comp_new_step1" }],
        [{ text: "◀️ Voltar ao Menu de Compras", callback_data: "comp_menu" }]
      ]
    };
    if (messageId) editarMensagemTelegram(messageId, txtVazio, back, chatId);
    else enviarMensagemTelegram(txtVazio, back, chatId);
    return;
  }

  let txt = `📋 <b>Últimas Compras Registradas:</b>\n\n`;
  compras.forEach((c, idx) => {
    const dataFormatada = (c.data instanceof Date && !isNaN(c.data.getTime()))
      ? Utilities.formatDate(c.data, "America/Sao_Paulo", "dd/MM HH:mm")
      : 'Recente';
    const unit = c.qtd > 0 ? (c.total / c.qtd) : 0;
    txt += `<b>${idx + 1}. ${c.produto}</b>\n` +
           `   📦 ${c.qtd} un. x R$ ${unit.toFixed(2).replace('.', ',')} = <b>R$ ${c.total.toFixed(2).replace('.', ',')}</b>\n` +
           `   🏢 Fornec: <i>${c.fornecedor}</i> | 💳 <i>${c.forma}</i>\n` +
           `   📅 ${dataFormatada} ${c.id ? `| <code>#${c.id}</code>` : ''}\n\n`;
  });

  const keyboard = [
    [{ text: "➕ Nova Compra", callback_data: "comp_new_step1" }],
    [{ text: "◀️ Voltar ao Menu de Compras", callback_data: "comp_menu" }]
  ];

  if (messageId) editarMensagemTelegram(messageId, txt, { inline_keyboard: keyboard }, chatId);
  else enviarMensagemTelegram(txt, { inline_keyboard: keyboard }, chatId);
}

function exibirSugestoesCompraTelegram(chatId, messageId) {
  const ss = SpreadsheetApp.getActive();
  const shEst = ss.getSheetByName('ESTOQUE');
  const dados = shEst ? shEst.getDataRange().getValues() : [];
  const criticos = [];

  for (let i = 1; i < dados.length; i++) {
    const prod = String(dados[i][0] || '').trim();
    const qtd = Number(dados[i][1]) || 0;
    const min = Number(dados[i][2]) || 0;
    const status = String(dados[i][3] || '');

    if (prod && (qtd <= min || status.includes('Crítico') || status.includes('Baixo'))) {
      criticos.push({ rowIdx: i + 1, produto: prod, qtd: qtd, min: min });
    }
  }

  if (criticos.length === 0) {
    const txtOk = `🎉 <b>Tudo Certo com o Estoque!</b>\n\n` +
                  `Nenhum produto está em nível crítico ou abaixo do estoque mínimo.`;
    const back = {
      inline_keyboard: [
        [{ text: "➕ Comprar Qualquer Item", callback_data: "comp_new_step1" }],
        [{ text: "◀️ Voltar ao Menu de Compras", callback_data: "comp_menu" }]
      ]
    };
    if (messageId) editarMensagemTelegram(messageId, txtOk, back, chatId);
    else enviarMensagemTelegram(txtOk, back, chatId);
    return;
  }

  let txt = `🚨 <b>Produtos que Precisam de Reposição</b>\n` +
            `<i>Itens com estoque abaixo ou próximo do mínimo:</i>\n\n`;

  const keyboard = [];

  criticos.slice(0, 10).forEach((c, idx) => {
    txt += `<b>${idx + 1}. ${c.produto}</b>\n` +
           `   📦 Atual: <b>${c.qtd}</b> | 🎯 Mínimo: ${c.min}\n\n`;
    keyboard.push([
      { text: `➕ Comprar ${c.produto.slice(0, 20)}`, callback_data: `comp_sel_prod_${encodeURIComponent(c.produto)}` }
    ]);
  });

  keyboard.push([
    { text: "🔍 Digitar Outro Produto", callback_data: "comp_prompt_prod" },
    { text: "◀️ Voltar às Compras", callback_data: "comp_menu" }
  ]);

  if (messageId) editarMensagemTelegram(messageId, txt, { inline_keyboard: keyboard }, chatId);
  else enviarMensagemTelegram(txt, { inline_keyboard: keyboard }, chatId);
}

function iniciarFluxoNovaCompraTelegram(chatId, messageId, prodPreSelecionado) {
  const cache = CacheService.getScriptCache();
  
  if (prodPreSelecionado) {
    cache.put('temp_comp_prod_' + chatId, prodPreSelecionado, 600);
    cache.put('state_' + chatId, 'AWAITING_COMPRA_QTD', 600);

    const txt = `🛒 <b>Nova Compra: ${prodPreSelecionado} (Passo 2/4)</b>\n\n` +
                `📦 <b>Quantas unidades foram compradas?</b>\n\n` +
                `<i>Toque em um dos botões rápidos ou digite o número no chat:</i>`;
    const keyboard = [
      [
        { text: "➕ 12 un", callback_data: "comp_set_qtd_12" },
        { text: "➕ 24 un (1 cx)", callback_data: "comp_set_qtd_24" },
        { text: "➕ 48 un", callback_data: "comp_set_qtd_48" }
      ],
      [
        { text: "➕ 100 un", callback_data: "comp_set_qtd_100" },
        { text: "➕ 200 un", callback_data: "comp_set_qtd_200" }
      ],
      [{ text: "❌ Cancelar", callback_data: "comp_menu" }]
    ];
    if (messageId) editarMensagemTelegram(messageId, txt, { inline_keyboard: keyboard }, chatId);
    else enviarMensagemTelegram(txt, { inline_keyboard: keyboard }, chatId);
    return;
  }

  cache.put('state_' + chatId, 'AWAITING_COMPRA_PROD', 600);
  const txt = `🛒 <b>Nova Compra / Entrada de Mercadoria (Passo 1/4)</b>\n\n` +
              `✍️ <b>Digite o Nome do Produto</b> no chat abaixo:\n\n` +
              `<i>(Ex: Heineken 330ml, Brahma Latão, Coca-Cola 2L, Gelo 5kg, etc.)</i>`;
  const keyboard = [
    [{ text: "🚨 Ver Sugestões de Estoque Baixo", callback_data: "comp_sugestoes" }],
    [{ text: "❌ Cancelar", callback_data: "comp_menu" }]
  ];
  if (messageId) editarMensagemTelegram(messageId, txt, { inline_keyboard: keyboard }, chatId);
  else enviarMensagemTelegram(txt, { inline_keyboard: keyboard }, chatId);
}

function salvarCompraTelegram(produto, qtd, unit, fornecedor, formaPgto, emailUsuario) {
  try {
    if (typeof salvarCompraCarrinhoV2 === 'function') {
      const res = salvarCompraCarrinhoV2([{ produto: produto, qtd: Number(qtd), unit: Number(unit) }], fornecedor, formaPgto);
      if (res && res.ok) return res;
    }

    const ss = SpreadsheetApp.getActive();
    let shComp = ss.getSheetByName('COMPRAS');
    if (!shComp) {
      shComp = ss.insertSheet('COMPRAS');
      shComp.getRange('A1:M1').setValues([[
        'Data','Produto','Qtd','Valor','Fornecedor','Forma_Pagamento','Status','ID_COMPRA','Comprovante_NF','Observacao','Motivo_Cancelamento','Email_Lancamento','Data_Lancamento'
      ]]);
      shComp.getRange('A1:M1').setBackground('#020617').setFontColor('#ffffff').setFontWeight('bold');
    }

    const data = new Date();
    const total = Number(qtd) * Number(unit);
    const idCompra = typeof gerarIdCompra === 'function' ? gerarIdCompra() : ('CPR' + String(shComp.getLastRow()));
    const linkNF = typeof obterLinkPastaNotasMesVigente === 'function' ? obterLinkPastaNotasMesVigente() : 'https://drive.google.com/drive/folders/1z5JjtXhuuC5z_qUjpfW91vy8_dlWN4Sq';

    if (typeof inserirLinhaNoTopo === 'function') {
      inserirLinhaNoTopo('COMPRAS', [
        data,
        produto,
        Number(qtd),
        total,
        fornecedor || 'Geral',
        formaPgto || 'Dinheiro',
        'ATIVO',
        idCompra,
        linkNF ? `=HYPERLINK("${linkNF}";"📎 Enviar NF")` : '',
        'Lançado via Telegram',
        '',
        emailUsuario || 'TELEGRAM_BOT',
        data
      ]);
    } else {
      shComp.appendRow([
        data,
        produto,
        Number(qtd),
        total,
        fornecedor || 'Geral',
        formaPgto || 'Dinheiro',
        'ATIVO',
        idCompra,
        linkNF ? `=HYPERLINK("${linkNF}";"📎 Enviar NF")` : '',
        'Lançado via Telegram',
        '',
        emailUsuario || 'TELEGRAM_BOT',
        data
      ]);
    }

    // 1. Aumenta Estoque (aba ESTOQUE)
    try {
      if (typeof adicionarEstoquePorCompra === 'function') {
        adicionarEstoquePorCompra(produto, Number(qtd));
      } else {
        const shEst = ss.getSheetByName('ESTOQUE');
        if (shEst) {
          const dadosEst = shEst.getDataRange().getValues();
          const safeNorm = str => String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toUpperCase().trim();
          const prodNorm = safeNorm(produto);
          let achouEst = false;
          for (let i = 1; i < dadosEst.length; i++) {
            if (safeNorm(dadosEst[i][0]) === prodNorm) {
              const atual = Number(dadosEst[i][1]) || 0;
              const novaQtd = atual + Number(qtd);
              shEst.getRange(i + 1, 2).setValue(novaQtd);

              const min = Number(dadosEst[i][2]) || 0;
              let status = '🟢   OK   🔋';
              if (novaQtd <= 0 || novaQtd <= min) {
                status = '🔴 Crítico🪫';
              } else if (novaQtd <= min * 2) {
                status = '🟡 Baixo';
              }
              shEst.getRange(i + 1, 4).setValue(status);
              achouEst = true;
              break;
            }
          }
          if (!achouEst) {
            shEst.appendRow([produto, Number(qtd), 10, '🟢   OK   🔋', 'Criado via Compra Telegram']);
          }
        }
      }
    } catch(eEst) {}

    // 2. Atualiza Custo Médio na aba PRODUTOS
    if (typeof atualizarCustoMedioProduto === 'function') {
      try { atualizarCustoMedioProduto(produto, Number(qtd), total); } catch(e) {}
    }

    // 3. Registra Saída no Caixa
    if (typeof registrarCaixa === 'function') {
      try {
        registrarCaixa(data, 'Saida', total, formaPgto, 'COMPRA', `COMPRA ${idCompra} - ${produto}`);
      } catch(e) {}
    }

    // 4. Se a prazo ou boleto, cria conta a pagar
    if (['BOLETO', 'CONSIGNADO', 'A PRAZO', 'A_PRAZO'].includes(String(formaPgto).toUpperCase())) {
      if (typeof criarContaAPagar === 'function') {
        try { criarContaAPagar(idCompra, fornecedor, total, formaPgto, data); } catch(e) {}
      }
    }

    // 5. Atualiza estoque global
    if (typeof atualizarEstoque === 'function') {
      try { atualizarEstoque(); } catch(e) {}
    }
    if (typeof atualizarMargemProduto === 'function') {
      try { atualizarMargemProduto(); } catch(e) {}
    }

    return { ok: true, id: idCompra, total: total };
  } catch(err) {
    console.error('Erro em salvarCompraTelegram:', err);
    return { ok: false, msg: err.message };
  }
}

/**
 * Exibe os detalhes completos de um Delivery com itens, status e botões de ação
 */
function exibirDetalhesDeliveryTelegram(pedido, chatId, messageId) {
  try {
    const ss = SpreadsheetApp.getActive();
    const shDel = ss.getSheetByName('DELIVERY');
    const shItens = ss.getSheetByName('DELIVERY_ITENS');
    
    const delDados = shDel ? shDel.getDataRange().getValues() : [];
    let d = null;

    for (let i = 1; i < delDados.length; i++) {
      if (pedidosCorrespondem(delDados[i][0], pedido) || String(delDados[i][0]) === String(pedido) || Number(delDados[i][0]) == Number(pedido)) {
        d = {
          pedido: delDados[i][0],
          data: delDados[i][1],
          cliente: delDados[i][2] || 'Consumidor',
          total: Number(delDados[i][5]) || 0,
          pagamento: delDados[i][6] || 'Dinheiro',
          status: String(delDados[i][7] || 'PEDIDO FEITO').toUpperCase().trim(),
          entregador: delDados[i][8] || 'Não atribuído'
        };
        break;
      }
    }

    if (!d) {
      enviarMensagemTelegram(`❌ Pedido de Delivery <b>#${pedido}</b> não encontrado.`, null, chatId);
      return;
    }

    // Busca itens do pedido
    const itensDados = shItens ? shItens.getDataRange().getValues() : [];
    const itensMap = {};
    let totalCalculado = 0;

    for (let i = 1; i < itensDados.length; i++) {
      if (pedidosCorrespondem(itensDados[i][0], pedido) || String(itensDados[i][0]) === String(pedido) || Number(itensDados[i][0]) == Number(pedido)) {
        const prod = String(itensDados[i][1] || 'Item sem nome');
        const qtd = Number(itensDados[i][2]) || 0;
        const unit = Number(itensDados[i][3]) || 0;
        const sub = Number(itensDados[i][4]) || (qtd * unit);

        if (!itensMap[prod]) {
          itensMap[prod] = { qtd: 0, unit: unit, total: 0 };
        }
        itensMap[prod].qtd += qtd;
        itensMap[prod].total += sub;
        totalCalculado += sub;
      }
    }

    let itensText = "";
    const produtosChaves = Object.keys(itensMap);
    if (produtosChaves.length === 0) {
      itensText = `<i>Nenhum item adicionado ainda.</i>\n`;
    } else {
      produtosChaves.forEach(prod => {
        const item = itensMap[prod];
        itensText += `• <b>${prod}</b>\n` +
                     `  └ ${item.qtd}x R$ ${item.unit.toFixed(2)} = <b>R$ ${item.total.toFixed(2)}</b>\n`;
      });
    }

    const totalFinal = totalCalculado > 0 ? totalCalculado : d.total;

    let msg = `🚚 <b>Painel do Delivery #${d.pedido}</b>\n\n` +
              `👤 <b>Cliente:</b> <b>${d.cliente}</b>\n` +
              `💳 <b>Pagamento:</b> ${d.pagamento}\n` +
              `🛵 <b>Entregador:</b> ${d.entregador}\n` +
              `📊 <b>Status:</b> <b>${d.status}</b>\n\n` +
              `🛒 <b>Itens do Pedido:</b>\n` +
              itensText + `\n` +
              `💰 <b>Valor Total:</b> <b>R$ ${totalFinal.toFixed(2)}</b>`;

    const buttons = [];

    if (d.status === 'PEDIDO FEITO' || d.status === 'ABERTO' || d.status === 'PENDENTE') {
      buttons.push([
        { text: "🛵 Atribuir Entregador & Despachar", callback_data: `deliv_set_driver_${pedido}` }
      ]);
      buttons.push([
        { text: "➕ Adicionar Item", callback_data: `deliv_additem_${pedido}` }
      ]);
      buttons.push([
        { text: "❌ Cancelar Pedido", callback_data: `deliv_canc_${pedido}` }
      ]);
    } else if (d.status === 'EM ANDAMENTO' || d.status === 'EM TRÂNSITO' || d.status === 'EM TRANSITO') {
      buttons.push([
        { text: "🛵 Trocar Entregador", callback_data: `deliv_set_driver_${pedido}` },
        { text: "✅ Confirmar Entrega Realizada", callback_data: `deliv_done_${pedido}` }
      ]);
      buttons.push([
        { text: "❌ Cancelar Pedido", callback_data: `deliv_canc_${pedido}` }
      ]);
    }

    buttons.push([
      { text: "🔄 Atualizar", callback_data: `deliv_info_${pedido}` },
      { text: "◀️ Voltar ao Delivery", callback_data: "deliv_menu" }
    ]);

    if (messageId && messageId !== "0" && Number(messageId) > 0) {
      editarMensagemTelegram(messageId, msg, { inline_keyboard: buttons }, chatId);
    } else {
      enviarMensagemTelegram(msg, { inline_keyboard: buttons }, chatId);
    }
  } catch(err) {
    enviarMensagemTelegram("❌ Erro ao exibir detalhes do delivery: " + err.message, null, chatId);
  }
}

/**
 * Exibe os detalhes completos de uma comanda com todos os itens consumidos, subtotais e botões de ação
 */
function exibirDetalhesComandaTelegram(pedido, chatId, messageId) {
  try {
    const ss = SpreadsheetApp.getActive();
    const shItens = ss.getSheetByName('COMANDA_ITENS');
    const itensRaw = shItens ? shItens.getDataRange().getValues() : [];
    
    // Agrupa e consolida itens por produto com matching flexível de ID
    const mapaItens = {};
    let totalCalculado = 0;

    for (let i = 1; i < itensRaw.length; i++) {
      const rowPed = String(itensRaw[i][0] || '');
      if (pedidosCorrespondem(rowPed, pedido)) {
        const prod = String(itensRaw[i][1] || '').trim();
        const qtd = Number(itensRaw[i][2]) || 0;
        const unit = Number(itensRaw[i][3]) || 0;
        const tot = Number(itensRaw[i][4]) || (qtd * unit);
        if (prod && qtd > 0) {
          if (!mapaItens[prod]) {
            mapaItens[prod] = { produto: prod, qtd: 0, unit: unit, total: 0 };
          }
          mapaItens[prod].qtd += qtd;
          mapaItens[prod].total += tot;
          totalCalculado += tot;
        }
      }
    }

    const itensConsolidados = Object.values(mapaItens);
    const cliente = typeof getClienteDaComanda === 'function' ? getClienteDaComanda(pedido) : '';
    const totalOficial = typeof calcularTotalComanda === 'function' ? calcularTotalComanda(pedido) : totalCalculado;
    const totalFinal = Math.max(totalOficial, totalCalculado);
    const pagos = typeof calcularPagamentosComanda === 'function' ? calcularPagamentosComanda(pedido) : 0;
    const saldo = Math.max(0, totalFinal - pagos);

    let msg = `🍺 <b>Detalhes da Comanda: ${pedido}</b>\n` +
              `👤 <b>Cliente:</b> <b>${cliente || 'Consumidor Balcão'}</b>\n\n` +
              `📦 <b>Itens Consumidos:</b>\n`;
    
    if (itensConsolidados.length === 0) {
      msg += `<i>Nenhum item lançado ainda. Clique em "➕ Adicionar Item" abaixo!</i>\n`;
    } else {
      itensConsolidados.forEach(item => {
        msg += `• <b>${item.produto}</b>\n  └ ${item.qtd}x R$ ${item.unit.toFixed(2)} = <b>R$ ${item.total.toFixed(2)}</b>\n`;
      });
    }

    msg += `\n━━━━━━━━━━━━━━━━━━━━\n` +
           `💵 <b>Total Consumido:</b> R$ ${totalFinal.toFixed(2)}\n` +
           `💸 <b>Total Já Pago:</b> R$ ${pagos.toFixed(2)}\n` +
           `⚖️ <b>Saldo Devedor:</b> <b>R$ ${saldo.toFixed(2)}</b>`;

    const buttons = [];
    buttons.push([
      { text: "➕ Adicionar Item", callback_data: `cmd_additem_${pedido}` }
    ]);
    if (saldo > 0) {
      buttons.push([
        { text: "💵 Quitar Dinheiro", callback_data: `pay_${pedido}_DINHEIRO` },
        { text: "📱 Cobrar PIX (QR Code)", callback_data: `paypix_prompt_${pedido}` }
      ]);
      buttons.push([
        { text: "💳 Quitar Cartão", callback_data: `pay_${pedido}_CARTAO` },
        { text: "🧾 Quitar Fiado", callback_data: `pay_${pedido}_FIADO` }
      ]);
      buttons.push([
        { text: "💸 Pagamento Parcial", callback_data: `paypar_${pedido}` }
      ]);
    } else if (totalFinal > 0 && saldo <= 0) {
      buttons.push([
        { text: "🔒 Fechar Comanda Paga", callback_data: `pay_${pedido}_DINHEIRO` }
      ]);
    }
    buttons.push([
      { text: "🔄 Atualizar", callback_data: `cmd_info_${pedido}` },
      { text: "◀️ Voltar às Comandas", callback_data: "cmd_open" }
    ]);

    if (messageId && messageId !== "0" && Number(messageId) > 0) {
      editarMensagemTelegram(messageId, msg, { inline_keyboard: buttons }, chatId);
    } else {
      enviarMensagemTelegram(msg, { inline_keyboard: buttons }, chatId);
    }
  } catch(err) {
    enviarMensagemTelegram("❌ Erro ao exibir detalhes da comanda: " + err.message, null, chatId);
  }
}

/**
 * Webhook (doPost) - Processamento central de mensagens e botões inline
 */
function doPost(e) {
  try {
    const update = JSON.parse(e.postData.contents);
    
    // =============================================
    // 🖱️ TRATAMENTO DE CLIQUES NOS BOTÕES INLINE
    // =============================================
    if (update.callback_query) {
      const callbackQuery = update.callback_query;
      const queryId = callbackQuery.id;
      const data = String(callbackQuery.data).trim();
      const chat = callbackQuery.message.chat;
      const chatId = String(chat.id);
      const messageId = callbackQuery.message.message_id;

      // 🛡️ PROTEÇÃO GLOBAL CONTRA DUPLO CLIQUE / ANTI-SPAM (TODOS OS BOTÕES)
      const cache = CacheService.getScriptCache();
      const clickLockKey = 'btnlock_' + chatId + '_' + data;
      
      if (cache.get(clickLockKey)) {
        responderCallbackQuery(queryId, "⏳ Ação em processamento, aguarde...");
        return HtmlService.createHtmlOutput("OK");
      }

      // Bloqueia qualquer clique duplo no mesmo botão em todo o sistema
      const isCriticalAction = data.startsWith("additem_") || 
                               data.startsWith("cadd_") || 
                               data.startsWith("client_pay_") || 
                               data.startsWith("client_checkout_") || 
                               data.startsWith("client_clear_") || 
                               data.startsWith("comp_pay_") || 
                               data.startsWith("comp_set_") || 
                               data.startsWith("add_") || 
                               data.startsWith("pay_") || 
                               data.startsWith("paypix_prompt_") || 
                               data.startsWith("deliv_approve_pix_") || 
                               data.startsWith("deliv_reject_pix_") || 
                               data.startsWith("execpaypar_") || 
                               data.startsWith("deliv_disp_") || 
                               data.startsWith("deliv_done_") || 
                               data.startsWith("deliv_canc_") || 
                               data.startsWith("deliv_set_driver_") || 
                               data.startsWith("appr_") || 
                               data.startsWith("blk_") ||
                               data.startsWith("cmd_new") ||
                               data.startsWith("cr_do_payall_") ||
                               data.startsWith("conf_appr_") ||
                               data.startsWith("conf_rej_") ||
                               data.startsWith("do_backup");

      // Trava por 5 segundos para ações críticas ou 3 segundos para navegação geral
      cache.put(clickLockKey, '1', isCriticalAction ? 5 : 3);
      
      const usuario = typeof obterUsuarioPorTelegramChatId === 'function' ? obterUsuarioPorTelegramChatId(chatId) : null;

      // Se não autenticado e clicou em menu
      if (!usuario && data !== 'help' && data !== 'auth_prompt') {
        responderCallbackQuery(queryId, "Faça login com: /login usuario senha");
        const menuObj = montarMenuPrincipal(null);
        editarMensagemTelegram(messageId, menuObj.texto, menuObj.markup, chatId);
        return HtmlService.createHtmlOutput("OK");
      }

      const perfil = usuario ? String(usuario.perfil || 'VENDEDOR').toUpperCase() : 'ANONIMO';

      // 🏠 MENU PRINCIPAL
      if (data === "menu") {
        const menuObj = montarMenuPrincipal(usuario);
        editarMensagemTelegram(messageId, menuObj.texto, menuObj.markup, chatId);
        responderCallbackQuery(queryId);
      }
      else if (data === "help" || data === "prod_search_help") {
        const txtHelp = `📖 <b>Comandos Rápidos do Telegram:</b>\n\n` +
                        `• <code>/novacomanda [Nome]</code> - Cria comanda de balcão\n` +
                        `• <code>/comandas</code> - Lista comandas abertas\n` +
                        `• <code>/delivery</code> - Painel de entregas ativas\n` +
                        `• <code>/busca [produto]</code> - Consulta preço e estoque\n` +
                        `• <code>/status</code> - Resumo financeiro do dia\n` +
                        `• <code>/estoque</code> - Alertas de estoque crítico\n` +
                        `• <code>/logout</code> - Desconectar deste aparelho`;
        const back = { inline_keyboard: [[{ text: "◀️ Voltar ao Menu", callback_data: "menu" }]] };
        editarMensagemTelegram(messageId, txtHelp, back, chatId);
        responderCallbackQuery(queryId);
      }
      else if (data === "auth_logout") {
        if (typeof desvincularUsuarioTelegram === 'function') {
          desvincularUsuarioTelegram(chatId);
        }
        responderCallbackQuery(queryId, "Conta desconectada.");
        const menuObj = montarMenuPrincipal(null);
        editarMensagemTelegram(messageId, `🚪 <b>Você foi desconectado com sucesso.</b>\n\nPara reconectar, toque em <b>Entrar / Vincular Conta</b>.`, menuObj.markup, chatId);
      }
      else if (data === "auth_start_login") {
        const cache = CacheService.getScriptCache();
        cache.put('state_' + chatId, 'AWAITING_LOGIN_USER', 300);
        const msgLogin = `🔐 <b>Acesso ao Sistema (${nomeDeposito})</b>\n\n` +
                         `✍️ Digite o seu <b>usuário (login)</b> no chat abaixo:\n\n` +
                         `<i>💡 Dica rápida: você também pode digitar diretamente no chat:</i>\n` +
                         `<code>/login seu_usuario sua_senha</code>`;
        const back = { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: "menu" }]] };
        editarMensagemTelegram(messageId, msgLogin, back, chatId);
        responderCallbackQuery(queryId);
      }

      // =============================================
      // 🔒 APROVAÇÃO INTERATIVA DE CONFERÊNCIA DE CAIXA
      // =============================================
      else if (data.startsWith("conf_appr_")) {
        const idConf = data.replace("conf_appr_", "");
        if (perfil !== 'DONO' && perfil !== 'GERENTE' && perfil !== 'GERENCIAL' && perfil !== 'ADMIN') {
          responderCallbackQuery(queryId, "⛔ Apenas Dono e Gerentes podem aprovar conferência!");
          return HtmlService.createHtmlOutput("OK");
        }
        const nomeGestor = usuario ? usuario.nome : 'Gestor';
        const resAprov = processarAprovacaoConferenciaTelegram(idConf, nomeGestor, true);
        responderCallbackQuery(queryId, resAprov.msg);
        if (resAprov.ok) {
          editarMensagemTelegram(messageId, resAprov.novoTexto, null, chatId);
        }
        return HtmlService.createHtmlOutput("OK");
      }
      else if (data.startsWith("conf_rej_")) {
        const idConf = data.replace("conf_rej_", "");
        if (perfil !== 'DONO' && perfil !== 'GERENTE' && perfil !== 'GERENCIAL' && perfil !== 'ADMIN') {
          responderCallbackQuery(queryId, "⛔ Apenas Dono e Gerentes podem rejeitar conferência!");
          return HtmlService.createHtmlOutput("OK");
        }
        const nomeGestor = usuario ? usuario.nome : 'Gestor';
        const resRej = processarAprovacaoConferenciaTelegram(idConf, nomeGestor, false);
        responderCallbackQuery(queryId, resRej.msg);
        if (resRej.ok) {
          editarMensagemTelegram(messageId, resRej.novoTexto, null, chatId);
        }
        return HtmlService.createHtmlOutput("OK");
      }

      // =============================================
      // 🛒 CALLBACKS DA ÁREA DO CLIENTE
      // =============================================
      else if (data === "client_menu_cats") {
        exibirMenuCategoriasCliente(chatId, messageId);
        responderCallbackQuery(queryId);
      }
      else if (data.startsWith("cl_cat_")) {
        const categoria = data.substring(7);
        exibirProdutosCategoriaCliente(chatId, categoria, messageId);
        responderCallbackQuery(queryId);
      }
      else if (data.startsWith("cadd_")) {
        const parts = data.split('_');
        const rowIdx = Number(parts[1]);
        const qtd = Number(parts[2]);
        const res = adicionarItemCarrinhoCliente(chatId, rowIdx, qtd);
        if (res.ok) {
          responderCallbackQuery(queryId, `✅ +${qtd}x ${res.nome} adicionado!`);
        } else {
          responderCallbackQuery(queryId, `❌ ${res.msg}`);
        }
      }
      else if (data === "client_view_cart") {
        exibirCarrinhoCliente(chatId, messageId);
        responderCallbackQuery(queryId);
      }
      else if (data === "client_clear_cart") {
        limparCarrinhoCliente(chatId);
        responderCallbackQuery(queryId, "Carrinho esvaziado.");
        exibirCarrinhoCliente(chatId, messageId);
      }
      else if (data === "client_checkout_step1") {
        iniciarCheckoutCliente(chatId, messageId);
        responderCallbackQuery(queryId);
      }
      else if (data.startsWith("client_pay_")) {
        const forma = data.replace("client_pay_", "");
        if (forma === "DINHEIRO") {
          const txtTroco = `💵 <b>Pagamento em Dinheiro</b>\n\nVocê vai precisar de troco para a entrega?`;
          const markupTroco = {
            inline_keyboard: [
              [{ text: "❌ Não preciso de troco", callback_data: "client_finalize_DINHEIRO_notroco" }],
              [{ text: "💵 Preciso de troco", callback_data: "client_ask_troco" }],
              [{ text: "◀️ Voltar ao Carrinho", callback_data: "client_view_cart" }]
            ]
          };
          editarMensagemTelegram(messageId, txtTroco, markupTroco, chatId);
          responderCallbackQuery(queryId);
        } else {
          responderCallbackQuery(queryId, "Finalizando pedido...");
          finalizarPedidoCliente(chatId, forma, null);
        }
      }
      else if (data === "client_finalize_DINHEIRO_notroco") {
        responderCallbackQuery(queryId, "Finalizando pedido...");
        finalizarPedidoCliente(chatId, "DINHEIRO", "Sem troco");
      }
      else if (data === "client_ask_troco") {
        const cache = CacheService.getScriptCache();
        cache.put('state_' + chatId, 'AWAITING_CLIENT_TROCO', 300);
        const txtTrocoPrompt = `💵 <b>Troco para Quanto?</b>\n\n` +
                               `Digite no chat abaixo o valor da nota que você vai pagar (ex: 50, 100, 200):`;
        editarMensagemTelegram(messageId, txtTrocoPrompt, null, chatId);
        responderCallbackQuery(queryId);
      }
      else if (data === "client_my_orders") {
        exibirMeusPedidosCliente(chatId, messageId);
        responderCallbackQuery(queryId);
      }
      else if (data === "client_contact") {
        exibirContatoAtendente(chatId, messageId);
        responderCallbackQuery(queryId);
      }

      // =============================================
      // 📦 MÓDULO GESTÃO DE PRODUTOS (Gerente / Dono)
      // =============================================
      else if (data === "prod_menu") {
        if (perfil !== 'DONO' && perfil !== 'GERENCIAL' && perfil !== 'GERENTE') {
          responderCallbackQuery(queryId, "Acesso restrito a Gerentes e Administradores.");
          return HtmlService.createHtmlOutput("OK");
        }
        try {
          const ss = SpreadsheetApp.getActive();
          const shProd = ss.getSheetByName('PRODUTOS');
          const dados = shProd ? shProd.getDataRange().getValues() : [];
          const totalProd = Math.max(0, dados.length - 1);

          const txt = `📦 <b>Painel de Gestão de Produtos</b>\n\n` +
                      `📊 <b>Total de Itens Cadastrados:</b> ${totalProd}\n\n` +
                      `Selecione uma opção abaixo:`;
          const markup = {
            inline_keyboard: [
              [
                { text: "➕ Cadastrar Novo Produto", callback_data: "prod_new_step1" }
              ],
              [
                { text: "📋 Listar / Editar Produtos", callback_data: "prod_list_all_edit" },
                { text: "🔍 Buscar Produto", callback_data: "prod_search_prompt" }
              ],
              [
                { text: "◀️ Menu Principal", callback_data: "menu" }
              ]
            ]
          };
          editarMensagemTelegram(messageId, txt, markup, chatId);
        } catch(err) {
          enviarMensagemTelegram("❌ Erro ao abrir gestão de produtos: " + err.message, null, chatId);
        }
        responderCallbackQuery(queryId);
      }
      else if (data === "prod_new_step1") {
        if (perfil !== 'DONO' && perfil !== 'GERENCIAL' && perfil !== 'GERENTE') {
          responderCallbackQuery(queryId, "Acesso restrito.");
          return HtmlService.createHtmlOutput("OK");
        }
        const cache = CacheService.getScriptCache();
        cache.put('state_' + chatId, 'AWAITING_NEW_PROD_NOME', 300);

        const msg = `➕ <b>Cadastro de Novo Produto</b> (Passo 1/5)\n\n` +
                    `✍️ <b>Digite o Nome Completo do Produto:</b>\n\n` +
                    `<i>Exemplo: Cerveja Corona 330ml, Refrigerante Pepsi 2L, Gelo 5kg, etc.</i>`;
        const back = { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: "prod_menu" }]] };
        editarMensagemTelegram(messageId, msg, back, chatId);
        responderCallbackQuery(queryId);
      }
      else if (data.startsWith("prod_cat_")) {
        const catEscolhida = data.substring(9);
        const cache = CacheService.getScriptCache();
        const nomeProd = cache.get('temp_newprod_nome_' + chatId) || 'Produto';
        cache.put('temp_newprod_cat_' + chatId, catEscolhida, 300);
        cache.put('state_' + chatId, 'AWAITING_NEW_PROD_CUSTO', 300);

        const msg = `➕ <b>Cadastro de Produto</b> (Passo 3/5)\n\n` +
                    `📦 <b>Produto:</b> <b>${nomeProd}</b>\n` +
                    `📂 <b>Categoria:</b> <b>${catEscolhida}</b>\n\n` +
                    `💵 <b>Digite o Preço de Custo / Compra (R$)</b> no chat:\n` +
                    `<i>Exemplo: 5.50 (ou 0 se não souber)</i>`;
        const back = { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: "prod_menu" }]] };
        editarMensagemTelegram(messageId, msg, back, chatId);
        responderCallbackQuery(queryId);
      }
      else if (data.startsWith("prod_setmargem_")) {
        const margemPct = Number(data.substring(15));
        const cache = CacheService.getScriptCache();
        const nomeProd = cache.get('temp_newprod_nome_' + chatId) || 'Produto';
        const custo = Number(cache.get('temp_newprod_custo_' + chatId)) || 0;
        const precoVenda = custo > 0 ? (custo * (1 + margemPct / 100)) : (margemPct > 0 ? margemPct : 0);

        cache.put('temp_newprod_margem_' + chatId, String(margemPct), 300);
        cache.put('temp_newprod_preco_' + chatId, String(precoVenda), 300);
        cache.put('state_' + chatId, 'AWAITING_NEW_PROD_MIN', 300);

        const msg = `➕ <b>Cadastro de Produto</b> (Passo 5/5)\n\n` +
                    `📦 <b>Produto:</b> <b>${nomeProd}</b>\n` +
                    `💰 <b>Custo:</b> R$ ${custo.toFixed(2)} | 📈 <b>Margem:</b> ${margemPct}%\n` +
                    `💵 <b>Preço de Venda Calculado:</b> <b>R$ ${precoVenda.toFixed(2)}</b>\n\n` +
                    `🚨 <b>Digite o Estoque Mínimo para Alerta Crítico:</b>\n` +
                    `<i>Exemplo: 12</i>`;
        const back = { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: "prod_menu" }]] };
        editarMensagemTelegram(messageId, msg, back, chatId);
        responderCallbackQuery(queryId);
      }
      else if (data === "prod_analise_menu" || data.startsWith("prod_analise_page_")) {
        if (perfil !== 'DONO' && perfil !== 'GERENCIAL' && perfil !== 'GERENTE') {
          responderCallbackQuery(queryId, "Acesso restrito a Gerentes e Administradores.");
          return HtmlService.createHtmlOutput("OK");
        }
        try {
          const page = data.startsWith("prod_analise_page_") ? Number(data.substring(18)) || 1 : 1;
          const pageSize = 8;

          const ss = SpreadsheetApp.getActive();
          const shProd = ss.getSheetByName('PRODUTOS');
          const dadosProd = shProd ? shProd.getDataRange().getValues() : [];

          const prods = [];
          for (let i = 1; i < dadosProd.length; i++) {
            const nome = String(dadosProd[i][0] || '').trim();
            if (nome) {
              prods.push({
                rowIdx: i + 1,
                nome: nome,
                preco: Number(dadosProd[i][4]) || 0,
                custo: Number(dadosProd[i][6]) || 0,
                margem: Number(dadosProd[i][7]) || 0
              });
            }
          }

          if (prods.length === 0) {
            editarMensagemTelegram(messageId, `📦 <b>Nenhum produto cadastrado para análise.</b>`, { inline_keyboard: [[{ text: "◀️ Voltar", callback_data: "prod_menu" }]] }, chatId);
            responderCallbackQuery(queryId);
            return HtmlService.createHtmlOutput("OK");
          }

          const totalPages = Math.ceil(prods.length / pageSize);
          const startIdx = (page - 1) * pageSize;
          const currentList = prods.slice(startIdx, startIdx + pageSize);

          let msg = `📊 <b>Análise de Lucratividade dos Produtos</b> (Pág ${page}/${totalPages})\n\n` +
                    `Selecione um produto abaixo para visualizar o raio-x financeiro, margem e índice de ganho, ou faça uma busca por nome:`;

          const buttons = [];
          for (let i = 0; i < currentList.length; i += 2) {
            const rowButtons = [];
            rowButtons.push({
              text: `📊 ${currentList[i].nome.substring(0, 18)}`,
              callback_data: `prod_analise_view_${currentList[i].rowIdx}`
            });
            if (currentList[i + 1]) {
              rowButtons.push({
                text: `📊 ${currentList[i + 1].nome.substring(0, 18)}`,
                callback_data: `prod_analise_view_${currentList[i + 1].rowIdx}`
              });
            }
            buttons.push(rowButtons);
          }

          const navRow = [];
          if (page > 1) {
            navRow.push({ text: "◀️ Anterior", callback_data: `prod_analise_page_${page - 1}` });
          }
          if (page < totalPages) {
            navRow.push({ text: "Próxima ▶️", callback_data: `prod_analise_page_${page + 1}` });
          }
          if (navRow.length > 0) buttons.push(navRow);

          buttons.push([
            { text: "🔍 Digitar Nome do Produto", callback_data: "prod_analise_search" }
          ]);
          buttons.push([
            { text: "📦 Gestão de Produtos", callback_data: "prod_menu" },
            { text: "◀️ Menu Principal", callback_data: "menu" }
          ]);

          editarMensagemTelegram(messageId, msg, { inline_keyboard: buttons }, chatId);
        } catch(err) {
          enviarMensagemTelegram("❌ Erro ao abrir análise: " + err.message, null, chatId);
        }
        responderCallbackQuery(queryId);
      }
      else if (data.startsWith("prod_analise_view_")) {
        const rowIdx = Number(data.substring(18));
        exibirAnaliseProdutoTelegram(rowIdx, chatId, messageId);
        responderCallbackQuery(queryId);
      }
      else if (data === "prod_analise_search") {
        const cache = CacheService.getScriptCache();
        cache.put('state_' + chatId, 'AWAITING_ANALISE_PROD_INPUT', 300);
        const msg = `🔍 <b>Análise de Produto</b>\n\n` +
                    `✍️ <b>Digite o nome do produto</b> que deseja pesquisar e analisar:`;
        const back = { inline_keyboard: [[{ text: "◀️ Voltar à Lista", callback_data: "prod_analise_menu" }]] };
        editarMensagemTelegram(messageId, msg, back, chatId);
        responderCallbackQuery(queryId);
      }
      else if (data === "prod_list_all_edit" || data.startsWith("prod_list_page_")) {
        if (perfil !== 'DONO' && perfil !== 'GERENCIAL' && perfil !== 'GERENTE') {
          responderCallbackQuery(queryId, "Acesso restrito.");
          return HtmlService.createHtmlOutput("OK");
        }
        try {
          const page = data.startsWith("prod_list_page_") ? Number(data.substring(15)) || 1 : 1;
          const pageSize = 10;

          const ss = SpreadsheetApp.getActive();
          const shProd = ss.getSheetByName('PRODUTOS');
          const dados = shProd ? shProd.getDataRange().getValues() : [];
          const mapaEst = (typeof obterMapaEstoqueReal === 'function') ? obterMapaEstoqueReal() : {};
          const safeNorm = str => String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();

          const prods = [];
          for (let i = 1; i < dados.length; i++) {
            const nome = String(dados[i][0] || '').trim();
            if (nome) {
              const nomeNorm = safeNorm(nome);
              const estReal = (mapaEst[nomeNorm] !== undefined) ? mapaEst[nomeNorm] : (mapaEst[nome.toLowerCase()] !== undefined ? mapaEst[nome.toLowerCase()] : (Number(dados[i][11]) || 0));
              prods.push({
                rowIdx: i + 1,
                nome: nome,
                cat: String(dados[i][1] || 'Geral'),
                preco: Number(dados[i][4]) || 0,
                minimo: Number(dados[i][5]) || 0,
                estoque: estReal
              });
            }
          }

          if (prods.length === 0) {
            editarMensagemTelegram(messageId, `📦 <b>Nenhum produto cadastrado ainda.</b>`, { inline_keyboard: [[{ text: "➕ Cadastrar Primeiro Produto", callback_data: "prod_new_step1" }], [{ text: "◀️ Voltar", callback_data: "prod_menu" }]] }, chatId);
            responderCallbackQuery(queryId);
            return HtmlService.createHtmlOutput("OK");
          }

          const totalPages = Math.ceil(prods.length / pageSize);
          const startIdx = (page - 1) * pageSize;
          const currentList = prods.slice(startIdx, startIdx + pageSize);

          let msg = `📋 <b>Lista de Produtos (Pág ${page}/${totalPages}):</b>\n` +
                    `<i>Toque em um produto para visualizar ou editar preço/estoque:</i>\n\n`;

          const buttons = [];
          currentList.forEach(p => {
            msg += `• <b>${p.nome}</b>\n  └ 💵 R$ ${p.preco.toFixed(2).replace('.', ',')} | 📦 <b>Estoque: ${p.estoque} un</b>\n\n`;
            buttons.push([
              { text: `⚙️ Editar: ${p.nome.substring(0, 26)}`, callback_data: `prod_edit_${p.rowIdx}` }
            ]);
          });

          const navRow = [];
          if (page > 1) {
            navRow.push({ text: "◀️ Anterior", callback_data: `prod_list_page_${page - 1}` });
          }
          if (page < totalPages) {
            navRow.push({ text: "Próxima ▶️", callback_data: `prod_list_page_${page + 1}` });
          }
          if (navRow.length > 0) buttons.push(navRow);

          buttons.push([{ text: "◀️ Voltar ao Menu de Produtos", callback_data: "prod_menu" }]);

          editarMensagemTelegram(messageId, msg, { inline_keyboard: buttons }, chatId);
        } catch(err) {
          enviarMensagemTelegram("❌ Erro ao listar produtos: " + err.message, null, chatId);
        }
        responderCallbackQuery(queryId);
      }
      else if (data.startsWith("prod_edit_")) {
        const rowIdx = Number(data.substring(10));
        try {
          const ss = SpreadsheetApp.getActive();
          const shProd = ss.getSheetByName('PRODUTOS');
          const shEst = ss.getSheetByName('ESTOQUE');
          const rowData = shProd.getRange(rowIdx, 1, 1, shProd.getLastColumn()).getValues()[0];

          const nome = String(rowData[0] || '').trim();
          const cat = String(rowData[1] || 'Geral');
          const preco = Number(rowData[4]) || 0;
          const min = Number(rowData[5]) || 0;
          const custo = Number(rowData[6]) || 0;
          const margem = Number(rowData[7]) || 0;
          const margemPct = (margem * 100).toFixed(1);
          const precoSug = Number(rowData[8]) || (custo * 1.5);
          const statusMargem = String(rowData[9] || 'OK');
          
          let estoqueAtual = 0;
          if (shEst) {
            const estData = shEst.getDataRange().getValues();
            for (let i = 1; i < estData.length; i++) {
              if (String(estData[i][0]).toUpperCase().trim() === nome.toUpperCase().trim()) {
                estoqueAtual = Number(estData[i][1]) || 0;
                break;
              }
            }
          }

          const msg = `⚙️ <b>Gestão do Produto: ${nome}</b>\n\n` +
                      `• 📂 <b>Categoria:</b> ${cat}\n` +
                      `• 💵 <b>Preço de Venda:</b> <b>R$ ${preco.toFixed(2)}</b>\n` +
                      `• 💰 <b>Custo Médio:</b> R$ ${custo.toFixed(2)}\n` +
                      `• 📈 <b>Margem Atual:</b> <b>${margemPct}%</b> (Sugerido: R$ ${precoSug.toFixed(2)})\n` +
                      `• 🏷️ <b>Status Margem:</b> ${statusMargem}\n` +
                      `• 📊 <b>Estoque Atual:</b> <b>${estoqueAtual} unidade(s)</b>\n` +
                      `• 🚨 <b>Estoque Mínimo:</b> <b>${min} unidade(s)</b>\n\n` +
                      `<i>Selecione o que deseja ajustar neste produto:</i>`;

          const buttons = [
            [
              { text: "📈 Ajustar Margem %", callback_data: `prod_chg_margem_${rowIdx}` },
              { text: "💵 Alterar Preço", callback_data: `prod_chg_price_${rowIdx}` }
            ],
            [
              { text: "📦 Ajustar Estoque", callback_data: `prod_chg_stock_${rowIdx}` },
              { text: "🚨 Alterar Mínimo", callback_data: `prod_chg_min_${rowIdx}` }
            ],
            [
              { text: "◀️ Voltar à Lista", callback_data: "prod_list_all_edit" }
            ]
          ];

          editarMensagemTelegram(messageId, msg, { inline_keyboard: buttons }, chatId);
        } catch(err) {
          enviarMensagemTelegram("❌ Erro ao abrir produto: " + err.message, null, chatId);
        }
        responderCallbackQuery(queryId);
      }
      else if (data.startsWith("prod_chg_margem_")) {
        const rowIdx = Number(data.substring(16));
        const cache = CacheService.getScriptCache();
        cache.put('state_' + chatId, `AWAITING_EDIT_MARGEM:${rowIdx}`, 300);

        try {
          const ss = SpreadsheetApp.getActive();
          const shProd = ss.getSheetByName('PRODUTOS');
          const rowData = shProd.getRange(rowIdx, 1, 1, shProd.getLastColumn()).getValues()[0];
          const nome = String(rowData[0] || '').trim();
          const preco = Number(rowData[4]) || 0;
          const custo = Number(rowData[6]) || 0;
          const margemAtual = (Number(rowData[7]) * 100).toFixed(1);

          const msg = `📈 <b>Ajuste de Margem de Lucro: ${nome}</b>\n\n` +
                      `• 💰 <b>Custo Unitário:</b> R$ ${custo.toFixed(2)}\n` +
                      `• 💵 <b>Preço de Venda Atual:</b> R$ ${preco.toFixed(2)}\n` +
                      `• 📊 <b>Margem Atual:</b> <b>${margemAtual}%</b>\n\n` +
                      `Toque na nova margem desejada ou <b>digite no chat</b> (Ex: <code>55</code>):`;

          const buttons = [
            [
              { text: `30% (R$ ${(custo * 1.30).toFixed(2)})`, callback_data: `prod_apply_margem_${rowIdx}_30` },
              { text: `40% (R$ ${(custo * 1.40).toFixed(2)})`, callback_data: `prod_apply_margem_${rowIdx}_40` }
            ],
            [
              { text: `50% (R$ ${(custo * 1.50).toFixed(2)})`, callback_data: `prod_apply_margem_${rowIdx}_50` },
              { text: `60% (R$ ${(custo * 1.60).toFixed(2)})`, callback_data: `prod_apply_margem_${rowIdx}_60` }
            ],
            [
              { text: `80% (R$ ${(custo * 1.80).toFixed(2)})`, callback_data: `prod_apply_margem_${rowIdx}_80` },
              { text: `100% (R$ ${(custo * 2.00).toFixed(2)})`, callback_data: `prod_apply_margem_${rowIdx}_100` }
            ],
            [{ text: "◀️ Voltar ao Produto", callback_data: `prod_edit_${rowIdx}` }]
          ];

          editarMensagemTelegram(messageId, msg, { inline_keyboard: buttons }, chatId);
        } catch(err) {
          responderCallbackQuery(queryId, "Erro: " + err.message);
        }
        responderCallbackQuery(queryId);
      }
      else if (data.startsWith("prod_apply_margem_")) {
        const parts = data.split('_');
        const margemPct = Number(parts.pop());
        const rowIdx = Number(parts.pop());

        try {
          const ss = SpreadsheetApp.getActive();
          const shProd = ss.getSheetByName('PRODUTOS');
          const rowData = shProd.getRange(rowIdx, 1, 1, shProd.getLastColumn()).getValues()[0];
          const nome = String(rowData[0] || '').trim();
          const custo = Number(rowData[6]) || 0;
          const novoPreco = custo > 0 ? Number((custo * (1 + margemPct / 100)).toFixed(2)) : Number(rowData[4]);

          shProd.getRange(rowIdx, 5).setValue(novoPreco);
          if (typeof normalizarFormulasProdutos === 'function') normalizarFormulasProdutos();
          if (typeof atualizarMargemProduto === 'function') atualizarMargemProduto(nome, margemPct);

          responderCallbackQuery(queryId, `✅ Margem ajustada para ${margemPct}%!`);
          const evt = { callback_query: { id: queryId, data: `prod_edit_${rowIdx}`, message: { chat: chat, message_id: messageId } } };
          doPost({ postData: { contents: JSON.stringify(evt) } });
          return HtmlService.createHtmlOutput("OK");
        } catch(err) {
          responderCallbackQuery(queryId, "Erro: " + err.message);
        }
      }
      else if (data.startsWith("prod_chg_price_")) {
        const rowIdx = Number(data.substring(15));
        const cache = CacheService.getScriptCache();
        cache.put('state_' + chatId, `AWAITING_EDIT_PRICE:${rowIdx}`, 300);

        try {
          const ss = SpreadsheetApp.getActive();
          const shProd = ss.getSheetByName('PRODUTOS');
          const nome = String(shProd.getRange(rowIdx, 1).getValue() || '');
          const precoAtual = Number(shProd.getRange(rowIdx, 5).getValue()) || 0;

          const msg = `💵 <b>Alteração de Preço: ${nome}</b>\n\n` +
                      `• Preço atual: R$ ${precoAtual.toFixed(2)}\n\n` +
                      `✍️ <b>Digite o NOVO preço de venda</b> no chat (Ex: <code>9.50</code>):`;
          const back = { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: `prod_edit_${rowIdx}` }]] };
          editarMensagemTelegram(messageId, msg, back, chatId);
        } catch(err) {
          responderCallbackQuery(queryId, "Erro: " + err.message);
        }
        responderCallbackQuery(queryId);
      }
      else if (data.startsWith("prod_chg_stock_")) {
        const rowIdx = Number(data.substring(15));
        const cache = CacheService.getScriptCache();
        cache.put('state_' + chatId, `AWAITING_EDIT_STOCK:${rowIdx}`, 300);

        try {
          const ss = SpreadsheetApp.getActive();
          const shProd = ss.getSheetByName('PRODUTOS');
          const nome = String(shProd.getRange(rowIdx, 1).getValue() || '');

          const msg = `📦 <b>Ajuste de Estoque: ${nome}</b>\n\n` +
                      `✍️ <b>Digite a NOVA QUANTIDADE em estoque</b> no chat (Ex: <code>48</code>):`;
          const back = { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: `prod_edit_${rowIdx}` }]] };
          editarMensagemTelegram(messageId, msg, back, chatId);
        } catch(err) {
          responderCallbackQuery(queryId, "Erro: " + err.message);
        }
        responderCallbackQuery(queryId);
      }
      else if (data.startsWith("prod_chg_min_")) {
        const rowIdx = Number(data.substring(13));
        const cache = CacheService.getScriptCache();
        cache.put('state_' + chatId, `AWAITING_EDIT_MIN:${rowIdx}`, 300);

        try {
          const ss = SpreadsheetApp.getActive();
          const shProd = ss.getSheetByName('PRODUTOS');
          const nome = String(shProd.getRange(rowIdx, 1).getValue() || '');

          const msg = `🚨 <b>Alteração de Estoque Mínimo: ${nome}</b>\n\n` +
                      `✍️ <b>Digite o NOVO ESTOQUE MÍNIMO</b> no chat (Ex: <code>15</code>):`;
          const back = { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: `prod_edit_${rowIdx}` }]] };
          editarMensagemTelegram(messageId, msg, back, chatId);
        } catch(err) {
          responderCallbackQuery(queryId, "Erro: " + err.message);
        }
        responderCallbackQuery(queryId);
      }
      else if (data === "prod_search_prompt") {
        const cache = CacheService.getScriptCache();
        cache.put('state_' + chatId, 'AWAITING_SEARCH_PROD', 300);

        const msg = `🔍 <b>Busca de Produtos</b>\n\n` +
                    `✍️ <b>Digite o nome ou parte do nome do produto</b> no chat:`;
        const back = { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: "prod_menu" }]] };
        editarMensagemTelegram(messageId, msg, back, chatId);
        responderCallbackQuery(queryId);
      }

      // =============================================
      // 🍺 MÓDULO COMANDAS BALCÃO
      // =============================================
      else if (data === "cmd_menu") {
        const abertas = obterComandasAbertasTelegram();
        let totalSaldo = 0;
        abertas.forEach(c => {
          totalSaldo += typeof calcularSaldoComanda === 'function' ? calcularSaldoComanda(c.pedido) : 0;
        });

        const txt = `🍺 <b>Painel de Comandas de Balcão</b>\n\n` +
                    `📂 <b>Comandas Abertas:</b> ${abertas.length}\n` +
                    `💵 <b>Saldo Devedor Acumulado:</b> R$ ${totalSaldo.toFixed(2)}\n\n` +
                    `Selecione uma opção:`;
        const markup = {
          inline_keyboard: [
            [
              { text: `📂 Listar Abertas (${abertas.length})`, callback_data: "cmd_open" },
              { text: "➕ Nova Comanda", callback_data: "cmd_new" }
            ],
            [{ text: "◀️ Menu Principal", callback_data: "menu" }]
          ]
        };
        editarMensagemTelegram(messageId, txt, markup, chatId);
        responderCallbackQuery(queryId);
      }
      else if (data === "cmd_new") {
        // Registra estado conversacional no cache para capturar o nome do cliente
        const cache = CacheService.getScriptCache();
        cache.put('state_' + chatId, 'AWAITING_COMANDA_CLIENTE', 300);

        const descNovaComanda = `➕ <b>Abrir Nova Comanda de Balcão</b>\n\n` +
                               `✍️ <b>Digite o nome do cliente</b> (ou Mesa / Balcão) no chat abaixo:\n\n` +
                               `<i>Exemplo: João Silva, Mesa 4, etc.</i>`;
        const backMarkup = {
          inline_keyboard: [[{ text: "❌ Cancelar", callback_data: "cmd_menu" }]]
        };
        editarMensagemTelegram(messageId, descNovaComanda, backMarkup, chatId);
        responderCallbackQuery(queryId);
      }
      else if (data === "cmd_open") {
        try {
          const abertas = obterComandasAbertasTelegram();
          if (abertas.length === 0) {
            const noCmdText = `🍺 <b>Comandas Abertas:</b>\n\nNenhuma comanda aberta localizada no sistema.`;
            const backMarkup = {
              inline_keyboard: [
                [{ text: "➕ Abrir Nova Comanda", callback_data: "cmd_new" }],
                [{ text: "◀️ Voltar ao Menu", callback_data: "menu" }]
              ]
            };
            editarMensagemTelegram(messageId, noCmdText, backMarkup, chatId);
          } else {
            let msg = `🍺 <b>Comandas Abertas no Balcão:</b>\n\n`;
            const buttons = [];
            let row = [];
            abertas.forEach(c => {
              const saldo = typeof calcularSaldoComanda === 'function' ? calcularSaldoComanda(c.pedido) : 0;
              msg += `• <b>${c.pedido}</b> - ${c.cliente || 'Consumidor'} | R$ ${saldo.toFixed(2)}\n`;
              row.push({ text: `🔎 ${c.pedido} (${c.cliente || 'Consumidor'})`, callback_data: `cmd_info_${c.pedido}` });
              if (row.length === 2) {
                buttons.push(row);
                row = [];
              }
            });
            if (row.length) buttons.push(row);
            buttons.push([{ text: "◀️ Voltar", callback_data: "cmd_menu" }]);
            editarMensagemTelegram(messageId, msg, { inline_keyboard: buttons }, chatId);
          }
        } catch(err) {
          enviarMensagemTelegram("❌ Erro ao listar comandas: " + err.message, null, chatId);
        }
        responderCallbackQuery(queryId);
      }
      else if (data.startsWith("cmd_info_")) {
        const pedido = data.substring(9);
        exibirDetalhesComandaTelegram(pedido, chatId, messageId);
        responderCallbackQuery(queryId);
      }
      else if (data.startsWith("cmd_additem_")) {
        const pedido = data.substring(12);
        try {
          const ss = SpreadsheetApp.getActive();
          const shProd = ss.getSheetByName('PRODUTOS');
          const shEst = ss.getSheetByName('ESTOQUE');
          const dadosProd = shProd ? shProd.getDataRange().getValues() : [];
          const dadosEst = shEst ? shEst.getDataRange().getValues() : [];

          const estoqueMap = {};
          dadosEst.forEach((l, idx) => {
            if (idx > 0) {
              const nomeEst = String(l[0] || '').trim().toUpperCase();
              estoqueMap[nomeEst] = Number(l[1]) || 0;
            }
          });
          
          let msg = `🛒 <b>Adicionar Produto à Comanda ${pedido}</b>\n\n` +
                    `Selecione um produto com estoque disponível:\n`;
          
          const buttons = [];
          for (let i = 1; i < dadosProd.length; i++) {
            const nome = String(dadosProd[i][0] || '').trim();
            const preco = Number(dadosProd[i][4]) || 0;
            const estoque = estoqueMap[nome.toUpperCase()] !== undefined ? estoqueMap[nome.toUpperCase()] : (Number(dadosProd[i][11]) || 0);

            // 🔥 Apenas exibe produtos que realmente possuem estoque disponível
            if (nome && estoque > 0) {
              const labelBtn = `🍺 ${nome} | R$ ${preco.toFixed(2)} (Est: ${estoque})`;
              buttons.push([{
                text: labelBtn,
                callback_data: `selprod_${pedido}_${i + 1}`
              }]);
            }
          }

          if (buttons.length === 0) {
            msg = `🚨 <b>Estoque Indisponível</b>\n\nNenhum produto possui estoque maior que zero no momento.`;
          }

          buttons.push([{ text: "◀️ Voltar à Comanda", callback_data: `cmd_info_${pedido}` }]);
          editarMensagemTelegram(messageId, msg, { inline_keyboard: buttons }, chatId);
        } catch(err) {
          enviarMensagemTelegram("❌ Erro ao listar produtos: " + err.message, null, chatId);
        }
        responderCallbackQuery(queryId);
      }
      else if (data.startsWith("selprod_")) {
        // Formato: selprod_[pedido]_[rowIdx]
        const raw = data.substring(8);
        const lastUnder = raw.lastIndexOf('_');
        const pedido = raw.substring(0, lastUnder);
        const rowIdx = Number(raw.substring(lastUnder + 1));

        try {
          const ss = SpreadsheetApp.getActive();
          const shProd = ss.getSheetByName('PRODUTOS');
          const shEst = ss.getSheetByName('ESTOQUE');
          const productRow = shProd.getRange(rowIdx, 1, 1, shProd.getLastColumn()).getValues()[0];
          const nome = String(productRow[0] || '').trim();
          const preco = Number(productRow[4]) || 0;

          // Busca estoque atual
          const dadosEst = shEst ? shEst.getDataRange().getValues() : [];
          let estoque = Number(productRow[11]) || 0;
          dadosEst.forEach((l, idx) => {
            if (idx > 0 && String(l[0] || '').trim().toUpperCase() === nome.toUpperCase()) {
              estoque = Number(l[1]) || 0;
            }
          });

          if (estoque <= 0) {
            responderCallbackQuery(queryId, `❌ Produto sem estoque disponível!`);
            return HtmlService.createHtmlOutput("OK");
          }

          let msg = `🛒 <b>Lançar Item na Comanda: ${pedido}</b>\n\n` +
                    `📦 <b>Produto:</b> <b>${nome}</b>\n` +
                    `💵 <b>Preço Unitário:</b> R$ ${preco.toFixed(2)}\n` +
                    `📊 <b>Estoque Disponível:</b> <b>${estoque} unidade(s)</b>\n\n` +
                    `🔢 <b>Toque na quantidade desejada ou digite:</b>`;

          const buttons = [];
          
          // 🔥 Gera botões individuais até o limite real do estoque (máx 6)
          const baseQtds = [];
          const maxBase = Math.min(estoque, 6);
          for (let q = 1; q <= maxBase; q++) {
            baseQtds.push(q);
          }
          
          let row = [];
          baseQtds.forEach(q => {
            row.push({ text: `${q} un`, callback_data: `additem_${pedido}_${rowIdx}_${q}` });
            if (row.length === 3) {
              buttons.push(row);
              row = [];
            }
          });
          if (row.length > 0) buttons.push(row);

          // Opções em lote se o estoque permitir
          const lotes = [];
          if (estoque >= 10 && !baseQtds.includes(10)) lotes.push({ text: "10 un", q: 10 });
          if (estoque >= 12 && !baseQtds.includes(12)) lotes.push({ text: "12 un (Fardo)", q: 12 });
          if (estoque >= 24 && !baseQtds.includes(24)) lotes.push({ text: "24 un (Caixa)", q: 24 });
          
          if (lotes.length > 0) {
            let rowLote = [];
            lotes.forEach(l => {
              rowLote.push({ text: l.text, callback_data: `additem_${pedido}_${rowIdx}_${l.q}` });
              if (rowLote.length === 2) {
                buttons.push(rowLote);
                rowLote = [];
              }
            });
            if (rowLote.length > 0) buttons.push(rowLote);
          }

          // ✏️ Botão para digitar qualquer quantidade
          buttons.push([
            { text: "✏️ Digitar Outra Quantidade", callback_data: `customqtd_${pedido}_${rowIdx}` }
          ]);

          buttons.push([
            { text: "◀️ Trocar Produto", callback_data: `cmd_additem_${pedido}` },
            { text: "❌ Cancelar", callback_data: `cmd_info_${pedido}` }
          ]);

          editarMensagemTelegram(messageId, msg, { inline_keyboard: buttons }, chatId);
        } catch(err) {
          enviarMensagemTelegram("❌ Erro ao abrir seletor de quantidade: " + err.message, null, chatId);
        }
        responderCallbackQuery(queryId);
      }
      else if (data.startsWith("customqtd_")) {
        const raw = data.substring(10);
        const lastUnder = raw.lastIndexOf('_');
        const pedido = raw.substring(0, lastUnder);
        const rowIdx = Number(raw.substring(lastUnder + 1));

        try {
          const ss = SpreadsheetApp.getActive();
          const shProd = ss.getSheetByName('PRODUTOS');
          const shEst = ss.getSheetByName('ESTOQUE');
          const productRow = shProd.getRange(rowIdx, 1, 1, shProd.getLastColumn()).getValues()[0];
          const nome = String(productRow[0] || '').trim();
          const preco = Number(productRow[4]) || 0;

          const dadosEst = shEst ? shEst.getDataRange().getValues() : [];
          let estoque = Number(productRow[11]) || 0;
          dadosEst.forEach((l, idx) => {
            if (idx > 0 && String(l[0] || '').trim().toUpperCase() === nome.toUpperCase()) {
              estoque = Number(l[1]) || 0;
            }
          });

          const cache = CacheService.getScriptCache();
          cache.put('state_' + chatId, `AWAITING_CUSTOM_QTD:${pedido}:${rowIdx}`, 300);

          const msg = `✏️ <b>Digitar Quantidade Manualmente</b>\n\n` +
                      `📦 <b>Produto:</b> <b>${nome}</b>\n` +
                      `💵 <b>Preço Unitário:</b> R$ ${preco.toFixed(2)}\n` +
                      `📊 <b>Estoque Disponível:</b> <b>${estoque} unidade(s)</b>\n\n` +
                      `✍️ <b>Digite o número da quantidade</b> desejada no chat (Ex: <code>8</code>):`;

          const back = {
            inline_keyboard: [[{ text: "◀️ Voltar ao Seletor", callback_data: `selprod_${pedido}_${rowIdx}` }]]
          };
          editarMensagemTelegram(messageId, msg, back, chatId);
        } catch(err) {
          enviarMensagemTelegram("❌ Erro: " + err.message, null, chatId);
        }
        responderCallbackQuery(queryId);
      }
      else if (data.startsWith("additem_") || data.startsWith("add_")) {
        const prefix = data.startsWith("additem_") ? "additem_" : "add_";
        const raw = data.substring(prefix.length);
        const parts = raw.split('_');
        const qtd = Number(parts.pop()) || 1;
        const rowIdx = Number(parts.pop());
        const pedido = parts.join('_');

        try {
          const ss = SpreadsheetApp.getActive();
          const shProd = ss.getSheetByName('PRODUTOS');
          const productRow = shProd.getRange(rowIdx, 1, 1, shProd.getLastColumn()).getValues()[0];
          const nome = String(productRow[0] || '').trim();
          const preco = Number(productRow[4]) || 0;

          if (typeof validarEstoque === 'function' && !validarEstoque(nome, qtd)) {
            responderCallbackQuery(queryId, `❌ Estoque insuficiente de ${nome}!`);
            return HtmlService.createHtmlOutput("OK");
          }

          if (typeof salvarItensComandaAberta === 'function') {
            salvarItensComandaAberta(pedido, [{ produto: nome, qtd: qtd, unit: preco }]);
            responderCallbackQuery(queryId, `✅ +${qtd}x ${nome} lançado na comanda ${pedido}!`);
            exibirDetalhesComandaTelegram(pedido, chatId, messageId);
          }
        } catch(err) {
          responderCallbackQuery(queryId, "Erro: " + err.message);
        }
      }
      else if (data.startsWith("paypix_prompt_")) {
        const pedido = data.substring(14);
        try {
          responderCallbackQuery(queryId, "⏳ Gerando QR Code PIX...");

          const ss = SpreadsheetApp.getActive();
          const shItens = ss.getSheetByName('COMANDA_ITENS');
          const itensRaw = shItens ? shItens.getDataRange().getValues() : [];

          let totalCalculado = 0;
          for (let i = 1; i < itensRaw.length; i++) {
            const rowPed = String(itensRaw[i][0] || '');
            if (pedidosCorrespondem(rowPed, pedido)) {
              const qtd = Number(itensRaw[i][2]) || 0;
              const unit = Number(itensRaw[i][3]) || 0;
              const tot = Number(itensRaw[i][4]) || (qtd * unit);
              if (qtd > 0) totalCalculado += tot;
            }
          }

          const cliente = typeof getClienteDaComanda === 'function' ? getClienteDaComanda(pedido) : '';
          const totalOficial = typeof calcularTotalComanda === 'function' ? calcularTotalComanda(pedido) : totalCalculado;
          const totalFinal = Math.max(totalOficial, totalCalculado);
          const pagos = typeof calcularPagamentosComanda === 'function' ? calcularPagamentosComanda(pedido) : 0;
          const saldo = Math.max(0, totalFinal - pagos);
          const valorCobrar = saldo > 0 ? saldo : totalFinal;

          const chavePix = typeof getConfig === 'function' ? (getConfig('CHAVE_PIX') || getConfig('PIX_CHAVE') || '') : '';
          const nomeRecebedor = typeof getConfig === 'function' ? (getConfig('DONO') || 'DEPOSITO') : 'DEPOSITO';
          const cidadeRecebedor = typeof getConfig === 'function' ? (getConfig('CIDADE') || 'SALVADOR') : 'SALVADOR';
          const txId = ('COM' + pedido).replace(/[^A-Za-z0-9]/g, '').slice(0, 25);

          if (!chavePix) {
            enviarMensagemTelegram("⚠️ <b>Atenção:</b> Nenhuma chave PIX cadastrada nas Configurações do Depósito.", null, chatId);
            return HtmlService.createHtmlOutput("OK");
          }

          const payloadPix = gerarPayloadPixBRCodeTelegram(chavePix, nomeRecebedor, cidadeRecebedor, valorCobrar, txId);
          const qrCodeUrl = "https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&ecc=M&data=" + encodeURIComponent(payloadPix);

          const legenda = `📱 <b>COBRANÇA PIX - COMANDA #${pedido}</b>\n\n` +
                          `👤 <b>Cliente:</b> <b>${cliente || 'Consumidor Balcão'}</b>\n` +
                          `💵 <b>Valor a Pagar:</b> <b>R$ ${valorCobrar.toFixed(2).replace('.', ',')}</b>\n\n` +
                          `👉 <i>Mostre esta tela para o cliente ler o QR Code no app do banco.</i>\n\n` +
                          `🔑 <b>PIX Copia e Cola:</b>\n` +
                          `<code>${payloadPix}</code>\n\n` +
                          `<i>Após o cliente pagar e o crédito constar na conta, confirme abaixo:</i>`;

          const markup = {
            inline_keyboard: [
              [{ text: "✅ Confirmar Pagamento Recebido", callback_data: `pay_${pedido}_PIX` }],
              [{ text: "◀️ Voltar aos Detalhes", callback_data: `cmd_info_${pedido}` }]
            ]
          };

          enviarFotoTelegram(qrCodeUrl, legenda, markup, chatId);
        } catch(errPix) {
          console.error("Erro ao gerar QR Code PIX da comanda:", errPix);
          responderCallbackQuery(queryId, "Erro: " + errPix.message);
        }
      }
      else if (data.startsWith("pay_")) {
        // Formato: pay_[pedido]_[FORMA]
        const parts = data.split('_');
        const forma = parts.pop() || 'DINHEIRO';
        const pedido = parts.slice(1).join('_');

        try {
          let formaNorm = 'Dinheiro';
          const fUpper = forma.toUpperCase();
          if (fUpper.includes('PIX')) formaNorm = 'Pix';
          else if (fUpper.includes('CART') || fUpper.includes('CRED') || fUpper.includes('DEB')) formaNorm = 'Cartão';
          else if (fUpper.includes('FIADO')) formaNorm = '🧾 Fiado';
          else formaNorm = 'Dinheiro';

          if (typeof fecharComandaBalcaoFinal === 'function') {
            const res = fecharComandaBalcaoFinal(pedido, formaNorm);
            if (res && res.ok) {
              // Garante a gravação do status FECHADA na planilha
              try {
                const ss = SpreadsheetApp.getActive();
                const shCmd = ss.getSheetByName('COMANDAS');
                if (shCmd) {
                  const cmdData = shCmd.getDataRange().getValues();
                  for (let i = 1; i < cmdData.length; i++) {
                    if (pedidosCorrespondem(cmdData[i][0], pedido) || String(cmdData[i][0]) === String(pedido) || Number(cmdData[i][0]) == Number(pedido)) {
                      shCmd.getRange(i + 1, 5).setValue('FECHADA');
                    }
                  }
                }
              } catch(eStatus) {
                console.error("Erro ao garantir status FECHADA:", eStatus);
              }

              const msgSucesso = `🎉 <b>Comanda ${pedido} Quitada e Fechada!</b>\n\n` +
                                 `💵 <b>Forma de Pagamento:</b> <b>${formaNorm}</b>\n` +
                                 `📦 <b>Estoque:</b> Baixado automaticamente\n` +
                                 `💰 <b>Caixa:</b> Entrada registrada com sucesso!`;
              const back = {
                inline_keyboard: [
                  [{ text: "📂 Ver Comandas Abertas", callback_data: "cmd_open" }],
                  [{ text: "🏠 Menu Principal", callback_data: "menu" }]
                ]
              };
              editarMensagemTelegram(messageId, msgSucesso, back, chatId);
              responderCallbackQuery(queryId, "✅ Comanda fechada com sucesso!");
            } else {
              responderCallbackQuery(queryId, "❌ " + (res?.msg || 'Erro ao fechar'));
            }
          }
        } catch(err) {
          responderCallbackQuery(queryId, "Erro: " + err.message);
        }
      }
      else if (data.startsWith("paypar_")) {
        const pedido = data.substring(7);
        try {
          const total = typeof calcularTotalComanda === 'function' ? calcularTotalComanda(pedido) : 0;
          const pagos = typeof calcularPagamentosComanda === 'function' ? calcularPagamentosComanda(pedido) : 0;
          const saldo = Math.max(0, total - pagos);

          if (saldo <= 0) {
            responderCallbackQuery(queryId, "Esta comanda já está 100% quitada!");
            exibirDetalhesComandaTelegram(pedido, chatId, messageId);
            return HtmlService.createHtmlOutput("OK");
          }

          let msg = `💸 <b>Pagamento Parcial da Comanda: ${pedido}</b>\n\n` +
                    `⚖️ <b>Saldo Devedor Restante:</b> <b>R$ ${saldo.toFixed(2)}</b>\n\n` +
                    `Selecione uma opção rápida de valor ou digite o valor desejado:`;

          const buttons = [];
          
          // Sugestões rápidas inteligentes
          const sugestoes = [10, 20, 50, 100].filter(v => v < saldo);
          if (sugestoes.length > 0) {
            let rowPix = [];
            sugestoes.forEach(v => {
              rowPix.push({ text: `📱 R$ ${v} (PIX)`, callback_data: `execpaypar_${pedido}_${v}_PIX` });
              if (rowPix.length === 2) {
                buttons.push(rowPix);
                rowPix = [];
              }
            });
            if (rowPix.length > 0) buttons.push(rowPix);
          }

          buttons.push([
            { text: "✏️ Digitar Outro Valor", callback_data: `custompaypar_${pedido}` }
          ]);

          buttons.push([
            { text: "◀️ Voltar aos Detalhes", callback_data: `cmd_info_${pedido}` }
          ]);

          editarMensagemTelegram(messageId, msg, { inline_keyboard: buttons }, chatId);
        } catch(err) {
          enviarMensagemTelegram("❌ Erro: " + err.message, null, chatId);
        }
        responderCallbackQuery(queryId);
      }
      else if (data.startsWith("custompaypar_")) {
        const pedido = data.substring(13);
        const cache = CacheService.getScriptCache();
        cache.put('state_' + chatId, `AWAITING_CUSTOM_PAY:${pedido}`, 300);

        const total = typeof calcularTotalComanda === 'function' ? calcularTotalComanda(pedido) : 0;
        const pagos = typeof calcularPagamentosComanda === 'function' ? calcularPagamentosComanda(pedido) : 0;
        const saldo = Math.max(0, total - pagos);

        const msg = `💸 <b>Lançar Pagamento Parcial</b>\n\n` +
                    `🧾 <b>Comanda:</b> <b>${pedido}</b>\n` +
                    `⚖️ <b>Saldo Devedor:</b> <b>R$ ${saldo.toFixed(2)}</b>\n\n` +
                    `✍️ <b>Digite o valor e a forma de pagamento</b> no chat:\n` +
                    `<code>[Valor] [Forma: PIX, DINHEIRO ou CARTAO]</code>\n\n` +
                    `<i>Exemplo: 25.50 PIX ou 50 DINHEIRO</i>`;

        const back = {
          inline_keyboard: [[{ text: "◀️ Cancelar", callback_data: `cmd_info_${pedido}` }]]
        };
        editarMensagemTelegram(messageId, msg, back, chatId);
        responderCallbackQuery(queryId);
      }
      else if (data.startsWith("execpaypar_")) {
        // Formato: execpaypar_[pedido]_[valor]_[forma]
        const raw = data.substring(11);
        const parts = raw.split('_');
        const forma = parts.pop();
        const valor = Number(parts.pop());
        const pedido = parts.join('_');

        try {
          if (typeof registrarPagamentoParcialComanda === 'function') {
            let formaNorm = forma === 'PIX' ? 'Pix' : (forma === 'DINHEIRO' ? 'Dinheiro' : 'Cartão');
            const res = registrarPagamentoParcialComanda(pedido, valor, formaNorm);
            if (res.ok) {
              if (res.quitado && typeof fecharComandaBalcaoFinal === 'function') {
                fecharComandaBalcaoFinal(pedido, formaNorm);
                try {
                  const ss = SpreadsheetApp.getActive();
                  const shCmd = ss.getSheetByName('COMANDAS');
                  if (shCmd) {
                    const cmdData = shCmd.getDataRange().getValues();
                    for (let i = 1; i < cmdData.length; i++) {
                      if (pedidosCorrespondem(cmdData[i][0], pedido) || String(cmdData[i][0]) === String(pedido) || Number(cmdData[i][0]) == Number(pedido)) {
                        shCmd.getRange(i + 1, 5).setValue('FECHADA');
                      }
                    }
                  }
                } catch(eStatus) {
                  console.error("Erro ao garantir status FECHADA:", eStatus);
                }
                responderCallbackQuery(queryId, "🎉 Comanda 100% quitada e fechada!");
              } else {
                responderCallbackQuery(queryId, `✅ R$ ${valor.toFixed(2)} registrado com sucesso!`);
              }
              exibirDetalhesComandaTelegram(pedido, chatId, messageId);
            } else {
              responderCallbackQuery(queryId, "❌ " + (res.msg || 'Erro ao registrar'));
            }
          }
        } catch(err) {
          responderCallbackQuery(queryId, "Erro: " + err.message);
        }
      }

      // =============================================
      // 🚚 MÓDULO DELIVERY COMPLETO
      // =============================================
      else if (data === "deliv_menu") {
        const ativos = obterDeliveriesAtivosTelegram();
        const txt = `🚚 <b>Painel de Gestão de Delivery</b>\n\n` +
                    `📦 <b>Pedidos Ativos no Momento:</b> ${ativos.length}\n\n` +
                    `Selecione uma opção:`;
        const markup = {
          inline_keyboard: [
            [
              { text: `📋 Pedidos Ativos (${ativos.length})`, callback_data: "deliv_list" },
              { text: "➕ Novo Delivery", callback_data: "deliv_new" }
            ],
            [{ text: "◀️ Menu Principal", callback_data: "menu" }]
          ]
        };
        editarMensagemTelegram(messageId, txt, markup, chatId);
        responderCallbackQuery(queryId);
      }
      else if (data === "deliv_new") {
        const cache = CacheService.getScriptCache();
        cache.put('state_' + chatId, 'AWAITING_DELIVERY_CLIENTE', 300);
        const desc = `🛵 <b>Novo Pedido de Delivery</b> (Passo 1/2)\n\n` +
                     `✍️ <b>Digite o nome do cliente</b> no chat abaixo:\n\n` +
                     `<i>Exemplo: Marcos Paulo, Ana Maria, etc.</i>`;
        const back = { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: "deliv_menu" }]] };
        editarMensagemTelegram(messageId, desc, back, chatId);
        responderCallbackQuery(queryId);
      }
      else if (data.startsWith("deliv_create_")) {
        // Formato: deliv_create_[FORMA]
        const forma = data.substring(13);
        const cache = CacheService.getScriptCache();
        const clientName = cache.get('temp_deliv_client_' + chatId) || 'Consumidor';
        cache.remove('temp_deliv_client_' + chatId);
        cache.remove('state_' + chatId);

        let formaNorm = 'Dinheiro';
        if (forma === 'PIX') formaNorm = 'Pix';
        else if (forma === 'CARTAO') formaNorm = 'Cartão';
        else if (forma === 'FIADO') formaNorm = '🧾 Fiado';

        try {
          const pedido = criarDeliverySimplesTelegram(clientName, formaNorm);
          responderCallbackQuery(queryId, `✅ Delivery #${pedido} criado!`);
          exibirDetalhesDeliveryTelegram(pedido, chatId, messageId);
        } catch(e) {
          responderCallbackQuery(queryId, "Erro ao criar: " + e.message);
        }
      }
      else if (data === "deliv_list") {
        const ativos = obterDeliveriesAtivosTelegram();
        if (ativos.length === 0) {
          const noDelivText = `🚚 <b>Painel de Delivery</b>\n\nNenhum pedido de delivery ativo no momento.`;
          const back = {
            inline_keyboard: [
              [{ text: "➕ Novo Delivery", callback_data: "deliv_new" }],
              [{ text: "◀️ Voltar ao Menu", callback_data: "menu" }]
            ]
          };
          editarMensagemTelegram(messageId, noDelivText, back, chatId);
        } else {
          let msg = `🚚 <b>Pedidos de Delivery Ativos:</b>\n\n`;
          const buttons = [];
          ativos.forEach(d => {
            msg += `• <b>#${d.pedido}</b> - ${d.cliente} | R$ ${d.total.toFixed(2)} [${d.status}]\n`;
            buttons.push([
              { text: `🛵 #${d.pedido} - ${d.cliente} (${d.status})`, callback_data: `deliv_info_${d.pedido}` }
            ]);
          });
          buttons.push([{ text: "➕ Novo Delivery", callback_data: "deliv_new" }]);
          buttons.push([{ text: "◀️ Voltar ao Delivery", callback_data: "deliv_menu" }]);
          editarMensagemTelegram(messageId, msg, { inline_keyboard: buttons }, chatId);
        }
        responderCallbackQuery(queryId);
      }
      else if (data.startsWith("deliv_info_")) {
        const pedido = data.substring(11);
        exibirDetalhesDeliveryTelegram(pedido, chatId, messageId);
        responderCallbackQuery(queryId);
      }
      else if (data.startsWith("deliv_additem_")) {
        const pedido = data.substring(14);
        try {
          const ss = SpreadsheetApp.getActive();
          const shProd = ss.getSheetByName('PRODUTOS');
          const shEst = ss.getSheetByName('ESTOQUE');
          const dadosProd = shProd ? shProd.getDataRange().getValues() : [];
          const dadosEst = shEst ? shEst.getDataRange().getValues() : [];

          const estoqueMap = {};
          dadosEst.forEach((l, idx) => {
            if (idx > 0) {
              const nomeEst = String(l[0] || '').trim().toUpperCase();
              estoqueMap[nomeEst] = Number(l[1]) || 0;
            }
          });
          
          let msg = `🛒 <b>Adicionar Produto ao Delivery #${pedido}</b>\n\n` +
                    `Selecione um produto com estoque disponível:\n`;
          
          const buttons = [];
          for (let i = 1; i < dadosProd.length; i++) {
            const nome = String(dadosProd[i][0] || '').trim();
            const preco = Number(dadosProd[i][4]) || 0;
            const estoque = estoqueMap[nome.toUpperCase()] !== undefined ? estoqueMap[nome.toUpperCase()] : (Number(dadosProd[i][11]) || 0);

            if (nome && estoque > 0) {
              const labelBtn = `🍺 ${nome} | R$ ${preco.toFixed(2)} (Est: ${estoque})`;
              buttons.push([{
                text: labelBtn,
                callback_data: `deliv_selprod_${pedido}_${i + 1}`
              }]);
            }
          }

          if (buttons.length === 0) {
            msg = `🚨 <b>Estoque Indisponível</b>\n\nNenhum produto possui estoque maior que zero no momento.`;
          }

          buttons.push([{ text: "◀️ Voltar ao Pedido", callback_data: `deliv_info_${pedido}` }]);
          editarMensagemTelegram(messageId, msg, { inline_keyboard: buttons }, chatId);
        } catch(err) {
          enviarMensagemTelegram("❌ Erro ao listar produtos: " + err.message, null, chatId);
        }
        responderCallbackQuery(queryId);
      }
      else if (data.startsWith("deliv_selprod_")) {
        // Formato: deliv_selprod_[pedido]_[rowIdx]
        const raw = data.substring(14);
        const lastUnder = raw.lastIndexOf('_');
        const pedido = raw.substring(0, lastUnder);
        const rowIdx = Number(raw.substring(lastUnder + 1));

        try {
          const ss = SpreadsheetApp.getActive();
          const shProd = ss.getSheetByName('PRODUTOS');
          const shEst = ss.getSheetByName('ESTOQUE');
          const productRow = shProd.getRange(rowIdx, 1, 1, shProd.getLastColumn()).getValues()[0];
          const nome = String(productRow[0] || '').trim();
          const preco = Number(productRow[4]) || 0;

          const dadosEst = shEst ? shEst.getDataRange().getValues() : [];
          let estoque = Number(productRow[11]) || 0;
          dadosEst.forEach((l, idx) => {
            if (idx > 0 && String(l[0] || '').trim().toUpperCase() === nome.toUpperCase()) {
              estoque = Number(l[1]) || 0;
            }
          });

          if (estoque <= 0) {
            responderCallbackQuery(queryId, `❌ Produto sem estoque disponível!`);
            return HtmlService.createHtmlOutput("OK");
          }

          let msg = `🛒 <b>Lançar Item no Delivery #${pedido}</b>\n\n` +
                    `📦 <b>Produto:</b> <b>${nome}</b>\n` +
                    `💵 <b>Preço Unitário:</b> R$ ${preco.toFixed(2)}\n` +
                    `📊 <b>Estoque Disponível:</b> <b>${estoque} unidade(s)</b>\n\n` +
                    `🔢 <b>Toque na quantidade desejada ou digite:</b>`;

          const buttons = [];
          const baseQtds = [];
          const maxBase = Math.min(estoque, 6);
          for (let q = 1; q <= maxBase; q++) baseQtds.push(q);
          
          let row = [];
          baseQtds.forEach(q => {
            row.push({ text: `${q} un`, callback_data: `deliv_add_${pedido}_${rowIdx}_${q}` });
            if (row.length === 3) {
              buttons.push(row);
              row = [];
            }
          });
          if (row.length > 0) buttons.push(row);

          const lotes = [];
          if (estoque >= 10 && !baseQtds.includes(10)) lotes.push({ text: "10 un", q: 10 });
          if (estoque >= 12 && !baseQtds.includes(12)) lotes.push({ text: "12 un (Fardo)", q: 12 });
          if (estoque >= 24 && !baseQtds.includes(24)) lotes.push({ text: "24 un (Caixa)", q: 24 });
          
          if (lotes.length > 0) {
            let rowLote = [];
            lotes.forEach(l => {
              rowLote.push({ text: l.text, callback_data: `deliv_add_${pedido}_${rowIdx}_${l.q}` });
              if (rowLote.length === 2) {
                buttons.push(rowLote);
                rowLote = [];
              }
            });
            if (rowLote.length > 0) buttons.push(rowLote);
          }

          buttons.push([
            { text: "✏️ Digitar Outra Quantidade", callback_data: `deliv_customqtd_${pedido}_${rowIdx}` }
          ]);

          buttons.push([
            { text: "◀️ Trocar Produto", callback_data: `deliv_additem_${pedido}` },
            { text: "❌ Cancelar", callback_data: `deliv_info_${pedido}` }
          ]);

          editarMensagemTelegram(messageId, msg, { inline_keyboard: buttons }, chatId);
        } catch(err) {
          enviarMensagemTelegram("❌ Erro: " + err.message, null, chatId);
        }
        responderCallbackQuery(queryId);
      }
      else if (data.startsWith("deliv_customqtd_")) {
        const raw = data.substring(16);
        const lastUnder = raw.lastIndexOf('_');
        const pedido = raw.substring(0, lastUnder);
        const rowIdx = Number(raw.substring(lastUnder + 1));

        try {
          const ss = SpreadsheetApp.getActive();
          const shProd = ss.getSheetByName('PRODUTOS');
          const shEst = ss.getSheetByName('ESTOQUE');
          const productRow = shProd.getRange(rowIdx, 1, 1, shProd.getLastColumn()).getValues()[0];
          const nome = String(productRow[0] || '').trim();
          const preco = Number(productRow[4]) || 0;

          const dadosEst = shEst ? shEst.getDataRange().getValues() : [];
          let estoque = Number(productRow[11]) || 0;
          dadosEst.forEach((l, idx) => {
            if (idx > 0 && String(l[0] || '').trim().toUpperCase() === nome.toUpperCase()) {
              estoque = Number(l[1]) || 0;
            }
          });

          const cache = CacheService.getScriptCache();
          cache.put('state_' + chatId, `AWAITING_DELIVERY_CUSTOM_QTD:${pedido}:${rowIdx}`, 300);

          const msg = `✏️ <b>Digitar Quantidade Manualmente</b>\n\n` +
                      `📦 <b>Produto:</b> <b>${nome}</b>\n` +
                      `💵 <b>Preço Unitário:</b> R$ ${preco.toFixed(2)}\n` +
                      `📊 <b>Estoque Disponível:</b> <b>${estoque} unidade(s)</b>\n\n` +
                      `✍️ <b>Digite a quantidade desejada</b> no chat:`;

          const back = {
            inline_keyboard: [[{ text: "◀️ Voltar ao Seletor", callback_data: `deliv_selprod_${pedido}_${rowIdx}` }]]
          };
          editarMensagemTelegram(messageId, msg, back, chatId);
        } catch(err) {
          enviarMensagemTelegram("❌ Erro: " + err.message, null, chatId);
        }
        responderCallbackQuery(queryId);
      }
      else if (data.startsWith("deliv_add_")) {
        const raw = data.substring(10);
        const parts = raw.split('_');
        const qtd = Number(parts.pop()) || 1;
        const rowIdx = Number(parts.pop());
        const pedido = parts.join('_');

        try {
          const ss = SpreadsheetApp.getActive();
          const shProd = ss.getSheetByName('PRODUTOS');
          const productRow = shProd.getRange(rowIdx, 1, 1, shProd.getLastColumn()).getValues()[0];
          const nome = String(productRow[0] || '').trim();
          const preco = Number(productRow[4]) || 0;

          if (typeof validarEstoque === 'function' && !validarEstoque(nome, qtd)) {
            responderCallbackQuery(queryId, `❌ Estoque insuficiente de ${nome}!`);
            return HtmlService.createHtmlOutput("OK");
          }

          salvarItemDeliveryTelegram(pedido, nome, qtd, preco);
          responderCallbackQuery(queryId, `✅ +${qtd}x ${nome} adicionado ao delivery!`);
          exibirDetalhesDeliveryTelegram(pedido, chatId, messageId);
        } catch(err) {
          responderCallbackQuery(queryId, "Erro: " + err.message);
        }
      }
      else if (data.startsWith("deliv_set_driver_") || data.startsWith("deliv_disp_")) {
        const pedido = data.startsWith("deliv_set_driver_") ? data.substring(17) : data.substring(11);
        const cache = CacheService.getScriptCache();
        cache.put('state_' + chatId, 'AWAITING_DELIV_DRIVER:' + pedido, 300);
        const txtPrompt = `🛵 <b>Atribuir Entregador ao Pedido #${pedido}</b>\n\n` +
                          `✍️ <b>Digite o Nome do Entregador</b> no chat abaixo:\n\n` +
                          `<i>(Ex: Carlos Motoboy, João Silva, Marcos)</i>`;
        const back = { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: `deliv_info_${pedido}` }]] };
        editarMensagemTelegram(messageId, txtPrompt, back, chatId);
        responderCallbackQuery(queryId);
      }
      else if (data.startsWith("deliv_done_")) {
        const pedido = data.substring(11);
        try {
          if (typeof finalizarDelivery === 'function') {
            const res = finalizarDelivery(pedido);
            if (res && res.ok) {
              responderCallbackQuery(queryId, "✅ Entrega concluída e lançada no Caixa!");
              const msgSucesso = `🎉 <b>Delivery #${pedido} Concluído com Sucesso!</b>\n\n` +
                                 `• Status atualizado para <b>ENTREGUE</b>\n` +
                                 `• Saldo em Caixa atualizado\n` +
                                 `• Estoque baixado com sucesso!`;
              const back = { inline_keyboard: [[{ text: "◀️ Voltar ao Delivery", callback_data: "deliv_menu" }]] };
              editarMensagemTelegram(messageId, msgSucesso, back, chatId);
            } else {
              responderCallbackQuery(queryId, "❌ " + (res?.msg || 'Erro ao finalizar'));
            }
          }
        } catch(err) {
          responderCallbackQuery(queryId, "Erro: " + err.message);
        }
      }
      else if (data.startsWith("deliv_canc_")) {
        const pedido = data.substring(11);
        try {
          if (typeof cancelarDeliveryPorId === 'function') {
            const res = cancelarDeliveryPorId(pedido);
            if (res && res.ok) {
              responderCallbackQuery(queryId, "❌ Pedido cancelado.");
              const back = { inline_keyboard: [[{ text: "◀️ Voltar ao Delivery", callback_data: "deliv_menu" }]] };
              editarMensagemTelegram(messageId, `❌ <b>Delivery #${pedido} cancelado com sucesso.</b>`, back, chatId);
            } else {
              responderCallbackQuery(queryId, "❌ " + (res?.msg || 'Erro ao cancelar'));
            }
          }
        } catch(err) {
          responderCallbackQuery(queryId, "Erro: " + err.message);
        }
      }
      else if (data.startsWith("deliv_approve_pix_")) {
        const pedido = data.substring(18);
        try {
          responderCallbackQuery(queryId, "⏳ Aprovando pagamento...");

          // 1. Atualiza status no banco/planilha para 'EM PREPARAÇÃO'
          const ss = SpreadsheetApp.getActive();
          const shDel = ss.getSheetByName('DELIVERY');
          let clienteNome = '';
          let valor = 0;
          if (shDel) {
            const dados = shDel.getDataRange().getValues();
            for (let i = 1; i < dados.length; i++) {
              if (pedidosCorrespondem(dados[i][0], pedido) || String(dados[i][0]) === String(pedido) || Number(dados[i][0]) == Number(pedido)) {
                shDel.getRange(i + 1, 8).setValue('EM PREPARAÇÃO');
                clienteNome = dados[i][2] || 'Cliente';
                valor = Number(dados[i][5]) || 0;
                break;
              }
            }
          }

          // 2. Notifica o cliente
          const clientChatId = PropertiesService.getScriptProperties().getProperty('deliv_chat_' + pedido);
          if (clientChatId) {
            const msgCliente = `🎉 <b>PAGAMENTO PIX CONFIRMADO!</b>\n\n` +
                               `O pagamento do seu pedido <b>#DEL-${pedido}</b> foi aprovado com sucesso!\n` +
                               `👨‍🍳 Nossos atendentes já estão preparando seus produtos para a entrega. 🛵💨`;
            enviarMensagemTelegram(msgCliente, {
              inline_keyboard: [[{ text: "📦 Acompanhar Pedido", callback_data: "client_my_orders" }]]
            }, clientChatId);
          }

          // 3. Atualiza mensagem do gestor
          const quemAprovou = usuario ? (usuario.nome || usuario.usuario) : 'Gestor';
          const msgGestor = `✅ <b>PAGAMENTO PIX APROVADO!</b>\n\n` +
                            `🛵 <b>Pedido:</b> <code>#DEL-${pedido}</code>\n` +
                            `👤 <b>Cliente:</b> ${clienteNome}\n` +
                            `💰 <b>Valor:</b> R$ ${valor.toFixed(2).replace('.', ',')}\n` +
                            `🛡️ <b>Aprovado por:</b> ${quemAprovou}\n` +
                            `📊 <b>Status Atual:</b> <b>EM PREPARAÇÃO</b>`;

          const markupPos = {
            inline_keyboard: [
              [{ text: "🛵 Atribuir Entregador & Despachar", callback_data: `deliv_set_driver_${pedido}` }],
              [{ text: "🔍 Ver Pedido", callback_data: `deliv_info_${pedido}` }],
              [{ text: "◀️ Painel Delivery", callback_data: "deliv_menu" }]
            ]
          };

          editarMensagemTelegram(messageId, msgGestor, markupPos, chatId);
        } catch(errAppr) {
          console.error("Erro ao aprovar PIX:", errAppr);
          responderCallbackQuery(queryId, "Erro: " + errAppr.message);
        }
      }
      else if (data.startsWith("deliv_reject_pix_")) {
        const pedido = data.substring(17);
        try {
          responderCallbackQuery(queryId, "Comprovante recusado.");

          // 1. Notifica o cliente e restaura o estado de espera do comprovante
          const clientChatId = PropertiesService.getScriptProperties().getProperty('deliv_chat_' + pedido);
          if (clientChatId) {
            const cache = CacheService.getScriptCache();
            cache.put('state_' + clientChatId, 'AWAITING_DELIVERY_PIX_RECEIPT:' + pedido, 3600);

            const msgCliente = `⚠️ <b>ATENÇÃO: COMPROVANTE NÃO CONFIRMADO</b>\n\n` +
                               `Não conseguimos validar o comprovante enviado para o Pedido <b>#DEL-${pedido}</b>.\n\n` +
                               `Por favor, certifique-se de que o pagamento foi concluído com sucesso e <b>envie novamente uma foto ou print nítido do comprovante</b> aqui no chat.`;
            enviarMensagemTelegram(msgCliente, null, clientChatId);
          }

          // 2. Atualiza a mensagem do gestor
          const msgGestor = `❌ <b>COMPROVANTE RECUSADO</b>\n\n` +
                            `O comprovante do Pedido <code>#DEL-${pedido}</code> foi recusado.\n` +
                            `O cliente foi notificado para reenviar um comprovante válido.`;

          const markupPos = {
            inline_keyboard: [
              [{ text: "🔍 Ver Pedido", callback_data: `deliv_info_${pedido}` }],
              [{ text: "◀️ Painel Delivery", callback_data: "deliv_menu" }]
            ]
          };
          editarMensagemTelegram(messageId, msgGestor, markupPos, chatId);
        } catch(errRej) {
          console.error("Erro ao recusar comprovante:", errRej);
          responderCallbackQuery(queryId, "Erro: " + errRej.message);
        }
      }

      // =============================================
      // 🛒 COMPRAS & ENTRADA DE MERCADORIAS
      // =============================================
      else if (data === "comp_menu") {
        exibirMenuComprasTelegram(chatId, messageId);
        responderCallbackQuery(queryId);
      }
      else if (data === "comp_history") {
        exibirHistoricoComprasTelegram(chatId, messageId);
        responderCallbackQuery(queryId);
      }
      else if (data === "comp_sugestoes") {
        exibirSugestoesCompraTelegram(chatId, messageId);
        responderCallbackQuery(queryId);
      }
      else if (data === "comp_new_step1" || data === "comp_prompt_prod") {
        iniciarFluxoNovaCompraTelegram(chatId, messageId, null);
        responderCallbackQuery(queryId);
      }
      else if (data.startsWith("comp_sel_prod_")) {
        const prod = decodeURIComponent(data.substring(14));
        iniciarFluxoNovaCompraTelegram(chatId, messageId, prod);
        responderCallbackQuery(queryId, `Produto: ${prod}`);
      }
      else if (data.startsWith("comp_set_qtd_")) {
        const qtd = Number(data.substring(13)) || 1;
        const cache = CacheService.getScriptCache();
        const prod = cache.get('temp_comp_prod_' + chatId) || 'Produto';
        cache.put('temp_comp_qtd_' + chatId, String(qtd), 600);
        cache.put('state_' + chatId, 'AWAITING_COMPRA_UNIT', 600);

        // Busca custo de referência se cadastrado
        let custoRef = 0;
        try {
          const ss = SpreadsheetApp.getActive();
          const shProd = ss.getSheetByName('PRODUTOS');
          if (shProd) {
            const dados = shProd.getDataRange().getValues();
            for (let i = 1; i < dados.length; i++) {
              if (String(dados[i][0] || '').trim().toLowerCase() === prod.trim().toLowerCase()) {
                custoRef = Number(dados[i][2]) || 0;
                break;
              }
            }
          }
        } catch(e) {}

        let txtPrompt = `🛒 <b>Nova Compra: ${prod} (Passo 3/4)</b>\n\n` +
                        `📦 <b>Quantidade:</b> ${qtd} unidades\n\n` +
                        `💵 <b>Qual o Custo Unitário pago por item?</b>\n` +
                        (custoRef > 0 ? `<i>(Custo atual de cadastro: R$ ${custoRef.toFixed(2).replace('.', ',')})</i>\n\n` : '') +
                        `<i>Digite o valor no chat abaixo (Ex: 4.50, 3,80):</i>`;
        const back = { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: "comp_menu" }]] };
        editarMensagemTelegram(messageId, txtPrompt, back, chatId);
        responderCallbackQuery(queryId);
      }
      else if (data.startsWith("comp_set_forn_")) {
        const forn = data.substring(14);
        const cache = CacheService.getScriptCache();
        cache.put('temp_comp_forn_' + chatId, forn, 600);
        cache.remove('state_' + chatId);

        const prod = cache.get('temp_comp_prod_' + chatId) || 'Produto';
        const qtd = Number(cache.get('temp_comp_qtd_' + chatId)) || 1;
        const unit = Number(cache.get('temp_comp_unit_' + chatId)) || 0;
        const total = qtd * unit;

        const txtPay = `💳 <b>Forma de Pagamento da Compra (Passo 4/4)</b>\n\n` +
                       `📦 <b>Produto:</b> ${prod}\n` +
                       `🔢 <b>Quantidade:</b> ${qtd} un.\n` +
                       `💵 <b>Custo Unitário:</b> R$ ${unit.toFixed(2).replace('.', ',')}\n` +
                       `🏢 <b>Fornecedor:</b> ${forn}\n` +
                       `💰 <b>TOTAL A PAGAR: R$ ${total.toFixed(2).replace('.', ',')}</b>\n\n` +
                       `Selecione como foi ou será realizado o pagamento:`;
        const keyboard = [
          [
            { text: "📱 PIX", callback_data: "comp_pay_PIX" },
            { text: "💵 Dinheiro", callback_data: "comp_pay_DINHEIRO" }
          ],
          [
            { text: "📄 Boleto (A Pagar)", callback_data: "comp_pay_BOLETO" },
            { text: "💳 Cartão", callback_data: "comp_pay_CARTAO" }
          ],
          [
            { text: "⏳ A Prazo / Consignado", callback_data: "comp_pay_A_PRAZO" }
          ],
          [{ text: "❌ Cancelar", callback_data: "comp_menu" }]
        ];
        editarMensagemTelegram(messageId, txtPay, { inline_keyboard: keyboard }, chatId);
        responderCallbackQuery(queryId);
      }
      else if (data.startsWith("comp_pay_")) {
        const forma = data.substring(9).replace('_', ' ');
        const cache = CacheService.getScriptCache();
        const prod = cache.get('temp_comp_prod_' + chatId) || 'Produto';
        const qtd = Number(cache.get('temp_comp_qtd_' + chatId)) || 1;
        const unit = Number(cache.get('temp_comp_unit_' + chatId)) || 0;
        const forn = cache.get('temp_comp_forn_' + chatId) || 'Geral';
        const total = qtd * unit;

        responderCallbackQuery(queryId, "Gravando compra...");

        const emailUser = (typeof usuarioLogado !== 'undefined' && usuarioLogado) ? (usuarioLogado.id || usuarioLogado.nome) : 'TELEGRAM';
        const res = salvarCompraTelegram(prod, qtd, unit, forn, forma, emailUser);

        if (res && res.ok) {
          const idComp = res.id || 'CPR';
          const linkDriveMes = (typeof obterLinkPastaNotasMesVigente === 'function') ? obterLinkPastaNotasMesVigente() : 'https://drive.google.com/drive/folders/1z5JjtXhuuC5z_qUjpfW91vy8_dlWN4Sq';
          const txtSucesso = `🎉 <b>COMPRA REGISTRADA COM SUCESSO!</b>\n\n` +
                             `📦 <b>Produto:</b> ${prod}\n` +
                             `🔢 <b>Quantidade Entrante:</b> +${qtd} un.\n` +
                             `💵 <b>Custo Unitário:</b> R$ ${unit.toFixed(2).replace('.', ',')}\n` +
                             `💰 <b>Total da Compra:</b> <b>R$ ${total.toFixed(2).replace('.', ',')}</b>\n` +
                             `🏢 <b>Fornecedor:</b> ${forn}\n` +
                             `💳 <b>Pagamento:</b> ${forma}\n` +
                             (res.id ? `🆔 <b>Código:</b> <code>#${res.id}</code>\n` : '') +
                             `\n✅ <i>Estoque aumentado, custo médio recalculado e saída lançada no Caixa!</i>\n\n` +
                             `📸 <b>Deseja anexar a Nota Fiscal / Comprovante?</b>\n` +
                             `<i>Você pode tirar a foto agora pelo chat ou abrir a câmera no Google Drive:</i>`;
          const markupPos = {
            inline_keyboard: [
              [{ text: "📷 Tirar Foto / Enviar NF no Chat", callback_data: `comp_upload_prompt_${idComp}` }],
              [{ text: "📂 Abrir Câmera no Drive", url: linkDriveMes }],
              [
                { text: "➕ Nova Compra", callback_data: "comp_new_step1" },
                { text: "📦 Ver Estoque", callback_data: "estoque" }
              ],
              [{ text: "◀️ Menu de Compras", callback_data: "comp_menu" }]
            ]
          };
          editarMensagemTelegram(messageId, txtSucesso, markupPos, chatId);
        } else {
          editarMensagemTelegram(messageId, `❌ Erro ao salvar compra: ${res?.msg || 'Erro desconhecido'}`, { inline_keyboard: [[{ text: "◀️ Voltar", callback_data: "comp_menu" }]] }, chatId);
        }
      }
      else if (data.startsWith("comp_upload_prompt_") || data === "comp_prompt_upload_general") {
        const idComp = data.startsWith("comp_upload_prompt_") ? data.substring(19) : '';
        const cache = CacheService.getScriptCache();
        cache.put('state_' + chatId, 'AWAITING_NF_PHOTO:' + idComp, 600);
        const linkDriveMes = (typeof obterLinkPastaNotasMesVigente === 'function') ? obterLinkPastaNotasMesVigente() : 'https://drive.google.com/drive/folders/1z5JjtXhuuC5z_qUjpfW91vy8_dlWN4Sq';

        const txtNF = `📸 <b>Anexar Foto da Nota Fiscal</b>\n\n` +
                      (idComp ? `🧾 Compra: <code>#${idComp}</code>\n\n` : '') +
                      `Tire uma foto ou envie o arquivo PDF da nota fiscal diretamente aqui no chat.\n\n` +
                      `<i>O bot salvará automaticamente na pasta do Google Drive do mês vigente!</i>`;
        const keyboard = [
          [{ text: "📂 Abrir Câmera no Drive", url: linkDriveMes }],
          [{ text: "❌ Cancelar", callback_data: "comp_menu" }]
        ];
        editarMensagemTelegram(messageId, txtNF, { inline_keyboard: keyboard }, chatId);
        responderCallbackQuery(queryId);
      }

      // =============================================
      // 🤖 AÇÕES DE APROVAÇÃO DE COMPRA POR IA
      // =============================================
      else if (data.startsWith("comp_ai_appr_")) {
        const aiDraftId = data.substring(13);
        const cache = CacheService.getScriptCache();
        const rawDraft = cache.get('ai_draft_' + aiDraftId);

        if (!rawDraft) {
          editarMensagemTelegram(messageId, "⚠️ <b>Esta prévia de compra expirou ou já foi processada.</b>", { inline_keyboard: [[{ text: "🛒 Menu de Compras", callback_data: "comp_menu" }]] }, chatId);
          responderCallbackQuery(queryId, "Prévia expirada.");
          return HtmlService.createHtmlOutput("OK");
        }

        const draftData = JSON.parse(rawDraft);
        cache.remove('ai_draft_' + aiDraftId);

        const emailUser = usuario ? usuario.email : 'TELEGRAM_BOT';
        const res = salvarCompraLoteIA(draftData, emailUser);

        if (res && res.ok) {
          const idComp = res.id;
          const txtSucesso = `🎉 <b>COMPRA POR IA LANÇADA COM SUCESSO!</b>\n\n` +
                             `🆔 <b>Código:</b> <code>#${idComp}</code>\n` +
                             `🏢 <b>Fornecedor:</b> ${draftData.fornecedor}\n` +
                             `📦 <b>Itens Lançados:</b> ${res.itensCount} produto(s)\n` +
                             `💰 <b>Valor Total:</b> <b>R$ ${res.total.toFixed(2).replace('.', ',')}</b>\n` +
                             `💳 <b>Forma de Pagamento:</b> ${draftData.forma_pagamento}\n` +
                             (draftData.numero_nf ? `🧾 <b>Nº Nota:</b> ${draftData.numero_nf}\n` : '') +
                             `\n✅ <i>Estoque alimentado, custos médios atualizados, comprovante anexado e saída lançada no Caixa!</i>`;

          const keyboardOk = [
            [{ text: "📂 Ver Comprovante no Drive", url: draftData.fileUrl || (typeof obterLinkPastaNotasMesVigente === 'function' ? obterLinkPastaNotasMesVigente() : 'https://drive.google.com') }],
            [
              { text: "🤖 Ler Outra Nota", callback_data: "comp_prompt_upload_general" },
              { text: "📦 Ver Estoque", callback_data: "estoque" }
            ],
            [{ text: "🛒 Menu de Compras", callback_data: "comp_menu" }]
          ];

          editarMensagemTelegram(messageId, txtSucesso, { inline_keyboard: keyboardOk }, chatId);
          responderCallbackQuery(queryId, "✅ Compra lançada com sucesso!");
        } else {
          editarMensagemTelegram(messageId, `❌ Erro ao salvar compra: ${res?.msg || 'Erro desconhecido'}`, { inline_keyboard: [[{ text: "◀️ Voltar", callback_data: "comp_menu" }]] }, chatId);
          responderCallbackQuery(queryId, "Erro ao salvar.");
        }
      }

      else if (data.startsWith("comp_ai_payopt_")) {
        const aiDraftId = data.substring(15);
        const keyboardPay = [
          [
            { text: "📄 Boleto", callback_data: `comp_ai_setpay_BOLETO_${aiDraftId}` },
            { text: "📱 PIX", callback_data: `comp_ai_setpay_PIX_${aiDraftId}` }
          ],
          [
            { text: "💵 Dinheiro", callback_data: `comp_ai_setpay_DINHEIRO_${aiDraftId}` },
            { text: "💳 Cartão", callback_data: `comp_ai_setpay_CARTAO_${aiDraftId}` }
          ],
          [
            { text: "⏳ A Prazo / Consignado", callback_data: `comp_ai_setpay_A PRAZO_${aiDraftId}` }
          ],
          [{ text: "◀️ Voltar à Prévia", callback_data: `comp_ai_reopen_${aiDraftId}` }]
        ];
        editarMensagemTelegram(messageId, "💳 <b>Selecione a Forma de Pagamento correta desta compra:</b>", { inline_keyboard: keyboardPay }, chatId);
        responderCallbackQuery(queryId);
      }

      else if (data.startsWith("comp_ai_setpay_") || data.startsWith("comp_ai_reopen_")) {
        let forma = '';
        let aiDraftId = '';
        if (data.startsWith("comp_ai_setpay_")) {
          const parts = data.substring(15).split('_');
          forma = parts[0];
          aiDraftId = parts.slice(1).join('_');
        } else {
          aiDraftId = data.substring(15);
        }

        const cache = CacheService.getScriptCache();
        const rawDraft = cache.get('ai_draft_' + aiDraftId);

        if (!rawDraft) {
          editarMensagemTelegram(messageId, "⚠️ Prévia expirada.", { inline_keyboard: [[{ text: "🛒 Menu de Compras", callback_data: "comp_menu" }]] }, chatId);
          responderCallbackQuery(queryId);
          return HtmlService.createHtmlOutput("OK");
        }

        const draftData = JSON.parse(rawDraft);
        if (forma) {
          draftData.forma_pagamento = forma.toUpperCase();
          cache.put('ai_draft_' + aiDraftId, JSON.stringify(draftData), 1800);
        }

        let itensTxt = '';
        draftData.itens.forEach((it, idx) => {
          itensTxt += `  ${idx + 1}. <b>${it.produto}</b>\n` +
                      `     └ <b>${it.qtd} un.</b> x R$ ${(Number(it.unit)||0).toFixed(2).replace('.', ',')} = <b>R$ ${(Number(it.total)||0).toFixed(2).replace('.', ',')}</b>\n`;
        });

        const msgPrevia = `🤖 <b>NOTA FISCAL LIDA POR IA COM SUCESSO!</b>\n\n` +
                          `🏢 <b>Fornecedor:</b> <b>${draftData.fornecedor}</b>\n` +
                          (draftData.numero_nf ? `🧾 <b>Nº Documento:</b> <code>${draftData.numero_nf}</code> | ` : '🧾 ') +
                          `<b>Data:</b> ${draftData.data_emissao}\n` +
                          `💳 <b>Forma de Pagamento:</b> <b>${draftData.forma_pagamento}</b>\n` +
                          `📁 <b>Foto salva no Drive:</b> <i>Compras / Notas</i>\n\n` +
                          `📦 <b>Itens Identificados (${draftData.itens.length}):</b>\n` +
                          itensTxt + `\n` +
                          `💰 <b>TOTAL DA COMPRA: R$ ${draftData.valor_total.toFixed(2).replace('.', ',')}</b>\n\n` +
                          `❓ <b>As informações estão corretas?</b> Escolha uma opção abaixo:`;

        const keyboardPrevia = [
          [
            { text: "✅ Aprovar e Lançar no Sistema", callback_data: `comp_ai_appr_${aiDraftId}` }
          ],
          [
            { text: "💳 Alterar Forma de Pgto", callback_data: `comp_ai_payopt_${aiDraftId}` },
            { text: "❌ Descartar", callback_data: `comp_ai_canc_${aiDraftId}` }
          ]
        ];

        editarMensagemTelegram(messageId, msgPrevia, { inline_keyboard: keyboardPrevia }, chatId);
        responderCallbackQuery(queryId);
      }

      else if (data.startsWith("comp_ai_canc_")) {
        const aiDraftId = data.substring(13);
        const cache = CacheService.getScriptCache();
        cache.remove('ai_draft_' + aiDraftId);
        editarMensagemTelegram(messageId, "❌ <b>Lançamento de compra cancelado e descartado.</b>", { inline_keyboard: [[{ text: "🛒 Voltar ao Menu de Compras", callback_data: "comp_menu" }]] }, chatId);
        responderCallbackQuery(queryId, "Cancelado.");
      }

      // =============================================
      // 🧾 CONTAS A RECEBER & FIADOS
      // =============================================
      else if (data === "cr_menu" || data.startsWith("cr_page_")) {
        try {
          const page = data.startsWith("cr_page_") ? Number(data.substring(8)) || 1 : 1;
          const pageSize = 6;
          const crData = obterContasReceberTelegram();
          const clientes = crData.clientes;

          let msg = `🧾 <b>Contas a Receber & Fiados</b>\n\n` +
                    `💰 <b>Total em Aberto:</b> <b>R$ ${crData.totalGeral.toFixed(2)}</b>\n` +
                    `👥 <b>Clientes com Débito:</b> <b>${clientes.length} cliente(s)</b>\n\n`;

          if (clientes.length === 0) {
            msg += `🎉 <i>Nenhum fiado pendente no momento! Todas as contas estão 100% quitadas.</i>`;
            const buttons = [
              [{ text: "🔍 Buscar Cliente", callback_data: "cr_search_prompt" }],
              [{ text: "◀️ Menu Principal", callback_data: "menu" }]
            ];
            editarMensagemTelegram(messageId, msg, { inline_keyboard: buttons }, chatId);
            responderCallbackQuery(queryId);
            return HtmlService.createHtmlOutput("OK");
          }

          const totalPages = Math.ceil(clientes.length / pageSize);
          const startIdx = (page - 1) * pageSize;
          const currentList = clientes.slice(startIdx, startIdx + pageSize);

          msg += `<b>📋 Lista de Devedores (Pág ${page}/${totalPages}):</b>\n`;
          currentList.forEach((c, idx) => {
            msg += `• <b>${c.nome}</b>: R$ ${c.saldoTotal.toFixed(2)} <i>(${c.contas.length} conta(s))</i>\n`;
          });
          msg += `\n<i>Toque em um cliente para receber/quitar o débito:</i>`;

          const buttons = [];
          currentList.forEach(c => {
            buttons.push([
              { text: `💰 Receber: ${c.nome.substring(0, 18)} (R$ ${c.saldoTotal.toFixed(2)})`, callback_data: `cr_view_${encodeURIComponent(c.nome)}` }
            ]);
          });

          const navRow = [];
          if (page > 1) {
            navRow.push({ text: "◀️ Anterior", callback_data: `cr_page_${page - 1}` });
          }
          if (page < totalPages) {
            navRow.push({ text: "Próxima ▶️", callback_data: `cr_page_${page + 1}` });
          }
          if (navRow.length > 0) buttons.push(navRow);

          buttons.push([
            { text: "🔍 Buscar Cliente por Nome", callback_data: "cr_search_prompt" }
          ]);
          buttons.push([
            { text: "◀️ Menu Principal", callback_data: "menu" }
          ]);

          editarMensagemTelegram(messageId, msg, { inline_keyboard: buttons }, chatId);
        } catch(err) {
          enviarMensagemTelegram("❌ Erro ao abrir contas a receber: " + err.message, null, chatId);
        }
        responderCallbackQuery(queryId);
      }
      else if (data.startsWith("cr_view_")) {
        const clienteNome = decodeURIComponent(data.substring(8));
        try {
          const crData = obterContasReceberTelegram();
          const clienteObj = crData.clientes.find(c => c.nome.toUpperCase().trim() === clienteNome.toUpperCase().trim());

          if (!clienteObj || clienteObj.saldoTotal <= 0) {
            responderCallbackQuery(queryId, "Este cliente não possui fiados em aberto!");
            const crDataRefresh = obterContasReceberTelegram();
            let msg = `🧾 <b>Contas a Receber & Fiados</b>\n\n` +
                      `💰 <b>Total em Aberto:</b> <b>R$ ${crDataRefresh.totalGeral.toFixed(2)}</b>\n` +
                      `🎉 <i>Débito do cliente não localizado ou já quitado!</i>`;
            const buttons = [
              [{ text: "🧾 Lista de Fiados", callback_data: "cr_menu" }],
              [{ text: "◀️ Menu Principal", callback_data: "menu" }]
            ];
            editarMensagemTelegram(messageId, msg, { inline_keyboard: buttons }, chatId);
            return HtmlService.createHtmlOutput("OK");
          }

          let msg = `👤 <b>Cliente:</b> <b>${clienteObj.nome}</b>\n\n` +
                    `💰 <b>Saldo Devedor Total:</b> <b>R$ ${clienteObj.saldoTotal.toFixed(2)}</b>\n` +
                    `📋 <b>Histórico de Contas em Aberto (${clienteObj.contas.length}):</b>\n\n`;

          clienteObj.contas.forEach((c, idx) => {
            msg += `• <b>${c.id}</b> (${c.origem}): R$ ${c.saldo.toFixed(2)} (Total: R$ ${c.total.toFixed(2)})\n`;
          });

          msg += `\n<i>Selecione como deseja registrar o pagamento:</i>`;

          const buttons = [
            [
              { text: `🟢 Quitar Tudo (R$ ${clienteObj.saldoTotal.toFixed(2)})`, callback_data: `cr_payall_${encodeURIComponent(clienteObj.nome)}` }
            ],
            [
              { text: `💸 Receber Valor Parcial`, callback_data: `cr_paypar_${encodeURIComponent(clienteObj.nome)}` }
            ],
            [
              { text: "◀️ Voltar aos Fiados", callback_data: "cr_menu" }
            ]
          ];

          editarMensagemTelegram(messageId, msg, { inline_keyboard: buttons }, chatId);
        } catch(err) {
          enviarMensagemTelegram("❌ Erro ao abrir cliente: " + err.message, null, chatId);
        }
        responderCallbackQuery(queryId);
      }
      else if (data.startsWith("cr_payall_")) {
        const clienteNome = decodeURIComponent(data.substring(10));
        const crData = obterContasReceberTelegram();
        const clienteObj = crData.clientes.find(c => c.nome.toUpperCase().trim() === clienteNome.toUpperCase().trim());
        const total = clienteObj ? clienteObj.saldoTotal : 0;

        const msg = `💰 <b>Quitar Total de Fiado</b>\n\n` +
                    `👤 <b>Cliente:</b> <b>${clienteNome}</b>\n` +
                    `💵 <b>Valor Total a Quitar:</b> <b>R$ ${total.toFixed(2)}</b>\n\n` +
                    `💳 <b>Selecione a forma de recebimento:</b>`;

        const buttons = [
          [
            { text: "📱 Receber em PIX", callback_data: `cr_do_payall_${encodeURIComponent(clienteNome)}_PIX` },
            { text: "💵 Receber Dinheiro", callback_data: `cr_do_payall_${encodeURIComponent(clienteNome)}_DINHEIRO` }
          ],
          [
            { text: "💳 Receber no Cartão", callback_data: `cr_do_payall_${encodeURIComponent(clienteNome)}_CARTAO` }
          ],
          [
            { text: "◀️ Cancelar", callback_data: `cr_view_${encodeURIComponent(clienteNome)}` }
          ]
        ];

        editarMensagemTelegram(messageId, msg, { inline_keyboard: buttons }, chatId);
        responderCallbackQuery(queryId);
      }
      else if (data.startsWith("cr_do_payall_")) {
        const parts = data.substring(13).split('_');
        const forma = parts.pop() || 'PIX';
        const clienteNome = decodeURIComponent(parts.join('_'));

        try {
          const crData = obterContasReceberTelegram();
          const clienteObj = crData.clientes.find(c => c.nome.toUpperCase().trim() === clienteNome.toUpperCase().trim());
          const total = clienteObj ? clienteObj.saldoTotal : 0;

          let formaNorm = forma === 'PIX' ? 'Pix' : (forma === 'DINHEIRO' ? 'Dinheiro' : 'Cartão');
          const res = receberFiadoClienteTelegram(clienteNome, total, formaNorm);
          if (res.ok) {
            const msgSucesso = `🎉 <b>Fiado de ${clienteNome} 100% Quitado com Sucesso!</b>\n\n` +
                               `👤 <b>Cliente:</b> ${clienteNome}\n` +
                               `💰 <b>Valor Recebido:</b> R$ ${total.toFixed(2)}\n` +
                               `💳 <b>Forma de Pagamento:</b> ${formaNorm}\n` +
                               `📥 <b>Caixa:</b> Entrada registrada automaticamente!`;
            const back = {
              inline_keyboard: [
                [{ text: "🧾 Voltar a Contas a Receber", callback_data: "cr_menu" }],
                [{ text: "🏠 Menu Principal", callback_data: "menu" }]
              ]
            };
            editarMensagemTelegram(messageId, msgSucesso, back, chatId);
            responderCallbackQuery(queryId, "✅ Fiado quitado com sucesso!");
          } else {
            responderCallbackQuery(queryId, "❌ " + res.msg);
          }
        } catch(err) {
          enviarMensagemTelegram("❌ Erro ao quitar: " + err.message, null, chatId);
        }
      }
      else if (data.startsWith("cr_paypar_")) {
        const clienteNome = decodeURIComponent(data.substring(10));
        const cache = CacheService.getScriptCache();
        cache.put('state_' + chatId, `AWAITING_CR_PAY_VALOR:${clienteNome}`, 300);

        const crData = obterContasReceberTelegram();
        const clienteObj = crData.clientes.find(c => c.nome.toUpperCase().trim() === clienteNome.toUpperCase().trim());
        const saldo = clienteObj ? clienteObj.saldoTotal : 0;

        const msg = `💸 <b>Recebimento Parcial de Fiado</b>\n\n` +
                    `👤 <b>Cliente:</b> <b>${clienteNome}</b>\n` +
                    `⚖️ <b>Saldo Devedor Total:</b> <b>R$ ${saldo.toFixed(2)}</b>\n\n` +
                    `✍️ <b>Digite o valor recebido e a forma</b> no chat:\n` +
                    `<code>[Valor] [Forma: PIX, DINHEIRO ou CARTAO]</code>\n\n` +
                    `<i>Exemplo: 30.00 PIX ou 50 DINHEIRO</i>`;

        const back = {
          inline_keyboard: [[{ text: "◀️ Cancelar", callback_data: `cr_view_${encodeURIComponent(clienteNome)}` }]]
        };
        editarMensagemTelegram(messageId, msg, back, chatId);
        responderCallbackQuery(queryId);
      }
      else if (data === "cr_search_prompt") {
        const cache = CacheService.getScriptCache();
        cache.put('state_' + chatId, 'AWAITING_CR_SEARCH_CLIENT', 300);
        const msg = `🔍 <b>Buscar Fiado de Cliente</b>\n\n` +
                    `✍️ <b>Digite o nome do cliente</b> que deseja consultar no chat:`;
        const back = { inline_keyboard: [[{ text: "◀️ Voltar aos Fiados", callback_data: "cr_menu" }]] };
        editarMensagemTelegram(messageId, msg, back, chatId);
        responderCallbackQuery(queryId);
      }

      // =============================================
      // 📦 ESTOQUE & FINANCEIRO (Gerente / Dono)
      // =============================================
      else if (data === "estoque") {
        if (perfil !== 'DONO' && perfil !== 'GERENCIAL' && perfil !== 'GERENTE') {
          responderCallbackQuery(queryId, "Acesso restrito a Gerentes e Administradores.");
          return HtmlService.createHtmlOutput("OK");
        }
        try {
          const criticos = obterProdutosEstoqueCriticoTelegram();
          let estoqueText = "";
          if (criticos && criticos.length > 0) {
            estoqueText = `🚨 <b>Produtos em Nível Crítico (${criticos.length}):</b>\n\n`;
            criticos.slice(0, 30).forEach(item => {
              estoqueText += `• <b>${item.produto}</b>\n` +
                             `  └ 📦 Estoque: <b>${item.qtd} un</b> (Mín: ${item.minimo} un) | ${item.status}\n\n`;
            });
            if (criticos.length > 30) {
              estoqueText += `<i>... e mais ${criticos.length - 30} produto(s) crítico(s).</i>\n`;
            }
          } else {
            estoqueText = `✅ <b>Estoque 100% Regularizado!</b>\n\nNenhum produto está abaixo do nível mínimo no momento.`;
          }
          const backMarkup = {
            inline_keyboard: [
              [{ text: "🔄 Atualizar Estoque", callback_data: "estoque" }],
              [{ text: "◀️ Voltar ao Menu", callback_data: "menu" }]
            ]
          };
          editarMensagemTelegram(messageId, estoqueText, backMarkup, chatId);
        } catch(err) {
          enviarMensagemTelegram("❌ Erro ao consultar estoque: " + err.message, null, chatId);
        }
        responderCallbackQuery(queryId);
      }
      else if (data === "status") {
        if (perfil !== 'DONO' && perfil !== 'GERENCIAL' && perfil !== 'GERENTE') {
          responderCallbackQuery(queryId, "Acesso restrito a Gerentes e Administradores.");
          return HtmlService.createHtmlOutput("OK");
        }
        try {
          const ss = SpreadsheetApp.getActive();
          const shCaixa = ss.getSheetByName('CAIXA');
          let faturamento = 0;
          let saldo = 0;
          let totalDinheiro = 0;
          let totalPix = 0;
          let totalCartao = 0;

          if (shCaixa) {
            const dados = shCaixa.getDataRange().getValues();
            dados.slice(1).forEach(row => {
              const tipo = String(row[1]).toUpperCase();
              const valor = Number(row[2]) || 0;
              const forma = String(row[3] || '').toUpperCase();

              if (tipo === 'RECEITA' || tipo === 'VENDA' || tipo === 'ENTRADA') {
                faturamento += valor;
                saldo += valor;
                if (forma.includes('PIX')) totalPix += valor;
                else if (forma.includes('CART') || forma.includes('CRÉD') || forma.includes('DÉB')) totalCartao += valor;
                else totalDinheiro += valor;
              } else if (tipo === 'DESPESA' || tipo === 'SAÍDA' || tipo === 'RETIRADA' || tipo === 'SAIDA') {
                saldo -= valor;
              }
            });
          }
          const statusText = `📊 <b>Status Financeiro do Depósito</b>\n\n` +
                             `💵 <b>Faturamento Bruto:</b> R$ ${faturamento.toFixed(2)}\n` +
                             `⚖️ <b>Saldo Atual em Caixa:</b> R$ ${saldo.toFixed(2)}\n\n` +
                             `<b>Entradas por Forma de Pagamento:</b>\n` +
                             `• 💵 Dinheiro: R$ ${totalDinheiro.toFixed(2)}\n` +
                             `• 📱 PIX: R$ ${totalPix.toFixed(2)}\n` +
                             `• 💳 Cartão: R$ ${totalCartao.toFixed(2)}\n\n` +
                             `<i>Atualizado em: ${new Date().toLocaleTimeString()}</i>`;
          const backMarkup = {
            inline_keyboard: [[{ text: "◀️ Voltar ao Menu", callback_data: "menu" }]]
          };
          editarMensagemTelegram(messageId, statusText, backMarkup, chatId);
        } catch(err) {
          enviarMensagemTelegram("❌ Erro ao consultar financeiro: " + err.message, null, chatId);
        }
        responderCallbackQuery(queryId);
      }

      // =============================================
      // 👑 GESTÃO DE USUÁRIOS & AUDITORIA (Dono / Gerente)
      // =============================================
      else if (data === "manage_users" || data === "users_menu") {
        if (perfil !== 'DONO' && perfil !== 'GERENCIAL' && perfil !== 'GERENTE') {
          responderCallbackQuery(queryId, "Acesso restrito ao Dono e Gerentes.");
          return HtmlService.createHtmlOutput("OK");
        }
        try {
          const ss = SpreadsheetApp.getActive();
          const sh = ss.getSheetByName('USUARIOS');
          const dados = sh ? sh.getDataRange().getValues() : [];
          
          let total = 0;
          let ativos = 0;
          let pendentes = 0;
          let bloqueados = 0;

          for (let i = 1; i < dados.length; i++) {
            if (dados[i][0]) {
              total++;
              const ativo = String(dados[i][5] || '').toUpperCase().trim();
              const cargo = String(dados[i][4] || '').toUpperCase().trim();

              if (cargo === 'PENDENTE' || ativo === 'PENDENTE') {
                pendentes++;
              } else if (ativo === 'SIM') {
                ativos++;
              } else {
                bloqueados++;
              }
            }
          }

          const txt = `👥 <b>Painel de Gestão de Usuários & Auditoria</b>\n\n` +
                      `📊 <b>Estatísticas de Acesso:</b>\n` +
                      `• <b>Total de Contas:</b> ${total}\n` +
                      `• 🟢 <b>Ativos:</b> ${ativos}\n` +
                      `• 🟡 <b>Pendentes de Aprovação:</b> ${pendentes}\n` +
                      `• 🔴 <b>Bloqueados:</b> ${bloqueados}\n\n` +
                      `Selecione uma opção:`;

          const markup = {
            inline_keyboard: [
              [
                { text: `👥 Todos os Usuários (${total})`, callback_data: "users_list_all" },
                { text: `⏳ Pendentes (${pendentes})`, callback_data: "list_pending_users" }
              ],
              [
                { text: "📜 Histórico de Interações / Logs", callback_data: "users_logs_recent" }
              ],
              [
                { text: "◀️ Menu Principal", callback_data: "menu" }
              ]
            ]
          };

          editarMensagemTelegram(messageId, txt, markup, chatId);
        } catch(err) {
          enviarMensagemTelegram("❌ Erro ao abrir gestão de usuários: " + err.message, null, chatId);
        }
        responderCallbackQuery(queryId);
      }
      else if (data === "users_list_all") {
        if (perfil !== 'DONO' && perfil !== 'GERENCIAL' && perfil !== 'GERENTE') {
          responderCallbackQuery(queryId, "Acesso restrito.");
          return HtmlService.createHtmlOutput("OK");
        }
        try {
          const ss = SpreadsheetApp.getActive();
          const sh = ss.getSheetByName('USUARIOS');
          const dados = sh ? sh.getDataRange().getValues() : [];
          
          let msg = `👥 <b>Lista Completa de Usuários Cadastrados:</b>\n\n`;
          const buttons = [];

          for (let i = 1; i < dados.length; i++) {
            const idUser = String(dados[i][0] || '').trim();
            const nome = String(dados[i][1] || '').trim();
            const perfilU = String(dados[i][4] || 'PENDENTE').toUpperCase();
            const ativo = String(dados[i][5] || '').toUpperCase() === 'SIM' ? '🟢 Ativo' : '🔴 Bloqueado';
            const tel = dados[i][8] ? '📱 Telegram OK' : '⏳ Sem Telegram';

            if (idUser && nome) {
              msg += `• <b>${nome}</b> (<code>${idUser}</code>)\n` +
                     `  └ Perfil: <b>${perfilU}</b> | ${ativo} | ${tel}\n\n`;

              buttons.push([
                { text: `⚙️ Gerenciar: ${nome} (${perfilU})`, callback_data: `user_detail_${idUser}` }
              ]);
            }
          }

          buttons.push([{ text: "◀️ Voltar ao Painel", callback_data: "manage_users" }]);
          editarMensagemTelegram(messageId, msg, { inline_keyboard: buttons }, chatId);
        } catch(err) {
          enviarMensagemTelegram("❌ Erro ao listar usuários: " + err.message, null, chatId);
        }
        responderCallbackQuery(queryId);
      }
      else if (data.startsWith("user_detail_")) {
        const idUser = data.substring(12);
        try {
          const ss = SpreadsheetApp.getActive();
          const sh = ss.getSheetByName('USUARIOS');
          const dados = sh ? sh.getDataRange().getValues() : [];
          let u = null;

          for (let i = 1; i < dados.length; i++) {
            if (String(dados[i][0]).toUpperCase().trim() === idUser.toUpperCase().trim()) {
              u = {
                id: dados[i][0],
                nome: dados[i][1],
                email: dados[i][2] || 'Não informado',
                perfil: String(dados[i][4] || 'PENDENTE').toUpperCase(),
                ativo: String(dados[i][5] || 'NAO').toUpperCase() === 'SIM',
                dataCriacao: dados[i][6] ? new Date(dados[i][6]).toLocaleDateString() : 'N/D',
                ultimoAcesso: dados[i][7] ? new Date(dados[i][7]).toLocaleString() : 'Nunca',
                telegram: dados[i][8] ? `✅ Conectado (ID: <code>${dados[i][8]}</code>)` : '❌ Não vinculado'
              };
              break;
            }
          }

          if (!u) {
            responderCallbackQuery(queryId, "Usuário não encontrado.");
            return HtmlService.createHtmlOutput("OK");
          }

          const statusIcon = u.ativo ? '🟢 <b>Ativo</b>' : '🔴 <b>Bloqueado</b>';

          let msg = `👤 <b>Detalhes da Conta: ${u.nome}</b>\n\n` +
                    `• <b>ID:</b> <code>${u.id}</code>\n` +
                    `• <b>Email:</b> ${u.email}\n` +
                    `• <b>Perfil:</b> <b>${u.perfil}</b>\n` +
                    `• <b>Status:</b> ${statusIcon}\n` +
                    `• <b>Telegram:</b> ${u.telegram}\n` +
                    `• <b>Criado em:</b> ${u.dataCriacao}\n` +
                    `• <b>Último Acesso:</b> ${u.ultimoAcesso}\n\n` +
                    `Selecione uma ação para este usuário:`;

          const buttons = [
            [
              { text: "👔 Mudar para GERENTE", callback_data: `user_role_${u.id}_GERENTE` },
              { text: "💼 Mudar para VENDEDOR", callback_data: `user_role_${u.id}_VENDEDOR` }
            ],
            [
              { text: "👑 Mudar para DONO", callback_data: `user_role_${u.id}_DONO` }
            ]
          ];

          if (u.ativo) {
            buttons.push([
              { text: "🔴 Bloquear Acesso", callback_data: `blk_${u.id}` },
              { text: "🔑 Alterar Senha", callback_data: `user_chg_pass_${u.id}` }
            ]);
          } else {
            buttons.push([
              { text: "🟢 Desbloquear / Ativar", callback_data: `unblk_${u.id}` },
              { text: "🔑 Alterar Senha", callback_data: `user_chg_pass_${u.id}` }
            ]);
          }

          buttons.push([
            { text: "📜 Ver Interações deste Usuário", callback_data: `user_logs_${u.id}` }
          ]);
          buttons.push([
            { text: "◀️ Voltar à Lista", callback_data: "users_list_all" }
          ]);

          editarMensagemTelegram(messageId, msg, { inline_keyboard: buttons }, chatId);
        } catch(err) {
          enviarMensagemTelegram("❌ Erro ao carregar detalhes: " + err.message, null, chatId);
        }
        responderCallbackQuery(queryId);
      }
      else if (data.startsWith("user_chg_pass_")) {
        const idUser = data.substring(14);
        const cache = CacheService.getScriptCache();
        cache.put('state_' + chatId, 'AWAITING_USER_NEW_PASS:' + idUser, 300);
        const msg = `🔑 <b>Alterar Senha de Usuário</b>\n\n` +
                    `✍️ <b>Digite a nova senha</b> para o usuário <code>${idUser}</code> no chat:\n\n` +
                    `<i>A senha deve ter no mínimo 6 caracteres.</i>`;
        const back = { inline_keyboard: [[{ text: "◀️ Cancelar", callback_data: `user_detail_${idUser}` }]] };
        editarMensagemTelegram(messageId, msg, back, chatId);
        responderCallbackQuery(queryId);
      }
      else if (data.startsWith("user_role_")) {
        // Formato: user_role_[idUser]_[novoCargo]
        const parts = data.split('_');
        const novoCargo = parts.pop();
        const idUser = parts.slice(2).join('_');

        try {
          const ss = SpreadsheetApp.getActive();
          const sh = ss.getSheetByName('USUARIOS');
          const dados = sh.getDataRange().getValues();
          for (let i = 1; i < dados.length; i++) {
            if (String(dados[i][0]).toUpperCase().trim() === idUser.toUpperCase().trim()) {
              sh.getRange(i + 1, 5).setValue(novoCargo);
              sh.getRange(i + 1, 6).setValue('SIM'); // Ativa automaticamente ao definir cargo
              responderCallbackQuery(queryId, `✅ Perfil alterado para ${novoCargo}!`);
              const evt = { callback_query: { id: queryId, data: `user_detail_${idUser}`, message: { chat: chat, message_id: messageId } } };
              doPost({ postData: { contents: JSON.stringify(evt) } });
              return HtmlService.createHtmlOutput("OK");
            }
          }
        } catch(err) {
          responderCallbackQuery(queryId, "Erro: " + err.message);
        }
      }
      else if (data.startsWith("unblk_")) {
        const targetId = data.substring(6);
        try {
          const ss = SpreadsheetApp.getActive();
          const sh = ss.getSheetByName('USUARIOS');
          const dados = sh.getDataRange().getValues();
          for (let i = 1; i < dados.length; i++) {
            if (String(dados[i][0]).toUpperCase().trim() === targetId.toUpperCase().trim()) {
              sh.getRange(i + 1, 6).setValue('SIM');
              responderCallbackQuery(queryId, "🟢 Usuário desbloqueado com sucesso!");
              const evt = { callback_query: { id: queryId, data: `user_detail_${targetId}`, message: { chat: chat, message_id: messageId } } };
              doPost({ postData: { contents: JSON.stringify(evt) } });
              return HtmlService.createHtmlOutput("OK");
            }
          }
        } catch(err) {
          responderCallbackQuery(queryId, "Erro: " + err.message);
        }
      }
      else if (data.startsWith("blk_")) {
        const targetId = data.substring(4);
        try {
          const ss = SpreadsheetApp.getActive();
          const sh = ss.getSheetByName('USUARIOS');
          const dados = sh.getDataRange().getValues();
          for (let i = 1; i < dados.length; i++) {
            if (String(dados[i][0]).toUpperCase().trim() === targetId.toUpperCase().trim()) {
              sh.getRange(i + 1, 6).setValue('NAO');
              responderCallbackQuery(queryId, "🔴 Usuário bloqueado!");
              const evt = { callback_query: { id: queryId, data: `user_detail_${targetId}`, message: { chat: chat, message_id: messageId } } };
              doPost({ postData: { contents: JSON.stringify(evt) } });
              return HtmlService.createHtmlOutput("OK");
            }
          }
        } catch(err) {
          responderCallbackQuery(queryId, "Erro: " + err.message);
        }
      }
      else if (data === "list_pending_users" || data === "users_pending") {
        if (perfil !== 'DONO' && perfil !== 'GERENCIAL' && perfil !== 'GERENTE') {
          responderCallbackQuery(queryId, "Acesso restrito ao Dono.");
          return HtmlService.createHtmlOutput("OK");
        }
        try {
          const ss = SpreadsheetApp.getActive();
          const sh = ss.getSheetByName('USUARIOS');
          const dados = sh ? sh.getDataRange().getValues() : [];
          let pendentesEncontrados = [];

          for (let i = 1; i < dados.length; i++) {
            const idUser = dados[i][0];
            const nome = dados[i][1];
            const cargo = String(dados[i][4] || '').toUpperCase();
            const ativo = String(dados[i][5] || '').toUpperCase();

            if (ativo === 'NAO' || cargo === 'PENDENTE' || ativo === 'PENDENTE') {
              pendentesEncontrados.push({
                id: idUser,
                nome: nome,
                cargo: cargo,
                ativo: ativo
              });
            }
          }

          if (pendentesEncontrados.length === 0) {
            const noPendMsg = `✅ <b>Nenhuma Solicitação Pendente!</b>\n\nTodos os usuários cadastrados já estão com acesso definido e aprovado.`;
            const backMarkup = {
              inline_keyboard: [[{ text: "◀️ Voltar ao Painel", callback_data: "manage_users" }]]
            };
            editarMensagemTelegram(messageId, noPendMsg, backMarkup, chatId);
          } else {
            let msg = `⏳ <b>Solicitações de Acesso Pendentes (${pendentesEncontrados.length}):</b>\n\n`;
            const buttons = [];
            pendentesEncontrados.forEach(p => {
              msg += `• <b>${p.nome}</b> (ID: <code>${p.id}</code>)\n` +
                     `  └ Perfil solicitado: <i>${p.cargo}</i>\n\n`;

              buttons.push([
                { text: `✅ Aprovar ${p.nome} (Vendedor)`, callback_data: `user_role_${p.id}_VENDEDOR` }
              ]);
              buttons.push([
                { text: `✅ Aprovar ${p.nome} (Gerente)`, callback_data: `user_role_${p.id}_GERENTE` },
                { text: `❌ Bloquear`, callback_data: `blk_${p.id}` }
              ]);
            });

            buttons.push([{ text: "◀️ Voltar ao Painel", callback_data: "manage_users" }]);
            editarMensagemTelegram(messageId, msg, { inline_keyboard: buttons }, chatId);
          }
        } catch(err) {
          responderCallbackQuery(queryId, "Erro: " + err.message);
        }
        responderCallbackQuery(queryId);
      }
      else if (data === "users_logs_recent") {
        if (perfil !== 'DONO' && perfil !== 'GERENCIAL' && perfil !== 'GERENTE') {
          responderCallbackQuery(queryId, "Acesso restrito.");
          return HtmlService.createHtmlOutput("OK");
        }
        try {
          const ss = SpreadsheetApp.getActive();
          const shLogs = ss.getSheetByName('LOGS');
          const shAudit = ss.getSheetByName('AUDITORIA_USUARIOS');

          const logsData = shLogs ? shLogs.getDataRange().getValues() : [];
          const auditData = shAudit ? shAudit.getDataRange().getValues() : [];

          const interacoes = [];

          // Coleta logs gerais
          for (let i = 1; i < logsData.length; i++) {
            const dataHora = `${logsData[i][0]} ${logsData[i][1]}`;
            const user = logsData[i][2] || 'Sistema';
            const acao = logsData[i][3] || 'Ação';
            const det = logsData[i][4] || '';
            interacoes.push({
              dataHora: dataHora,
              user: user,
              acao: acao,
              detalhe: det
            });
          }

          // Coleta auditoria de usuários
          for (let i = 1; i < auditData.length; i++) {
            const dataHora = auditData[i][0] ? new Date(auditData[i][0]).toLocaleString() : '';
            const user = auditData[i][1] || 'Usuário';
            const acao = auditData[i][2] || 'Acesso';
            const det = auditData[i][3] || '';
            interacoes.push({
              dataHora: dataHora,
              user: user,
              acao: acao,
              detalhe: det
            });
          }

          let msg = `📜 <b>Histórico Recente de Interações & Ações:</b>\n\n`;
          if (interacoes.length === 0) {
            msg += `<i>Nenhum registro de interação recente encontrado.</i>`;
          } else {
            // Pega os últimos 20 registros
            const recentes = interacoes.slice(-20).reverse();
            recentes.forEach(item => {
              msg += `• 🕒 <b>${item.dataHora}</b> | 👤 <b>${item.user}</b>\n` +
                     `  └ <b>${item.acao}:</b> <i>${String(item.detalhe).substring(0, 45)}</i>\n\n`;
            });
          }

          const buttons = [
            [{ text: "🔄 Atualizar Logs", callback_data: "users_logs_recent" }],
            [{ text: "◀️ Voltar ao Painel", callback_data: "manage_users" }]
          ];

          editarMensagemTelegram(messageId, msg, { inline_keyboard: buttons }, chatId);
        } catch(err) {
          enviarMensagemTelegram("❌ Erro ao consultar logs: " + err.message, null, chatId);
        }
        responderCallbackQuery(queryId);
      }
      else if (data.startsWith("user_logs_")) {
        const idUser = data.substring(10);
        try {
          const ss = SpreadsheetApp.getActive();
          const shLogs = ss.getSheetByName('LOGS');
          const shAudit = ss.getSheetByName('AUDITORIA_USUARIOS');

          const logsData = shLogs ? shLogs.getDataRange().getValues() : [];
          const auditData = shAudit ? shAudit.getDataRange().getValues() : [];

          const userInteracoes = [];
          const idUpper = idUser.toUpperCase();

          for (let i = 1; i < auditData.length; i++) {
            if (String(auditData[i][1]).toUpperCase().includes(idUpper)) {
              userInteracoes.push({
                dataHora: auditData[i][0] ? new Date(auditData[i][0]).toLocaleString() : '',
                acao: auditData[i][2] || 'Acesso',
                detalhe: auditData[i][3] || ''
              });
            }
          }

          for (let i = 1; i < logsData.length; i++) {
            if (String(logsData[i][2]).toUpperCase().includes(idUpper) || String(logsData[i][4]).toUpperCase().includes(idUpper)) {
              userInteracoes.push({
                dataHora: `${logsData[i][0]} ${logsData[i][1]}`,
                acao: logsData[i][3] || 'Ação',
                detalhe: logsData[i][4] || ''
              });
            }
          }

          let msg = `📜 <b>Interações do Usuário (${idUser}):</b>\n\n`;
          if (userInteracoes.length === 0) {
            msg += `<i>Nenhuma atividade recente registrada para este usuário.</i>`;
          } else {
            userInteracoes.slice(-15).reverse().forEach(item => {
              msg += `• 🕒 <b>${item.dataHora}</b>\n` +
                     `  └ <b>${item.acao}:</b> <i>${String(item.detalhe).substring(0, 50)}</i>\n\n`;
            });
          }

          const buttons = [
            [{ text: "◀️ Voltar ao Usuário", callback_data: `user_detail_${idUser}` }]
          ];

          editarMensagemTelegram(messageId, msg, { inline_keyboard: buttons }, chatId);
        } catch(err) {
          enviarMensagemTelegram("❌ Erro ao consultar logs do usuário: " + err.message, null, chatId);
        }
        responderCallbackQuery(queryId);
      }
      else if (data === "do_backup") {
        if (perfil !== 'DONO' && perfil !== 'GERENCIAL') {
          responderCallbackQuery(queryId, "Acesso restrito ao Dono.");
          return HtmlService.createHtmlOutput("OK");
        }
        try {
          if (typeof fazerBackupSistema === 'function') {
            fazerBackupSistema();
            responderCallbackQuery(queryId, "💾 Backup realizado com sucesso no Drive!");
          }
        } catch(err) {
          responderCallbackQuery(queryId, "Erro: " + err.message);
        }
      }
      else if (data === "update_reports") {
        try {
          if (typeof atualizarTodosOsRelatoriosSilencioso === 'function') {
            atualizarTodosOsRelatoriosSilencioso();
            responderCallbackQuery(queryId, "✅ Relatórios atualizados com sucesso!");
          }
        } catch(err) {
          responderCallbackQuery(queryId, "Erro: " + err.message);
        }
      }

      return HtmlService.createHtmlOutput("OK");
    }

    // =============================================
    // 💬 TRATAMENTO DE TEXTOS E COMANDOS
    // =============================================
    if (!update.message) return HtmlService.createHtmlOutput("OK");

    const message = update.message;
    const chatId = String(message.chat.id);
    const text = String(message.text || '').trim();
    const senderName = message.from.first_name || 'Usuário';

    const usuario = typeof obterUsuarioPorTelegramChatId === 'function' ? obterUsuarioPorTelegramChatId(chatId) : null;

    // Se o usuário está em estado conversacional (ex: criando comanda e digitou o nome do cliente)
    const cache = CacheService.getScriptCache();
    const userState = cache.get('state_' + chatId);

    // =============================================
    // 📸 TRATAMENTO DE ANEXOS / FOTOS DE NOTA FISCAL
    // =============================================
    if (message.photo || message.document) {
      let fileId = '';
      let fileName = '';

      if (message.photo && Array.isArray(message.photo) && message.photo.length > 0) {
        // Pega a foto na maior resolução (último item do array)
        const fotoMaior = message.photo[message.photo.length - 1];
        fileId = fotoMaior.file_id;
        fileName = 'foto_nf.jpg';
      } else if (message.document) {
        fileId = message.document.file_id;
        fileName = message.document.file_name || 'documento_nf.pdf';
      }

      // 📱 Se for envio de comprovante PIX de Delivery pelo cliente
      if (userState && userState.startsWith('AWAITING_DELIVERY_PIX_RECEIPT:')) {
        const pedido = userState.substring('AWAITING_DELIVERY_PIX_RECEIPT:'.length).trim();
        cache.remove('state_' + chatId);

        if (fileId) {
          try {
            enviarMensagemTelegram("⏳ <i>Recebendo comprovante PIX e registrando no sistema...</i>", null, chatId);
            const blob = baixarArquivoTelegram(fileId);

            let fileUrl = '';
            if (blob) {
              const pastaComp = obterOuCriarPastaComprovantesDelivery();
              const timestamp = Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyyMMdd_HHmmss");
              const ext = fileName.includes('.') ? fileName.split('.').pop() : 'jpg';
              const nomeFinal = `PIX_DEL_${pedido}_${timestamp}.${ext}`;
              blob.setName(nomeFinal);
              const fileDrive = pastaComp.createFile(blob);
              fileUrl = fileDrive.getUrl();
            }

            // Atualiza status do Delivery para 'COMPROVANTE ENVIADO'
            const ss = SpreadsheetApp.getActive();
            const shDel = ss.getSheetByName('DELIVERY');
            let clienteNome = '';
            let totalPedido = 0;
            if (shDel) {
              const dados = shDel.getDataRange().getValues();
              for (let i = 1; i < dados.length; i++) {
                if (pedidosCorrespondem(dados[i][0], pedido) || String(dados[i][0]) === String(pedido) || Number(dados[i][0]) == Number(pedido)) {
                  shDel.getRange(i + 1, 8).setValue('COMPROVANTE ENVIADO');
                  clienteNome = dados[i][2] || 'Cliente';
                  totalPedido = Number(dados[i][5]) || 0;
                  break;
                }
              }
            }

            // Confirmação para o Cliente
            const msgRespCliente = `✅ <b>Comprovante do Pedido #DEL-${pedido} recebido com sucesso!</b>\n\n` +
                                   `🔍 Nossa equipe já foi notificada para validar o pagamento.\n` +
                                   `Assim que aprovado, seu pedido será preparado e despachado imediatamente! 🛵💨`;
            enviarMensagemTelegram(msgRespCliente, {
              inline_keyboard: [[{ text: "📦 Acompanhar Meus Pedidos", callback_data: "client_my_orders" }]]
            }, chatId);

            // Notificação com botões de aprovação para os Gestores / Dono
            const gestores = obterChatIdsGerentesEDono();
            const msgAprovacao = `🚨 <b>NOVO COMPROVANTE PIX RECEBIDO!</b>\n\n` +
                                 `🛵 <b>Pedido:</b> <code>#DEL-${pedido}</code>\n` +
                                 `👤 <b>Cliente:</b> ${clienteNome}\n` +
                                 `💰 <b>Valor:</b> R$ ${totalPedido.toFixed(2).replace('.', ',')}\n` +
                                 (fileUrl ? `🔗 <a href="${fileUrl}">Ver Comprovante no Drive</a>\n\n` : '\n') +
                                 `<i>Confira se o valor caiu na conta bancária e selecione uma ação:</i>`;

            const markupGestores = {
              inline_keyboard: [
                [
                  { text: "✅ Aprovar Pagamento & Despachar", callback_data: `deliv_approve_pix_${pedido}` }
                ],
                [
                  { text: "❌ Recusar Comprovante", callback_data: `deliv_reject_pix_${pedido}` }
                ],
                [
                  { text: `🔍 Ver Detalhes do Pedido`, callback_data: `deliv_info_${pedido}` }
                ]
              ]
            };

            gestores.forEach(gId => {
              try {
                enviarFotoTelegram(fileId, msgAprovacao, markupGestores, gId);
              } catch(eNotif) {
                enviarMensagemTelegram(msgAprovacao, markupGestores, gId);
              }
            });

            return HtmlService.createHtmlOutput("OK");
          } catch(errCompr) {
            console.error("Erro ao processar comprovante PIX de delivery:", errCompr);
            enviarMensagemTelegram("❌ Ocorreu um erro ao processar o comprovante. Por favor, tente novamente.", null, chatId);
            return HtmlService.createHtmlOutput("OK");
          }
        }
      }

      let idCompraAlvo = '';
      if (userState && userState.startsWith('AWAITING_NF_PHOTO:')) {
        idCompraAlvo = userState.substring(18).trim();
        cache.remove('state_' + chatId);
      } else if (message.caption) {
        const cap = message.caption.trim();
        const matchCpr = cap.match(/CPR\d+/i);
        if (matchCpr) idCompraAlvo = matchCpr[0].toUpperCase();
      }

      if (fileId) {
        try {
          enviarMensagemTelegram("⏳ <i>Recebendo comprovante e salvando na pasta do Drive...</i>", null, chatId);
          const blob = baixarArquivoTelegram(fileId);

          if (blob) {
            const pastaMes = obterOuCriarPastaNotasMesVigente();
            if (!pastaMes) {
              enviarMensagemTelegram("❌ Erro: Não foi possível acessar a pasta de Compras / Notas no Drive.", null, chatId);
              return HtmlService.createHtmlOutput("OK");
            }

            const timestamp = Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyyMMdd_HHmmss");
            const ext = fileName.includes('.') ? fileName.split('.').pop() : 'jpg';
            const nomeFinal = idCompraAlvo ? `NF_${idCompraAlvo}_${timestamp}.${ext}` : `NF_${timestamp}.${ext}`;
            blob.setName(nomeFinal);

            const fileDrive = pastaMes.createFile(blob);
            const fileUrl = fileDrive.getUrl();

            // 1. Se foi enviado para uma compra já existente
            if (idCompraAlvo) {
              const ss = SpreadsheetApp.getActive();
              const shComp = ss.getSheetByName('COMPRAS');
              let atualizouPlanilha = false;

              if (shComp) {
                const dados = shComp.getDataRange().getValues();
                for (let i = 1; i < dados.length; i++) {
                  const idNaPlanilha = String(dados[i][7] || '').toUpperCase().trim();
                  if (idNaPlanilha === idCompraAlvo.toUpperCase()) {
                    shComp.getRange(i + 1, 9).setValue(`=HYPERLINK("${fileUrl}";"📎 Ver NF (${idCompraAlvo})")`);
                    atualizouPlanilha = true;
                    break;
                  }
                }
              }

              const msgOk = `🎉 <b>NOTA FISCAL ANEXADA COM SUCESSO!</b>\n\n` +
                            `🧾 <b>Compra:</b> <code>#${idCompraAlvo}</code>\n` +
                            `📁 <b>Arquivo:</b> <code>${nomeFinal}</code>\n` +
                            `📂 <b>Pasta no Drive:</b> <i>Compras / Notas / ${pastaMes.getName()}</i>\n` +
                            (atualizouPlanilha ? `✅ <b>Planilha:</b> Link salvo na coluna Comprovante_NF!\n\n` : '\n') +
                            `🔗 <a href="${fileUrl}">Toque aqui para visualizar o arquivo no Drive</a>`;

              const keyboardPos = [
                [{ text: "📂 Ver Pasta do Mês no Drive", url: `https://drive.google.com/drive/folders/${pastaMes.getId()}` }],
                [{ text: "🛒 Voltar ao Menu de Compras", callback_data: "comp_menu" }]
              ];

              enviarMensagemTelegram(msgOk, { inline_keyboard: keyboardPos }, chatId);
              return HtmlService.createHtmlOutput("OK");
            }

            // 2. Se NÃO tinha compra específica vinculada: ANALISAR COM IA!
            enviarMensagemTelegram("🧠 <i>Analisando documento com Inteligência Artificial (extraindo itens, valores e fornecedor)...</i>", null, chatId);
            const aiRes = analisarNotaFiscalComIA(blob);

            if (aiRes && aiRes.sucesso && aiRes.itens && aiRes.itens.length > 0) {
              const aiDraftId = 'AICPR_' + Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyMMddHHmmss");
              let totalCalculado = 0;
              aiRes.itens.forEach(it => {
                totalCalculado += Number(it.total) || ((Number(it.qtd) || 1) * (Number(it.unit) || 0));
              });

              const draftData = {
                id: aiDraftId,
                fornecedor: aiRes.fornecedor || 'Fornecedor',
                numero_nf: aiRes.numero_nf || '',
                data_emissao: aiRes.data_emissao || Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy"),
                forma_pagamento: String(aiRes.forma_pagamento || 'BOLETO').toUpperCase(),
                valor_total: Number(aiRes.valor_total) || totalCalculado,
                itens: aiRes.itens,
                fileUrl: fileUrl,
                fileName: nomeFinal,
                chatId: chatId
              };

              cache.put('ai_draft_' + aiDraftId, JSON.stringify(draftData), 1800);

              let itensTxt = '';
              draftData.itens.forEach((it, idx) => {
                itensTxt += `  ${idx + 1}. <b>${it.produto}</b>\n` +
                            `     └ <b>${it.qtd} un.</b> x R$ ${(Number(it.unit)||0).toFixed(2).replace('.', ',')} = <b>R$ ${(Number(it.total)||0).toFixed(2).replace('.', ',')}</b>\n`;
              });

              const msgPrevia = `🤖 <b>NOTA FISCAL LIDA POR IA COM SUCESSO!</b>\n\n` +
                                `🏢 <b>Fornecedor:</b> <b>${draftData.fornecedor}</b>\n` +
                                (draftData.numero_nf ? `🧾 <b>Nº Documento:</b> <code>${draftData.numero_nf}</code> | ` : '🧾 ') +
                                `<b>Data:</b> ${draftData.data_emissao}\n` +
                                `💳 <b>Forma de Pagamento:</b> <b>${draftData.forma_pagamento}</b>\n` +
                                `📁 <b>Foto salva no Drive:</b> <i>Compras / Notas / ${pastaMes.getName()}</i>\n\n` +
                                `📦 <b>Itens Identificados (${draftData.itens.length}):</b>\n` +
                                itensTxt + `\n` +
                                `💰 <b>TOTAL DA COMPRA: R$ ${draftData.valor_total.toFixed(2).replace('.', ',')}</b>\n\n` +
                                `❓ <b>As informações estão corretas?</b> Escolha uma opção abaixo:`;

              const keyboardPrevia = [
                [
                  { text: "✅ Aprovar e Lançar no Sistema", callback_data: `comp_ai_appr_${aiDraftId}` }
                ],
                [
                  { text: "💳 Alterar Forma de Pgto", callback_data: `comp_ai_payopt_${aiDraftId}` },
                  { text: "❌ Descartar", callback_data: `comp_ai_canc_${aiDraftId}` }
                ]
              ];

              enviarMensagemTelegram(msgPrevia, { inline_keyboard: keyboardPrevia }, chatId);
              return HtmlService.createHtmlOutput("OK");
            } else {
              // Se a IA não conseguiu ler ou faltou a API Key
              let detalheErro = '';
              if (aiRes && aiRes.motivo === 'SEM_API_KEY') {
                detalheErro = `🔑 <b>Chave da IA não encontrada!</b>\n` +
                              `Para ativar a leitura automática de fotos, adicione a chave <code>GEMINI_API_KEY</code> na aba <b>CONFIG</b> da sua planilha.\n\n`;
              } else if (aiRes && aiRes.motivo === 'ERRO_API') {
                detalheErro = `⚠️ <b>Aviso da IA:</b> ${aiRes.msg}\n\n`;
              } else {
                detalheErro = `⚠️ <i>A IA não identificou os itens com clareza nesta foto.</i>\n\n`;
              }

              const msgFallback = `📁 <b>Foto salva com sucesso no Drive!</b>\n\n` +
                                  `📂 <b>Local:</b> <i>Compras / Notas / ${pastaMes.getName()}</i>\n` +
                                  `🔗 <a href="${fileUrl}">Ver Arquivo no Drive</a>\n\n` +
                                  detalheErro +
                                  `Deseja lançar os dados desta compra manualmente agora?`;

              const keyboardFallback = [
                [{ text: "➕ Lançar Compra Manual", callback_data: "comp_new_step1" }],
                [{ text: "🛒 Menu de Compras", callback_data: "comp_menu" }]
              ];

              enviarMensagemTelegram(msgFallback, { inline_keyboard: keyboardFallback }, chatId);
              return HtmlService.createHtmlOutput("OK");
            }
          } else {
            enviarMensagemTelegram("❌ Não foi possível baixar a foto dos servidores do Telegram.", null, chatId);
            return HtmlService.createHtmlOutput("OK");
          }
        } catch(errUpload) {
          enviarMensagemTelegram("❌ Erro no processamento: " + errUpload.message, null, chatId);
          return HtmlService.createHtmlOutput("OK");
        }
      }
    }

    // =============================================
    // 🔐 ESTADOS CONVERSACIONAIS DE LOGIN SEGURO
    // =============================================
    if (userState === 'AWAITING_LOGIN_USER' && !text.startsWith('/')) {
      const usernameInput = text.trim();
      cache.remove('state_' + chatId);

      const ss = SpreadsheetApp.getActive();
      const sh = ss.getSheetByName('USUARIOS');
      const dados = sh ? sh.getDataRange().getValues() : [];
      let achouUser = null;

      for (let i = 1; i < dados.length; i++) {
        const idU = String(dados[i][0] || '').trim();
        const nomeU = String(dados[i][1] || '').trim();
        const emailU = String(dados[i][2] || '').trim();
        const perfilU = String(dados[i][4] || '').toUpperCase().trim();
        const ativoU = String(dados[i][5] || '').toUpperCase().trim();

        if (nomeU.toUpperCase() === usernameInput.toUpperCase() || idU.toUpperCase() === usernameInput.toUpperCase() || emailU.toUpperCase() === usernameInput.toUpperCase()) {
          achouUser = {
            id: idU,
            nome: nomeU,
            perfil: perfilU,
            ativo: ativoU
          };
          break;
        }
      }

      if (!achouUser) {
        const msgNotFound = `❌ <b>Usuário "${usernameInput}" não encontrado no sistema.</b>\n\n` +
                            `Por favor, verifique a grafia do seu login ou solicite o cadastro da sua conta ao administrador.`;
        const retryMarkup = {
          inline_keyboard: [[{ text: "🔄 Tentar Novamente", callback_data: "auth_start_login" }]]
        };
        enviarMensagemTelegram(msgNotFound, retryMarkup, chatId);
        return HtmlService.createHtmlOutput("OK");
      }

      if (achouUser.ativo === 'NAO') {
        const msgBlocked = `🚫 <b>Acesso Bloqueado:</b>\n\n` +
                           `A conta de <b>${achouUser.nome}</b> está bloqueada. Entre em contato com a gerência para liberar seu acesso.`;
        enviarMensagemTelegram(msgBlocked, null, chatId);
        return HtmlService.createHtmlOutput("OK");
      }

      // Usuário localizado e ativo -> Solicita a senha
      cache.put('state_' + chatId, 'AWAITING_LOGIN_PASS:' + achouUser.nome, 300);
      const msgPass = `👤 <b>Usuário:</b> <b>${achouUser.nome}</b> (${achouUser.perfil})\n\n` +
                      `🔑 <b>Digite a sua senha de acesso</b> no chat:`;
      const cancelMarkup = {
        inline_keyboard: [[{ text: "❌ Cancelar", callback_data: "menu" }]]
      };
      enviarMensagemTelegram(msgPass, cancelMarkup, chatId);
      return HtmlService.createHtmlOutput("OK");
    }

    if (userState && userState.startsWith('AWAITING_LOGIN_PASS:') && !text.startsWith('/')) {
      const userLogin = userState.substring(20);
      cache.remove('state_' + chatId);
      const senhaInput = text.trim();

      try {
        if (typeof vincularUsuarioTelegram === 'function') {
          const res = vincularUsuarioTelegram(userLogin, senhaInput, chatId);
          if (res && res.ok) {
            const userObj = res.usuario;
            const menuObj = montarMenuPrincipal(userObj);
            const msgSucesso = `🎉 <b>Login Efetuado com Sucesso!</b>\n\n` +
                               `👤 <b>Bem-vindo(a), ${userObj.nome}!</b>\n` +
                               `💼 <b>Perfil:</b> ${userObj.perfil}\n\n` +
                               `Seu Telegram está vinculado. Você já pode utilizar todas as ferramentas do seu perfil.`;
            enviarMensagemTelegram(msgSucesso, menuObj.markup, chatId);
            return HtmlService.createHtmlOutput("OK");
          } else {
            const msgErro = `❌ <b>Senha incorreta para o usuário ${userLogin}!</b>\n\n` +
                            `Verifique sua senha e tente novamente.`;
            const retryMarkup = {
              inline_keyboard: [
                [{ text: "🔄 Tentar Novamente", callback_data: "auth_start_login" }]
              ]
            };
            enviarMensagemTelegram(msgErro, retryMarkup, chatId);
            return HtmlService.createHtmlOutput("OK");
          }
        }
      } catch(eAuth) {
        enviarMensagemTelegram("❌ Erro ao validar acesso: " + eAuth.message, null, chatId);
        return HtmlService.createHtmlOutput("OK");
      }
    }

    // =============================================
    // 📦 ESTADOS DE GESTÃO DE PRODUTOS (Cadastrar / Editar / Analisar)
    // =============================================
    if (userState === 'AWAITING_NEW_PROD_NOME' && !text.startsWith('/')) {
      const nomeProd = text.trim();
      cache.remove('state_' + chatId);

      // Verificação de produto duplicado na aba PRODUTOS
      const ss = SpreadsheetApp.getActive();
      const shProd = ss.getSheetByName('PRODUTOS');
      const dados = shProd ? shProd.getDataRange().getValues() : [];
      let rowExistente = -1;

      const safeNorm = str => String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toUpperCase().trim();
      const nomeNorm = safeNorm(nomeProd);

      for (let i = 1; i < dados.length; i++) {
        if (safeNorm(dados[i][0]) === nomeNorm) {
          rowExistente = i + 1;
          break;
        }
      }

      if (rowExistente > 0) {
        const msgDuplicado = `⚠️ <b>Produto Já Cadastrado!</b>\n\n` +
                             `O produto "<b>${nomeProd}</b>" já existe no sistema.\n` +
                             `Para manter o estoque consistente, o sistema <b>não permite cadastrar produtos duplicados</b>.\n\n` +
                             `Você pode editar o produto já existente ou cadastrar outro com nome diferente:`;
        const dupMarkup = {
          inline_keyboard: [
            [{ text: `⚙️ Editar ${nomeProd.substring(0, 24)}`, callback_data: `prod_edit_${rowExistente}` }],
            [{ text: "🔄 Digitar Outro Nome", callback_data: "prod_new_step1" }],
            [{ text: "◀️ Voltar aos Produtos", callback_data: "prod_menu" }]
          ]
        };
        enviarMensagemTelegram(msgDuplicado, dupMarkup, chatId);
        return HtmlService.createHtmlOutput("OK");
      }

      cache.put('temp_newprod_nome_' + chatId, nomeProd, 300);
      cache.put('state_' + chatId, 'AWAITING_NEW_PROD_CAT', 300);

      const msgCat = `➕ <b>Cadastro de Produto</b> (Passo 2/5)\n\n` +
                     `📦 <b>Produto:</b> <b>${nomeProd}</b>\n\n` +
                     `📂 <b>Selecione ou digite a Categoria:</b>`;
      const catButtons = {
        inline_keyboard: [
          [
            { text: "🍺 Cervejas", callback_data: "prod_cat_Cervejas" },
            { text: "🥤 Refrigerantes", callback_data: "prod_cat_Refrigerantes" }
          ],
          [
            { text: "🍸 Destilados", callback_data: "prod_cat_Destilados" },
            { text: "🧊 Gelo & Carvão", callback_data: "prod_cat_Gelo" }
          ],
          [
            { text: "🧃 Sucos & Águas", callback_data: "prod_cat_Sucos e Aguas" },
            { text: "📦 Outros", callback_data: "prod_cat_Outros" }
          ],
          [{ text: "❌ Cancelar", callback_data: "prod_menu" }]
        ]
      };
      enviarMensagemTelegram(msgCat, catButtons, chatId);
      return HtmlService.createHtmlOutput("OK");
    }

    if (userState === 'AWAITING_NEW_PROD_CAT' && !text.startsWith('/')) {
      const catEscolhida = text.trim();
      cache.remove('state_' + chatId);
      const nomeProd = cache.get('temp_newprod_nome_' + chatId) || 'Produto';
      cache.put('temp_newprod_cat_' + chatId, catEscolhida, 300);
      cache.put('state_' + chatId, 'AWAITING_NEW_PROD_CUSTO', 300);

      const msg = `➕ <b>Cadastro de Produto</b> (Passo 3/5)\n\n` +
                  `📦 <b>Produto:</b> <b>${nomeProd}</b>\n` +
                  `📂 <b>Categoria:</b> <b>${catEscolhida}</b>\n\n` +
                  `💵 <b>Digite o Preço de Custo / Compra (R$)</b> no chat:\n` +
                  `<i>Exemplo: 5.50 (ou 0 se não souber)</i>`;
      const back = { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: "prod_menu" }]] };
      enviarMensagemTelegram(msg, back, chatId);
      return HtmlService.createHtmlOutput("OK");
    }

    if (userState === 'AWAITING_NEW_PROD_CUSTO' && !text.startsWith('/')) {
      const custo = Number(text.trim().replace(',', '.'));
      if (isNaN(custo) || custo < 0) {
        enviarMensagemTelegram("⚠️ Custo inválido. Digite um valor numérico positivo ou 0 (Ex: <code>5.50</code>):", null, chatId);
        return HtmlService.createHtmlOutput("OK");
      }

      cache.remove('state_' + chatId);
      cache.put('temp_newprod_custo_' + chatId, String(custo), 300);
      cache.put('state_' + chatId, 'AWAITING_NEW_PROD_MARGEM', 300);

      const nomeProd = cache.get('temp_newprod_nome_' + chatId) || 'Produto';
      const msg = `➕ <b>Cadastro de Produto</b> (Passo 4/5)\n\n` +
                  `📦 <b>Produto:</b> <b>${nomeProd}</b>\n` +
                  `💰 <b>Custo Unitário:</b> R$ ${custo.toFixed(2)}\n\n` +
                  `📈 <b>Selecione ou digite a Margem de Lucro Desejada (%):</b>`;

      const margemButtons = {
        inline_keyboard: [
          [
            { text: `30% (Venda: R$ ${(custo * 1.30).toFixed(2)})`, callback_data: "prod_setmargem_30" },
            { text: `40% (Venda: R$ ${(custo * 1.40).toFixed(2)})`, callback_data: "prod_setmargem_40" }
          ],
          [
            { text: `50% (Venda: R$ ${(custo * 1.50).toFixed(2)})`, callback_data: "prod_setmargem_50" },
            { text: `60% (Venda: R$ ${(custo * 1.60).toFixed(2)})`, callback_data: "prod_setmargem_60" }
          ],
          [
            { text: `80% (Venda: R$ ${(custo * 1.80).toFixed(2)})`, callback_data: "prod_setmargem_80" },
            { text: `100% (Venda: R$ ${(custo * 2.00).toFixed(2)})`, callback_data: "prod_setmargem_100" }
          ],
          [{ text: "❌ Cancelar", callback_data: "prod_menu" }]
        ]
      };
      enviarMensagemTelegram(msg, margemButtons, chatId);
      return HtmlService.createHtmlOutput("OK");
    }

    if (userState === 'AWAITING_NEW_PROD_MARGEM' && !text.startsWith('/')) {
      const margemInput = Number(text.trim().replace('%', '').replace(',', '.'));
      if (isNaN(margemInput) || margemInput < 0) {
        enviarMensagemTelegram("⚠️ Margem inválida. Digite a porcentagem desejada (Ex: <code>45</code> para 45%):", null, chatId);
        return HtmlService.createHtmlOutput("OK");
      }

      const custo = Number(cache.get('temp_newprod_custo_' + chatId)) || 0;
      const precoVenda = custo > 0 ? (custo * (1 + margemInput / 100)) : (margemInput > 0 ? margemInput : 0);

      cache.remove('state_' + chatId);
      cache.put('temp_newprod_margem_' + chatId, String(margemInput), 300);
      cache.put('temp_newprod_preco_' + chatId, String(precoVenda), 300);
      cache.put('state_' + chatId, 'AWAITING_NEW_PROD_MIN', 300);

      const nomeProd = cache.get('temp_newprod_nome_' + chatId) || 'Produto';
      const msg = `➕ <b>Cadastro de Produto</b> (Passo 5/5)\n\n` +
                  `📦 <b>Produto:</b> <b>${nomeProd}</b>\n` +
                  `💰 <b>Custo:</b> R$ ${custo.toFixed(2)} | 📈 <b>Margem:</b> ${margemInput}%\n` +
                  `💵 <b>Preço de Venda Calculado:</b> <b>R$ ${precoVenda.toFixed(2)}</b>\n\n` +
                  `🚨 <b>Digite o Estoque Mínimo para Alerta Crítico:</b>\n` +
                  `<i>Exemplo: 12</i>`;
      const back = { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: "prod_menu" }]] };
      enviarMensagemTelegram(msg, back, chatId);
      return HtmlService.createHtmlOutput("OK");
    }

    if (userState === 'AWAITING_NEW_PROD_MIN' && !text.startsWith('/')) {
      const min = parseInt(text.trim(), 10);
      if (isNaN(min) || min < 0) {
        enviarMensagemTelegram("⚠️ Mínimo inválido. Digite um número inteiro (Ex: <code>12</code>):", null, chatId);
        return HtmlService.createHtmlOutput("OK");
      }

      const nome = cache.get('temp_newprod_nome_' + chatId) || 'Produto';
      const cat = cache.get('temp_newprod_cat_' + chatId) || 'Geral';
      const custo = Number(cache.get('temp_newprod_custo_' + chatId)) || 0;
      const margem = Number(cache.get('temp_newprod_margem_' + chatId)) || 0;
      const preco = Number(cache.get('temp_newprod_preco_' + chatId)) || (custo * 1.5);

      cache.remove('state_' + chatId);
      cache.remove('temp_newprod_nome_' + chatId);
      cache.remove('temp_newprod_cat_' + chatId);
      cache.remove('temp_newprod_custo_' + chatId);
      cache.remove('temp_newprod_margem_' + chatId);
      cache.remove('temp_newprod_preco_' + chatId);

      try {
        const res = typeof salvarProdutoNovoSistema === 'function' ? salvarProdutoNovoSistema({
          produto: nome,
          categoria: cat,
          marca: '',
          volume: '',
          preco: preco,
          custo: custo,
          minimo: min
        }) : { id: 'P-NOVO' };

        const msgSucesso = `🎉 <b>Produto Cadastrado com Sucesso!</b>\n\n` +
                           `📦 <b>Nome:</b> <b>${nome}</b>\n` +
                           `📂 <b>Categoria:</b> ${cat}\n` +
                           `💰 <b>Custo Unitário:</b> R$ ${custo.toFixed(2)}\n` +
                           `📈 <b>Margem de Lucro:</b> <b>${margem}%</b>\n` +
                           `💵 <b>Preço de Venda:</b> <b>R$ ${preco.toFixed(2)}</b>\n` +
                           `🚨 <b>Estoque Mínimo:</b> ${min} unidade(s)\n` +
                           `🆔 <b>ID:</b> <code>${res.id}</code>`;

        const finalMarkup = {
          inline_keyboard: [
            [{ text: "➕ Cadastrar Outro Produto", callback_data: "prod_new_step1" }],
            [{ text: "📋 Listar Produtos", callback_data: "prod_list_all_edit" }],
            [{ text: "◀️ Menu Principal", callback_data: "menu" }]
          ]
        };

        enviarMensagemTelegram(msgSucesso, finalMarkup, chatId);
      } catch(err) {
        enviarMensagemTelegram("❌ Erro ao cadastrar produto: " + err.message, null, chatId);
      }
      return HtmlService.createHtmlOutput("OK");
    }

    if (userState === 'AWAITING_ANALISE_PROD_INPUT' && !text.startsWith('/')) {
      cache.remove('state_' + chatId);
      const termo = text.trim();

      try {
        const ss = SpreadsheetApp.getActive();
        const shProd = ss.getSheetByName('PRODUTOS');
        const dadosProd = shProd ? shProd.getDataRange().getValues() : [];
        const encontrados = [];

        const safeNorm = str => String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toUpperCase().trim();
        const termoNorm = safeNorm(termo);

        for (let i = 1; i < dadosProd.length; i++) {
          const nomeP = String(dadosProd[i][0] || '').trim();
          if (nomeP && safeNorm(nomeP).includes(termoNorm)) {
            encontrados.push({ rowIdx: i + 1, nome: nomeP });
          }
        }

        if (encontrados.length === 0) {
          const msgNone = `🔍 Nenhum produto encontrado para "<b>${text}</b>".\n\nVerifique a grafia ou selecione da lista:`;
          const back = {
            inline_keyboard: [
              [{ text: "🔄 Tentar Outra Busca", callback_data: "prod_analise_search" }],
              [{ text: "📋 Ver Lista Completa", callback_data: "prod_analise_menu" }],
              [{ text: "◀️ Menu Principal", callback_data: "menu" }]
            ]
          };
          enviarMensagemTelegram(msgNone, back, chatId);
          return HtmlService.createHtmlOutput("OK");
        }

        if (encontrados.length === 1) {
          // Exibe direto o diagnóstico do produto encontrado
          exibirAnaliseProdutoTelegram(encontrados[0].rowIdx, chatId, null);
          return HtmlService.createHtmlOutput("OK");
        }

        // Múltiplos produtos encontrados -> Apresenta botões para o usuário escolher
        let msg = `🔍 <b>Produtos encontrados para "${text}" (${encontrados.length}):</b>\n\n` +
                  `Toque no produto que deseja analisar:`;
        const buttons = [];
        encontrados.slice(0, 10).forEach(p => {
          buttons.push([{ text: `📊 ${p.nome.substring(0, 28)}`, callback_data: `prod_analise_view_${p.rowIdx}` }]);
        });
        buttons.push([{ text: "◀️ Voltar", callback_data: "prod_analise_menu" }]);

        enviarMensagemTelegram(msg, { inline_keyboard: buttons }, chatId);
      } catch(err) {
        enviarMensagemTelegram("❌ Erro ao buscar produto: " + err.message, null, chatId);
      }
      return HtmlService.createHtmlOutput("OK");
    }

    if (userState && userState.startsWith('AWAITING_EDIT_MARGEM:') && !text.startsWith('/')) {
      const rowIdx = Number(userState.substring(21));
      cache.remove('state_' + chatId);
      const novaMargem = Number(text.trim().replace('%', '').replace(',', '.'));

      if (isNaN(novaMargem) || novaMargem < 0) {
        enviarMensagemTelegram("⚠️ Margem inválida. Digite uma porcentagem positiva (Ex: <code>45</code>).", null, chatId);
        return HtmlService.createHtmlOutput("OK");
      }

      try {
        const ss = SpreadsheetApp.getActive();
        const shProd = ss.getSheetByName('PRODUTOS');
        const rowData = shProd.getRange(rowIdx, 1, 1, shProd.getLastColumn()).getValues()[0];
        const nome = String(rowData[0] || '').trim();
        const custo = Number(rowData[6]) || 0;
        const novoPreco = custo > 0 ? Number((custo * (1 + novaMargem / 100)).toFixed(2)) : Number(rowData[4]);

        shProd.getRange(rowIdx, 5).setValue(novoPreco);
        if (typeof normalizarFormulasProdutos === 'function') normalizarFormulasProdutos();
        if (typeof atualizarMargemProduto === 'function') atualizarMargemProduto(nome, novaMargem);

        const msgSucesso = `✅ <b>Margem de ${nome} ajustada para ${novaMargem}%!</b>\n\n` +
                           `• 💰 <b>Custo:</b> R$ ${custo.toFixed(2)}\n` +
                           `• 💵 <b>Novo Preço de Venda:</b> <b>R$ ${novoPreco.toFixed(2)}</b>`;
        const back = { inline_keyboard: [[{ text: "◀️ Voltar ao Produto", callback_data: `prod_edit_${rowIdx}` }]] };
        enviarMensagemTelegram(msgSucesso, back, chatId);
      } catch(err) {
        enviarMensagemTelegram("❌ Erro ao ajustar margem: " + err.message, null, chatId);
      }
      return HtmlService.createHtmlOutput("OK");
    }

    if (userState && userState.startsWith('AWAITING_EDIT_PRICE:') && !text.startsWith('/')) {
      const rowIdx = Number(userState.substring(20));
      cache.remove('state_' + chatId);
      const novoPreco = Number(text.trim().replace(',', '.'));

      if (isNaN(novoPreco) || novoPreco <= 0) {
        enviarMensagemTelegram("⚠️ Preço inválido. Digite um valor numérico (Ex: <code>9.50</code>).", null, chatId);
        return HtmlService.createHtmlOutput("OK");
      }

      try {
        const ss = SpreadsheetApp.getActive();
        const shProd = ss.getSheetByName('PRODUTOS');
        const nome = String(shProd.getRange(rowIdx, 1).getValue() || '');
        shProd.getRange(rowIdx, 5).setValue(novoPreco);

        if (typeof normalizarFormulasProdutos === 'function') normalizarFormulasProdutos();
        if (typeof registrarLog === 'function') {
          registrarLog('PRECO_ALTERADO', nome, '', `R$ ${novoPreco.toFixed(2)}`);
        }

        const msgSucesso = `✅ <b>Preço de ${nome} atualizado para R$ ${novoPreco.toFixed(2)}!</b>`;
        const back = { inline_keyboard: [[{ text: "◀️ Voltar ao Produto", callback_data: `prod_edit_${rowIdx}` }]] };
        enviarMensagemTelegram(msgSucesso, back, chatId);
      } catch(err) {
        enviarMensagemTelegram("❌ Erro ao atualizar preço: " + err.message, null, chatId);
      }
      return HtmlService.createHtmlOutput("OK");
    }

    if (userState && userState.startsWith('AWAITING_EDIT_STOCK:') && !text.startsWith('/')) {
      const rowIdx = Number(userState.substring(20));
      cache.remove('state_' + chatId);
      const novaQtd = parseInt(text.trim(), 10);

      if (isNaN(novaQtd) || novaQtd < 0) {
        enviarMensagemTelegram("⚠️ Quantidade inválida. Digite um número inteiro (Ex: <code>48</code>).", null, chatId);
        return HtmlService.createHtmlOutput("OK");
      }

      try {
        const ss = SpreadsheetApp.getActive();
        const shProd = ss.getSheetByName('PRODUTOS');
        const shEst = ss.getSheetByName('ESTOQUE');
        const nome = String(shProd.getRange(rowIdx, 1).getValue() || '').trim();

        if (shEst) {
          const estData = shEst.getDataRange().getValues();
          for (let i = 1; i < estData.length; i++) {
            if (String(estData[i][0]).toUpperCase().trim() === nome.toUpperCase().trim()) {
              shEst.getRange(i + 1, 2).setValue(novaQtd);
              break;
            }
          }
          if (typeof atualizarEstoque === 'function') atualizarEstoque();
        }

        if (typeof registrarLog === 'function') {
          registrarLog('ESTOQUE_AJUSTADO_MANUAL', nome, '', `${novaQtd} un`);
        }

        const msgSucesso = `✅ <b>Estoque de ${nome} atualizado para ${novaQtd} unidade(s)!</b>`;
        const back = { inline_keyboard: [[{ text: "◀️ Voltar ao Produto", callback_data: `prod_edit_${rowIdx}` }]] };
        enviarMensagemTelegram(msgSucesso, back, chatId);
      } catch(err) {
        enviarMensagemTelegram("❌ Erro ao ajustar estoque: " + err.message, null, chatId);
      }
      return HtmlService.createHtmlOutput("OK");
    }

    if (userState && userState.startsWith('AWAITING_EDIT_MIN:') && !text.startsWith('/')) {
      const rowIdx = Number(userState.substring(18));
      cache.remove('state_' + chatId);
      const novoMin = parseInt(text.trim(), 10);

      if (isNaN(novoMin) || novoMin < 0) {
        enviarMensagemTelegram("⚠️ Mínimo inválido. Digite um número inteiro (Ex: <code>15</code>).", null, chatId);
        return HtmlService.createHtmlOutput("OK");
      }

      try {
        const ss = SpreadsheetApp.getActive();
        const shProd = ss.getSheetByName('PRODUTOS');
        const shEst = ss.getSheetByName('ESTOQUE');
        const nome = String(shProd.getRange(rowIdx, 1).getValue() || '').trim();

        shProd.getRange(rowIdx, 6).setValue(novoMin);

        if (shEst) {
          const estData = shEst.getDataRange().getValues();
          for (let i = 1; i < estData.length; i++) {
            if (String(estData[i][0]).toUpperCase().trim() === nome.toUpperCase().trim()) {
              shEst.getRange(i + 1, 3).setValue(novoMin);
              break;
            }
          }
          if (typeof atualizarEstoque === 'function') atualizarEstoque();
        }

        const msgSucesso = `✅ <b>Estoque mínimo de ${nome} atualizado para ${novoMin} unidade(s)!</b>`;
        const back = { inline_keyboard: [[{ text: "◀️ Voltar ao Produto", callback_data: `prod_edit_${rowIdx}` }]] };
        enviarMensagemTelegram(msgSucesso, back, chatId);
      } catch(err) {
        enviarMensagemTelegram("❌ Erro ao atualizar mínimo: " + err.message, null, chatId);
      }
      return HtmlService.createHtmlOutput("OK");
    }

    if (userState === 'AWAITING_SEARCH_PROD' && !text.startsWith('/')) {
      cache.remove('state_' + chatId);
      const termo = text.trim();

      try {
        const ss = SpreadsheetApp.getActive();
        const shProd = ss.getSheetByName('PRODUTOS');
        const dados = shProd ? shProd.getDataRange().getValues() : [];
        const mapaEst = (typeof obterMapaEstoqueReal === 'function') ? obterMapaEstoqueReal() : {};
        const safeNorm = str => String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
        const termoNorm = safeNorm(termo);
        const encontrados = [];

        for (let i = 1; i < dados.length; i++) {
          const nome = String(dados[i][0] || '');
          if (safeNorm(nome).includes(termoNorm)) {
            const nomeNorm = safeNorm(nome);
            const estReal = (mapaEst[nomeNorm] !== undefined) ? mapaEst[nomeNorm] : (mapaEst[nome.toLowerCase()] !== undefined ? mapaEst[nome.toLowerCase()] : (Number(dados[i][11]) || 0));
            encontrados.push({
              rowIdx: i + 1,
              nome: nome,
              cat: dados[i][1],
              preco: Number(dados[i][4]) || 0,
              qtd: estReal
            });
          }
        }

        if (encontrados.length === 0) {
          const msgNone = `🔍 Nenhum produto encontrado para "<b>${text}</b>".`;
          const back = { inline_keyboard: [[{ text: "◀️ Voltar aos Produtos", callback_data: "prod_menu" }]] };
          enviarMensagemTelegram(msgNone, back, chatId);
        } else {
          let msg = `🔍 <b>Produtos Localizados (${encontrados.length}):</b>\n\n`;
          const buttons = [];
          encontrados.slice(0, 10).forEach(p => {
            msg += `• <b>${p.nome}</b>\n  └ 💵 R$ ${p.preco.toFixed(2).replace('.', ',')} | 📦 <b>Estoque: ${p.qtd} un</b>\n\n`;
            buttons.push([
              { text: `⚙️ Editar: ${p.nome.substring(0, 26)}`, callback_data: `prod_edit_${p.rowIdx}` }
            ]);
          });
          buttons.push([{ text: "◀️ Voltar aos Produtos", callback_data: "prod_menu" }]);
          enviarMensagemTelegram(msg, { inline_keyboard: buttons }, chatId);
        }
      } catch(err) {
        enviarMensagemTelegram("❌ Erro na busca: " + err.message, null, chatId);
      }
      return HtmlService.createHtmlOutput("OK");
    }

    if (userState === 'AWAITING_CR_SEARCH_CLIENT' && !text.startsWith('/')) {
      cache.remove('state_' + chatId);
      const termo = text.trim();
      const crData = obterContasReceberTelegram();
      const safeNorm = str => String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
      const termoNorm = safeNorm(termo);

      const encontrados = crData.clientes.filter(c => safeNorm(c.nome).includes(termoNorm));

      if (encontrados.length === 0) {
        const msgNone = `🔍 Nenhum fiado em aberto encontrado para "<b>${text}</b>".\n\n` +
                        `O cliente não possui débitos pendentes ou o nome foi digitado incorretamente.`;
        const back = {
          inline_keyboard: [
            [{ text: "🔄 Tentar Outra Busca", callback_data: "cr_search_prompt" }],
            [{ text: "🧾 Ver Todos os Fiados", callback_data: "cr_menu" }],
            [{ text: "◀️ Menu Principal", callback_data: "menu" }]
          ]
        };
        enviarMensagemTelegram(msgNone, back, chatId);
        return HtmlService.createHtmlOutput("OK");
      }

      if (encontrados.length === 1) {
        const c = encontrados[0];
        let msg = `👤 <b>Cliente:</b> <b>${c.nome}</b>\n\n` +
                  `💰 <b>Saldo Devedor Total:</b> <b>R$ ${c.saldoTotal.toFixed(2)}</b>\n` +
                  `📋 <b>Quantidade de Fiados:</b> ${c.contas.length}\n\n` +
                  `<i>Selecione a ação desejada:</i>`;
        const buttons = {
          inline_keyboard: [
            [{ text: `🟢 Quitar Tudo (R$ ${c.saldoTotal.toFixed(2)})`, callback_data: `cr_payall_${encodeURIComponent(c.nome)}` }],
            [{ text: `💸 Receber Valor Parcial`, callback_data: `cr_paypar_${encodeURIComponent(c.nome)}` }],
            [{ text: "◀️ Voltar aos Fiados", callback_data: "cr_menu" }]
          ]
        };
        enviarMensagemTelegram(msg, buttons, chatId);
        return HtmlService.createHtmlOutput("OK");
      }

      let msg = `🔍 <b>Clientes encontrados para "${text}" (${encontrados.length}):</b>\n\n` +
                `Toque no cliente para visualizar ou quitar:`;
      const buttons = [];
      encontrados.forEach(c => {
        buttons.push([
          { text: `💰 ${c.nome} (R$ ${c.saldoTotal.toFixed(2)})`, callback_data: `cr_view_${encodeURIComponent(c.nome)}` }
        ]);
      });
      buttons.push([{ text: "◀️ Voltar aos Fiados", callback_data: "cr_menu" }]);
      enviarMensagemTelegram(msg, { inline_keyboard: buttons }, chatId);
      return HtmlService.createHtmlOutput("OK");
    }

    if (userState && userState.startsWith('AWAITING_CR_PAY_VALOR:') && !text.startsWith('/')) {
      const clienteNome = userState.substring(22);
      cache.remove('state_' + chatId);

      const textParts = text.trim().split(' ');
      const valor = Number(textParts[0].replace(',', '.'));
      let forma = textParts[1] ? textParts[1].toUpperCase() : 'PIX';
      let formaNorm = forma.includes('PIX') ? 'Pix' : (forma.includes('CART') || forma.includes('CRED') || forma.includes('DEB') ? 'Cartão' : 'Dinheiro');

      if (isNaN(valor) || valor <= 0) {
        enviarMensagemTelegram("⚠️ Valor inválido. Use o formato: <code>30.00 PIX</code>", null, chatId);
        return HtmlService.createHtmlOutput("OK");
      }

      try {
        const res = receberFiadoClienteTelegram(clienteNome, valor, formaNorm);
        if (res.ok) {
          const msgSucesso = `💸 <b>Recebimento de R$ ${res.valorRecebido.toFixed(2)} (${formaNorm}) registrado para ${clienteNome}!</b>\n\n` +
                             `💰 Entrada lançada no Caixa com sucesso.`;
          const back = {
            inline_keyboard: [
              [{ text: "👤 Ver Saldo Restante do Cliente", callback_data: `cr_view_${encodeURIComponent(clienteNome)}` }],
              [{ text: "🧾 Voltar aos Fiados", callback_data: "cr_menu" }]
            ]
          };
          enviarMensagemTelegram(msgSucesso, back, chatId);
        } else {
          enviarMensagemTelegram("❌ " + res.msg, null, chatId);
        }
      } catch(err) {
        enviarMensagemTelegram("❌ Erro ao receber fiado: " + err.message, null, chatId);
      }
      return HtmlService.createHtmlOutput("OK");
    }

    if (userState && userState.startsWith('AWAITING_USER_NEW_PASS:') && !text.startsWith('/')) {
      const idUser = userState.substring(23);
      cache.remove('state_' + chatId);
      const novaSenha = text.trim();

      if (novaSenha.length < 6) {
        enviarMensagemTelegram("⚠️ A nova senha deve ter no mínimo 6 caracteres. Operação cancelada.", null, chatId);
        return HtmlService.createHtmlOutput("OK");
      }

      try {
        const ss = SpreadsheetApp.getActive();
        const sh = ss.getSheetByName('USUARIOS');
        const dados = sh ? sh.getDataRange().getValues() : [];
        let alterado = false;

        for (let i = 1; i < dados.length; i++) {
          if (String(dados[i][0]).toUpperCase().trim() === idUser.toUpperCase().trim()) {
            const hash = (typeof gerarHashSenha === 'function') ? gerarHashSenha(novaSenha) : novaSenha;
            sh.getRange(i + 1, 4).setValue(hash);
            if (typeof registrarAuditoria === 'function') {
              registrarAuditoria(idUser, 'SENHA_ALTERADA_TELEGRAM', 'Senha alterada via Telegram pelo Administrador');
            }
            alterado = true;
            break;
          }
        }

        if (alterado) {
          const msgSucesso = `✅ <b>Senha do usuário <code>${idUser}</code> atualizada com sucesso!</b>\n\n` +
                             `O usuário já pode fazer login com a nova senha cadastrada.`;
          const back = {
            inline_keyboard: [
              [{ text: "👤 Detalhes da Conta", callback_data: `user_detail_${idUser}` }],
              [{ text: "👥 Lista de Usuários", callback_data: "users_list_all" }]
            ]
          };
          enviarMensagemTelegram(msgSucesso, back, chatId);
        } else {
          enviarMensagemTelegram("❌ Usuário não encontrado no banco de dados.", null, chatId);
        }
      } catch(err) {
        enviarMensagemTelegram("❌ Erro ao atualizar senha: " + err.message, null, chatId);
      }
      return HtmlService.createHtmlOutput("OK");
    }

    // =============================================
    // 🛵 FLUXO DE CHECKOUT DO CLIENTE (TEXT INPUTS)
    // =============================================
    if (userState === 'AWAITING_CLIENT_NAME' && !text.startsWith('/')) {
      const nomeInput = text.trim();
      cache.remove('state_' + chatId);
      const cart = obterCarrinhoCliente(chatId);
      cart.nomeCliente = nomeInput;
      salvarCarrinhoCliente(chatId, cart);

      cache.put('state_' + chatId, 'AWAITING_CLIENT_PHONE', 600);
      const txt = `🛵 <b>Finalização do Pedido Delivery (Passo 2/3)</b>\n\n` +
                  `👤 <b>Cliente:</b> ${nomeInput}\n\n` +
                  `📞 <b>Qual é o seu Telefone / WhatsApp com DDD?</b>\n` +
                  `<i>Digite seu número no chat abaixo:</i>`;
      enviarMensagemTelegram(txt, { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: "client_view_cart" }]] }, chatId);
      return HtmlService.createHtmlOutput("OK");
    }

    if (userState === 'AWAITING_CLIENT_PHONE' && !text.startsWith('/')) {
      const phoneInput = text.trim();
      cache.remove('state_' + chatId);
      const cart = obterCarrinhoCliente(chatId);
      cart.telefone = phoneInput;
      salvarCarrinhoCliente(chatId, cart);

      cache.put('state_' + chatId, 'AWAITING_CLIENT_ADDR', 600);
      const txt = `🛵 <b>Finalização do Pedido Delivery (Passo 3/3)</b>\n\n` +
                  `📍 <b>Qual é o Endereço Completo de Entrega?</b>\n` +
                  `<i>Digite Rua, Número, Bairro, Complemento e Ponto de Referência:</i>`;
      enviarMensagemTelegram(txt, { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: "client_view_cart" }]] }, chatId);
      return HtmlService.createHtmlOutput("OK");
    }

    if (userState === 'AWAITING_CLIENT_ADDR' && !text.startsWith('/')) {
      const addrInput = text.trim();
      cache.remove('state_' + chatId);
      const cart = obterCarrinhoCliente(chatId);
      cart.endereco = addrInput;
      salvarCarrinhoCliente(chatId, cart);

      exibirOpcoesPagamentoCliente(chatId, null);
      return HtmlService.createHtmlOutput("OK");
    }

    if (userState === 'AWAITING_CLIENT_TROCO' && !text.startsWith('/')) {
      const valorTroco = text.trim();
      cache.remove('state_' + chatId);
      finalizarPedidoCliente(chatId, 'DINHEIRO', 'Troco para R$ ' + valorTroco);
      return HtmlService.createHtmlOutput("OK");
    }

    if (userState && userState.startsWith('AWAITING_DELIV_DRIVER:') && !text.startsWith('/')) {
      const pedido = userState.substring(22);
      cache.remove('state_' + chatId);
      const nomeEntregador = text.trim();

      try {
        const ss = SpreadsheetApp.getActive();
        const shDel = ss.getSheetByName('DELIVERY');
        if (shDel) {
          const dados = shDel.getDataRange().getValues();
          for (let i = 1; i < dados.length; i++) {
            if (pedidosCorrespondem(dados[i][0], pedido) || String(dados[i][0]) === String(pedido) || Number(dados[i][0]) == Number(pedido)) {
              // 9. Entregador (Coluna I / 9)
              shDel.getRange(i + 1, 9).setValue(nomeEntregador);

              // 8. Se ainda for PEDIDO FEITO, atualiza para EM ANDAMENTO
              const statusAtual = String(dados[i][7] || '').toUpperCase().trim();
              if (statusAtual === 'PEDIDO FEITO' || statusAtual === 'PENDENTE' || statusAtual === 'ABERTO') {
                shDel.getRange(i + 1, 8).setValue('EM ANDAMENTO');
              }
              break;
            }
          }
        }

        if (typeof encaminharDelivery === 'function') {
          try { encaminharDelivery(pedido, nomeEntregador); } catch(eEnc) {}
        }

        enviarMensagemTelegram(`✅ <b>Entregador "${nomeEntregador}" atualizado com sucesso no Pedido #${pedido}!</b>`, null, chatId);
        exibirDetalhesDeliveryTelegram(pedido, chatId, null);
      } catch(e) {
        enviarMensagemTelegram("❌ Erro ao atualizar entregador: " + e.message, null, chatId);
      }
      return HtmlService.createHtmlOutput("OK");
    }

    // =============================================
    // 🛒 TEXT STATE HANDLERS DE COMPRAS
    // =============================================
    if (userState === 'AWAITING_COMPRA_PROD' && !text.startsWith('/')) {
      const prodInput = text.trim();
      cache.remove('state_' + chatId);

      // Busca na lista de produtos cadastrados por correspondência inteligente para evitar duplicatas
      const prodsDb = (typeof obterListaNomesProdutosCadastrados === 'function') ? obterListaNomesProdutosCadastrados() : [];
      const prodEncontrado = (typeof encontrarMelhorProdutoCorrespondente === 'function') ? encontrarMelhorProdutoCorrespondente(prodInput, prodsDb) : prodInput;

      // Obtém estoque atual para mostrar na tela
      let estoqueAtual = 0;
      try {
        const mapaEst = (typeof obterMapaEstoqueReal === 'function') ? obterMapaEstoqueReal() : {};
        const safeNorm = str => String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toUpperCase().trim();
        estoqueAtual = mapaEst[safeNorm(prodEncontrado)] || 0;
      } catch(e) {}

      cache.put('temp_comp_prod_' + chatId, prodEncontrado, 600);
      cache.put('state_' + chatId, 'AWAITING_COMPRA_QTD', 600);

      const txt = `🛒 <b>Nova Compra: ${prodEncontrado} (Passo 2/4)</b>\n` +
                  (estoqueAtual > 0 ? `📦 <i>(Estoque atual cadastrado: ${estoqueAtual} un.)</i>\n\n` : '\n') +
                  `🔢 <b>Quantas unidades foram compradas?</b>\n\n` +
                  `<i>Toque em um dos botões rápidos ou digite o número no chat (Ex: 24, 50, 100):</i>`;
      const keyboard = [
        [
          { text: "➕ 12 un", callback_data: "comp_set_qtd_12" },
          { text: "➕ 24 un (1 cx)", callback_data: "comp_set_qtd_24" },
          { text: "➕ 48 un", callback_data: "comp_set_qtd_48" }
        ],
        [
          { text: "➕ 100 un", callback_data: "comp_set_qtd_100" },
          { text: "➕ 200 un", callback_data: "comp_set_qtd_200" }
        ],
        [{ text: "❌ Cancelar", callback_data: "comp_menu" }]
      ];
      enviarMensagemTelegram(txt, { inline_keyboard: keyboard }, chatId);
      return HtmlService.createHtmlOutput("OK");
    }

    if (userState === 'AWAITING_COMPRA_QTD' && !text.startsWith('/')) {
      const qtdInput = Number(text.trim().replace(',', '.'));
      if (isNaN(qtdInput) || qtdInput <= 0) {
        enviarMensagemTelegram("❌ Quantidade inválida! Por favor, digite um número maior que zero (Ex: 24):", { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: "comp_menu" }]] }, chatId);
        return HtmlService.createHtmlOutput("OK");
      }
      cache.remove('state_' + chatId);
      cache.put('temp_comp_qtd_' + chatId, String(qtdInput), 600);
      cache.put('state_' + chatId, 'AWAITING_COMPRA_UNIT', 600);

      const prod = cache.get('temp_comp_prod_' + chatId) || 'Produto';
      let custoRef = 0;
      try {
        const ss = SpreadsheetApp.getActive();
        const shProd = ss.getSheetByName('PRODUTOS');
        if (shProd) {
          const dados = shProd.getDataRange().getValues();
          for (let i = 1; i < dados.length; i++) {
            if (String(dados[i][0] || '').trim().toLowerCase() === prod.trim().toLowerCase()) {
              custoRef = Number(dados[i][2]) || 0;
              break;
            }
          }
        }
      } catch(e) {}

      const txtPrompt = `🛒 <b>Nova Compra: ${prod} (Passo 3/4)</b>\n\n` +
                        `📦 <b>Quantidade:</b> ${qtdInput} unidades\n\n` +
                        `💵 <b>Qual foi o Custo Unitário pago por item?</b>\n` +
                        (custoRef > 0 ? `<i>(Custo atual cadastrado: R$ ${custoRef.toFixed(2).replace('.', ',')})</i>\n\n` : '') +
                        `<i>Digite o valor no chat abaixo (Ex: 4.50, 3,80):</i>`;
      enviarMensagemTelegram(txtPrompt, { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: "comp_menu" }]] }, chatId);
      return HtmlService.createHtmlOutput("OK");
    }

    if (userState === 'AWAITING_COMPRA_UNIT' && !text.startsWith('/')) {
      const unitInput = Number(text.trim().replace('R$', '').replace(/\s+/g, '').replace(',', '.'));
      if (isNaN(unitInput) || unitInput <= 0) {
        enviarMensagemTelegram("❌ Custo unitário inválido! Por favor, digite um valor maior que zero (Ex: 4.50 ou 3,80):", { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: "comp_menu" }]] }, chatId);
        return HtmlService.createHtmlOutput("OK");
      }
      cache.remove('state_' + chatId);
      cache.put('temp_comp_unit_' + chatId, String(unitInput), 600);
      cache.put('state_' + chatId, 'AWAITING_COMPRA_FORN', 600);

      const prod = cache.get('temp_comp_prod_' + chatId) || 'Produto';
      const qtd = Number(cache.get('temp_comp_qtd_' + chatId)) || 1;
      const total = qtd * unitInput;

      const txtForn = `🛒 <b>Nova Compra: ${prod} (Passo 4/4)</b>\n\n` +
                      `📦 <b>Quantidade:</b> ${qtd} un.\n` +
                      `💵 <b>Custo Unitário:</b> R$ ${unitInput.toFixed(2).replace('.', ',')}\n` +
                      `💰 <b>Subtotal da Compra: R$ ${total.toFixed(2).replace('.', ',')}</b>\n\n` +
                      `🏢 <b>Qual é o Nome do Fornecedor / Distribuidor?</b>\n` +
                      `<i>Toque em uma das opções abaixo ou digite no chat:</i>`;
      const keyboard = [
        [
          { text: "🏢 Ambev", callback_data: "comp_set_forn_Ambev" },
          { text: "🏢 Heineken", callback_data: "comp_set_forn_Heineken" }
        ],
        [
          { text: "🏢 Coca-Cola", callback_data: "comp_set_forn_Coca-Cola" },
          { text: "🏢 Atacadão", callback_data: "comp_set_forn_Atacadao" }
        ],
        [{ text: "❌ Cancelar", callback_data: "comp_menu" }]
      ];
      enviarMensagemTelegram(txtForn, { inline_keyboard: keyboard }, chatId);
      return HtmlService.createHtmlOutput("OK");
    }

    if (userState === 'AWAITING_COMPRA_FORN' && !text.startsWith('/')) {
      const fornInput = text.trim();
      cache.remove('state_' + chatId);
      cache.put('temp_comp_forn_' + chatId, fornInput, 600);

      const prod = cache.get('temp_comp_prod_' + chatId) || 'Produto';
      const qtd = Number(cache.get('temp_comp_qtd_' + chatId)) || 1;
      const unit = Number(cache.get('temp_comp_unit_' + chatId)) || 0;
      const total = qtd * unit;

      const txtPay = `💳 <b>Forma de Pagamento da Compra</b>\n\n` +
                     `📦 <b>Produto:</b> ${prod}\n` +
                     `🔢 <b>Quantidade:</b> ${qtd} un.\n` +
                     `💵 <b>Custo Unitário:</b> R$ ${unit.toFixed(2).replace('.', ',')}\n` +
                     `🏢 <b>Fornecedor:</b> ${fornInput}\n` +
                     `💰 <b>TOTAL A PAGAR: R$ ${total.toFixed(2).replace('.', ',')}</b>\n\n` +
                     `Selecione como foi ou será realizado o pagamento:`;
      const keyboard = [
        [
          { text: "📱 PIX", callback_data: "comp_pay_PIX" },
          { text: "💵 Dinheiro", callback_data: "comp_pay_DINHEIRO" }
        ],
        [
          { text: "📄 Boleto (A Pagar)", callback_data: "comp_pay_BOLETO" },
          { text: "💳 Cartão", callback_data: "comp_pay_CARTAO" }
        ],
        [
          { text: "⏳ A Prazo / Consignado", callback_data: "comp_pay_A_PRAZO" }
        ],
        [{ text: "❌ Cancelar", callback_data: "comp_menu" }]
      ];
      enviarMensagemTelegram(txtPay, { inline_keyboard: keyboard }, chatId);
      return HtmlService.createHtmlOutput("OK");
    }

    if (userState === 'AWAITING_COMANDA_CLIENTE' && !text.startsWith('/')) {
      cache.remove('state_' + chatId);
      const clientName = text.trim();
      try {
        const pedido = typeof criarComandaBalcao === 'function' ? criarComandaBalcao(clientName) : '1';
        enviarMensagemTelegram(`✅ <b>Comanda ${pedido} criada com sucesso para ${clientName}!</b>`, null, chatId);
        exibirDetalhesComandaTelegram(pedido, chatId, null);
      } catch(e) {
        enviarMensagemTelegram("❌ Erro ao criar comanda: " + e.message, null, chatId);
      }
      return HtmlService.createHtmlOutput("OK");
    }

    if (userState === 'AWAITING_DELIVERY_CLIENTE' && !text.startsWith('/')) {
      const clientName = text.trim();
      cache.remove('state_' + chatId);
      cache.put('temp_deliv_client_' + chatId, clientName, 300);

      const msg = `🛵 <b>Novo Pedido de Delivery</b> (Passo 2/2)\n\n` +
                  `👤 <b>Cliente:</b> <b>${clientName}</b>\n\n` +
                  `💳 <b>Selecione a forma de pagamento combinada:</b>`;
      const buttons = {
        inline_keyboard: [
          [
            { text: "📱 PIX", callback_data: "deliv_create_PIX" },
            { text: "💵 Dinheiro", callback_data: "deliv_create_DINHEIRO" }
          ],
          [
            { text: "💳 Cartão", callback_data: "deliv_create_CARTAO" },
            { text: "🧾 Fiado", callback_data: "deliv_create_FIADO" }
          ],
          [{ text: "❌ Cancelar", callback_data: "deliv_menu" }]
        ]
      };
      enviarMensagemTelegram(msg, buttons, chatId);
      return HtmlService.createHtmlOutput("OK");
    }

    if (userState && userState.startsWith('AWAITING_DELIVERY_CUSTOM_QTD:') && !text.startsWith('/')) {
      const partsState = userState.split(':');
      const pedido = partsState[1];
      const rowIdx = Number(partsState[2]);
      cache.remove('state_' + chatId);

      const qtd = parseInt(text.trim(), 10);
      if (isNaN(qtd) || qtd <= 0) {
        enviarMensagemTelegram("⚠️ Quantidade inválida. Por favor, envie um número inteiro positivo.", null, chatId);
        return HtmlService.createHtmlOutput("OK");
      }

      try {
        const ss = SpreadsheetApp.getActive();
        const shProd = ss.getSheetByName('PRODUTOS');
        const productRow = shProd.getRange(rowIdx, 1, 1, shProd.getLastColumn()).getValues()[0];
        const nome = String(productRow[0] || '').trim();
        const preco = Number(productRow[4]) || 0;

        if (typeof validarEstoque === 'function' && !validarEstoque(nome, qtd)) {
          enviarMensagemTelegram(`❌ Estoque insuficiente de ${nome}! Digite uma quantidade menor.`, null, chatId);
          return HtmlService.createHtmlOutput("OK");
        }

        salvarItemDeliveryTelegram(pedido, nome, qtd, preco);
        enviarMensagemTelegram(`✅ <b>+${qtd}x ${nome} adicionado ao delivery #${pedido}!</b>`, null, chatId);
        exibirDetalhesDeliveryTelegram(pedido, chatId, null);
      } catch(e) {
        enviarMensagemTelegram("❌ Erro ao adicionar item: " + e.message, null, chatId);
      }
      return HtmlService.createHtmlOutput("OK");
    }

    if (userState && userState.startsWith('AWAITING_CUSTOM_QTD:') && !text.startsWith('/')) {
      const partsState = userState.split(':');
      const pedido = partsState[1];
      const rowIdx = Number(partsState[2]);
      cache.remove('state_' + chatId);

      const qtd = parseInt(text.trim(), 10);
      if (isNaN(qtd) || qtd <= 0) {
        enviarMensagemTelegram("⚠️ Quantidade inválida. Por favor, envie um número inteiro positivo.", null, chatId);
        return HtmlService.createHtmlOutput("OK");
      }

      try {
        const ss = SpreadsheetApp.getActive();
        const shProd = ss.getSheetByName('PRODUTOS');
        const productRow = shProd.getRange(rowIdx, 1, 1, shProd.getLastColumn()).getValues()[0];
        const nome = String(productRow[0] || '').trim();
        const preco = Number(productRow[4]) || 0;

        if (typeof validarEstoque === 'function' && !validarEstoque(nome, qtd)) {
          enviarMensagemTelegram(`❌ Estoque insuficiente de ${nome}! Digite uma quantidade menor.`, null, chatId);
          return HtmlService.createHtmlOutput("OK");
        }

        if (typeof salvarItensComandaAberta === 'function') {
          salvarItensComandaAberta(pedido, [{ produto: nome, qtd: qtd, unit: preco }]);
          enviarMensagemTelegram(`✅ <b>+${qtd}x ${nome} lançado na comanda ${pedido}!</b>`, null, chatId);
          exibirDetalhesComandaTelegram(pedido, chatId, null);
        }
      } catch(e) {
        enviarMensagemTelegram("❌ Erro ao adicionar item: " + e.message, null, chatId);
      }
      return HtmlService.createHtmlOutput("OK");
    }

    if (userState && userState.startsWith('AWAITING_CUSTOM_PAY:') && !text.startsWith('/')) {
      const partsState = userState.split(':');
      const pedido = partsState[1];
      cache.remove('state_' + chatId);

      const textParts = text.trim().split(' ');
      const valor = Number(textParts[0].replace(',', '.'));
      let forma = textParts[1] ? textParts[1].toUpperCase() : 'PIX';
      let formaNorm = forma.includes('PIX') ? 'Pix' : (forma.includes('CART') || forma.includes('CRED') || forma.includes('DEB') ? 'Cartão' : (forma.includes('FIADO') ? '🧾 Fiado' : 'Dinheiro'));

      if (isNaN(valor) || valor <= 0) {
        enviarMensagemTelegram("⚠️ Valor inválido. Use o formato: <code>25.50 PIX</code>", null, chatId);
        return HtmlService.createHtmlOutput("OK");
      }

      try {
        if (typeof registrarPagamentoParcialComanda === 'function') {
          const res = registrarPagamentoParcialComanda(pedido, valor, formaNorm);
          if (res.ok) {
            if (res.quitado && typeof fecharComandaBalcaoFinal === 'function') {
              fecharComandaBalcaoFinal(pedido, formaNorm);
              enviarMensagemTelegram(`🎉 <b>Comanda ${pedido} 100% quitada com sucesso!</b>`, null, chatId);
            } else {
              enviarMensagemTelegram(`💸 <b>Pagamento de R$ ${valor.toFixed(2)} (${formaNorm}) registrado na comanda ${pedido}!</b>`, null, chatId);
            }
            exibirDetalhesComandaTelegram(pedido, chatId, null);
          } else {
            enviarMensagemTelegram(`❌ Falha: ${res.msg || 'Erro ao registrar pagamento'}`, null, chatId);
          }
        }
      } catch(e) {
        enviarMensagemTelegram("❌ Erro: " + e.message, null, chatId);
      }
      return HtmlService.createHtmlOutput("OK");
    }

    if (text.startsWith('/')) {
      const parts = text.split(' ');
      const command = parts[0].toLowerCase();
      const arg = parts.slice(1).join(' ').trim();

      // Cancela qualquer estado prévio ao digitar um novo comando
      if (userState) {
        cache.remove('state_' + chatId);
      }

      // 🔐 COMANDO DE LOGIN SEGURO: /login [usuario] [senha]
      if (command === '/login' || command === '/vincular') {
        const loginParts = arg ? arg.split(' ') : [];
        if (loginParts.length < 2) {
          // Dispara fluxo conversacional seguro sem expor senha nem exemplo
          cache.put('state_' + chatId, 'AWAITING_LOGIN_USER', 300);
          enviarMensagemTelegram(
            `🔐 <b>Acesso ao Sistema de Gestão de Depósito</b>\n\n` +
            `✍️ <b>Digite o seu nome de usuário (login)</b> no chat abaixo:`,
            { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: "menu" }]] },
            chatId
          );
          return HtmlService.createHtmlOutput("OK");
        }

        const userLogin = loginParts[0];
        const userPass = loginParts.slice(1).join(' ');

        if (typeof vincularUsuarioTelegram === 'function') {
          const res = vincularUsuarioTelegram(userLogin, userPass, chatId);
          if (res && res.ok) {
            const userObj = res.usuario;
            const menuObj = montarMenuPrincipal(userObj);
            const msgSucesso = `🎉 <b>Conta vinculada com sucesso!</b>\n\n` +
                               `👤 <b>Usuário:</b> ${userObj.nome}\n` +
                               `🛡️ <b>Perfil:</b> ${userObj.perfil}\n\n` +
                               menuObj.texto;
            enviarMensagemTelegram(msgSucesso, menuObj.markup, chatId);
          } else {
            enviarMensagemTelegram(`❌ <b>Falha no login:</b> ${res?.msg || 'Credenciais inválidas.'}`, null, chatId);
          }
        }
        return HtmlService.createHtmlOutput("OK");
      }

      // 🚪 LOGOUT: /logout
      if (command === '/logout' || command === '/desvincular') {
        if (typeof desvincularUsuarioTelegram === 'function') {
          desvincularUsuarioTelegram(chatId);
        }
        const menuObj = montarMenuPrincipal(null, chatId);
        enviarMensagemTelegram(`🚪 <b>Você foi desconectado com sucesso.</b>`, menuObj.markup, chatId);
        return HtmlService.createHtmlOutput("OK");
      }

      // =============================================
      // 🛒 COMANDOS PÚBLICOS DO CLIENTE
      // =============================================
      if (command === '/cardapio' || command === '/pedir' || command === '/produtos_cardapio') {
        exibirMenuCategoriasCliente(chatId, null);
        return HtmlService.createHtmlOutput("OK");
      }
      if (command === '/carrinho') {
        exibirCarrinhoCliente(chatId, null);
        return HtmlService.createHtmlOutput("OK");
      }
      if (command === '/meuspedidos' || command === '/pedidos') {
        exibirMeusPedidosCliente(chatId, null);
        return HtmlService.createHtmlOutput("OK");
      }
      if (command === '/contato' || command === '/atendente' || command === '/suporte') {
        exibirContatoAtendente(chatId, null);
        return HtmlService.createHtmlOutput("OK");
      }

      // Se não autenticado como funcionário:
      if (!usuario) {
        const menuObj = montarMenuPrincipal(null, chatId);
        enviarMensagemTelegram(menuObj.texto, menuObj.markup, chatId);
        return HtmlService.createHtmlOutput("OK");
      }

      // 🏠 MENU PRINCIPAL PARA FUNCIONÁRIO / DONO LOGADO
      if (command === '/start' || command === '/menu') {
        const menuObj = montarMenuPrincipal(usuario, chatId);
        enviarMensagemTelegram(menuObj.texto, menuObj.markup, chatId);
        return HtmlService.createHtmlOutput("OK");
      }

      // 📦 GESTÃO DE PRODUTOS: /produtos
      else if (command === '/produtos' || command === '/produto') {
        const evt = { callback_query: { id: "0", data: "prod_menu", message: { chat: message.chat, message_id: 0 } } };
        doPost({ postData: { contents: JSON.stringify(evt) } });
      }

      // 🛒 COMPRAS & ENTRADA: /compras
      else if (command === '/compras' || command === '/compra' || command === '/entradas') {
        const evt = { callback_query: { id: "0", data: "comp_menu", message: { chat: message.chat, message_id: 0 } } };
        doPost({ postData: { contents: JSON.stringify(evt) } });
      }

      // ➕ CADASTRAR PRODUTO: /cadastrarproduto
      else if (command === '/cadastrarproduto' || command === '/novoproduto') {
        const evt = { callback_query: { id: "0", data: "prod_new_step1", message: { chat: message.chat, message_id: 0 } } };
        doPost({ postData: { contents: JSON.stringify(evt) } });
      }

      // 🔍 CONSULTA DE PRODUTOS: /busca [nome]
      else if (command === '/busca' || command === '/preco' || command === '/produto') {
        if (!arg) {
          enviarMensagemTelegram("⚠️ Digite o produto a pesquisar: <code>/busca cerveja</code>", null, chatId);
          return HtmlService.createHtmlOutput("OK");
        }
        try {
          const ss = SpreadsheetApp.getActive();
          const shProd = ss.getSheetByName('PRODUTOS');
          const dados = shProd ? shProd.getDataRange().getValues() : [];
          const mapaEst = (typeof obterMapaEstoqueReal === 'function') ? obterMapaEstoqueReal() : {};
          const safeNorm = str => String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
          const termoNorm = safeNorm(arg);
          const encontrados = [];

          for (let i = 1; i < dados.length; i++) {
            const nome = String(dados[i][0] || '');
            if (safeNorm(nome).includes(termoNorm)) {
              const nomeNorm = safeNorm(nome);
              const estReal = (mapaEst[nomeNorm] !== undefined) ? mapaEst[nomeNorm] : (mapaEst[nome.toLowerCase()] !== undefined ? mapaEst[nome.toLowerCase()] : (Number(dados[i][11]) || 0));
              encontrados.push({
                linha: i + 1,
                nome: nome,
                categoria: dados[i][1],
                preco: Number(dados[i][4]) || 0,
                qtd: estReal
              });
            }
          }

          if (encontrados.length === 0) {
            enviarMensagemTelegram(`🔍 Nenhum produto localizado com o termo "<b>${arg}</b>".`, null, chatId);
          } else {
            let msg = `🔍 <b>Produtos Localizados (${encontrados.length}):</b>\n\n`;
            encontrados.slice(0, 10).forEach(p => {
              msg += `• <b>${p.nome}</b>\n` +
                     `  💵 Preço: R$ ${p.preco.toFixed(2).replace('.', ',')} | 📦 <b>Estoque: ${p.qtd} un</b>\n`;
            });
            enviarMensagemTelegram(msg, null, chatId);
          }
        } catch(e) {
          enviarMensagemTelegram("Erro na busca: " + e.message, null, chatId);
        }
      }

      // 🍺 NOVA COMANDA: /novacomanda [Nome do Cliente]
      else if (command === '/novacomanda') {
        const clientName = arg || '';
        if (!clientName) {
          cache.put('state_' + chatId, 'AWAITING_COMANDA_CLIENTE', 300);
          enviarMensagemTelegram(
            `➕ <b>Abrir Nova Comanda</b>\n\n` +
            `✍️ <b>Digite o nome do cliente</b> (ou Mesa / Balcão) no chat:`,
            { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: "cmd_menu" }]] },
            chatId
          );
          return HtmlService.createHtmlOutput("OK");
        }

        try {
          if (typeof criarComandaBalcao === 'function') {
            const pedido = criarComandaBalcao(clientName);
            enviarMensagemTelegram(`✅ <b>Comanda ${pedido} criada com sucesso para ${clientName}!</b>`, null, chatId);
            exibirDetalhesComandaTelegram(pedido, chatId, null);
          }
        } catch(err) {
          enviarMensagemTelegram("❌ Erro ao criar comanda: " + err.message, null, chatId);
        }
      }

      // 🚚 NOVO DELIVERY: /novodelivery [Nome do Cliente]
      else if (command === '/novodelivery') {
        const clientName = arg || '';
        if (!clientName) {
          cache.put('state_' + chatId, 'AWAITING_DELIVERY_CLIENTE', 300);
          enviarMensagemTelegram(
            `🛵 <b>Novo Pedido de Delivery</b> (Passo 1/2)\n\n` +
            `✍️ <b>Digite o nome do cliente</b> no chat:`,
            { inline_keyboard: [[{ text: "❌ Cancelar", callback_data: "deliv_menu" }]] },
            chatId
          );
          return HtmlService.createHtmlOutput("OK");
        }

        cache.put('temp_deliv_client_' + chatId, clientName, 300);
        const msg = `🛵 <b>Novo Pedido de Delivery</b> (Passo 2/2)\n\n` +
                    `👤 <b>Cliente:</b> <b>${clientName}</b>\n\n` +
                    `💳 <b>Selecione a forma de pagamento combinada:</b>`;
        const buttons = {
          inline_keyboard: [
            [
              { text: "📱 PIX", callback_data: "deliv_create_PIX" },
              { text: "💵 Dinheiro", callback_data: "deliv_create_DINHEIRO" }
            ],
            [
              { text: "💳 Cartão", callback_data: "deliv_create_CARTAO" },
              { text: "🧾 Fiado", callback_data: "deliv_create_FIADO" }
            ],
            [{ text: "❌ Cancelar", callback_data: "deliv_menu" }]
          ]
        };
        enviarMensagemTelegram(msg, buttons, chatId);
      }

      // 📂 COMANDAS ABERTAS: /comandas
      else if (command === '/comandas') {
        const abertas = obterComandasAbertasTelegram();
        let msg = `🍺 <b>Comandas Abertas (${abertas.length}):</b>\n\n`;
        const buttons = [];
        let row = [];
        abertas.forEach(c => {
          const saldo = typeof calcularSaldoComanda === 'function' ? calcularSaldoComanda(c.pedido) : 0;
          msg += `• <b>${c.pedido}</b> - ${c.cliente || 'Consumidor'} | R$ ${saldo.toFixed(2)}\n`;
          row.push({ text: `🔎 ${c.pedido}`, callback_data: `cmd_info_${c.pedido}` });
          if (row.length === 2) {
            buttons.push(row);
            row = [];
          }
        });
        if (row.length) buttons.push(row);
        buttons.push([{ text: "◀️ Voltar ao Menu", callback_data: "menu" }]);
        enviarMensagemTelegram(msg, { inline_keyboard: buttons }, chatId);
      }

      // 🚚 DELIVERIES ATIVOS: /delivery
      else if (command === '/delivery') {
        const ativos = obterDeliveriesAtivosTelegram();
        let msg = `🚚 <b>Deliveries Ativos (${ativos.length}):</b>\n\n`;
        const buttons = [];
        ativos.forEach(d => {
          msg += `• <b>${d.pedido}</b> - ${d.cliente} | R$ ${d.total.toFixed(2)} [${d.status}]\n`;
          buttons.push([
            { text: `🛵 ${d.pedido} - ${d.cliente}`, callback_data: `deliv_info_${d.pedido}` }
          ]);
        });
        buttons.push([{ text: "◀️ Menu Principal", callback_data: "menu" }]);
        enviarMensagemTelegram(msg, { inline_keyboard: buttons }, chatId);
      }

      // 📊 STATUS FINANCEIRO: /status
      else if (command === '/status') {
        const statusEvt = { callback_query: { id: "0", data: "status", message: { chat: message.chat, message_id: 0 } } };
        doPost({ postData: { contents: JSON.stringify(statusEvt) } });
      }

      // 🚨 ESTOQUE CRÍTICO: /estoque
      else if (command === '/estoque') {
        const estEvt = { callback_query: { id: "0", data: "estoque", message: { chat: message.chat, message_id: 0 } } };
        doPost({ postData: { contents: JSON.stringify(estEvt) } });
      }
      else {
        // Se começou com / mas não é comando do sistema, passa para a IA
        processarMensagemComIA(text, chatId, usuario);
      }
    } else {
      // 💬 CONVERSA DIRETA & COMANDOS EM LINGUAGEM NATURAL PARA A IA
      // Executa ações reais (trocar preço, estoque, comanda, consultas) ou responde dúvidas
      processarMensagemComIA(text, chatId, usuario);
    }

    return HtmlService.createHtmlOutput("OK");

  } catch (e) {
    console.error("Erro no processamento doPost do Telegram Webhook:", e);
    return HtmlService.createHtmlOutput("OK");
  }
}


/**
 * 🧪 Teste de envio de mensagem para diagnóstico de configurações
 */
function testarEnvioTelegram() {
  const token = getConfig('TELEGRAM_BOT_TOKEN');
  const chatId = getConfig('TELEGRAM_DONO_CHAT_ID');
  const ui = SpreadsheetApp.getUi();

  if (!token || String(token).trim() === '') {
    ui.alert("❌ Erro: TELEGRAM_BOT_TOKEN não está configurado nas Configurações do Depósito!");
    return;
  }
  if (!chatId || String(chatId).trim() === '') {
    ui.alert("❌ Erro: TELEGRAM_DONO_CHAT_ID não está configurado nas Configurações do Depósito!");
    return;
  }

  const url = "https://api.telegram.org/bot" + String(token).trim() + "/sendMessage";
  const payload = {
    chat_id: String(chatId).trim(),
    text: "🧪 <b>Teste de Conexão:</b> Se você está lendo isso, a sua configuração do Telegram está 100% correta!",
    parse_mode: 'HTML'
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    if (result.ok) {
      ui.alert("✅ Sucesso! Mensagem de teste enviada com sucesso para o Telegram.");
    } else {
      ui.alert("❌ Erro retornado pelo Telegram:\n\nCódigo: " + result.error_code + "\nDescrição: " + result.description + "\n\nImportante: Certifique-se de ter iniciado a conversa com o bot no Telegram (clique em Começar ou envie /start no chat com o bot) antes de testar.");
    }
  } catch(e) {
    ui.alert("❌ Falha na conexão com a API do Telegram: " + e.message);
  }
}


/**
 * doGet - Exibe uma página de status para o Web App ao acessar via navegador ou serve o Painel 360°
 */
function doGet(e) {
  try {
    if (e && e.parameter && (e.parameter.page === 'analise' || e.parameter.view === 'analise' || e.parameter.app === 'analise')) {
      return HtmlService.createHtmlOutputFromFile('AnaliseProduto')
        .setTitle('📊 Análise de Lucratividade')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    if (e && e.parameter && e.parameter.page === 'status') {
      const nomeDeposito = typeof getNomeDeposito === 'function' ? getNomeDeposito() : 'Gestão de Depósito';
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${nomeDeposito} - Telegram Bot Status</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; color: white; text-align: center; padding: 50px 20px; }
            .card { background: #1e293b; border-radius: 12px; padding: 40px; max-width: 500px; margin: 0 auto; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
            h1 { color: #38bdf8; margin-bottom: 10px; }
            p { color: #94a3b8; line-height: 1.6; }
            .status { background: #10b981; color: white; padding: 6px 12px; border-radius: 20px; font-weight: bold; display: inline-block; margin-top: 15px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>🤖 ${nomeDeposito} - Telegram Bot</h1>
            <p>O Webhook do sistema está operando corretamente e pronto para receber notificações do Telegram.</p>
            <span class="status">🟢 ONLINE</span>
          </div>
        </body>
        </html>
      `;
      return HtmlService.createHtmlOutput(html).setTitle(nomeDeposito + " - Status");
    }

    // Padrão: Carrega o Painel Executivo & PDV 360° diretamente via HtmlOutput (instantâneo, sem operações pesadas de disco/Drive no carregamento)
    let nomeDep = 'Gestão de Depósito';
    try {
      if (typeof getNomeDeposito === 'function') {
        nomeDep = getNomeDeposito() || nomeDep;
      }
    } catch(eNome) {}

    return HtmlService.createHtmlOutputFromFile('PainelDeposito360')
      .setTitle('👑 ' + nomeDep + ' - Painel 360° & PDV')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch(err) {
    console.error('Erro crítico em doGet:', err);
    return HtmlService.createHtmlOutput(
      '<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;background:#090d16;color:#fff;text-align:center;">' +
      '<h2 style="color:#ef4444;">⚠️ Erro ao Inicializar o Painel 360°</h2>' +
      '<p style="color:#94a3b8;font-size:14px;">' + (err.message || err) + '</p>' +
      '<p><button onclick="location.reload()" style="padding:10px 20px;border-radius:8px;background:#3b82f6;color:#fff;border:none;cursor:pointer;font-weight:bold;">🔄 Recarregar</button></p>' +
      '</body></html>'
    ).setTitle('Erro de Inicialização');
  }
}


/**
 * 🔍 Consulta as informações de webhook ativas no servidor do Telegram
 */
function verificarStatusTelegram() {
  const token = getConfig('TELEGRAM_BOT_TOKEN');
  const ui = SpreadsheetApp.getUi();

  if (!token || String(token).trim() === '') {
    ui.alert("❌ Erro: TELEGRAM_BOT_TOKEN não está configurado nas Configurações do Depósito!");
    return;
  }

  const url = "https://api.telegram.org/bot" + String(token).trim() + "/getWebhookInfo";
  try {
    const response = UrlFetchApp.fetch(url);
    const result = JSON.parse(response.getContentText());
    if (result.ok) {
      const info = result.result;
      const msg = "🤖 Status do Webhook no Telegram:\n\n" +
                  "🔗 URL Registrada: " + (info.url || "Nenhuma (Bot desativado)") + "\n" +
                  "⏳ Mensagens Pendentes: " + info.pending_update_count + "\n" +
                  "❌ Último Erro: " + (info.last_error_message || "Nenhum") + "\n" +
                  "📅 Data do Último Erro: " + (info.last_error_date ? new Date(info.last_error_date * 1000).toLocaleString() : "Nenhuma");
      ui.alert(msg);
    } else {
      ui.alert("❌ Erro do Telegram ao consultar Webhook: " + result.description);
    }
  } catch(e) {
    ui.alert("❌ Falha ao obter dados do Telegram: " + e.message);
  }
}

/**
 * Envia notificação interativa no Telegram com botões de aprovação/rejeição de conferência de caixa.
 */
function enviarSolicitacaoConferenciaTelegram(dadosConf) {
  try {
    const token = typeof getConfig === 'function' ? getConfig('TELEGRAM_BOT_TOKEN') : '';
    if (!token) return { ok: false, msg: 'Token do Telegram não configurado.' };

    const targetChatId = dadosConf.chatIdDestino || (typeof getConfig === 'function' ? getConfig('TELEGRAM_DONO_CHAT_ID') : '');
    if (!targetChatId) return { ok: false, msg: 'Chat ID do gestor não encontrado.' };

    const dif = Number(dadosConf.valorGaveta || 0) - Number(dadosConf.saldo || 0);
    let difTexto = 'Sem divergência (Bateu)';
    if (dif > 0) difTexto = `+ R$ ${dif.toFixed(2).replace('.', ',')} (Sobra em Caixa)`;
    else if (dif < 0) difTexto = `- R$ ${Math.abs(dif).toFixed(2).replace('.', ',')} (Falta em Caixa)`;

    const texto = 
      `🔔 <b>NOVA CONFERÊNCIA DE CAIXA PARA APROVAÇÃO!</b>\n\n` +
      `🆔 <b>Protocolo:</b> ${dadosConf.idConf}\n` +
      `👤 <b>Operador:</b> ${dadosConf.nomeOperador}\n` +
      `📅 <b>Data/Hora:</b> ${Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm:ss')}\n\n` +
      `💵 <b>Entradas Hoje:</b> R$ ${(Number(dadosConf.entradas) || 0).toFixed(2).replace('.', ',')}\n` +
      `💸 <b>Saídas Hoje:</b> R$ ${(Number(dadosConf.saidas) || 0).toFixed(2).replace('.', ',')}\n` +
      `💰 <b>Saldo Sistema:</b> R$ ${(Number(dadosConf.saldo) || 0).toFixed(2).replace('.', ',')}\n` +
      `🪙 <b>Contado na Gaveta:</b> R$ ${(Number(dadosConf.valorGaveta) || 0).toFixed(2).replace('.', ',')}\n` +
      `⚖️ <b>Diferença:</b> ${difTexto}\n` +
      (dadosConf.obs ? `📝 <b>Observação:</b> ${dadosConf.obs}\n\n` : `\n`) +
      `<i>Selecione abaixo para concluir o fechamento do caixa:</i>`;

    const replyMarkup = {
      inline_keyboard: [
        [
          { text: '✅ Aprovar Conferência', callback_data: `conf_appr_${dadosConf.idConf}` },
          { text: '❌ Rejeitar / Recontar', callback_data: `conf_rej_${dadosConf.idConf}` }
        ]
      ]
    };

    return enviarMensagemTelegram(texto, replyMarkup, targetChatId);
  } catch(e) {
    console.error('Erro em enviarSolicitacaoConferenciaTelegram:', e);
    return false;
  }
}

/**
 * Processa a decisão de aprovação ou rejeição da conferência de caixa tomada no Telegram pelo gestor.
 */
function processarAprovacaoConferenciaTelegram(idConf, nomeGestor, aprovado) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = typeof obterAbaConferenciaCaixa === 'function' ? obterAbaConferenciaCaixa(ss) : (ss.getSheetByName('CONFERENCIA_CAIXA') || ss.getSheetByName('CAIXA_FECHAMENTO'));
    if (!sh) return { ok: false, msg: 'Aba CONFERENCIA_CAIXA não encontrada.' };

    const dados = sh.getDataRange().getValues();
    let rowIndex = -1;
    let confRow = null;

    for (let i = 1; i < dados.length; i++) {
      if (String(dados[i][0]).trim() === String(idConf).trim()) {
        rowIndex = i + 1;
        confRow = dados[i];
        break;
      }
    }

    if (rowIndex === -1 || !confRow) {
      return { ok: false, msg: `Conferência ID #${idConf} não encontrada.` };
    }

    const statusAtual = String(confRow[7] || '').toUpperCase();
    if (statusAtual === 'APROVADO' || statusAtual === 'REJEITADO') {
      return { ok: false, msg: `Esta conferência já foi processada anteriormente (${statusAtual}).` };
    }

    const agora = new Date();
    const agoraFmt = Utilities.formatDate(agora, 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm:ss');
    const nomeOperador = confRow[8] || 'Operador';
    const saldoSistema = Number(confRow[4]) || 0;
    const valorGaveta = Number(confRow[5]) || 0;
    const dif = Number(confRow[6]) || (valorGaveta - saldoSistema);

    let difTexto = 'Sem divergência (Bateu)';
    if (dif > 0) difTexto = `+ R$ ${dif.toFixed(2).replace('.', ',')} (Sobra em Caixa)`;
    else if (dif < 0) difTexto = `- R$ ${Math.abs(dif).toFixed(2).replace('.', ',')} (Falta em Caixa)`;

    if (aprovado) {
      // 1. Atualiza Status = APROVADO, Gestor Aprovador = nomeGestor, Data = agora
      sh.getRange(rowIndex, 8).setValue('APROVADO');
      sh.getRange(rowIndex, 10).setValue(nomeGestor);
      sh.getRange(rowIndex, 11).setValue(agora);

      // 2. Insere linha separadora no CAIXA
      try {
        if (typeof inserirLinhaSeparadoraCaixa === 'function') {
          inserirLinhaSeparadoraCaixa(`CONFERÊNCIA DE CAIXA [APROVADA POR ${nomeGestor.toUpperCase()}]`, saldoSistema);
        }
      } catch(e) {}

      const novoTexto = 
        `✅ <b>CONFERÊNCIA DE CAIXA APROVADA COM SUCESSO!</b>\n\n` +
        `🆔 <b>Protocolo:</b> ${idConf}\n` +
        `👤 <b>Operador:</b> ${nomeOperador}\n` +
        `💰 <b>Saldo Sistema:</b> R$ ${saldoSistema.toFixed(2).replace('.', ',')}\n` +
        `🪙 <b>Contado na Gaveta:</b> R$ ${valorGaveta.toFixed(2).replace('.', ',')}\n` +
        `⚖️ <b>Diferença:</b> ${difTexto}\n` +
        `✍️ <b>Aprovado por:</b> ${nomeGestor}\n` +
        `⏰ <b>Concluído em:</b> ${agoraFmt}\n\n` +
        `🔒 <i>O caixa do turno foi oficialmente conciliado no sistema.</i>`;

      return { ok: true, msg: 'Conferência aprovada com sucesso!', novoTexto: novoTexto };
    } else {
      // Rejeitado
      sh.getRange(rowIndex, 8).setValue('REJEITADO');
      sh.getRange(rowIndex, 10).setValue(nomeGestor);
      sh.getRange(rowIndex, 11).setValue(agora);

      const novoTexto = 
        `❌ <b>CONFERÊNCIA DE CAIXA REJEITADA!</b>\n\n` +
        `🆔 <b>Protocolo:</b> ${idConf}\n` +
        `👤 <b>Operador:</b> ${nomeOperador}\n` +
        `💰 <b>Saldo Sistema:</b> R$ ${saldoSistema.toFixed(2).replace('.', ',')}\n` +
        `🪙 <b>Contado na Gaveta:</b> R$ ${valorGaveta.toFixed(2).replace('.', ',')}\n` +
        `⚖️ <b>Diferença:</b> ${difTexto}\n` +
        `🚫 <b>Rejeitado por:</b> ${nomeGestor}\n` +
        `⏰ <b>Horário:</b> ${agoraFmt}\n\n` +
        `⚠️ <i>Atenção: O operador deve recontar o caixa físico e realizar novo envio.</i>`;

      return { ok: true, msg: 'Conferência rejeitada.', novoTexto: novoTexto };
    }
  } catch(err) {
    console.error('Erro em processarAprovacaoConferenciaTelegram:', err);
    return { ok: false, msg: 'Erro ao processar aprovação: ' + err.message };
  }
}
