import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Boxes, History, PackageX, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';
import Spinner from '../../components/Spinner';
import { LinhasSkeleton } from '../../components/Skeleton';
import TabelaMovimentacoes from '../../components/admin/TabelaMovimentacoes';
import { usePermission } from '../../hooks/usePermission';
import { listarEstoque, listarMovimentacoes } from '../../services/admin';
import { traduzirErro } from '../../utils/errors';

const FILTROS = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'baixo', rotulo: 'Estoque baixo' },
  { valor: 'esgotado', rotulo: 'Esgotados' },
];

/** Visão geral do estoque. Entradas e saídas ficam em páginas próprias. */
export default function Estoque() {
  const { pode } = usePermission();
  const podeMov = pode('estoque', 'movimentar');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [produtos, setProdutos] = useState([]);
  const [movs, setMovs] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [historicoDe, setHistoricoDe] = useState(null);

  const carregar = useCallback(async () => {
    try {
      const [lista, ultimas] = await Promise.all([listarEstoque({ busca: '' }), listarMovimentacoes({ limite: 20 })]);
      setProdutos(lista);
      setMovs(ultimas);
    } catch (e) {
      toast.error(traduzirErro(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const resumo = useMemo(
    () => ({
      produtos: produtos.length,
      unidades: produtos.reduce((s, p) => s + p.estoque, 0),
      baixo: produtos.filter((p) => p.estoque > 0 && p.estoque <= p.estoque_minimo).length,
      esgotado: produtos.filter((p) => p.estoque === 0).length,
    }),
    [produtos],
  );

  const visiveis = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return produtos.filter((p) => {
      if (t && !p.nome.toLowerCase().includes(t)) return false;
      if (filtro === 'baixo') return p.estoque <= p.estoque_minimo;
      if (filtro === 'esgotado') return p.estoque === 0;
      return true;
    });
  }, [produtos, busca, filtro]);

  const verHistorico = async (produto) => {
    setHistoricoDe({ produto, itens: null });
    try {
      const itens = await listarMovimentacoes({ produtoId: produto.id, limite: 100 });
      setHistoricoDe({ produto, itens });
    } catch (e) {
      toast.error(traduzirErro(e));
      setHistoricoDe(null);
    }
  };

  return (
    <div className="stack">
      <div className="pagina-admin__topo">
        <h1>Estoque</h1>
        {podeMov && (
          <div className="acoes-topo">
            <Link to="/admin/estoque/entrada" className="btn btn--primary">
              <ArrowUpCircle size={18} aria-hidden="true" /> Entrada
            </Link>
            <Link to="/admin/estoque/saida" className="btn btn--saida">
              <ArrowDownCircle size={18} aria-hidden="true" /> Saída
            </Link>
          </div>
        )}
      </div>

      {/* Resumo: cada cartão de alerta também filtra a tabela */}
      <div className="stats">
        <div className="stat">
          <div className="stat__icone" aria-hidden="true">
            <Boxes size={20} />
          </div>
          <div>
            <span className="stat__titulo">Produtos</span>
            <strong className="stat__valor">{carregando ? '—' : resumo.produtos}</strong>
          </div>
        </div>
        <div className="stat">
          <div className="stat__icone" aria-hidden="true">
            <Boxes size={20} />
          </div>
          <div>
            <span className="stat__titulo">Unidades em estoque</span>
            <strong className="stat__valor">{carregando ? '—' : resumo.unidades}</strong>
          </div>
        </div>
        <button type="button" className="stat stat--botao stat--aviso" onClick={() => setFiltro('baixo')}>
          <div className="stat__icone" aria-hidden="true">
            <AlertTriangle size={20} />
          </div>
          <div>
            <span className="stat__titulo">Estoque baixo</span>
            <strong className="stat__valor">{carregando ? '—' : resumo.baixo}</strong>
          </div>
        </button>
        <button type="button" className="stat stat--botao stat--perigo" onClick={() => setFiltro('esgotado')}>
          <div className="stat__icone" aria-hidden="true">
            <PackageX size={20} />
          </div>
          <div>
            <span className="stat__titulo">Esgotados</span>
            <strong className="stat__valor">{carregando ? '—' : resumo.esgotado}</strong>
          </div>
        </button>
      </div>

      <div className="filtros-admin">
        <div className="input-icone">
          <Search size={18} aria-hidden="true" />
          <label htmlFor="busca-estoque" className="sr-only">
            Buscar produto
          </label>
          <input
            id="busca-estoque"
            className="input"
            type="search"
            placeholder="Buscar produto..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="chips" role="group" aria-label="Filtrar por situação">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              className={`chip ${filtro === f.valor ? 'is-ativo' : ''}`}
              onClick={() => setFiltro(f.valor)}
              aria-pressed={filtro === f.valor}
            >
              {f.rotulo}
            </button>
          ))}
        </div>
      </div>

      {carregando ? (
        <LinhasSkeleton />
      ) : visiveis.length === 0 ? (
        <EmptyState icone={Boxes} titulo="Nenhum produto encontrado" />
      ) : (
        <div className="tabela-wrapper">
          <table className="tabela">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Categoria</th>
                <th>Atual</th>
                <th>Mínimo</th>
                <th>Situação</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {visiveis.map((p) => {
                const baixo = p.estoque <= p.estoque_minimo;
                return (
                  <tr key={p.id} className={baixo ? 'linha-alerta' : ''}>
                    <td data-label="Produto">
                      <strong>{p.nome}</strong>
                      {!p.ativo && <small className="texto-suave bloco">Inativo</small>}
                    </td>
                    <td data-label="Categoria">{p.categoria?.nome || '—'}</td>
                    <td data-label="Atual">
                      <strong>{p.estoque}</strong>
                    </td>
                    <td data-label="Mínimo">{p.estoque_minimo}</td>
                    <td data-label="Situação">
                      {p.estoque === 0 ? (
                        <span className="badge badge--danger">Esgotado</span>
                      ) : baixo ? (
                        <span className="badge badge--warning">
                          <AlertTriangle size={12} aria-hidden="true" /> Baixo
                        </span>
                      ) : (
                        <span className="badge badge--success">OK</span>
                      )}
                    </td>
                    <td className="tabela__acoes">
                      {podeMov && (
                        <>
                          <Link
                            to={`/admin/estoque/entrada?produto=${p.id}`}
                            className="icon-btn"
                            aria-label={`Entrada de ${p.nome}`}
                            title="Entrada"
                          >
                            <ArrowUpCircle size={18} />
                          </Link>
                          {p.estoque > 0 && (
                            <Link
                              to={`/admin/estoque/saida?produto=${p.id}`}
                              className="icon-btn"
                              aria-label={`Saída de ${p.nome}`}
                              title="Saída"
                            >
                              <ArrowDownCircle size={18} />
                            </Link>
                          )}
                        </>
                      )}
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => verHistorico(p)}
                        aria-label={`Histórico de ${p.nome}`}
                        title="Histórico"
                      >
                        <History size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <section className="card">
        <h2 className="card__titulo">
          <History size={18} aria-hidden="true" /> Últimas movimentações
        </h2>
        <TabelaMovimentacoes itens={movs} mostrarProduto />
      </section>

      <Modal
        aberto={Boolean(historicoDe)}
        aoFechar={() => setHistoricoDe(null)}
        titulo={`Histórico — ${historicoDe?.produto.nome || ''}`}
        tamanho="lg"
      >
        {historicoDe?.itens ? (
          <TabelaMovimentacoes itens={historicoDe.itens} />
        ) : (
          <div className="centralizado">
            <Spinner />
          </div>
        )}
      </Modal>
    </div>
  );
}
