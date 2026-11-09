import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ChevronLeft, PackageX, PartyPopper } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import { supabase } from '../../services/supabase';
import { buscarPedido } from '../../services/pedidos';
import ChatWindow from '../../components/chat/ChatWindow';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import { PageLoader } from '../../components/Spinner';
import { EnderecoPedido, ItensPedido, StatusTimeline } from '../../components/PedidoResumo';
import { formatarDataHora } from '../../utils/format';
import { traduzirErro } from '../../utils/errors';

export default function PedidoDetalhe() {
  const { id } = useParams();
  const { user } = useAuth();
  const { marcarLidasPorLink } = useNotifications();
  const location = useLocation();
  const novo = location.state?.novo;
  const [pedido, setPedido] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    try {
      setPedido(await buscarPedido(id));
    } catch (e) {
      setErro(traduzirErro(e));
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // notificações deste pedido são marcadas como lidas enquanto a página está aberta
  useEffect(() => {
    marcarLidasPorLink(`/minha-conta/pedidos/${id}`);
  }, [id, marcarLidasPorLink]);

  // Realtime: atualiza quando a equipe mudar o status
  useEffect(() => {
    const canal = supabase
      .channel(`pedido-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `id=eq.${id}` }, () => {
        carregar();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [id, carregar]);

  if (carregando) return <PageLoader />;

  if (erro || !pedido) {
    return (
      <EmptyState icone={PackageX} titulo="Pedido não encontrado" descricao={erro || 'Verifique o link e tente novamente.'}>
        <Link to="/minha-conta/pedidos" className="btn btn--primary">
          Meus pedidos
        </Link>
      </EmptyState>
    );
  }

  return (
    <div className="stack">
      <Link to="/minha-conta/pedidos" className="link voltar">
        <ChevronLeft size={16} aria-hidden="true" /> Meus pedidos
      </Link>

      {novo && (
        <div className="alerta alerta--sucesso" role="status">
          <PartyPopper size={20} aria-hidden="true" />
          <span>
            Pedido criado com sucesso! Use o chat abaixo para combinar o pagamento com nossa equipe. Você receberá o
            código Pix aqui.
          </span>
        </div>
      )}

      <div className="pedido-detalhe__topo">
        <div>
          <h2>Pedido #{pedido.numero}</h2>
          <span className="texto-suave texto-pequeno">Realizado em {formatarDataHora(pedido.created_at)}</span>
        </div>
        <StatusBadge status={pedido.status} />
      </div>

      <section className="card">
        <StatusTimeline status={pedido.status} historico={pedido.historico} />
      </section>

      <div className="pedido-detalhe__grid">
        <ChatWindow
          clienteId={user.id}
          pedidoId={pedido.id}
          perspectiva="cliente"
          titulo="Chat do pedido"
          subtitulo="Combine o pagamento e envie o comprovante do Pix."
        />

        <div className="stack">
          <section className="card">
            <h3 className="card__titulo">Itens</h3>
            <ItensPedido itens={pedido.itens} total={pedido.total} />
          </section>
          <section className="card">
            <h3 className="card__titulo">Entrega</h3>
            <EnderecoPedido endereco={pedido.endereco} />
            {pedido.observacoes && (
              <p className="texto-suave texto-pequeno">
                <strong>Observações:</strong> {pedido.observacoes}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
