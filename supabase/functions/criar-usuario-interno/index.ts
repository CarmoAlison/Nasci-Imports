// Edge Function: criar-usuario-interno
// Cria e atualiza usuários internos (funcionários) usando a service_role,
// que NUNCA é exposta ao front-end.
//
// Corpo (POST):
//   { acao: 'criar', nome_completo, email, username, telefone?, senha, perfil_acesso_id }
//   { acao: 'atualizar', id, nome_completo?, telefone?, perfil_acesso_id?, ativo?, nova_senha? }
//
// Deploy: supabase functions deploy criar-usuario-interno --no-verify-jwt
// (o JWT do chamador é validado manualmente abaixo)
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9_.]{3,30}$/;

function apenasDigitos(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Não autenticado.' }, 401);

    // Cliente com o JWT de quem chamou: respeita RLS e permite checar permissões
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: 'Sessão inválida. Entre novamente.' }, 401);
    const chamador = userData.user;

    const body = await req.json().catch(() => ({}));
    const acao = body.acao === 'atualizar' ? 'atualizar' : 'criar';

    const { data: permitido, error: permErr } = await userClient.rpc('has_permission', {
      p_modulo: 'usuarios',
      p_acao: acao === 'criar' ? 'criar' : 'editar',
    });
    if (permErr) throw permErr;
    if (!permitido) return json({ error: 'Você não tem permissão para esta ação.' }, 403);

    const { data: chamadorAdmin } = await userClient.rpc('is_admin');

    // Cliente privilegiado (service_role)
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ------------------------------------------------------------------ CRIAR
    if (acao === 'criar') {
      const nome = String(body.nome_completo ?? '').trim();
      const email = String(body.email ?? '').trim().toLowerCase();
      const username = String(body.username ?? '').trim().toLowerCase();
      const telefone = apenasDigitos(body.telefone) || null;
      const senha = String(body.senha ?? '');
      const perfilId = body.perfil_acesso_id ? String(body.perfil_acesso_id) : null;

      if (nome.length < 3) return json({ error: 'Informe o nome completo.' }, 400);
      if (!EMAIL_RE.test(email)) return json({ error: 'E-mail inválido.' }, 400);
      if (!USERNAME_RE.test(username)) {
        return json({ error: 'Nome de usuário inválido (3 a 30 caracteres: letras minúsculas, números, _ ou .).' }, 400);
      }
      if (telefone && !/^\d{10,11}$/.test(telefone)) return json({ error: 'Telefone inválido.' }, 400);
      if (senha.length < 8) return json({ error: 'A senha deve ter pelo menos 8 caracteres.' }, 400);
      if (!perfilId) return json({ error: 'Selecione um perfil de acesso.' }, 400);

      const { data: perfil, error: perfilErr } = await admin
        .from('perfis_acesso').select('id').eq('id', perfilId).maybeSingle();
      if (perfilErr) throw perfilErr;
      if (!perfil) return json({ error: 'Perfil de acesso não encontrado.' }, 400);

      const { data: existente, error: exErr } = await admin
        .from('profiles').select('id').eq('username', username).maybeSingle();
      if (exErr) throw exErr;
      if (existente) return json({ error: 'Este nome de usuário já está em uso.' }, 409);

      const { data: criado, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        user_metadata: { nome_completo: nome, username, telefone },
      });
      if (createErr) {
        const msg = /already|registered|exists/i.test(createErr.message)
          ? 'Já existe um usuário com este e-mail.'
          : createErr.message;
        return json({ error: msg }, 400);
      }

      const novoId = criado.user!.id;

      // O trigger handle_new_user já criou o profile como "cliente". Promove para funcionário.
      const { error: updErr } = await admin
        .from('profiles')
        .update({
          role: 'funcionario',
          perfil_acesso_id: perfilId,
          ativo: true,
          nome_completo: nome,
          telefone,
        })
        .eq('id', novoId);

      if (updErr) {
        // desfaz a criação para não deixar usuário "órfão"
        await admin.auth.admin.deleteUser(novoId);
        throw updErr;
      }

      return json({ ok: true, id: novoId });
    }

    // -------------------------------------------------------------- ATUALIZAR
    const id = String(body.id ?? '');
    if (!id) return json({ error: 'Usuário não informado.' }, 400);

    const { data: alvo, error: alvoErr } = await admin
      .from('profiles').select('id, role').eq('id', id).maybeSingle();
    if (alvoErr) throw alvoErr;
    if (!alvo) return json({ error: 'Usuário não encontrado.' }, 404);
    if (alvo.role === 'cliente') return json({ error: 'Este usuário não é interno.' }, 400);
    if (alvo.role === 'admin' && !chamadorAdmin) {
      return json({ error: 'O administrador principal não pode ser alterado.' }, 403);
    }
    if (id === chamador.id && body.ativo === false) {
      return json({ error: 'Você não pode desativar a sua própria conta.' }, 400);
    }

    const atualizacao: Record<string, unknown> = {};
    if (typeof body.nome_completo === 'string') {
      const nome = body.nome_completo.trim();
      if (nome.length < 3) return json({ error: 'Informe o nome completo.' }, 400);
      atualizacao.nome_completo = nome;
    }
    if (body.telefone !== undefined) {
      const tel = apenasDigitos(body.telefone) || null;
      if (tel && !/^\d{10,11}$/.test(tel)) return json({ error: 'Telefone inválido.' }, 400);
      atualizacao.telefone = tel;
    }
    if (body.perfil_acesso_id !== undefined && alvo.role !== 'admin') {
      if (!body.perfil_acesso_id) return json({ error: 'Selecione um perfil de acesso.' }, 400);
      atualizacao.perfil_acesso_id = body.perfil_acesso_id;
    }
    if (typeof body.ativo === 'boolean' && alvo.role !== 'admin') {
      atualizacao.ativo = body.ativo;
    }

    if (Object.keys(atualizacao).length > 0) {
      const { error } = await admin.from('profiles').update(atualizacao).eq('id', id);
      if (error) throw error;
    }

    // Dados do Auth: nova senha e bloqueio de login ao desativar
    const authUpdate: Record<string, unknown> = {};
    if (body.nova_senha) {
      if (String(body.nova_senha).length < 8) {
        return json({ error: 'A nova senha deve ter pelo menos 8 caracteres.' }, 400);
      }
      authUpdate.password = String(body.nova_senha);
    }
    if (typeof atualizacao.ativo === 'boolean') {
      authUpdate.ban_duration = atualizacao.ativo ? 'none' : '876000h';
    }
    if (Object.keys(authUpdate).length > 0) {
      const { error } = await admin.auth.admin.updateUserById(id, authUpdate);
      if (error) throw error;
    }

    return json({ ok: true, id });
  } catch (e) {
    console.error('[criar-usuario-interno]', e);
    const msg = e instanceof Error ? e.message : (e as { message?: string })?.message;
    return json({ error: msg || 'Erro interno.' }, 500);
  }
});
