import { useRef, useState, useCallback, useMemo } from 'react';
import { useParams, useLocation, Navigate } from 'react-router-dom';
import { VideoPlayer } from '../components/VideoPlayer';
import { CamGrid } from '../components/CamGrid';
import { Chat } from '../components/Chat';
import { useSync } from '../hooks/useSync';
import { useWebRTC } from '../hooks/useWebRTC';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';

export function Room() {
  const { code } = useParams<{ code: string }>();
  const location = useLocation();

  // Persist room state in sessionStorage so a page refresh doesn't lose it
  const roomState = useMemo(() => {
    const locationState = location.state as {
      displayName: string;
      isHost: boolean;
    } | null;

    if (locationState && code) {
      // Save to sessionStorage for resilience on refresh
      sessionStorage.setItem(
        `watchparty:room:${code}`,
        JSON.stringify(locationState),
      );
      return locationState;
    }

    // Fall back to sessionStorage
    if (code) {
      const stored = sessionStorage.getItem(`watchparty:room:${code}`);
      if (stored) {
        try {
          return JSON.parse(stored) as { displayName: string; isHost: boolean };
        } catch { /* ignore parse errors */ }
      }
    }

    return null;
  }, [code, location.state]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [camEnabled, setCamEnabled] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Redirect if no state available
  if (!roomState || !code) {
    return <Navigate to="/" replace />;
  }

  const { displayName, isHost } = roomState;

  const {
    participants,
    videoUrl,
    isHost: isSyncHost,
    connected,
    emitPlay,
    emitPause,
    emitSeek,
  } = useSync({
    roomCode: code,
    displayName,
    videoRef,
  });

  const { peers, localStream } = useWebRTC({
    roomCode: code,
    enabled: camEnabled,
  });

  // ── Video upload (host only) ───────────────────────────

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);
      setUploadProgress(0);

      try {
        // 1. Get presigned upload URL
        const roomData = await api.getRoom(code);
        const { key, uploadUrl } = await api.getUploadUrl(
          file.name,
          file.type,
          roomData.id,
        );

        // 2. Upload directly to S3
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (evt) => {
          if (evt.lengthComputable) {
            setUploadProgress(Math.round((evt.loaded / evt.total) * 100));
          }
        });

        await new Promise<void>((resolve, reject) => {
          xhr.open('PUT', uploadUrl);
          xhr.setRequestHeader('Content-Type', file.type);
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`Upload failed: ${xhr.status}`));
          };
          xhr.onerror = () => reject(new Error('Upload failed'));
          xhr.send(file);
        });

        // 3. Notify backend about the video key via socket
        getSocket().emit('video-set', { key });
        setUploadProgress(100);
      } catch (err) {
        console.error('Upload failed:', err);
      } finally {
        setUploading(false);
      }
    },
    [code],
  );

  return (
    <div className="room">
      {/* ── Top bar ─────────────────────────────────────────── */}
      <header className="room__header">
        <div className="room__header-left">
          <span className="room__logo">🎬</span>
          <h1 className="room__title">WatchParty</h1>
          <div className="room__code-badge">
            <span className="room__code-label">Room</span>
            <span className="room__code-value">{code}</span>
          </div>
        </div>
        <div className="room__header-right">
          <div className={`room__status ${connected ? 'room__status--on' : ''}`}>
            <span className="room__status-dot" />
            {connected ? 'Connected' : 'Connecting...'}
          </div>
          <div className="room__participants">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
            {participants.length}
          </div>
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────── */}
      <div className="room__content">
        <div className="room__main">
          {/* Video player */}
          <VideoPlayer
            ref={videoRef}
            src={videoUrl}
            onPlay={emitPlay}
            onPause={emitPause}
            onSeek={emitSeek}
          />

          {/* Host upload */}
          {isHost && !videoUrl && (
            <div className="room__upload">
              <label className="btn btn--primary btn--upload">
                {uploading
                  ? `Uploading... ${uploadProgress}%`
                  : '📁 Upload Video'}
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleUpload}
                  hidden
                  disabled={uploading}
                />
              </label>
            </div>
          )}

          {/* Cam grid */}
          <CamGrid
            localStream={localStream}
            peers={peers}
            enabled={camEnabled}
          />
        </div>

        {/* Sidebar */}
        <aside className="room__sidebar">
          {/* Participants */}
          <div className="room__participant-list">
            <h3>Participants</h3>
            <ul>
              {participants.map((p) => (
                <li key={p.socketId} className="room__participant">
                  <span className="room__participant-avatar">
                    {p.displayName.charAt(0).toUpperCase()}
                  </span>
                  <span className="room__participant-name">
                    {p.displayName}
                    {isSyncHost &&
                      participants[0]?.socketId === p.socketId &&
                      ' (Host)'}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Chat */}
          <Chat displayName={displayName} />

          {/* Controls */}
          <div className="room__controls">
            <button
              className={`btn btn--icon ${camEnabled ? 'btn--active' : ''}`}
              onClick={() => setCamEnabled(!camEnabled)}
              title={camEnabled ? 'Turn off camera' : 'Turn on camera'}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {camEnabled ? (
                  <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                ) : (
                  <>
                    <path d="M16 16v1a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2h2m5.66 0H14a2 2 0 012 2v3.34l1 1L23 7v10" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
