import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from '../hooks/useAuth';
import { tempoRelativo } from '../utils/format';

export default function NotificationBell() {
  const { notificacoes, naoLidas, marcarLida, marcarTodas } = useNotifications();
  const { isStaff } = useAuth();
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => ref.current && !ref.current.contains(e.target) && setAberto(false);
    const esc = (e) => e.key === 'Escape' && setAberto(false);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  const abrir = (n) => {
    if (!n.lida) marcarLida(n.id);
    setAberto(false);
    if (n.link) navigate(n.link);
  };

  const recentes = notificacoes.slice(0, 8);

  return (
    <div className="notif" ref={ref}>
      <button
        type="button"
        className="icon-btn notif__btn"
        onClick={() => setAberto((v) => !v)}
        aria-label={`Notificações${naoLidas ? ` (${naoLidas} não lidas)` : ''}`}
        aria-expanded={aberto}
      >
        <Bell size={22} />
        {naoLidas > 0 && <span className="contador">{naoLidas > 99 ? '99+' : naoLidas}</span>}
      </button>

      {aberto && (
        <div className="notif__painel" role="menu">
          <div className="notif__topo">
            <strong>Notificações</strong>
            {naoLidas > 0 && (
              <button type="button" className="link-btn" onClick={marcarTodas}>
                <CheckCheck size={16} aria-hidden="true" /> Marcar todas
              </button>
            )}
          </div>
          {recentes.length === 0 ? (
            <p className="notif__vazio">Nenhuma notificação por enquanto.</p>
          ) : (
            <ul className="notif__lista">
              {recentes.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`notif__item ${n.lida ? '' : 'is-nao-lida'}`}
                    onClick={() => abrir(n)}
                    role="menuitem"
                  >
                    <span className="notif__titulo">{n.titulo}</span>
                    {n.mensagem && <span className="notif__msg">{n.mensagem}</span>}
                    <span className="notif__tempo">{tempoRelativo(n.created_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!isStaff && (
            <Link to="/minha-conta/notificacoes" className="notif__ver-todas" onClick={() => setAberto(false)}>
              Ver todas
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
