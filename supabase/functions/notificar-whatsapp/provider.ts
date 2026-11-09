// =====================================================================
// Provedor de WhatsApp — ÚNICO arquivo que conhece a API externa.
// Para trocar de provedor (Z-API, Twilio, Evolution API...), reescreva
// apenas a função `enviarStatusPedido` mantendo a mesma assinatura.
//
// Implementação padrão: WhatsApp Cloud API (Meta) com mensagem de modelo
// (template), obrigatória para iniciar conversas com o cliente.
//
// Secrets necessários (supabase secrets set ...):
//   WHATSAPP_TOKEN            token permanente (System User) da Meta
//   WHATSAPP_PHONE_NUMBER_ID  ID do número remetente
//   WHATSAPP_TEMPLATE_NAME    nome do modelo aprovado (padrão: status_pedido)
//   WHATSAPP_TEMPLATE_LANG    idioma do modelo (padrão: pt_BR)
//   WHATSAPP_GRAPH_VERSION    versão da Graph API (padrão: v21.0)
//
// Modelo esperado (categoria "Utilidade"), com 3 variáveis no corpo:
//   Olá {{1}}! O status do seu pedido #{{2}} na Nasci Imports foi
//   atualizado para: *{{3}}*. Qualquer dúvida, fale com a gente pelo site.
// =====================================================================

export interface DadosStatusPedido {
  telefone: string;      // somente dígitos, com DDI (ex.: 5511999998888)
  nomeCliente: string;
  numeroPedido: string;
  statusLabel: string;
}

export async function enviarStatusPedido(dados: DadosStatusPedido): Promise<unknown> {
  const token = Deno.env.get('WHATSAPP_TOKEN');
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  const template = Deno.env.get('WHATSAPP_TEMPLATE_NAME') ?? 'status_pedido';
  const lang = Deno.env.get('WHATSAPP_TEMPLATE_LANG') ?? 'pt_BR';
  const version = Deno.env.get('WHATSAPP_GRAPH_VERSION') ?? 'v21.0';

  if (!token || !phoneNumberId) {
    throw new Error('WhatsApp não configurado: defina WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID.');
  }

  const resposta = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: dados.telefone,
      type: 'template',
      template: {
        name: template,
        language: { code: lang },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: dados.nomeCliente },
              { type: 'text', text: dados.numeroPedido },
              { type: 'text', text: dados.statusLabel },
            ],
          },
        ],
      },
    }),
  });

  const corpo = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    const msg = (corpo as { error?: { message?: string } })?.error?.message;
    throw Object.assign(new Error(msg ?? `HTTP ${resposta.status}`), { resposta: corpo });
  }
  return corpo;
}
