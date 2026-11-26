import { getSupabaseConfig } from './supabaseClient';

export interface EvolutionEmpresaConfig {
  url: string;
  instance: string;
  apiKey: string;
}

export function getWebhookBotPedidosUrl(empresaId: string, canal: 'evolution' | 'telegram'): string {
  const supa = getSupabaseConfig().url.replace(/\/+$/, '');
  return `${supa}/functions/v1/bot-pedidos?canal=${canal}&empresa_id=${encodeURIComponent(empresaId)}`;
}

export async function criarOuConectarInstanciaEvolution(
  cfg: EvolutionEmpresaConfig,
  empresaId: string
): Promise<{ ok: boolean; qrcodeBase64?: string; conectado?: boolean; msg: string }> {
  const baseUrl = cfg.url.trim().replace(/\/+$/, '');
  const instance = cfg.instance.trim();
  const apiKey = cfg.apiKey.trim();
  if (!baseUrl || !instance || !apiKey) {
    return { ok: false, msg: 'Informe URL da Evolution API, Nome da Instância e API Key.' };
  }

  const webhookUrl = getWebhookBotPedidosUrl(empresaId, 'evolution');

  try {
    // 1. Tenta criar instância (ignora se já existir)
    await fetch(`${baseUrl}/instance/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({
        instanceName: instance,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS'
      })
    }).catch(() => null);

    // 2. Configura webhook apontando para bot-pedidos (formato Evolution API v2)
    await fetch(`${baseUrl}/webhook/set/${encodeURIComponent(instance)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({
        webhook: {
          enabled: true,
          url: webhookUrl,
          byEvents: false,
          base64: false,
          events: ['MESSAGES_UPSERT']
        }
      })
    }).catch(() => null);

    // 3. Solicita QR Code ou status de conexão
    const connResp = await fetch(`${baseUrl}/instance/connect/${encodeURIComponent(instance)}`, {
      method: 'GET',
      headers: { apikey: apiKey }
    });
    const connJson = (await connResp.json().catch(() => ({}))) as {
      base64?: string;
      code?: string;
      instance?: { state?: string };
      message?: string;
    };

    if (connJson.instance?.state === 'open') {
      return { ok: true, conectado: true, msg: `WhatsApp (${instance}) já está conectado!` };
    }

    if (connJson.base64) {
      return {
        ok: true,
        qrcodeBase64: connJson.base64,
        msg: 'QR Code gerado! Abra o WhatsApp no celular → Dispositivos Conectados → Ler QR Code.'
      };
    }

    return {
      ok: connResp.ok,
      msg: connJson.message || 'Instância verificada. Caso não apareça o QR Code, confira se o servidor Evolution está online.'
    };
  } catch {
    return { ok: false, msg: 'Erro de rede ao conectar com a Evolution API.' };
  }
}

export async function enviarTesteWhatsAppEvolution(
  cfg: EvolutionEmpresaConfig,
  numeroDestino: string,
  nomeEmpresa: string
): Promise<{ ok: boolean; msg: string }> {
  const baseUrl = cfg.url.trim().replace(/\/+$/, '');
  const instance = cfg.instance.trim();
  const apiKey = cfg.apiKey.trim();
  const digits = numeroDestino.replace(/\D/g, '');
  if (!baseUrl || !instance || !apiKey || !digits) {
    return { ok: false, msg: 'Preencha os dados da Evolution API e um número de destino.' };
  }
  const numero = digits.startsWith('55') ? digits : `55${digits}`;

  try {
    const resp = await fetch(`${baseUrl}/message/sendText/${encodeURIComponent(instance)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify({
        number: numero,
        text: `✅ Teste de integração WhatsApp — ${nomeEmpresa} (MK Gestão de Negócios 360°)`
      })
    });
    if (!resp.ok) {
      return { ok: false, msg: `Evolution API retornou HTTP ${resp.status}.` };
    }
    return { ok: true, msg: 'Mensagem de teste enviada no WhatsApp com sucesso!' };
  } catch {
    return { ok: false, msg: 'Erro de rede ao enviar mensagem pela Evolution API.' };
  }
}

export async function registrarWebhookTelegramBotPedidos(
  botToken: string,
  empresaId: string
): Promise<{ ok: boolean; msg: string }> {
  const token = botToken.trim();
  if (!token) return { ok: false, msg: 'Informe o Bot Token do Telegram.' };
  const webhookUrl = getWebhookBotPedidosUrl(empresaId, 'telegram');
  try {
    const resp = await fetch(
      `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`
    );
    const data = (await resp.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    if (!resp.ok || !data.ok) {
      return { ok: false, msg: data.description || 'Não foi possível ativar o webhook no Telegram.' };
    }
    return { ok: true, msg: 'Bot de Pedidos Delivery ativado no Telegram!' };
  } catch {
    return { ok: false, msg: 'Erro de rede ao configurar webhook do Telegram.' };
  }
}
