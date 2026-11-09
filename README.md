# Nasci Imports — E-commerce de celulares e acessórios

React (Vite) + CSS puro + Supabase (Auth, Postgres, RLS, Storage, Realtime e Edge Functions).
Hospedagem do front-end no **Vercel**.

> Sem frete e sem gateway de pagamento: o pedido é gerado como **Pendente** e o pagamento (Pix) é combinado no **chat do pedido**.

---

## 1. Arquitetura

```
Navegador (React SPA no Vercel)
   │  chave anon (pública) + JWT do usuário
   ▼
Supabase
 ├─ Auth ........ e-mail/senha, Google, confirmação de e-mail, recuperação de senha
 ├─ Postgres .... tabelas + RLS (has_permission) + triggers + funções RPC
 ├─ Storage ..... produtos (público) | chat-anexos (privado, URL assinada)
 ├─ Realtime .... mensagens, notificacoes, pedidos
 └─ Edge Functions (service_role só aqui)
     ├─ criar-usuario-interno  → cria/edita funcionários no Auth
     └─ notificar-whatsapp     → chamada pelo trigger (pg_net) a cada mudança de status
                                  └─ provider.ts (WhatsApp Cloud API da Meta)
```

**Segurança:** o front-end esconde menus/botões com `usePermission` e `ProtectedRoute`, mas a proteção real está no banco: todas as tabelas têm RLS e as políticas usam `has_permission(modulo, acao)`. Preços do pedido são calculados no banco (`finalizar_pedido`), e o estoque só muda pela função `movimentar_estoque` (com histórico).

### Árvore de pastas

```
├── index.html
├── vercel.json                  # rewrite da SPA para o Vercel
├── .env.example
├── public/                      # coloque aqui o logo.png (opcional)
├── supabase/
│   ├── schema.sql               # schema, RLS, funções, triggers, buckets, realtime, seeds
│   └── functions/
│       ├── _shared/cors.ts
│       ├── criar-usuario-interno/index.ts
│       └── notificar-whatsapp/{index.ts, provider.ts}
└── src/
    ├── main.jsx · App.jsx       # providers e rotas (lazy loading)
    ├── components/              # UI reutilizável (+ chat/ e admin/)
    ├── contexts/                # Auth, Cart, Notification
    ├── hooks/                   # useAuth, useCart, usePermission, useChat, ...
    ├── layouts/                 # StoreLayout, AccountLayout, AdminLayout
    ├── pages/                   # loja, account/ (cliente) e admin/
    ├── services/                # acesso ao Supabase e ViaCEP
    ├── styles/                  # variables.css + CSS por área (mobile-first)
    └── utils/                   # máscaras, validações, formatação, constantes
```

---

## 2. Rodando localmente

```bash
npm install
cp .env.example .env      # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev               # http://localhost:5173
npm run build             # gera dist/
```

Dependências usadas: `@supabase/supabase-js`, `react-router-dom`, `lucide-react`, `react-hot-toast`.

---

## 3. Configuração do Supabase

### 3.1 Projeto e banco
1. Crie um projeto em <https://supabase.com>.
2. **SQL Editor → New query** → cole todo o conteúdo de `supabase/schema.sql` → **Run**.
   O script cria tabelas, RLS, funções, triggers, buckets, realtime e dados de exemplo (pode ser executado de novo sem erro).
3. **Project Settings → API**: copie a `Project URL` e a chave `anon public` para o `.env`.

### 3.2 Auth (e-mail/senha)
- **Authentication → Providers → Email**: deixe habilitado e ative **Confirm email**.
- **Authentication → URL Configuration**:
  - *Site URL*: `https://SEU-DOMINIO.vercel.app`
  - *Redirect URLs*: adicione
    - `http://localhost:5173/**`
    - `https://SEU-DOMINIO.vercel.app/**`
    - (se usar previews do Vercel) `https://*-SEU-TIME.vercel.app/**`
- Os links de confirmação levam a `/login` e o de recuperação a `/redefinir-senha`.
- Recomendado em produção: configure um SMTP próprio em **Authentication → Emails → SMTP** (o envio padrão do Supabase tem limite baixo).

### 3.3 Login com Google
1. No [Google Cloud Console](https://console.cloud.google.com/): **APIs e serviços → Tela de consentimento OAuth** (tipo Externo) e depois **Credenciais → Criar ID do cliente OAuth → Aplicativo da Web**.
2. Em *URIs de redirecionamento autorizados* informe: `https://<ref-do-projeto>.supabase.co/auth/v1/callback`.
3. No Supabase: **Authentication → Providers → Google** → ative e cole *Client ID* e *Client Secret*.

Quem entra pelo Google ganha um profile com nome/e-mail; CPF, telefone e endereço são pedidos no checkout antes da primeira compra (também validado no banco por `finalizar_pedido`).

### 3.4 Storage
Os buckets são criados pelo SQL:
- `produtos` — leitura pública; escrita só da equipe com permissão de produtos.
- `chat-anexos` — privado; arquivos em `<cliente_id>/arquivo`. Cliente acessa a própria pasta; equipe com permissão de chat/pedidos acessa todas. A leitura usa URL assinada (1 h).

Confira em **Storage** se os dois buckets existem.

### 3.5 Realtime
O SQL adiciona `mensagens`, `notificacoes` e `pedidos` à publicação `supabase_realtime`. Confira em **Database → Publications → supabase_realtime**.

### 3.6 Edge Functions
Instale a [Supabase CLI](https://supabase.com/docs/guides/cli) e, na raiz do projeto:

```bash
supabase login
supabase link --project-ref <ref-do-projeto>

supabase functions deploy criar-usuario-interno --no-verify-jwt
supabase functions deploy notificar-whatsapp   --no-verify-jwt
```

`--no-verify-jwt` é usado porque cada função faz a própria validação:
- `criar-usuario-interno` valida o JWT do chamador e a permissão `usuarios.criar/editar` no banco.
- `notificar-whatsapp` exige o header `x-webhook-secret`.

`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já são injetados automaticamente nas funções.

---

## 4. Notificação por WhatsApp (WhatsApp Cloud API — Meta)

Fluxo: o status do pedido muda → trigger `pedidos_status_trigger` cria a notificação no sistema e chama `disparar_whatsapp` → `pg_net` faz um POST assíncrono para a Edge Function `notificar-whatsapp` → `provider.ts` envia o modelo para o telefone do cliente. Todo envio (sucesso ou erro) fica em `public.whatsapp_logs`. **Falhas nunca bloqueiam a mudança de status.**

### 4.1 Configurar a Meta
1. Crie um app em <https://developers.facebook.com/> (tipo *Empresa*) e adicione o produto **WhatsApp**.
2. Em **WhatsApp → Configuração da API**, anote o **Phone number ID** e adicione/verifique o número remetente da loja.
3. Gere um **token permanente**: Business Settings → *Usuários do sistema* → crie um usuário do sistema (Admin) → *Gerar token* com as permissões `whatsapp_business_messaging` e `whatsapp_business_management`.
4. Crie o **modelo de mensagem** em **WhatsApp Manager → Modelos de mensagem**:
   - Nome: `status_pedido` · Categoria: **Utilidade** · Idioma: **Português (BR)** (`pt_BR`)
   - Corpo (3 variáveis):
     ```
     Olá {{1}}! O status do seu pedido #{{2}} na Nasci Imports foi atualizado para: *{{3}}*.
     Qualquer dúvida, fale com a gente pelo chat do site.
     ```
   - Exemplos para aprovação: `{{1}}` = Maria, `{{2}}` = 1001, `{{3}}` = Indo pra entrega.
   - Aguarde a aprovação (normalmente minutos).

### 4.2 Secrets da Edge Function
```bash
supabase secrets set \
  WHATSAPP_TOKEN="token-permanente" \
  WHATSAPP_PHONE_NUMBER_ID="123456789012345" \
  WHATSAPP_TEMPLATE_NAME="status_pedido" \
  WHATSAPP_TEMPLATE_LANG="pt_BR" \
  WHATSAPP_WEBHOOK_SECRET="uma-senha-longa-e-aleatoria"
# opcional: WHATSAPP_GRAPH_VERSION="v21.0"
```

### 4.3 Segredos no Vault (para o trigger chamar a função)
No **SQL Editor**:
```sql
select vault.create_secret('https://<ref-do-projeto>.supabase.co/functions/v1', 'edge_functions_url');
select vault.create_secret('uma-senha-longa-e-aleatoria', 'whatsapp_webhook_secret'); -- mesmo valor do WHATSAPP_WEBHOOK_SECRET
```
Sem esses segredos, a mudança de status funciona normalmente e o motivo fica registrado em `whatsapp_logs`.

### 4.4 Conferir envios
```sql
select created_at, status_pedido, telefone, sucesso, erro from public.whatsapp_logs order by created_at desc limit 20;
select * from net._http_response order by created  desc limit 20; -- respostas do pg_net
```
O telefone usado é o do cadastro do cliente, com DDI 55 adicionado automaticamente.

> **Trocar de provedor** (Z-API, Twilio, Evolution...): reescreva apenas `supabase/functions/notificar-whatsapp/provider.ts`, mantendo a função `enviarStatusPedido`.

> **Alternativa sem Vault:** em **Database → Webhooks** crie um webhook na tabela `pedidos` (evento *Update*) apontando para a função `notificar-whatsapp` com o header `x-webhook-secret`. A função aceita o formato de webhook e ignora updates sem mudança de status. Nesse caso, remova a linha `perform public.disparar_whatsapp(...)` do trigger para não enviar em dobro.

---

## 5. Criar o primeiro administrador
1. Rode o site e cadastre-se normalmente (ou entre com Google).
2. No **SQL Editor**:
   ```sql
   update public.profiles
   set role = 'admin',
       perfil_acesso_id = (select id from public.perfis_acesso where nome = 'Administrador')
   where email = 'seu-email@exemplo.com';
   ```
3. Saia e entre de novo: o menu **Painel** aparece e `/admin` fica liberado.

Depois disso, os funcionários são criados pelo próprio painel em **Usuários internos** (via Edge Function) e recebem um **Perfil de acesso** (os seeds trazem *Administrador*, *Vendedor* e *Estoquista*).

---

## 6. Deploy no Vercel
1. Suba o projeto para um repositório no GitHub.
2. Em <https://vercel.com/new> importe o repositório. O Vercel detecta **Vite** automaticamente (build `npm run build`, saída `dist`).
3. **Settings → Environment Variables** (Production e Preview):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. O `vercel.json` já faz o rewrite de todas as rotas para `index.html` (necessário para `/produto/:id`, `/admin`, etc.).
5. Volte ao Supabase e confira *Site URL* e *Redirect URLs* com o domínio final (seção 3.2). Se usar domínio próprio, adicione-o também.

> Variáveis `VITE_*` são embutidas no build: ao alterá-las no Vercel, faça um novo deploy.

---

## 7. Atendimento (chat da equipe)

Cada conversa (cliente + pedido, ou cliente + “geral”) tem situação **Aberta** ou **Finalizada** e um **atendente** responsável (tabela `conversas`).

- **Finalizar:** botão no chat. Envia uma mensagem de encerramento (opcional, editável) e move a conversa para “Finalizadas”. Se o cliente escrever de novo, ela **reabre sozinha**.
- **Reabrir / Assumir / Transferir:** registram um aviso no chat (visível também para o cliente).
- A **primeira resposta** da equipe já define o atendente, se ninguém tiver assumido.
- **Filtros:** abas Abertas / Finalizadas / Todas e atalhos Não lidas, Aguardando resposta (última mensagem é do cliente), Meus, Pedidos e Geral.
- **Respostas rápidas:** botão de raio ou `/` no campo de mensagem; `{nome}` vira o primeiro nome do cliente. Cadastre em **Atendimento → Respostas rápidas** (compartilhadas pela equipe).
- **Dados do cliente** ao lado do chat (telas largas) ou no botão “Cliente”: telefone com atalho para o WhatsApp, e-mail, cidade e últimos pedidos.
- Quem pode finalizar, reabrir, assumir e transferir: permissão **chat → criar** (responder).

> **Atualizando um banco que já existia:** basta rodar o `supabase/schema.sql` inteiro de novo no SQL Editor. Ele cria as tabelas novas e migra as conversas antigas sem apagar nada.

---

## 8. Relatórios

Em **/admin/relatorios** (permissão **Relatórios → ver**):

| Relatório | Filtros |
|---|---|
| Vendas | período, status (todos / pagos / um status) |
| Produtos mais vendidos (ranking) | período, status |
| Posição de estoque | situação (ok / baixo / esgotado) |
| Movimentações de estoque | período, tipo (entrada / saída) |
| Clientes (quem comprou e quanto gastou) | período, status |

- Cada relatório mostra cartões de resumo, a tabela (até 300 linhas na tela) e uma linha de totais.
- **Exportar PDF:** A4 com faixa preta, logo, linha verde, cartões de resumo, tabela com status coloridos, totais e “Página X de Y”. As páginas seguintes repetem um cabeçalho compacto.
- **Exportar Excel (.xlsx):** mesmo visual, com valores como números reais (moeda, datas e quantidades formatadas), filtro nas colunas, cabeçalho congelado e linha de total.
- A exportação inclui **todas** as linhas (até 5.000 por relatório). A logo usada é `src/assets/Logo-nasci.jpg`.
- O CPF dos clientes **não** aparece em nenhum relatório.

> Banco existente: rode o `supabase/schema.sql` de novo para criar as funções `relatorio_*` e liberar o módulo **Relatórios** no perfil Administrador. Para outros perfis, marque **Relatórios → Ver** em **Perfis de acesso**.

### Pix automático
1. O administrador cadastra a chave em **Configurações → Pix da loja** (CPF, CNPJ, e-mail, telefone ou chave aleatória), com nome do recebedor, cidade e uma mensagem opcional (`{nome}`, `{pedido}`, `{valor}`).
2. Em **Testar código**, gere um código e cole no app do banco (Pix → Copia e Cola) para conferir nome e chave.
3. No pedido (ou no Atendimento, em conversas de pedido), **Enviar Pix** gera o “copia e cola” oficial (BR Code do Banco Central) com o valor do pedido e envia no chat. Dá para cobrar outro valor (ex.: sinal) ou colar um código manualmente.

O código é montado no banco (`enviar_pix_pedido`) com o valor lido do pedido, então não dá para alterar o valor pelo navegador. Só o administrador altera a chave.

---

## 9. Permissões (resumo)

| Módulo | Ações básicas | Extras |
|---|---|---|
| dashboard | ver | `ver_faturamento` |
| produtos, categorias | ver, criar, editar, excluir | — |
| pedidos | ver, editar, excluir | `alterar_status`, `enviar_pix` |
| chat | ver, criar (responder), excluir | — |
| estoque | ver | `movimentar` (entrada/baixa) |
| clientes | ver, editar | `ver_cpf` |
| usuarios, perfis | ver, criar, editar, excluir | — |

- `role = 'admin'` tem acesso total e não pode ser restringido nem desativado por funcionários.
- Um perfil com usuários vinculados não pode ser excluído; o perfil *Administrador* é do sistema e não pode ser alterado.
- Atenção: quem tem `perfis.editar` consegue alterar permissões (inclusive as próprias). Conceda só a gerentes de confiança.
- Faturamento = soma dos pedidos que já saíram de *Pendente* (pagamento combinado).

---

## 10. Checklist de testes manuais

### Visitante
- [ ] Home carrega banner, categorias, destaques e recentes (skeleton durante o carregamento).
- [ ] `/produtos`: busca por texto, filtro de categoria, faixa de preço, ordenação e paginação; estado vazio ao não achar nada.
- [ ] Card mostra foto, nome, preço, categoria e “Sem estoque” quando estoque = 0 (botão desabilitado).
- [ ] `/produto/:id`: galeria (miniaturas trocam a foto), descrição, especificações, estoque; quantidade não passa do estoque.
- [ ] “Adicionar ao carrinho” abre o drawer lateral; no celular ele ocupa a tela toda; alterar quantidade/remover/total funcionam.
- [ ] Recarregar a página mantém o carrinho (localStorage).
- [ ] “Favoritar” sem login leva ao login.
- [ ] “Finalizar compra” leva ao `/login`; após entrar volta para `/carrinho` com os itens mesclados ao carrinho da conta.
- [ ] URL inexistente mostra a página 404.

### Cadastro / login
- [ ] CPF inválido, e-mail inválido, senhas diferentes, telefone incompleto mostram mensagens claras.
- [ ] CEP válido preenche rua/bairro/cidade/UF (campos continuam editáveis); CEP inexistente mostra aviso.
- [ ] Username/CPF já usados são recusados antes do envio.
- [ ] E-mail de confirmação chega e o link leva ao login.
- [ ] Login com Google funciona; no checkout o sistema pede CPF, telefone e endereço antes da primeira compra.
- [ ] “Esqueci a senha” envia e-mail; `/redefinir-senha` troca a senha; link expirado mostra aviso.

### Cliente logado
- [ ] Carrinho persiste entre dispositivos (banco).
- [ ] Checkout: confirma endereço (pode alterar), revisa itens/total, cria pedido **Pendente** e abre o chat do pedido.
- [ ] Estoque do produto **não** muda ao finalizar o pedido.
- [ ] Chat: enviar texto e imagem (preview antes de enviar); rolagem automática; mensagens chegam em tempo real.
- [ ] Recebe o card Pix e o botão “Copiar código Pix” copia e mostra toast.
- [ ] Sino mostra contador ao receber mensagem ou mudança de status; clicar leva ao pedido.
- [ ] `/minha-conta/pedidos` mostra status, itens, valores, data e “novas mensagens”.
- [ ] Favoritos: adicionar/remover; Notificações: marcar como lida/todas/excluir.
- [ ] Editar perfil e endereço; alterar senha.
- [ ] Tentar abrir `/admin` redireciona para a home.

### Funcionário (perfil “Vendedor”)
- [ ] Menu mostra apenas: Dashboard, Pedidos, Atendimento, Produtos, Categorias, Clientes.
- [ ] Dashboard sem cartões de faturamento (sem `ver_faturamento`).
- [ ] Pedidos: busca, filtro por status e data; novo pedido aparece sem recarregar.
- [ ] Alterar status Pendente → Indo pra entrega → Pedido enviado: histórico registrado, cliente recebe notificação (e WhatsApp, se configurado).
- [ ] “Enviar Pix” envia o card ao cliente.
- [ ] Atendimento: lista com não lidas, filtro por pedido/geral, responder em tempo real, ver imagens.
- [ ] Finalizar com mensagem de encerramento → conversa vai para “Finalizadas” e o cliente vê o aviso; cliente responde → volta para “Abertas”.
- [ ] Assumir e transferir aparecem como aviso no chat e o nome do atendente aparece na lista.
- [ ] Digitar `/` mostra as respostas rápidas com `{nome}` trocado pelo nome do cliente.
- [ ] Contador de conversas novas aparece no item “Atendimento” do menu lateral.
- [ ] Clientes: CPF aparece mascarado.
- [ ] Produtos: pode ver, sem botões de criar/editar/excluir.
- [ ] Acessar `/admin/estoque` ou `/admin/usuarios` pela URL mostra “Acesso negado”.

### Funcionário (perfil “Estoquista”)
- [ ] Cria produto com várias fotos, define a principal, reordena e exclui fotos.
- [ ] Estoque: alerta visual quando quantidade ≤ mínimo; entrada e baixa pedem quantidade e motivo; baixa maior que o estoque é recusada; histórico mostra quem/quando/quanto/motivo.
- [ ] Não vê Pedidos nem Chat.

### Administrador
- [ ] Vê todos os módulos e o faturamento do dia/mês.
- [ ] Usuários internos: criar funcionário (consegue entrar com a senha), editar, trocar perfil, desativar (login bloqueado) e reativar.
- [ ] Perfis: criar/editar matriz de permissões e extras; não consegue excluir perfil com usuários; perfil *Administrador* é somente leitura.
- [ ] Categorias: CRUD completo; categoria inativa some da loja.
- [ ] Produto inativo some da loja e da busca.

### Segurança (pelo console do navegador, logado como cliente)
- [ ] `supabase.from('profiles').update({ role: 'admin' }).eq('id', '<meu id>')` → erro de permissão.
- [ ] `supabase.from('pedidos').select('*')` → retorna apenas os próprios pedidos.
- [ ] `supabase.from('produtos').update({ preco: 1 }).eq('id', '<id>')` → nenhum registro alterado.
- [ ] `supabase.from('mensagens').insert({ ..., tipo: 'pix' })` → recusado.

### Fluxo completo
Visitante adiciona ao carrinho → faz login → carrinho mesclado → checkout → pedido Pendente → chat → equipe envia Pix → cliente copia o código e envia o comprovante (imagem) → equipe muda o status → cliente recebe notificação no sino (e WhatsApp).
