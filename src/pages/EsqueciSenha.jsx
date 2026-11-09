import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import FormField from '../components/FormField';
import EmptyState from '../components/EmptyState';
import Spinner from '../components/Spinner';
import { supabase } from '../services/supabase';
import { validar } from '../utils/validators';
import { traduzirErro } from '../utils/errors';

export default function EsqueciSenha() {
  const [email, setEmail] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    const msg = validar.email(email);
    setErro(msg);
    if (msg) return;

    setEnviando(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    setEnviando(false);
    if (error) {
      toast.error(traduzirErro(error));
      return;
    }
    setEnviado(true);
  };

  return (
    <div className="container auth">
      <div className="auth__card card">
        {enviado ? (
          <EmptyState
            icone={MailCheck}
            titulo="Verifique seu e-mail"
            descricao={`Se existir uma conta para ${email}, você receberá um link para criar uma nova senha.`}
          >
            <Link to="/login" className="btn btn--primary">
              Voltar ao login
            </Link>
          </EmptyState>
        ) : (
          <>
            <h1>Esqueci a senha</h1>
            <p className="texto-suave">Informe seu e-mail e enviaremos um link para redefinir sua senha.</p>
            <form onSubmit={enviar} noValidate className="stack">
              <FormField
                label="E-mail"
                type="email"
                autoComplete="email"
                obrigatorio
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                erro={erro}
              />
              <button type="submit" className="btn btn--primary btn--block" disabled={enviando}>
                {enviando && <Spinner tamanho="sm" />}
                Enviar link
              </button>
            </form>
            <p className="auth__rodape">
              Lembrou a senha?{' '}
              <Link to="/login" className="link">
                Entrar
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
