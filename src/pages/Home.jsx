import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BatteryCharging, Headphones, Layers, MessageCircle, ShieldCheck, Smartphone, Sparkles, Truck } from 'lucide-react';
import toast from 'react-hot-toast';
import ProductGrid from '../components/ProductGrid';
import EmptyState from '../components/EmptyState';
import Skeleton from '../components/Skeleton';
import { listarDestaques, listarRecentes } from '../services/produtos';
import { listarCategoriasAtivas } from '../services/categorias';
import { traduzirErro } from '../utils/errors';

const ICONES_CATEGORIA = {
  celulares: Smartphone,
  capas: ShieldCheck,
  carregadores: BatteryCharging,
  fones: Headphones,
  peliculas: Layers,
};

export default function Home() {
  const [categorias, setCategorias] = useState([]);
  const [destaques, setDestaques] = useState([]);
  const [recentes, setRecentes] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    Promise.all([listarCategoriasAtivas(), listarDestaques(4), listarRecentes(8)])
      .then(([cats, dest, rec]) => {
        if (!ativo) return;
        setCategorias(cats);
        setDestaques(dest);
        setRecentes(rec);
      })
      .catch((e) => toast.error(traduzirErro(e)))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, []);

  return (
    <>
      <section className="hero">
        <div className="container hero__inner">
          <div className="hero__texto">
            <span className="badge">Novidades toda semana</span>
            <h1>
              Seu próximo celular está na <span className="destaque">Nasci Imports</span>
            </h1>
            <p>Smartphones e acessórios para você, preço justo e atendimento direto pelo chat.</p>
            <div className="hero__acoes">
              <Link to="/produtos" className="btn btn--primary btn--lg">
                Ver produtos <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link to="/produtos?categoria=celulares" className="btn btn--outline btn--lg">
                Celulares
              </Link>
            </div>
          </div>
          
        </div>
      </section>

      <section className="container beneficios" aria-label="Vantagens">
        <div className="beneficio">
          <ShieldCheck size={22} aria-hidden="true" />
          <span>Produtos com procedência</span>
        </div>
        <div className="beneficio">
          <MessageCircle size={22} aria-hidden="true" />
          <span>Atendimento pelo chat</span>
        </div>
        <div className="beneficio">
          <Truck size={22} aria-hidden="true" />
          <span>Entrega combinada com você</span>
        </div>
      </section>

      <section className="container secao">
        <div className="secao__toposecao__topo">
          <h2>Categorias</h2>
        </div>
        <div className="categorias-grid">
          {carregando
            ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} altura="96px" raio="var(--radius-lg)" />)
            : categorias.map((c) => {
                const Icone = ICONES_CATEGORIA[c.slug] || Sparkles;
                return (
                  <Link key={c.id} to={`/produtos?categoria=${c.slug}`} className="categoria-card">
                    <Icone size={20} aria-hidden="true" />
                    <span>{c.nome}</span>
                  </Link>
                );
              })}
        </div>
      </section>

      {(carregando || destaques.length > 0) && (
        <section className="container secao">
          <div className="destaques">
            <div className="secao__topo destaques__topo">
              <div>
                <h2 className="destaques__titulo">
                  <Sparkles size={22} aria-hidden="true" /> Destaques
                </h2>
                <p className="destaques__sub">Os mais procurados da Nasci Imports</p>
              </div>
              <Link to="/produtos?destaque=1" className="link destaques__ver">
                Ver todos <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <ProductGrid produtos={destaques} carregando={carregando} quantidadeSkeleton={4} />
          </div>
        </section>
      )}

      <section className="container secao">
        <div className="secao__topo">
          <h2>Chegaram agora</h2>
          <Link to="/produtos" className="link">
            Ver todos
          </Link>
        </div>
        {!carregando && recentes.length === 0 ? (
          <EmptyState icone={Smartphone} titulo="Nenhum produto cadastrado" descricao="Volte em breve para conferir as novidades." />
        ) : (
          <ProductGrid produtos={recentes} carregando={carregando} />
        )}
      </section>
    </>
  );
}
