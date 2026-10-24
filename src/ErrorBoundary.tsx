import { Component, type ReactNode } from "react";
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="shell">
        <section className="panel" role="alert">
          <h1>页面暂时没有载入成功</h1>
          <p className="hint">
            已保存的本地记录不会因此删除。请重新载入，或联网后重试。
          </p>
          <button className="primary" onClick={() => location.reload()}>
            重新载入
          </button>
        </section>
      </main>
    ) : (
      this.props.children
    );
  }
}
