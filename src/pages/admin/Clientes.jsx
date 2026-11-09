import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Search, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import StatusBadge from '../../components/StatusBadge';
import Spinner from '../../components/Spinner';
import { LinhasSkeleton } from '../../components/Skeleton';
import { usePermission } from '../../hooks/usePermission';
import { useDebounce } from '../../hooks/useDebounce';
import { detalheCliente, listarClientes } from '../../services/admin';
import { formatarData, formatarDataHora, formatarEndereco, formatarMoeda } from '../../utils/format';
import { mascaraCPF, mascaraTelefone } from '../../utils/masks';
import { traduzirErro } from '../../utils/errors';

const POR_PAGINA = 20;

export default function Clientes() {
  const { pode } = usePermission();
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState({ clientes: [], total: 0 });
  const [carregando, setCarregando] = useState(true);
  const [detalhe, setDetalhe] = useState(null); // { carregando, dados }
  const buscaDebounced = useDebounce(busca);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setResultado(await listarClientes({ busca: buscaDebounced, pagina, porPagina: POR_PAGINA }));
    } catch (e) {
      toast.error(traduzirErro(e));
    } finally {
      setCarregando(false);
    }
  }, [buscaDebounced, pagina]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => setPagina(1), [buscaDebounced]);

  const abrir = async (id) => {
    setDetalhe({ carregando: true, dados: null });
    try {
      setDetalhe({ carregando: false, dados: await detalheCliente(id) });
    } catch (e) {
      toast.error(traduzirErro(e));
      setDetalhe(null);
    }
  };

  const cpfFmt = (cpf) => (cpf && /^\d{11}$/.test(cpf) ? mascaraCPF(cpf) : cpf || '—');

  return (
    <div className="stack">
      <div className="pagina-admin__topo">
        <h1>Clientes</h1>
        {!carregando && <span className="texto-suave">{resultado.total} cliente(s)</span>}
      </div>

      <div className="filtros-admin">
        <div className="input-icone">
          <Search size={18} aria-hidden="true" />
          <label htmlFor="busca-clientes" className="sr-only">
            Buscar clientes
          </label>
          <input
            id="busca-clientes"
            className="input"
            type="search"
            placeholder={`Nome, e-mail, usuário, telefone${pode('clientes', 'ver_cpf') ? ' ou CPF' : ''}...`}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </div>

      {carregando ? (
        <LinhasSkeleton />
      ) : resultado.clientes.length === 0 ? (
        <EmptyState icone={Users} titulo="Nenhum cliente encontrado" />
      ) : (
        <>
          <div className="tabela-wrapper">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Telefone</th>
                  <th>CPF</th>
                  <th>Cidade</th>
                  <th>Pedidos</th>
                  <th>Desde</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {resultado.clientes.map((c) => (
                  <tr key={c.id}>
                    <td data-label="Cliente">
                      <strong>{c.nome_completo}</strong>
                      <small className="texto-suave bloco">{c.email}</small>
                    </td>
                    <td data-label="Telefone">{c.telefone ? mascaraTelefone(c.telefone) : '—'}</td>
                    <td data-label="CPF">{cpfFmt(c.cpf)}</td>
                    <td data-label="Cidade">{c.cidade ? `${c.cidade}/${c.uf}` : '—'}</td>
                    <td data-label="Pedidos">{c.total_pedidos}</td>
                    <td data-label="Desde">{formatarData(c.created_at)}</td>
                    <td className="tabela__acoes">
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => abrir(c.id)}>
                        <Eye size={16} aria-hidden="true" /> Detalhes
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagina={pagina} totalPaginas={Math.ceil(resultado.total / POR_PAGINA)} aoMudar={setPagina} />
        </>
      )}

      <Modal aberto={Boolean(detalhe)} aoFechar={() => setDetalhe(null)} titulo="Detalhes do cliente" tamanho="lg">
        {detalhe?.carregando || !detalhe?.dados ? (
          <div className="centralizado">
            <Spinner />
          </div>
        ) : (
          <div className="stack">
            <dl className="specs">
              <div className="specs__linha">
                <dt>Nome</dt>
                <dd>{detalhe.dados.nome_completo}</dd>
              </div>
              <div className="specs__linha">
                <dt>E-mail</dt>
                <dd>{detalhe.dados.email}</dd>
              </div>
              <div className="specs__linha">
                <dt>Usuário</dt>
                <dd>@{detalhe.dados.username}</dd>
              </div>
              <div className="specs__linha">
                <dt>CPF</dt>
                <dd>
                  {cpfFmt(detalhe.dados.cpf)}
                  {!detalhe.dados.cpf_visivel && <small className="texto-suave"> (oculto pelo seu perfil)</small>}
                </dd>
              </div>
              <div className="specs__linha">
                <dt>Telefone</dt>
                <dd>{detalhe.dados.telefone ? mascaraTelefone(detalhe.dados.telefone) : '—'}</dd>
              </div>
              <div className="specs__linha">
                <dt>Endereço</dt>
                <dd>{detalhe.dados.cep ? formatarEndereco(detalhe.dados) : 'Não informado'}</dd>
              </div>
              <div className="specs__linha">
                <dt>Cliente desde</dt>
                <dd>{formatarDataHora(detalhe.dados.created_at)}</dd>
              </div>
            </dl>

            <h3>Pedidos ({detalhe.dados.pedidos.length})</h3>
            {detalhe.dados.pedidos.length === 0 ? (
              <p className="texto-suave">Nenhum pedido.</p>
            ) : (
              <ul className="lista-simples">
                {detalhe.dados.pedidos.map((p) => (
                  <li key={p.id}>
                    {pode('pedidos', 'ver') ? (
                      <Link to={`/admin/pedidos/${p.id}`} className="link">
                        #{p.numero}
                      </Link>
                    ) : (
                      <span>#{p.numero}</span>
                    )}
                    <span className="texto-suave texto-pequeno">{formatarData(p.created_at)}</span>
                    <StatusBadge status={p.status} />
                    <strong>{formatarMoeda(p.total)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
