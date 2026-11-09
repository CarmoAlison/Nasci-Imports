// Carrinho: visitante usa localStorage; cliente logado usa o banco.
import { supabase } from './supabase';
import { unwrap } from '../utils/errors';
import { CARRINHO_STORAGE_KEY } from '../utils/constants';
import { buscarProdutosPorIds, imagemPrincipal } from './produtos';

// ------------------------------------------------------------ localStorage

export function lerCarrinhoLocal() {
  try {
    const bruto = JSON.parse(localStorage.getItem(CARRINHO_STORAGE_KEY) || '[]');
    return Array.isArray(bruto)
      ? bruto.filter((i) => i && i.produto_id && Number(i.quantidade) > 0)
      : [];
  } catch {
    return [];
  }
}

export function salvarCarrinhoLocal(itens) {
  try {
    const simples = itens.map((i) => ({ produto_id: i.produto_id, quantidade: i.quantidade }));
    localStorage.setItem(CARRINHO_STORAGE_KEY, JSON.stringify(simples));
  } catch {
    // localStorage indisponível (modo privado): carrinho fica só em memória
  }
}

export function limparCarrinhoLocal() {
  try {
    localStorage.removeItem(CARRINHO_STORAGE_KEY);
  } catch {
    // ignora
  }
}

/** Normaliza o produto para o formato usado no carrinho */
export function produtoParaCarrinho(p) {
  return {
    id: p.id,
    nome: p.nome,
    preco: Number(p.preco),
    estoque: p.estoque,
    ativo: p.ativo,
    imagem: p.imagem ?? imagemPrincipal(p.imagens),
  };
}

/** Busca os dados atuais dos produtos do carrinho local (preço/estoque atualizados) */
export async function hidratarItensLocais(locais) {
  const produtos = await buscarProdutosPorIds(locais.map((i) => i.produto_id));
  const mapa = new Map(produtos.map((p) => [p.id, p]));
  return locais
    .filter((i) => mapa.get(i.produto_id)?.ativo && mapa.get(i.produto_id).estoque > 0)
    .map((i) => {
      const p = mapa.get(i.produto_id);
      return {
        produto_id: i.produto_id,
        quantidade: Math.min(i.quantidade, p.estoque),
        produto: produtoParaCarrinho(p),
      };
    });
}

// ------------------------------------------------------------------ banco

export async function listarItensBanco() {
  const carrinhoId = unwrap(await supabase.rpc('carrinho_obter_id'));
  const dados = unwrap(
    await supabase
      .from('carrinho_itens')
      .select(
        'produto_id, quantidade, produto:produtos(id, nome, preco, estoque, ativo, imagens:produto_imagens(url, principal, ordem))',
      )
      .eq('carrinho_id', carrinhoId)
      .order('created_at'),
  );
  return (dados || [])
    .filter((i) => i.produto)
    .map((i) => ({
      produto_id: i.produto_id,
      quantidade: i.quantidade,
      produto: produtoParaCarrinho(i.produto),
    }));
}

/** Define a quantidade no banco (0 remove). Retorna a quantidade final aceita. */
export async function definirQuantidadeBanco(produtoId, quantidade) {
  return unwrap(
    await supabase.rpc('carrinho_definir_quantidade', {
      p_produto_id: produtoId,
      p_quantidade: quantidade,
    }),
  );
}

export async function mesclarCarrinho(itensLocais) {
  return unwrap(
    await supabase.rpc('carrinho_mesclar', {
      p_itens: itensLocais.map((i) => ({ produto_id: i.produto_id, quantidade: i.quantidade })),
    }),
  );
}

export async function limparCarrinhoBanco() {
  return unwrap(await supabase.rpc('carrinho_limpar'));
}
