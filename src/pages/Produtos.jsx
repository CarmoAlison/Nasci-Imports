import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SearchX, SlidersHorizontal, X } from 'lucide-react';
import ProductGrid from '../components/ProductGrid';
import Pagination from '../components/Pagination';
import EmptyState from '../components/EmptyState';
import FormField from '../components/FormField';
import { listarProdutos } from '../services/produtos';
import { listarCategoriasAtivas } from '../services/categorias';
import { useDebounce } from '../hooks/useDebounce';
import { ORDENACOES, PRODUTOS_POR_PAGINA } from '../utils/constants';
import { traduzirErro } from '../utils/errors';

export default function Produtos() {
  const [params, setParams] = useSearchParams();
  const [categorias, setCategorias] = useState([]);
  const [resultado, setResultado] = useState({ produtos: [], total: 0 });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  const busca = params.get('busca') || '';
  const categoria = params.get('categoria') || '';
  const precoMin = params.get('min') || '';
  const precoMax = params.get('max') || '';
  const ordem = params.get('ordem') || 'recentes';
  const somenteDestaques = params.get('destaque') === '1';
  const pagina = Math.max(1, Number(params.get('pagina')) || 1);

  // texto digitado com debounce antes de ir para a URL
  const [buscaLocal, setBuscaLocal] = useState(busca);
  const buscaDebounced = useDebounce(buscaLocal, 450);

  const atualizar = (novos, resetarPagina = true) => {
    const p = new URLSearchParams(params);
    Object.entries(novos).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    if (resetarPagina) p.delete('pagina');
    setParams(p);
  };

  useEffect(() => {
    setBuscaLocal(busca);
  }, [busca]);

  useEffect(() => {
    if (buscaDebounced !== busca) atualizar({ busca: buscaDebounced.trim() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscaDebounced]);

  useEffect(() => {
    listarCategoriasAtivas()
      .then(setCategorias)
      .catch(() => {});
  }, []);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro('');
    listarProdutos({ busca, categoria, precoMin, precoMax, ordem, pagina, somenteDestaques })
      .then((r) => ativo && setResultado(r))
      .catch((e) => ativo && setErro(traduzirErro(e)))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [busca, categoria, precoMin, precoMax, ordem, pagina, somenteDestaques, tentativa]);

  const totalPaginas = Math.ceil(resultado.total / PRODUTOS_POR_PAGINA);
  const temFiltro = busca || categoria || precoMin || precoMax || somenteDestaques;
  const nomeCategoria = categorias.find((c) => c.slug === categoria)?.nome;

  const limpar = () => {
    setBuscaLocal('');
    setParams(new URLSearchParams(ordem !== 'recentes' ? { ordem } : {}));
  };

  return (
    <div className="container catalogo">
      <div className="catalogo__topo">
        <div>
          <h1>{nomeCategoria || (busca ? `Resultados para "${busca}"` : somenteDestaques ? 'Destaques' : 'Produtos')}</h1>
          {somenteDestaques && (
            <button type="button" className="chip is-ativo chip--removivel" onClick={() => atualizar({ destaque: '' })}>
              Somente destaques ✕
            </button>
          )}
          {!carregando && (
            <p className="texto-suave">
              {resultado.total} {resultado.total === 1 ? 'produto encontrado' : 'produtos encontrados'}
            </p>
          )}
        </div>
        <button
          type="button"
          className="btn btn--outline catalogo__btn-filtros"
          onClick={() => setFiltrosAbertos((v) => !v)}
          aria-expanded={filtrosAbertos}
          aria-controls="filtros"
        >
          <SlidersHorizontal size={18} aria-hidden="true" /> Filtros
        </button>
      </div>

      <div className="catalogo__grid">
        <aside id="filtros" className={`filtros ${filtrosAbertos ? 'is-aberto' : ''}`} aria-label="Filtros">
          <FormField
            label="Buscar"
            type="search"
            placeholder="Nome do produto..."
            value={buscaLocal}
            onChange={(e) => setBuscaLocal(e.target.value)}
          />
          <FormField
            as="select"
            label="Categoria"
            value={categoria}
            onChange={(e) => atualizar({ categoria: e.target.value })}
          >
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.nome}
              </option>
            ))}
          </FormField>
          <div className="filtros__preco">
            <FormField
              label="Preço mín."
              type="number"
              min="0"
              inputMode="decimal"
              placeholder="R$ 0"
              value={precoMin}
              onChange={(e) => atualizar({ min: e.target.value })}
            />
            <FormField
              label="Preço máx."
              type="number"
              min="0"
              inputMode="decimal"
              placeholder="R$ 10.000"
              value={precoMax}
              onChange={(e) => atualizar({ max: e.target.value })}
            />
          </div>
          <FormField as="select" label="Ordenar por" value={ordem} onChange={(e) => atualizar({ ordem: e.target.value })}>
            {ORDENACOES.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.nome}
              </option>
            ))}
          </FormField>
          {temFiltro && (
            <button type="button" className="btn btn--ghost btn--block" onClick={limpar}>
              <X size={16} aria-hidden="true" /> Limpar filtros
            </button>
          )}
        </aside>

        <section aria-live="polite">
          {erro ? (
            <EmptyState icone={SearchX} titulo="Não foi possível carregar os produtos" descricao={erro}>
              <button type="button" className="btn btn--primary" onClick={() => setTentativa((t) => t + 1)}>
                Tentar novamente
              </button>
            </EmptyState>
          ) : !carregando && resultado.produtos.length === 0 ? (
            <EmptyState
              icone={SearchX}
              titulo="Nenhum produto encontrado"
              descricao="Tente outros termos de busca ou remova alguns filtros."
            >
              {temFiltro && (
                <button type="button" className="btn btn--primary" onClick={limpar}>
                  Limpar filtros
                </button>
              )}
            </EmptyState>
          ) : (
            <>
              <ProductGrid produtos={resultado.produtos} carregando={carregando} />
              <Pagination
                pagina={pagina}
                totalPaginas={totalPaginas}
                aoMudar={(p) => {
                  atualizar({ pagina: p > 1 ? String(p) : '' }, false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
