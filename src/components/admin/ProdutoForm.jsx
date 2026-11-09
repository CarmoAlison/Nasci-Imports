import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import FormField from '../FormField';
import Spinner from '../Spinner';
import ImagensProduto from './ImagensProduto';
import { usePermission } from '../../hooks/usePermission';
import { adminBuscarProduto, atualizarProduto, criarProduto } from '../../services/produtos';
import { parseValor } from '../../utils/masks';
import { traduzirErro } from '../../utils/errors';

const VAZIO = {
  nome: '',
  descricao: '',
  preco: '',
  categoria_id: '',
  estoque: '0',
  estoque_minimo: '0',
  ativo: true,
  destaque: false,
  especificacoes: [],
};

/**
 * Cadastro/edição de produto. Depois de criar, o formulário passa para o modo
 * edição e libera o envio de fotos.
 */
export default function ProdutoForm({ produtoId: idInicial, categorias, aoSalvar, aoFechar }) {
  const { pode } = usePermission();
  const [produtoId, setProdutoId] = useState(idInicial);
  const [form, setForm] = useState(VAZIO);
  const [imagens, setImagens] = useState([]);
  const [estoqueAtual, setEstoqueAtual] = useState(0);
  const [erros, setErros] = useState({});
  const [carregando, setCarregando] = useState(Boolean(idInicial));
  const [salvando, setSalvando] = useState(false);
  const modoEdicao = Boolean(produtoId);
  const podeSalvar = modoEdicao ? pode('produtos', 'editar') : pode('produtos', 'criar');

  useEffect(() => {
    if (!idInicial) return undefined;
    let ativo = true;
    adminBuscarProduto(idInicial)
      .then((p) => {
        if (!ativo) return;
        setForm({
          nome: p.nome,
          descricao: p.descricao || '',
          preco: String(p.preco).replace('.', ','),
          categoria_id: p.categoria_id || '',
          estoque: String(p.estoque),
          estoque_minimo: String(p.estoque_minimo),
          ativo: p.ativo,
          destaque: p.destaque,
          especificacoes: Array.isArray(p.especificacoes) ? p.especificacoes : [],
        });
        setEstoqueAtual(p.estoque);
        setImagens(p.imagens || []);
      })
      .catch((e) => {
        toast.error(traduzirErro(e));
        aoFechar();
      })
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idInicial]);

  const mudar = (campo, valor) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErros((e) => ({ ...e, [campo]: '' }));
  };

  const mudarSpec = (i, campo, valor) =>
    setForm((f) => ({ ...f, especificacoes: f.especificacoes.map((s, idx) => (idx === i ? { ...s, [campo]: valor } : s)) }));

  const salvar = async (e) => {
    e.preventDefault();
    const preco = parseValor(form.preco);
    const estoque = parseInt(form.estoque, 10);
    const minimo = parseInt(form.estoque_minimo, 10);
    const novos = {};
    if (!form.nome.trim()) novos.nome = 'Informe o nome.';
    if (Number.isNaN(preco) || preco < 0) novos.preco = 'Preço inválido.';
    if (!modoEdicao && (Number.isNaN(estoque) || estoque < 0)) novos.estoque = 'Estoque inválido.';
    if (Number.isNaN(minimo) || minimo < 0) novos.estoque_minimo = 'Valor inválido.';
    setErros(novos);
    if (Object.keys(novos).length) return;

    const dados = {
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      preco: Math.round(preco * 100) / 100,
      categoria_id: form.categoria_id || null,
      estoque_minimo: minimo,
      ativo: form.ativo,
      destaque: form.destaque,
      especificacoes: form.especificacoes
        .map((s) => ({ nome: s.nome.trim(), valor: s.valor.trim() }))
        .filter((s) => s.nome && s.valor),
    };

    setSalvando(true);
    try {
      if (modoEdicao) {
        await atualizarProduto(produtoId, dados);
        toast.success('Produto atualizado!');
        aoFechar();
      } else {
        const criado = await criarProduto({ ...dados, estoque });
        setProdutoId(criado.id);
        setEstoqueAtual(estoque);
        toast.success('Produto criado! Agora envie as fotos.');
        aoSalvar();
      }
    } catch (err) {
      toast.error(traduzirErro(err));
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <div className="centralizado">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="stack">
      <form onSubmit={salvar} noValidate className="stack">
        <div className="form-grid">
          <FormField
            label="Nome"
            obrigatorio
            value={form.nome}
            onChange={(e) => mudar('nome', e.target.value)}
            erro={erros.nome}
            className="col-8"
          />
          <FormField
            label="Preço (R$)"
            obrigatorio
            inputMode="decimal"
            placeholder="0,00"
            value={form.preco}
            onChange={(e) => mudar('preco', e.target.value.replace(/[^\d,.]/g, ''))}
            erro={erros.preco}
            className="col-4"
          />
          <FormField
            as="select"
            label="Categoria"
            value={form.categoria_id}
            onChange={(e) => mudar('categoria_id', e.target.value)}
            className="col-6"
          >
            <option value="">Sem categoria</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </FormField>
          {modoEdicao ? (
            <div className="field col-3">
              <span className="field__label">Estoque atual</span>
              <strong className="estoque-leitura">{estoqueAtual}</strong>
              <small className="field__ajuda">Altere pela página Estoque.</small>
            </div>
          ) : (
            <FormField
              label="Estoque inicial"
              type="number"
              min="0"
              value={form.estoque}
              onChange={(e) => mudar('estoque', e.target.value)}
              erro={erros.estoque}
              className="col-3"
            />
          )}
          <FormField
            label="Estoque mínimo"
            type="number"
            min="0"
            value={form.estoque_minimo}
            onChange={(e) => mudar('estoque_minimo', e.target.value)}
            erro={erros.estoque_minimo}
            ajuda="Alerta quando chegar nesse valor."
            className="col-3"
          />
          <FormField
            as="textarea"
            label="Descrição"
            rows={4}
            value={form.descricao}
            onChange={(e) => mudar('descricao', e.target.value)}
            className="col-12"
          />
        </div>

        <fieldset className="fieldset">
          <legend>Especificações</legend>
          <div className="stack">
            {form.especificacoes.length === 0 && (
              <p className="texto-suave texto-pequeno">Ex.: Armazenamento → 128 GB; Cor → Preto.</p>
            )}
            {form.especificacoes.map((s, i) => (
              <div key={i} className="spec-linha">
                <label className="sr-only" htmlFor={`spec-nome-${i}`}>
                  Nome da especificação
                </label>
                <input
                  id={`spec-nome-${i}`}
                  className="input"
                  placeholder="Nome (ex.: Memória)"
                  value={s.nome}
                  onChange={(e) => mudarSpec(i, 'nome', e.target.value)}
                />
                <label className="sr-only" htmlFor={`spec-valor-${i}`}>
                  Valor da especificação
                </label>
                <input
                  id={`spec-valor-${i}`}
                  className="input"
                  placeholder="Valor (ex.: 8 GB)"
                  value={s.valor}
                  onChange={(e) => mudarSpec(i, 'valor', e.target.value)}
                />
                <button
                  type="button"
                  className="icon-btn icon-btn--danger"
                  onClick={() => setForm((f) => ({ ...f, especificacoes: f.especificacoes.filter((_, idx) => idx !== i) }))}
                  aria-label="Remover especificação"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <div>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setForm((f) => ({ ...f, especificacoes: [...f.especificacoes, { nome: '', valor: '' }] }))}
              >
                <Plus size={16} aria-hidden="true" /> Adicionar especificação
              </button>
            </div>
          </div>
        </fieldset>

        <div className="linha-checks">
          <label className="checkbox">
            <input type="checkbox" checked={form.ativo} onChange={(e) => mudar('ativo', e.target.checked)} />
            Ativo (visível na loja)
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={form.destaque} onChange={(e) => mudar('destaque', e.target.checked)} />
            Destaque na home
          </label>
        </div>

        {podeSalvar && (
          <div className="modal__acoes">
            <button type="button" className="btn btn--ghost" onClick={aoFechar} disabled={salvando}>
              {modoEdicao ? 'Cancelar' : 'Fechar'}
            </button>
            <button type="submit" className="btn btn--primary" disabled={salvando}>
              {salvando && <Spinner tamanho="sm" />}
              {modoEdicao ? 'Salvar alterações' : 'Criar produto'}
            </button>
          </div>
        )}
      </form>

      {produtoId ? (
        <ImagensProduto
          key={produtoId}
          produtoId={produtoId}
          imagensIniciais={imagens}
          podeEditar={pode('produtos', 'editar') || pode('produtos', 'criar')}
        />
      ) : (
        <p className="alerta alerta--info">Salve o produto para enviar as fotos.</p>
      )}
    </div>
  );
}
