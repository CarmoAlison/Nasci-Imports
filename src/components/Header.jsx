import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronRight,
  Heart,
  House,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Package,
  Search,
  ShoppingBag,
  ShoppingCart,
  User,
  X,
} from 'lucide-react';
import Logo from './Logo';
import NotificationBell from './NotificationBell';
import { useAuth } from '../hooks/useAuth';
import { useCart } from '../hooks/useCart';
import { primeiroNome } from '../utils/format';

export default function Header() {
  const { user, profile, isStaff, sair } = useAuth();
  const { quantidadeTotal, abrirDrawer } = useCart();
  const [menuAberto, setMenuAberto] = useState(false);
  const [userMenuAberto, setUserMenuAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const userMenuRef = useRef(null);

  // fecha menus ao navegar
  useEffect(() => {
    setMenuAberto(false);
    setUserMenuAberto(false);
  }, [location.pathname]);

  // menu do celular aberto: trava a rolagem da página e fecha com ESC
  useEffect(() => {
    if (!menuAberto) return undefined;
    const aoTeclar = (e) => e.key === 'Escape' && setMenuAberto(false);
    document.body.classList.add('sem-scroll');
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.body.classList.remove('sem-scroll');
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [menuAberto]);

  useEffect(() => {
    if (!userMenuAberto) return undefined;
    const fora = (e) => userMenuRef.current && !userMenuRef.current.contains(e.target) && setUserMenuAberto(false);
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [userMenuAberto]);

  const buscar = (e) => {
    e.preventDefault();
    const termo = busca.trim();
    navigate(termo ? `/produtos?busca=${encodeURIComponent(termo)}` : '/produtos');
  };

  const handleSair = async () => {
    await sair();
    navigate('/');
  };

  return (
    <header className="header">
      <div className="container header__inner">
        <button
          type="button"
          className="icon-btn header__menu-btn"
          onClick={() => setMenuAberto((v) => !v)}
          aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuAberto}
        >
          {menuAberto ? <X size={24} /> : <Menu size={24} />}
        </button>

        <Logo />

        <form className="header__busca" role="search" onSubmit={buscar}>
          <label htmlFor="busca-header" className="sr-only">
            Buscar produtos
          </label>
          <input
            id="busca-header"
            type="search"
            className="input"
            placeholder="Buscar celulares e acessórios..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <button type="submit" className="header__busca-btn" aria-label="Buscar">
            <Search size={18} />
          </button>
        </form>

        <nav className={`header__nav ${menuAberto ? 'is-aberto' : ''}`} aria-label="Principal">
          <form className="header__busca header__busca--mobile" role="search" onSubmit={buscar}>
            <label htmlFor="busca-mobile" className="sr-only">
              Buscar produtos
            </label>
            <input
              id="busca-mobile"
              type="search"
              className="input"
              placeholder="Buscar produtos..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <button type="submit" className="header__busca-btn" aria-label="Buscar">
              <Search size={18} />
            </button>
          </form>
          <span className="header__secao header__so-mobile">Navegar</span>
          <NavLink to="/" end className="header__link">
            <House size={20} aria-hidden="true" />
            <span>Início</span>
            <ChevronRight size={18} className="header__seta" aria-hidden="true" />
          </NavLink>
          <NavLink to="/produtos" className="header__link">
            <Package size={20} aria-hidden="true" />
            <span>Produtos</span>
            <ChevronRight size={18} className="header__seta" aria-hidden="true" />
          </NavLink>
          {user && (
            <NavLink to="/minha-conta/pedidos" className="header__link">
              <ShoppingBag size={20} aria-hidden="true" />
              <span>Meus pedidos</span>
              <ChevronRight size={18} className="header__seta" aria-hidden="true" />
            </NavLink>
          )}
          {isStaff && (
            <NavLink to="/admin" className="header__link">
              <LayoutDashboard size={20} aria-hidden="true" />
              <span>Painel</span>
              <ChevronRight size={18} className="header__seta" aria-hidden="true" />
            </NavLink>
          )}

          {/* Somente no celular: atalhos da conta */}
          {user ? (
            <>
              <span className="header__secao header__so-mobile">
                Minha conta{profile?.nome_completo ? ` · ${primeiroNome(profile.nome_completo)}` : ''}
              </span>
              {[
                { to: '/minha-conta', label: 'Meus dados', icone: User, end: true },
                { to: '/minha-conta/favoritos', label: 'Favoritos', icone: Heart },
                { to: '/minha-conta/notificacoes', label: 'Notificações', icone: Bell },
                { to: '/minha-conta/atendimento', label: 'Atendimento', icone: MessageCircle },
              ].map(({ to, label, icone: Icone, end }) => (
                <NavLink key={to} to={to} end={end} className="header__link header__so-mobile">
                  <Icone size={20} aria-hidden="true" />
                  <span>{label}</span>
                  <ChevronRight size={18} className="header__seta" aria-hidden="true" />
                </NavLink>
              ))}
              <button type="button" className="header__link header__link--sair header__so-mobile" onClick={handleSair}>
                <LogOut size={20} aria-hidden="true" />
                <span>Sair</span>
              </button>
            </>
          ) : (
            <div className="header__entrar header__so-mobile">
              <Link to="/login" state={{ from: location.pathname }} className="btn btn--primary btn--block btn--lg">
                Entrar
              </Link>
              <Link to="/cadastro" className="btn btn--outline btn--block">
                Criar conta
              </Link>
            </div>
          )}
        </nav>

        <div className="header__acoes">
          {user && <NotificationBell />}

          <button
            type="button"
            className="icon-btn header__carrinho"
            onClick={abrirDrawer}
            aria-label={`Abrir carrinho (${quantidadeTotal} itens)`}
          >
            <ShoppingCart size={22} />
            {quantidadeTotal > 0 && <span className="contador">{quantidadeTotal}</span>}
          </button>

          {user ? (
            <div className="user-menu" ref={userMenuRef}>
              <button
                type="button"
                className="icon-btn user-menu__btn"
                onClick={() => setUserMenuAberto((v) => !v)}
                aria-expanded={userMenuAberto}
                aria-label="Menu da conta"
              >
                <User size={22} />
                <span className="user-menu__nome">{primeiroNome(profile?.nome_completo) || 'Conta'}</span>
              </button>
              {userMenuAberto && (
                <div className="user-menu__painel" role="menu">
                  <Link to="/minha-conta" role="menuitem">
                    <User size={16} aria-hidden="true" /> Minha conta
                  </Link>
                  {isStaff && (
                    <Link to="/admin" role="menuitem">
                      <LayoutDashboard size={16} aria-hidden="true" /> Painel administrativo
                    </Link>
                  )}
                  <button type="button" onClick={handleSair} role="menuitem">
                    <LogOut size={16} aria-hidden="true" /> Sair
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" state={{ from: location.pathname }} className="btn btn--primary btn--sm">
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
