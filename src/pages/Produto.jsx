import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, PackageX, ShoppingBag, ShoppingCart } from 'lucide-react';
import ProductImage from '../components/ProductImage';
import QuantitySelector from '../components/QuantitySelector';
import FavoriteButton from '../components/FavoriteButton';
import EmptyState from '../components/EmptyState';
import Skeleton from '../components/Skeleton';
import { buscarProduto, ordenarImagens } from '../services/produtos';
import { useCart } from '../hooks/useCart';
import { formatarMoeda } from '../utils/format';
import { traduzirErro } from '../utils/errors';

export default function Produto() {
  const { id } = useParams();
  const { adicionar, itens, abrirDrawer, quantidadeTotal } = useCart();
  const [produto, setProduto] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [imagemAtiva, setImagemAtiva] = useState(0);
  const [quantidade, setQuantidade] = useState(1);
  const [adicionando, setAdicionando] = useState(false);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro('');
    setImagemAtiva(0);
    setQuantidade(1);
    buscarProduto(id)
      .then((p) => ativo && setProduto(p))
      .catch((e) => ativo && setErro(traduzirErro(e)))
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, [id]);

  const imagens = useMemo(() => ordenarImagens(produto?.imagens), [produto]);
  const noCarrinho = itens.find((i) => i.produto_id === id)?.quantidade || 0;
  const disponivel = produto ? Math.max(0, produto.estoque - noCarrinho) : 0;

  if (carregando) {
    return (
      <div className="container produto">
        <div className="produto__grid">
          <Skeleton altura="0" className="produto__galeria-skeleton" raio="var(--radius-lg)" />
          <div className="stack">
            <Skeleton largura="30%" />
            <Skeleton largura="80%" altura="2rem" />
            <Skeleton largura="40%" altura="2rem" />
            <Skeleton altura="6rem" />
          </div>
        </div>
      </div>
    );
  }

  if (erro || !produto || !produto.ativo) {
    return (
      <div className="container">
        <EmptyState
          icone={PackageX}
          titulo="Produto não encontrado"
          descricao={erro || 'Este produto não existe ou não está mais disponível.'}
        >
          <Link to="/produtos" className="btn btn--primary">
            Ver outros produtos
          </Link>
        </EmptyState>
      </div>
    );
  }

  const semEstoque = produto.estoque <= 0;
  const especificacoes = Array.isArray(produto.especificacoes) ? produto.especificacoes : [];

  const handleAdicionar = async () => {
    setAdicionando(true);
    await adicionar(produto, quantidade);
    setAdicionando(false);
    setQuantidade(1);
  };

  return (
    <div className="container produto">
      <nav className="breadcrumb" aria-label="Navegação">
        <Link to="/produtos">
          <ChevronLeft size={16} aria-hidden="true" /> Produtos
        </Link>
        {produto.categoria && (
          <>
            <span aria-hidden="true">/</span>
            <Link to={`/produtos?categoria=${produto.categoria.slug}`}>{produto.categoria.nome}</Link>
          </>
        )}
      </nav>

      <div className="produto__grid">
        <div className="galeria">
          <div className="galeria__principal">
            <ProductImage src={imagens[imagemAtiva]?.url} alt={produto.nome} loading="eager" />
          </div>
          {imagens.length > 1 && (
            <div className="galeria__miniaturas" role="list">
              {imagens.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  role="listitem"
                  className={`galeria__mini ${i === imagemAtiva ? 'is-ativa' : ''}`}
                  onClick={() => setImagemAtiva(i)}
                  aria-label={`Ver foto ${i + 1}`}
                  aria-current={i === imagemAtiva}
                >
                  <img src={img.url} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="produto__info">
          {produto.categoria && <span className="product-card__categoria">{produto.categoria.nome}</span>}
          <h1>{produto.nome}</h1>
          <strong className="produto__preco">{formatarMoeda(produto.preco)}</strong>

          <p className={`produto__estoque ${semEstoque ? 'texto-erro' : produto.estoque <= 3 ? 'texto-aviso' : 'texto-sucesso'}`}>
            {semEstoque
              ? 'Sem estoque no momento'
              : produto.estoque <= 3
                ? `Últimas ${produto.estoque} unidades!`
                : `${produto.estoque} unidades em estoque`}
          </p>

          {!semEstoque && (
            <div className="produto__compra">
              <QuantitySelector valor={quantidade} max={Math.max(1, disponivel)} aoMudar={setQuantidade} desabilitado={disponivel <= 0} />
              <button
                type="button"
                className="btn btn--primary btn--lg"
                onClick={handleAdicionar}
                disabled={adicionando || disponivel <= 0}
              >
                <ShoppingCart size={18} aria-hidden="true" />
                {disponivel <= 0 ? 'Máximo no carrinho' : 'Adicionar ao carrinho'}
              </button>
            </div>
          )}
          {noCarrinho > 0 && (
            <p className="texto-suave">
              Você tem {noCarrinho} {noCarrinho === 1 ? 'unidade' : 'unidades'} deste produto no carrinho.
            </p>
          )}

          <div className="produto__acoes-sec">
            <FavoriteButton produtoId={produto.id} />
            <button type="button" className="btn btn--ghost" onClick={abrirDrawer}>
              <ShoppingBag size={18} aria-hidden="true" /> Ver carrinho ({quantidadeTotal})
            </button>
          </div>

          {produto.descricao && (
            <section className="produto__secao">
              <h2>Descrição</h2>
              <p className="produto__descricao">{produto.descricao}</p>
            </section>
          )}

          {especificacoes.length > 0 && (
            <section className="produto__secao">
              <h2>Especificações</h2>
              <dl className="specs">
                {especificacoes.map((s, i) => (
                  <div key={i} className="specs__linha">
                    <dt>{s.nome}</dt>
                    <dd>{s.valor}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
