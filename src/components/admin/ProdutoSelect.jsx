import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

/**
 * Seleção de produto com busca (combobox acessível).
 *  produtos: [{ id, nome, estoque, estoque_minimo, ativo, categoria }]
 *  desabilitarSemEstoque: impede escolher produto com estoque 0 (usado na saída)
 */
export default function ProdutoSelect({ produtos, valor, aoMudar, erro, desabilitarSemEstoque = false, carregando = false }) {
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState('');
  const [ativo, setAtivo] = useState(0);
  const ref = useRef(null);
  const inputRef = useRef(null);
  const listaRef = useRef(null);

  const selecionado = produtos.find((p) => p.id === valor) || null;

  const filtrados = useMemo(() => {
    const t = termo.trim().toLowerCase();
    return t ? produtos.filter((p) => p.nome.toLowerCase().includes(t)) : produtos;
  }, [produtos, termo]);

  const indisponivel = (p) => desabilitarSemEstoque && p.estoque <= 0;

  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => ref.current && !ref.current.contains(e.target) && setAberto(false);
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);

  // mantém o item destacado visível ao navegar pelo teclado
  useEffect(() => {
    listaRef.current?.querySelector(`[data-indice="${ativo}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [ativo]);

  const escolher = (p) => {
    if (indisponivel(p)) return;
    aoMudar(p.id);
    setTermo('');
    setAberto(false);
  };

  const aoTeclar = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAberto(true);
      setAtivo((i) => Math.min(i + 1, filtrados.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAtivo((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && aberto) {
      e.preventDefault();
      if (filtrados[ativo]) escolher(filtrados[ativo]);
    } else if (e.key === 'Escape') {
      setAberto(false);
    }
  };

  return (
    <div className={`field produto-select ${erro ? 'field--erro' : ''}`} ref={ref}>
      <label htmlFor={id} className="field__label">
        Produto <span className="field__obrigatorio" aria-hidden="true">*</span>
      </label>

      {selecionado && !aberto ? (
        <button
          type="button"
          className="input produto-select__escolhido"
          onClick={() => {
            setAberto(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          aria-label={`Produto selecionado: ${selecionado.nome}. Clique para trocar`}
        >
          <span className="produto-select__nome">{selecionado.nome}</span>
          <span className="texto-suave texto-pequeno">Estoque: {selecionado.estoque}</span>
          <ChevronDown size={18} aria-hidden="true" />
        </button>
      ) : (
        <div className="input-icone">
          <Search size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            id={id}
            className="input"
            role="combobox"
            aria-expanded={aberto}
            aria-controls={`${id}-lista`}
            aria-autocomplete="list"
            aria-invalid={Boolean(erro)}
            autoComplete="off"
            placeholder={carregando ? 'Carregando produtos...' : 'Digite o nome do produto...'}
            value={termo}
            disabled={carregando}
            onFocus={() => setAberto(true)}
            onChange={(e) => {
              setTermo(e.target.value);
              setAtivo(0);
              setAberto(true);
            }}
            onKeyDown={aoTeclar}
          />
          {selecionado && (
            <button
              type="button"
              className="produto-select__limpar"
              onClick={() => setAberto(false)}
              aria-label="Manter produto selecionado"
            >
              <X size={16} />
            </button>
          )}
        </div>
      )}

      {aberto && (
        <ul className="produto-select__lista" id={`${id}-lista`} role="listbox" ref={listaRef}>
          {filtrados.length === 0 ? (
            <li className="produto-select__vazio">Nenhum produto encontrado.</li>
          ) : (
            filtrados.map((p, i) => {
              const baixo = p.estoque <= p.estoque_minimo;
              return (
                <li
                  key={p.id}
                  role="option"
                  data-indice={i}
                  aria-selected={p.id === valor}
                  aria-disabled={indisponivel(p)}
                  className={`produto-select__opcao ${i === ativo ? 'is-ativa' : ''} ${indisponivel(p) ? 'is-desabilitada' : ''}`}
                  onMouseEnter={() => setAtivo(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    escolher(p);
                  }}
                >
                  <span className="produto-select__nome">
                    {p.nome}
                    <small className="texto-suave">
                      {p.categoria?.nome || 'Sem categoria'}
                      {!p.ativo && ' · inativo'}
                    </small>
                  </span>
                  <span className={`badge ${p.estoque === 0 ? 'badge--danger' : baixo ? 'badge--warning' : 'badge--muted'}`}>
                    {p.estoque} un.
                  </span>
                </li>
              );
            })
          )}
        </ul>
      )}

      {erro && (
        <small className="field__erro" role="alert">
          {erro}
        </small>
      )}
    </div>
  );
}
