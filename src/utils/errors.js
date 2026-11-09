// Traduz erros do Supabase/rede para mensagens claras em português

const MAPA = [
  [/invalid login credentials/i, 'E-mail ou senha incorretos.'],
  [/email not confirmed/i, 'Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.'],
  [/user already registered/i, 'Já existe uma conta com este e-mail.'],
  [/password should be at least/i, 'A senha deve ter pelo menos 8 caracteres.'],
  [/new password should be different/i, 'A nova senha deve ser diferente da atual.'],
  [/rate limit|too many requests/i, 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'],
  [/user is banned|banned/i, 'Sua conta está desativada.'],
  [/jwt expired|invalid jwt/i, 'Sua sessão expirou. Entre novamente.'],
  [/failed to fetch|network/i, 'Falha de conexão. Verifique sua internet.'],
  [/profiles_username_unique/i,'Este nome de usuário já está em uso.'],
  [/profiles_cpf_unique/i, 'Este CPF já está cadastrado.'],
  [/profiles_cpf_formato/i, 'CPF inválido.'],
  [/perfis_acesso_nome_unique/i, 'Já existe um perfil com este nome.'],
  [/categorias_slug_unique|categorias_nome_unique/i, 'Já existe uma categoria com este nome.'],
  [/produtos_estoque_nao_negativo/i, 'O estoque não pode ficar negativo.'],
  [/violates foreign key constraint/i, 'Este registro está em uso e não pode ser removido.'],
  [/row-level security|permission denied|42501/i, 'Você não tem permissão para esta ação.'],
  [/database error saving new user/i, 'Não foi possível criar a conta. Verifique se CPF e usuário já não estão cadastrados.'],
];

export function traduzirErro(erro) {
  if (!erro) return 'Ocorreu um erro inesperado.';
  const msg = typeof erro === 'string' ? erro : erro.message || erro.error_description || '';
  // Erros "P0001" do banco já vêm em português (raise exception)
  if (erro.code === 'P0001' && msg) return msg;
  for (const [re, traducao] of MAPA) {
    if (re.test(msg) || re.test(erro.code || '')) return traducao;
  }
  return msg || 'Ocorreu um erro inesperado.';
}

/** Lança o erro do Supabase ou devolve os dados */
export function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}
