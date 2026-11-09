import { useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle } from 'lucide-react';
import PerfilForm from '../../components/PerfilForm';
import PasswordField from '../../components/PasswordField';
import Spinner from '../../components/Spinner';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabase';
import { perfilCompleto, validar } from '../../utils/validators';
import { traduzirErro } from '../../utils/errors';

function AlterarSenha() {
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erros, setErros] = useState({});
  const [enviando, setEnviando] = useState(false);

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
    setSenha('');
    setConfirmacao('');
    toast.success('Senha alterada com sucesso!');
  };

  return (
    <form onSubmit={enviar} noValidate className="stack">
      <div className="form-grid">
        <PasswordField
          label="Nova senha"
          autoComplete="new-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          erro={erros.senha}
          className="col-6"
        />
        <PasswordField
          label="Confirmar nova senha"
          autoComplete="new-password"
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
          erro={erros.confirmacao}
          className="col-6"
        />
      </div>
      <div>
        <button type="submit" className="btn btn--outline" disabled={enviando}>
          {enviando && <Spinner tamanho="sm" />}
          Alterar senha
        </button>
      </div>
    </form>
  );
}

export default function MinhaConta() {
  const { profile, user } = useAuth();
  const loginGoogle = user?.app_metadata?.provider === 'google';

  return (
    <div className="stack">
      {!perfilCompleto(profile) && (
        <div className="alerta alerta--aviso" role="status">
          <AlertTriangle size={20} aria-hidden="true" />
          <span>Complete CPF, telefone e endereço para conseguir finalizar compras.</span>
        </div>
      )}

      <section className="card">
        <h2 className="card__titulo">Meus dados</h2>
        <p className="texto-suave texto-pequeno">E-mail: {profile?.email}</p>
        <PerfilForm />
      </section>

      <section className="card">
        <h2 className="card__titulo">Segurança</h2>
        {loginGoogle && (
          <p className="texto-suave texto-pequeno">
            Você entrou com o Google. Defina uma senha se quiser entrar também com e-mail e senha.
          </p>
        )}
        <AlterarSenha />
      </section>
    </div>
  );
}
