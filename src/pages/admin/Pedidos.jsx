import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Search, ShoppingBag } from 'lucide-react';
import toast from 'react-hot-toast';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import StatusBadge from '../../components/StatusBadge';
import { LinhasSkeleton } from '../../components/Skeleton';
import { usePermission } from '../../hooks/usePermission';
import { useDebounce } from '../../hooks/useDebounce';
import { supabase } from '../../services/supabase';
import { adminListarPedidos, alterarStatusPedido } from '../../services/pedidos';
import { ORDEM_STATUS, STATUS_PEDIDO } from '../../utils/constants';
import { formatarDataHora, formatarMoeda } from '../../utils/format';
import { traduzirErro } from '../../utils/errors';

const POR_PAGINA = 20;

export default function Pedidos() {
  const { pode } = usePermission();
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState({ pedidos: [], total: 0 });
  const [carregando, setCarregando] = useState(true);
  const [alterando, setAlterando] = useState(null);
  const buscaDebounced = useDebounce(busca);

  const carregar = useCallback(
    async (silencioso = false) => {
      if (!silencioso) setCarregando(true);
      try {
        setResultado(
          await adminListarPedidos({ busca: buscaDebounced, status, dataInicio, dataFim, pagina, porPagina: POR_PAGINA }),
        );
      } catch (e) {
        toast.error(traduzirErro(e));
      } finally {
        setCarregando(false);
      }
    },
    [buscaDebounced, status, dataInicio, dataFim, pagina],
  );

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => setPagina(1), [buscaDebounced, status, dataInicio, dataFim]);

  // Novos pedidos chegando em tempo real
  useEffect(() => {
    const canal = supabase
      .channel('admin-pedidos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => carregar(true))
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [carregar]);

  const mudarStatus = async (pedido, novo) => {
    if (novo === pedido.status) return;
    setAlterando(pedido.id);
    try {
      await alterarStatusPedido(pedido.id, novo);
      setResultado((r) => ({ ...r, pedidos: r.pedidos.map((p) => (p.id === pedido.id ? { ...p, status: novo } : p)) }));
      toast.success(`Pedido #${pedido.numero}: ${STATUS_PEDIDO[novo].label}. Cliente notificado.`);
    } catch (e) {
      toast.error(traduzirErro(e));
    } finally {
      setAlterando(null);
    }
  };

  const podeStatus = pode('pedidos', 'alterar_status');

  return (
    <div className="stack">
      <div className="pagina-admin__topo">
        <h1>Pedidos</h1>
      </div>

      <div className="filtros-admin">
        <div className="input-icone">
          <Search size={18} aria-hidden="true" />
          <label htmlFor="busca-pedidos" className="sr-only">
            Buscar pedidos
          </label>
          <input
            id="busca-pedidos"
            className="input"
            type="search"
            placeholder="Nº do pedido, nome ou e-mail..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <label className="sr-only" htmlFor="filtro-status-pedido">
          Status
        </label>
        <select id="filtro-status-pedido" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos os status</option>
          {ORDEM_STATUS.map((s) => (
            <option key={s} value={s}>
              {STATUS_PEDIDO[s].label}
            </option>
          ))}
        </select>
        <label className="filtro-data">
          <span>De</span>
          <input type="date" className="input" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
        </label>
        <label className="filtro-data">
          <span>Até</span>
          <input type="date" className="input" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
        </label>
      </div>

      {carregando ? (
        <LinhasSkeleton />
      ) : resultado.pedidos.length === 0 ? (
        <EmptyState icone={ShoppingBag} titulo="Nenhum pedido encontrado" descricao="Os pedidos aparecem aqui assim que os clientes finalizarem a compra." />
      ) : (
        <>
          <div className="tabela-wrapper">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Data</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {resultado.pedidos.map((p) => (
                  <tr key={p.id}>
                    <td data-label="Pedido">
                      <strong>#{p.numero}</strong>
                      <small className="texto-suave bloco">{p.itens?.[0]?.count ?? 0} item(ns)</small>
                    </td>
                    <td data-label="Cliente">
                      {p.cliente_nome}
                      <small className="texto-suave bloco">{p.cliente_email}</small>
                    </td>
                    <td data-label="Data">{formatarDataHora(p.created_at)}</td>
                    <td data-label="Total">{formatarMoeda(p.total)}</td>
                    <td data-label="Status">
                      {podeStatus ? (
                        <select
                          className="input input--sm"
                          value={p.status}
                          disabled={alterando === p.id}
                          onChange={(e) => mudarStatus(p, e.target.value)}
                          aria-label={`Status do pedido ${p.numero}`}
                        >
                          {ORDEM_STATUS.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_PEDIDO[s].label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <StatusBadge status={p.status} />
                      )}
                    </td>
                    <td className="tabela__acoes">
                      <Link to={`/admin/pedidos/${p.id}`} className="btn btn--ghost btn--sm">
                        <Eye size={16} aria-hidden="true" /> Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagina={pagina} totalPaginas={Math.ceil(resultado.total / POR_PAGINA)} aoMudar={setPagina} />
        </>
      )}
    </div>
  );
}
