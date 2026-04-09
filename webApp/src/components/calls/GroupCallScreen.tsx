/**
 * P2.12: Экран группового звонка через LiveKit.
 * Grid-layout для N участников с видео, именами и mute-индикаторами.
 */

import { memo, useState, useEffect, useCallback, useRef } from 'react';
import {
  Mic, MicOff, Camera, CameraOff, PhoneOff,
  Monitor, MonitorOff, Users,
} from 'lucide-react';
import { Track, type Participant, type TrackPublication } from 'livekit-client';
import {
  joinRoom, leaveRoom, toggleMic, toggleCamera, toggleScreenShare,
  onCallEvent, getParticipants, type CallEvent,
} from '@/utils/livekitClient';
import * as api from '@/api/client';

interface GroupCallScreenProps {
  chatId: string;
  chatName: string;
  isVideo: boolean;
  onEnd: () => void;
}

interface ParticipantTile {
  identity: string;
  name: string;
  videoTrack: Track | null;
  audioTrack: Track | null;
  isMuted: boolean;
  isCameraOff: boolean;
  isLocal: boolean;
}

function attachTrack(el: HTMLVideoElement | null, track: Track | null) {
  if (!el || !track) return;
  const mediaTrack = track.mediaStreamTrack;
  if (mediaTrack) {
    el.srcObject = new MediaStream([mediaTrack]);
  }
}

const ParticipantView = memo(function ParticipantView({ tile }: { tile: ParticipantTile }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    attachTrack(videoRef.current, tile.videoTrack);
  }, [tile.videoTrack]);

  return (
    <div
      className="relative rounded-xl overflow-hidden flex items-center justify-center"
      style={{ background: '#1C1C1E', aspectRatio: '16/9' }}
    >
      {tile.videoTrack && !tile.isCameraOff ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={tile.isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold"
            style={{ background: '#007AFF', color: '#fff' }}
          >
            {tile.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
        </div>
      )}

      {/* Overlay: имя + mute */}
      <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
        <span className="text-[12px] text-white bg-black/50 px-2 py-0.5 rounded-full truncate max-w-[120px]">
          {tile.isLocal ? 'Вы' : tile.name}
        </span>
        {tile.isMuted && (
          <span className="bg-red-500/80 rounded-full p-1">
            <MicOff size={10} color="white" />
          </span>
        )}
      </div>
    </div>
  );
});

export const GroupCallScreen = memo(function GroupCallScreen({
  chatId,
  chatName,
  isVideo,
  onEnd,
}: GroupCallScreenProps) {
  const [participants, setParticipants] = useState<ParticipantTile[]>([]);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(isVideo);
  const [isScreenOn, setIsScreenOn] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Обновить список участников из LiveKit room
  const refreshParticipants = useCallback(() => {
    const parts = getParticipants();
    const tiles: ParticipantTile[] = parts.map((p: Participant) => {
      const videoTrack = Array.from(p.trackPublications.values())
        .find((pub: TrackPublication) => pub.track?.kind === Track.Kind.Video && pub.track?.source === Track.Source.Camera)
        ?.track ?? null;
      const audioTrack = Array.from(p.trackPublications.values())
        .find((pub: TrackPublication) => pub.track?.kind === Track.Kind.Audio)
        ?.track ?? null;

      return {
        identity: p.identity,
        name: p.name || p.identity,
        videoTrack,
        audioTrack,
        isMuted: !p.isMicrophoneEnabled,
        isCameraOff: !p.isCameraEnabled,
        isLocal: p.identity === parts[0]?.identity, // localParticipant первый
      };
    });
    setParticipants(tiles);
  }, []);

  // Подключение к LiveKit при монтировании
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { token, url } = await api.getLiveKitToken(chatId, isVideo);
        if (cancelled) return;
        await joinRoom(token, url);
        if (cancelled) { leaveRoom(); return; }
        setConnecting(false);
        refreshParticipants();

        // Таймер
        timerRef.current = setInterval(() => {
          setElapsed((e) => e + 1);
        }, 1000);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Ошибка подключения');
          setConnecting(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      leaveRoom();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [chatId, isVideo, refreshParticipants]);

  // Подписка на события LiveKit
  useEffect(() => {
    return onCallEvent((event: CallEvent) => {
      if (['participant_joined', 'participant_left', 'track_subscribed', 'track_unsubscribed'].includes(event.type)) {
        refreshParticipants();
      }
      if (event.type === 'disconnected') {
        onEnd();
      }
      if (event.type === 'error') {
        setError(event.error?.message || 'Ошибка');
      }
    });
  }, [refreshParticipants, onEnd]);

  const handleToggleMic = async () => {
    const enabled = await toggleMic();
    setIsMicOn(enabled);
    refreshParticipants();
  };

  const handleToggleCamera = async () => {
    const enabled = await toggleCamera();
    setIsCamOn(enabled);
    refreshParticipants();
  };

  const handleToggleScreen = async () => {
    const enabled = await toggleScreenShare();
    setIsScreenOn(enabled);
    refreshParticipants();
  };

  const handleEnd = () => {
    leaveRoom();
    onEnd();
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Grid: 1→full, 2→50/50, 3-4→2x2, 5+→auto
  const gridCols = participants.length <= 1 ? 1 : participants.length <= 4 ? 2 : 3;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#000' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <h2 className="text-[17px] font-semibold text-white">{chatName}</h2>
          <div className="flex items-center gap-2 text-[13px] text-white/50">
            <Users size={14} />
            <span>{participants.length} участник{participants.length !== 1 ? 'ов' : ''}</span>
            {!connecting && <span>{formatTime(elapsed)}</span>}
          </div>
        </div>
      </div>

      {/* Video grid */}
      <div className="flex-1 p-2 overflow-hidden">
        {connecting ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-white/50 text-[17px]">Подключение...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <p className="text-red-400 text-[15px]">{error}</p>
            <button onClick={onEnd} className="text-blue-400 text-[15px]">Закрыть</button>
          </div>
        ) : (
          <div
            className="grid gap-2 h-full"
            style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}
          >
            {participants.map((tile) => (
              <ParticipantView key={tile.identity} tile={tile} />
            ))}
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-center gap-4 px-4 py-4 pb-safe">
        <button
          onClick={handleToggleMic}
          className="w-[56px] h-[56px] rounded-full flex items-center justify-center"
          style={{ background: isMicOn ? '#3A3A3C' : '#FF3B30' }}
        >
          {isMicOn ? <Mic size={24} color="white" /> : <MicOff size={24} color="white" />}
        </button>

        <button
          onClick={handleToggleCamera}
          className="w-[56px] h-[56px] rounded-full flex items-center justify-center"
          style={{ background: isCamOn ? '#3A3A3C' : '#FF3B30' }}
        >
          {isCamOn ? <Camera size={24} color="white" /> : <CameraOff size={24} color="white" />}
        </button>

        <button
          onClick={handleToggleScreen}
          className="w-[56px] h-[56px] rounded-full flex items-center justify-center"
          style={{ background: isScreenOn ? '#007AFF' : '#3A3A3C' }}
        >
          {isScreenOn ? <Monitor size={24} color="white" /> : <MonitorOff size={24} color="white" />}
        </button>

        <button
          onClick={handleEnd}
          className="w-[56px] h-[56px] rounded-full flex items-center justify-center"
          style={{ background: '#FF3B30' }}
        >
          <PhoneOff size={24} color="white" />
        </button>
      </div>
    </div>
  );
});
