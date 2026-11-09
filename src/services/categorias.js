import { supabase } from './supabase';
import { unwrap } from '../utils/errors';

export async function listarCategoriasAtivas() {
  return unwrap(
    await supabase
      .from('categorias')
      .select('id, nome, slug, descricao')
      .eq('ativo', true)
      .order('ordem')
      .order('nome'),
  );
}

export async function adminListarCategorias() {
  return unwrap(
    await supabase
      .from('categorias')
      .select('id, nome, slug, descricao, ordem, ativo, created_at, produtos(count)')
      .order('ordem')
      .order('nome'),
  );
}

export async function salvarCategoria(id, dados) {
  if (id) return unwrap(await supabase.from('categorias').update(dados).eq('id', id).select().single());
  return unwrap(await supabase.from('categorias').insert(dados).select().single());
}

export async function excluirCategoria(id) {
  return unwrap(await supabase.from('categorias').delete().eq('id', id));
}
