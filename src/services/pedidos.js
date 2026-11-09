import { supabase } from './supabase';
import { unwrap } from '../utils/errors';

const CAMPOS_DETALHE =
  '*, itens:pedido_itens(id, produto_id, produto_nome, produto_imagem, preco_unitario, quantidade, subtotal), historico:pedido_status_historico(id, status_anterior, status_novo, created_at)';

export async function finalizarPedido(observacoes) {
  return unwrap(await supabase.rpc('finalizar_pedido', { p_observacoes: observacoes || null }));
}

export async function listarMeusPedidos(userId) {
  return unwrap(
    await supabase
      .from('pedidos')
      .select('id, numero, status, total, created_at, itens:pedido_itens(id, produto_nome, produto_imagem, quantidade, preco_unitario)')
      .eq('cliente_id', userId)
      .order('created_at', { ascending: false }),
  );
}

export async function buscarPedido(id) {
  const pedido = unwrap(await supabase.from('pedidos').select(CAMPOS_DETALHE).eq('id', id).maybeSingle());
  if (pedido?.historico) {
    pedido.historico.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }
  return pedido;
}

/** Contagem de mensagens da equipe não lidas por pedido (para o cliente) */
export async function contarNaoLidasPorPedido(userId) {
  const dados = unwrap(
    await supabase
      .from('mensagens')
      .select('pedido_id')
      .eq('cliente_id', userId)
      .eq('remetente_equipe', true)
      .eq('lida', false),
  );
  const mapa = {};
  for (const m of dados || []) {
    const chave = m.pedido_id || 'geral';
    mapa[chave] = (mapa[chave] || 0) + 1;
  }
  return mapa;
}

// ------------------------------------------------------------------ ADMIN

export async function adminListarPedidos({ busca = '', status = '', dataInicio = '', dataFim = '', pagina = 1, porPagina = 20 }) {
  let q = supabase
    .from('pedidos')
    .select('id, numero, status, total, cliente_nome, cliente_email, cliente_telefone, created_at, itens:pedido_itens(count)', {
      count: 'exact',
    });

  const termo = String(busca).replace(/[,()*%\\]/g, ' ').trim();
  if (termo) {
    const numero = termo.replace(/\D/g, '');
    if (numero && numero === termo.replace(/^#/, '')) q = q.eq('numero', Number(numero));
    else q = q.or(`cliente_nome.ilike.%${termo}%,cliente_email.ilike.%${termo}%`);
  }
  if (status) q = q.eq('status', status);
  if (dataInicio) q = q.gte('created_at', new Date(`${dataInicio}T00:00:00`).toISOString());
  if (dataFim) q = q.lte('created_at', new Date(`${dataFim}T23:59:59.999`).toISOString());

  const inicio = (pagina - 1) * porPagina;
  const { data, error, count } = await q
    .order('created_at', { ascending: false })
    .range(inicio, inicio + porPagina - 1);
  if (error) throw error;
  return { pedidos: data || [], total: count || 0 };
}

export async function alterarStatusPedido(id, status) {
  return unwrap(await supabase.from('pedidos').update({ status }).eq('id', id).select('id, status').single());
}
