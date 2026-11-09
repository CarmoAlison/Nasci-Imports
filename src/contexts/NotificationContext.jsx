import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import * as service from '../services/notificacoes';
import { traduzirErro } from '../utils/errors';

export const NotificationContext = createContext(null);

/** Notificações do sistema (sino), com atualização em tempo real */
export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [notificacoes, setNotificacoes] = useState([]);
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    if (!userId) {
      setNotificacoes([]);
      return;
    }
    setCarregando(true);
    try {
      setNotificacoes(await service.listarNotificacoes(userId));
    } catch (e) {
      console.error(e);
    } finally {
      setCarregando(false);
    }
  }, [userId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Realtime: novas notificações
  useEffect(() => {
    if (!userId) return undefined;
    const canal = supabase
      .channel(`notificacoes-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notificacoes', filter: `user_id=eq.${userId}` },
        (payload) => {
          setNotificacoes((atual) =>
            atual.some((n) => n.id === payload.new.id) ? atual : [payload.new, ...atual],
          );
          toast(payload.new.titulo, { icon: '🔔' });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [userId]);

  const marcarLida = useCallback(async (id) => {
    setNotificacoes((atual) => atual.map((n) => (n.id === id ? { ...n, lida: true } : n)));
    try {
      await service.marcarNotificacaoLida(id);
    } catch (e) {
      toast.error(traduzirErro(e));
    }
  }, []);

  const marcarTodas = useCallback(async () => {
    if (!userId) return;
    setNotificacoes((atual) => atual.map((n) => ({ ...n, lida: true })));
    try {
      await service.marcarTodasLidas(userId);
      toast.success('Todas as notificações foram marcadas como lidas.');
    } catch (e) {
      toast.error(traduzirErro(e));
      carregar();
    }
  }, [userId, carregar]);

  const excluir = useCallback(async (id) => {
    setNotificacoes((atual) => atual.filter((n) => n.id !== id));
    try {
      await service.excluirNotificacao(id);
    } catch (e) {
      toast.error(traduzirErro(e));
    }
  }, []);

  /** Marca como lidas as notificações que apontam para um link (ex.: ao abrir o chat) */
  const marcarLidasPorLink = useCallback(
    async (prefixo) => {
      const alvo = notificacoes.filter((n) => !n.lida && n.link && n.link.startsWith(prefixo));
      if (!alvo.length) return;
      setNotificacoes((atual) => atual.map((n) => (alvo.some((a) => a.id === n.id) ? { ...n, lida: true } : n)));
      await Promise.allSettled(alvo.map((n) => service.marcarNotificacaoLida(n.id)));
    },
    [notificacoes],
  );

  const valor = useMemo(
    () => ({
      notificacoes,
      naoLidas: notificacoes.filter((n) => !n.lida).length,
      carregando,
      recarregar: carregar,
      marcarLida,
      marcarTodas,
      excluir,
      marcarLidasPorLink,
    }),
    [notificacoes, carregando, carregar, marcarLida, marcarTodas, excluir, marcarLidasPorLink],
  );

  return <NotificationContext.Provider value={valor}>{children}</NotificationContext.Provider>;
}
