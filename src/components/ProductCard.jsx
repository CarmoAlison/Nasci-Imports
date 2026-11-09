import { Link } from 'react-router-dom';
import { ShoppingCart, Star } from 'lucide-react';
import ProductImage from './ProductImage';
import { imagemPrincipal } from '../services/produtos';
import { formatarMoeda } from '../utils/format';
import { useCart } from '../hooks/useCart';

export default function ProductCard({ produto }) {
  const { adicionar } = useCart();
  const semEstoque = produto.estoque <= 0;
  const emDestaque = produto.destaque && !semEstoque;

  return (
    <article className={`product-card ${semEstoque ? 'is-sem-estoque' : ''} ${emDestaque ? 'product-card--destaque' : ''}`}>
      <Link to={`/produto/${produto.id}`} className="product-card__link" aria-label={`Ver ${produto.nome}`}>
        <div className="product-card__media">
          <ProductImage src={imagemPrincipal(produto.imagens)} alt={produto.nome} />
          {semEstoque && <span className="badge badge--danger product-card__tag">Sem estoque</span>}
          {emDestaque && (
            <span className="product-card__selo">
              <Star size={12} fill="currentColor" aria-hidden="true" /> Destaque
            </span>
          )}
        </div>
        <div className="product-card__body">
          {produto.categoria && <span className="product-card__categoria">{produto.categoria.nome}</span>}
          <h3 className="product-card__nome">{produto.nome}</h3>
          <strong className="product-card__preco">{formatarMoeda(produto.preco)}</strong>
        </div>
      </Link>
      <div className="product-card__acoes">
        <button
          type="button"
          className="btn btn--primary btn--sm btn--block"
          disabled={semEstoque}
          onClick={() => adicionar({ ...produto, ativo: true }, 1, { abrirDrawer: false })}
        >
          <ShoppingCart size={16} aria-hidden="true" />
          {semEstoque ? 'Indisponível' : 'Adicionar'}
        </button>
      </div>
    </article>
  );
}
