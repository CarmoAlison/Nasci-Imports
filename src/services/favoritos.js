import { supabase } from './supabase';
import { unwrap } from '../utils/errors';

export async function ehFavorito(userId, produtoId) {
  const dados = unwrap(
    await supabase
      .from('favoritos')
      .select('produto_id')
      .eq('user_id', userId)
      .eq('produto_id', produtoId)
      .maybeSingle(),
  );
  return Boolean(dados);
}

export async function adicionarFavorito(userId, produtoId) {
  return unwrap(
    await supabase.from('favoritos').upsert({ user_id: userId, produto_id: produtoId }, { ignoreDuplicates: true }),
  );
}

export async function removerFavorito(userId, produtoId) {
  return unwrap(await supabase.from('favoritos').delete().eq('user_id', userId).eq('produto_id', produtoId));
}

export async function listarFavoritos(userId) {
  const dados = unwrap(
    await supabase
      .from('favoritos')
      .select(
        'created_at, produto:produtos(id, nome, preco, estoque, ativo, categoria:categorias(id, nome, slug), imagens:produto_imagens(id, url, principal, ordem))',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
  );
  return (dados || []).map((f) => f.produto).filter(Boolean);
}
