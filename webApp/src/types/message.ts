// ==================== Типы сообщений (расширено из MAX паттернов) ====================

export type MessageType = 'text' | 'image' | 'file' | 'voice' | 'video' | 'audio' | 'location' | 'contact' | 'sticker' | 'system';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

// ==================== Discriminated Union для вложений (8 типов из MAX) ====================

export interface ImageAttachment {
  type: 'image';
  id: string;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  fileSize: number;
  mimeType: string;
  fileName: string;
}

export interface VideoAttachment {
  type: 'video';
  id: string;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
  fileSize: number;
  mimeType: string;
  fileName: string;
}

export interface AudioAttachment {
  type: 'audio';
  id: string;
  url: string;
  duration?: number;
  fileSize: number;
  mimeType: string;
  fileName: string;
}

export interface VoiceAttachment {
  type: 'voice';
  id: string;
  url: string;
  duration?: number;
  fileSize: number;
  mimeType: string;
  fileName: string;
}

export interface FileAttachment {
  type: 'file';
  id: string;
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface StickerAttachment {
  type: 'sticker';
  id: string;
  url: string;
  code: string;
  width: number;
  height: number;
}

export interface ContactAttachment {
  type: 'contact';
  id: string;
  name: string;
  phone?: string;
  userId?: string;
}

export interface LocationAttachment {
  type: 'location';
  id: string;
  latitude: number;
  longitude: number;
  address?: string;
}

export interface ShareAttachment {
  type: 'share';
  id: string;
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
}

/** Discriminated union — тип определяет доступные поля */
export type Attachment =
  | ImageAttachment
  | VideoAttachment
  | AudioAttachment
  | VoiceAttachment
  | FileAttachment
  | StickerAttachment
  | ContactAttachment
  | LocationAttachment
  | ShareAttachment;

// Обратная совместимость: простой тип вложения для legacy кода
export type AttachmentType = Attachment['type'];

// ==================== Inline Keyboard (7 типов кнопок из MAX) ====================

export interface CallbackButton {
  type: 'callback';
  text: string;
  payload: string;
  intent?: 'default' | 'positive' | 'negative';
}

export interface LinkButton {
  type: 'link';
  text: string;
  url: string;
}

export interface RequestContactButton {
  type: 'request_contact';
  text: string;
}

export interface RequestLocationButton {
  type: 'request_location';
  text: string;
  quick?: boolean;
}

export interface ChatButton {
  type: 'chat';
  text: string;
  chatTitle: string;
  chatDescription?: string;
}

export interface OpenAppButton {
  type: 'open_app';
  text: string;
  url: string;
  payload?: string;
}

export interface ClipboardButton {
  type: 'clipboard';
  text: string;
  payload: string;
}

export type InlineButton =
  | CallbackButton
  | LinkButton
  | RequestContactButton
  | RequestLocationButton
  | ChatButton
  | OpenAppButton
  | ClipboardButton;

export interface InlineKeyboard {
  buttons: InlineButton[][];
}

// ==================== Linked Message (reply/forward) ====================

export type MessageLinkType = 'reply' | 'forward';

export interface LinkedMessage {
  type: MessageLinkType;
  messageId: string;
  senderId?: string;
  senderName?: string;
  chatId?: string;
  chatName?: string;
  preview: string;
}

// ==================== Markup / Форматирование ====================

export interface UserMentionMarkup {
  type: 'user_mention';
  from: number;
  length: number;
  userId: string;
}

export interface BoldMarkup {
  type: 'bold';
  from: number;
  length: number;
}

export interface ItalicMarkup {
  type: 'italic';
  from: number;
  length: number;
}

export interface CodeMarkup {
  type: 'code';
  from: number;
  length: number;
}

export interface LinkMarkup {
  type: 'link';
  from: number;
  length: number;
  url: string;
}

export type MarkupElement =
  | UserMentionMarkup
  | BoldMarkup
  | ItalicMarkup
  | CodeMarkup
  | LinkMarkup;

// ==================== Message ====================

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  content: string;
  type: MessageType;
  status: MessageStatus;

  /** Связанное сообщение (reply или forward) */
  replyTo?: LinkedMessage;
  /** P2.3: Forward — обратная совместимость */
  forwardedFromId?: string;
  forwardedFromChatName?: string;
  forwardedFromSenderName?: string;

  reactions: Record<string, string[]>;
  attachment?: Attachment;
  /** Inline клавиатура (для ботов) */
  inlineKeyboard?: InlineKeyboard;
  /** Форматирование текста */
  markup?: MarkupElement[];

  /** P2.6: @mentions */
  mentionedUserIds?: string[];

  /** Самоуничтожение */
  selfDestructAt?: string;
  isDestroyed: boolean;

  /** Статистика (для каналов) */
  views?: number;

  createdAt: string;
  editedAt?: string;
  deliveredAt?: string;
  readAt?: string;
}
