import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../services/supabase';
import { traduzirErro } from '../utils/errors';

export const AuthContext = createContext(null);

/**
 * Mantém sessão, profile e permissões do usuário logado.
 * profile === undefined → ainda carregando; null → sem profile.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(undefined);
  const [permissoes, setPermissoes] = useState(() => new Set());
  const [inicializando, setInicializando] = useState(true);
  const [recuperandoSenha, setRecuperandoSenha] = useState(false);
  const ultimoUserId = useRef(null);

  const carregarPerfil = useCallback(async (user) => {
    if (!user) {
      setProfile(null);
      setPermissoes(new Set());
      return;
    }
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (error) throw error;

      if (data && !data.ativo) {
        await supabase.auth.signOut();
        toast.error('Sua conta está desativada. Fale com o administrador.');
        setProfile(null);
        setPermissoes(new Set());
        return;
      }

      let perms = new Set();
      if (data?.role === 'funcionario') {
        const { data: lista, error: permErr } = await supabase.rpc('minhas_permissoes');
        if (permErr) throw permErr;
        perms = new Set(lista || []);
      }
      setPermissoes(perms);
      setProfile(data ?? null);
    } catch (e) {
      console.error('Erro ao carregar perfil', e);
      toast.error(traduzirErro(e));
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((evento, novaSessao) => {
      setSession(novaSessao);
      const userId = novaSessao?.user?.id ?? null;

      if (evento === 'PASSWORD_RECOVERY') setRecuperandoSenha(true);

      // Evita chamadas ao Supabase dentro do callback (recomendação da lib)
      const precisaRecarregar =
        evento === 'INITIAL_SESSION' || evento === 'USER_UPDATED' || userId !== ultimoUserId.current;

      if (precisaRecarregar) {
        if (userId !== ultimoUserId.current) setProfile(undefined);
        ultimoUserId.current = userId;
        setTimeout(async () => {
          await carregarPerfil(novaSessao?.user ?? null);
          if (evento === 'INITIAL_SESSION') setInicializando(false);
        }, 0);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [carregarPerfil]);

  const sair = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error(traduzirErro(error));
    else toast.success('Você saiu da sua conta.');
  }, []);

  const recarregarPerfil = useCallback(() => carregarPerfil(session?.user ?? null), [carregarPerfil, session]);

  const valor = useMemo(() => {
    const user = session?.user ?? null;
    const role = profile?.role;
    return {
      session,
      user,
      profile: profile ?? null,
      permissoes,
      carregando: inicializando || (Boolean(user) && profile === undefined),
      isStaff: role === 'funcionario' || role === 'admin',
      isAdmin: role === 'admin',
      recuperandoSenha,
      setRecuperandoSenha,
      sair,
      recarregarPerfil,
      setProfile,
    };
  }, [session, profile, permissoes, inicializando, recuperandoSenha, sair, recarregarPerfil]);

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}
