import { useState } from 'react';
import { useAppState } from '../state.tsx';
import { VotingPhase } from './VotingPhase.tsx';
import { RevealPhase } from './RevealPhase.tsx';

export function Room() {
  const { state } = useAppState();
  const room = state.room;
  if (!room) return null;

  return (
    <div className="grid gap-8">
      <RoomHeader />
      <section>
        {room.phase === 'voting' && <VotingPhase />}
        {room.phase === 'revealed' && <RevealPhase />}
      </section>
    </div>
  );
}

function RoomHeader() {
  const { state } = useAppState();
  const room = state.room!;
  const [copied, setCopied] = useState(false);

  return (
    <section className="grid gap-3 rounded-lg bg-zinc-900/50 p-4 ring-1 ring-zinc-800">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Room</p>
          <p className="font-mono text-2xl tracking-[0.2em] text-white">{room.code}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(`${window.location.origin}/?code=${room.code}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="rounded-md bg-zinc-800 px-3 py-2 text-xs text-zinc-200 ring-1 ring-zinc-700 hover:bg-zinc-700"
        >
          {copied ? 'copied' : 'copy invite'}
        </button>
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {room.participants.map((p) => {
          const isMe = p.id === state.participantId;
          const hasVoted = room.votedParticipantIds.includes(p.id);
          return (
            <li
              key={p.id}
              className={
                'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ring-1 ' +
                (hasVoted
                  ? 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30'
                  : 'bg-zinc-900 text-zinc-300 ring-zinc-800')
              }
            >
              <span>{p.name}</span>
              {isMe && <span className="text-zinc-500">(you)</span>}
              {p.isHost && <span className="text-zinc-500">·host</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
