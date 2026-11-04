export type ChatAttachment = {
  key: string;
  name: string;
  mime: string;
  size: number;
};

export type ChatMessage = {
  id: string;
  body: string;
  attachments: ChatAttachment[];
  createdAt: string;
  senderId: string;
  senderName: string;
  senderRole: string;
};

export type ChatRead = {
  userId: string;
  lastReadAt: string;
};

export type Conversation = {
  threadId: string;
  currentUserId: string;
  messages: ChatMessage[];
  reads: ChatRead[];
};
