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
    WHATSAPP_RATE_LIMIT_PER_MIN: '30',
    WHATSAPP_ALLOW_UNSIGNED: 'NAO'
  };

  Object.keys(defaults).forEach(function(k) {
    if (props.getProperty(k) === null) {
      props.setProperty(k, defaults[k]);
    }
  });

  return { ok: true, msg: 'Configuração base do WhatsApp inicializada.' };
}

function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents) || '{}';
    const body = JSON.parse(raw);
    const action = String((body && body.action) || '').toUpperCase();
    const signature = String((e && e.parameter && e.parameter.signature) || '');

    let result;
    if (action === 'RECEBER_PEDIDO') {
      result = receberPedidoWhatsapp(body, signature);
    } else {
      result = processarMensagemClienteWhatsapp(body, signature);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, result: result }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message || String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
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

  const allowUnsigned = props.getProperty('WHATSAPP_ALLOW_UNSIGNED') === 'SIM';
  if (!signature && allowUnsigned) {
    return true;
  }

  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
  const bytes = Utilities.computeHmacSha256Signature(raw, secret);
  const digest = Utilities.base64Encode(bytes);
  if (String(signature || '') !== String(digest)) {
    throw new Error('Assinatura inválida do webhook.');
  }
}

function simularMensagemBotWhatsapp(telefone, texto) {
  const payload = {
    clienteTelefone: String(telefone || '').replace(/\D/g, ''),
    texto: String(texto || '')
  };

  const resposta = gerarRespostaBotWhatsapp_(payload.texto);
  let idPedido = '';

  if (resposta.criarPrePedido) {
    idPedido = criarPrePedidoWhatsapp_(payload.clienteTelefone, payload.texto).idPedido;
  }

  registrarEventoWhatsapp_(idPedido || 'N/A', 'SIMULACAO_BOT', 'Mensagem simulada no painel interno.');
  return {
    ok: true,
    msg: resposta.mensagem,
    criarPrePedido: resposta.criarPrePedido,
    idPedido: idPedido
  };
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

  const produtos = listarProdutosWhatsapp_();
  const estado = obterEstadoAtendimentoWhatsapp_(telefone);
  const texto = String(textoLivre || '').trim();
  const textoLower = texto.toLowerCase();

  if (!texto || ['oi', 'olá', 'ola', 'menu', 'cardapio', 'cardápio', 'iniciar', 'comecar', 'começar'].indexOf(textoLower) >= 0) {
    limparEstadoAtendimentoWhatsapp_(telefone);
    const novoEstado = { etapa: 'AGUARDANDO_ITENS', itens: [] };
    salvarEstadoAtendimentoWhatsapp_(telefone, novoEstado);

    const mensagemInicial = [
      'Olá! 👋 Sou o assistente do delivery.',
      'Envie os itens do pedido neste formato: *nome do produto x quantidade*',
      'Ex.: *Skol Lata x 6*',
      'Quando terminar, envie *finalizar*.',
      '',
      montarCardapioWhatsapp_(produtos)
    ].join('\n');

    enviarMensagemWhatsapp_(telefone, mensagemInicial);
    return { ok: true, bot: true, msg: 'Cardápio enviado.' };
  }

  if (textoLower === 'cancelar') {
    limparEstadoAtendimentoWhatsapp_(telefone);
    enviarMensagemWhatsapp_(telefone, 'Pedido cancelado. Se quiser iniciar novamente, envie *oi* ou *menu*.');
    return { ok: true, bot: true, msg: 'Atendimento cancelado.' };
  }

  if (!estado || estado.etapa !== 'AGUARDANDO_ITENS') {
    salvarEstadoAtendimentoWhatsapp_(telefone, { etapa: 'AGUARDANDO_ITENS', itens: [] });
  }

  const estadoAtual = obterEstadoAtendimentoWhatsapp_(telefone) || { etapa: 'AGUARDANDO_ITENS', itens: [] };
  const itensCarrinho = Array.isArray(estadoAtual.itens) ? estadoAtual.itens : [];

  if (textoLower === 'finalizar') {
    if (!itensCarrinho.length) {
      enviarMensagemWhatsapp_(telefone, 'Seu carrinho está vazio. Envie um item no formato *produto x quantidade*.');
      return { ok: true, bot: true, msg: 'Carrinho vazio.' };
    }

    const pedido = criarPedidoDeliveryWhatsapp_(telefone, itensCarrinho);
    limparEstadoAtendimentoWhatsapp_(telefone);

    const resumo = itensCarrinho
      .map(function(i) { return '- ' + i.produto + ' x ' + i.qtd + ' = R$ ' + Number(i.total).toFixed(2).replace('.', ','); })
      .join('\n');

    enviarMensagemWhatsapp_(telefone,
      '✅ Pedido criado com sucesso!\n' +
      'Nº do pedido: *' + pedido.pedido + '*\n\n' +
      'Resumo:\n' + resumo + '\n\n' +
      'Total: *R$ ' + Number(pedido.total).toFixed(2).replace('.', ',') + '*\n' +
      'Em breve nosso time confirma entrega e pagamento.'
    );

    registrarEventoWhatsapp_(pedido.idRef || String(pedido.pedido), 'PEDIDO_CRIADO_BOT', 'Pedido criado automaticamente no DELIVERY.');
    return { ok: true, bot: true, pedido: pedido.pedido, msg: 'Pedido criado no delivery.' };
  }

  const item = interpretarItemMensagemWhatsapp_(texto, produtos);
  if (!item) {
    enviarMensagemWhatsapp_(telefone,
      'Não consegui identificar o item. Envie no formato *produto x quantidade* (ex.: *Skol Lata x 6*).\n\n' +
      montarCardapioWhatsapp_(produtos)
    );
    return { ok: true, bot: true, msg: 'Mensagem não reconhecida.' };
  }

  const idx = itensCarrinho.findIndex(function(i) {
    return normalizarTextoWhatsapp_(i.produto) === normalizarTextoWhatsapp_(item.produto);
  });

  if (idx >= 0) {
    itensCarrinho[idx].qtd += item.qtd;
    itensCarrinho[idx].total = Number((itensCarrinho[idx].qtd * itensCarrinho[idx].unit).toFixed(2));
  } else {
    itensCarrinho.push(item);
  }

  salvarEstadoAtendimentoWhatsapp_(telefone, {
    etapa: 'AGUARDANDO_ITENS',
    itens: itensCarrinho
  });

  const subtotal = itensCarrinho.reduce(function(acc, i) { return acc + Number(i.total || 0); }, 0);
  enviarMensagemWhatsapp_(telefone,
    '✅ Item adicionado: *' + item.produto + ' x ' + item.qtd + '*\n' +
    'Subtotal atual: *R$ ' + subtotal.toFixed(2).replace('.', ',') + '*\n\n' +
    'Envie outro item ou *finalizar* para concluir.'
  );

  return { ok: true, bot: true, msg: 'Item adicionado ao carrinho.' };
}

function listarProdutosWhatsapp_() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('PRODUTOS');
  if (!sh || sh.getLastRow() < 2) return [];

  const dados = sh.getRange(2, 1, sh.getLastRow() - 1, 12).getValues();
  return dados
    .map(function(r) {
      return {
        nome: String(r[0] || '').trim(),
        preco: Number(r[4] || 0),
        estoque: Number(r[11] || 0)
      };
    })
    .filter(function(p) { return p.nome && p.preco > 0; });
}

function montarCardapioWhatsapp_(produtos) {
  if (!produtos || !produtos.length) {
    return 'No momento não consegui carregar o cardápio. Tente novamente em instantes.';
  }

  const lista = produtos.slice(0, 40).map(function(p) {
    return '• ' + p.nome + ' — R$ ' + Number(p.preco).toFixed(2).replace('.', ',');
  }).join('\n');

  return '📋 *Cardápio*\n' + lista;
}

function normalizarTextoWhatsapp_(txt) {
  return String(txt || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function interpretarItemMensagemWhatsapp_(texto, produtos) {
  const msg = String(texto || '').trim();
  if (!msg) return null;

  let qtd = 1;
  let nomeBase = msg;

  let m = msg.match(/(.+)\s*[xX]\s*(\d{1,3})$/);
  if (m) {
    nomeBase = String(m[1] || '').trim();
    qtd = Number(m[2] || 1);
  } else {
    m = msg.match(/^(\d{1,3})\s+(.+)$/);
    if (m) {
      qtd = Number(m[1] || 1);
      nomeBase = String(m[2] || '').trim();
    }
  }

  if (!qtd || qtd <= 0) return null;

  const baseNorm = normalizarTextoWhatsapp_(nomeBase);
  let produtoEscolhido = null;

  for (let i = 0; i < produtos.length; i++) {
    const pn = normalizarTextoWhatsapp_(produtos[i].nome);
    if (pn === baseNorm || pn.indexOf(baseNorm) >= 0 || baseNorm.indexOf(pn) >= 0) {
      produtoEscolhido = produtos[i];
      break;
    }
  }

  if (!produtoEscolhido) return null;

  const unit = Number(produtoEscolhido.preco || 0);
  return {
    produto: produtoEscolhido.nome,
    qtd: qtd,
    unit: unit,
    total: Number((qtd * unit).toFixed(2))
  };
}

function obterOuCriarAbaAtendimentoWhatsapp_(ss) {
  let sh = ss.getSheetByName('WHATSAPP_ATENDIMENTO');
  if (!sh) {
    sh = ss.insertSheet('WHATSAPP_ATENDIMENTO');
    sh.appendRow(['TELEFONE', 'ETAPA', 'ITENS_JSON', 'ATUALIZADO_EM']);
  }
  return sh;
}

function obterEstadoAtendimentoWhatsapp_(telefone) {
  const ss = SpreadsheetApp.getActive();
  const sh = obterOuCriarAbaAtendimentoWhatsapp_(ss);
  const dados = sh.getDataRange().getValues();

  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][0] || '') === String(telefone || '')) {
      let itens = [];
      try {
        itens = JSON.parse(String(dados[i][2] || '[]'));
      } catch (e) {
        itens = [];
      }
      return {
        etapa: String(dados[i][1] || 'AGUARDANDO_ITENS'),
        itens: Array.isArray(itens) ? itens : []
      };
    }
  }

  return null;
}

function salvarEstadoAtendimentoWhatsapp_(telefone, estado) {
  const ss = SpreadsheetApp.getActive();
  const sh = obterOuCriarAbaAtendimentoWhatsapp_(ss);
  const dados = sh.getDataRange().getValues();
  const etapa = String((estado && estado.etapa) || 'AGUARDANDO_ITENS');
  const itensJson = JSON.stringify((estado && estado.itens) || []);

  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][0] || '') === String(telefone || '')) {
      sh.getRange(i + 1, 2, 1, 3).setValues([[etapa, itensJson, new Date()]]);
      return true;
    }
  }

  sh.appendRow([telefone, etapa, itensJson, new Date()]);
  return true;
}

  registrarPrePedidoNoDelivery_(idPedido, telefone, textoLivre);

  for (let i = dados.length - 1; i >= 1; i--) {
    if (String(dados[i][0] || '') === String(telefone || '')) {
      sh.deleteRow(i + 1);
    }
  }
}

function criarPedidoDeliveryWhatsapp_(telefone, itensCarrinho) {
  const ss = SpreadsheetApp.getActive();
  const deliverySh = ss.getSheetByName('DELIVERY');

  if (!deliverySh) {
    throw new Error('Aba DELIVERY não encontrada.');
  }

  if (typeof garantirDeliveryItens === 'function') {
    garantirDeliveryItens();
  }

  let pedidoNumero = (deliverySh.getLastRow() - 1) + 1;
  if (typeof gerarNumeroDelivery === 'function') {
    pedidoNumero = gerarNumeroDelivery();
  }

  const total = itensCarrinho.reduce(function(acc, i) {
    return acc + (Number(i.qtd || 0) * Number(i.unit || 0));
  }, 0);

  const idRef = 'WPP-BOT-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');

  deliverySh.appendRow([
    pedidoNumero,
    new Date(),
    'WHATSAPP ' + telefone,
    'VER ITENS',
    itensCarrinho.length,
    Number(total.toFixed(2)),
    '⚡ Pix',
    'PEDIDO FEITO',
    'WHATSAPP_BOT',
    idRef
  ]);

  const itensSh = ss.getSheetByName('DELIVERY_ITENS');
  if (itensSh) {
    itensCarrinho.forEach(function(i) {
      const linha = [
        pedidoNumero,
        i.produto,
        Number(i.qtd || 0),
        Number(i.unit || 0),
        Number((Number(i.qtd || 0) * Number(i.unit || 0)).toFixed(2)),
        'NAO'
      ];

      if (typeof inserirLinhaNoTopo === 'function') {
        inserirLinhaNoTopo('DELIVERY_ITENS', linha);
      } else {
        itensSh.appendRow(linha);
      }
    });
  }

  return {
    pedido: pedidoNumero,
    total: Number(total.toFixed(2)),
    idRef: idRef
  };
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
