import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, MessageCircle, ShoppingBag, UserCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';
import PerfilForm from '../components/PerfilForm';
import ProductImage from '../components/ProductImage';
import EmptyState from '../components/EmptyState';
import FormField from '../components/FormField';
import Spinner, { PageLoader } from '../components/Spinner';
import { finalizarPedido } from '../services/pedidos';
import { perfilCompleto } from '../utils/validators';
import { formatarEndereco, formatarMoeda } from '../utils/format';
import { traduzirErro } from '../utils/errors';

export default function Checkout() {
  const { profile } = useAuth();
  const { itens, total, carregando, recarregar } = useCart();
  const navigate = useNavigate();
  const [editandoEndereco, setEditandoEndereco] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [enviando, setEnviando] = useState(false);

  if (carregando) return <PageLoader />;

  if (itens.length === 0 && !enviando) {
    return (
      <div className="container">
        <EmptyState icone={ShoppingBag} titulo="Seu carrinho está vazio" descricao="Adicione produtos antes de finalizar a compra.">
          <Link to="/produtos" className="btn btn--primary">
            Ver produtos
          </Link>
        </EmptyState>
      </div>
    );
  }

  const completo = perfilCompleto(profile);

  const confirmar = async () => {
    if (!completo) {
      toast.error('Complete seu cadastro antes de finalizar.');
      return;
    }
    setEnviando(true);
    try {
      const pedidoId = await finalizarPedido(observacoes);
      await recarregar();
      toast.success('Pedido realizado! Combine o pagamento pelo chat.');
      navigate(`/minha-conta/pedidos/${pedidoId}`, { replace: true, state: { novo: true } });
    } catch (e) {
      toast.error(traduzirErro(e));
      recarregar();
      setEnviando(false);
    }
  };

  return (
    <div className="container checkout">
      <h1>Finalizar compra</h1>

      <div className="checkout__grid">
        <div className="stack">
          {!completo ? (
            <section className="card">
              <h2 className="card__titulo">
                <UserCheck size={20} aria-hidden="true" /> Complete seu cadastro
              </h2>
              <p className="texto-suave">
                Para finalizar sua primeira compra, precisamos do seu CPF, telefone e endereço de entrega.
              </p>
              <PerfilForm textoBotao="Salvar e continuar" />
            </section>
          ) : (
            <section className="card">
              <div className="card__topo">
                <h2 className="card__titulo">
                  <MapPin size={20} aria-hidden="true" /> Endereço de entrega
                </h2>
                {!editandoEndereco && (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditandoEndereco(true)}>
                    Alterar
                  </button>
                )}
              </div>
              {editandoEndereco ? (
                <PerfilForm textoBotao="Salvar endereço" aoSalvar={() => setEditandoEndereco(false)} />
              ) : (
                <div className="endereco-box">
                  <strong>{profile.nome_completo}</strong>
                  <p>{formatarEndereco(profile)}</p>
                </div>
              )}
            </section>
          )}

          <section className="card">
            <h2 className="card__titulo">
              <ShoppingBag size={20} aria-hidden="true" /> Itens do pedido
            </h2>
            <ul className="checkout__itens">
              {itens.map((i) => (
                <li key={i.produto_id} className="checkout__item">
                  <div className="checkout__item-img">
                    <ProductImage src={i.produto.imagem} alt={i.produto.nome} />
                  </div>
                  <div className="checkout__item-info">
                    <span>{i.produto.nome}</span>
                    <small className="texto-suave">
                      {i.quantidade} × {formatarMoeda(i.produto.preco)}
                    </small>
                  </div>
                  <strong>{formatarMoeda(i.quantidade * i.produto.preco)}</strong>
                </li>
              ))}
            </ul>
            <Link to="/carrinho" className="link texto-pequeno">
              Editar carrinho
            </Link>
          </section>

          <section className="card">
            <FormField
              as="textarea"
              label="Observações (opcional)"
              rows={3}
              maxLength={500}
              placeholder="Ex.: melhor horário para entrega, ponto de referência..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
            />
          </section>
        </div>

        <aside className="card resumo">
          <h2>Resumo</h2>
          <div className="resumo__linha resumo__total">
            <span>Total</span>
            <strong>{formatarMoeda(total)}</strong>
          </div>
          <div className="aviso-pagamento">
            <MessageCircle size={20} aria-hidden="true" />
            <p>
              O pagamento <strong>não</strong> é feito no site. Após confirmar, você será levado ao chat do pedido para
              combinar o pagamento (Pix) com nossa equipe.
            </p>
          </div>
          <button
            type="button"
            className="btn btn--primary btn--block btn--lg"
            onClick={confirmar}
            disabled={enviando || !completo || editandoEndereco}
          >
            {enviando && <Spinner tamanho="sm" />}
            Confirmar pedido
          </button>
          {!completo && <small className="texto-aviso">Complete seu cadastro para continuar.</small>}
        </aside>
      </div>
    </div>
  );
}
