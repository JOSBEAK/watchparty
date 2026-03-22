import { useRef, forwardRef, useImperativeHandle } from 'react';

interface VideoPlayerProps {
  src: string | null;
  onPlay: () => void;
  onPause: () => void;
  onSeek: () => void;
}

export const VideoPlayer = forwardRef<HTMLVideoElement, VideoPlayerProps>(
  ({ src, onPlay, onPause, onSeek }, ref) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useImperativeHandle(ref, () => videoRef.current!);

    if (!src) {
      return (
        <div className="video-player video-player--empty">
          <div className="video-player__placeholder">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p>Waiting for host to upload a video...</p>
          </div>
        </div>
      );
    }

    return (
      <div className="video-player">
        <video
          ref={videoRef}
          src={src}
          controls
          onPlay={onPlay}
          onPause={onPause}
          onSeeked={onSeek}
          className="video-player__video"
        />
      </div>
    );
  },
);

VideoPlayer.displayName = 'VideoPlayer';
