import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { erro: null };
  }

  static getDerivedStateFromError(erro) {
    return { erro };
  }

  componentDidCatch(erro, info) {
    console.error('Erro na interface', erro, info);
  }

  render() {
    if (this.state.erro) {
      return (
        <div className="error-page">
          <h1>Algo deu errado</h1>
          <p>Ocorreu um erro inesperado ao exibir esta página.</p>
          <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
            Recarregar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
