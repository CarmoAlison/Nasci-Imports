import { supabase } from './supabase';
import { unwrap } from '../utils/errors';
import { PRODUTOS_POR_PAGINA } from '../utils/constants';

const CAMPOS_CARD =
  'id, nome, preco, estoque, ativo, destaque, created_at, categoria:categorias(id, nome, slug), imagens:produto_imagens(id, url, principal, ordem)';

/** Remove caracteres que quebram a sintaxe de filtro do PostgREST */
const limparBusca = (s) => String(s || '').replace(/[,()*%\\]/g, ' ').trim();

export function imagemPrincipal(imagens) {
  if (!imagens?.length) return null;
  const ordenadas = ordenarImagens(imagens);
  return ordenadas[0].url;
}

export function ordenarImagens(imagens) {
  return [...(imagens || [])].sort((a, b) => {
    if (a.principal !== b.principal) return a.principal ? -1 : 1;
    return (a.ordem ?? 0) - (b.ordem ?? 0);
  });
}

/** Listagem pública com busca, filtros, ordenação e paginação */
export async function listarProdutos({
  busca = '',
  categoria = '',
  precoMin = '',
  precoMax = '',
  ordem = 'recentes',
  pagina = 1,
  porPagina = PRODUTOS_POR_PAGINA,
  somenteDestaques = false,
} = {}) {
  const campos = categoria
    ? CAMPOS_CARD.replace('categoria:categorias(', 'categoria:categorias!inner(')
    : CAMPOS_CARD;

  let q = supabase.from('produtos').select(campos, { count: 'exact' }).eq('ativo', true);

  const termo = limparBusca(busca);
  if (termo) q = q.or(`nome.ilike.%${termo}%,descricao.ilike.%${termo}%`);
  if (categoria) q = q.eq('categoria.slug', categoria);
  if (somenteDestaques) q = q.eq('destaque', true);
  if (precoMin !== '' && !Number.isNaN(Number(precoMin))) q = q.gte('preco', Number(precoMin));
  if (precoMax !== '' && !Number.isNaN(Number(precoMax))) q = q.lte('preco', Number(precoMax));

  if (ordem === 'menor_preco') q = q.order('preco', { ascending: true });
  else if (ordem === 'maior_preco') q = q.order('preco', { ascending: false });
  else q = q.order('created_at', { ascending: false });

  const inicio = (pagina - 1) * porPagina;
  q = q.range(inicio, inicio + porPagina - 1);

  const { data, error, count } = await q;
  if (error) throw error;
  return { produtos: data || [], total: count || 0 };
}

export async function listarDestaques(limite = 8) {
  return unwrap(
    await supabase
      .from('produtos')
      .select(CAMPOS_CARD)
      .eq('ativo', true)
      .eq('destaque', true)
      .order('created_at', { ascending: false })
      .limit(limite),
  );
}

export async function listarRecentes(limite = 8) {
  return unwrap(
    await supabase
      .from('produtos')
      .select(CAMPOS_CARD)
      .eq('ativo', true)
      .order('created_at', { ascending: false })
      .limit(limite),
  );
}

export async function buscarProduto(id) {
  return unwrap(
    await supabase
      .from('produtos')
      .select(
        'id, nome, descricao, especificacoes, preco, estoque, ativo, categoria:categorias(id, nome, slug), imagens:produto_imagens(id, url, principal, ordem)',
      )
      .eq('id', id)
      .maybeSingle(),
  );
}

export async function buscarProdutosPorIds(ids) {
  if (!ids.length) return [];
  return unwrap(await supabase.from('produtos').select(CAMPOS_CARD).in('id', ids));
}

// ------------------------------------------------------------------ ADMIN

export async function adminListarProdutos({ busca = '', categoriaId = '', status = '', pagina = 1, porPagina = 20 }) {
  let q = supabase
    .from('produtos')
    .select(
      'id, nome, preco, estoque, estoque_minimo, ativo, destaque, created_at, categoria:categorias(id, nome), imagens:produto_imagens(id, url, principal, ordem)',
      { count: 'exact' },
    );
  const termo = limparBusca(busca);
  if (termo) q = q.ilike('nome', `%${termo}%`);
  if (categoriaId) q = q.eq('categoria_id', categoriaId);
  if (status === 'ativos') q = q.eq('ativo', true);
  if (status === 'inativos') q = q.eq('ativo', false);
  const inicio = (pagina - 1) * porPagina;
  const { data, error, count } = await q
    .order('created_at', { ascending: false })
    .range(inicio, inicio + porPagina - 1);
  if (error) throw error;
  return { produtos: data || [], total: count || 0 };
}

export async function adminBuscarProduto(id) {
  return unwrap(
    await supabase
      .from('produtos')
      .select('*, imagens:produto_imagens(id, url, storage_path, principal, ordem)')
      .eq('id', id)
      .single(),
  );
}

export async function criarProduto(dados) {
  return unwrap(await supabase.from('produtos').insert(dados).select('id').single());
}

export async function atualizarProduto(id, dados) {
  // estoque só é alterado pela página de Estoque
  const { estoque: _ignorado, ...resto } = dados;
  return unwrap(await supabase.from('produtos').update(resto).eq('id', id).select('id').single());
}

export async function excluirProduto(id) {
  const imagens = unwrap(
    await supabase.from('produto_imagens').select('storage_path').eq('produto_id', id),
  );
  unwrap(await supabase.from('produtos').delete().eq('id', id));
  const paths = (imagens || []).map((i) => i.storage_path).filter(Boolean);
  if (paths.length) await supabase.storage.from('produtos').remove(paths);
}

// ------------------------------------------------------------- IMAGENS

export async function enviarImagensProduto(produtoId, arquivos, ordemInicial, temPrincipal) {
  const enviadas = [];
  let ordem = ordemInicial;
  for (const arquivo of arquivos) {
    const ext = (arquivo.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${produtoId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('produtos')
      .upload(path, arquivo, { cacheControl: '31536000', contentType: arquivo.type });
    if (upErr) throw upErr;
    const { data: pub } = supabase.storage.from('produtos').getPublicUrl(path);
    const principal = !temPrincipal && enviadas.length === 0;
    const registro = unwrap(
      await supabase
        .from('produto_imagens')
        .insert({ produto_id: produtoId, url: pub.publicUrl, storage_path: path, ordem: ordem++, principal })
        .select('id, url, storage_path, principal, ordem')
        .single(),
    );
    enviadas.push(registro);
  }
  return enviadas;
}

export async function definirImagemPrincipal(produtoId, imagemId) {
  // primeiro remove a principal atual (índice único parcial), depois define a nova
  unwrap(
    await supabase.from('produto_imagens').update({ principal: false }).eq('produto_id', produtoId).eq('principal', true),
  );
  unwrap(await supabase.from('produto_imagens').update({ principal: true }).eq('id', imagemId));
}

export async function reordenarImagens(imagens) {
  for (let i = 0; i < imagens.length; i++) {
    unwrap(await supabase.from('produto_imagens').update({ ordem: i }).eq('id', imagens[i].id));
  }
}

export async function excluirImagem(imagem) {
  unwrap(await supabase.from('produto_imagens').delete().eq('id', imagem.id));
  if (imagem.storage_path) await supabase.storage.from('produtos').remove([imagem.storage_path]);
}
