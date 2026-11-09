import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, MessageCircle, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import ProductImage from '../../components/ProductImage';
import { LinhasSkeleton } from '../../components/Skeleton';
import { contarNaoLidasPorPedido, listarMeusPedidos } from '../../services/pedidos';
import { formatarDataHora, formatarMoeda } from '../../utils/format';
import { traduzirErro } from '../../utils/errors';

export default function MeusPedidos() {
  const { user } = useAuth();
  const [pedidos, setPedidos] = useState([]);
  const [naoLidas, setNaoLidas] = useState({});
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    Promise.all([listarMeusPedidos(user.id), contarNaoLidasPorPedido(user.id)])
      .then(([lista, contagem]) => {
        if (!ativo) return;
        setPedidos(lista);
        setNaoLidas(contagem);
      })
      .catch((e) => toast.error(traduzirErro(e)))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [user.id]);

  if (carregando) return <LinhasSkeleton linhas={4} />;

  if (pedidos.length === 0) {
    return (
      <EmptyState icone={Package} titulo="Você ainda não fez pedidos" descricao="Quando fizer uma compra, ela aparecerá aqui.">
        <Link to="/produtos" className="btn btn--primary">
          Ver produtos
        </Link>
      </EmptyState>
    );
  }

  return (
    <div className="stack">
      <h2>Meus pedidos</h2>
      <ul className="pedidos-lista">
        {pedidos.map((p) => {
          const qtdItens = p.itens.reduce((s, i) => s + i.quantidade, 0);
          const msgs = naoLidas[p.id] || 0;
          return (
            <li key={p.id}>
              <Link to={`/minha-conta/pedidos/${p.id}`} className="pedido-card card">
                <div className="pedido-card__topo">
                  <strong>Pedido #{p.numero}</strong>
                  <StatusBadge status={p.status} />
                </div>
                <div className="pedido-card__imagens">
                  {p.itens.slice(0, 4).map((i) => (
                    <div key={i.id} className="pedido-card__img">
                      <ProductImage src={i.produto_imagem} alt={i.produto_nome} />
                    </div>
                  ))}
                  {p.itens.length > 4 && <span className="pedido-card__mais">+{p.itens.length - 4}</span>}
                </div>
                <div className="pedido-card__rodape">
                  <span className="texto-suave texto-pequeno">
                    {formatarDataHora(p.created_at)} · {qtdItens} {qtdItens === 1 ? 'item' : 'itens'}
                  </span>
                  <strong>{formatarMoeda(p.total)}</strong>
                </div>
                {msgs > 0 && (
                  <span className="pedido-card__msgs">
                    <MessageCircle size={14} aria-hidden="true" /> {msgs} {msgs === 1 ? 'nova mensagem' : 'novas mensagens'}
                  </span>
                )}
                <ChevronRight size={18} className="pedido-card__seta" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
