import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/** Modal acessível: fecha com ESC ou clique no fundo e devolve o foco ao fechar */
export default function Modal({ aberto, aoFechar, titulo, children, rodape, tamanho = 'md' }) {
  const ref = useRef(null);
  const aoFecharRef = useRef(aoFechar);
  useEffect(() => {
    aoFecharRef.current = aoFechar;
  }, [aoFechar]);

  useEffect(() => {
    if (!aberto) return undefined;
    const anterior = document.activeElement;
    const aoTeclar = (e) => {
      if (e.key === 'Escape') aoFecharRef.current?.();
    };
    document.addEventListener('keydown', aoTeclar);
    document.body.classList.add('sem-scroll');
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.classList.remove('sem-scroll');
      anterior?.focus?.();
    };
  }, [aberto]);

  if (!aberto) return null;

  return createPortal(
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && aoFechar?.()}>
      <div
        className={`modal modal--${tamanho}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-titulo"
        tabIndex={-1}
        ref={ref}
      >
        <header className="modal__header">
          <h2 id="modal-titulo">{titulo}</h2>
          <button type="button" className="icon-btn" onClick={() => aoFechar?.()} aria-label="Fechar">
            <X size={20} />
          </button>
        </header>
        <div className="modal__body">{children}</div>
        {rodape && <footer className="modal__footer">{rodape}</footer>}
      </div>
    </div>,
    document.body,
  );
}
