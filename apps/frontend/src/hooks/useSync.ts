import { useEffect, useRef, useCallback, useState } from 'react';
import { connectSocket, disconnectSocket, getSocket } from '../lib/socket';

// Event names — kept in sync with backend shared/events.ts
const SyncEvents = {
  JOIN_ROOM: 'join-room',
  PLAY: 'play',
  PAUSE: 'pause',
  SEEK: 'seek',
  HEARTBEAT: 'heartbeat',
  ROOM_STATE: 'room-state',
  SYNC: 'sync',
  HEARTBEAT_ACK: 'heartbeat-ack',
  PARTICIPANT_JOINED: 'participant-joined',
  PARTICIPANT_LEFT: 'participant-left',
  ERROR: 'error',
} as const;

interface PlaybackState {
  playing: boolean;
  timestamp: number;
  updatedAt: number;
}

interface ParticipantInfo {
  displayName: string;
  socketId: string;
}

interface RoomState {
  videoUrl: string | null;
  playback: PlaybackState;
  participants: ParticipantInfo[];
}

interface SyncPayload {
  action: 'play' | 'pause' | 'seek';
  timestamp: number;
  serverTime: number;
}

interface HeartbeatPayload {
  timestamp: number;
  serverTime: number;
}

interface UseSyncOptions {
  roomCode: string;
  displayName: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

/** Maximum drift (in seconds) before forcing a seek */
const MAX_DRIFT = 1.5;
/** Heartbeat interval for the host (ms) */
const HEARTBEAT_INTERVAL = 5000;

export function useSync({ roomCode, displayName, videoRef }: UseSyncOptions) {
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [connected, setConnected] = useState(false);

  // Track whether sync events should be suppressed (to avoid echo)
  const isSyncAction = useRef(false);
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Connect & join room ────────────────────────────────

  useEffect(() => {
    const socket = connectSocket();

    socket.on('connect', () => {
      setConnected(true);
      socket.emit(SyncEvents.JOIN_ROOM, { roomCode, displayName });
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    // ── Room state (initial) ─────────────────────────────
    socket.on(SyncEvents.ROOM_STATE, (state: RoomState) => {
      setVideoUrl(state.videoUrl);
      setParticipants(state.participants);

      // Am I the host? (first participant)
      const myId = socket.id;
      if (state.participants.length > 0 && state.participants[0].socketId === myId) {
        setIsHost(true);
      }

      // Apply initial playback state
      const video = videoRef.current;
      if (video && state.playback) {
        video.currentTime = state.playback.timestamp;
        if (state.playback.playing) {
          video.play().catch(() => {});
        }
      }
    });

    // ── Sync events (play/pause/seek) ────────────────────
    socket.on(SyncEvents.SYNC, (payload: SyncPayload) => {
      const video = videoRef.current;
      if (!video) return;

      isSyncAction.current = true;

      switch (payload.action) {
        case 'play':
          video.currentTime = payload.timestamp;
          video.play().catch(() => {});
          break;
        case 'pause':
          video.currentTime = payload.timestamp;
          video.pause();
          break;
        case 'seek':
          video.currentTime = payload.timestamp;
          break;
      }

      // Reset suppression after a tick
      setTimeout(() => {
        isSyncAction.current = false;
      }, 100);
    });

    // ── Heartbeat (drift correction) ─────────────────────
    socket.on(SyncEvents.HEARTBEAT_ACK, (payload: HeartbeatPayload) => {
      const video = videoRef.current;
      if (!video) return;

      const drift = Math.abs(video.currentTime - payload.timestamp);
      if (drift > MAX_DRIFT) {
        video.currentTime = payload.timestamp;
      }
    });

    // ── Participant events ───────────────────────────────
    socket.on(SyncEvents.PARTICIPANT_JOINED, (info: ParticipantInfo) => {
      setParticipants((prev) => [...prev, info]);
    });

    socket.on(SyncEvents.PARTICIPANT_LEFT, ({ socketId }: { socketId: string }) => {
      setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
    });

    socket.on(SyncEvents.ERROR, (err: { message: string }) => {
      console.error('Sync error:', err.message);
    });

    // ── Video URL broadcast (after host uploads) ─────────
    socket.on('video-url', ({ videoUrl: url }: { videoUrl: string }) => {
      setVideoUrl(url);
    });

    return () => {
      if (heartbeatTimer.current) {
        clearInterval(heartbeatTimer.current);
      }
      disconnectSocket();
    };
  }, [roomCode, displayName, videoRef]);

  // ── Host heartbeat ─────────────────────────────────────

  useEffect(() => {
    if (!isHost) return;

    heartbeatTimer.current = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;

      const socket = getSocket();
      socket.emit(SyncEvents.HEARTBEAT, {
        timestamp: video.currentTime,
      });
    }, HEARTBEAT_INTERVAL);

    return () => {
      if (heartbeatTimer.current) {
        clearInterval(heartbeatTimer.current);
      }
    };
  }, [isHost, videoRef]);

  // ── User actions (emit sync events) ────────────────────

  const emitPlay = useCallback(() => {
    if (isSyncAction.current) return;
    const video = videoRef.current;
    if (!video) return;
    getSocket().emit(SyncEvents.PLAY, { timestamp: video.currentTime });
  }, [videoRef]);

  const emitPause = useCallback(() => {
    if (isSyncAction.current) return;
    const video = videoRef.current;
    if (!video) return;
    getSocket().emit(SyncEvents.PAUSE, { timestamp: video.currentTime });
  }, [videoRef]);

  const emitSeek = useCallback(() => {
    if (isSyncAction.current) return;
    const video = videoRef.current;
    if (!video) return;
    getSocket().emit(SyncEvents.SEEK, { timestamp: video.currentTime });
  }, [videoRef]);

  return {
    participants,
    videoUrl,
    isHost,
    connected,
    emitPlay,
    emitPause,
    emitSeek,
  };
}
