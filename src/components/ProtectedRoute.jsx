import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { usePermission } from '../hooks/usePermission';
import { PageLoader } from './Spinner';
import EmptyState from './EmptyState';

/**
 * Protege rotas no front-end.
 *  - sem props: exige login
 *  - requireStaff: exige funcionário/admin
 *  - modulo/acao: exige permissão específica (usePermission)
 * Obs.: a proteção real dos dados é feita no banco (RLS).
 */
export default function ProtectedRoute({ children, requireStaff = false, somenteAdmin = false, modulo, acao = 'ver' }) {
  const { user, carregando, isStaff, isAdmin } = useAuth();
  const { pode } = usePermission();
  const location = useLocation();

  if (carregando) return <PageLoader />;

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (requireStaff && !isStaff) return <Navigate to="/" replace />;

  if ((somenteAdmin && !isAdmin) || (modulo && !pode(modulo, acao))) {
    return (
      <EmptyState
        icone={ShieldAlert}
        titulo="Acesso negado"
        descricao="Seu perfil de acesso não tem permissão para esta página."
      >
        <Link to={isStaff ? '/admin' : '/'} className="btn btn--primary">
          Voltar
        </Link>
      </EmptyState>
    );
  }

  return children ?? <Outlet />;
}
