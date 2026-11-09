import { supabase } from './supabase';
import { unwrap } from '../utils/errors';
import { apenasDigitos } from '../utils/masks';

export async function verificarDisponibilidade({ username, cpf }) {
  return unwrap(
    await supabase.rpc('verificar_disponibilidade', {
      p_username: username ? username.trim().toLowerCase() : null,
      p_cpf: cpf ? apenasDigitos(cpf) : null,
    }),
  );
}

/** Normaliza os campos do formulário para o formato do banco */
export function normalizarPerfil(form) {
  const dados = {
    nome_completo: form.nome_completo?.trim(),
    username: form.username?.trim().toLowerCase(),
    telefone: apenasDigitos(form.telefone) || null,
    cep: apenasDigitos(form.cep) || null,
    rua: form.rua?.trim() || null,
    numero: form.numero?.trim() || null,
    complemento: form.complemento?.trim() || null,
    bairro: form.bairro?.trim() || null,
    cidade: form.cidade?.trim() || null,
    uf: form.uf?.trim().toUpperCase() || null,
  };
  if (form.cpf !== undefined) dados.cpf = apenasDigitos(form.cpf) || null;
  return dados;
}

export async function atualizarPerfil(userId, dados) {
  return unwrap(await supabase.from('profiles').update(dados).eq('id', userId).select('*').single());
}
