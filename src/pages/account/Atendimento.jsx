import { useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNotifications } from '../../hooks/useNotifications';
import ChatWindow from '../../components/chat/ChatWindow';

/** Chat geral (não ligado a um pedido) entre cliente e equipe */
export default function Atendimento() {
  const { user } = useAuth();
  const { marcarLidasPorLink } = useNotifications();

  // notificações desta conversa são marcadas como lidas enquanto a página está aberta
  useEffect(() => {
    marcarLidasPorLink('/minha-conta/atendimento');
  }, [marcarLidasPorLink]);

  return (
    <div className="stack">
      <h2>Atendimento</h2>
      <p className="texto-suave">
        Tire dúvidas sobre produtos, disponibilidade ou entregas. Para assuntos de um pedido específico, use o chat
        dentro do pedido.
      </p>
      <ChatWindow clienteId={user.id} perspectiva="cliente" titulo="Fale com a Nasci Imports" />
    </div>
  );
}
