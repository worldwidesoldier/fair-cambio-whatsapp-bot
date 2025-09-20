import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🔥 Error Boundary caught an error:', error);
    console.error('🔥 Error Info:', errorInfo);

    this.setState({
      error,
      errorInfo
    });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-50 p-8 flex items-center justify-center">
          <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-6">
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold text-red-600 mb-2">🚨 Erro no Dashboard</h1>
              <p className="text-gray-600">
                Algo deu errado ao carregar o dashboard. Detalhes do erro:
              </p>
            </div>

            <div className="bg-gray-100 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-gray-800 mb-2">Erro:</h3>
              <pre className="text-sm text-red-600 whitespace-pre-wrap">
                {this.state.error && this.state.error.toString()}
              </pre>
            </div>

            {this.state.errorInfo && (
              <div className="bg-gray-100 rounded-lg p-4 mb-4">
                <h3 className="font-semibold text-gray-800 mb-2">Stack Trace:</h3>
                <pre className="text-xs text-gray-600 whitespace-pre-wrap overflow-auto max-h-40">
                  {this.state.errorInfo.componentStack}
                </pre>
              </div>
            )}

            <div className="flex gap-4 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                🔄 Recarregar Página
              </button>
              <button
                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                🔁 Tentar Novamente
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;