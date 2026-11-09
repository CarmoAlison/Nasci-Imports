// Leitura do "copia e cola" do Pix (BR Code / EMV) para exibir valor e recebedor no card.

function lerTlv(texto) {
  const campos = {};
  let i = 0;
  while (i + 4 <= texto.length) {
    const id = texto.slice(i, i + 2);
    const tamanho = Number(texto.slice(i + 2, i + 4));
    if (Number.isNaN(tamanho)) break;
    campos[id] = texto.slice(i + 4, i + 4 + tamanho);
    i += 4 + tamanho;
  }
  return campos;
}

/** Retorna { valor, recebedor, cidade, chave } ou null se não for um código Pix válido */
export function lerCodigoPix(codigo) {
  const texto = String(codigo || '').trim();
  if (!texto.startsWith('000201')) return null;
  try {
    const c = lerTlv(texto);
    const conta = c['26'] ? lerTlv(c['26']) : {};
    return {
      valor: c['54'] ? Number(c['54']) : null,
      recebedor: c['59'] || null,
      cidade: c['60'] || null,
      chave: conta['01'] || null,
    };
  } catch {
    return null;
  }
}
