import { Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, Store, X } from 'lucide-react';
import Logo from '../components/Logo';
import NotificationBell from '../components/NotificationBell';
import { PageLoader } from '../components/Spinner';
import { useAuth } from '../hooks/useAuth';
import { usePermission } from '../hooks/usePermission';
import { useNotifications } from '../hooks/useNotifications';
import { MENU_ADMIN } from '../utils/adminMenu';

export default function AdminLayout() {
  const { profile, sair } = useAuth();
  const { pode } = usePermission();
  const [menuAberto, setMenuAberto] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => setMenuAberto(false), [location.pathname]);

  const { notificacoes } = useNotifications();
  const itens = MENU_ADMIN.filter((i) => (i.somenteAdmin ? profile?.role === 'admin' : pode(i.modulo, i.acao || 'ver')));

  // conversas com mensagem nova de cliente (uma notificação não lida por conversa)
  const pendentesChat = notificacoes.filter((n) => !n.lida && n.link?.startsWith('/admin/chat')).length;

  const handleSair = async () => {
    await sair();
    navigate('/');
  };

  return (
    <div className="admin">
      <a href="#admin-conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <aside className={`admin__sidebar ${menuAberto ? 'is-aberto' : ''}`} aria-label="Menu do painel">
        <div className="admin__sidebar-topo">
          <Logo to="/admin" />
          <button
            type="button"
            className="icon-btn admin__fechar"
            onClick={() => setMenuAberto(false)}
            aria-label="Fechar menu"
          >
            <X size={22} />
          </button>
        </div>
        <nav className="admin__nav">
          {itens.map(({ to, label, icone: Icone, end, sub }) => (
            <NavLink key={to} to={to} end={end} className={`admin__link ${sub ? 'admin__link--sub' : ''}`}>
              <Icone size={18} aria-hidden="true" />
              {label}
              {to === '/admin/chat' && pendentesChat > 0 && (
                <span className="contador contador--inline" aria-label={`${pendentesChat} conversas com mensagens novas`}>
                  {pendentesChat}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="admin__sidebar-rodape">
          <Link to="/" className="admin__link">
            <Store size={18} aria-hidden="true" /> Ver loja
          </Link>
          <button type="button" className="admin__link" onClick={handleSair}>
            <LogOut size={18} aria-hidden="true" /> Sair
          </button>
        </div>
      </aside>
      {menuAberto && <div className="admin__overlay" onClick={() => setMenuAberto(false)} aria-hidden="true" />}

      <div className="admin__principal">
        <header className="admin__topbar">
          <button
            type="button"
            className="icon-btn admin__hamburguer"
            onClick={() => setMenuAberto(true)}
            aria-label="Abrir menu"
            aria-expanded={menuAberto}
          >
            <Menu size={24} />
          </button>
          <span className="admin__titulo-topo">Painel administrativo</span>
          <div className="admin__topbar-acoes">
            <NotificationBell />
            <div className="admin__usuario">
              <strong>{profile?.nome_completo}</strong>
              <small>{profile?.role === 'admin' ? 'Administrador' : 'Funcionário'}</small>
            </div>
          </div>
        </header>
        <main id="admin-conteudo" className="admin__conteudo">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
