import { getScale } from '@storypointless/shared';
import { useAppState } from '../state.tsx';

export function VotingPhase() {
  const { state, send, setMyVote } = useAppState();
  const room = state.room!;
  const scale = getScale(room.scale);
  const myId = state.participantId;
  const haveIVoted = !!myId && room.votedParticipantIds.includes(myId);
  const totalParticipants = room.participants.length;
  const votedCount = room.votedParticipantIds.length;
  const isHost = !!myId && room.participants.find((p) => p.id === myId)?.isHost === true;

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between text-sm">
        <p className="text-zinc-400">
          {votedCount} of {totalParticipants} {totalParticipants === 1 ? 'has' : 'have'} voted
        </p>
        {isHost ? (
          <button
            type="button"
            onClick={() => send({ type: 'reveal' })}
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
          >
            Reveal
          </button>
        ) : (
          <p className="text-xs text-zinc-500">waiting on host to reveal</p>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {scale.cards.map((card, index) => {
          const isAbstain = index === scale.abstainIndex;
          const isMine = state.myVoteIndex === index;
          return (
            <button
              key={card}
              type="button"
              onClick={() => {
                setMyVote(index);
                send({ type: 'cast_vote', cardIndex: index });
              }}
              className={
                'flex aspect-[2/3] items-center justify-center rounded-md text-lg font-semibold ring-1 transition ' +
                (isMine
                  ? 'bg-white text-zinc-900 ring-white'
                  : isAbstain
                    ? 'bg-zinc-900 text-zinc-400 ring-zinc-800 hover:bg-zinc-800'
                    : 'bg-zinc-900 text-zinc-100 ring-zinc-800 hover:bg-zinc-800')
              }
            >
              {card}
            </button>
          );
        })}
      </div>

      {haveIVoted && (
        <button
          type="button"
          onClick={() => {
            setMyVote(null);
            send({ type: 'clear_vote' });
          }}
          className="justify-self-start text-xs text-zinc-500 hover:text-zinc-300"
        >
          clear my vote
        </button>
      )}
    </div>
  );
}
