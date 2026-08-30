import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Keep production fallback quiet. A runtime error must never become a blank screen.
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="app-shell min-h-screen px-4 py-8">
        <div className="mx-auto max-w-[560px] rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-lg font-semibold text-slate-900">Fund AI Pro 暂时遇到问题</div>
          <div className="mt-2 text-sm leading-6 text-slate-500">
            页面已经启动，但某个前端模块发生异常。你的本地持仓和缓存数据不会因为这里的错误被删除。
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }
}
