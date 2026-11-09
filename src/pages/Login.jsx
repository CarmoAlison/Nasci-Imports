import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import FormField from '../components/FormField';
import PasswordField from '../components/PasswordField';
import GoogleButton from '../components/GoogleButton';
import Spinner from '../components/Spinner';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { validar } from '../utils/validators';
import { traduzirErro } from '../utils/errors';
import { destinoSeguro } from '../utils/navigation';

export default function Login() {
  const { user, carregando, isStaff } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const destino = destinoSeguro(location.state?.from) || destinoSeguro(params.get('next')) || '/';

  const [form, setForm] = useState({ email: '', senha: '' });
  const [erros, setErros] = useState({});
  const [enviando, setEnviando] = useState(false);

  // já logado (inclusive ao voltar do Google) → segue para o destino
  useEffect(() => {
    if (!carregando && user) {
      navigate(destino === '/' && isStaff ? '/admin' : destino, { replace: true });
    }
  }, [carregando, user, isStaff, destino, navigate]);

  const enviar = async (e) => {
    e.preventDefault();
    const novos = { email: validar.email(form.email), senha: form.senha ? '' : 'Informe a senha.' };
    setErros(novos);
    if (novos.email || novos.senha) return;

    setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: form.email.trim(),
      password: form.senha,
    });
    setEnviando(false);
    if (error) {
      toast.error(traduzirErro(error));
      return;
    }
    toast.success('Bem-vindo de volta!');
  };

  return (
    <div className="container auth">
      <div className="auth__card card">
        <h1>Entrar</h1>
        <p className="texto-suave">
          {destino === '/carrinho' || destino === '/checkout'
            ? 'Entre para finalizar sua compra. Seu carrinho será mantido.'
            : 'Acesse sua conta para acompanhar seus pedidos.'}
        </p>

        <GoogleButton destino={destino} />

        <div className="divisor">
          <span>ou</span>
        </div>

        <form onSubmit={enviar} noValidate className="stack">
          <FormField
            label="E-mail"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            erro={erros.email}
            obrigatorio
          />
          <PasswordField
            label="Senha"
            autoComplete="current-password"
            value={form.senha}
            onChange={(e) => setForm({ ...form, senha: e.target.value })}
            erro={erros.senha}
            obrigatorio
          />
          <Link to="/esqueci-senha" className="link texto-pequeno auth__esqueci">
            Esqueci minha senha
          </Link>
          <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={enviando}>
            {enviando && <Spinner tamanho="sm" />}
            Entrar
          </button>
        </form>

        <p className="auth__rodape">
          Ainda não tem conta?{' '}
          <Link to="/cadastro" state={{ from: destino }} className="link">
            Cadastre-se
          </Link>
        </p>
      </div>
    </div>
  );
}
