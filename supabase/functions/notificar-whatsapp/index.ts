// Edge Function: notificar-whatsapp
// Chamada pelo trigger do banco (pg_net) a cada mudança de status do pedido.
// Também aceita o formato de "Database Webhook" do Supabase ({ type, record, old_record }).
//
// Segurança: exige o header x-webhook-secret igual ao secret WHATSAPP_WEBHOOK_SECRET.
// Falhas são registradas em public.whatsapp_logs e NUNCA bloqueiam a mudança de status
// (a chamada é assíncrona via pg_net).
//
// Deploy: supabase functions deploy notificar-whatsapp --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';
import { enviarStatusPedido } from './provider.ts';

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  indo_entrega: 'Indo pra entrega',
  enviado: 'Pedido enviado',
};

function normalizarTelefone(tel: string | null | undefined): string | null {
  const d = String(tel ?? '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length === 10 || d.length === 11) return `55${d}`; // adiciona DDI do Brasil
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) return d;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const segredo = Deno.env.get('WHATSAPP_WEBHOOK_SECRET');
  if (!segredo || req.headers.get('x-webhook-secret') !== segredo) {
    return json({ error: 'Não autorizado.' }, 401);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  let pedidoId: string | null = null;
  let status: string | null = null;

  try {
    const body = await req.json();

    if (body?.record) {
      // Formato Database Webhook
      if (body.old_record && body.old_record.status === body.record.status) {
        return json({ ok: true, ignorado: 'status não mudou' });
      }
      pedidoId = body.record.id;
      status = body.record.status;
    } else {
      pedidoId = body?.pedido_id ?? null;
      status = body?.status ?? null;
    }

    if (!pedidoId) return json({ error: 'pedido_id ausente.' }, 400);

    const { data: pedido, error } = await admin
      .from('pedidos')
      .select('id, numero, status, cliente_nome, cliente_telefone, cliente:profiles!pedidos_cliente_id_fkey(nome_completo, telefone)')
      .eq('id', pedidoId)
      .maybeSingle();

    if (error) throw error;
    if (!pedido) throw new Error('Pedido não encontrado.');

    const statusAtual = status ?? pedido.status;
    // deno-lint-ignore no-explicit-any
    const cliente = (pedido as any).cliente ?? {};
    const telefone = normalizarTelefone(cliente.telefone ?? pedido.cliente_telefone);
    const nome = String(cliente.nome_completo ?? pedido.cliente_nome ?? 'cliente').split(' ')[0];

    if (!telefone) {
      await admin.from('whatsapp_logs').insert({
        pedido_id: pedidoId,
        status_pedido: statusAtual,
        sucesso: false,
        erro: 'Cliente sem telefone válido cadastrado.',
      });
      return json({ ok: false, erro: 'telefone inválido' });
    }

    try {
      const resposta = await enviarStatusPedido({
        telefone,
        nomeCliente: nome,
        numeroPedido: String(pedido.numero),
        statusLabel: STATUS_LABEL[statusAtual] ?? statusAtual,
      });

      await admin.from('whatsapp_logs').insert({
        pedido_id: pedidoId,
        telefone,
        status_pedido: statusAtual,
        sucesso: true,
        resposta,
      });
      return json({ ok: true });
    } catch (envioErr) {
      const e = envioErr as Error & { resposta?: unknown };
      console.error('[notificar-whatsapp] falha no envio', e);
      await admin.from('whatsapp_logs').insert({
        pedido_id: pedidoId,
        telefone,
        status_pedido: statusAtual,
        sucesso: false,
        erro: e.message,
        resposta: e.resposta ?? null,
      });
      // 200 para o webhook não ficar tentando novamente; o erro está no log
      return json({ ok: false, erro: e.message });
    }
  } catch (e) {
    console.error('[notificar-whatsapp]', e);
    const msg = e instanceof Error ? e.message : 'Erro interno.';
    try {
      await admin.from('whatsapp_logs').insert({
        pedido_id: pedidoId,
        status_pedido: status,
        sucesso: false,
        erro: msg,
      });
    } catch (logErr) {
      console.error('[notificar-whatsapp] falha ao registrar log', logErr);
    }
    return json({ ok: false, erro: msg });
  }
});
