import { useEffect, useRef, useState, useCallback } from 'react';
import SimplePeer from 'simple-peer';
import { getSocket } from '../lib/socket';

interface PeerConnection {
  socketId: string;
  peer: SimplePeer.Instance;
  stream: MediaStream | null;
}

interface UseWebRTCOptions {
  roomCode: string;
  enabled: boolean; // cam on/off
}

export function useWebRTC({ roomCode, enabled }: UseWebRTCOptions) {
  const [peers, setPeers] = useState<PeerConnection[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const peersRef = useRef<PeerConnection[]>([]);

  // Get local media stream
  useEffect(() => {
    if (!enabled) {
      // Disable tracks but keep stream alive (no re-negotiation)
      if (localStream) {
        localStream.getVideoTracks().forEach((t) => (t.enabled = false));
        localStream.getAudioTracks().forEach((t) => (t.enabled = false));
      }
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        setLocalStream(stream);
      })
      .catch((err) => {
        console.error('Failed to get media:', err);
      });

    return () => {
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
        setLocalStream(null);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Enable/disable tracks when toggling
  useEffect(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach((t) => (t.enabled = enabled));
      localStream.getAudioTracks().forEach((t) => (t.enabled = enabled));
    }
  }, [enabled, localStream]);

  // Set up WebRTC peer connections
  useEffect(() => {
    if (!localStream || !enabled) return;

    const socket = getSocket();

    // Announce that this user has enabled their camera
    socket.emit('cam-enabled', { roomCode });

    // When another user enables their camera, initiate a connection to them
    const handleCamEnabled = ({
      socketId,
    }: {
      socketId: string;
    }) => {
      // Don't connect to ourselves
      if (socketId === socket.id) return;
      // Don't create duplicate connections
      if (peersRef.current.find((p) => p.socketId === socketId)) return;
      // I'm the initiator (I'll send the offer)
      const peer = createPeer(socketId, localStream);
      peersRef.current.push({ socketId, peer, stream: null });
      setPeers([...peersRef.current]);
    };

    // When I receive a signal from another peer
    const handleSignal = ({
      from,
      signal,
    }: {
      from: string;
      signal: SimplePeer.SignalData;
    }) => {
      const existing = peersRef.current.find((p) => p.socketId === from);
      if (existing) {
        existing.peer.signal(signal);
      } else {
        // They initiated — I'm the responder
        const peer = addPeer(from, signal, localStream);
        peersRef.current.push({ socketId: from, peer, stream: null });
        setPeers([...peersRef.current]);
      }
    };

    const handleParticipantLeft = ({
      socketId,
    }: {
      socketId: string;
    }) => {
      const idx = peersRef.current.findIndex((p) => p.socketId === socketId);
      if (idx !== -1) {
        peersRef.current[idx].peer.destroy();
        peersRef.current.splice(idx, 1);
        setPeers([...peersRef.current]);
      }
    };

    socket.on('cam-enabled', handleCamEnabled);
    socket.on('signal', handleSignal);
    socket.on('participant-left', handleParticipantLeft);

    return () => {
      socket.off('cam-enabled', handleCamEnabled);
      socket.off('signal', handleSignal);
      socket.off('participant-left', handleParticipantLeft);

      // Destroy all peers
      peersRef.current.forEach((p) => p.peer.destroy());
      peersRef.current = [];
      setPeers([]);
    };
  }, [localStream, enabled, roomCode]);

  // Create a peer where I am the initiator
  const createPeer = useCallback(
    (
      targetSocketId: string,
      stream: MediaStream,
    ): SimplePeer.Instance => {
      const peer = new SimplePeer({
        initiator: true,
        trickle: true,
        stream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        },
      });

      peer.on('signal', (signal) => {
        getSocket().emit('signal', { to: targetSocketId, signal });
      });

      peer.on('stream', (remoteStream) => {
        const conn = peersRef.current.find(
          (p) => p.socketId === targetSocketId,
        );
        if (conn) {
          conn.stream = remoteStream;
          setPeers([...peersRef.current]);
        }
      });

      peer.on('error', (err) => {
        console.error(`Peer error (${targetSocketId}):`, err);
      });

      return peer;
    },
    [],
  );

  // Add a peer where they are the initiator
  const addPeer = useCallback(
    (
      callerSocketId: string,
      incomingSignal: SimplePeer.SignalData,
      stream: MediaStream,
    ): SimplePeer.Instance => {
      const peer = new SimplePeer({
        initiator: false,
        trickle: true,
        stream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        },
      });

      peer.on('signal', (signal) => {
        getSocket().emit('signal', { to: callerSocketId, signal });
      });

      peer.on('stream', (remoteStream) => {
        const conn = peersRef.current.find(
          (p) => p.socketId === callerSocketId,
        );
        if (conn) {
          conn.stream = remoteStream;
          setPeers([...peersRef.current]);
        }
      });

      peer.on('error', (err) => {
        console.error(`Peer error (${callerSocketId}):`, err);
      });

      // Accept the incoming signal
      peer.signal(incomingSignal);

      return peer;
    },
    [],
  );

  return { peers, localStream };
}
