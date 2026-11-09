import ProductImage from './ProductImage';
import StatusBadge from './StatusBadge';
import { ORDEM_STATUS, STATUS_PEDIDO } from '../utils/constants';
import { formatarDataHora, formatarEndereco, formatarMoeda } from '../utils/format';

/** Linha do tempo do status do pedido */
export function StatusTimeline({ status, historico = [] }) {
  const indiceAtual = ORDEM_STATUS.indexOf(status);
  const dataDe = (s) => [...historico].reverse().find((h) => h.status_novo === s)?.created_at;

  return (
    <ol className="timeline">
      {ORDEM_STATUS.map((s, i) => (
        <li key={s} className={`timeline__passo ${i <= indiceAtual ? 'is-feito' : ''} ${i === indiceAtual ? 'is-atual' : ''}`}>
          <span className="timeline__ponto" aria-hidden="true" />
          <span className="timeline__label">{STATUS_PEDIDO[s].label}</span>
          {i <= indiceAtual && dataDe(s) && <small className="timeline__data">{formatarDataHora(dataDe(s))}</small>}
        </li>
      ))}
    </ol>
  );
}

/** Itens + total de um pedido */
export function ItensPedido({ itens = [], total }) {
  return (
    <div>
      <ul className="checkout__itens">
        {itens.map((i) => (
          <li key={i.id} className="checkout__item">
            <div className="checkout__item-img">
              <ProductImage src={i.produto_imagem} alt={i.produto_nome} />
            </div>
            <div className="checkout__item-info">
              <span>{i.produto_nome}</span>
              <small className="texto-suave">
                {i.quantidade} × {formatarMoeda(i.preco_unitario)}
              </small>
            </div>
            <strong>{formatarMoeda(i.subtotal ?? i.quantidade * i.preco_unitario)}</strong>
          </li>
        ))}
      </ul>
      <div className="resumo__linha resumo__total">
        <span>Total</span>
        <strong>{formatarMoeda(total)}</strong>
      </div>
    </div>
  );
}

export function EnderecoPedido({ endereco }) {
  return <p>{formatarEndereco(endereco)}</p>;
}

export function HistoricoStatus({ historico = [] }) {
  return (
    <ul className="historico">
      {[...historico].reverse().map((h) => (
        <li key={h.id}>
          <StatusBadge status={h.status_novo} />
          <span className="texto-suave texto-pequeno">
            {h.status_anterior ? `de ${STATUS_PEDIDO[h.status_anterior]?.label || h.status_anterior} · ` : 'Pedido criado · '}
            {formatarDataHora(h.created_at)}
          </span>
        </li>
      ))}
    </ul>
  );
}
