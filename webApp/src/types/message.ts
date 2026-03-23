export type MessageType = 'text' | 'image' | 'file' | 'voice' | 'location' | 'system';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Attachment {
  id: string;
  type: 'image' | 'video' | 'audio' | 'file' | 'voice' | 'location';
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
  latitude?: number;
  longitude?: number;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  content: string;
  type: MessageType;
  status: MessageStatus;
  replyTo?: {
    id: string;
    senderName: string;
    preview: string;
  };
  reactions: Record<string, string[]>;
  attachment?: Attachment;
  selfDestructAt?: string;
  isDestroyed: boolean;
  createdAt: string;
  editedAt?: string;
  deliveredAt?: string;
  readAt?: string;
}
