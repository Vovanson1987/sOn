/**
 * WebRTC модуль для аудио/видео звонков.
 * Использует RTCPeerConnection + STUN/TURN серверы.
 */

import { sendWS } from '@/api/client';

/** Конфигурация ICE серверов */
const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: ['turn:chat.sonchat.uk:3478', 'turns:chat.sonchat.uk:5349'],
      username: 'son',
      credential: 'son-turn-2026',
    },
  ],
};

/** Состояние звонка */
export interface CallSession {
  peerConnection: RTCPeerConnection;
  localStream: MediaStream | null;
  remoteStream: MediaStream;
  chatId: string;
  targetUserId: string;
  isVideo: boolean;
}

let activeSession: CallSession | null = null;
let callEventListeners: Array<(event: string, data: unknown) => void> = [];

/** Подписаться на события звонка */
export function onCallEvent(cb: (event: string, data: unknown) => void): () => void {
  callEventListeners.push(cb);
  return () => { callEventListeners = callEventListeners.filter((f) => f !== cb); };
}

function emitCallEvent(event: string, data: unknown = {}) {
  callEventListeners.forEach((cb) => cb(event, data));
}

/** Получить медиапоток (микрофон + камера) */
async function getMediaStream(isVideo: boolean): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: true,
    video: isVideo ? { width: 1280, height: 720, facingMode: 'user' } : false,
  });
}

/** Создать RTCPeerConnection */
function createPeerConnection(chatId: string, targetUserId: string): RTCPeerConnection {
  const pc = new RTCPeerConnection(ICE_CONFIG);

  // Отправлять ICE candidates через WebSocket
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      sendWS({
        type: 'ice_candidate',
        target_user_id: targetUserId,
        chat_id: chatId,
        candidate: event.candidate.toJSON(),
      });
    }
  };

  // Получение удалённого потока
  pc.ontrack = (event) => {
    if (activeSession) {
      event.streams[0].getTracks().forEach((track) => {
        activeSession!.remoteStream.addTrack(track);
      });
      emitCallEvent('remote_stream', { stream: activeSession.remoteStream });
    }
  };

  // Изменение состояния соединения
  pc.onconnectionstatechange = () => {
    emitCallEvent('connection_state', { state: pc.connectionState });
    if (pc.connectionState === 'connected') {
      emitCallEvent('call_connected', {});
    } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
      endCall();
    }
  };

  return pc;
}

/** Начать исходящий звонок */
export async function startCall(chatId: string, targetUserId: string, isVideo: boolean): Promise<void> {
  if (activeSession) endCall();

  const localStream = await getMediaStream(isVideo);
  const pc = createPeerConnection(chatId, targetUserId);
  const remoteStream = new MediaStream();

  // Добавить локальные треки в PeerConnection
  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  activeSession = { peerConnection: pc, localStream, remoteStream, chatId, targetUserId, isVideo };

  // Создать SDP offer
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  // Отправить offer через WebSocket
  sendWS({
    type: 'call_offer',
    target_user_id: targetUserId,
    chat_id: chatId,
    sdp: offer,
    is_video: isVideo,
  });

  emitCallEvent('call_started', { localStream, isVideo });
}

/** Принять входящий звонок */
export async function acceptCall(chatId: string, callerUserId: string, offer: RTCSessionDescriptionInit, isVideo: boolean): Promise<void> {
  if (activeSession) endCall();

  const localStream = await getMediaStream(isVideo);
  const pc = createPeerConnection(chatId, callerUserId);
  const remoteStream = new MediaStream();

  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  activeSession = { peerConnection: pc, localStream, remoteStream, chatId, targetUserId: callerUserId, isVideo };

  // Установить удалённый SDP offer
  await pc.setRemoteDescription(new RTCSessionDescription(offer));

  // Создать SDP answer
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  // Отправить answer через WebSocket
  sendWS({
    type: 'call_answer',
    target_user_id: callerUserId,
    chat_id: chatId,
    sdp: answer,
  });

  emitCallEvent('call_accepted', { localStream, isVideo });
}

/** Завершить звонок */
export function endCall(): void {
  if (!activeSession) return;

  // Уведомить собеседника
  sendWS({
    type: 'call_end',
    target_user_id: activeSession.targetUserId,
    chat_id: activeSession.chatId,
    reason: 'ended',
  });

  // Остановить все треки
  activeSession.localStream?.getTracks().forEach((t) => t.stop());
  activeSession.peerConnection.close();
  activeSession = null;

  emitCallEvent('call_ended', {});
}

/** Отклонить входящий звонок */
export function rejectCall(callerUserId: string, chatId: string): void {
  sendWS({
    type: 'call_reject',
    target_user_id: callerUserId,
    chat_id: chatId,
  });
  emitCallEvent('call_rejected', {});
}

/** Переключить микрофон */
export function toggleMic(): boolean {
  if (!activeSession?.localStream) return false;
  const audioTrack = activeSession.localStream.getAudioTracks()[0];
  if (audioTrack) {
    audioTrack.enabled = !audioTrack.enabled;
    return audioTrack.enabled;
  }
  return false;
}

/** Переключить камеру */
export function toggleCamera(): boolean {
  if (!activeSession?.localStream) return false;
  const videoTrack = activeSession.localStream.getVideoTracks()[0];
  if (videoTrack) {
    videoTrack.enabled = !videoTrack.enabled;
    return videoTrack.enabled;
  }
  return false;
}

/** Обработать входящие WebRTC события (вызывать при получении WS-сообщений) */
export async function handleSignaling(data: Record<string, unknown>): Promise<void> {
  switch (data.type) {
    case 'call_answer': {
      if (!activeSession) return;
      const sdp = data.sdp as RTCSessionDescriptionInit;
      await activeSession.peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
      break;
    }
    case 'ice_candidate': {
      if (!activeSession) return;
      const candidate = data.candidate as RTCIceCandidateInit;
      await activeSession.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      break;
    }
    case 'call_end':
    case 'call_reject': {
      if (activeSession) {
        activeSession.localStream?.getTracks().forEach((t) => t.stop());
        activeSession.peerConnection.close();
        activeSession = null;
      }
      emitCallEvent(data.type as string, data);
      break;
    }
  }
}

/** Получить активную сессию */
export function getActiveSession(): CallSession | null {
  return activeSession;
}
