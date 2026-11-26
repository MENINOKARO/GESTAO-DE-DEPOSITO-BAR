const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'MK Gestão 360° <onboarding@resend.dev>';
    if (!resendKey) {
      return new Response(
        JSON.stringify({ ok: false, msg: 'RESEND_API_KEY não configurada nos Secrets do Supabase.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      to?: string;
      subject?: string;
      html?: string;
    };

    const to = String(body.to || '').trim();
    const subject = String(body.subject || 'MK Gestão de Negócios 360°').trim();
    const html = String(body.html || '').trim();

    if (!to || !html) {
      return new Response(
        JSON.stringify({ ok: false, msg: 'Informe destinatário (to) e conteúdo (html).' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject,
        html
      })
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      return new Response(
        JSON.stringify({ ok: false, msg: (data as { message?: string }).message || 'Erro ao enviar e-mail via Resend.' }),
        { status: resp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ ok: true, id: (data as { id?: string }).id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, msg: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
