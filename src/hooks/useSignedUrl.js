import { useEffect, useState } from 'react';
import { urlAssinada } from '../services/mensagens';

/** Gera URL assinada para arquivos do bucket privado chat-anexos */
export function useSignedUrl(path) {
  const [estado, setEstado] = useState({ path: null, url: null, erro: false });

  useEffect(() => {
    if (!path) return undefined;
    let ativo = true;
    urlAssinada(path)
      .then((url) => ativo && setEstado({ path, url, erro: false }))
      .catch(() => ativo && setEstado({ path, url: null, erro: true }));
    return () => {
      ativo = false;
    };
  }, [path]);

  const atual = estado.path === path;
  return { url: atual ? estado.url : null, erro: atual && estado.erro, carregando: Boolean(path) && !atual };
}
