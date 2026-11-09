import { useState } from 'react';
import { Smartphone } from 'lucide-react';

/** Imagem de produto com placeholder quando não houver foto ou ela falhar */
export default function ProductImage({ src, alt, className = '', loading = 'lazy' }) {
  const [falhou, setFalhou] = useState(false);

  if (!src || falhou) {
    return (
      <div className={`product-image-placeholder ${className}`} role="img" aria-label={alt || 'Produto sem foto'}>
        <Smartphone size={40} aria-hidden="true" />
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} loading={loading} onError={() => setFalhou(true)} />;
}
