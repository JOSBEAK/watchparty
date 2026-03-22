// ── SYNC EVENTS (sync.gateway.ts) ──────────────────────────
// client → server
//   join-room    { roomCode, displayName }
//   play         { timestamp: number }
//   pause        { timestamp: number }
//   seek         { timestamp: number }
//   heartbeat    { timestamp: number }          // host emits every 5s
//
// server → client
//   room-state   { videoUrl, playback: { playing, timestamp, updatedAt } }
//   sync         { action: 'play'|'pause'|'seek', timestamp, serverTime }
//   heartbeat    { timestamp, serverTime }
//   participant-joined  { displayName, socketId }
//   participant-left    { socketId }

// ── SIGNALING EVENTS (signaling.gateway.ts) ────────────────
// client → server
//   signal       { to: socketId, signal: SimplePeer.SignalData }
//
// server → client
//   signal       { from: socketId, signal: SimplePeer.SignalData }

// ── Event name constants ───────────────────────────────────

export const SyncEvents = {
  // client → server
  JOIN_ROOM: 'join-room',
  PLAY: 'play',
  PAUSE: 'pause',
  SEEK: 'seek',
  HEARTBEAT: 'heartbeat',

  // server → client
  ROOM_STATE: 'room-state',
  SYNC: 'sync',
  HEARTBEAT_ACK: 'heartbeat-ack',
  PARTICIPANT_JOINED: 'participant-joined',
  PARTICIPANT_LEFT: 'participant-left',
  ERROR: 'error',
} as const;

export const SignalingEvents = {
  SIGNAL: 'signal',
} as const;

// ── Payload types ──────────────────────────────────────────

export interface JoinRoomPayload {
  roomCode: string;
  displayName: string;
}

export interface TimestampPayload {
  timestamp: number;
}

export interface PlaybackState {
  playing: boolean;
  timestamp: number;
  updatedAt: number; // Date.now()
}

export interface RoomStatePayload {
  videoUrl: string | null;
  playback: PlaybackState;
  participants: ParticipantInfo[];
}

export interface SyncPayload {
  action: 'play' | 'pause' | 'seek';
  timestamp: number;
  serverTime: number;
}

export interface HeartbeatPayload {
  timestamp: number;
  serverTime: number;
}

export interface ParticipantInfo {
  displayName: string;
  socketId: string;
}

export interface SignalPayload {
  to: string; // target socketId
  signal: unknown; // SimplePeer.SignalData
}

export interface SignalRelayPayload {
  from: string; // sender socketId
  signal: unknown;
}
