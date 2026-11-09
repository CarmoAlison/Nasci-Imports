export default function Skeleton({ largura = '100%', altura = '1rem', raio, className = '' }) {
  return (
    <span
      className={`skeleton ${className}`}
      style={{ width: largura, height: altura, borderRadius: raio }}
      aria-hidden="true"
    />
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="product-card product-card--skeleton" aria-hidden="true">
      <span className="skeleton product-card__media" />
      <div className="product-card__body">
        <Skeleton largura="40%" altura="0.75rem" />
        <Skeleton largura="90%" altura="1rem" />
        <Skeleton largura="50%" altura="1.25rem" />
      </div>
    </div>
  );
}

export function LinhasSkeleton({ linhas = 5 }) {
  return (
    <div className="stack" aria-hidden="true">
      {Array.from({ length: linhas }).map((_, i) => (
        <Skeleton key={i} altura="2.75rem" raio="var(--radius)" />
      ))}
    </div>
  );
}
