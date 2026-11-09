import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import FormField from '../components/FormField';
import PasswordField from '../components/PasswordField';
import AddressFields from '../components/AddressFields';
import GoogleButton from '../components/GoogleButton';
import EmptyState from '../components/EmptyState';
import Spinner from '../components/Spinner';
import { supabase } from '../services/supabase';
import { verificarDisponibilidade } from '../services/perfil';
import { useAuth } from '../hooks/useAuth';
import { apenasDigitos, mascaraCPF, mascaraTelefone } from '../utils/masks';
import { validar, validarEndereco } from '../utils/validators';
import { traduzirErro } from '../utils/errors';
import { destinoSeguro } from '../utils/navigation';

const INICIAL = {
  nome_completo: '',
  cpf: '',
  email: '',
  username: '',
  senha: '',
  confirmacao: '',
  telefone: '',
  cep: '',
  rua: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
};

export default function Cadastro() {
  const { user, carregando } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const destino = destinoSeguro(location.state?.from) || '/';

  const [form, setForm] = useState(INICIAL);
  const [erros, setErros] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [aguardandoConfirmacao, setAguardandoConfirmacao] = useState(false);

  useEffect(() => {
    if (!carregando && user && !aguardandoConfirmacao) navigate(destino, { replace: true });
  }, [carregando, user, aguardandoConfirmacao, destino, navigate]);

  const mudar = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErros((e) => ({ ...e, [campo]: '' }));
  };

  const validarTudo = () => {
    const e = {
      nome_completo: validar.nome(form.nome_completo),
      cpf: validar.cpf(form.cpf),
      email: validar.email(form.email),
      username: validar.username(form.username),
      senha: validar.senha(form.senha),
      confirmacao: validar.confirmacao(form.senha, form.confirmacao),
      telefone: validar.telefone(form.telefone),
      ...validarEndereco(form),
    };
    Object.keys(e).forEach((k) => !e[k] && delete e[k]);
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const enviar = async (ev) => {
    ev.preventDefault();
    if (!validarTudo()) {
      toast.error('Corrija os campos destacados.');
      return;
    }

    setEnviando(true);
    try {
      const disp = await verificarDisponibilidade({ username: form.username, cpf: form.cpf });
      const e = {};
      if (!disp.username_disponivel) e.username = 'Este nome de usuário já está em uso.';
      if (!disp.cpf_disponivel) e.cpf = 'Este CPF já está cadastrado.';
      if (Object.keys(e).length) {
        setErros(e);
        toast.error('Corrija os campos destacados.');
        return;
      }

      // Os dados vão como metadata; o trigger handle_new_user cria o profile no banco.
      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.senha,
        options: {
          emailRedirectTo: `${window.location.origin}/login`,
          data: {
            nome_completo: form.nome_completo.trim(),
            cpf: apenasDigitos(form.cpf),
            username: form.username.trim().toLowerCase(),
            telefone: apenasDigitos(form.telefone),
            cep: apenasDigitos(form.cep),
            rua: form.rua.trim(),
            numero: form.numero.trim(),
            complemento: form.complemento.trim(),
            bairro: form.bairro.trim(),
            cidade: form.cidade.trim(),
            uf: form.uf,
          },
        },
      });
      if (error) throw error;

      // Supabase retorna usuário sem identidades quando o e-mail já existe
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setErros({ email: 'Já existe uma conta com este e-mail.' });
        toast.error('Já existe uma conta com este e-mail.');
        return;
      }

      if (data.session) {
        toast.success('Conta criada com sucesso!');
        navigate(destino, { replace: true });
      } else {
        setAguardandoConfirmacao(true);
      }
    } catch (e) {
      toast.error(traduzirErro(e));
    } finally {
      setEnviando(false);
    }
  };

  if (aguardandoConfirmacao) {
    return (
      <div className="container auth">
        <div className="auth__card card">
          <EmptyState
            icone={MailCheck}
            titulo="Confirme seu e-mail"
            descricao={`Enviamos um link de confirmação para ${form.email}. Abra o e-mail e clique no link para ativar sua conta.`}
          >
            <Link to="/login" state={{ from: destino }} className="btn btn--primary">
              Ir para o login
            </Link>
          </EmptyState>
        </div>
      </div>
    );
  }

  return (
    <div className="container auth auth--largo">
      <div className="auth__card card">
        <h1>Criar conta</h1>
        <p className="texto-suave">Preencha seus dados para comprar e acompanhar seus pedidos.</p>

        <GoogleButton destino={destino} texto="Cadastrar com Google" />
        <div className="divisor">
          <span>ou preencha o formulário</span>
        </div>

        <form onSubmit={enviar} noValidate className="stack">
          <fieldset className="fieldset">
            <legend>Dados pessoais</legend>
            <div className="form-grid">
              <FormField
                label="Nome completo"
                obrigatorio
                autoComplete="name"
                value={form.nome_completo}
                onChange={(e) => mudar('nome_completo', e.target.value)}
                erro={erros.nome_completo}
                className="col-12"
              />
              <FormField
                label="CPF"
                obrigatorio
                inputMode="numeric"
                placeholder="000.000.000-00"
                value={form.cpf}
                onChange={(e) => mudar('cpf', mascaraCPF(e.target.value))}
                erro={erros.cpf}
                className="col-6"
              />
              <FormField
                label="Telefone (WhatsApp)"
                obrigatorio
                inputMode="tel"
                autoComplete="tel"
                placeholder="(00) 00000-0000"
                value={form.telefone}
                onChange={(e) => mudar('telefone', mascaraTelefone(e.target.value))}
                erro={erros.telefone}
                className="col-6"
              />
            </div>
          </fieldset>

          <fieldset className="fieldset">
            <legend>Acesso</legend>
            <div className="form-grid">
              <FormField
                label="E-mail"
                obrigatorio
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => mudar('email', e.target.value)}
                erro={erros.email}
                className="col-6"
              />
              <FormField
                label="Nome de usuário"
                obrigatorio
                autoComplete="username"
                value={form.username}
                onChange={(e) => mudar('username', e.target.value.toLowerCase().replace(/\s/g, ''))}
                erro={erros.username}
                ajuda="Letras minúsculas, números, _ ou ."
                className="col-6"
              />
              <PasswordField
                label="Senha"
                obrigatorio
                autoComplete="new-password"
                value={form.senha}
                onChange={(e) => mudar('senha', e.target.value)}
                erro={erros.senha}
                ajuda="Mínimo de 8 caracteres, com letras e números."
                className="col-6"
              />
              <PasswordField
                label="Confirmar senha"
                obrigatorio
                autoComplete="new-password"
                value={form.confirmacao}
                onChange={(e) => mudar('confirmacao', e.target.value)}
                erro={erros.confirmacao}
                className="col-6"
              />
            </div>
          </fieldset>

          <fieldset className="fieldset">
            <legend>Endereço</legend>
            <AddressFields
              valores={form}
              erros={erros}
              aoMudar={mudar}
              aoMudarVarios={(obj) => setForm((f) => ({ ...f, ...obj }))}
            />
          </fieldset>

          <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={enviando}>
            {enviando && <Spinner tamanho="sm" />}
            Criar conta
          </button>
        </form>

        <p className="auth__rodape">
          Já tem conta?{' '}
          <Link to="/login" state={{ from: destino }} className="link">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
