// Validações de formulário. Cada função retorna uma mensagem de erro ou '' (válido).
import { apenasDigitos } from './masks';

export function cpfValido(cpf) {
  const d = apenasDigitos(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len) => {
    let soma = 0;
    for (let i = 0; i < len; i++) soma += Number(d[i]) * (len + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

export const validar = {
  obrigatorio: (v, campo = 'Este campo') =>
    String(v ?? '').trim() ? '' : `${campo} é obrigatório.`,

  nome: (v) => {
    const s = String(v ?? '').trim();
    if (!s) return 'Informe seu nome completo.';
    if (s.split(/\s+/).length < 2) return 'Informe nome e sobrenome.';
    return '';
  },

  email: (v) => {
    const s = String(v ?? '').trim();
    if (!s) return 'Informe o e-mail.';
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? '' : 'E-mail inválido.';
  },

  cpf: (v) => {
    if (!apenasDigitos(v)) return 'Informe o CPF.';
    return cpfValido(v) ? '' : 'CPF inválido. Confira os números.';
  },

  username: (v) => {
    const s = String(v ?? '').trim().toLowerCase();
    if (!s) return 'Informe um nome de usuário.';
    return /^[a-z0-9_.]{3,30}$/.test(s)
      ? ''
      : 'Use de 3 a 30 caracteres: letras minúsculas, números, "_" ou ".".';
  },

  senha: (v) => {
    const s = String(v ?? '');
    if (!s) return 'Informe a senha.';
    if (s.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
    if (!/[A-Za-z]/.test(s) || !/\d/.test(s)) return 'Use letras e números na senha.';
    return '';
  },

  confirmacao: (senha, conf) => {
    if (!conf) return 'Confirme a senha.';
    return senha === conf ? '' : 'As senhas não conferem.';
  },

  telefone: (v) => {
    const d = apenasDigitos(v);
    if (!d) return 'Informe o telefone.';
    return d.length === 10 || d.length === 11 ? '' : 'Telefone inválido. Inclua o DDD.';
  },

  cep: (v) => {
    const d = apenasDigitos(v);
    if (!d) return 'Informe o CEP.';
    return d.length === 8 ? '' : 'CEP deve ter 8 dígitos.';
  },

  uf: (v) => (/^[A-Z]{2}$/.test(String(v ?? '')) ? '' : 'Selecione a UF.'),
};

/** Valida um endereço completo e devolve { campo: erro } */
export function validarEndereco(e) {
  const erros = {};
  const cep = validar.cep(e.cep);
  if (cep) erros.cep = cep;
  if (!String(e.rua ?? '').trim()) erros.rua = 'Informe a rua.';
  if (!String(e.numero ?? '').trim()) erros.numero = 'Informe o número.';
  if (!String(e.bairro ?? '').trim()) erros.bairro = 'Informe o bairro.';
  if (!String(e.cidade ?? '').trim()) erros.cidade = 'Informe a cidade.';
  const uf = validar.uf(e.uf);
  if (uf) erros.uf = uf;
  return erros;
}

/** Perfil completo o suficiente para finalizar compra? */
export function perfilCompleto(p) {
  return Boolean(
    p && p.cpf && p.telefone && p.cep && p.rua && p.numero && p.bairro && p.cidade && p.uf,
  );
}
