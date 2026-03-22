import { useEffect, useRef } from 'react';

interface PeerStream {
  socketId: string;
  stream: MediaStream | null;
}

interface CamGridProps {
  localStream: MediaStream | null;
  peers: PeerStream[];
  enabled: boolean;
}

function CamTile({
  stream,
  label,
  muted,
}: {
  stream: MediaStream | null;
  label: string;
  muted?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="cam-tile">
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className="cam-tile__video"
        />
      ) : (
        <div className="cam-tile__placeholder">
          <span>{label.charAt(0).toUpperCase()}</span>
        </div>
      )}
      <div className="cam-tile__label">{label}</div>
    </div>
  );
}

export function CamGrid({ localStream, peers, enabled }: CamGridProps) {
  if (!enabled) return null;

  return (
    <div className="cam-grid">
      <CamTile stream={localStream} label="You" muted />
      {peers.map((p) => (
        <CamTile
          key={p.socketId}
          stream={p.stream}
          label={p.socketId.slice(0, 6)}
        />
      ))}
    </div>
  );
}
