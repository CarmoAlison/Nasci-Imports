-- =====================================================================
--  NASCI IMPORTS — Schema completo do Supabase
--  Tabelas, constraints, índices, funções, triggers, RLS, Storage,
--  Realtime e seeds.
--
--  Como usar: Supabase Dashboard → SQL Editor → cole este arquivo → Run.
--  O script é idempotente (pode ser executado novamente sem erro).
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_net;   -- usado para chamar a Edge Function do WhatsApp

-- =====================================================================
-- 1. FUNÇÕES UTILITÁRIAS (sem dependência de tabelas)
-- =====================================================================

-- Valida CPF pelos dígitos verificadores (aceita com ou sem máscara)
create or replace function public.cpf_valido(p_cpf text)
returns boolean
language plpgsql
immutable
as $$
declare
  d text;
  s int;
  r int;
  i int;
begin
  d := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  if length(d) <> 11 or d ~ '^(\d)\1{10}$' then
    return false;
  end if;

  s := 0;
  for i in 1..9 loop
    s := s + substr(d, i, 1)::int * (11 - i);
  end loop;
  r := (s * 10) % 11;
  if r = 10 then r := 0; end if;
  if r <> substr(d, 10, 1)::int then
    return false;
  end if;

  s := 0;
  for i in 1..10 loop
    s := s + substr(d, i, 1)::int * (12 - i);
  end loop;
  r := (s * 10) % 11;
  if r = 10 then r := 0; end if;
  return r = substr(d, 11, 1)::int;
end;
$$;

create or replace function public.mascarar_cpf(p_cpf text)
returns text
language sql
immutable
as $$
  select case when p_cpf is null then null
              else '***.' || substr(p_cpf, 4, 3) || '.***-**' end;
$$;

create or replace function public.status_pedido_label(p_status text)
returns text
language sql
immutable
as $$
  select case p_status
    when 'pendente' then 'Pendente'
    when 'indo_entrega' then 'Indo pra entrega'
    when 'enviado' then 'Pedido enviado'
    else p_status
  end;
$$;

-- Atualiza a coluna updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- =====================================================================
-- 2. TABELAS
-- =====================================================================

-- Perfis de acesso (Vendedor, Estoquista, Gerente...)
create table if not exists public.perfis_acesso (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  descricao   text,
  sistema     boolean not null default false,  -- perfil padrão, não pode ser excluído/alterado
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint perfis_acesso_nome_unique unique (nome),
  constraint perfis_acesso_nome_check check (length(trim(nome)) between 2 and 60)
);

-- Matriz de permissões: módulo × ação
create table if not exists public.perfil_permissoes (
  id          uuid primary key default gen_random_uuid(),
  perfil_id   uuid not null references public.perfis_acesso(id) on delete cascade,
  modulo      text not null,
  acao        text not null,
  created_at  timestamptz not null default now(),
  constraint perfil_permissoes_unique unique (perfil_id, modulo, acao),
  constraint perfil_permissoes_modulo_check check (modulo in (
    'dashboard','produtos','categorias','pedidos','chat','estoque','clientes','usuarios','perfis','relatorios'
  )),
  constraint perfil_permissoes_acao_check check (acao in (
    'ver','criar','editar','excluir',
    'alterar_status','enviar_pix','movimentar','ver_faturamento','ver_cpf'
  ))
);

-- Perfil do usuário (1:1 com auth.users)
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  nome_completo     text not null default '',
  email             text,
  username          text not null,
  cpf               text,
  telefone          text,
  cep               text,
  rua               text,
  numero            text,
  complemento       text,
  bairro            text,
  cidade            text,
  uf                text,
  avatar_url        text,
  role              text not null default 'cliente',
  perfil_acesso_id  uuid references public.perfis_acesso(id) on delete restrict,
  ativo             boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint profiles_username_unique unique (username),
  constraint profiles_cpf_unique unique (cpf),
  constraint profiles_role_check check (role in ('cliente','funcionario','admin')),
  constraint profiles_username_formato check (username ~ '^[a-z0-9_.]{3,30}$'),
  constraint profiles_cpf_formato check (cpf is null or (cpf ~ '^\d{11}$' and public.cpf_valido(cpf))),
  constraint profiles_telefone_formato check (telefone is null or telefone ~ '^\d{10,11}$'),
  constraint profiles_cep_formato check (cep is null or cep ~ '^\d{8}$'),
  constraint profiles_uf_formato check (uf is null or uf ~ '^[A-Z]{2}$')
);

create table if not exists public.categorias (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  slug        text not null,
  descricao   text,
  ordem       integer not null default 0,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint categorias_slug_unique unique (slug),
  constraint categorias_nome_unique unique (nome),
  constraint categorias_slug_formato check (slug ~ '^[a-z0-9-]+$')
);

create table if not exists public.produtos (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null,
  descricao       text,
  -- lista de especificações: [{"nome": "Memória", "valor": "128 GB"}, ...]
  especificacoes  jsonb not null default '[]'::jsonb,
  preco           numeric(12,2) not null,
  categoria_id    uuid references public.categorias(id) on delete set null,
  estoque         integer not null default 0,
  estoque_minimo  integer not null default 0,
  ativo           boolean not null default true,
  destaque        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint produtos_nome_check check (length(trim(nome)) > 0),
  constraint produtos_preco_check check (preco >= 0),
  constraint produtos_estoque_nao_negativo check (estoque >= 0),
  constraint produtos_estoque_minimo_check check (estoque_minimo >= 0),
  constraint produtos_especificacoes_array check (jsonb_typeof(especificacoes) = 'array')
);

create table if not exists public.produto_imagens (
  id            uuid primary key default gen_random_uuid(),
  produto_id    uuid not null references public.produtos(id) on delete cascade,
  url           text not null,
  storage_path  text,
  ordem         integer not null default 0,
  principal     boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists public.carrinhos (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint carrinhos_user_unique unique (user_id)
);

create table if not exists public.carrinho_itens (
  id           uuid primary key default gen_random_uuid(),
  carrinho_id  uuid not null references public.carrinhos(id) on delete cascade,
  produto_id   uuid not null references public.produtos(id) on delete cascade,
  quantidade   integer not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint carrinho_itens_unique unique (carrinho_id, produto_id),
  constraint carrinho_itens_quantidade_check check (quantidade > 0)
);

create table if not exists public.favoritos (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  produto_id  uuid not null references public.produtos(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, produto_id)
);

create table if not exists public.pedidos (
  id                uuid primary key default gen_random_uuid(),
  numero            bigint generated always as identity (start with 1001),
  cliente_id        uuid not null references public.profiles(id) on delete restrict,
  status            text not null default 'pendente',
  total             numeric(12,2) not null default 0,
  -- dados do cliente salvos no momento da compra
  cliente_nome      text,
  cliente_email     text,
  cliente_telefone  text,
  endereco          jsonb not null default '{}'::jsonb,
  observacoes       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint pedidos_numero_unique unique (numero),
  constraint pedidos_status_check check (status in ('pendente','indo_entrega','enviado')),
  constraint pedidos_total_check check (total >= 0)
);

create table if not exists public.pedido_itens (
  id              uuid primary key default gen_random_uuid(),
  pedido_id       uuid not null references public.pedidos(id) on delete cascade,
  produto_id      uuid references public.produtos(id) on delete set null,
  produto_nome    text not null,
  produto_imagem  text,
  preco_unitario  numeric(12,2) not null,   -- preço congelado no momento da compra
  quantidade      integer not null,
  subtotal        numeric(12,2) generated always as (preco_unitario * quantidade) stored,
  created_at      timestamptz not null default now(),
  constraint pedido_itens_quantidade_check check (quantidade > 0),
  constraint pedido_itens_preco_check check (preco_unitario >= 0)
);

create table if not exists public.pedido_status_historico (
  id               uuid primary key default gen_random_uuid(),
  pedido_id        uuid not null references public.pedidos(id) on delete cascade,
  status_anterior  text,
  status_novo      text not null,
  alterado_por     uuid references public.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

-- Mensagens do chat. Uma conversa = (cliente_id, pedido_id). pedido_id nulo = chat geral.
create table if not exists public.mensagens (
  id                uuid primary key default gen_random_uuid(),
  cliente_id        uuid not null references public.profiles(id) on delete cascade,
  pedido_id         uuid references public.pedidos(id) on delete cascade,
  remetente_id      uuid references public.profiles(id) on delete set null,
  remetente_equipe  boolean not null default false,
  texto             text,
  imagem_url        text,  -- caminho do arquivo no bucket privado chat-anexos
  tipo              text not null default 'normal',
  evento            text,  -- só em mensagens 'sistema': finalizada | reaberta | atribuida
  lida              boolean not null default false,
  created_at        timestamptz not null default now(),
  constraint mensagens_tipo_check check (tipo in ('normal','pix','sistema')),
  constraint mensagens_conteudo_check check (
    coalesce(length(trim(texto)), 0) > 0 or imagem_url is not null
  ),
  constraint mensagens_texto_tamanho check (texto is null or length(texto) <= 4000)
);

-- Atualização de bancos criados com versões anteriores deste script
alter table public.perfil_permissoes drop constraint if exists perfil_permissoes_modulo_check;
alter table public.perfil_permissoes add constraint perfil_permissoes_modulo_check check (modulo in (
  'dashboard','produtos','categorias','pedidos','chat','estoque','clientes','usuarios','perfis','relatorios'
));
alter table public.mensagens add column if not exists evento text;
alter table public.mensagens drop constraint if exists mensagens_tipo_check;
alter table public.mensagens add constraint mensagens_tipo_check check (tipo in ('normal','pix','sistema'));

-- Conversas do atendimento: uma por (cliente, pedido). pedido_id nulo = atendimento geral.
create table if not exists public.conversas (
  id                  uuid primary key default gen_random_uuid(),
  cliente_id          uuid not null references public.profiles(id) on delete cascade,
  pedido_id           uuid references public.pedidos(id) on delete cascade,
  status              text not null default 'aberta',
  atendente_id        uuid references public.profiles(id) on delete set null,
  finalizada_em       timestamptz,
  finalizada_por      uuid references public.profiles(id) on delete set null,
  ultima_mensagem_em  timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint conversas_status_check check (status in ('aberta','finalizada'))
);

-- Respostas rápidas usadas pela equipe no chat ({nome} vira o primeiro nome do cliente)
create table if not exists public.respostas_rapidas (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null,
  texto       text not null,
  ordem       integer not null default 0,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint respostas_rapidas_titulo_check check (length(trim(titulo)) between 1 and 60),
  constraint respostas_rapidas_texto_check check (length(trim(texto)) between 1 and 2000)
);

create table if not exists public.estoque_movimentacoes (
  id                uuid primary key default gen_random_uuid(),
  produto_id        uuid not null references public.produtos(id) on delete cascade,
  tipo              text not null,
  quantidade        integer not null,
  motivo            text not null,
  estoque_anterior  integer not null,
  estoque_novo      integer not null,
  usuario_id        uuid references public.profiles(id) on delete set null,
  usuario_nome      text,
  created_at        timestamptz not null default now(),
  constraint estoque_mov_tipo_check check (tipo in ('entrada','saida')),
  constraint estoque_mov_quantidade_check check (quantidade > 0)
);

create table if not exists public.notificacoes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  titulo      text not null,
  mensagem    text,
  tipo        text not null default 'sistema',
  link        text,
  lida        boolean not null default false,
  created_at  timestamptz not null default now(),
  constraint notificacoes_tipo_check check (tipo in ('status','mensagem','pedido','sistema'))
);

-- Configuração do Pix da loja (linha única). Usada para gerar o "copia e cola" automaticamente.
create table if not exists public.config_pix (
  id                boolean primary key default true,
  tipo_chave        text not null,
  chave             text not null,
  nome_recebedor    text not null,
  cidade            text not null,
  mensagem          text,  -- mensagem enviada junto com o Pix ({nome}, {pedido}, {valor})
  updated_by        uuid references public.profiles(id) on delete set null,
  updated_at        timestamptz not null default now(),
  constraint config_pix_linha_unica check (id),
  constraint config_pix_tipo_check check (tipo_chave in ('cpf','cnpj','email','telefone','aleatoria'))
);

-- Log de envios de WhatsApp (sucesso e falha)
create table if not exists public.whatsapp_logs (
  id             uuid primary key default gen_random_uuid(),
  pedido_id      uuid references public.pedidos(id) on delete set null,
  telefone       text,
  status_pedido  text,
  sucesso        boolean not null default false,
  erro           text,
  resposta       jsonb,
  created_at     timestamptz not null default now()
);

-- =====================================================================
-- 3. ÍNDICES
-- =====================================================================
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_perfil_acesso on public.profiles(perfil_acesso_id);
create index if not exists idx_profiles_email on public.profiles(lower(email));
create index if not exists idx_perfil_permissoes_perfil on public.perfil_permissoes(perfil_id);
create index if not exists idx_produtos_categoria on public.produtos(categoria_id);
create index if not exists idx_produtos_ativo_created on public.produtos(ativo, created_at desc);
create index if not exists idx_produtos_preco on public.produtos(preco);
create index if not exists idx_produto_imagens_produto on public.produto_imagens(produto_id, ordem);
create unique index if not exists uq_produto_imagem_principal
  on public.produto_imagens(produto_id) where principal;
create index if not exists idx_carrinho_itens_carrinho on public.carrinho_itens(carrinho_id);
create index if not exists idx_favoritos_produto on public.favoritos(produto_id);
create index if not exists idx_pedidos_cliente on public.pedidos(cliente_id, created_at desc);
create index if not exists idx_pedidos_status on public.pedidos(status);
create index if not exists idx_pedidos_created on public.pedidos(created_at desc);
create index if not exists idx_pedido_itens_pedido on public.pedido_itens(pedido_id);
create index if not exists idx_status_hist_pedido on public.pedido_status_historico(pedido_id, created_at);
create index if not exists idx_mensagens_conversa on public.mensagens(cliente_id, pedido_id, created_at);
create index if not exists idx_mensagens_nao_lidas on public.mensagens(cliente_id) where not lida;
create index if not exists idx_estoque_mov_produto on public.estoque_movimentacoes(produto_id, created_at desc);
create index if not exists idx_notificacoes_user on public.notificacoes(user_id, created_at desc);
create unique index if not exists uq_conversas_cliente_pedido
  on public.conversas(cliente_id, coalesce(pedido_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index if not exists idx_conversas_status on public.conversas(status, ultima_mensagem_em desc);
create index if not exists idx_conversas_atendente on public.conversas(atendente_id);

-- =====================================================================
-- 4. FUNÇÕES DE PERMISSÃO (base da segurança via RLS)
-- =====================================================================

-- Verifica se um usuário específico tem uma permissão.
-- Admin (role = 'admin') tem acesso total e não pode ser restringido.
create or replace function public.user_has_permission(p_user uuid, p_modulo text, p_acao text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user and p.ativo and p.role = 'admin'
  ) or exists (
    select 1
    from public.profiles p
    join public.perfil_permissoes pp on pp.perfil_id = p.perfil_acesso_id
    where p.id = p_user
      and p.ativo
      and p.role = 'funcionario'
      and pp.modulo = p_modulo
      and pp.acao = p_acao
  );
$$;

-- Usada nas políticas RLS: verifica a permissão do usuário logado
create or replace function public.has_permission(p_modulo text, p_acao text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.user_has_permission(auth.uid(), p_modulo, p_acao), false);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and ativo and role = 'admin'
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and ativo and role in ('funcionario','admin')
  );
$$;

-- Lista de permissões do usuário logado no formato "modulo.acao"
create or replace function public.minhas_permissoes()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select pp.modulo || '.' || pp.acao
  from public.profiles p
  join public.perfil_permissoes pp on pp.perfil_id = p.perfil_acesso_id
  where p.id = auth.uid() and p.ativo and p.role = 'funcionario';
$$;

-- =====================================================================
-- 5. TRIGGERS
-- =====================================================================

-- 5.1 updated_at
do $$
declare t text;
begin
  foreach t in array array['perfis_acesso','profiles','categorias','produtos','carrinhos','carrinho_itens','pedidos','conversas','respostas_rapidas','config_pix']
  loop
    execute format('drop trigger if exists trg_%1$s_updated_at on public.%1$I', t);
    execute format(
      'create trigger trg_%1$s_updated_at before update on public.%1$I
       for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- 5.2 Criar profile automaticamente ao cadastrar (e-mail/senha ou Google)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  m          jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_nome     text;
  v_username text;
  v_base     text;
  v_cpf      text;
  v_tel      text;
  v_cep      text;
  v_uf       text;
begin
  v_nome := coalesce(
    nullif(trim(m->>'nome_completo'), ''),
    nullif(trim(m->>'full_name'), ''),
    nullif(trim(m->>'name'), ''),
    split_part(coalesce(new.email, 'Cliente'), '@', 1)
  );

  -- username informado no cadastro (ou gerado a partir do e-mail no login Google)
  v_username := lower(nullif(trim(m->>'username'), ''));
  if v_username is null
     or v_username !~ '^[a-z0-9_.]{3,30}$'
     or exists (select 1 from public.profiles where username = v_username) then
    v_base := left(regexp_replace(lower(split_part(coalesce(new.email, 'usuario'), '@', 1)), '[^a-z0-9_.]', '', 'g'), 20);
    if length(v_base) < 3 then v_base := 'usuario'; end if;
    v_username := v_base;
    while exists (select 1 from public.profiles where username = v_username) loop
      v_username := v_base || '_' || substr(md5(random()::text), 1, 5);
    end loop;
  end if;

  v_cpf := nullif(regexp_replace(coalesce(m->>'cpf', ''), '\D', '', 'g'), '');
  if v_cpf is not null and (not public.cpf_valido(v_cpf)
     or exists (select 1 from public.profiles where cpf = v_cpf)) then
    v_cpf := null;
  end if;

  v_tel := nullif(regexp_replace(coalesce(m->>'telefone', ''), '\D', '', 'g'), '');
  if v_tel is not null and v_tel !~ '^\d{10,11}$' then v_tel := null; end if;

  v_cep := nullif(regexp_replace(coalesce(m->>'cep', ''), '\D', '', 'g'), '');
  if v_cep is not null and v_cep !~ '^\d{8}$' then v_cep := null; end if;

  v_uf := upper(nullif(trim(m->>'uf'), ''));
  if v_uf is not null and v_uf !~ '^[A-Z]{2}$' then v_uf := null; end if;

  insert into public.profiles (
    id, email, nome_completo, username, cpf, telefone,
    cep, rua, numero, complemento, bairro, cidade, uf, avatar_url
  ) values (
    new.id, new.email, v_nome, v_username, v_cpf, v_tel,
    v_cep,
    nullif(trim(m->>'rua'), ''),
    nullif(trim(m->>'numero'), ''),
    nullif(trim(m->>'complemento'), ''),
    nullif(trim(m->>'bairro'), ''),
    nullif(trim(m->>'cidade'), ''),
    v_uf,
    coalesce(m->>'avatar_url', m->>'picture')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Mantém o e-mail do profile sincronizado com o Auth
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- 5.3 Proteção do profile: cliente não pode se promover nem mudar perfil/ativo
create or replace function public.profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sem JWT (SQL Editor / service_role nas Edge Functions): operação privilegiada
  if auth.uid() is null then
    return new;
  end if;

  new.id := old.id;
  new.created_at := old.created_at;
  new.email := old.email;  -- e-mail só muda pelo Auth

  -- CPF, depois de definido, só pode ser alterado pela equipe
  if old.cpf is not null and new.cpf is distinct from old.cpf
     and not public.has_permission('clientes', 'editar') then
    raise exception 'O CPF não pode ser alterado. Fale com o atendimento.' using errcode = '42501';
  end if;

  if new.role is distinct from old.role
     or new.perfil_acesso_id is distinct from old.perfil_acesso_id
     or new.ativo is distinct from old.ativo then

    if not public.has_permission('usuarios', 'editar') then
      raise exception 'Sem permissão para alterar papel, perfil de acesso ou status do usuário.'
        using errcode = '42501';
    end if;

    if old.role = 'admin' and not public.is_admin() then
      raise exception 'O administrador principal não pode ser alterado.' using errcode = '42501';
    end if;

    if new.role = 'admin' and old.role <> 'admin' and not public.is_admin() then
      raise exception 'Somente um administrador pode conceder o papel de administrador.'
        using errcode = '42501';
    end if;

    if old.id = auth.uid() and (new.ativo = false or (old.role = 'admin' and new.role <> 'admin')) then
      raise exception 'Você não pode desativar ou rebaixar a sua própria conta.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_guard on public.profiles;
create trigger trg_profiles_guard
  before update on public.profiles
  for each row execute function public.profiles_guard();

-- 5.4 Perfis de acesso: impedir exclusão do perfil padrão ou com usuários vinculados
create or replace function public.perfis_acesso_guard_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_total int;
begin
  if old.sistema then
    raise exception 'O perfil padrão "%" não pode ser excluído.', old.nome using errcode = 'P0001';
  end if;
  select count(*) into v_total from public.profiles where perfil_acesso_id = old.id;
  if v_total > 0 then
    raise exception 'Não é possível excluir: existem % usuário(s) vinculado(s) a este perfil.', v_total
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

drop trigger if exists trg_perfis_acesso_guard_delete on public.perfis_acesso;
create trigger trg_perfis_acesso_guard_delete
  before delete on public.perfis_acesso
  for each row execute function public.perfis_acesso_guard_delete();

-- 5.5 Produtos: estoque só muda pela função movimentar_estoque (histórico garantido)
create or replace function public.produtos_guard_estoque()
returns trigger
language plpgsql
as $$
begin
  if new.estoque is distinct from old.estoque
     and coalesce(current_setting('app.estoque_rpc', true), 'off') <> 'on'
     and auth.uid() is not null then
    raise exception 'Use a página de Estoque para alterar a quantidade em estoque.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_produtos_guard_estoque on public.produtos;
create trigger trg_produtos_guard_estoque
  before update on public.produtos
  for each row execute function public.produtos_guard_estoque();

-- Estoque inicial informado no cadastro do produto gera movimentação de entrada
create or replace function public.produtos_estoque_inicial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estoque > 0 then
    insert into public.estoque_movimentacoes
      (produto_id, tipo, quantidade, motivo, estoque_anterior, estoque_novo, usuario_id, usuario_nome)
    values
      (new.id, 'entrada', new.estoque, 'Estoque inicial (cadastro do produto)', 0, new.estoque,
       auth.uid(), (select nome_completo from public.profiles where id = auth.uid()));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_produtos_estoque_inicial on public.produtos;
create trigger trg_produtos_estoque_inicial
  after insert on public.produtos
  for each row execute function public.produtos_estoque_inicial();

-- 5.6 Carrinho: respeitar estoque
create or replace function public.carrinho_itens_valida_estoque()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_estoque int; v_ativo boolean; v_nome text;
begin
  select estoque, ativo, nome into v_estoque, v_ativo, v_nome
  from public.produtos where id = new.produto_id;

  if not found or not v_ativo then
    raise exception 'Produto indisponível.' using errcode = 'P0001';
  end if;
  if new.quantidade > v_estoque then
    raise exception 'Estoque insuficiente para "%". Disponível: %.', v_nome, v_estoque using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_carrinho_itens_estoque on public.carrinho_itens;
create trigger trg_carrinho_itens_estoque
  before insert or update on public.carrinho_itens
  for each row execute function public.carrinho_itens_valida_estoque();

-- 5.7 Disparo do WhatsApp (Edge Function via pg_net). Nunca bloqueia a mudança de status.
--     Requer 2 segredos no Vault (ver README):
--       edge_functions_url      → https://<ref>.supabase.co/functions/v1
--       whatsapp_webhook_secret → mesmo valor do secret WHATSAPP_WEBHOOK_SECRET da função
create or replace function public.disparar_whatsapp(p_pedido_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url    text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'edge_functions_url' limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'whatsapp_webhook_secret' limit 1;

  if v_url is null or v_secret is null then
    insert into public.whatsapp_logs (pedido_id, status_pedido, sucesso, erro)
    values (p_pedido_id, p_status, false,
      'Webhook não configurado: crie os segredos edge_functions_url e whatsapp_webhook_secret no Vault.');
    return;
  end if;

  perform net.http_post(
    url := rtrim(v_url, '/') || '/notificar-whatsapp',
    body := jsonb_build_object('pedido_id', p_pedido_id, 'status', p_status),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', v_secret
    ),
    timeout_milliseconds := 8000
  );
exception when others then
  begin
    insert into public.whatsapp_logs (pedido_id, status_pedido, sucesso, erro)
    values (p_pedido_id, p_status, false, 'Falha ao disparar webhook: ' || sqlerrm);
  exception when others then
    null;
  end;
end;
$$;

-- 5.8 Pedidos: proteção de campos na atualização
create or replace function public.pedidos_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  new.cliente_id := old.cliente_id;
  new.total := old.total;
  new.created_at := old.created_at;
  new.cliente_nome := old.cliente_nome;
  new.cliente_email := old.cliente_email;

  if new.status is distinct from old.status and not public.has_permission('pedidos', 'alterar_status') then
    raise exception 'Sem permissão para alterar o status do pedido.' using errcode = '42501';
  end if;

  if (new.endereco is distinct from old.endereco
      or new.observacoes is distinct from old.observacoes
      or new.cliente_telefone is distinct from old.cliente_telefone)
     and not public.has_permission('pedidos', 'editar') then
    raise exception 'Sem permissão para editar o pedido.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_pedidos_guard on public.pedidos;
create trigger trg_pedidos_guard
  before update on public.pedidos
  for each row execute function public.pedidos_guard();

-- 5.9 Pedidos: histórico de status + notificações + WhatsApp
create or replace function public.pedidos_status_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text;
begin
  if tg_op = 'INSERT' then
    insert into public.pedido_status_historico (pedido_id, status_anterior, status_novo, alterado_por)
    values (new.id, null, new.status, auth.uid());

    insert into public.notificacoes (user_id, titulo, mensagem, tipo, link)
    values (new.cliente_id,
            'Pedido #' || new.numero || ' recebido',
            'Seu pedido foi registrado. Combine o pagamento pelo chat do pedido.',
            'pedido',
            '/minha-conta/pedidos/' || new.id);

    -- avisa a equipe com permissão de ver pedidos
    insert into public.notificacoes (user_id, titulo, mensagem, tipo, link)
    select p.id,
           'Novo pedido #' || new.numero,
           coalesce(new.cliente_nome, 'Cliente') || ' fez um pedido.',
           'pedido',
           '/admin/pedidos/' || new.id
    from public.profiles p
    where p.ativo
      and p.role in ('funcionario','admin')
      and public.user_has_permission(p.id, 'pedidos', 'ver');

    return new;
  end if;

  if new.status is distinct from old.status then
    v_label := public.status_pedido_label(new.status);

    insert into public.pedido_status_historico (pedido_id, status_anterior, status_novo, alterado_por)
    values (new.id, old.status, new.status, auth.uid());

    insert into public.notificacoes (user_id, titulo, mensagem, tipo, link)
    values (new.cliente_id,
            'Pedido #' || new.numero || ': ' || v_label,
            'O status do seu pedido foi atualizado para "' || v_label || '".',
            'status',
            '/minha-conta/pedidos/' || new.id);

    perform public.disparar_whatsapp(new.id, new.status);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_pedidos_status on public.pedidos;
create trigger trg_pedidos_status
  after insert or update of status on public.pedidos
  for each row execute function public.pedidos_status_trigger();

-- 5.10 Mensagens: validação antes de inserir
create or replace function public.mensagens_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dono uuid;
begin
  if auth.uid() is not null then
    new.remetente_id := auth.uid();
  end if;

  new.remetente_equipe := exists (
    select 1 from public.profiles
    where id = new.remetente_id and ativo and role in ('funcionario','admin')
  );
  new.created_at := now();

  -- Mensagens de sistema (finalizado, reaberto, transferido) só pelas funções do atendimento
  if new.tipo = 'sistema' then
    if coalesce(current_setting('app.msg_sistema', true), 'off') <> 'on' then
      raise exception 'Mensagem de sistema não permitida.' using errcode = '42501';
    end if;
    new.remetente_equipe := true;
    new.lida := true;  -- não conta como "não lida"
  else
    new.evento := null;
    new.lida := false;
  end if;

  if new.pedido_id is not null then
    select cliente_id into v_dono from public.pedidos where id = new.pedido_id;
    if v_dono is null or v_dono <> new.cliente_id then
      raise exception 'Pedido não pertence a este cliente.' using errcode = 'P0001';
    end if;
  end if;

  if new.tipo = 'pix' and not new.remetente_equipe then
    raise exception 'Somente a equipe pode enviar código Pix.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_mensagens_before_insert on public.mensagens;
create trigger trg_mensagens_before_insert
  before insert on public.mensagens
  for each row execute function public.mensagens_before_insert();

-- 5.11 Mensagens: notificações após inserir
create or replace function public.mensagens_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_numero bigint;
  v_link   text;
  v_nome   text;
begin
  -- Mantém a conversa: atualiza a última atividade e reabre se estava finalizada.
  -- A primeira resposta da equipe define o atendente responsável.
  perform public.conversa_garantir(new.cliente_id, new.pedido_id);
  if new.tipo <> 'sistema' then
    update public.conversas
    set ultima_mensagem_em = new.created_at,
        status = 'aberta',
        finalizada_em = null,
        finalizada_por = null,
        atendente_id = case when atendente_id is null and new.remetente_equipe
                            then new.remetente_id else atendente_id end
    where cliente_id = new.cliente_id
      and pedido_id is not distinct from new.pedido_id;
  else
    return new;  -- mensagens de sistema não geram notificação
  end if;

  if new.pedido_id is not null then
    select numero into v_numero from public.pedidos where id = new.pedido_id;
  end if;

  if new.remetente_equipe then
    -- equipe → cliente
    v_link := case when new.pedido_id is null then '/minha-conta/atendimento'
                   else '/minha-conta/pedidos/' || new.pedido_id end;

    if new.tipo = 'pix' or not exists (
      select 1 from public.notificacoes n
      where n.user_id = new.cliente_id and n.link = v_link and not n.lida and n.tipo = 'mensagem'
    ) then
      insert into public.notificacoes (user_id, titulo, mensagem, tipo, link)
      values (
        new.cliente_id,
        case when new.tipo = 'pix' then 'Código Pix disponível' else 'Nova mensagem da equipe' end,
        case when new.pedido_id is null then 'Você recebeu uma nova mensagem no atendimento.'
             when new.tipo = 'pix' then 'O código Pix do pedido #' || v_numero || ' foi enviado. Toque para copiar.'
             else 'Nova mensagem sobre o pedido #' || v_numero || '.' end,
        'mensagem',
        v_link
      );
    end if;
  else
    -- cliente → equipe (com permissão de chat), sem duplicar notificações não lidas
    select nome_completo into v_nome from public.profiles where id = new.cliente_id;
    v_link := '/admin/chat?cliente=' || new.cliente_id
              || coalesce('&pedido=' || new.pedido_id::text, '');

    insert into public.notificacoes (user_id, titulo, mensagem, tipo, link)
    select p.id,
           'Nova mensagem de ' || coalesce(nullif(v_nome, ''), 'cliente'),
           case when new.pedido_id is null then 'Atendimento geral'
                else 'Pedido #' || v_numero end,
           'mensagem',
           v_link
    from public.profiles p
    where p.ativo
      and p.role in ('funcionario','admin')
      and public.user_has_permission(p.id, 'chat', 'ver')
      and not exists (
        select 1 from public.notificacoes n
        where n.user_id = p.id and n.link = v_link and not n.lida
      );
  end if;

  return new;
end;
$$;

drop trigger if exists trg_mensagens_after_insert on public.mensagens;
create trigger trg_mensagens_after_insert
  after insert on public.mensagens
  for each row execute function public.mensagens_after_insert();

-- =====================================================================
-- 6. FUNÇÕES RPC (chamadas pelo front-end)
-- =====================================================================

-- 6.1 Disponibilidade de username e CPF (tela de cadastro)
create or replace function public.verificar_disponibilidade(p_username text default null, p_cpf text default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'username_disponivel',
      case when p_username is null then true
           else not exists (select 1 from public.profiles
                            where username = lower(trim(p_username))
                              and id is distinct from auth.uid()) end,
    'cpf_disponivel',
      case when p_cpf is null then true
           else not exists (select 1 from public.profiles
                            where cpf = regexp_replace(p_cpf, '\D', '', 'g')
                              and id is distinct from auth.uid()) end
  );
$$;

-- 6.2 Carrinho
create or replace function public.carrinho_obter_id()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Faça login.' using errcode = '42501';
  end if;
  insert into public.carrinhos (user_id) values (auth.uid())
  on conflict (user_id) do nothing;
  select id into v_id from public.carrinhos where user_id = auth.uid();
  return v_id;
end;
$$;

-- Define a quantidade de um item (0 remove). Limita ao estoque disponível. Retorna a quantidade final.
create or replace function public.carrinho_definir_quantidade(p_produto_id uuid, p_quantidade int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_carrinho uuid;
  v_estoque  int;
  v_ativo    boolean;
  v_qtd      int;
begin
  v_carrinho := public.carrinho_obter_id();

  if coalesce(p_quantidade, 0) <= 0 then
    delete from public.carrinho_itens where carrinho_id = v_carrinho and produto_id = p_produto_id;
    return 0;
  end if;

  select estoque, ativo into v_estoque, v_ativo from public.produtos where id = p_produto_id;
  if not found or not v_ativo or v_estoque <= 0 then
    delete from public.carrinho_itens where carrinho_id = v_carrinho and produto_id = p_produto_id;
    return 0;
  end if;

  v_qtd := least(p_quantidade, v_estoque);

  insert into public.carrinho_itens (carrinho_id, produto_id, quantidade)
  values (v_carrinho, p_produto_id, v_qtd)
  on conflict (carrinho_id, produto_id) do update set quantidade = excluded.quantidade;

  update public.carrinhos set updated_at = now() where id = v_carrinho;
  return v_qtd;
end;
$$;

-- Mescla o carrinho do visitante (localStorage) com o carrinho do banco
-- p_itens: [{"produto_id": "...", "quantidade": 2}, ...]
create or replace function public.carrinho_mesclar(p_itens jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_carrinho uuid;
  r          record;
begin
  v_carrinho := public.carrinho_obter_id();

  for r in
    select (e->>'produto_id')::uuid as produto_id,
           greatest(coalesce((e->>'quantidade')::int, 0), 0) as quantidade
    from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) e
    where e ? 'produto_id'
  loop
    if r.quantidade > 0 then
      insert into public.carrinho_itens (carrinho_id, produto_id, quantidade)
      select v_carrinho, p.id, least(r.quantidade, p.estoque)
      from public.produtos p
      where p.id = r.produto_id and p.ativo and p.estoque > 0
      on conflict (carrinho_id, produto_id) do update
        set quantidade = least(
          public.carrinho_itens.quantidade + excluded.quantidade,
          (select estoque from public.produtos where id = excluded.produto_id)
        );
    end if;
  end loop;
end;
$$;

create or replace function public.carrinho_limpar()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.carrinho_itens
  where carrinho_id = (select id from public.carrinhos where user_id = auth.uid());
end;
$$;

-- 6.3 Finalizar compra: gera o pedido a partir do carrinho do banco.
-- Preços vêm do banco (não do navegador). O estoque NÃO é baixado aqui.
create or replace function public.finalizar_pedido(p_observacoes text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_perfil   public.profiles%rowtype;
  v_carrinho uuid;
  v_pedido   uuid;
  v_total    numeric(12,2) := 0;
  r          record;
begin
  if v_uid is null then
    raise exception 'Faça login para finalizar a compra.' using errcode = '42501';
  end if;

  select * into v_perfil from public.profiles where id = v_uid;
  if not found or not v_perfil.ativo then
    raise exception 'Conta inválida ou desativada.' using errcode = '42501';
  end if;

  if v_perfil.cpf is null or v_perfil.telefone is null or v_perfil.cep is null
     or v_perfil.rua is null or v_perfil.numero is null or v_perfil.bairro is null
     or v_perfil.cidade is null or v_perfil.uf is null then
    raise exception 'Complete seu cadastro (CPF, telefone e endereço) antes de finalizar a compra.'
      using errcode = 'P0001';
  end if;

  select id into v_carrinho from public.carrinhos where user_id = v_uid;
  if v_carrinho is null or not exists (select 1 from public.carrinho_itens where carrinho_id = v_carrinho) then
    raise exception 'Seu carrinho está vazio.' using errcode = 'P0001';
  end if;

  for r in
    select ci.quantidade, p.id, p.nome, p.preco, p.estoque, p.ativo
    from public.carrinho_itens ci
    join public.produtos p on p.id = ci.produto_id
    where ci.carrinho_id = v_carrinho
    for update of p
  loop
    if not r.ativo then
      raise exception 'O produto "%" não está mais disponível. Remova-o do carrinho.', r.nome using errcode = 'P0001';
    end if;
    if r.quantidade > r.estoque then
      raise exception 'Estoque insuficiente para "%". Disponível: %.', r.nome, r.estoque using errcode = 'P0001';
    end if;
    v_total := v_total + (r.preco * r.quantidade);
  end loop;

  insert into public.pedidos (
    cliente_id, total, cliente_nome, cliente_email, cliente_telefone, endereco, observacoes
  ) values (
    v_uid, v_total, v_perfil.nome_completo, v_perfil.email, v_perfil.telefone,
    jsonb_build_object(
      'cep', v_perfil.cep, 'rua', v_perfil.rua, 'numero', v_perfil.numero,
      'complemento', v_perfil.complemento, 'bairro', v_perfil.bairro,
      'cidade', v_perfil.cidade, 'uf', v_perfil.uf
    ),
    nullif(trim(coalesce(p_observacoes, '')), '')
  )
  returning id into v_pedido;

  insert into public.pedido_itens (pedido_id, produto_id, produto_nome, produto_imagem, preco_unitario, quantidade)
  select v_pedido, p.id, p.nome,
         (select pi.url from public.produto_imagens pi
          where pi.produto_id = p.id order by pi.principal desc, pi.ordem asc limit 1),
         p.preco, ci.quantidade
  from public.carrinho_itens ci
  join public.produtos p on p.id = ci.produto_id
  where ci.carrinho_id = v_carrinho;

  delete from public.carrinho_itens where carrinho_id = v_carrinho;

  return v_pedido;
end;
$$;

-- 6.4 Marcar mensagens de uma conversa como lidas
create or replace function public.marcar_mensagens_lidas(p_cliente_id uuid, p_pedido_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = p_cliente_id then
    update public.mensagens set lida = true
    where cliente_id = p_cliente_id
      and pedido_id is not distinct from p_pedido_id
      and remetente_equipe and not lida;
  elsif public.has_permission('chat', 'ver') or public.has_permission('pedidos', 'ver') then
    update public.mensagens set lida = true
    where cliente_id = p_cliente_id
      and pedido_id is not distinct from p_pedido_id
      and not remetente_equipe and not lida;
  end if;
end;
$$;

-- 6.5 Estoque: entrada/baixa manual com histórico
create or replace function public.movimentar_estoque(
  p_produto_id uuid, p_tipo text, p_quantidade int, p_motivo text
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_atual int;
  v_novo  int;
begin
  if not public.has_permission('estoque', 'movimentar') then
    raise exception 'Sem permissão para movimentar o estoque.' using errcode = '42501';
  end if;
  if p_tipo not in ('entrada', 'saida') then
    raise exception 'Tipo de movimentação inválido.' using errcode = 'P0001';
  end if;
  if p_quantidade is null or p_quantidade <= 0 then
    raise exception 'Informe uma quantidade maior que zero.' using errcode = 'P0001';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Informe o motivo da movimentação.' using errcode = 'P0001';
  end if;

  select estoque into v_atual from public.produtos where id = p_produto_id for update;
  if not found then
    raise exception 'Produto não encontrado.' using errcode = 'P0001';
  end if;

  v_novo := case when p_tipo = 'entrada' then v_atual + p_quantidade else v_atual - p_quantidade end;
  if v_novo < 0 then
    raise exception 'Quantidade maior que o estoque atual (%).', v_atual using errcode = 'P0001';
  end if;

  perform set_config('app.estoque_rpc', 'on', true);
  update public.produtos set estoque = v_novo where id = p_produto_id;
  perform set_config('app.estoque_rpc', 'off', true);

  insert into public.estoque_movimentacoes
    (produto_id, tipo, quantidade, motivo, estoque_anterior, estoque_novo, usuario_id, usuario_nome)
  values
    (p_produto_id, p_tipo, p_quantidade, trim(p_motivo), v_atual, v_novo, auth.uid(),
     (select nome_completo from public.profiles where id = auth.uid()));

  return v_novo;
end;
$$;

-- 6.6 Dashboard
create or replace function public.dashboard_resumo()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_fat  boolean := public.has_permission('dashboard', 'ver_faturamento');
  v_dia  timestamptz := (date_trunc('day', now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo';
  v_mes  timestamptz := (date_trunc('month', now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo';
begin
  if not public.has_permission('dashboard', 'ver') then
    raise exception 'Sem permissão para ver o dashboard.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'pedidos_hoje', (select count(*) from public.pedidos where created_at >= v_dia),
    'pedidos_mes',  (select count(*) from public.pedidos where created_at >= v_mes),
    'por_status', (
      select coalesce(jsonb_object_agg(status, qtd), '{}'::jsonb)
      from (select status, count(*) as qtd from public.pedidos group by status) s
    ),
    'pode_ver_faturamento', v_fat,
    -- faturamento considera pedidos com pagamento combinado (já saíram de "pendente")
    'faturamento_dia', case when v_fat then (
      select coalesce(sum(total), 0) from public.pedidos
      where created_at >= v_dia and status in ('indo_entrega','enviado')) end,
    'faturamento_mes', case when v_fat then (
      select coalesce(sum(total), 0) from public.pedidos
      where created_at >= v_mes and status in ('indo_entrega','enviado')) end,
    'estoque_baixo', (
      select coalesce(jsonb_agg(x), '[]'::jsonb) from (
        select id, nome, estoque, estoque_minimo
        from public.produtos
        where estoque <= estoque_minimo and ativo
        order by estoque asc, nome
        limit 10
      ) x
    ),
    'ultimas_mensagens', case
      when public.has_permission('chat', 'ver') then (
        select coalesce(jsonb_agg(x), '[]'::jsonb) from (
          select m.id, m.texto, (m.imagem_url is not null) as tem_imagem, m.created_at,
                 m.cliente_id, m.pedido_id, m.lida, p.nome_completo as cliente_nome,
                 pe.numero as pedido_numero
          from public.mensagens m
          join public.profiles p on p.id = m.cliente_id
          left join public.pedidos pe on pe.id = m.pedido_id
          where not m.remetente_equipe
          order by m.created_at desc
          limit 8
        ) x)
      else '[]'::jsonb end
  );
end;
$$;

-- 6.7 Atendimento (conversas, finalizar, reabrir, transferir)

-- Garante que exista a conversa (cliente, pedido) e devolve o id. Uso interno.
create or replace function public.conversa_garantir(p_cliente_id uuid, p_pedido_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  select id into v_id from public.conversas
  where cliente_id = p_cliente_id and pedido_id is not distinct from p_pedido_id;
  if v_id is null then
    begin
      insert into public.conversas (cliente_id, pedido_id)
      values (p_cliente_id, p_pedido_id)
      returning id into v_id;
    exception when unique_violation then
      select id into v_id from public.conversas
      where cliente_id = p_cliente_id and pedido_id is not distinct from p_pedido_id;
    end;
  end if;
  return v_id;
end;
$$;

-- Insere uma mensagem de sistema (linha centralizada no chat). Uso interno.
create or replace function public.mensagem_sistema(p_cliente_id uuid, p_pedido_id uuid, p_texto text, p_evento text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.msg_sistema', 'on', true);
  insert into public.mensagens (cliente_id, pedido_id, remetente_id, texto, tipo, evento)
  values (p_cliente_id, p_pedido_id, auth.uid(), p_texto, 'sistema', p_evento);
  perform set_config('app.msg_sistema', 'off', true);
end;
$$;

-- Lista de conversas do painel (todas; o front filtra por status/atendente)
drop function if exists public.admin_conversas(text);
create or replace function public.admin_conversas(p_busca text default null)
returns table (
  cliente_id uuid,
  cliente_nome text,
  pedido_id uuid,
  pedido_numero bigint,
  status text,
  atendente_id uuid,
  atendente_nome text,
  finalizada_em timestamptz,
  ultima_mensagem text,
  ultima_da_equipe boolean,
  ultima_data timestamptz,
  nao_lidas bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.has_permission('chat', 'ver') then
    raise exception 'Sem permissão para ver o atendimento.' using errcode = '42501';
  end if;

  return query
  select c.cliente_id,
         p.nome_completo,
         c.pedido_id,
         pe.numero,
         c.status,
         c.atendente_id,
         a.nome_completo,
         c.finalizada_em,
         um.resumo,
         coalesce(um.remetente_equipe, false),
         coalesce(um.created_at, c.ultima_mensagem_em),
         (select count(*) from public.mensagens m
          where m.cliente_id = c.cliente_id
            and m.pedido_id is not distinct from c.pedido_id
            and not m.remetente_equipe and not m.lida)
  from public.conversas c
  join public.profiles p on p.id = c.cliente_id
  left join public.profiles a on a.id = c.atendente_id
  left join public.pedidos pe on pe.id = c.pedido_id
  left join lateral (
    select case when m.tipo = 'pix' then 'Código Pix enviado'
                when coalesce(trim(m.texto), '') = '' then 'Imagem'
                else m.texto end as resumo,
           m.remetente_equipe,
           m.created_at
    from public.mensagens m
    where m.cliente_id = c.cliente_id
      and m.pedido_id is not distinct from c.pedido_id
      and m.tipo <> 'sistema'
    order by m.created_at desc
    limit 1
  ) um on true
  where coalesce(trim(p_busca), '') = ''
     or p.nome_completo ilike '%' || trim(p_busca) || '%'
     or p.email ilike '%' || trim(p_busca) || '%'
     or pe.numero::text = regexp_replace(trim(p_busca), '\D', '', 'g')
  order by coalesce(um.created_at, c.ultima_mensagem_em) desc
  limit 300;
end;
$$;

-- Finaliza o atendimento (opcionalmente enviando uma mensagem de encerramento)
create or replace function public.conversa_finalizar(
  p_cliente_id uuid, p_pedido_id uuid default null, p_mensagem text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_nome text;
begin
  if not public.has_permission('chat', 'criar') then
    raise exception 'Sem permissão para finalizar atendimentos.' using errcode = '42501';
  end if;

  perform public.conversa_garantir(p_cliente_id, p_pedido_id);

  if coalesce(trim(p_mensagem), '') <> '' then
    insert into public.mensagens (cliente_id, pedido_id, remetente_id, texto, tipo)
    values (p_cliente_id, p_pedido_id, auth.uid(), trim(p_mensagem), 'normal');
  end if;

  -- o que o cliente mandou até aqui conta como lido
  update public.mensagens set lida = true
  where cliente_id = p_cliente_id and pedido_id is not distinct from p_pedido_id
    and not remetente_equipe and not lida;

  select nome_completo into v_nome from public.profiles where id = auth.uid();
  perform public.mensagem_sistema(p_cliente_id, p_pedido_id,
    'Atendimento finalizado por ' || coalesce(nullif(v_nome, ''), 'equipe'), 'finalizada');

  update public.conversas
  set status = 'finalizada', finalizada_em = now(), finalizada_por = auth.uid()
  where cliente_id = p_cliente_id and pedido_id is not distinct from p_pedido_id;
end;
$$;

create or replace function public.conversa_reabrir(p_cliente_id uuid, p_pedido_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_nome text;
begin
  if not public.has_permission('chat', 'criar') then
    raise exception 'Sem permissão para reabrir atendimentos.' using errcode = '42501';
  end if;

  perform public.conversa_garantir(p_cliente_id, p_pedido_id);
  select nome_completo into v_nome from public.profiles where id = auth.uid();
  perform public.mensagem_sistema(p_cliente_id, p_pedido_id,
    'Atendimento reaberto por ' || coalesce(nullif(v_nome, ''), 'equipe'), 'reaberta');

  update public.conversas
  set status = 'aberta', finalizada_em = null, finalizada_por = null
  where cliente_id = p_cliente_id and pedido_id is not distinct from p_pedido_id;
end;
$$;

-- Assume (p_atendente_id nulo = quem chamou) ou transfere o atendimento
create or replace function public.conversa_atribuir(
  p_cliente_id uuid, p_pedido_id uuid default null, p_atendente_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alvo  uuid := coalesce(p_atendente_id, auth.uid());
  v_eu    text;
  v_nome  text;
begin
  if not public.has_permission('chat', 'criar') then
    raise exception 'Sem permissão para assumir atendimentos.' using errcode = '42501';
  end if;
  if not public.user_has_permission(v_alvo, 'chat', 'ver') then
    raise exception 'Este usuário não tem acesso ao atendimento.' using errcode = 'P0001';
  end if;

  perform public.conversa_garantir(p_cliente_id, p_pedido_id);
  update public.conversas set atendente_id = v_alvo
  where cliente_id = p_cliente_id and pedido_id is not distinct from p_pedido_id;

  select nome_completo into v_eu from public.profiles where id = auth.uid();
  select nome_completo into v_nome from public.profiles where id = v_alvo;
  perform public.mensagem_sistema(p_cliente_id, p_pedido_id,
    case when v_alvo = auth.uid() then coalesce(v_eu, 'Equipe') || ' assumiu o atendimento'
         else 'Atendimento transferido para ' || coalesce(v_nome, 'outro atendente') end,
    'atribuida');
end;
$$;

-- Dados do cliente para o painel lateral do atendimento (sem CPF)
create or replace function public.admin_conversa_info(p_cliente_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v jsonb;
begin
  if not public.has_permission('chat', 'ver') then
    raise exception 'Sem permissão para ver o atendimento.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', p.id, 'nome_completo', p.nome_completo, 'email', p.email, 'username', p.username,
    'telefone', p.telefone, 'cidade', p.cidade, 'uf', p.uf, 'created_at', p.created_at,
    'total_pedidos', (select count(*) from public.pedidos pe where pe.cliente_id = p.id),
    'pedidos', coalesce((
      select jsonb_agg(x) from (
        select pe.id, pe.numero, pe.status, pe.total, pe.created_at
        from public.pedidos pe where pe.cliente_id = p.id
        order by pe.created_at desc limit 5
      ) x
    ), '[]'::jsonb)
  ) into v
  from public.profiles p where p.id = p_cliente_id;

  if v is null then
    raise exception 'Cliente não encontrado.' using errcode = 'P0001';
  end if;
  return v;
end;
$$;

-- Equipe que pode receber atendimentos (para transferir)
create or replace function public.admin_atendentes()
returns table (id uuid, nome_completo text)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.has_permission('chat', 'ver') then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  return query
  select p.id, p.nome_completo from public.profiles p
  where p.ativo and p.role in ('funcionario','admin')
    and public.user_has_permission(p.id, 'chat', 'ver')
  order by p.nome_completo;
end;
$$;

-- Conversas existentes antes desta versão
insert into public.conversas (cliente_id, pedido_id, ultima_mensagem_em)
select m.cliente_id, m.pedido_id, max(m.created_at)
from public.mensagens m
where not exists (
  select 1 from public.conversas c
  where c.cliente_id = m.cliente_id and c.pedido_id is not distinct from m.pedido_id
)
group by m.cliente_id, m.pedido_id;

-- 6.8 Clientes (CPF mascarado sem a permissão clientes.ver_cpf)
create or replace function public.admin_listar_clientes(
  p_busca text default null, p_limite int default 20, p_offset int default 0
)
returns table (
  id uuid,
  nome_completo text,
  email text,
  username text,
  telefone text,
  cpf text,
  cidade text,
  uf text,
  created_at timestamptz,
  total_pedidos bigint,
  total_registros bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_ver_cpf boolean := public.has_permission('clientes', 'ver_cpf');
  v_busca   text := nullif(trim(coalesce(p_busca, '')), '');
  v_digitos text := nullif(regexp_replace(coalesce(p_busca, ''), '\D', '', 'g'), '');
begin
  if not public.has_permission('clientes', 'ver') then
    raise exception 'Sem permissão para ver clientes.' using errcode = '42501';
  end if;

  return query
  select p.id, p.nome_completo, p.email, p.username, p.telefone,
         case when v_ver_cpf then p.cpf else public.mascarar_cpf(p.cpf) end,
         p.cidade, p.uf, p.created_at,
         (select count(*) from public.pedidos pe where pe.cliente_id = p.id),
         count(*) over ()
  from public.profiles p
  where p.role = 'cliente'
    and (
      v_busca is null
      or p.nome_completo ilike '%' || v_busca || '%'
      or p.email ilike '%' || v_busca || '%'
      or p.username ilike '%' || v_busca || '%'
      or (v_digitos is not null and p.telefone like '%' || v_digitos || '%')
      or (v_digitos is not null and v_ver_cpf and p.cpf like '%' || v_digitos || '%')
    )
  order by p.created_at desc
  limit greatest(least(coalesce(p_limite, 20), 100), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_cliente_detalhe(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ver_cpf boolean := public.has_permission('clientes', 'ver_cpf');
  v_result  jsonb;
begin
  if not public.has_permission('clientes', 'ver') then
    raise exception 'Sem permissão para ver clientes.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', p.id, 'nome_completo', p.nome_completo, 'email', p.email, 'username', p.username,
    'cpf', case when v_ver_cpf then p.cpf else public.mascarar_cpf(p.cpf) end,
    'cpf_visivel', v_ver_cpf,
    'telefone', p.telefone, 'cep', p.cep, 'rua', p.rua, 'numero', p.numero,
    'complemento', p.complemento, 'bairro', p.bairro, 'cidade', p.cidade, 'uf', p.uf,
    'ativo', p.ativo, 'created_at', p.created_at,
    'pedidos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pe.id, 'numero', pe.numero, 'status', pe.status,
        'total', pe.total, 'created_at', pe.created_at
      ) order by pe.created_at desc)
      from public.pedidos pe where pe.cliente_id = p.id
    ), '[]'::jsonb)
  )
  into v_result
  from public.profiles p
  where p.id = p_id and p.role = 'cliente';

  if v_result is null then
    raise exception 'Cliente não encontrado.' using errcode = 'P0001';
  end if;
  return v_result;
end;
$$;

-- 6.9 Perfis de acesso
create or replace function public.listar_perfis_acesso()
returns table (
  id uuid,
  nome text,
  descricao text,
  sistema boolean,
  created_at timestamptz,
  total_usuarios bigint,
  permissoes text[]
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not (public.has_permission('perfis', 'ver') or public.has_permission('usuarios', 'ver')) then
    raise exception 'Sem permissão para ver perfis de acesso.' using errcode = '42501';
  end if;

  return query
  select pa.id, pa.nome, pa.descricao, pa.sistema, pa.created_at,
         (select count(*) from public.profiles p where p.perfil_acesso_id = pa.id),
         coalesce((
           select array_agg(pp.modulo || '.' || pp.acao order by pp.modulo, pp.acao)
           from public.perfil_permissoes pp where pp.perfil_id = pa.id
         ), '{}'::text[])
  from public.perfis_acesso pa
  order by pa.sistema desc, pa.nome;
end;
$$;

-- Cria/atualiza um perfil e sua matriz de permissões de forma atômica.
-- p_permissoes: array de "modulo.acao"
create or replace function public.salvar_perfil_acesso(
  p_id uuid, p_nome text, p_descricao text, p_permissoes text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id      uuid;
  v_sistema boolean;
begin
  if coalesce(trim(p_nome), '') = '' then
    raise exception 'Informe o nome do perfil.' using errcode = 'P0001';
  end if;

  if p_id is null then
    if not public.has_permission('perfis', 'criar') then
      raise exception 'Sem permissão para criar perfis.' using errcode = '42501';
    end if;
    insert into public.perfis_acesso (nome, descricao)
    values (trim(p_nome), nullif(trim(coalesce(p_descricao, '')), ''))
    returning id into v_id;
  else
    if not public.has_permission('perfis', 'editar') then
      raise exception 'Sem permissão para editar perfis.' using errcode = '42501';
    end if;
    select sistema into v_sistema from public.perfis_acesso where id = p_id;
    if not found then
      raise exception 'Perfil não encontrado.' using errcode = 'P0001';
    end if;
    if v_sistema then
      raise exception 'O perfil padrão do sistema não pode ser alterado.' using errcode = 'P0001';
    end if;
    update public.perfis_acesso
    set nome = trim(p_nome), descricao = nullif(trim(coalesce(p_descricao, '')), '')
    where id = p_id
    returning id into v_id;
    delete from public.perfil_permissoes where perfil_id = v_id;
  end if;

  insert into public.perfil_permissoes (perfil_id, modulo, acao)
  select distinct v_id, split_part(x, '.', 1), split_part(x, '.', 2)
  from unnest(coalesce(p_permissoes, '{}'::text[])) as x
  where x like '%.%';

  return v_id;
end;
$$;

-- 6.11 Pix automático (BR Code / "copia e cola" do Banco Central)

-- Texto sem acentos e só com caracteres aceitos no BR Code
create or replace function public.pix_texto(p text, p_max int)
returns text
language sql
immutable
as $$
  select left(trim(regexp_replace(regexp_replace(upper(translate(coalesce(p, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')), '[^A-Z0-9 .-]', '', 'g'), '\s+', ' ', 'g')), p_max);
$$;

-- Campo EMV: ID + tamanho (2 dígitos) + valor
create or replace function public.pix_campo(p_id text, p_valor text)
returns text
language sql
immutable
as $$
  select p_id || lpad(octet_length(p_valor)::text, 2, '0') || p_valor;
$$;

-- CRC16-CCITT (polinômio 0x1021, inicial 0xFFFF) exigido pelo BR Code
create or replace function public.pix_crc16(p text)
returns text
language plpgsql
immutable
as $$
declare
  crc   int := 65535;
  dados bytea := convert_to(p, 'UTF8');
  i     int;
  j     int;
begin
  for i in 0 .. length(dados) - 1 loop
    crc := crc # (get_byte(dados, i) << 8);
    for j in 1 .. 8 loop
      if (crc & 32768) <> 0 then
        crc := ((crc << 1) # 4129) & 65535;
      else
        crc := (crc << 1) & 65535;
      end if;
    end loop;
  end loop;
  return upper(lpad(to_hex(crc), 4, '0'));
end;
$$;

-- Monta o "copia e cola" com o valor informado, usando a chave cadastrada. Uso interno.
create or replace function public.pix_payload(p_valor numeric, p_txid text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c        public.config_pix%rowtype;
  v_txid   text := left(regexp_replace(coalesce(p_txid, ''), '[^A-Za-z0-9]', '', 'g'), 25);
  v_conta  text;
  v_base   text;
begin
  select * into c from public.config_pix where id;
  if not found then
    raise exception 'Chave Pix não cadastrada. Um administrador precisa cadastrá-la em Configurações.'
      using errcode = 'P0001';
  end if;
  if p_valor is null or p_valor <= 0 then
    raise exception 'Valor do Pix inválido.' using errcode = 'P0001';
  end if;

  v_conta := public.pix_campo('00', 'br.gov.bcb.pix') || public.pix_campo('01', c.chave);

  v_base := public.pix_campo('00', '01')
         || public.pix_campo('26', v_conta)
         || public.pix_campo('52', '0000')
         || public.pix_campo('53', '986')
         || public.pix_campo('54', to_char(round(p_valor, 2), 'FM9999999990.00'))
         || public.pix_campo('58', 'BR')
         || public.pix_campo('59', public.pix_texto(c.nome_recebedor, 25))
         || public.pix_campo('60', public.pix_texto(c.cidade, 15))
         || public.pix_campo('62', public.pix_campo('05', case when v_txid = '' then '***' else v_txid end))
         || '6304';

  return v_base || public.pix_crc16(v_base);
end;
$$;

-- Salva a configuração do Pix (somente administrador), validando e normalizando a chave
create or replace function public.salvar_config_pix(
  p_tipo_chave text, p_chave text, p_nome_recebedor text, p_cidade text, p_mensagem text default null
)
returns public.config_pix
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chave text := trim(coalesce(p_chave, ''));
  v_dig   text := regexp_replace(coalesce(p_chave, ''), '\D', '', 'g');
  v       public.config_pix;
begin
  if not public.is_admin() then
    raise exception 'Somente o administrador pode alterar a chave Pix.' using errcode = '42501';
  end if;

  case p_tipo_chave
    when 'cpf' then
      if not public.cpf_valido(v_dig) then raise exception 'CPF da chave Pix inválido.' using errcode = 'P0001'; end if;
      v_chave := v_dig;
    when 'cnpj' then
      if length(v_dig) <> 14 then raise exception 'CNPJ deve ter 14 dígitos.' using errcode = 'P0001'; end if;
      v_chave := v_dig;
    when 'telefone' then
      if v_dig ~ '^55\d{10,11}$' then v_dig := substr(v_dig, 3); end if;
      if v_dig !~ '^\d{10,11}$' then raise exception 'Telefone da chave Pix inválido (inclua o DDD).' using errcode = 'P0001'; end if;
      v_chave := '+55' || v_dig;
    when 'email' then
      v_chave := lower(v_chave);
      if v_chave !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail da chave Pix inválido.' using errcode = 'P0001'; end if;
    when 'aleatoria' then
      v_chave := lower(v_chave);
      if v_chave !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'Chave aleatória inválida (formato 00000000-0000-0000-0000-000000000000).' using errcode = 'P0001';
      end if;
    else
      raise exception 'Tipo de chave inválido.' using errcode = 'P0001';
  end case;

  if public.pix_texto(p_nome_recebedor, 25) = '' then
    raise exception 'Informe o nome do recebedor.' using errcode = 'P0001';
  end if;
  if public.pix_texto(p_cidade, 15) = '' then
    raise exception 'Informe a cidade.' using errcode = 'P0001';
  end if;

  insert into public.config_pix (id, tipo_chave, chave, nome_recebedor, cidade, mensagem, updated_by)
  values (true, p_tipo_chave, v_chave, trim(p_nome_recebedor), trim(p_cidade),
          nullif(trim(coalesce(p_mensagem, '')), ''), auth.uid())
  on conflict (id) do update
    set tipo_chave = excluded.tipo_chave, chave = excluded.chave,
        nome_recebedor = excluded.nome_recebedor, cidade = excluded.cidade,
        mensagem = excluded.mensagem, updated_by = excluded.updated_by
  returning * into v;

  return v;
end;
$$;

-- Gera um código de teste (para conferir no app do banco antes de usar)
create or replace function public.pix_gerar_teste(p_valor numeric default 1)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Somente o administrador pode gerar o Pix de teste.' using errcode = '42501';
  end if;
  return public.pix_payload(coalesce(p_valor, 1), 'TESTE');
end;
$$;

-- Envia o Pix do pedido no chat: mensagem (opcional) + card com o "copia e cola".
-- p_valor nulo = total do pedido (pode ser outro valor, ex.: sinal/entrada).
create or replace function public.enviar_pix_pedido(p_pedido_id uuid, p_valor numeric default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  pe        public.pedidos%rowtype;
  c         public.config_pix%rowtype;
  v_valor   numeric(12,2);
  v_codigo  text;
  v_msg     text;
begin
  if not public.has_permission('pedidos', 'enviar_pix') then
    raise exception 'Sem permissão para enviar Pix.' using errcode = '42501';
  end if;

  select * into pe from public.pedidos where id = p_pedido_id;
  if not found then
    raise exception 'Pedido não encontrado.' using errcode = 'P0001';
  end if;

  v_valor := round(coalesce(p_valor, pe.total), 2);
  v_codigo := public.pix_payload(v_valor, 'PED' || pe.numero);

  select * into c from public.config_pix where id;
  if c.mensagem is not null then
    v_msg := replace(replace(replace(c.mensagem,
      '{nome}', split_part(coalesce(pe.cliente_nome, ''), ' ', 1)),
      '{pedido}', '#' || pe.numero),
      '{valor}', -- "1,234.56" (padrão fixo, independe do idioma do servidor) → "1.234,56"
      'R$ ' || replace(replace(replace(to_char(v_valor, 'FM999,999,990.00'), ',', '#'), '.', ','), '#', '.'));
    insert into public.mensagens (cliente_id, pedido_id, remetente_id, texto, tipo)
    values (pe.cliente_id, pe.id, auth.uid(), v_msg, 'normal');
  end if;

  insert into public.mensagens (cliente_id, pedido_id, remetente_id, texto, tipo)
  values (pe.cliente_id, pe.id, auth.uid(), v_codigo, 'pix');

  return v_codigo;
end;
$$;

-- 6.10 Relatórios (permissão relatorios.ver). Até 5000 linhas por relatório.
-- p_status: null/'' = todos | 'pagos' = indo_entrega + enviado | ou um status específico

create or replace function public.relatorio_vendas(p_inicio timestamptz, p_fim timestamptz, p_status text default null)
returns table (
  id uuid, numero bigint, created_at timestamptz, cliente_nome text, cliente_email text,
  cliente_telefone text, itens bigint, total numeric, status text
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.has_permission('relatorios', 'ver') then
    raise exception 'Sem permissão para ver relatórios.' using errcode = '42501';
  end if;

  return query
  select pe.id, pe.numero, pe.created_at, pe.cliente_nome, pe.cliente_email, pe.cliente_telefone,
         coalesce((select sum(pi.quantidade) from public.pedido_itens pi where pi.pedido_id = pe.id), 0)::bigint,
         pe.total, pe.status
  from public.pedidos pe
  where pe.created_at >= p_inicio and pe.created_at < p_fim
    and (coalesce(p_status, '') = ''
         or pe.status = p_status
         or (p_status = 'pagos' and pe.status in ('indo_entrega','enviado')))
  order by pe.created_at desc
  limit 5000;
end;
$$;

create or replace function public.relatorio_produtos_vendidos(p_inicio timestamptz, p_fim timestamptz, p_status text default null)
returns table (
  produto_nome text, categoria text, quantidade bigint, pedidos bigint, receita numeric, preco_medio numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.has_permission('relatorios', 'ver') then
    raise exception 'Sem permissão para ver relatórios.' using errcode = '42501';
  end if;

  return query
  select pi.produto_nome,
         max(c.nome),
         sum(pi.quantidade)::bigint,
         count(distinct pi.pedido_id)::bigint,
         sum(pi.subtotal),
         round(sum(pi.subtotal) / nullif(sum(pi.quantidade), 0), 2)
  from public.pedido_itens pi
  join public.pedidos pe on pe.id = pi.pedido_id
  left join public.produtos p on p.id = pi.produto_id
  left join public.categorias c on c.id = p.categoria_id
  where pe.created_at >= p_inicio and pe.created_at < p_fim
    and (coalesce(p_status, '') = ''
         or pe.status = p_status
         or (p_status = 'pagos' and pe.status in ('indo_entrega','enviado')))
  group by pi.produto_id, pi.produto_nome
  order by sum(pi.quantidade) desc, sum(pi.subtotal) desc
  limit 5000;
end;
$$;

-- p_situacao: null/'' = todos | ok | baixo | esgotado
create or replace function public.relatorio_estoque(p_situacao text default null)
returns table (
  nome text, categoria text, preco numeric, estoque integer, estoque_minimo integer,
  valor_estoque numeric, ativo boolean, situacao text
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.has_permission('relatorios', 'ver') then
    raise exception 'Sem permissão para ver relatórios.' using errcode = '42501';
  end if;

  return query
  select * from (
    select p.nome, c.nome as categoria, p.preco, p.estoque, p.estoque_minimo,
           (p.preco * p.estoque)::numeric(14,2) as valor_estoque, p.ativo,
           case when p.estoque = 0 then 'esgotado'
                when p.estoque <= p.estoque_minimo then 'baixo'
                else 'ok' end as situacao
    from public.produtos p
    left join public.categorias c on c.id = p.categoria_id
  ) x
  where coalesce(p_situacao, '') = '' or x.situacao = p_situacao
  order by x.nome
  limit 5000;
end;
$$;

-- p_tipo: null/'' = todos | entrada | saida
create or replace function public.relatorio_movimentacoes(p_inicio timestamptz, p_fim timestamptz, p_tipo text default null)
returns table (
  created_at timestamptz, produto_nome text, tipo text, quantidade integer,
  estoque_anterior integer, estoque_novo integer, motivo text, usuario_nome text
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.has_permission('relatorios', 'ver') then
    raise exception 'Sem permissão para ver relatórios.' using errcode = '42501';
  end if;

  return query
  select m.created_at, p.nome, m.tipo, m.quantidade, m.estoque_anterior, m.estoque_novo,
         m.motivo, coalesce(m.usuario_nome, 'Sistema')
  from public.estoque_movimentacoes m
  join public.produtos p on p.id = m.produto_id
  where m.created_at >= p_inicio and m.created_at < p_fim
    and (coalesce(p_tipo, '') = '' or m.tipo = p_tipo)
  order by m.created_at desc
  limit 5000;
end;
$$;

-- Clientes que compraram no período (sem CPF)
create or replace function public.relatorio_clientes(p_inicio timestamptz, p_fim timestamptz, p_status text default null)
returns table (
  nome text, email text, telefone text, cidade text, pedidos bigint, total numeric, ultimo_pedido timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.has_permission('relatorios', 'ver') then
    raise exception 'Sem permissão para ver relatórios.' using errcode = '42501';
  end if;

  return query
  select p.nome_completo, p.email, p.telefone,
         case when p.cidade is null then null else p.cidade || '/' || coalesce(p.uf, '') end,
         count(pe.id)::bigint, sum(pe.total), max(pe.created_at)
  from public.pedidos pe
  join public.profiles p on p.id = pe.cliente_id
  where pe.created_at >= p_inicio and pe.created_at < p_fim
    and (coalesce(p_status, '') = ''
         or pe.status = p_status
         or (p_status = 'pagos' and pe.status in ('indo_entrega','enviado')))
  group by p.id, p.nome_completo, p.email, p.telefone, p.cidade, p.uf
  order by sum(pe.total) desc
  limit 5000;
end;
$$;

-- =====================================================================
-- 7. PRIVILÉGIOS DE FUNÇÕES INTERNAS
-- =====================================================================
revoke execute on function public.user_has_permission(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.disparar_whatsapp(uuid, text) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.handle_user_email_change() from public, anon, authenticated;
revoke execute on function public.conversa_garantir(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.mensagem_sistema(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.pix_payload(numeric, text) from public, anon, authenticated;

-- =====================================================================
-- 8. ROW LEVEL SECURITY
-- =====================================================================
alter table public.perfis_acesso           enable row level security;
alter table public.perfil_permissoes       enable row level security;
alter table public.profiles                enable row level security;
alter table public.categorias              enable row level security;
alter table public.produtos                enable row level security;
alter table public.produto_imagens         enable row level security;
alter table public.carrinhos               enable row level security;
alter table public.carrinho_itens          enable row level security;
alter table public.favoritos               enable row level security;
alter table public.pedidos                 enable row level security;
alter table public.pedido_itens            enable row level security;
alter table public.pedido_status_historico enable row level security;
alter table public.mensagens               enable row level security;
alter table public.estoque_movimentacoes   enable row level security;
alter table public.notificacoes            enable row level security;
alter table public.whatsapp_logs           enable row level security;
alter table public.conversas               enable row level security;
alter table public.respostas_rapidas       enable row level security;
alter table public.config_pix              enable row level security;

-- Remove políticas anteriores (para permitir reexecução do script)
do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in (
      'perfis_acesso','perfil_permissoes','profiles','categorias','produtos','produto_imagens',
      'carrinhos','carrinho_itens','favoritos','pedidos','pedido_itens','pedido_status_historico',
      'mensagens','estoque_movimentacoes','notificacoes','whatsapp_logs','conversas','respostas_rapidas','config_pix')
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- perfis_acesso
create policy perfis_acesso_select on public.perfis_acesso for select to authenticated
  using (public.has_permission('perfis','ver') or public.has_permission('usuarios','ver'));
create policy perfis_acesso_insert on public.perfis_acesso for insert to authenticated
  with check (public.has_permission('perfis','criar'));
create policy perfis_acesso_update on public.perfis_acesso for update to authenticated
  using (public.has_permission('perfis','editar') and not sistema)
  with check (public.has_permission('perfis','editar'));
create policy perfis_acesso_delete on public.perfis_acesso for delete to authenticated
  using (public.has_permission('perfis','excluir'));

-- perfil_permissoes
create policy perfil_permissoes_select on public.perfil_permissoes for select to authenticated
  using (public.has_permission('perfis','ver')
         or perfil_id = (select perfil_acesso_id from public.profiles where id = auth.uid()));
create policy perfil_permissoes_insert on public.perfil_permissoes for insert to authenticated
  with check (public.has_permission('perfis','editar') or public.has_permission('perfis','criar'));
create policy perfil_permissoes_delete on public.perfil_permissoes for delete to authenticated
  using (public.has_permission('perfis','editar'));

-- profiles: cliente vê/edita só o próprio. Equipe conforme permissão.
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or (role = 'cliente' and public.has_permission('clientes','ver_cpf'))
    or (role <> 'cliente' and public.has_permission('usuarios','ver'))
  );
create policy profiles_update on public.profiles for update to authenticated
  using (
    id = auth.uid()
    or (role = 'cliente' and public.has_permission('clientes','editar'))
    or (role <> 'cliente' and public.has_permission('usuarios','editar'))
  )
  with check (
    id = auth.uid()
    or public.has_permission('clientes','editar')
    or public.has_permission('usuarios','editar')
  );

-- categorias: visitante lê as ativas
create policy categorias_select on public.categorias for select to anon, authenticated
  using (ativo or public.has_permission('categorias','ver') or public.has_permission('produtos','ver'));
create policy categorias_insert on public.categorias for insert to authenticated
  with check (public.has_permission('categorias','criar'));
create policy categorias_update on public.categorias for update to authenticated
  using (public.has_permission('categorias','editar'))
  with check (public.has_permission('categorias','editar'));
create policy categorias_delete on public.categorias for delete to authenticated
  using (public.has_permission('categorias','excluir'));

-- produtos: visitante lê os ativos
create policy produtos_select on public.produtos for select to anon, authenticated
  using (ativo or public.has_permission('produtos','ver') or public.has_permission('estoque','ver'));
create policy produtos_insert on public.produtos for insert to authenticated
  with check (public.has_permission('produtos','criar'));
create policy produtos_update on public.produtos for update to authenticated
  using (public.has_permission('produtos','editar'))
  with check (public.has_permission('produtos','editar'));
create policy produtos_delete on public.produtos for delete to authenticated
  using (public.has_permission('produtos','excluir'));

-- produto_imagens
create policy produto_imagens_select on public.produto_imagens for select to anon, authenticated
  using (exists (
    select 1 from public.produtos p where p.id = produto_id
      and (p.ativo or public.has_permission('produtos','ver') or public.has_permission('estoque','ver'))
  ));
create policy produto_imagens_insert on public.produto_imagens for insert to authenticated
  with check (public.has_permission('produtos','criar') or public.has_permission('produtos','editar'));
create policy produto_imagens_update on public.produto_imagens for update to authenticated
  using (public.has_permission('produtos','editar'))
  with check (public.has_permission('produtos','editar'));
create policy produto_imagens_delete on public.produto_imagens for delete to authenticated
  using (public.has_permission('produtos','editar') or public.has_permission('produtos','excluir'));

-- carrinhos / itens: somente o dono
create policy carrinhos_select on public.carrinhos for select to authenticated
  using (user_id = auth.uid());
create policy carrinhos_insert on public.carrinhos for insert to authenticated
  with check (user_id = auth.uid());
create policy carrinhos_delete on public.carrinhos for delete to authenticated
  using (user_id = auth.uid());

create policy carrinho_itens_select on public.carrinho_itens for select to authenticated
  using (exists (select 1 from public.carrinhos c where c.id = carrinho_id and c.user_id = auth.uid()));
create policy carrinho_itens_insert on public.carrinho_itens for insert to authenticated
  with check (exists (select 1 from public.carrinhos c where c.id = carrinho_id and c.user_id = auth.uid()));
create policy carrinho_itens_update on public.carrinho_itens for update to authenticated
  using (exists (select 1 from public.carrinhos c where c.id = carrinho_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.carrinhos c where c.id = carrinho_id and c.user_id = auth.uid()));
create policy carrinho_itens_delete on public.carrinho_itens for delete to authenticated
  using (exists (select 1 from public.carrinhos c where c.id = carrinho_id and c.user_id = auth.uid()));

-- favoritos
create policy favoritos_select on public.favoritos for select to authenticated
  using (user_id = auth.uid());
create policy favoritos_insert on public.favoritos for insert to authenticated
  with check (user_id = auth.uid());
create policy favoritos_delete on public.favoritos for delete to authenticated
  using (user_id = auth.uid());

-- pedidos: criação somente pela função finalizar_pedido (sem policy de insert)
create policy pedidos_select on public.pedidos for select to authenticated
  using (cliente_id = auth.uid() or public.has_permission('pedidos','ver'));
create policy pedidos_update on public.pedidos for update to authenticated
  using (public.has_permission('pedidos','alterar_status') or public.has_permission('pedidos','editar'))
  with check (public.has_permission('pedidos','alterar_status') or public.has_permission('pedidos','editar'));
create policy pedidos_delete on public.pedidos for delete to authenticated
  using (public.has_permission('pedidos','excluir'));

create policy pedido_itens_select on public.pedido_itens for select to authenticated
  using (exists (select 1 from public.pedidos pe where pe.id = pedido_id
                 and (pe.cliente_id = auth.uid() or public.has_permission('pedidos','ver'))));

create policy pedido_status_hist_select on public.pedido_status_historico for select to authenticated
  using (exists (select 1 from public.pedidos pe where pe.id = pedido_id
                 and (pe.cliente_id = auth.uid() or public.has_permission('pedidos','ver'))));

-- mensagens
create policy mensagens_select on public.mensagens for select to authenticated
  using (
    cliente_id = auth.uid()
    or public.has_permission('chat','ver')
    or (pedido_id is not null and public.has_permission('pedidos','ver'))
  );
create policy mensagens_insert on public.mensagens for insert to authenticated
  with check (
    remetente_id = auth.uid()
    and (
      -- cliente escrevendo na própria conversa
      (cliente_id = auth.uid() and tipo = 'normal'
        and (pedido_id is null or exists (
          select 1 from public.pedidos pe where pe.id = pedido_id and pe.cliente_id = auth.uid())))
      -- equipe respondendo
      or (tipo = 'normal' and public.has_permission('chat','criar'))
      or (tipo = 'pix' and public.has_permission('pedidos','enviar_pix'))
    )
  );
create policy mensagens_delete on public.mensagens for delete to authenticated
  using (public.has_permission('chat','excluir'));

-- estoque_movimentacoes: escrita somente via movimentar_estoque
create policy estoque_mov_select on public.estoque_movimentacoes for select to authenticated
  using (public.has_permission('estoque','ver'));

-- notificacoes: somente o dono. Criação via triggers.
create policy notificacoes_select on public.notificacoes for select to authenticated
  using (user_id = auth.uid());
create policy notificacoes_update on public.notificacoes for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notificacoes_delete on public.notificacoes for delete to authenticated
  using (user_id = auth.uid());

-- conversas: cliente vê as próprias; equipe com chat. Escrita só por trigger/funções.
create policy conversas_select on public.conversas for select to authenticated
  using (cliente_id = auth.uid() or public.has_permission('chat','ver'));

-- respostas rápidas: equipe do chat
create policy respostas_rapidas_select on public.respostas_rapidas for select to authenticated
  using (public.has_permission('chat','ver'));
create policy respostas_rapidas_insert on public.respostas_rapidas for insert to authenticated
  with check (public.has_permission('chat','criar'));
create policy respostas_rapidas_update on public.respostas_rapidas for update to authenticated
  using (public.has_permission('chat','criar')) with check (public.has_permission('chat','criar'));
create policy respostas_rapidas_delete on public.respostas_rapidas for delete to authenticated
  using (public.has_permission('chat','criar'));

-- config_pix: leitura para quem envia Pix; escrita só pela função salvar_config_pix (admin)
create policy config_pix_select on public.config_pix for select to authenticated
  using (public.is_admin() or public.has_permission('pedidos','enviar_pix'));

-- whatsapp_logs: somente admin
create policy whatsapp_logs_select on public.whatsapp_logs for select to authenticated
  using (public.is_admin());

-- =====================================================================
-- 9. STORAGE
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('produtos', 'produtos', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif']),
  ('chat-anexos', 'chat-anexos', false, 5242880, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "produtos: leitura publica" on storage.objects;
drop policy if exists "produtos: upload equipe" on storage.objects;
drop policy if exists "produtos: update equipe" on storage.objects;
drop policy if exists "produtos: delete equipe" on storage.objects;
drop policy if exists "chat: leitura" on storage.objects;
drop policy if exists "chat: upload" on storage.objects;

create policy "produtos: leitura publica" on storage.objects for select to anon, authenticated
  using (bucket_id = 'produtos');
create policy "produtos: upload equipe" on storage.objects for insert to authenticated
  with check (bucket_id = 'produtos'
              and (public.has_permission('produtos','criar') or public.has_permission('produtos','editar')));
create policy "produtos: update equipe" on storage.objects for update to authenticated
  using (bucket_id = 'produtos' and public.has_permission('produtos','editar'));
create policy "produtos: delete equipe" on storage.objects for delete to authenticated
  using (bucket_id = 'produtos'
         and (public.has_permission('produtos','editar') or public.has_permission('produtos','excluir')));

-- chat-anexos: arquivos ficam em "<cliente_id>/<arquivo>". O cliente acessa a própria pasta;
-- a equipe com permissão de chat/pedidos acessa todas. Leitura via URL assinada.
create policy "chat: leitura" on storage.objects for select to authenticated
  using (bucket_id = 'chat-anexos' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.has_permission('chat','ver')
    or public.has_permission('pedidos','ver')
  ));
create policy "chat: upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-anexos' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.has_permission('chat','criar')
    or public.has_permission('pedidos','enviar_pix')
  ));

-- =====================================================================
-- 10. REALTIME
-- =====================================================================
do $$
begin
  begin
    alter publication supabase_realtime add table public.mensagens;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.notificacoes;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.pedidos;
  exception when duplicate_object then null;
  end;
end $$;

-- =====================================================================
-- 11. SEEDS
-- =====================================================================

-- Perfil padrão "Administrador" com tudo liberado
insert into public.perfis_acesso (nome, descricao, sistema)
values ('Administrador', 'Acesso total ao painel (perfil padrão do sistema).', true)
on conflict (nome) do update set sistema = true;

insert into public.perfil_permissoes (perfil_id, modulo, acao)
select pa.id, m.modulo, a.acao
from public.perfis_acesso pa
cross join (values ('dashboard'),('produtos'),('categorias'),('pedidos'),('chat'),
                   ('estoque'),('clientes'),('usuarios'),('perfis'),('relatorios')) as m(modulo)
cross join (values ('ver'),('criar'),('editar'),('excluir')) as a(acao)
where pa.nome = 'Administrador'
on conflict do nothing;

insert into public.perfil_permissoes (perfil_id, modulo, acao)
select pa.id, x.modulo, x.acao
from public.perfis_acesso pa
cross join (values ('pedidos','alterar_status'),('pedidos','enviar_pix'),('estoque','movimentar'),
                   ('dashboard','ver_faturamento'),('clientes','ver_cpf')) as x(modulo, acao)
where pa.nome = 'Administrador'
on conflict do nothing;

-- Perfis de exemplo
insert into public.perfis_acesso (nome, descricao)
values ('Vendedor', 'Atende clientes, acompanha pedidos e envia Pix.'),
       ('Estoquista', 'Gerencia produtos e estoque.')
on conflict (nome) do nothing;

insert into public.perfil_permissoes (perfil_id, modulo, acao)
select pa.id, x.modulo, x.acao
from public.perfis_acesso pa
cross join (values
  ('dashboard','ver'),('produtos','ver'),('categorias','ver'),
  ('pedidos','ver'),('pedidos','alterar_status'),('pedidos','enviar_pix'),
  ('chat','ver'),('chat','criar'),('clientes','ver')) as x(modulo, acao)
where pa.nome = 'Vendedor'
on conflict do nothing;

insert into public.perfil_permissoes (perfil_id, modulo, acao)
select pa.id, x.modulo, x.acao
from public.perfis_acesso pa
cross join (values
  ('dashboard','ver'),('produtos','ver'),('produtos','criar'),('produtos','editar'),
  ('categorias','ver'),('estoque','ver'),('estoque','movimentar')) as x(modulo, acao)
where pa.nome = 'Estoquista'
on conflict do nothing;

-- Categorias
insert into public.categorias (nome, slug, descricao, ordem) values
  ('Celulares',    'celulares',    'Smartphones novos e seminovos.', 1),
  ('Capas',        'capas',        'Capas e cases para proteger seu aparelho.', 2),
  ('Carregadores', 'carregadores', 'Carregadores, cabos e fontes.', 3),
  ('Fones',        'fones',        'Fones com e sem fio.', 4),
  ('Películas',    'peliculas',    'Películas de vidro e hidrogel.', 5)
on conflict (slug) do nothing;

-- Respostas rápidas (somente se a tabela estiver vazia)
insert into public.respostas_rapidas (titulo, texto, ordem)
select v.titulo, v.texto, v.ordem
from (values
  ('Saudação', 'Olá, {nome}! Tudo bem? Aqui é da Nasci Imports. Como posso te ajudar?', 1),
  ('Pix enviado', '{nome}, enviei o código Pix acima. Depois de pagar, é só mandar o comprovante aqui no chat. 😉', 2),
  ('Pagamento confirmado', 'Pagamento confirmado, {nome}! Já estamos separando seu pedido.', 3),
  ('Saiu para entrega', '{nome}, seu pedido saiu para entrega! Qualquer dúvida, estamos por aqui.', 4),
  ('Aguarde', 'Só um instante, {nome}, já vou verificar para você.', 5),
  ('Encerramento', 'Obrigado pelo contato, {nome}! Se precisar de algo, é só chamar. 💚', 6)
) as v(titulo, texto, ordem)
where not exists (select 1 from public.respostas_rapidas);

-- Produtos (somente se a tabela estiver vazia)
insert into public.produtos (nome, descricao, especificacoes, preco, categoria_id, estoque, estoque_minimo, destaque)
select v.nome, v.descricao, v.especificacoes::jsonb, v.preco, c.id, v.estoque, v.estoque_minimo, v.destaque
from (values
  ('iPhone 15 128GB', 'iPhone 15 com Dynamic Island, câmera de 48 MP e USB-C.',
   '[{"nome":"Armazenamento","valor":"128 GB"},{"nome":"Tela","valor":"6,1\" Super Retina XDR"},{"nome":"Câmera","valor":"48 MP + 12 MP"}]',
   4999.00, 'celulares', 8, 2, true),
  ('Samsung Galaxy S24 256GB', 'Galaxy S24 com Galaxy AI e tela Dynamic AMOLED 2X.',
   '[{"nome":"Armazenamento","valor":"256 GB"},{"nome":"Memória RAM","valor":"8 GB"},{"nome":"Tela","valor":"6,2\" 120 Hz"}]',
   4299.00, 'celulares', 5, 2, true),
  ('Xiaomi Redmi Note 13 128GB', 'Ótimo custo-benefício com tela AMOLED de 120 Hz.',
   '[{"nome":"Armazenamento","valor":"128 GB"},{"nome":"Memória RAM","valor":"6 GB"},{"nome":"Bateria","valor":"5000 mAh"}]',
   1299.00, 'celulares', 12, 3, true),
  ('Capa MagSafe Transparente iPhone 15', 'Capa transparente anti-amarelamento com ímãs MagSafe.',
   '[{"nome":"Compatibilidade","valor":"iPhone 15"},{"nome":"Material","valor":"Policarbonato + TPU"}]',
   89.90, 'capas', 30, 5, false),
  ('Capa Silicone Galaxy S24', 'Capa de silicone com toque aveludado.',
   '[{"nome":"Compatibilidade","valor":"Galaxy S24"},{"nome":"Material","valor":"Silicone"}]',
   59.90, 'capas', 2, 5, false),
  ('Carregador Turbo USB-C 20W', 'Carregador rápido compatível com iPhone e Android.',
   '[{"nome":"Potência","valor":"20 W"},{"nome":"Saída","valor":"USB-C PD"}]',
   99.90, 'carregadores', 25, 5, true),
  ('Cabo USB-C para Lightning 1m', 'Cabo reforçado para carregamento rápido.',
   '[{"nome":"Comprimento","valor":"1 metro"},{"nome":"Conectores","valor":"USB-C / Lightning"}]',
   49.90, 'carregadores', 0, 5, false),
  ('Fone Bluetooth TWS Pro', 'Fone sem fio com cancelamento de ruído e estojo de recarga.',
   '[{"nome":"Conexão","valor":"Bluetooth 5.3"},{"nome":"Autonomia","valor":"Até 24 h com estojo"}]',
   199.90, 'fones', 15, 4, true),
  ('Película de Vidro 3D iPhone 15', 'Película de vidro temperado com borda 3D.',
   '[{"nome":"Compatibilidade","valor":"iPhone 15"},{"nome":"Dureza","valor":"9H"}]',
   29.90, 'peliculas', 50, 10, false)
) as v(nome, descricao, especificacoes, preco, categoria_slug, estoque, estoque_minimo, destaque)
join public.categorias c on c.slug = v.categoria_slug
where not exists (select 1 from public.produtos);

-- =====================================================================
-- PRIMEIRO ADMIN (execute depois de se cadastrar no site):
--
--   update public.profiles
--   set role = 'admin',
--       perfil_acesso_id = (select id from public.perfis_acesso where nome = 'Administrador')
--   where email = 'seu-email@exemplo.com';
-- =====================================================================
