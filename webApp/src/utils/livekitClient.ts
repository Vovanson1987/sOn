/**
 * P2.12: LiveKit клиент — обёртка над livekit-client SDK.
 * Заменяет P2P WebRTC для всех звонков (1:1 и групповых).
 */

import {
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrackPublication,
  type LocalParticipant,
  type Participant,
  ConnectionState,
} from 'livekit-client';

export type CallEventType =
  | 'connected'
  | 'disconnected'
  | 'participant_joined'
  | 'participant_left'
  | 'track_subscribed'
  | 'track_unsubscribed'
  | 'connection_quality_changed'
  | 'error';

export interface CallEvent {
  type: CallEventType;
  participant?: Participant;
  track?: Track;
  error?: Error;
}

type CallEventHandler = (event: CallEvent) => void;

let activeRoom: Room | null = null;
const listeners: Set<CallEventHandler> = new Set();

/** Подписаться на события звонка */
export function onCallEvent(handler: CallEventHandler): () => void {
  listeners.add(handler);
  return () => listeners.delete(handler);
}

function emit(event: CallEvent) {
  for (const fn of listeners) {
    try { fn(event); } catch { /* skip broken listener */ }
  }
}

/** Подключиться к LiveKit room */
export async function joinRoom(token: string, url: string): Promise<Room> {
  if (activeRoom) {
    await leaveRoom();
  }

  const room = new Room({
    adaptiveStream: true,
    dynacast: true,
    videoCaptureDefaults: {
      resolution: { width: 640, height: 480, frameRate: 30 },
    },
  });

  // Event handlers
  room.on(RoomEvent.Connected, () => {
    emit({ type: 'connected' });
  });

  room.on(RoomEvent.Disconnected, () => {
    emit({ type: 'disconnected' });
    activeRoom = null;
  });

  room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
    emit({ type: 'participant_joined', participant });
  });

  room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
    emit({ type: 'participant_left', participant });
  });

  room.on(RoomEvent.TrackSubscribed, (track: Track, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
    emit({ type: 'track_subscribed', participant, track });
  });

  room.on(RoomEvent.TrackUnsubscribed, (track: Track, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
    emit({ type: 'track_unsubscribed', participant, track });
  });

  try {
    await room.connect(url, token);
    activeRoom = room;

    // Публикуем камеру и микрофон
    await room.localParticipant.enableCameraAndMicrophone();
  } catch (err) {
    emit({ type: 'error', error: err instanceof Error ? err : new Error(String(err)) });
    throw err;
  }

  return room;
}

/** Отключиться от room */
export async function leaveRoom(): Promise<void> {
  if (!activeRoom) return;
  try {
    activeRoom.disconnect(true);
  } catch { /* ignore */ }
  activeRoom = null;
}

/** Получить активный room */
export function getRoom(): Room | null {
  return activeRoom;
}

/** Переключить микрофон */
export async function toggleMic(): Promise<boolean> {
  if (!activeRoom) return false;
  const enabled = activeRoom.localParticipant.isMicrophoneEnabled;
  await activeRoom.localParticipant.setMicrophoneEnabled(!enabled);
  return !enabled;
}

/** Переключить камеру */
export async function toggleCamera(): Promise<boolean> {
  if (!activeRoom) return false;
  const enabled = activeRoom.localParticipant.isCameraEnabled;
  await activeRoom.localParticipant.setCameraEnabled(!enabled);
  return !enabled;
}

/** Переключить screen share */
export async function toggleScreenShare(): Promise<boolean> {
  if (!activeRoom) return false;
  const enabled = activeRoom.localParticipant.isScreenShareEnabled;
  await activeRoom.localParticipant.setScreenShareEnabled(!enabled);
  return !enabled;
}

/** Получить список участников */
export function getParticipants(): Participant[] {
  if (!activeRoom) return [];
  return [activeRoom.localParticipant, ...Array.from(activeRoom.remoteParticipants.values())];
}

/** Проверить состояние подключения */
export function isConnected(): boolean {
  return activeRoom?.state === ConnectionState.Connected;
}

/** Получить local participant */
export function getLocalParticipant(): LocalParticipant | null {
  return activeRoom?.localParticipant ?? null;
}
