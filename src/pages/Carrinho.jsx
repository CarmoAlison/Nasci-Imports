import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Trash2 } from 'lucide-react';
import { useCart } from '../hooks/useCart';
import { useAuth } from '../hooks/useAuth';
import QuantitySelector from '../components/QuantitySelector';
import ProductImage from '../components/ProductImage';
import EmptyState from '../components/EmptyState';
import { LinhasSkeleton } from '../components/Skeleton';
import { formatarMoeda } from '../utils/format';

export default function Carrinho() {
  const { itens, total, quantidadeTotal, carregando, definirQuantidade, remover, atualizando } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const finalizar = () => {
    // visitante é levado ao login e volta para o carrinho depois
    if (!user) navigate('/login', { state: { from: '/carrinho' } });
    else navigate('/checkout');
  };

  return (
    <div className="container pagina-carrinho">
      <h1>Carrinho</h1>

      {carregando ? (
        <LinhasSkeleton linhas={3} />
      ) : itens.length === 0 ? (
        <EmptyState icone={ShoppingBag} titulo="Seu carrinho está vazio" descricao="Explore nossos produtos e adicione seus favoritos.">
          <Link to="/produtos" className="btn btn--primary">
            Ver produtos
          </Link>
        </EmptyState>
      ) : (
        <div className="carrinho__grid">
          <ul className="cart-list card">
            {itens.map((item) => (
              <li key={item.produto_id} className="cart-item">
                <Link to={`/produto/${item.produto_id}`} className="cart-item__img">
                  <ProductImage src={item.produto.imagem} alt={item.produto.nome} />
                </Link>
                <div className="cart-item__info">
                  <Link to={`/produto/${item.produto_id}`} className="cart-item__nome">
                    {item.produto.nome}
                  </Link>
                  <span className="cart-item__preco">{formatarMoeda(item.produto.preco)} cada</span>
                  <div className="cart-item__linha">
                    <QuantitySelector
                      tamanho="sm"
                      valor={item.quantidade}
                      max={item.produto.estoque}
                      desabilitado={atualizando === item.produto_id}
                      aoMudar={(q) => definirQuantidade(item.produto, q)}
                    />
                    <button
                      type="button"
                      className="icon-btn icon-btn--danger"
                      onClick={() => remover(item.produto)}
                      aria-label={`Remover ${item.produto.nome}`}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  {item.quantidade >= item.produto.estoque && (
                    <small className="texto-aviso">Máximo em estoque: {item.produto.estoque}</small>
                  )}
                </div>
                <strong className="cart-item__subtotal">{formatarMoeda(item.produto.preco * item.quantidade)}</strong>
              </li>
            ))}
          </ul>

          <aside className="card resumo">
            <h2>Resumo</h2>
            <div className="resumo__linha">
              <span>Itens</span>
              <span>{quantidadeTotal}</span>
            </div>
            <div className="resumo__linha resumo__total">
              <span>Total</span>
              <strong>{formatarMoeda(total)}</strong>
            </div>
            <p className="texto-suave texto-pequeno">
              O pagamento é combinado com nossa equipe pelo chat após a finalização do pedido.
            </p>
            <button type="button" className="btn btn--primary btn--block btn--lg" onClick={finalizar}>
              Finalizar compra
            </button>
            {!user && <p className="texto-suave texto-pequeno centralizado">Você precisará entrar ou criar uma conta.</p>}
            <Link to="/produtos" className="btn btn--ghost btn--block">
              Continuar comprando
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
