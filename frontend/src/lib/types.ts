export type AttachmentKind = 'image' | 'video';
export type EscalationKind = 'none' | 'daughter' | 'volunteer';
export type VoiceState = 'idle' | 'listening' | 'error' | 'unsupported';

export interface StoredAttachment {
  id: string;
  kind: AttachmentKind;
  name: string;
  mimeType: string;
  size: number;
  previewUrl?: string;
  note: string;
}

export interface ComposerAttachment {
  id: string;
  file: File;
  kind: AttachmentKind;
  previewUrl: string;
}

export interface AssistantContent {
  text: string;
  speakText: string;
  guidanceImageUrl?: string;
  escalation: EscalationKind;
  escalationReason?: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  attachments?: StoredAttachment[];
  assistant?: AssistantContent;
  createdAt: number;
  /** Optional sender tag, used to differentiate AI from daughter on assistant role. */
  from?: 'ai' | 'daughter';
}

export interface SessionPayload {
  sessionId: string;
  messages: ConversationMessage[];
}
