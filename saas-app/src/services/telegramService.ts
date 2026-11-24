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
