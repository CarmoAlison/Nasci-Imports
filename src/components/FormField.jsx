import { useId } from 'react';

/**
 * Campo de formulário acessível: label + input/select/textarea + mensagem de erro.
 * Use `as="select"` ou `as="textarea"` quando necessário.
 */
export default function FormField({
  label,
  erro,
  ajuda,
  as: Componente = 'input',
  id,
  className = '',
  children,
  obrigatorio = false,
  ...props
}) {
  const gerado = useId();
  const campoId = id || gerado;
  const erroId = `${campoId}-erro`;
  const ajudaId = `${campoId}-ajuda`;

  return (
    <div className={`field ${erro ? 'field--erro' : ''} ${className}`}>
      {label && (
        <label htmlFor={campoId} className="field__label">
          {label}
          {obrigatorio && (
            <span className="field__obrigatorio" aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </label>
      )}
      <Componente
        id={campoId}
        className="input"
        aria-invalid={Boolean(erro)}
        aria-required={obrigatorio || undefined}
        aria-describedby={[erro && erroId, ajuda && ajudaId].filter(Boolean).join(' ') || undefined}
        {...props}
      >
        {children}
      </Componente>
      {ajuda && !erro && (
        <small id={ajudaId} className="field__ajuda">
          {ajuda}
        </small>
      )}
      {erro && (
        <small id={erroId} className="field__erro" role="alert">
          {erro}
        </small>
      )}
    </div>
  );
}
