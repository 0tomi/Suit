import { Component } from 'react';
import { createLogger } from '../services/logService.js';

const logger = createLogger('error-boundary');

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        void logger.error('ErrorBoundary caught', {
            error: error instanceof Error ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
            } : error,
            componentStack: errorInfo?.componentStack || null,
        });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-50 p-8">
                    <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center border border-gray-200">
                        <div className="text-6xl mb-4">⚠️</div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2">
                            Algo salió mal
                        </h2>
                        <p className="text-gray-500 mb-6 text-sm">
                            Ocurrió un error inesperado. Intenta recargar la aplicación.
                        </p>
                        <pre className="text-xs text-red-500 bg-red-50 p-3 rounded-lg mb-6 text-left overflow-auto max-h-32 border border-red-100">
                            {this.state.error?.message || 'Error desconocido'}
                        </pre>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium shadow-sm transition-colors"
                        >
                            Recargar Aplicación
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
