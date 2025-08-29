import React from 'react';

type State = { hasError: boolean; error?: Error | null };

class ErrorBoundaryInner extends React.Component<any, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24 }}>
          <h2>Une erreur est survenue dans l'application</h2>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#c00' }}>{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children as any;
  }
}

// Export a wrapper function as default so the module's default export is a value
export default function ErrorBoundary(props: any) {
  return React.createElement(ErrorBoundaryInner, props);
}
