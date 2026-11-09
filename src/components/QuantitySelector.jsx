import { Minus, Plus } from 'lucide-react';

export default function QuantitySelector({ valor, min = 1, max, aoMudar, desabilitado = false, tamanho = 'md' }) {
  const alterar = (novo) => {
    const limitado = Math.max(min, Math.min(max ?? Infinity, novo));
    if (limitado !== valor) aoMudar(limitado);
  };

  return (
    <div className={`qty qty--${tamanho}`} role="group" aria-label="Quantidade">
      <button
        type="button"
        className="qty__btn"
        onClick={() => alterar(valor - 1)}
        disabled={desabilitado || valor <= min}
        aria-label="Diminuir quantidade"
      >
        <Minus size={16} />
      </button>
      <input
        className="qty__input"
        type="number"
        inputMode="numeric"
        value={valor}
        min={min}
        max={max}
        disabled={desabilitado}
        aria-label="Quantidade"
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!Number.isNaN(n)) alterar(n);
        }}
      />
      <button
        type="button"
        className="qty__btn"
        onClick={() => alterar(valor + 1)}
        disabled={desabilitado || (max !== undefined && valor >= max)}
        aria-label="Aumentar quantidade"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
