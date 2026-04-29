import { useMemo } from 'react';
import { useAppState } from '../state.tsx';

export function RevealPhase() {
  const { state, send } = useAppState();
  const room = state.room!;
  const reveal = room.reveal;

  const myId = state.participantId;
  const isHost = !!myId && room.participants.find((p) => p.id === myId)?.isHost === true;

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of room.participants) map.set(p.id, p.name);
    return map;
  }, [room.participants]);

  if (!reveal) return null;

  const pairs = reveal.significantPairs;
  const abstainers = reveal.abstainerIds
    .map((id) => nameById.get(id))
    .filter((n): n is string => !!n);

  return (
    <div className="grid gap-5">
      {pairs.length > 0 ? (
        <div className="grid gap-3">
          <p className="text-sm text-zinc-400">
            These pairs disagreed enough that it's worth hearing both:
          </p>
          <ul className="grid gap-2">
            {pairs.map((pair, i) => {
              const a = nameById.get(pair.a);
              const b = nameById.get(pair.b);
              if (!a || !b) return null;
              return (
                <li
                  key={i}
                  className="rounded-md bg-amber-500/10 px-3 py-2.5 text-sm text-amber-100 ring-1 ring-amber-500/30"
                >
                  {room.anonymous ? (
                    <span>Two participants disagreed.</span>
                  ) : (
                    <span>
                      <strong className="font-semibold">{a}</strong>
                      <span className="text-amber-300/70"> and </span>
                      <strong className="font-semibold">{b}</strong>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {pairs.length >= 3 && (
            <p className="text-xs text-zinc-500">
              Lots of disagreement. There may be hidden complexity worth talking through.
              Could this be split?
            </p>
          )}
        </div>
      ) : reveal.broadAgreement ? (
        <p className="rounded-md bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-200 ring-1 ring-emerald-500/30">
          Broad agreement. Move on.
        </p>
      ) : reveal.voterCount === 0 ? (
        <p className="rounded-md bg-zinc-900 px-3 py-2.5 text-sm text-zinc-300 ring-1 ring-zinc-800">
          Nobody voted.
        </p>
      ) : (
        <p className="rounded-md bg-zinc-900 px-3 py-2.5 text-sm text-zinc-300 ring-1 ring-zinc-800">
          Only one person voted. Not enough for a comparison.
        </p>
      )}

      {abstainers.length > 0 && (
        <p className="text-xs text-zinc-500">
          {abstainers.length === 1
            ? `${abstainers[0]} wasn't sure.`
            : `${abstainers.slice(0, -1).join(', ')} and ${abstainers.at(-1)} weren't sure.`}
        </p>
      )}

      {isHost ? (
        <button
          type="button"
          onClick={() => send({ type: 'next_round' })}
          className="justify-self-start rounded-md bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
        >
          Next round
        </button>
      ) : (
        <p className="text-xs text-zinc-500">waiting on host to start the next round</p>
      )}
    </div>
  );
}
