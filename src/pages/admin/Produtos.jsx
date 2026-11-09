import { useCallback, useEffect, useState } from 'react';
import { Package, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import ProdutoForm from '../../components/admin/ProdutoForm';
import ProductImage from '../../components/ProductImage';
import EmptyState from '../../components/EmptyState';
import Pagination from '../../components/Pagination';
import { LinhasSkeleton } from '../../components/Skeleton';
import { usePermission } from '../../hooks/usePermission';
import { useDebounce } from '../../hooks/useDebounce';
import { adminListarProdutos, excluirProduto, imagemPrincipal } from '../../services/produtos';
import { adminListarCategorias } from '../../services/categorias';
import { formatarMoeda } from '../../utils/format';
import { traduzirErro } from '../../utils/errors';

const POR_PAGINA = 20;

export default function Produtos() {
  const { pode } = usePermission();
  const [busca, setBusca] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [status, setStatus] = useState('');
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState({ produtos: [], total: 0 });
  const [categorias, setCategorias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(null); // null | 'novo' | id
  const [excluindo, setExcluindo] = useState(null);
  const [processando, setProcessando] = useState(false);
  const buscaDebounced = useDebounce(busca);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setResultado(await adminListarProdutos({ busca: buscaDebounced, categoriaId, status, pagina, porPagina: POR_PAGINA }));
    } catch (e) {
      toast.error(traduzirErro(e));
    } finally {
      setCarregando(false);
    }
  }, [buscaDebounced, categoriaId, status, pagina]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    adminListarCategorias()
      .then(setCategorias)
      .catch(() => {});
  }, []);

  useEffect(() => setPagina(1), [buscaDebounced, categoriaId, status]);

  // ao fechar, recarrega a lista (fotos podem ter mudado)
  const fechar = useCallback(() => {
    setEditando(null);
    carregar();
  }, [carregar]);

  const confirmarExclusao = async () => {
    setProcessando(true);
    try {
      await excluirProduto(excluindo.id);
      toast.success('Produto excluído.');
      setExcluindo(null);
      carregar();
    } catch (e) {
      toast.error(traduzirErro(e));
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="stack">
      <div className="pagina-admin__topo">
        <h1>Produtos</h1>
        {pode('produtos', 'criar') && (
          <button type="button" className="btn btn--primary" onClick={() => setEditando('novo')}>
            <Plus size={18} aria-hidden="true" /> Novo produto
          </button>
        )}
      </div>

      <div className="filtros-admin">
        <div className="input-icone">
          <Search size={18} aria-hidden="true" />
          <label htmlFor="busca-produtos" className="sr-only">
            Buscar produtos
          </label>
          <input
            id="busca-produtos"
            className="input"
            type="search"
            placeholder="Buscar por nome..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <label className="sr-only" htmlFor="filtro-categoria">
          Categoria
        </label>
        <select id="filtro-categoria" className="input" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
          <option value="">Todas as categorias</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="filtro-status">
          Status
        </label>
        <select id="filtro-status" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos</option>
          <option value="ativos">Ativos</option>
          <option value="inativos">Inativos</option>
        </select>
      </div>

      {carregando ? (
        <LinhasSkeleton />
      ) : resultado.produtos.length === 0 ? (
        <EmptyState icone={Package} titulo="Nenhum produto encontrado" descricao="Ajuste os filtros ou cadastre um produto." />
      ) : (
        <>
          <div className="tabela-wrapper">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Categoria</th>
                  <th>Preço</th>
                  <th>Estoque</th>
                  <th>Status</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {resultado.produtos.map((p) => (
                  <tr key={p.id}>
                    <td data-label="Produto">
                      <div className="celula-produto">
                        <div className="celula-produto__img">
                          <ProductImage src={imagemPrincipal(p.imagens)} alt="" />
                        </div>
                        <strong>{p.nome}</strong>
                      </div>
                    </td>
                    <td data-label="Categoria">{p.categoria?.nome || '—'}</td>
                    <td data-label="Preço">{formatarMoeda(p.preco)}</td>
                    <td data-label="Estoque">
                      <span className={p.estoque <= p.estoque_minimo ? 'texto-aviso' : ''}>{p.estoque}</span>
                    </td>
                    <td data-label="Status">
                      <span className={`badge ${p.ativo ? 'badge--success' : 'badge--muted'}`}>{p.ativo ? 'Ativo' : 'Inativo'}</span>
                      {p.destaque && <span className="badge">Destaque</span>}
                    </td>
                    <td className="tabela__acoes">
                      <button type="button" className="icon-btn" onClick={() => setEditando(p.id)} aria-label={`Editar ${p.nome}`}>
                        <Pencil size={16} />
                      </button>
                      {pode('produtos', 'excluir') && (
                        <button
                          type="button"
                          className="icon-btn icon-btn--danger"
                          onClick={() => setExcluindo(p)}
                          aria-label={`Excluir ${p.nome}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagina={pagina} totalPaginas={Math.ceil(resultado.total / POR_PAGINA)} aoMudar={setPagina} />
        </>
      )}

      <Modal
        aberto={Boolean(editando)}
        aoFechar={fechar}
        titulo={editando === 'novo' ? 'Novo produto' : 'Editar produto'}
        tamanho="lg"
      >
        {editando && (
          <ProdutoForm
            key={editando}
            produtoId={editando === 'novo' ? null : editando}
            categorias={categorias}
            aoSalvar={carregar}
            aoFechar={fechar}
          />
        )}
      </Modal>

      <ConfirmDialog
        aberto={Boolean(excluindo)}
        titulo="Excluir produto"
        mensagem={`Excluir "${excluindo?.nome}" e todas as suas fotos? Pedidos antigos mantêm o nome e o preço registrados.`}
        textoConfirmar="Excluir"
        perigo
        carregando={processando}
        aoConfirmar={confirmarExclusao}
        aoCancelar={() => setExcluindo(null)}
      />
    </div>
  );
}
