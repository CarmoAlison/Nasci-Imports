import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../Modal';
import FormField from '../FormField';
import Spinner from '../Spinner';
import { excluirRespostaRapida, salvarRespostaRapida } from '../../services/mensagens';
import { traduzirErro } from '../../utils/errors';

const VAZIO = { titulo: '', texto: '' };

/** Cadastro das respostas rápidas compartilhadas pela equipe */
export default function RespostasRapidasModal({ aberto, aoFechar, respostas, aoAlterar }) {
  const [editando, setEditando] = useState(null); // null | 'nova' | resposta
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(null);

  const abrir = (r) => {
    setEditando(r || 'nova');
    setForm(r ? { titulo: r.titulo, texto: r.texto } : VAZIO);
  };

  const salvar = async (e) => {
    e.preventDefault();
    if (!form.titulo.trim() || !form.texto.trim()) {
      toast.error('Preencha o título e o texto.');
      return;
    }
    setSalvando(true);
    try {
      await salvarRespostaRapida(editando === 'nova' ? null : editando.id, {
        titulo: form.titulo.trim(),
        texto: form.texto.trim(),
        ...(editando === 'nova' ? { ordem: respostas.length + 1 } : {}),
      });
      toast.success('Resposta salva!');
      setEditando(null);
      aoAlterar();
    } catch (err) {
      toast.error(traduzirErro(err));
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (r) => {
    if (!window.confirm(`Excluir a resposta "${r.titulo}"?`)) return;
    setExcluindo(r.id);
    try {
      await excluirRespostaRapida(r.id);
      toast.success('Resposta excluída.');
      aoAlterar();
    } catch (err) {
      toast.error(traduzirErro(err));
    } finally {
      setExcluindo(null);
    }
  };

  return (
    <Modal
      aberto={aberto}
      aoFechar={() => {
        setEditando(null);
        aoFechar();
      }}
      titulo="Respostas rápidas"
      tamanho="md"
    >
      {editando ? (
        <form onSubmit={salvar} className="stack" noValidate>
          <FormField
            label="Título"
            obrigatorio
            maxLength={60}
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            placeholder="Ex.: Saudação"
          />
          <FormField
            as="textarea"
            label="Texto"
            obrigatorio
            rows={4}
            maxLength={2000}
            value={form.texto}
            onChange={(e) => setForm({ ...form, texto: e.target.value })}
            ajuda="Use {nome} para inserir o primeiro nome do cliente."
          />
          <div className="modal__acoes">
            <button type="button" className="btn btn--ghost" onClick={() => setEditando(null)} disabled={salvando}>
              Voltar
            </button>
            <button type="submit" className="btn btn--primary" disabled={salvando}>
              {salvando && <Spinner tamanho="sm" />}
              Salvar
            </button>
          </div>
        </form>
      ) : (
        <div className="stack">
          <p className="texto-suave texto-pequeno">
            No chat, clique no raio ou digite <code>/</code> para usar uma resposta. <code>{'{nome}'}</code> vira o
            primeiro nome do cliente.
          </p>
          {respostas.length === 0 ? (
            <p className="texto-suave">Nenhuma resposta cadastrada.</p>
          ) : (
            <ul className="lista-simples">
              {respostas.map((r) => (
                <li key={r.id}>
                  <span className="rapidas-lista__texto">
                    <strong>{r.titulo}</strong>
                    <small className="texto-suave texto-truncado">{r.texto}</small>
                  </span>
                  <span>
                    <button type="button" className="icon-btn" onClick={() => abrir(r)} aria-label={`Editar ${r.titulo}`}>
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn icon-btn--danger"
                      onClick={() => excluir(r)}
                      disabled={excluindo === r.id}
                      aria-label={`Excluir ${r.titulo}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div>
            <button type="button" className="btn btn--outline btn--sm" onClick={() => abrir(null)}>
              <Plus size={16} aria-hidden="true" /> Nova resposta
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
