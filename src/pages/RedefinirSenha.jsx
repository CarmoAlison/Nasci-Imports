import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import PasswordField from '../components/PasswordField';
import EmptyState from '../components/EmptyState';
import Spinner, { PageLoader } from '../components/Spinner';
import { supabase } from '../services/supabase';
import { useAuth } from '../hooks/useAuth';
import { validar } from '../utils/validators';
import { traduzirErro } from '../utils/errors';

/**
 * O link do e-mail abre esta página com o token na URL. O supabase-js
 * cria a sessão de recuperação automaticamente (detectSessionInUrl).
 */
export default function RedefinirSenha() {
  const { user, carregando, setRecuperandoSenha } = useAuth();
  const navigate = useNavigate();
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erros, setErros] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [aguardou, setAguardou] = useState(false);

  // dá um tempo para o token da URL ser processado antes de declarar link inválido
  useEffect(() => {
    const t = setTimeout(() => setAguardou(true), 2500);
    return () => clearTimeout(t);
  }, []);

  const enviar = async (e) => {
    e.preventDefault();
    const novos = { senha: validar.senha(senha), confirmacao: validar.confirmacao(senha, confirmacao) };
    setErros(novos);
    if (novos.senha || novos.confirmacao) return;

    setEnviando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setEnviando(false);
    if (error) {
      toast.error(traduzirErro(error));
      return;
    }
    setRecuperandoSenha(false);
    toast.success('Senha alterada com sucesso!');
    navigate('/minha-conta', { replace: true });
  };

  if (carregando || (!user && !aguardou)) return <PageLoader texto="Validando link..." />;

  if (!user) {
    return (
      <div className="container auth">
        <div className="auth__card card">
          <EmptyState
            icone={KeyRound}
            titulo="Link inválido ou expirado"
            descricao="Solicite um novo link de redefinição de senha."
          >
            <Link to="/esqueci-senha" className="btn btn--primary">
              Solicitar novo link
            </Link>
          </EmptyState>
        </div>
      </div>
    );
  }

  return (
    <div className="container auth">
      <div className="auth__card card">
        <h1>Redefinir senha</h1>
        <p className="texto-suave">Crie uma nova senha para sua conta.</p>
        <form onSubmit={enviar} noValidate className="stack">
          <PasswordField
            label="Nova senha"
            autoComplete="new-password"
            obrigatorio
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            erro={erros.senha}
            ajuda="Mínimo de 8 caracteres, com letras e números."
          />
          <PasswordField
            label="Confirmar nova senha"
            autoComplete="new-password"
            obrigatorio
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            erro={erros.confirmacao}
          />
          <button type="submit" className="btn btn--primary btn--block" disabled={enviando}>
            {enviando && <Spinner tamanho="sm" />}
            Salvar nova senha
          </button>
        </form>
      </div>
    </div>
  );
}
