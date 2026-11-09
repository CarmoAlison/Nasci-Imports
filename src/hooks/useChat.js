import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../services/supabase';
import * as service from '../services/mensagens';
import { traduzirErro } from '../utils/errors';
import { useAuth } from './useAuth';

/**
 * Chat em tempo real de uma conversa (cliente + pedido opcional).
 * perspectiva: 'cliente' | 'equipe' — define quais mensagens contam como "recebidas".
 */
export function useChat({ clienteId, pedidoId = null, perspectiva = 'cliente' }) {
  const { user } = useAuth();
  const [mensagens, setMensagens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const pedidoRef = useRef(pedidoId);
  useEffect(() => {
    pedidoRef.current = pedidoId;
  }, [pedidoId]);

  const ehRecebida = useCallback(
    (m) => (perspectiva === 'cliente' ? m.remetente_equipe : !m.remetente_equipe),
    [perspectiva],
  );

  const marcarLidas = useCallback(() => {
    if (!clienteId) return;
    service.marcarLidas(clienteId, pedidoId);
    setMensagens((atual) => atual.map((m) => (ehRecebida(m) && !m.lida ? { ...m, lida: true } : m)));
  }, [clienteId, pedidoId, ehRecebida]);

  // Carga inicial
  useEffect(() => {
    if (!clienteId) return undefined;
    let ativo = true;
    setCarregando(true);
    setErro(null);
    service
      .listarMensagens(clienteId, pedidoId)
      .then((lista) => {
        if (!ativo) return;
        setMensagens(lista);
        if (lista.some((m) => ehRecebida(m) && !m.lida)) service.marcarLidas(clienteId, pedidoId);
      })
      .catch((e) => ativo && setErro(traduzirErro(e)))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [clienteId, pedidoId, ehRecebida]);

  // Realtime
  useEffect(() => {
    if (!clienteId) return undefined;
    const canal = supabase
      .channel(`chat-${clienteId}-${pedidoId || 'geral'}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mensagens', filter: `cliente_id=eq.${clienteId}` },
        (payload) => {
          const nova = payload.new;
          if ((nova.pedido_id || null) !== (pedidoRef.current || null)) return;
          setMensagens((atual) => (atual.some((m) => m.id === nova.id) ? atual : [...atual, nova]));
          if (ehRecebida(nova) && document.visibilityState === 'visible') {
            service.marcarLidas(clienteId, pedidoRef.current);
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'mensagens', filter: `cliente_id=eq.${clienteId}` },
        (payload) => {
          setMensagens((atual) => atual.map((m) => (m.id === payload.new.id ? { ...m, ...payload.new } : m)));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [clienteId, pedidoId, ehRecebida]);

  // Ao voltar para a aba, marca como lidas
  useEffect(() => {
    const aoVoltar = () => document.visibilityState === 'visible' && marcarLidas();
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, [marcarLidas]);

  const enviar = useCallback(
    async ({ texto = '', arquivo = null, tipo = 'normal' }) => {
      if (!texto.trim() && !arquivo) return false;
      setEnviando(true);
      try {
        const nova = await service.enviarMensagem({
          clienteId,
          pedidoId,
          remetenteId: user.id,
          texto,
          arquivo,
          tipo,
        });
        setMensagens((atual) => (atual.some((m) => m.id === nova.id) ? atual : [...atual, nova]));
        return true;
      } catch (e) {
        toast.error(traduzirErro(e));
        return false;
      } finally {
        setEnviando(false);
      }
    },
    [clienteId, pedidoId, user],
  );

  return { mensagens, carregando, enviando, erro, enviar, ehRecebida };
}
