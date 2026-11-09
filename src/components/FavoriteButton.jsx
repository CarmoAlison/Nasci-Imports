import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { adicionarFavorito, ehFavorito, removerFavorito } from '../services/favoritos';
import { traduzirErro } from '../utils/errors';

export default function FavoriteButton({ produtoId, comTexto = true }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [favorito, setFavorito] = useState(false);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!user) return undefined;
    let ativo = true;
    ehFavorito(user.id, produtoId)
      .then((v) => ativo && setFavorito(v))
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, [user, produtoId]);

  const alternar = async () => {
    if (!user) {
      toast('Entre na sua conta para salvar favoritos.', { icon: '💚' });
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    setCarregando(true);
    try {
      if (favorito) {
        await removerFavorito(user.id, produtoId);
        setFavorito(false);
        toast.success('Removido dos favoritos.');
      } else {
        await adicionarFavorito(user.id, produtoId);
        setFavorito(true);
        toast.success('Adicionado aos favoritos!');
      }
    } catch (e) {
      toast.error(traduzirErro(e));
    } finally {
      setCarregando(false);
    }
  };

  return (
    <button
      type="button"
      className={`btn btn--ghost favorite-btn ${favorito ? 'is-ativo' : ''}`}
      onClick={alternar}
      disabled={carregando}
      aria-pressed={favorito}
      aria-label={favorito ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
    >
      <Heart size={18} fill={favorito ? 'currentColor' : 'none'} aria-hidden="true" />
      {comTexto && (favorito ? 'Favoritado' : 'Favoritar')}
    </button>
  );
}
