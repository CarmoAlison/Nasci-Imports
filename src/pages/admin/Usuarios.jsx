import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Power, UserCog } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../../components/Modal';
import FormField from '../../components/FormField';
import PasswordField from '../../components/PasswordField';
import EmptyState from '../../components/EmptyState';
import Spinner from '../../components/Spinner';
import { LinhasSkeleton } from '../../components/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import { usePermission } from '../../hooks/usePermission';
import { chamarFuncaoUsuarios, listarPerfisAcesso, listarUsuariosInternos } from '../../services/admin';
import { mascaraTelefone } from '../../utils/masks';
import { validar } from '../../utils/validators';
import { traduzirErro } from '../../utils/errors';

const VAZIO = { nome_completo: '', email: '', username: '', telefone: '', senha: '', perfil_acesso_id: '', ativo: true, nova_senha: '' };

export default function Usuarios() {
  const { user, isAdmin } = useAuth();
  const { pode } = usePermission();
  const [usuarios, setUsuarios] = useState([]);
  const [perfis, setPerfis] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(null); // null | 'novo' | usuario
  const [form, setForm] = useState(VAZIO);
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [alternando, setAlternando] = useState(null);

  const carregar = useCallback(async () => {
    try {
      const [lista, listaPerfis] = await Promise.all([listarUsuariosInternos(), listarPerfisAcesso()]);
      setUsuarios(lista);
      setPerfis(listaPerfis);
    } catch (e) {
      toast.error(traduzirErro(e));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const abrir = (u) => {
    setEditando(u || 'novo');
    setErros({});
    setForm(
      u
        ? {
            ...VAZIO,
            nome_completo: u.nome_completo,
            email: u.email,
            username: u.username,
            telefone: u.telefone ? mascaraTelefone(u.telefone) : '',
            perfil_acesso_id: u.perfil_acesso_id || '',
            ativo: u.ativo,
          }
        : VAZIO,
    );
  };

  const novo = editando === 'novo';
  const alvoAdmin = !novo && editando?.role === 'admin';
  const mudar = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErros((e) => ({ ...e, [campo]: '' }));
  };

  const salvar = async (e) => {
    e.preventDefault();
    const n = {
      nome_completo: validar.nome(form.nome_completo),
      telefone: form.telefone ? validar.telefone(form.telefone) : '',
      perfil_acesso_id: !alvoAdmin && !form.perfil_acesso_id ? 'Selecione um perfil de acesso.' : '',
    };
    if (novo) {
      n.email = validar.email(form.email);
      n.username = validar.username(form.username);
      n.senha = validar.senha(form.senha);
    } else if (form.nova_senha) {
      n.nova_senha = validar.senha(form.nova_senha);
    }
    Object.keys(n).forEach((k) => !n[k] && delete n[k]);
    setErros(n);
    if (Object.keys(n).length) return;

    setSalvando(true);
    try {
      if (novo) {
        await chamarFuncaoUsuarios({
          acao: 'criar',
          nome_completo: form.nome_completo,
          email: form.email,
          username: form.username,
          telefone: form.telefone,
          senha: form.senha,
          perfil_acesso_id: form.perfil_acesso_id,
        });
        toast.success('Usuário interno criado! Ele já pode entrar com o e-mail e a senha informados.');
      } else {
        await chamarFuncaoUsuarios({
          acao: 'atualizar',
          id: editando.id,
          nome_completo: form.nome_completo,
          telefone: form.telefone,
          ...(alvoAdmin ? {} : { perfil_acesso_id: form.perfil_acesso_id, ativo: form.ativo }),
          ...(form.nova_senha ? { nova_senha: form.nova_senha } : {}),
        });
        toast.success('Usuário atualizado!');
      }
      setEditando(null);
      carregar();
    } catch (err) {
      toast.error(traduzirErro(err));
    } finally {
      setSalvando(false);
    }
  };

  const alternarAtivo = async (u) => {
    setAlternando(u.id);
    try {
      await chamarFuncaoUsuarios({ acao: 'atualizar', id: u.id, ativo: !u.ativo });
      toast.success(u.ativo ? 'Usuário desativado.' : 'Usuário reativado.');
      carregar();
    } catch (err) {
      toast.error(traduzirErro(err));
    } finally {
      setAlternando(null);
    }
  };

  const podeEditar = (u) => pode('usuarios', 'editar') && (u.role !== 'admin' || isAdmin);

  return (
    <div className="stack">
      <div className="pagina-admin__topo">
        <h1>Usuários internos</h1>
        {pode('usuarios', 'criar') && (
          <button type="button" className="btn btn--primary" onClick={() => abrir(null)}>
            <Plus size={18} aria-hidden="true" /> Novo usuário
          </button>
        )}
      </div>

      {carregando ? (
        <LinhasSkeleton />
      ) : usuarios.length === 0 ? (
        <EmptyState icone={UserCog} titulo="Nenhum usuário interno" />
      ) : (
        <div className="tabela-wrapper">
          <table className="tabela">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Usuário</th>
                <th>Perfil de acesso</th>
                <th>Status</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td data-label="Nome">
                    <strong>{u.nome_completo}</strong>
                    <small className="texto-suave bloco">{u.email}</small>
                  </td>
                  <td data-label="Usuário">@{u.username}</td>
                  <td data-label="Perfil">
                    {u.role === 'admin' ? <span className="badge">Admin principal</span> : u.perfil?.nome || '—'}
                  </td>
                  <td data-label="Status">
                    <span className={`badge ${u.ativo ? 'badge--success' : 'badge--muted'}`}>{u.ativo ? 'Ativo' : 'Inativo'}</span>
                  </td>
                  <td className="tabela__acoes">
                    {podeEditar(u) && (
                      <button type="button" className="icon-btn" onClick={() => abrir(u)} aria-label={`Editar ${u.nome_completo}`}>
                        <Pencil size={16} />
                      </button>
                    )}
                    {podeEditar(u) && u.role !== 'admin' && u.id !== user.id && (
                      <button
                        type="button"
                        className={`btn btn--sm ${u.ativo ? 'btn--ghost' : 'btn--outline'}`}
                        onClick={() => alternarAtivo(u)}
                        disabled={alternando === u.id}
                      >
                        {alternando === u.id ? <Spinner tamanho="sm" /> : <Power size={14} aria-hidden="true" />}
                        {u.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal aberto={Boolean(editando)} aoFechar={() => !salvando && setEditando(null)} titulo={novo ? 'Novo usuário interno' : 'Editar usuário'}>
        <form onSubmit={salvar} noValidate className="stack">
          <FormField label="Nome completo" obrigatorio value={form.nome_completo} onChange={(e) => mudar('nome_completo', e.target.value)} erro={erros.nome_completo} />
          <div className="form-grid">
            <FormField
              label="E-mail"
              type="email"
              obrigatorio={novo}
              disabled={!novo}
              value={form.email}
              onChange={(e) => mudar('email', e.target.value)}
              erro={erros.email}
              className="col-6"
            />
            <FormField
              label="Nome de usuário"
              obrigatorio={novo}
              disabled={!novo}
              value={form.username}
              onChange={(e) => mudar('username', e.target.value.toLowerCase())}
              erro={erros.username}
              className="col-6"
            />
            <FormField
              label="Telefone"
              inputMode="tel"
              value={form.telefone}
              onChange={(e) => mudar('telefone', mascaraTelefone(e.target.value))}
              erro={erros.telefone}
              className="col-6"
            />
            {!alvoAdmin && (
              <FormField
                as="select"
                label="Perfil de acesso"
                obrigatorio
                value={form.perfil_acesso_id}
                onChange={(e) => mudar('perfil_acesso_id', e.target.value)}
                erro={erros.perfil_acesso_id}
                className="col-6"
              >
                <option value="">Selecione...</option>
                {perfis.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </FormField>
            )}
          </div>
          {novo ? (
            <PasswordField
              label="Senha inicial"
              obrigatorio
              autoComplete="new-password"
              value={form.senha}
              onChange={(e) => mudar('senha', e.target.value)}
              erro={erros.senha}
              ajuda="Mínimo de 8 caracteres, com letras e números. Informe ao funcionário."
            />
          ) : (
            <PasswordField
              label="Nova senha (opcional)"
              autoComplete="new-password"
              value={form.nova_senha}
              onChange={(e) => mudar('nova_senha', e.target.value)}
              erro={erros.nova_senha}
              ajuda="Deixe em branco para manter a senha atual."
            />
          )}
          {!novo && !alvoAdmin && editando?.id !== user.id && (
            <label className="checkbox">
              <input type="checkbox" checked={form.ativo} onChange={(e) => mudar('ativo', e.target.checked)} />
              Usuário ativo (pode entrar no painel)
            </label>
          )}
          {alvoAdmin && <p className="texto-suave texto-pequeno">O administrador principal tem acesso total e não pode ser restringido.</p>}
          <div className="modal__acoes">
            <button type="button" className="btn btn--ghost" onClick={() => setEditando(null)} disabled={salvando}>
              Cancelar
            </button>
            <button type="submit" className="btn btn--primary" disabled={salvando}>
              {salvando && <Spinner tamanho="sm" />}
              {novo ? 'Criar usuário' : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
