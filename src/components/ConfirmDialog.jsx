import Modal from './Modal';
import Spinner from './Spinner';

export default function ConfirmDialog({
  aberto,
  titulo = 'Confirmar ação',
  mensagem,
  textoConfirmar = 'Confirmar',
  perigo = false,
  carregando = false,
  aoConfirmar,
  aoCancelar,
}) {
  return (
    <Modal
      aberto={aberto}
      aoFechar={carregando ? undefined : aoCancelar}
      titulo={titulo}
      tamanho="sm"
      rodape={
        <>
          <button type="button" className="btn btn--ghost" onClick={aoCancelar} disabled={carregando}>
            Cancelar
          </button>
          <button
            type="button"
            className={`btn ${perigo ? 'btn--danger' : 'btn--primary'}`}
            onClick={aoConfirmar}
            disabled={carregando}
          >
            {carregando && <Spinner tamanho="sm" />}
            {textoConfirmar}
          </button>
        </>
      }
    >
      <p>{mensagem}</p>
    </Modal>
  );
}
