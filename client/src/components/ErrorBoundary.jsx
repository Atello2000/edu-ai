import { Component } from 'react';

/**
 * ErrorBoundary — isole les crashes de composants React.
 * Encapsuler chaque panneau critique avec <ErrorBoundary> pour éviter
 * qu'une erreur dans un panneau ne fasse crasher toute l'application.
 *
 * Usage :
 *   <ErrorBoundary>
 *     <MonComposant />
 *   </ErrorBoundary>
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-box">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            style={{ color: 'var(--red, #e53935)', marginBottom: '.5rem' }}>
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="3"/>
          </svg>
          <p>Une erreur inattendue s&apos;est produite dans ce panneau.</p>
          {import.meta.env.DEV && this.state.error && (
            <pre className="error-boundary-detail">{this.state.error.message}</pre>
          )}
          <button
            className="ghost-btn"
            style={{ marginTop: '.75rem' }}
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            ↺ Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
