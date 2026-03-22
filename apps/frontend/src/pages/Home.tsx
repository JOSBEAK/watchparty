import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export function Home() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    setLoading(true);
    setError('');
    try {
      const room = await api.createRoom(displayName.trim());
      navigate(`/room/${room.code}`, {
        state: { displayName: displayName.trim(), isHost: true },
      });
    } catch {
      setError('Failed to create room. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !roomCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      await api.getRoom(roomCode.trim().toUpperCase());
      navigate(`/room/${roomCode.trim().toUpperCase()}`, {
        state: { displayName: displayName.trim(), isHost: false },
      });
    } catch {
      setError('Room not found. Check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home">
      <div className="home__hero">
        <div className="home__glow" />
        <h1 className="home__title">
          <span className="home__icon">🎬</span>
          WatchParty
        </h1>
        <p className="home__subtitle">
          Watch videos together in perfect sync. No accounts needed.
        </p>
      </div>

      <div className="home__cards">
        {/* Create Room */}
        <form className="card" onSubmit={handleCreate}>
          <div className="card__badge">Host</div>
          <h2 className="card__title">Create a Room</h2>
          <p className="card__desc">
            Start a new watch party and share the code with friends.
          </p>
          <input
            type="text"
            placeholder="Your display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="input"
            maxLength={30}
            required
          />
          <button
            type="submit"
            className="btn btn--primary"
            disabled={loading || !displayName.trim()}
          >
            {loading ? 'Creating...' : 'Create Room'}
          </button>
        </form>

        {/* Join Room */}
        <form className="card" onSubmit={handleJoin}>
          <div className="card__badge card__badge--join">Join</div>
          <h2 className="card__title">Join a Room</h2>
          <p className="card__desc">
            Enter the 6-character room code to join your friends.
          </p>
          <input
            type="text"
            placeholder="Your display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="input"
            maxLength={30}
            required
          />
          <input
            type="text"
            placeholder="Room code (e.g. ABC123)"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            className="input input--code"
            maxLength={6}
            required
          />
          <button
            type="submit"
            className="btn btn--secondary"
            disabled={loading || !displayName.trim() || roomCode.length !== 6}
          >
            {loading ? 'Joining...' : 'Join Room'}
          </button>
        </form>
      </div>

      {error && <div className="home__error">{error}</div>}

      <footer className="home__footer">
        <p>Peer-to-peer video sync &middot; WebRTC webcams &middot; No sign-up required</p>
      </footer>
    </div>
  );
}
