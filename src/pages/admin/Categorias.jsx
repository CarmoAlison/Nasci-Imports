import { useCallback, useEffect, useState } from 'react';
import { FolderTree, Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import FormField from '../../components/FormField';
import EmptyState from '../../components/EmptyState';
import Spinner from '../../components/Spinner';
import { LinhasSkeleton } from '../../components/Skeleton';
import { usePermission } from '../../hooks/usePermission';
import { adminListarCategorias, excluirCategoria, salvarCategoria } from '../../services/categorias';
import { slugify } from '../../utils/format';
import { traduzirErro } from '../../utils/errors';

const VAZIO = { nome: '', slug: '', descricao: '', ordem: 0, ativo: true };

export default function Categorias() {
  const { pode } = usePermission();
  const [categorias, setCategorias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(null); // null | 'nova' | categoria
  const [form, setForm] = useState(VAZIO);
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(null);
  const [processandoExclusao, setProcessandoExclusao] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setCategorias(await adminListarCategorias());
    } catch (e) {
      toast.error(traduzirErro(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const abrir = (cat) => {
    setEditando(cat || 'nova');
    setForm(cat ? { nome: cat.nome, slug: cat.slug, descricao: cat.descricao || '', ordem: cat.ordem, ativo: cat.ativo } : VAZIO);
    setErros({});
  };

  const salvar = async (e) => {
    e.preventDefault();
    const slug = form.slug || slugify(form.nome);
    const novos = {};
    if (!form.nome.trim()) novos.nome = 'Informe o nome.';
    if (!/^[a-z0-9-]+$/.test(slug)) novos.slug = 'Use letras minúsculas, números e hífen.';
    setErros(novos);
    if (Object.keys(novos).length) return;

    setSalvando(true);
    try {
      await salvarCategoria(editando === 'nova' ? null : editando.id, {
        nome: form.nome.trim(),
        slug,
        descricao: form.descricao.trim() || null,
        ordem: Number(form.ordem) || 0,
        ativo: form.ativo,
      });
      toast.success(editando === 'nova' ? 'Categoria criada!' : 'Categoria atualizada!');
      setEditando(null);
      carregar();
    } catch (e2) {
      toast.error(traduzirErro(e2));
    } finally {
      setSalvando(false);
    }
  };

  const confirmarExclusao = async () => {
    setProcessandoExclusao(true);
    try {
      await excluirCategoria(excluindo.id);
      toast.success('Categoria excluída.');
      setExcluindo(null);
      carregar();
    } catch (e) {
      toast.error(traduzirErro(e));
    } finally {
      setProcessandoExclusao(false);
    }
  };

  return (
    <div className="stack">
      <div className="pagina-admin__topo">
        <h1>Categorias</h1>
        {pode('categorias', 'criar') && (
          <button type="button" className="btn btn--primary" onClick={() => abrir(null)}>
            <Plus size={18} aria-hidden="true" /> Nova categoria
          </button>
        )}
      </div>

      {carregando ? (
        <LinhasSkeleton />
      ) : categorias.length === 0 ? (
        <EmptyState icone={FolderTree} titulo="Nenhuma categoria" descricao="Crie a primeira categoria da loja." />
      ) : (
        <div className="tabela-wrapper">
          <table className="tabela">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tag</th>
                <th>Produtos</th>
                <th>Ordem</th>
                <th>Status</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {categorias.map((c) => (
                <tr key={c.id}>
                  <td data-label="Nome">
                    <strong>{c.nome}</strong>
                  </td>
                  <td data-label="Slug" className="texto-suave">
                    {c.slug}
                  </td>
                  <td data-label="Produtos">{c.produtos?.[0]?.count ?? 0}</td>
                  <td data-label="Ordem">{c.ordem}</td>
                  <td data-label="Status">
                    <span className={`badge ${c.ativo ? 'badge--success' : 'badge--muted'}`}>{c.ativo ? 'Ativa' : 'Inativa'}</span>
                  </td>
                  <td className="tabela__acoes">
                    {pode('categorias', 'editar') && (
                      <button type="button" className="icon-btn" onClick={() => abrir(c)} aria-label={`Editar ${c.nome}`}>
                        <Pencil size={16} />
                      </button>
                    )}
                    {pode('categorias', 'excluir') && (
                      <button
                        type="button"
                        className="icon-btn icon-btn--danger"
                        onClick={() => setExcluindo(c)}
                        aria-label={`Excluir ${c.nome}`}
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
      )}

      <Modal
        aberto={Boolean(editando)}
        aoFechar={() => !salvando && setEditando(null)}
        titulo={editando === 'nova' ? 'Nova categoria' : 'Editar categoria'}
      >
        <form onSubmit={salvar} noValidate className="stack">
          <FormField
            label="Nome"
            obrigatorio
            value={form.nome}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                nome: e.target.value,
                slug: editando === 'nova' || !f.slug ? slugify(e.target.value) : f.slug,
              }))
            }
            erro={erros.nome}
          />
          <FormField
            label="Tag"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
            erro={erros.slug}
            ajuda="Tag para o cliente conseguir pesquisar"
          />
          <FormField
            as="textarea"
            label="Descrição"
            rows={2}
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          />
          <FormField
            label="Ordem de exibição"
            type="number"
            value={form.ordem}
            onChange={(e) => setForm({ ...form, ordem: e.target.value })}
          />
          <label className="checkbox">
            <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
            Categoria ativa (visível na loja)
          </label>
          <div className="modal__acoes">
            <button type="button" className="btn btn--ghost" onClick={() => setEditando(null)} disabled={salvando}>
              Cancelar
            </button>
            <button type="submit" className="btn btn--primary" disabled={salvando}>
              {salvando && <Spinner tamanho="sm" />}
              Salvar
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        aberto={Boolean(excluindo)}
        titulo="Excluir categoria"
        mensagem={`Excluir "${excluindo?.nome}"? Os produtos desta categoria ficarão sem categoria.`}
        textoConfirmar="Excluir"
        perigo
        carregando={processandoExclusao}
        aoConfirmar={confirmarExclusao}
        aoCancelar={() => setExcluindo(null)}
      />
    </div>
  );
}
