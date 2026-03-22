const API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

export const api = {
  async createRoom(displayName: string): Promise<{ id: string; code: string }> {
    const res = await fetch(`${API_URL}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName }),
    });
    if (!res.ok) throw new Error('Failed to create room');
    return res.json();
  },

  async getRoom(code: string): Promise<{
    id: string;
    code: string;
    videoKey: string | null;
    videoFilename: string | null;
  }> {
    const res = await fetch(`${API_URL}/api/rooms/${code}`);
    if (!res.ok) throw new Error('Room not found');
    return res.json();
  },

  async getUploadUrl(
    filename: string,
    contentType: string,
    roomId: string,
  ): Promise<{ key: string; uploadUrl: string }> {
    const res = await fetch(`${API_URL}/api/video/presign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, contentType, roomId }),
    });
    if (!res.ok) throw new Error('Failed to get upload URL');
    return res.json();
  },

  async getPlaybackUrl(key: string): Promise<string> {
    const res = await fetch(
      `${API_URL}/api/video/${encodeURIComponent(key)}/url`,
    );
    if (!res.ok) throw new Error('Failed to get playback URL');
    const data = await res.json();
    return data.url;
  },
};
