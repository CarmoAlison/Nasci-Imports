import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Pagination({ pagina, totalPaginas, aoMudar }) {
  if (totalPaginas <= 1) return null;

  const inicio = Math.max(1, pagina - 2);
  const fim = Math.min(totalPaginas, pagina + 2);
  const paginas = [];
  for (let p = inicio; p <= fim; p++) paginas.push(p);

  return (
    <nav className="pagination" aria-label="Paginação">
      <button
        type="button"
        className="pagination__btn"
        onClick={() => aoMudar(pagina - 1)}
        disabled={pagina <= 1}
        aria-label="Página anterior"
      >
        <ChevronLeft size={18} />
      </button>
      {inicio > 1 && (
        <>
          <button type="button" className="pagination__btn" onClick={() => aoMudar(1)}>
            1
          </button>
          {inicio > 2 && <span className="pagination__reticencias">…</span>}
        </>
      )}
      {paginas.map((p) => (
        <button
          key={p}
          type="button"
          className={`pagination__btn ${p === pagina ? 'is-ativo' : ''}`}
          onClick={() => aoMudar(p)}
          aria-current={p === pagina ? 'page' : undefined}
        >
          {p}
        </button>
      ))}
      {fim < totalPaginas && (
        <>
          {fim < totalPaginas - 1 && <span className="pagination__reticencias">…</span>}
          <button type="button" className="pagination__btn" onClick={() => aoMudar(totalPaginas)}>
            {totalPaginas}
          </button>
        </>
      )}
      <button
        type="button"
        className="pagination__btn"
        onClick={() => aoMudar(pagina + 1)}
        disabled={pagina >= totalPaginas}
        aria-label="Próxima página"
      >
        <ChevronRight size={18} />
      </button>
    </nav>
  );
}
