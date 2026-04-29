import { StateProvider, useAppState } from './state.tsx';
import { Landing } from './views/Landing.tsx';
import { Room } from './views/Room.tsx';

function Shell() {
  const { state } = useAppState();
  return state.room ? <Room /> : <Landing />;
}

function Header() {
  const { state } = useAppState();
  return (
    <header className="mb-8 flex items-baseline justify-between gap-4">
      <h1 className="text-xl font-semibold tracking-tight">
        <span className="text-white">story</span>
        <span className="text-zinc-500">pointless</span>
      </h1>
      {state.room && (
        <p className="hidden text-xs text-zinc-500 sm:block">
          the points were never the point
        </p>
      )}
    </header>
  );
}

export function App() {
  return (
    <StateProvider>
      <div className="mx-auto flex min-h-full max-w-3xl flex-col px-4 py-6 sm:px-6 sm:py-10">
        <Header />
        <main className="flex-1">
          <Shell />
        </main>
        <ConnectionBadge />
      </div>
    </StateProvider>
  );
}

function ConnectionBadge() {
  const { state } = useAppState();
  if (state.status === 'open') return null;
  const label = state.status === 'connecting' ? 'connecting…' : 'reconnecting…';
  return (
    <div className="fixed bottom-4 right-4 rounded-full bg-amber-500/15 px-3 py-1 text-xs text-amber-300 ring-1 ring-amber-500/30">
      {label}
    </div>
  );
}
