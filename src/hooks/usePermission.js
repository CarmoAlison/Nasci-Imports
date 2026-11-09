import { useCallback } from 'react';
import { useAuth } from './useAuth';

/**
 * Verifica permissões no front-end (menu, rotas e botões).
 * A segurança real é garantida pelo banco (RLS + has_permission).
 *
 *   const { pode } = usePermission();
 *   pode('produtos', 'editar')
 */
export function usePermission() {
  const { profile, permissoes } = useAuth();

  const pode = useCallback(
    (modulo, acao = 'ver') => {
      if (!profile || !profile.ativo) return false;
      if (profile.role === 'admin') return true; // admin principal: acesso total
      if (profile.role !== 'funcionario') return false;
      return permissoes.has(`${modulo}.${acao}`);
    },
    [profile, permissoes],
  );

  return { pode };
}
