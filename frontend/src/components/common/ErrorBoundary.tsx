import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Result, Button } from 'antd';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ---------------------------------------------------------------------------
// Error Boundary class component
// ---------------------------------------------------------------------------
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '60vh',
            padding: 24,
          }}
        >
          <Result
            status="error"
            title="页面发生错误"
            subTitle={
              this.state.error?.message ??
              '应用遇到了意外错误，请尝试刷新页面。'
            }
            extra={
              <Button type="primary" onClick={this.handleReset}>
                重试
              </Button>
            }
          />
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
