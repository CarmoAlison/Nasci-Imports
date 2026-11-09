import ProductCard from './ProductCard';
import { ProductCardSkeleton } from './Skeleton';

export default function ProductGrid({ produtos, carregando, quantidadeSkeleton = 8 }) {
  if (carregando) {
    return (
      <div className="product-grid">
        {Array.from({ length: quantidadeSkeleton }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="product-grid">
      {produtos.map((p) => (
        <ProductCard key={p.id} produto={p} />
      ))}
    </div>
  );
}
