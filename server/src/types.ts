export type AttachmentKind = 'image' | 'video';
export type EscalationKind = 'none' | 'daughter' | 'volunteer';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface StoredAttachment {
  id: string;
  kind: AttachmentKind;
  name: string;
  mimeType: string;
  size: number;
  note: string;
  previewUrl?: string;
  dataUrl?: string;
}

export interface AssistantContent {
  text: string;
  speakText: string;
  guidanceLabel: string;
  guidanceImageUrl?: string;
  escalation: EscalationKind;
  escalationReason?: string;
  confidence: ConfidenceLevel;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  attachments?: StoredAttachment[];
  assistant?: AssistantContent;
  createdAt: number;
}

export interface Session {
  id: string;
  createdAt: number;
  updatedAt: number;
  messages: ConversationMessage[];
}

export interface SessionPayload {
  sessionId: string;
  messages: ConversationMessage[];
}

export interface ModelResponse {
  answer: string;
  speakText: string;
  guidanceLabel: string;
  escalation: EscalationKind;
  escalationReason?: string;
  confidence: ConfidenceLevel;
  needsImage?: boolean;
  imagePrompt?: string;
}
