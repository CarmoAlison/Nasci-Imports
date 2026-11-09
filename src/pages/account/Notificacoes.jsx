import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, MessageCircle, Package, Trash2, Truck } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import EmptyState from '../../components/EmptyState';
import { LinhasSkeleton } from '../../components/Skeleton';
import { formatarDataHora } from '../../utils/format';

const ICONES = { status: Truck, mensagem: MessageCircle, pedido: Package, sistema: Bell };

export default function Notificacoes() {
  const { notificacoes, naoLidas, carregando, marcarLida, marcarTodas, excluir } = useNotifications();
  const navigate = useNavigate();

  const abrir = (n) => {
    if (!n.lida) marcarLida(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="stack">
      <div className="linha-entre">
        <h2>Notificações</h2>
        {naoLidas > 0 && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={marcarTodas}>
            <CheckCheck size={16} aria-hidden="true" /> Marcar todas como lidas
          </button>
        )}
      </div>

      {carregando ? (
        <LinhasSkeleton />
      ) : notificacoes.length === 0 ? (
        <EmptyState icone={Bell} titulo="Nenhuma notificação" descricao="Avisos sobre seus pedidos e mensagens aparecerão aqui." />
      ) : (
        <ul className="notif-pagina">
          {notificacoes.map((n) => {
            const Icone = ICONES[n.tipo] || Bell;
            return (
              <li key={n.id} className={`notif-pagina__item card ${n.lida ? '' : 'is-nao-lida'}`}>
                <button type="button" className="notif-pagina__conteudo" onClick={() => abrir(n)}>
                  <Icone size={20} aria-hidden="true" className="notif-pagina__icone" />
                  <span>
                    <strong>{n.titulo}</strong>
                    {n.mensagem && <span className="texto-suave">{n.mensagem}</span>}
                    <small className="texto-suave">{formatarDataHora(n.created_at)}</small>
                  </span>
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => excluir(n.id)}
                  aria-label="Excluir notificação"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
