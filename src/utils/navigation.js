/** Aceita somente caminhos internos como destino de redirecionamento (evita open redirect) */
export function destinoSeguro(valor) {
  return typeof valor === 'string' && valor.startsWith('/') && !valor.startsWith('//') ? valor : null;
}
