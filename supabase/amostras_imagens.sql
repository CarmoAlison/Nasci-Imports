-- =====================================================================
--  NASCI IMPORTS — Fotos de AMOSTRA dos produtos de exemplo
--
--  Fotos reais do Pexels (licença gratuita, uso comercial permitido),
--  salvas em public/amostras/ — créditos em public/amostras/CREDITOS.txt.
--
--  1) Remove as amostras antigas (/amostras/...), inclusive as ilustrações
--     da versão anterior. Fotos que você enviou pelo painel NÃO são tocadas.
--  2) Adiciona as fotos nos produtos de exemplo que estiverem sem foto.
--  Pode ser executado mais de uma vez.
--
--  Como usar: Supabase → SQL Editor → cole este arquivo → Run.
--
--  Para remover depois (quando cadastrar as fotos reais da loja):
--    delete from public.produto_imagens where url like '/amostras/%';
-- =====================================================================

delete from public.produto_imagens where url like '/amostras/%';

insert into public.produto_imagens (produto_id, url, ordem, principal)
select p.id, v.url, v.ordem, v.ordem = 0
from (values
  ('iPhone 15 128GB',                     '/amostras/iphone-15.jpg',          0),
  ('Samsung Galaxy S24 256GB',            '/amostras/galaxy-s24-verso.jpg',   0),
  ('Samsung Galaxy S24 256GB',            '/amostras/galaxy-s24-mao.jpg',     1),
  ('Xiaomi Redmi Note 13 128GB',          '/amostras/redmi-note-13.jpg',      0),
  ('Capa MagSafe Transparente iPhone 15', '/amostras/capa-transparente.jpg',  0),
  ('Capa Silicone Galaxy S24',            '/amostras/capa-silicone.jpg',      0),
  ('Carregador Turbo USB-C 20W',          '/amostras/carregador-20w.jpg',     0),
  ('Cabo USB-C para Lightning 1m',        '/amostras/cabo-lightning.jpg',     0),
  ('Fone Bluetooth TWS Pro',              '/amostras/fone-tws.jpg',           0),
  ('Película de Vidro 3D iPhone 15',      '/amostras/pelicula-vidro.jpg',     0)
) as v(nome, url, ordem)
join public.produtos p on p.nome = v.nome
where not exists (
  select 1 from public.produto_imagens pi where pi.produto_id = p.id
);

-- Pedidos já feitos guardam a foto do momento da compra; atualiza os que apontavam para as ilustrações
update public.pedido_itens pi
set produto_imagem = (
  select img.url from public.produto_imagens img
  where img.produto_id = pi.produto_id
  order by img.principal desc, img.ordem asc
  limit 1
)
where pi.produto_imagem like '/amostras/%.svg';

-- Conferência: quantas fotos cada produto tem agora
select p.nome, count(pi.id) as fotos
from public.produtos p
left join public.produto_imagens pi on pi.produto_id = p.id
group by p.nome
order by p.nome;
