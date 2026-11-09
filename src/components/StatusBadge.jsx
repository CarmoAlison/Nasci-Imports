import { STATUS_PEDIDO } from '../utils/constants';

export default function StatusBadge({ status }) {
  const info = STATUS_PEDIDO[status] || { label: status, classe: '' };
  return <span className={`badge ${info.classe}`}>{info.label}</span>;
}
