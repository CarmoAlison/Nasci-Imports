import { useState } from 'react';
import FormField from './FormField';
import { buscarCep } from '../services/viacep';
import { mascaraCEP, apenasDigitos } from '../utils/masks';
import { UFS } from '../utils/constants';

/**
 * Campos de endereço com preenchimento automático via ViaCEP.
 * valores: { cep, rua, numero, complemento, bairro, cidade, uf }
 * aoMudar(campo, valor) | aoMudarVarios(objeto)
 */
export default function AddressFields({ valores, erros = {}, aoMudar, aoMudarVarios, desabilitado = false }) {
  const [buscando, setBuscando] = useState(false);
  const [erroCep, setErroCep] = useState('');

  const consultar = async (cep) => {
    setErroCep('');
    setBuscando(true);
    try {
      const end = await buscarCep(cep);
      aoMudarVarios({
        rua: end.rua || valores.rua,
        bairro: end.bairro || valores.bairro,
        cidade: end.cidade,
        uf: end.uf,
        complemento: valores.complemento || end.complemento,
      });
    } catch (e) {
      setErroCep(e.message);
    } finally {
      setBuscando(false);
    }
  };

  const mudarCep = (e) => {
    const v = mascaraCEP(e.target.value);
    aoMudar('cep', v);
    if (apenasDigitos(v).length === 8) consultar(v);
    else setErroCep('');
  };

  return (
    <div className="form-grid">
      <FormField
        label="CEP"
        obrigatorio
        value={valores.cep || ''}
        onChange={mudarCep}
        inputMode="numeric"
        autoComplete="postal-code"
        placeholder="00000-000"
        erro={erros.cep || erroCep}
        ajuda={buscando ? 'Buscando endereço...' : 'Digite o CEP para preencher automaticamente.'}
        disabled={desabilitado}
        className="col-4"
      />
      <FormField
        label="Rua"
        obrigatorio
        value={valores.rua || ''}
        onChange={(e) => aoMudar('rua', e.target.value)}
        autoComplete="address-line1"
        erro={erros.rua}
        disabled={desabilitado}
        className="col-8"
      />
      <FormField
        label="Número"
        obrigatorio
        value={valores.numero || ''}
        onChange={(e) => aoMudar('numero', e.target.value)}
        erro={erros.numero}
        disabled={desabilitado}
        className="col-4"
      />
      <FormField
        label="Complemento"
        value={valores.complemento || ''}
        onChange={(e) => aoMudar('complemento', e.target.value)}
        autoComplete="address-line2"
        placeholder="Apto, bloco..."
        disabled={desabilitado}
        className="col-8"
      />
      <FormField
        label="Bairro"
        obrigatorio
        value={valores.bairro || ''}
        onChange={(e) => aoMudar('bairro', e.target.value)}
        erro={erros.bairro}
        disabled={desabilitado}
        className="col-5"
      />
      <FormField
        label="Cidade"
        obrigatorio
        value={valores.cidade || ''}
        onChange={(e) => aoMudar('cidade', e.target.value)}
        autoComplete="address-level2"
        erro={erros.cidade}
        disabled={desabilitado}
        className="col-5"
      />
      <FormField
        as="select"
        label="UF"
        obrigatorio
        value={valores.uf || ''}
        onChange={(e) => aoMudar('uf', e.target.value)}
        erro={erros.uf}
        disabled={desabilitado}
        className="col-2"
      >
        <option value="">--</option>
        {UFS.map((uf) => (
          <option key={uf} value={uf}>
            {uf}
          </option>
        ))}
      </FormField>
    </div>
  );
}
