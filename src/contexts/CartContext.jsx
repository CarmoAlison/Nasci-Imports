import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import * as carrinho from '../services/carrinho';
import { traduzirErro } from '../utils/errors';

export const CartContext = createContext(null);

/**
 * Carrinho:
 *  - visitante → localStorage
 *  - logado    → banco (carrinho_itens). Ao entrar, o carrinho local é mesclado ao do banco.
 */
export function CartProvider({ children }) {
  const { user, carregando: authCarregando } = useAuth();
  const userId = user?.id ?? null;

  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [drawerAberto, setDrawerAberto] = useState(false);
  const [atualizando, setAtualizando] = useState(null); // produto_id em atualização
  const itensRef = useRef(itens);
  useEffect(() => {
    itensRef.current = itens;
  }, [itens]);

  const carregar = useCallback(async () => {
    try {
      if (userId) {
        setItens(await carrinho.listarItensBanco());
      } else {
        const locais = carrinho.lerCarrinhoLocal();
        const hidratados = locais.length ? await carrinho.hidratarItensLocais(locais) : [];
        carrinho.salvarCarrinhoLocal(hidratados);
        setItens(hidratados);
      }
    } catch (e) {
      console.error(e);
      toast.error(`Carrinho: ${traduzirErro(e)}`);
    } finally {
      setCarregando(false);
    }
  }, [userId]);

  // Carrega (e mescla) quando o usuário muda
  useEffect(() => {
    if (authCarregando) return;
    let ativo = true;
    (async () => {
      setCarregando(true);
      if (userId) {
        const locais = carrinho.lerCarrinhoLocal();
        if (locais.length) {
          try {
            await carrinho.mesclarCarrinho(locais);
            carrinho.limparCarrinhoLocal();
            toast.success('Os itens do seu carrinho foram salvos na sua conta.');
          } catch (e) {
            toast.error(`Não foi possível mesclar o carrinho: ${traduzirErro(e)}`);
          }
        }
      }
      if (ativo) await carregar();
    })();
    return () => {
      ativo = false;
    };
  }, [authCarregando, userId, carregar]);

  /** Define a quantidade de um produto (0 remove) respeitando o estoque */
  const definirQuantidade = useCallback(
    async (produto, quantidade) => {
      const alvo = Math.max(0, Math.min(Number(quantidade) || 0, produto.estoque));
      const anteriores = itensRef.current;

      const aplicar = (lista, qtd) => {
        if (qtd <= 0) return lista.filter((i) => i.produto_id !== produto.id);
        const existe = lista.some((i) => i.produto_id === produto.id);
        if (existe) return lista.map((i) => (i.produto_id === produto.id ? { ...i, quantidade: qtd } : i));
        return [...lista, { produto_id: produto.id, quantidade: qtd, produto: carrinho.produtoParaCarrinho(produto) }];
      };

      // atualização otimista
      setItens(aplicar(anteriores, alvo));

      if (!userId) {
        carrinho.salvarCarrinhoLocal(aplicar(anteriores, alvo));
        return alvo;
      }

      setAtualizando(produto.id);
      try {
        const final = await carrinho.definirQuantidadeBanco(produto.id, alvo);
        if (final !== alvo) {
          setItens((atual) => aplicar(atual, final));
          if (final < alvo) toast(`Quantidade ajustada ao estoque disponível (${final}).`, { icon: 'ℹ️' });
        }
        return final;
      } catch (e) {
        setItens(anteriores);
        toast.error(traduzirErro(e));
        return null;
      } finally {
        setAtualizando(null);
      }
    },
    [userId],
  );

  const adicionar = useCallback(
    async (produto, quantidade = 1, { abrirDrawer = true } = {}) => {
      if (!produto?.ativo || produto.estoque <= 0) {
        toast.error('Produto sem estoque.');
        return;
      }
      const atual = itensRef.current.find((i) => i.produto_id === produto.id)?.quantidade || 0;
      if (atual >= produto.estoque) {
        toast.error(`Você já tem a quantidade máxima disponível (${produto.estoque}).`);
        if (abrirDrawer) setDrawerAberto(true);
        return;
      }
      const final = await definirQuantidade(produto, atual + quantidade);
      if (final !== null && final > atual) {
        toast.success('Produto adicionado ao carrinho!');
        if (abrirDrawer) setDrawerAberto(true);
      }
    },
    [definirQuantidade],
  );

  const remover = useCallback(
    async (produto) => {
      await definirQuantidade(produto, 0);
      toast.success('Item removido do carrinho.');
    },
    [definirQuantidade],
  );

  const valor = useMemo(() => {
    const total = itens.reduce((s, i) => s + i.produto.preco * i.quantidade, 0);
    const quantidadeTotal = itens.reduce((s, i) => s + i.quantidade, 0);
    return {
      itens,
      total,
      quantidadeTotal,
      carregando,
      atualizando,
      drawerAberto,
      abrirDrawer: () => setDrawerAberto(true),
      fecharDrawer: () => setDrawerAberto(false),
      adicionar,
      definirQuantidade,
      remover,
      recarregar: carregar,
    };
  }, [itens, carregando, atualizando, drawerAberto, adicionar, definirQuantidade, remover, carregar]);

  return <CartContext.Provider value={valor}>{children}</CartContext.Provider>;
}
