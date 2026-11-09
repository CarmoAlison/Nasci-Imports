import { Link } from 'react-router-dom';
import Logo from './Logo';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__marca">
          <Logo />
          <p>Celulares e acessórios com procedência e atendimento próximo.</p>
        </div>
        <nav className="footer__links" aria-label="Rodapé">
          <Link to="/produtos">Produtos</Link>
          <Link to="/minha-conta/pedidos">Meus pedidos</Link>
          <Link to="/minha-conta/atendimento">Atendimento</Link>
        </nav>
        <p className="footer__copy">© {new Date().getFullYear()} Nasci Imports. Todos os direitos reservados.</p>
      </div>
    </footer>
  );
}
