import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="error-page">
      <span className="error-page__codigo" aria-hidden="true">
        404
      </span>
      <h1>Página não encontrada</h1>
      <p>O endereço que você acessou não existe ou foi removido.</p>
      <div className="hero__acoes">
        <Link to="/" className="btn btn--primary">
          Ir para o início
        </Link>
        <Link to="/produtos" className="btn btn--outline">
          Ver produtos
        </Link>
      </div>
    </div>
  );
}
