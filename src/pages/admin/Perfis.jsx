import { useCallback, useEffect, useState } from 'react';
import { Lock, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import FormField from '../../components/FormField';
import EmptyState from '../../components/EmptyState';
import Spinner from '../../components/Spinner';
import { LinhasSkeleton } from '../../components/Skeleton';
import { usePermission } from '../../hooks/usePermission';
import { excluirPerfilAcesso, listarPerfisAcesso, salvarPerfilAcesso } from '../../services/admin';
import { ACOES_BASICAS, MODULOS, PERMISSOES_EXTRAS } from '../../utils/constants';
import { traduzirErro } from '../../utils/errors';

const TODAS = [
  ...MODULOS.flatMap((m) => ACOES_BASICAS.map((a) => `${m.chave}.${a.chave}`)),
  ...PERMISSOES_EXTRAS.map((p) => `${p.modulo}.${p.acao}`),
];

export default function Perfis() {
  const { pode } = usePermission();
  const [perfis, setPerfis] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(null); // null | 'novo' | perfil
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [selecionadas, setSelecionadas] = useState(() => new Set());
  const [erroNome, setErroNome] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(null);
  const [processando, setProcessando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setPerfis(await listarPerfisAcesso());
    } catch (e) {
      toast.error(traduzirErro(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const abrir = (p) => {
    setEditando(p || 'novo');
    setNome(p?.nome || '');
    setDescricao(p?.descricao || '');
    setSelecionadas(new Set(p?.permissoes || []));
    setErroNome('');
  };

  const somenteLeitura = editando && editando !== 'novo' && (editando.sistema || !pode('perfis', 'editar'));

  const alternar = (chave) => {
    if (somenteLeitura) return;
    setSelecionadas((s) => {
      const n = new Set(s);
      if (n.has(chave)) n.delete(chave);
      else {
        n.add(chave);
        // qualquer ação exige "ver" no mesmo módulo
        const [modulo] = chave.split('.');
        n.add(`${modulo}.ver`);
      }
      return n;
    });
  };

  const alternarLinha = (modulo) => {
    if (somenteLeitura) return;
    const chaves = [...ACOES_BASICAS.map((a) => `${modulo}.${a.chave}`), ...PERMISSOES_EXTRAS.filter((p) => p.modulo === modulo).map((p) => `${p.modulo}.${p.acao}`)];
    setSelecionadas((s) => {
      const n = new Set(s);
      const todas = chaves.every((c) => n.has(c));
      chaves.forEach((c) => (todas ? n.delete(c) : n.add(c)));
      return n;
    });
  };

  const salvar = async (e) => {
    e.preventDefault();
    if (!nome.trim()) {
      setErroNome('Informe o nome do perfil.');
      return;
    }
    setSalvando(true);
    try {
      await salvarPerfilAcesso({
        id: editando === 'novo' ? null : editando.id,
        nome,
        descricao,
        permissoes: [...selecionadas].filter((c) => TODAS.includes(c)),
      });
      toast.success(editando === 'novo' ? 'Perfil criado!' : 'Perfil atualizado! As permissões valem no próximo acesso dos usuários.');
      setEditando(null);
      carregar();
    } catch (err) {
      toast.error(traduzirErro(err));
    } finally {
      setSalvando(false);
    }
  };

  const confirmarExclusao = async () => {
    setProcessando(true);
    try {
      await excluirPerfilAcesso(excluindo.id);
      toast.success('Perfil excluído.');
      setExcluindo(null);
      carregar();
    } catch (err) {
      toast.error(traduzirErro(err));
    } finally {
      setProcessando(false);
    }
  };

  return (
    <div className="stack">
      <div className="pagina-admin__topo">
        <h1>Perfis de acesso</h1>
        {pode('perfis', 'criar') && (
          <button type="button" className="btn btn--primary" onClick={() => abrir(null)}>
            <Plus size={18} aria-hidden="true" /> Novo perfil
          </button>
        )}
      </div>
      <p className="texto-suave">
        Defina o que cada grupo de funcionários pode ver e fazer. O administrador principal sempre tem acesso total.
      </p>

      {carregando ? (
        <LinhasSkeleton />
      ) : perfis.length === 0 ? (
        <EmptyState icone={ShieldCheck} titulo="Nenhum perfil" />
      ) : (
        <div className="perfis-grid">
          {perfis.map((p) => (
            <article key={p.id} className="card perfil-card">
              <div className="linha-entre">
                <h2 className="card__titulo">
                  {p.sistema && <Lock size={16} aria-label="Perfil do sistema" />} {p.nome}
                </h2>
                <span className="badge badge--muted">{p.total_usuarios} usuário(s)</span>
              </div>
              {p.descricao && <p className="texto-suave texto-pequeno">{p.descricao}</p>}
              <p className="texto-pequeno">{p.permissoes.length} permissões</p>
              <div className="perfil-card__acoes">
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => abrir(p)}>
                  <Pencil size={14} aria-hidden="true" /> {p.sistema || !pode('perfis', 'editar') ? 'Ver' : 'Editar'}
                </button>
                {pode('perfis', 'excluir') && !p.sistema && (
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm texto-erro"
                    onClick={() => setExcluindo(p)}
                    disabled={p.total_usuarios > 0}
                    title={p.total_usuarios > 0 ? 'Remova os usuários vinculados antes de excluir' : undefined}
                  >
                    <Trash2 size={14} aria-hidden="true" /> Excluir
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        aberto={Boolean(editando)}
        aoFechar={() => !salvando && setEditando(null)}
        titulo={editando === 'novo' ? 'Novo perfil de acesso' : somenteLeitura ? `Perfil: ${editando?.nome}` : 'Editar perfil de acesso'}
        tamanho="lg"
      >
        <form onSubmit={salvar} noValidate className="stack">
          {editando?.sistema && (
            <p className="alerta alerta--info">Perfil padrão do sistema com todas as permissões. Não pode ser alterado.</p>
          )}
          <div className="form-grid">
            <FormField
              label="Nome"
              obrigatorio
              value={nome}
              onChange={(e) => {
                setNome(e.target.value);
                setErroNome('');
              }}
              erro={erroNome}
              disabled={somenteLeitura}
              placeholder="Ex.: Vendedor"
              className="col-6"
            />
            <FormField
              label="Descrição"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              disabled={somenteLeitura}
              className="col-6"
            />
          </div>

          <div className="tabela-wrapper">
            <table className="tabela matriz">
              <caption className="sr-only">Matriz de permissões por módulo e ação</caption>
              <thead>
                <tr>
                  <th scope="col">Módulo</th>
                  {ACOES_BASICAS.map((a) => (
                    <th key={a.chave} scope="col" className="centralizado">
                      {a.nome}
                    </th>
                  ))}
                  <th scope="col">Extras</th>
                </tr>
              </thead>
              <tbody>
                {MODULOS.map((m) => (
                  <tr key={m.chave}>
                    <th scope="row">
                      <button type="button" className="link-btn" onClick={() => alternarLinha(m.chave)} disabled={somenteLeitura} title="Marcar/desmarcar linha">
                        {m.nome}
                      </button>
                    </th>
                    {ACOES_BASICAS.map((a) => {
                      const chave = `${m.chave}.${a.chave}`;
                      return (
                        <td key={a.chave} className="centralizado" data-label={a.nome}>
                          <input
                            type="checkbox"
                            className="checkbox-input"
                            checked={selecionadas.has(chave)}
                            onChange={() => alternar(chave)}
                            disabled={somenteLeitura}
                            aria-label={`${m.nome}: ${a.nome}`}
                          />
                        </td>
                      );
                    })}
                    <td data-label="Extras">
                      {PERMISSOES_EXTRAS.filter((p) => p.modulo === m.chave).map((p) => {
                        const chave = `${p.modulo}.${p.acao}`;
                        return (
                          <label key={chave} className="checkbox checkbox--pequeno">
                            <input
                              type="checkbox"
                              checked={selecionadas.has(chave)}
                              onChange={() => alternar(chave)}
                              disabled={somenteLeitura}
                            />
                            {p.nome}
                          </label>
                        );
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="modal__acoes">
            <button type="button" className="btn btn--ghost" onClick={() => setEditando(null)} disabled={salvando}>
              {somenteLeitura ? 'Fechar' : 'Cancelar'}
            </button>
            {!somenteLeitura && (
              <button type="submit" className="btn btn--primary" disabled={salvando}>
                {salvando && <Spinner tamanho="sm" />}
                Salvar perfil
              </button>
            )}
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        aberto={Boolean(excluindo)}
        titulo="Excluir perfil"
        mensagem={`Excluir o perfil "${excluindo?.nome}"?`}
        textoConfirmar="Excluir"
        perigo
        carregando={processando}
        aoConfirmar={confirmarExclusao}
        aoCancelar={() => setExcluindo(null)}
      />
    </div>
  );
}
