import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { useSignedUrl } from '../../hooks/useSignedUrl';
import Modal from '../Modal';
import Skeleton from '../Skeleton';

/** Imagem do bucket privado (URL assinada) com visualização ampliada */
export default function ChatImage({ path, aoCarregar }) {
  const { url, erro, carregando } = useSignedUrl(path);
  const [ampliada, setAmpliada] = useState(false);

  if (carregando) return <Skeleton largura="200px" altura="160px" raio="var(--radius)" />;
  if (erro || !url) {
    return (
      <span className="chat-img__erro">
        <ImageOff size={18} aria-hidden="true" /> Imagem indisponível
      </span>
    );
  }

  return (
    <>
      <button type="button" className="chat-img" onClick={() => setAmpliada(true)} aria-label="Ampliar imagem">
        <img src={url} alt="Imagem enviada no chat" onLoad={aoCarregar} />
      </button>
      <Modal aberto={ampliada} aoFechar={() => setAmpliada(false)} titulo="Imagem" tamanho="lg">
        <div className="chat-img__ampliada">
          <img src={url} alt="Imagem enviada no chat (ampliada)" />
          <a href={url} target="_blank" rel="noreferrer" className="btn btn--ghost btn--sm">
            Abrir em nova aba
          </a>
        </div>
      </Modal>
    </>
  );
}
