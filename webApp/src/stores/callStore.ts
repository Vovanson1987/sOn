import { create } from 'zustand';

export type CallStatus = 'idle' | 'ringing' | 'connecting' | 'active' | 'ended';

export interface CallState {
  chatId: string;
  contactName: string;
  contactAvatar?: string;
  isVideo: boolean;
  isIncoming: boolean;
  status: CallStatus;
  isMicMuted: boolean;
  isCameraOn: boolean;
  isSpeakerOn: boolean;
  startedAt: number | null;
}

interface CallStore {
  activeCall: CallState | null;

  /** Начать исходящий звонок */
  startCall: (chatId: string, contactName: string, isVideo: boolean, contactAvatar?: string) => void;
  /** Имитация входящего звонка */
  incomingCall: (chatId: string, contactName: string, isVideo: boolean, contactAvatar?: string) => void;
  /** Принять звонок */
  acceptCall: () => void;
  /** Завершить звонок */
  endCall: () => void;
  /** Переключить микрофон */
  toggleMic: () => void;
  /** Переключить камеру */
  toggleCamera: () => void;
  /** Переключить динамик */
  toggleSpeaker: () => void;
}

export const useCallStore = create<CallStore>((set) => ({
  activeCall: null,

  startCall: (chatId, contactName, isVideo, contactAvatar) => {
    set({
      activeCall: {
        chatId,
        contactName,
        contactAvatar,
        isVideo,
        isIncoming: false,
        status: 'ringing',
        isMicMuted: false,
        isCameraOn: isVideo,
        isSpeakerOn: false,
        startedAt: null,
      },
    });
    // Имитация: через 2.5с переходит в active
    setTimeout(() => {
      set((s) => {
        if (!s.activeCall || s.activeCall.status === 'ended') return s;
        return { activeCall: { ...s.activeCall, status: 'active', startedAt: Date.now() } };
      });
    }, 2500);
  },

  incomingCall: (chatId, contactName, isVideo, contactAvatar) => {
    set({
      activeCall: {
        chatId,
        contactName,
        contactAvatar,
        isVideo,
        isIncoming: true,
        status: 'ringing',
        isMicMuted: false,
        isCameraOn: isVideo,
        isSpeakerOn: false,
        startedAt: null,
      },
    });
  },

  acceptCall: () => {
    set((s) => {
      if (!s.activeCall) return s;
      return { activeCall: { ...s.activeCall, status: 'active', startedAt: Date.now() } };
    });
  },

  endCall: () => {
    set((s) => {
      if (!s.activeCall) return s;
      return { activeCall: { ...s.activeCall, status: 'ended' } };
    });
    // Убираем через 500мс
    setTimeout(() => set({ activeCall: null }), 500);
  },

  toggleMic: () =>
    set((s) => s.activeCall ? { activeCall: { ...s.activeCall, isMicMuted: !s.activeCall.isMicMuted } } : s),
  toggleCamera: () =>
    set((s) => s.activeCall ? { activeCall: { ...s.activeCall, isCameraOn: !s.activeCall.isCameraOn } } : s),
  toggleSpeaker: () =>
    set((s) => s.activeCall ? { activeCall: { ...s.activeCall, isSpeakerOn: !s.activeCall.isSpeakerOn } } : s),
}));
