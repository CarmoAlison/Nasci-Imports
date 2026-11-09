import { useState } from 'react';
import { Link } from 'react-router-dom';
import logoImg from '../assets/Logo-nasci.jpg';

/**
 * Mostra a logo da loja (src/assets/Logo-nasci.jpg). Se a imagem não carregar,
 * mostra o nome em texto com destaque verde.
 */
export default function Logo({ to = '/', compacto = false }) {
  const [imagemFalhou, setImagemFalhou] = useState(false);

  return (
    <Link to={to} className="logo" aria-label="Nasci Imports — página inicial">
<img src={logoImg} alt="Nasci Imports" className="logo__img"/>
<span className="logo__destaque">Nasci </span>
          {!compacto && <span> Imports</span>}
      {/* {!imagemFalhou ? (
        <img src={logoImg} alt="Nasci Imports" className="logo__img" onError={() => setImagemFalhou(true)} />
        
      ) : (
        <span className="logo__texto">

          <span className="logo__destaque">Nasci</span>
          {!compacto && <span> Imports</span>}
        </span>
      )} */}
    </Link>
  );
}
