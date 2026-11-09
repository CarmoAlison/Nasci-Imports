export default function Spinner({ tamanho = 'md', rotulo = 'Carregando...' }) {
  return (
    <span className={`spinner spinner--${tamanho}`} role="status" aria-live="polite">
      <span className="sr-only">{rotulo}</span>
    </span>
  );
}

export function PageLoader({ texto = 'Carregando...' }) {
  return (
    <div className="page-loader">
      <Spinner tamanho="lg" rotulo={texto} />
      <p>{texto}</p>
    </div>
  );
}
