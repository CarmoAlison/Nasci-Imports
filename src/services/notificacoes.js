import { supabase } from './supabase';
import { unwrap } from '../utils/errors';

export async function listarNotificacoes(userId, limite = 50) {
  return unwrap(
    await supabase
      .from('notificacoes')
      .select('id, titulo, mensagem, tipo, link, lida, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limite),
  );
}

export async function contarNaoLidas(userId) {
  const { count, error } = await supabase
    .from('notificacoes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('lida', false);
  if (error) throw error;
  return count || 0;
}

export async function marcarNotificacaoLida(id) {
  return unwrap(await supabase.from('notificacoes').update({ lida: true }).eq('id', id));
}

export async function marcarTodasLidas(userId) {
  return unwrap(
    await supabase.from('notificacoes').update({ lida: true }).eq('user_id', userId).eq('lida', false),
  );
}

export async function excluirNotificacao(id) {
  return unwrap(await supabase.from('notificacoes').delete().eq('id', id));
}
