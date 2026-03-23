import { create } from 'zustand';
import {
  startCall as webrtcStartCall,
  acceptCall as webrtcAcceptCall,
  endCall as webrtcEndCall,
  toggleMic as webrtcToggleMic,
  toggleCamera as webrtcToggleCamera,
  onCallEvent,
} from '@/utils/webrtc';

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
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  targetUserId: string;
  incomingOffer?: RTCSessionDescriptionInit;
}

interface CallStore {
  activeCall: CallState | null;

  /** Начать исходящий звонок */
  startCall: (chatId: string, contactName: string, isVideo: boolean, targetUserId: string, contactAvatar?: string) => void;
  /** Входящий звонок */
  incomingCall: (chatId: string, contactName: string, isVideo: boolean, callerUserId: string, offer: RTCSessionDescriptionInit, contactAvatar?: string) => void;
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

export const useCallStore = create<CallStore>((set, get) => ({
  activeCall: null,

  startCall: (chatId, contactName, isVideo, targetUserId, contactAvatar) => {
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
        localStream: null,
        remoteStream: null,
        targetUserId,
      },
    });

    webrtcStartCall(chatId, targetUserId, isVideo).catch((err) => {
      console.error('[callStore] webrtcStartCall failed:', err);
      set((s) => {
        if (!s.activeCall) return s;
        return { activeCall: { ...s.activeCall, status: 'ended' } };
      });
      setTimeout(() => set({ activeCall: null }), 500);
    });
  },

  incomingCall: (chatId, contactName, isVideo, callerUserId, offer, contactAvatar) => {
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
        localStream: null,
        remoteStream: null,
        targetUserId: callerUserId,
        incomingOffer: offer,
      },
    });
  },

  acceptCall: () => {
    const call = get().activeCall;
    if (!call || !call.incomingOffer) return;

    set((s) => {
      if (!s.activeCall) return s;
      return { activeCall: { ...s.activeCall, status: 'connecting' } };
    });

    webrtcAcceptCall(call.chatId, call.targetUserId, call.incomingOffer, call.isVideo).catch((err) => {
      console.error('[callStore] webrtcAcceptCall failed:', err);
      set((s) => {
        if (!s.activeCall) return s;
        return { activeCall: { ...s.activeCall, status: 'ended' } };
      });
      setTimeout(() => set({ activeCall: null }), 500);
    });
  },

  endCall: () => {
    webrtcEndCall();
    set((s) => {
      if (!s.activeCall) return s;
      return {
        activeCall: {
          ...s.activeCall,
          status: 'ended',
          localStream: null,
          remoteStream: null,
        },
      };
    });
    setTimeout(() => set({ activeCall: null }), 500);
  },

  toggleMic: () => {
    const enabled = webrtcToggleMic();
    set((s) => {
      if (!s.activeCall) return s;
      return { activeCall: { ...s.activeCall, isMicMuted: !enabled } };
    });
  },

  toggleCamera: () => {
    const enabled = webrtcToggleCamera();
    set((s) => {
      if (!s.activeCall) return s;
      return { activeCall: { ...s.activeCall, isCameraOn: enabled } };
    });
  },

  toggleSpeaker: () =>
    set((s) =>
      s.activeCall ? { activeCall: { ...s.activeCall, isSpeakerOn: !s.activeCall.isSpeakerOn } } : s,
    ),
}));

/** Subscribe to WebRTC events and update the store accordingly */
function initCallEventListener() {
  onCallEvent((event: string, data: unknown) => {
    const payload = data as Record<string, unknown>;

    switch (event) {
      case 'call_started': {
        const stream = payload.localStream as MediaStream | null;
        useCallStore.setState((s) => {
          if (!s.activeCall) return s;
          return { activeCall: { ...s.activeCall, localStream: stream } };
        });
        break;
      }

      case 'call_accepted': {
        const stream = payload.localStream as MediaStream | null;
        useCallStore.setState((s) => {
          if (!s.activeCall) return s;
          return { activeCall: { ...s.activeCall, localStream: stream } };
        });
        break;
      }

      case 'call_connected': {
        useCallStore.setState((s) => {
          if (!s.activeCall) return s;
          return {
            activeCall: { ...s.activeCall, status: 'active' as CallStatus, startedAt: Date.now() },
          };
        });
        break;
      }

      case 'remote_stream': {
        const stream = payload.stream as MediaStream | null;
        useCallStore.setState((s) => {
          if (!s.activeCall) return s;
          return { activeCall: { ...s.activeCall, remoteStream: stream } };
        });
        break;
      }

      case 'call_ended':
      case 'call_rejected': {
        useCallStore.setState((s) => {
          if (!s.activeCall) return s;
          return {
            activeCall: {
              ...s.activeCall,
              status: 'ended' as CallStatus,
              localStream: null,
              remoteStream: null,
            },
          };
        });
        setTimeout(() => useCallStore.setState({ activeCall: null }), 500);
        break;
      }
    }
  });
}

// Initialize event listener as a module-level side effect
initCallEventListener();
