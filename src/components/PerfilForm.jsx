import { useState } from 'react';
import toast from 'react-hot-toast';
import FormField from './FormField';
import AddressFields from './AddressFields';
import Spinner from './Spinner';
import { useAuth } from '../hooks/useAuth';
import { atualizarPerfil, normalizarPerfil, verificarDisponibilidade } from '../services/perfil';
import { mascaraCEP, mascaraCPF, mascaraTelefone } from '../utils/masks';
import { validar, validarEndereco } from '../utils/validators';
import { traduzirErro } from '../utils/errors';

function estadoInicial(p) {
  return {
    nome_completo: p?.nome_completo || '',
    username: p?.username || '',
    cpf: p?.cpf ? mascaraCPF(p.cpf) : '',
    telefone: p?.telefone ? mascaraTelefone(p.telefone) : '',
    cep: p?.cep ? mascaraCEP(p.cep) : '',
    rua: p?.rua || '',
    numero: p?.numero || '',
    complemento: p?.complemento || '',
    bairro: p?.bairro || '',
    cidade: p?.cidade || '',
    uf: p?.uf || '',
  };
}

/**
 * Formulário de dados pessoais + endereço.
 * Usado em "Minha conta" e no checkout (completar cadastro de quem entrou pelo Google).
 */
export default function PerfilForm({ textoBotao = 'Salvar alterações', aoSalvar, compacto = false }) {
  const { user, profile, setProfile } = useAuth();
  const [form, setForm] = useState(() => estadoInicial(profile));
  const [erros, setErros] = useState({});
  const [salvando, setSalvando] = useState(false);
  const cpfBloqueado = Boolean(profile?.cpf);

  const mudar = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErros((e) => ({ ...e, [campo]: '' }));
  };

  const validarForm = () => {
    const e = {
      nome_completo: validar.nome(form.nome_completo),
      username: validar.username(form.username),
      cpf: cpfBloqueado ? '' : validar.cpf(form.cpf),
      telefone: validar.telefone(form.telefone),
      ...validarEndereco(form),
    };
    Object.keys(e).forEach((k) => !e[k] && delete e[k]);
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const enviar = async (ev) => {
    ev.preventDefault();
    if (!validarForm()) {
      toast.error('Corrija os campos destacados.');
      return;
    }
    setSalvando(true);
    try {
      const disp = await verificarDisponibilidade({
        username: form.username,
        cpf: cpfBloqueado ? null : form.cpf,
      });
      const novosErros = {};
      if (!disp.username_disponivel) novosErros.username = 'Este nome de usuário já está em uso.';
      if (!disp.cpf_disponivel) novosErros.cpf = 'Este CPF já está cadastrado em outra conta.';
      if (Object.keys(novosErros).length) {
        setErros(novosErros);
        toast.error('Corrija os campos destacados.');
        return;
      }

      const dados = normalizarPerfil(cpfBloqueado ? { ...form, cpf: undefined } : form);
      const atualizado = await atualizarPerfil(user.id, dados);
      setProfile(atualizado);
      toast.success('Dados salvos com sucesso!');
      aoSalvar?.(atualizado);
    } catch (e) {
      toast.error(traduzirErro(e));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form onSubmit={enviar} noValidate className="stack">
      <fieldset className="fieldset">
        <legend>Dados pessoais</legend>
        <div className="form-grid">
          <FormField
            label="Nome completo"
            obrigatorio
            value={form.nome_completo}
            onChange={(e) => mudar('nome_completo', e.target.value)}
            autoComplete="name"
            erro={erros.nome_completo}
            className={compacto ? 'col-12' : 'col-6'}
          />
          <FormField
            label="Nome de usuário"
            obrigatorio
            value={form.username}
            onChange={(e) => mudar('username', e.target.value.toLowerCase())}
            autoComplete="username"
            erro={erros.username}
            className={compacto ? 'col-12' : 'col-6'}
          />
          <FormField
            label="CPF"
            obrigatorio
            value={form.cpf}
            onChange={(e) => mudar('cpf', mascaraCPF(e.target.value))}
            inputMode="numeric"
            placeholder="000.000.000-00"
            erro={erros.cpf}
            disabled={cpfBloqueado}
            ajuda={cpfBloqueado ? 'Para alterar o CPF, fale com o atendimento.' : undefined}
            className="col-6"
          />
          <FormField
            label="Telefone (WhatsApp)"
            obrigatorio
            value={form.telefone}
            onChange={(e) => mudar('telefone', mascaraTelefone(e.target.value))}
            inputMode="tel"
            autoComplete="tel"
            placeholder="(00) 00000-0000"
            erro={erros.telefone}
            className="col-6"
          />
        </div>
      </fieldset>

      <fieldset className="fieldset">
        <legend>Endereço de entrega</legend>
        <AddressFields
          valores={form}
          erros={erros}
          aoMudar={mudar}
          aoMudarVarios={(obj) => setForm((f) => ({ ...f, ...obj }))}
        />
      </fieldset>

      <div>
        <button type="submit" className="btn btn--primary" disabled={salvando}>
          {salvando && <Spinner tamanho="sm" />}
          {textoBotao}
        </button>
      </div>
    </form>
  );
}
