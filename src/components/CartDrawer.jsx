import { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Trash2, X } from 'lucide-react';
import { useCart } from '../hooks/useCart';
import { useAuth } from '../hooks/useAuth';
import QuantitySelector from './QuantitySelector';
import ProductImage from './ProductImage';
import EmptyState from './EmptyState';
import Spinner from './Spinner';
import { formatarMoeda } from '../utils/format';

/** Carrinho em painel lateral. No celular ocupa a tela toda. */
export default function CartDrawer() {
  const { itens, total, drawerAberto, fecharDrawer, definirQuantidade, remover, carregando, atualizando } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const painelRef = useRef(null);

  useEffect(() => {
    if (!drawerAberto) return undefined;
    const aoTeclar = (e) => e.key === 'Escape' && fecharDrawer();
    document.addEventListener('keydown', aoTeclar);
    document.body.classList.add('sem-scroll');
    painelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.classList.remove('sem-scroll');
    };
  }, [drawerAberto, fecharDrawer]);

  const finalizar = () => {
    fecharDrawer();
    if (!user) navigate('/login', { state: { from: '/carrinho' } });
    else navigate('/checkout');
  };

  return (
    <>
      <div className={`drawer-overlay ${drawerAberto ? 'is-aberto' : ''}`} onClick={fecharDrawer} aria-hidden="true" />
      <aside
        className={`drawer ${drawerAberto ? 'is-aberto' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Carrinho de compras"
        aria-hidden={!drawerAberto}
        tabIndex={-1}
        ref={painelRef}
        inert={!drawerAberto}
      >
        <header className="drawer__header">
          <h2>
            <ShoppingBag size={20} aria-hidden="true" /> Seu carrinho
          </h2>
          <button type="button" className="icon-btn" onClick={fecharDrawer} aria-label="Fechar carrinho">
            <X size={22} />
          </button>
        </header>

        <div className="drawer__body">
          {carregando ? (
            <div className="centralizado">
              <Spinner />
            </div>
          ) : itens.length === 0 ? (
            <EmptyState icone={ShoppingBag} titulo="Carrinho vazio" descricao="Adicione produtos para continuar.">
              <Link to="/produtos" className="btn btn--primary" onClick={fecharDrawer}>
                Ver produtos
              </Link>
            </EmptyState>
          ) : (
            <ul className="cart-list">
              {itens.map((item) => (
                <li key={item.produto_id} className="cart-item">
                  <Link to={`/produto/${item.produto_id}`} className="cart-item__img" onClick={fecharDrawer}>
                    <ProductImage src={item.produto.imagem} alt={item.produto.nome} />
                  </Link>
                  <div className="cart-item__info">
                    <Link to={`/produto/${item.produto_id}`} className="cart-item__nome" onClick={fecharDrawer}>
                      {item.produto.nome}
                    </Link>
                    <span className="cart-item__preco">{formatarMoeda(item.produto.preco)}</span>
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
                  <strong className="cart-item__subtotal">
                    {formatarMoeda(item.produto.preco * item.quantidade)}
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </div>

        {itens.length > 0 && (
          <footer className="drawer__footer">
            <div className="drawer__total">
              <span>Total</span>
              <strong>{formatarMoeda(total)}</strong>
            </div>
            <button type="button" className="btn btn--primary btn--block btn--lg" onClick={finalizar}>
              Finalizar compra
            </button>
            <Link to="/carrinho" className="btn btn--ghost btn--block" onClick={fecharDrawer}>
              Ver carrinho completo
            </Link>
          </footer>
        )}
      </aside>
    </>
  );
}
