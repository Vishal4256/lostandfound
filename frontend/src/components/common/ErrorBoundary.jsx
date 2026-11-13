import React from 'react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('HavenFind Uncaught UI Error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6 text-on-surface">
          <div className="max-w-xl w-full bg-surface-container-lowest border border-outline-variant rounded-3xl p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600">
                <span className="material-symbols-outlined text-[28px]">warning</span>
              </div>
              <div>
                <h1 className="text-title-lg font-bold text-primary">Application View Interrupted</h1>
                <p className="text-body-sm text-on-surface-variant">
                  HavenFind encountered an unexpected issue while rendering this page.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-container border border-outline-variant/60 text-body-sm font-mono text-on-surface-variant overflow-x-auto max-h-48">
              <p className="font-semibold text-primary mb-1">
                {this.state.error?.name || 'Error'}: {this.state.error?.message || 'Unknown runtime error'}
              </p>
              {this.state.errorInfo?.componentStack && (
                <pre className="text-[11px] text-outline leading-tight mt-2 whitespace-pre-wrap">
                  {this.state.errorInfo.componentStack}
                </pre>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-outline-variant">
              <button
                type="button"
                onClick={this.handleGoHome}
                className="px-5 py-2.5 rounded-xl border border-outline-variant text-primary font-semibold text-body-sm hover:bg-surface-container transition-all cursor-pointer"
              >
                Return to Directory
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="px-6 py-2.5 rounded-xl bg-primary text-on-primary font-bold text-body-sm hover:bg-primary-container transition-all shadow-sm cursor-pointer flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">refresh</span>
                <span>Reload Page</span>
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary

