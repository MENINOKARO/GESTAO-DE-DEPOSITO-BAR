import type { Empresa } from '../types/domain';
import { formatarDataHoraBr } from '../utils/formatters';

/**
 * Serviço de notificações ativas para o Telegram da unidade.
 * Nunca registra tokens em console.
 */
export async function enviarMensagemTelegram(
  empresa: Pick<Empresa, 'telegram_bot_token' | 'telegram_chat_id'>,
  textoHtml: string
): Promise<{ ok: boolean; msg: string }> {
  const token = String(empresa.telegram_bot_token || '').trim();
  const chatId = String(empresa.telegram_chat_id || '').trim();

  if (!token || !chatId) {
    return { ok: false, msg: 'Telegram não configurado.' };
  }

  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: textoHtml,
        parse_mode: 'HTML'
      })
    });

    const data = (await resp.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
    if (!resp.ok || !data?.ok) {
      return {
        ok: false,
        msg: data?.description
          ? `Telegram recusou o envio: ${data.description}`
          : `Falha ao enviar mensagem ao Telegram (HTTP ${resp.status}).`
      };
    }

    return { ok: true, msg: 'Mensagem enviada ao Telegram com sucesso!' };
  } catch {
    return {
      ok: false,
      msg: 'Erro de rede ao conectar com api.telegram.org. Verifique sua conexão.'
    };
  }
}

export async function testarTelegramEmpresa(
  empresa: Pick<Empresa, 'nome' | 'telegram_bot_token' | 'telegram_chat_id'>
): Promise<{ ok: boolean; msg: string }> {
  const agora = formatarDataHoraBr(new Date().toISOString());
  const texto =
    `✅ <b>Teste de Integração — ${empresa.nome || 'Gestão de Negócios 360°'}</b>\n` +
    `Conexão com o novo painel SaaS validada em ${agora}.`;
  return enviarMensagemTelegram(empresa, texto);
}

export async function obterInfoBotTelegram(
  botToken: string
): Promise<{ ok: boolean; username?: string; firstName?: string; msg?: string }> {
  const token = String(botToken || '').trim();
  if (!token) return { ok: false, msg: 'Informe o Token do Bot Telegram.' };
  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = (await resp.json().catch(() => null)) as {
      ok?: boolean;
      result?: { username?: string; first_name?: string };
      description?: string;
    } | null;
    if (!resp.ok || !data?.ok || !data.result?.username) {
      return { ok: false, msg: data?.description || 'Token inválido ou bot não encontrado.' };
    }
    return {
      ok: true,
      username: data.result.username,
      firstName: data.result.first_name
    };
  } catch {
    return { ok: false, msg: 'Erro de rede ao consultar o Telegram.' };
  }
}

export async function detectarChatIdTelegram(
  botToken: string
): Promise<{ ok: boolean; chatId?: string; nome?: string; msg: string }> {
  const token = String(botToken || '').trim();
  if (!token) return { ok: false, msg: 'Informe o Token do Bot Telegram primeiro.' };
  try {
    const resp = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=25`);
    const data = (await resp.json().catch(() => null)) as {
      ok?: boolean;
      result?: Array<{
        message?: {
          chat?: { id?: number | string; first_name?: string; title?: string; username?: string };
          text?: string;
        };
      }>;
      description?: string;
    } | null;

    if (!resp.ok || !data?.ok) {
      return { ok: false, msg: data?.description || 'Não foi possível consultar atualizações do Bot.' };
    }

    const lista = Array.isArray(data.result) ? data.result : [];
    for (let i = lista.length - 1; i >= 0; i--) {
      const chat = lista[i]?.message?.chat;
      if (chat?.id !== undefined && chat?.id !== null) {
        const chatId = String(chat.id);
        const nome = chat.title || chat.first_name || chat.username || chatId;
        return {
          ok: true,
          chatId,
          nome,
          msg: `Chat ID ${chatId} (${nome}) detectado automaticamente!`
        };
      }
    }

    return {
      ok: false,
      msg: 'Nenhuma mensagem encontrada ainda. Leia o QR Code (ou abra o Bot), aperte "Começar" e clique novamente.'
    };
  } catch {
    return { ok: false, msg: 'Erro de rede ao consultar api.telegram.org.' };
  }
}
