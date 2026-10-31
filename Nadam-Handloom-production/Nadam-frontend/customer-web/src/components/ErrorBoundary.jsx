import { Component } from 'react';

// A page that crashed shows this instead of a blank screen, with a reference to quote.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, reference: '' };
  }

  static getDerivedStateFromError(error) {
    return { error, reference: Math.random().toString(36).slice(2, 8).toUpperCase() };
  }

  componentDidCatch(error, info) {
    console.error(`[website] page error ${this.state.reference}`, error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="maint">
        <div>
          <img src="/img/logo-192.png" alt="" width="110" height="110" />
          <h1 style={{ fontSize: 'clamp(1.8rem,4vw,2.6rem)' }}>Something went wrong</h1>
          <p className="muted">This page ran into a problem. Reloading usually fixes it. If it keeps happening, message us on WhatsApp and quote <b>{this.state.reference}</b>.</p>
          <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Reload the page</button>
            <a className="btn" href="/">Go to the home page</a>
          </div>
        </div>
      </div>
    );
  }
}
