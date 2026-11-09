import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import ProductCard from '../../components/ProductCard';
import EmptyState from '../../components/EmptyState';
import { ProductCardSkeleton } from '../../components/Skeleton';
import { listarFavoritos, removerFavorito } from '../../services/favoritos';
import { traduzirErro } from '../../utils/errors';

export default function Favoritos() {
  const { user } = useAuth();
  const [produtos, setProdutos] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    listarFavoritos(user.id)
      .then((lista) => ativo && setProdutos(lista))
      .catch((e) => toast.error(traduzirErro(e)))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [user.id]);

  const remover = async (produtoId) => {
    const anterior = produtos;
    setProdutos((l) => l.filter((p) => p.id !== produtoId));
    try {
      await removerFavorito(user.id, produtoId);
      toast.success('Removido dos favoritos.');
    } catch (e) {
      setProdutos(anterior);
      toast.error(traduzirErro(e));
    }
  };

  return (
    <div className="stack">
      <h2>Favoritos</h2>
      {carregando ? (
        <div className="product-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : produtos.length === 0 ? (
        <EmptyState icone={Heart} titulo="Nenhum favorito ainda" descricao="Toque no coração na página do produto para salvá-lo aqui.">
          <Link to="/produtos" className="btn btn--primary">
            Ver produtos
          </Link>
        </EmptyState>
      ) : (
        <div className="product-grid">
          {produtos.map((p) => (
            <div key={p.id} className="favorito">
              <ProductCard produto={p} />
              <button
                type="button"
                className="icon-btn icon-btn--danger favorito__remover"
                onClick={() => remover(p.id)}
                aria-label={`Remover ${p.nome} dos favoritos`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
