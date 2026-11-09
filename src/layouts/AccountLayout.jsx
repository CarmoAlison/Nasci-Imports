import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Bell, Heart, MessageCircle, Package, User } from 'lucide-react';
import { PageLoader } from '../components/Spinner';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from '../hooks/useAuth';
import { primeiroNome } from '../utils/format';

const LINKS = [
  { to: '/minha-conta', label: 'Meus dados', icone: User, end: true },
  { to: '/minha-conta/pedidos', label: 'Pedidos', icone: Package },
  { to: '/minha-conta/favoritos', label: 'Favoritos', icone: Heart },
  { to: '/minha-conta/notificacoes', label: 'Notificações', icone: Bell, contador: true },
  { to: '/minha-conta/atendimento', label: 'Atendimento', icone: MessageCircle },
];

export default function AccountLayout() {
  const { naoLidas } = useNotifications();
  const { profile } = useAuth();

  return (
    <div className="container conta">
      <div className="conta__topo">
        <h1>Olá, {primeiroNome(profile?.nome_completo) || 'cliente'}!</h1>
      </div>
      <div className="conta__grid">
        <nav className="conta__nav" aria-label="Minha conta">
          {LINKS.map(({ to, label, icone: Icone, end, contador }) => (
            <NavLink key={to} to={to} end={end} className="conta__link">
              <Icone size={18} aria-hidden="true" />
              <span>{label}</span>
              {contador && naoLidas > 0 && <span className="contador contador--inline">{naoLidas}</span>}
            </NavLink>
          ))}
        </nav>
        <section className="conta__conteudo">
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </section>
      </div>
    </div>
  );
}
