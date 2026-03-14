/**
 * WHATSAPP DELIVERY - MVP FUNCIONAL E SEGURO
 * Fluxo: recebido -> preparo -> transporte -> entregue
 */

function inicializarWhatsappMVP() {
  const props = PropertiesService.getScriptProperties();
  const defaults = {
    WHATSAPP_ENABLED: 'NAO',
    WHATSAPP_TOKEN: '',
    WHATSAPP_WEBHOOK_SECRET: '',
    WHATSAPP_PROVIDER_URL: '',
    WHATSAPP_RATE_LIMIT_PER_MIN: '30'
  };

  Object.keys(defaults).forEach(function(k) {
    if (props.getProperty(k) === null) {
      props.setProperty(k, defaults[k]);
    }
  });

  return { ok: true, msg: 'Configuração base do WhatsApp inicializada.' };
}

function receberPedidoWhatsapp(payload, signature) {
  validarSegurancaWebhook_(payload, signature);
  aplicarRateLimitWhatsapp_();

  const body = normalizarPayloadWhatsapp_(payload);
  if (!body.clienteTelefone || !body.itens.length) {
    throw new Error('Payload inválido: telefone e itens são obrigatórios.');
  }

  const pedido = criarPedidoDeliveryInterno_(body);
  registrarEventoWhatsapp_(pedido.idPedido, 'RECEBIDO', 'Pedido recebido via WhatsApp');
  enviarMensagemWhatsapp_(body.clienteTelefone, '✅ Pedido recebido! Nº ' + pedido.idPedido);

  return {
    ok: true,
    idPedido: pedido.idPedido,
    status: pedido.status,
    msg: 'Pedido recebido com sucesso.'
  };
}

function atualizarStatusPedidoWhatsapp(idPedido, novoStatus) {
  const statusPermitidos = ['RECEBIDO', 'PREPARO', 'TRANSPORTE', 'ENTREGUE'];
  const status = String(novoStatus || '').toUpperCase();
  if (statusPermitidos.indexOf(status) === -1) {
    throw new Error('Status inválido: ' + novoStatus);
  }

  const ss = SpreadsheetApp.getActive();
  const sh = obterOuCriarAbaWhatsappPedidos_(ss);
  const values = sh.getDataRange().getValues();

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === String(idPedido)) {
      sh.getRange(i + 1, 5).setValue(status);
      sh.getRange(i + 1, 8).setValue(new Date());

      const telefone = String(values[i][2] || '');
      registrarEventoWhatsapp_(idPedido, status, 'Status atualizado para ' + status);
      if (telefone) {
        enviarMensagemWhatsapp_(telefone, '📦 Pedido ' + idPedido + ' atualizado: ' + status);
      }

      return { ok: true, idPedido: idPedido, status: status };
    }
  }

  throw new Error('Pedido não encontrado: ' + idPedido);
}

function listarPedidosWhatsapp() {
  const ss = SpreadsheetApp.getActive();
  const sh = obterOuCriarAbaWhatsappPedidos_(ss);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];

  return values.slice(1).map(function(row) {
    return {
      idPedido: row[0],
      clienteNome: row[1],
      clienteTelefone: row[2],
      resumoItens: row[3],
      status: row[4],
      origem: row[5],
      criadoEm: row[6],
      atualizadoEm: row[7]
    };
  });
}

function validarSegurancaWebhook_(payload, signature) {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('WHATSAPP_ENABLED') !== 'SIM') {
    throw new Error('Integração WhatsApp desativada. Configure WHATSAPP_ENABLED=SIM.');
  }

  const secret = props.getProperty('WHATSAPP_WEBHOOK_SECRET') || '';
  if (!secret) {
    throw new Error('Webhook secret não configurado.');
  }

  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
  const bytes = Utilities.computeHmacSha256Signature(raw, secret);
  const digest = Utilities.base64Encode(bytes);
  if (String(signature || '') !== String(digest)) {
    throw new Error('Assinatura inválida do webhook.');
  }
}

function aplicarRateLimitWhatsapp_() {
  const cache = CacheService.getScriptCache();
  const props = PropertiesService.getScriptProperties();
  const limite = Number(props.getProperty('WHATSAPP_RATE_LIMIT_PER_MIN') || 30);
  const key = 'whatsapp_rate_limit_count';
  const atual = Number(cache.get(key) || 0);

  if (atual >= limite) {
    throw new Error('Rate limit excedido para integração WhatsApp.');
  }

  cache.put(key, String(atual + 1), 60);
}

function normalizarPayloadWhatsapp_(payload) {
  const body = typeof payload === 'string' ? JSON.parse(payload || '{}') : (payload || {});
  const itens = Array.isArray(body.itens) ? body.itens : [];

  return {
    clienteNome: String(body.clienteNome || 'Cliente').trim(),
    clienteTelefone: String(body.clienteTelefone || '').replace(/\D/g, ''),
    endereco: String(body.endereco || '').trim(),
    itens: itens
      .map(function(i) {
        return {
          nome: String(i.nome || '').trim(),
          quantidade: Number(i.quantidade || 0),
          observacao: String(i.observacao || '').trim()
        };
      })
      .filter(function(i) { return i.nome && i.quantidade > 0; })
  };
}

function criarPedidoDeliveryInterno_(pedido) {
  const ss = SpreadsheetApp.getActive();
  const sh = obterOuCriarAbaWhatsappPedidos_(ss);

  const idPedido = 'WPP-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  const resumoItens = pedido.itens.map(function(i) { return i.quantidade + 'x ' + i.nome; }).join(', ');

  sh.appendRow([
    idPedido,
    pedido.clienteNome,
    pedido.clienteTelefone,
    resumoItens,
    'RECEBIDO',
    'WHATSAPP',
    new Date(),
    new Date()
  ]);

  return {
    idPedido: idPedido,
    status: 'RECEBIDO'
  };
}

function registrarEventoWhatsapp_(idPedido, evento, detalhe) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName('WHATSAPP_LOGS');
  if (!sh) {
    sh = ss.insertSheet('WHATSAPP_LOGS');
    sh.appendRow(['DataHora', 'Pedido', 'Evento', 'Detalhe']);
  }
  sh.appendRow([new Date(), idPedido, evento, detalhe]);
}

function enviarMensagemWhatsapp_(telefone, mensagem) {
  const props = PropertiesService.getScriptProperties();
  const providerUrl = props.getProperty('WHATSAPP_PROVIDER_URL') || '';
  const token = props.getProperty('WHATSAPP_TOKEN') || '';

  if (!providerUrl || !token) {
    registrarEventoWhatsapp_('N/A', 'ENVIO_PENDENTE', 'Provider URL/token não configurado. Mensagem: ' + mensagem);
    return { ok: false, msg: 'Provider não configurado.' };
  }

  const payload = {
    to: String(telefone || ''),
    message: String(mensagem || '')
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    headers: {
      Authorization: 'Bearer ' + token
    },
    muteHttpExceptions: true
  };

  const res = UrlFetchApp.fetch(providerUrl, options);
  const code = res.getResponseCode();

  if (code < 200 || code >= 300) {
    registrarEventoWhatsapp_('N/A', 'ERRO_ENVIO', 'HTTP ' + code + ' => ' + res.getContentText());
    throw new Error('Falha no envio WhatsApp: HTTP ' + code);
  }

  return { ok: true, code: code };
}

function obterOuCriarAbaWhatsappPedidos_(ss) {
  let sh = ss.getSheetByName('WHATSAPP_PEDIDOS');
  if (!sh) {
    sh = ss.insertSheet('WHATSAPP_PEDIDOS');
    sh.appendRow(['ID_PEDIDO', 'CLIENTE', 'TELEFONE', 'ITENS', 'STATUS', 'ORIGEM', 'CRIADO_EM', 'ATUALIZADO_EM']);
  }
  return sh;
}

/**
 * BOT BÁSICO DE INTERAÇÃO NO WHATSAPP
 * Coleta intenção e cria um pré-pedido para conferência do usuário.
 */
function processarMensagemClienteWhatsapp(payload, signature) {
  validarSegurancaWebhook_(payload, signature);
  aplicarRateLimitWhatsapp_();

  const body = normalizarPayloadWhatsapp_(payload);
  const textoLivre = String((body && body.texto) || (payload && payload.texto) || '').trim();
  const telefone = String((body && body.clienteTelefone) || (payload && payload.clienteTelefone) || '').replace(/\D/g, '');

  if (!telefone) {
    throw new Error('Telefone do cliente é obrigatório para o bot.');
  }

  const resposta = gerarRespostaBotWhatsapp_(textoLivre);
  enviarMensagemWhatsapp_(telefone, resposta.mensagem);

  if (resposta.criarPrePedido) {
    const prePedido = criarPrePedidoWhatsapp_(telefone, textoLivre);
    registrarEventoWhatsapp_(prePedido.idPedido, 'PRE_PEDIDO_BOT', 'Pré-pedido gerado pelo bot e enviado para conferência interna.');
    return { ok: true, bot: true, idPedido: prePedido.idPedido, msg: 'Pré-pedido criado pelo bot.' };
  }

  return { ok: true, bot: true, msg: 'Mensagem processada pelo bot.' };
}

function gerarRespostaBotWhatsapp_(textoLivre) {
  const t = String(textoLivre || '').toLowerCase();

  if (!t) {
    return {
      criarPrePedido: false,
      mensagem: 'Olá! 👋 Me diga os itens e quantidades (ex.: 2 cervejas, 1 gelo) para eu montar seu pedido.'
    };
  }

  if (t.includes('pedido') || t.includes('quero') || t.includes('comprar')) {
    return {
      criarPrePedido: true,
      mensagem: 'Perfeito! ✅ Já anotei seu pedido e vou encaminhar para o atendente confirmar valores e entrega.'
    };
  }

  if (t.includes('fiado')) {
    return {
      criarPrePedido: false,
      mensagem: 'Para consulta de fiado, informe seu nome completo e CPF que o atendente vai te retornar em seguida.'
    };
  }

  return {
    criarPrePedido: false,
    mensagem: 'Recebi sua mensagem 👍 Se quiser comprar, escreva "quero fazer pedido" com itens e quantidades.'
  };
}

function criarPrePedidoWhatsapp_(telefone, textoLivre) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName('WHATSAPP_PRE_PEDIDOS');

  if (!sh) {
    sh = ss.insertSheet('WHATSAPP_PRE_PEDIDOS');
    sh.appendRow(['ID_PEDIDO', 'TELEFONE', 'MENSAGEM_CLIENTE', 'STATUS', 'CRIADO_EM']);
  }

  const idPedido = 'WPP-BOT-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  sh.appendRow([idPedido, telefone, textoLivre, 'AGUARDANDO_CONFERENCIA', new Date()]);

  registrarPrePedidoNoDelivery_(idPedido, telefone, textoLivre);

  return { idPedido: idPedido };
}

function registrarPrePedidoNoDelivery_(idPrePedido, telefone, textoLivre) {
  const ss = SpreadsheetApp.getActive();
  const deliverySh = ss.getSheetByName('DELIVERY');

  if (!deliverySh) {
    registrarEventoWhatsapp_(idPrePedido, 'ERRO_PRE_PEDIDO', 'Aba DELIVERY não encontrada para registrar pré-pedido.');
    return;
  }

  if (typeof garantirDeliveryItens === 'function') {
    garantirDeliveryItens();
  }

  const pedidoNumero = (typeof gerarNumeroDelivery === 'function')
    ? gerarNumeroDelivery()
    : (deliverySh.getLastRow() - 1) + 1;

  const clienteNome = 'WHATSAPP ' + telefone;
  const produtoPlaceholder = 'PEDIDO VIA WHATSAPP - CONFERIR ITENS';
  const observacao = String(textoLivre || '').slice(0, 500);

  deliverySh.appendRow([
    pedidoNumero,
    new Date(),
    clienteNome,
    produtoPlaceholder,
    1,
    0,
    '⚡ Pix',
    'PEDIDO FEITO',
    'BOT_WHATSAPP',
    idPrePedido
  ]);

  const itensSh = ss.getSheetByName('DELIVERY_ITENS');
  if (itensSh) {
    itensSh.appendRow([
      pedidoNumero,
      produtoPlaceholder + ' | ' + observacao,
      1,
      0,
      0,
      'NAO'
    ]);
  }

  registrarEventoWhatsapp_(
    idPrePedido,
    'PRE_PEDIDO_DELIVERY_CRIADO',
    'Pré-pedido registrado no DELIVERY como PEDIDO FEITO. Pedido #' + pedidoNumero
  );
}
