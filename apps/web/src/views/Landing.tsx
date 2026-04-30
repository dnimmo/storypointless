import { useState } from 'react';
import { useAppState } from '../state.tsx';

function readCodeFromUrl(): string {
  if (typeof window === 'undefined') return '';
  const raw = new URLSearchParams(window.location.search).get('code') ?? '';
  return raw.toUpperCase().slice(0, 4);
}

export function Landing() {
  const { state, send } = useAppState();
  const initialCode = readCodeFromUrl();
  const [mode, setMode] = useState<'choose' | 'create' | 'join'>(
    initialCode ? 'join' : 'choose',
  );
  const [name, setName] = useState('');
  const [code, setCode] = useState(initialCode);

  const disabled = state.status !== 'open';

  return (
    <div className="mx-auto max-w-2xl">
      <section className="grid gap-6 pb-12">
        <h2 className="text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl md:text-6xl">
          What planning poker was meant to be.
        </h2>
        <p
          aria-label="One, two, three, five, eight, thirteen, twenty-one, crossed out"
          className="text-2xl font-medium text-zinc-600 line-through decoration-zinc-600 decoration-2 [word-spacing:0.6em]"
        >
          1 2 3 5 8 13 21
        </p>
        <p className="text-lg leading-relaxed text-zinc-400">
          Story points were always meant to start a conversation about complexity. Somewhere
          along the way they became a commitment. A velocity target. A sprint promise. A number
          on a ticket. The conversation that was supposed to be the point got buried under the
          number.
        </p>
        <p className="text-lg leading-relaxed text-zinc-400">
          Storypointless removes the number. Your team votes on the Fibonacci scale you're used
          to. The reveal never shows the cards. Instead it shows who disagreed with whom. That's
          where the conversation that builds shared understanding actually lives. Not in haggling
          between a 5 and an 8, but in hearing why one person saw a 3 and another saw a 13.
        </p>
      </section>

      <section className="mb-12 rounded-md bg-zinc-900/40 p-5 ring-1 ring-zinc-800">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
          What if our tracking tool needs a number?
        </h3>
        <p className="leading-relaxed text-zinc-300">
          Write whatever you like in the box. The useful part of the exercise has already
          happened, and the points were never the point.
        </p>
      </section>

      <section className="grid gap-3" id="start">
        <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Try it</h3>

        {state.error && (
          <div className="rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-300 ring-1 ring-rose-500/30">
            {state.error}
          </div>
        )}

        {mode === 'choose' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode('create')}
              className="rounded-md bg-white px-4 py-3 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
            >
              Start a session
            </button>
            <button
              type="button"
              onClick={() => setMode('join')}
              className="rounded-md bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-100 ring-1 ring-zinc-700 hover:bg-zinc-700"
            >
              Join a session
            </button>
          </div>
        )}

        {mode === 'create' && (
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              send({ type: 'create_room', name: name.trim() });
            }}
          >
            <Field
              label="Your name"
              value={name}
              onChange={setName}
              placeholder="e.g. Alice"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('choose')}
                className="flex-1 rounded-md bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-100 ring-1 ring-zinc-700 hover:bg-zinc-700"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={disabled || !name.trim()}
                className="flex-1 rounded-md bg-white px-4 py-3 text-sm font-medium text-zinc-900 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:bg-zinc-600"
              >
                Create room
              </button>
            </div>
          </form>
        )}

        {mode === 'join' && (
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim() || !code.trim()) return;
              send({ type: 'join_room', code: code.trim().toUpperCase(), name: name.trim() });
            }}
          >
            <Field
              label="Room code"
              value={code}
              onChange={(v) => setCode(v.toUpperCase())}
              placeholder="ABCD"
              autoFocus
            />
            <Field label="Your name" value={name} onChange={setName} placeholder="e.g. Alice" />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('choose')}
                className="flex-1 rounded-md bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-100 ring-1 ring-zinc-700 hover:bg-zinc-700"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={disabled || !name.trim() || !code.trim()}
                className="flex-1 rounded-md bg-white px-4 py-3 text-sm font-medium text-zinc-900 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:bg-zinc-600"
              >
                Join
              </button>
            </div>
          </form>
        )}
      </section>

      <footer className="mt-16 border-t border-zinc-900 pt-8 text-sm leading-relaxed text-zinc-500">
        <p>
          Storypointless is free, has no accounts, and stores nothing once the room closes. If
          it's useful to your team and you'd like to help keep it running, you can{' '}
          <a
            href="https://buymeacoffee.com/dnimmo"
            target="_blank"
            rel="noreferrer"
            className="text-zinc-300 underline decoration-zinc-700 underline-offset-2 hover:text-white hover:decoration-zinc-400"
          >
            buy me a coffee
          </a>
          .
        </p>
      </footer>
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-400">
        {props.label}
      </span>
      <input
        autoFocus={props.autoFocus}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        className="rounded-md bg-zinc-900 px-3 py-2.5 text-sm text-zinc-100 ring-1 ring-zinc-800 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-500"
      />
    </label>
  );
}
