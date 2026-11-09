import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Mail, PackageX, Phone, QrCode } from 'lucide-react';
import toast from 'react-hot-toast';
import ChatWindow from '../../components/chat/ChatWindow';
import EnviarPixModal from '../../components/admin/EnviarPixModal';
import EmptyState from '../../components/EmptyState';
import StatusBadge from '../../components/StatusBadge';
import Spinner, { PageLoader } from '../../components/Spinner';
import { EnderecoPedido, HistoricoStatus, ItensPedido } from '../../components/PedidoResumo';
import { usePermission } from '../../hooks/usePermission';
import { useNotifications } from '../../hooks/useNotifications';
import { alterarStatusPedido, buscarPedido } from '../../services/pedidos';
import { listarRespostasRapidas } from '../../services/mensagens';
import { ORDEM_STATUS, STATUS_PEDIDO } from '../../utils/constants';
import { formatarDataHora } from '../../utils/format';
import { mascaraTelefone } from '../../utils/masks';
import { traduzirErro } from '../../utils/errors';

export default function PedidoDetalhe() {
  const { id } = useParams();
  const { pode } = usePermission();
  const { marcarLidasPorLink } = useNotifications();
  const [pedido, setPedido] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [alterando, setAlterando] = useState(false);
  const [modalPix, setModalPix] = useState(false);
  const enviarRef = useRef(null);
  const [respostas, setRespostas] = useState([]);
  const podeResponder = pode('chat', 'criar');

  useEffect(() => {
    if (!podeResponder) return;
    listarRespostasRapidas()
      .then(setRespostas)
      .catch(() => {});
  }, [podeResponder]);

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

  useEffect(() => {
    marcarLidasPorLink(`/admin/pedidos/${id}`);
  }, [id, marcarLidasPorLink]);

  const registrarEnvio = useCallback((fn) => {
    enviarRef.current = fn;
  }, []);

  const mudarStatus = async (novo) => {
    if (novo === pedido.status) return;
    setAlterando(true);
    try {
      await alterarStatusPedido(pedido.id, novo);
      toast.success(`Status alterado para "${STATUS_PEDIDO[novo].label}". Cliente notificado.`);
      await carregar();
    } catch (e) {
      toast.error(traduzirErro(e));
    } finally {
      setAlterando(false);
    }
  };

  // envio de um código colado manualmente (opção alternativa do modal)
  const enviarPixManual = async (codigo) => Boolean(await enviarRef.current?.({ texto: codigo, tipo: 'pix' }));

  if (carregando) return <PageLoader />;

  if (erro || !pedido) {
    return (
      <EmptyState icone={PackageX} titulo="Pedido não encontrado" descricao={erro}>
        <Link to="/admin/pedidos" className="btn btn--primary">
          Voltar aos pedidos
        </Link>
      </EmptyState>
    );
  }

  return (
    <div className="stack">
      <Link to="/admin/pedidos" className="link voltar">
        <ChevronLeft size={16} aria-hidden="true" /> Pedidos
      </Link>

      <div className="pedido-detalhe__topo">
        <div>
          <h1>Pedido #{pedido.numero}</h1>
          <span className="texto-suave texto-pequeno">Criado em {formatarDataHora(pedido.created_at)}</span>
        </div>
        <div className="pedido-detalhe__status">
          {pode('pedidos', 'alterar_status') ? (
            <>
              <label htmlFor="status-pedido" className="texto-suave texto-pequeno">
                Status
              </label>
              <select
                id="status-pedido"
                className="input"
                value={pedido.status}
                disabled={alterando}
                onChange={(e) => mudarStatus(e.target.value)}
              >
                {ORDEM_STATUS.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_PEDIDO[s].label}
                  </option>
                ))}
              </select>
              {alterando && <Spinner tamanho="sm" />}
            </>
          ) : (
            <StatusBadge status={pedido.status} />
          )}
        </div>
      </div>

      <div className="pedido-detalhe__grid">
        <ChatWindow
          clienteId={pedido.cliente_id}
          pedidoId={pedido.id}
          perspectiva="equipe"
          titulo="Chat do pedido"
          subtitulo={pedido.cliente_nome}
          nomeCliente={pedido.cliente_nome}
          podeEnviar={podeResponder}
          respostasRapidas={respostas}
          registrarEnvio={registrarEnvio}
          acoesExtras={
            pode('pedidos', 'enviar_pix') && (
              <button type="button" className="btn btn--primary btn--sm" onClick={() => setModalPix(true)}>
                <QrCode size={16} aria-hidden="true" /> Enviar Pix
              </button>
            )
          }
        />

        <div className="stack">
          <section className="card">
            <h2 className="card__titulo">Cliente</h2>
            <p>
              <strong>{pedido.cliente_nome}</strong>
            </p>
            {pedido.cliente_email && (
              <p className="linha-icone">
                <Mail size={16} aria-hidden="true" /> <a href={`mailto:${pedido.cliente_email}`}>{pedido.cliente_email}</a>
              </p>
            )}
            {pedido.cliente_telefone && (
              <p className="linha-icone">
                <Phone size={16} aria-hidden="true" />
                <a href={`https://wa.me/55${pedido.cliente_telefone}`} target="_blank" rel="noreferrer">
                  {mascaraTelefone(pedido.cliente_telefone)}
                </a>
              </p>
            )}
          </section>
          <section className="card">
            <h2 className="card__titulo">Endereço de entrega</h2>
            <EnderecoPedido endereco={pedido.endereco} />
            {pedido.observacoes && (
              <p className="texto-suave texto-pequeno">
                <strong>Observações:</strong> {pedido.observacoes}
              </p>
            )}
          </section>
          <section className="card">
            <h2 className="card__titulo">Itens</h2>
            <ItensPedido itens={pedido.itens} total={pedido.total} />
          </section>
          <section className="card">
            <h2 className="card__titulo">Histórico de status</h2>
            <HistoricoStatus historico={pedido.historico} />
          </section>
        </div>
      </div>

      <EnviarPixModal
        aberto={modalPix}
        aoFechar={() => setModalPix(false)}
        pedido={pedido}
        enviarManual={enviarPixManual}
      />
    </div>
  );
}
