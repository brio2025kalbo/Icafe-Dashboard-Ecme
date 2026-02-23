import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

class GlobalErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { error: Error | null }
> {
    constructor(props: { children: React.ReactNode }) {
        super(props)
        this.state = { error: null }
    }
    static getDerivedStateFromError(error: Error) {
        return { error }
    }
    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('[GlobalErrorBoundary] Caught error:', error)
        console.error('[GlobalErrorBoundary] Component stack:', info.componentStack)
    }
    render() {
        if (this.state.error) {
            return (
                <div style={{
                    padding: '2rem',
                    fontFamily: 'monospace',
                    background: '#fff0f0',
                    color: '#c00',
                    minHeight: '100vh',
                }}>
                    <h2>Application Error</h2>
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        {this.state.error.message}
                        {'\n\n'}
                        {this.state.error.stack}
                    </pre>
                </div>
            )
        }
        return this.props.children
    }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <GlobalErrorBoundary>
            <App />
        </GlobalErrorBoundary>
    </React.StrictMode>,
)
