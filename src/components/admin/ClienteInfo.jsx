import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Mail, MapPin, MessageCircle, Package, Phone } from 'lucide-react';
import Spinner from '../Spinner';
import StatusBadge from '../StatusBadge';
import { usePermission } from '../../hooks/usePermission';
import { infoClienteConversa } from '../../services/mensagens';
import { formatarData, formatarMoeda } from '../../utils/format';
import { mascaraTelefone } from '../../utils/masks';
import { traduzirErro } from '../../utils/errors';

function iniciais(nome) {
  const partes = String(nome || '?').trim().split(/\s+/);
  return ((partes[0]?.[0] || '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}

/** Dados do cliente exibidos ao lado do chat no painel de atendimento */
export default function ClienteInfo({ clienteId, pedidoAtualId }) {
  const { pode } = usePermission();
  const [estado, setEstado] = useState({ id: null, dados: null, erro: '' });

  useEffect(() => {
    let ativo = true;
    infoClienteConversa(clienteId)
      .then((dados) => ativo && setEstado({ id: clienteId, dados, erro: '' }))
      .catch((e) => ativo && setEstado({ id: clienteId, dados: null, erro: traduzirErro(e) }));
    return () => {
      ativo = false;
    };
  }, [clienteId]);

  if (estado.id !== clienteId) {
    return (
      <div className="centralizado">
        <Spinner />
      </div>
    );
  }
  if (estado.erro) return <p className="texto-erro texto-pequeno">{estado.erro}</p>;

  const c = estado.dados;
  const podeVerPedidos = pode('pedidos', 'ver');

  return (
    <div className="cliente-info">
      <div className="cliente-info__topo">
        <span className="avatar" aria-hidden="true">
          {iniciais(c.nome_completo)}
        </span>
        <div>
          <strong>{c.nome_completo}</strong>
          <small className="texto-suave bloco">@{c.username}</small>
        </div>
      </div>

      <ul className="cliente-info__dados">
        {c.telefone && (
          <li>
            <Phone size={15} aria-hidden="true" />
            <span>{mascaraTelefone(c.telefone)}</span>
            <a
              href={`https://wa.me/55${c.telefone}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn--ghost btn--sm"
              aria-label="Abrir conversa no WhatsApp"
            >
              <MessageCircle size={14} aria-hidden="true" /> WhatsApp
            </a>
          </li>
        )}
        {c.email && (
          <li>
            <Mail size={15} aria-hidden="true" />
            <a href={`mailto:${c.email}`} className="texto-truncado">
              {c.email}
            </a>
          </li>
        )}
        {c.cidade && (
          <li>
            <MapPin size={15} aria-hidden="true" />
            <span>
              {c.cidade}/{c.uf}
            </span>
          </li>
        )}
        <li>
          <Calendar size={15} aria-hidden="true" />
          <span>Cliente desde {formatarData(c.created_at)}</span>
        </li>
      </ul>

      <div>
        <h4 className="cliente-info__secao">
          <Package size={15} aria-hidden="true" /> Pedidos ({c.total_pedidos})
        </h4>
        {c.pedidos.length === 0 ? (
          <p className="texto-suave texto-pequeno">Nenhum pedido ainda.</p>
        ) : (
          <ul className="cliente-info__pedidos">
            {c.pedidos.map((p) => {
              const conteudo = (
                <>
                  <span className="cliente-info__pedido-linha">
                    <strong>#{p.numero}</strong>
                    <span>{formatarMoeda(p.total)}</span>
                  </span>
                  <span className="cliente-info__pedido-linha">
                    <StatusBadge status={p.status} />
                    <small className="texto-suave">{formatarData(p.created_at)}</small>
                  </span>
                </>
              );
              return (
                <li key={p.id} className={p.id === pedidoAtualId ? 'is-atual' : ''}>
                  {podeVerPedidos ? (
                    <Link to={`/admin/pedidos/${p.id}`} className="cliente-info__pedido">
                      {conteudo}
                    </Link>
                  ) : (
                    <div className="cliente-info__pedido">{conteudo}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
