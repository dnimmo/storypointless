import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';
import type { ClientEvent, RoomView, ServerEvent } from '@storypointless/shared';
import { connect, type Socket, type SocketStatus } from './socket.ts';

type State = {
  status: SocketStatus;
  participantId: string | null;
  room: RoomView | null;
  myVoteIndex: number | null;
  error: string | null;
};

type Action =
  | { type: 'status'; status: SocketStatus }
  | { type: 'welcome'; participantId: string; room: RoomView }
  | { type: 'room_state'; room: RoomView }
  | { type: 'error'; message: string }
  | { type: 'set_my_vote'; cardIndex: number | null }
  | { type: 'leave' };

const initialState: State = {
  status: 'connecting',
  participantId: null,
  room: null,
  myVoteIndex: null,
  error: null,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'status':
      return { ...state, status: action.status };
    case 'welcome':
      return {
        ...state,
        participantId: action.participantId,
        room: action.room,
        myVoteIndex: null,
        error: null,
      };
    case 'room_state': {
      // Clear local vote when phase changes away from voting
      const myVoteIndex =
        action.room.phase === 'voting' &&
        state.participantId &&
        action.room.votedParticipantIds.includes(state.participantId)
          ? state.myVoteIndex
          : action.room.phase === 'voting'
            ? null
            : state.myVoteIndex;
      return { ...state, room: action.room, myVoteIndex };
    }
    case 'error':
      return { ...state, error: action.message };
    case 'set_my_vote':
      return { ...state, myVoteIndex: action.cardIndex };
    case 'leave':
      return { ...initialState, status: state.status };
  }
}

type Ctx = {
  state: State;
  send: (event: ClientEvent) => void;
  setMyVote: (index: number | null) => void;
  leave: () => void;
};

const StateContext = createContext<Ctx | null>(null);

export function StateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = connect({
      onEvent: (event: ServerEvent) => {
        switch (event.type) {
          case 'welcome':
            dispatch({ type: 'welcome', participantId: event.participantId, room: event.room });
            break;
          case 'room_state':
            dispatch({ type: 'room_state', room: event.room });
            break;
          case 'error':
            dispatch({ type: 'error', message: event.message });
            break;
        }
      },
      onStatus: (status) => dispatch({ type: 'status', status }),
    });
    socketRef.current = socket;
    return () => socket.close();
  }, []);

  const ctx = useMemo<Ctx>(
    () => ({
      state,
      send: (event) => {
        // For participant-attributed actions, attach our known participantId
        // so the server can sanity-check it against the connection binding.
        const needsId =
          state.participantId &&
          event.type !== 'create_room' &&
          event.type !== 'join_room';
        const enriched = needsId
          ? ({ ...event, participantId: state.participantId } as ClientEvent)
          : event;
        socketRef.current?.send(enriched);
      },
      setMyVote: (cardIndex) => dispatch({ type: 'set_my_vote', cardIndex }),
      leave: () => dispatch({ type: 'leave' }),
    }),
    [state],
  );

  return <StateContext.Provider value={ctx}>{children}</StateContext.Provider>;
}

export function useAppState(): Ctx {
  const ctx = useContext(StateContext);
  if (!ctx) throw new Error('useAppState must be used inside StateProvider');
  return ctx;
}
