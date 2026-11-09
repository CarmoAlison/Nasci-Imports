import { formatarDataHora } from '../../utils/format';

/** Histórico de movimentações de estoque (entradas e saídas) */
export default function TabelaMovimentacoes({ itens, mostrarProduto = false, vazio = 'Nenhuma movimentação registrada.' }) {
  if (!itens.length) return <p className="texto-suave">{vazio}</p>;
  return (
    <div className="tabela-wrapper">
      <table className="tabela tabela--compacta">
        <thead>
          <tr>
            <th>Data</th>
            {mostrarProduto && <th>Produto</th>}
            <th>Tipo</th>
            <th>Qtd.</th>
            <th>Saldo</th>
            <th>Motivo</th>
            <th>Usuário</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((m) => (
            <tr key={m.id}>
              <td data-label="Data">{formatarDataHora(m.created_at)}</td>
              {mostrarProduto && <td data-label="Produto">{m.produto?.nome}</td>}
              <td data-label="Tipo">
                <span className={`badge ${m.tipo === 'entrada' ? 'badge--success' : 'badge--warning'}`}>
                  {m.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                </span>
              </td>
              <td data-label="Qtd." className={m.tipo === 'entrada' ? 'texto-sucesso' : 'texto-aviso'}>
                {m.tipo === 'entrada' ? '+' : '−'}
                {m.quantidade}
              </td>
              <td data-label="Saldo">
                {m.estoque_anterior} → {m.estoque_novo}
              </td>
              <td data-label="Motivo">{m.motivo}</td>
              <td data-label="Usuário">{m.usuario_nome || 'Sistema'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
