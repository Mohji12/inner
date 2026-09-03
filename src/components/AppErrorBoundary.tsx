import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean };

/**
 * Catches render crashes (e.g. storage SecurityError on Safari) so users
 * see a recovery UI instead of a blank white page.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[AppErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f7f4ef] px-6 text-center">
          <h1 className="font-serif text-2xl font-semibold text-zinc-900">Something went wrong</h1>
          <p className="max-w-md text-sm text-zinc-600">
            The page could not load. Try refreshing. If you use Safari, check that cookies are not fully
            blocked for this site.
          </p>
          <button
            type="button"
            className="rounded-xl bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white"
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
