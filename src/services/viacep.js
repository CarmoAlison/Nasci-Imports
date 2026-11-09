// Consulta de CEP na API pública ViaCEP
import { apenasDigitos } from '../utils/masks';

export async function buscarCep(cep) {
  const d = apenasDigitos(cep);
  if (d.length !== 8) throw new Error('CEP deve ter 8 dígitos.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch(`https://viacep.com.br/ws/${d}/json/`, { signal: controller.signal });
    if (!resp.ok) throw new Error('Não foi possível consultar o CEP.');
    const data = await resp.json();
    if (data.erro) throw new Error('CEP não encontrado. Preencha o endereço manualmente.');
    return {
      rua: data.logradouro || '',
      bairro: data.bairro || '',
      cidade: data.localidade || '',
      uf: data.uf || '',
      complemento: data.complemento || '',
    };
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('A consulta do CEP demorou demais. Tente novamente.');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
