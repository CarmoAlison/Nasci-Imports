import { useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Star, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Spinner from '../Spinner';
import {
  definirImagemPrincipal,
  enviarImagensProduto,
  excluirImagem,
  reordenarImagens,
} from '../../services/produtos';
import { TAMANHO_MAX_IMAGEM, TIPOS_IMAGEM } from '../../utils/constants';
import { traduzirErro } from '../../utils/errors';

const ordenarPorOrdem = (lista) => [...lista].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

/** Upload de várias fotos, escolha da principal, reordenação e exclusão */
export default function ImagensProduto({ produtoId, imagensIniciais = [], podeEditar }) {
  const [imagens, setImagens] = useState(() => ordenarPorOrdem(imagensIniciais));
  const [enviando, setEnviando] = useState(false);
  const [ocupado, setOcupado] = useState(null);
  const inputRef = useRef(null);

  const enviar = async (e) => {
    const arquivos = Array.from(e.target.files || []);
    e.target.value = '';
    if (!arquivos.length) return;

    const invalidos = arquivos.filter((f) => !TIPOS_IMAGEM.includes(f.type) || f.size > TAMANHO_MAX_IMAGEM);
    if (invalidos.length) {
      toast.error('Envie apenas imagens JPG, PNG, WEBP ou GIF de até 5 MB.');
      return;
    }

    setEnviando(true);
    try {
      const ordemInicial = imagens.length ? Math.max(...imagens.map((i) => i.ordem ?? 0)) + 1 : 0;
      const novas = await enviarImagensProduto(produtoId, arquivos, ordemInicial, imagens.some((i) => i.principal));
      setImagens((atual) => [...atual, ...novas]);
      toast.success(`${novas.length} foto(s) enviada(s)!`);
    } catch (err) {
      toast.error(traduzirErro(err));
    } finally {
      setEnviando(false);
    }
  };

  const tornarPrincipal = async (img) => {
    setOcupado(img.id);
    try {
      await definirImagemPrincipal(produtoId, img.id);
      setImagens((atual) => atual.map((i) => ({ ...i, principal: i.id === img.id })));
      toast.success('Foto principal definida.');
    } catch (err) {
      toast.error(traduzirErro(err));
    } finally {
      setOcupado(null);
    }
  };

  const mover = async (indice, direcao) => {
    const destino = indice + direcao;
    if (destino < 0 || destino >= imagens.length) return;
    const nova = [...imagens];
    [nova[indice], nova[destino]] = [nova[destino], nova[indice]];
    const anterior = imagens;
    setImagens(nova.map((img, i) => ({ ...img, ordem: i })));
    try {
      await reordenarImagens(nova);
    } catch (err) {
      setImagens(anterior);
      toast.error(traduzirErro(err));
    }
  };

  const remover = async (img) => {
    if (!window.confirm('Excluir esta foto?')) return;
    setOcupado(img.id);
    try {
      await excluirImagem(img);
      const restantes = imagens.filter((i) => i.id !== img.id);
      // se removeu a principal, a primeira restante vira principal
      if (img.principal && restantes.length) {
        await definirImagemPrincipal(produtoId, restantes[0].id);
        restantes[0] = { ...restantes[0], principal: true };
      }
      setImagens(restantes);
      toast.success('Foto excluída.');
    } catch (err) {
      toast.error(traduzirErro(err));
    } finally {
      setOcupado(null);
    }
  };

  return (
    <div className="imagens-produto">
      <div className="linha-entre">
        <h3>Fotos ({imagens.length})</h3>
        {podeEditar && (
          <>
            <input ref={inputRef} type="file" accept={TIPOS_IMAGEM.join(',')} multiple hidden onChange={enviar} />
            <button type="button" className="btn btn--outline btn--sm" onClick={() => inputRef.current?.click()} disabled={enviando}>
              {enviando ? <Spinner tamanho="sm" /> : <ImagePlus size={16} aria-hidden="true" />}
              Enviar fotos
            </button>
          </>
        )}
      </div>

      {imagens.length === 0 ? (
        <p className="texto-suave texto-pequeno">Nenhuma foto. A primeira foto enviada será a principal.</p>
      ) : (
        <ul className="imagens-produto__lista">
          {imagens.map((img, i) => (
            <li key={img.id} className={`imagens-produto__item ${img.principal ? 'is-principal' : ''}`}>
              <img src={img.url} alt={`Foto ${i + 1}`} />
              {img.principal && <span className="badge imagens-produto__tag">Principal</span>}
              {podeEditar && (
                <div className="imagens-produto__acoes">
                  <button type="button" className="icon-btn" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Mover para a esquerda">
                    <ArrowUp size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => mover(i, 1)}
                    disabled={i === imagens.length - 1}
                    aria-label="Mover para a direita"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => tornarPrincipal(img)}
                    disabled={img.principal || ocupado === img.id}
                    aria-label="Definir como principal"
                    title="Definir como principal"
                  >
                    <Star size={14} fill={img.principal ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn--danger"
                    onClick={() => remover(img)}
                    disabled={ocupado === img.id}
                    aria-label="Excluir foto"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
