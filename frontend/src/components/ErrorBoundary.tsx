import { Component, type ReactNode } from 'react';
import './ErrorBoundary.css';

interface ErrorBoundaryProps {
  level: 'app' | 'layout' | 'widget';
  widgetType?: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { level, widgetType } = this.props;

    if (level === 'widget') {
      return (
        <div className="error-boundary error-boundary--widget">
          <span className="error-boundary__icon">○</span>
          <span className="error-boundary__type">{widgetType ?? 'Widget'}</span>
          <span className="error-boundary__label">FAULT DETECTED</span>
          <button className="error-boundary__retry" onClick={this.handleReset}>
            Retry
          </button>
        </div>
      );
    }

    if (level === 'layout') {
      return (
        <div className="error-boundary error-boundary--layout">
          <div className="error-boundary__panel">
            <span className="error-boundary__icon error-boundary__icon--lg">◇</span>
            <h2 className="error-boundary__title">SUBSYSTEM OFFLINE</h2>
            <p className="error-boundary__detail">
              {this.state.error?.message ?? 'An unexpected error occurred'}
            </p>
            <button className="btn" onClick={this.handleReset}>
              Reinitialize
            </button>
          </div>
        </div>
      );
    }

    // App level
    return (
      <div className="error-boundary error-boundary--app">
        <div className="error-boundary__panel">
          <span className="error-boundary__icon error-boundary__icon--xl">✕</span>
          <h1 className="error-boundary__title error-boundary__title--critical">SYSTEM FAILURE</h1>
          <p className="error-boundary__detail">
            {this.state.error?.message ?? 'A critical error occurred'}
          </p>
          <button className="btn btn-danger" onClick={this.handleReload}>
            Reboot System
          </button>
        </div>
      </div>
    );
  }
}
