"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Loader2, Paperclip, Send, X } from "lucide-react";
import { Alert } from "@/components/ui/feedback";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { useRealtime } from "@/features/realtime/use-realtime";
import type { Conversation } from "@/features/messaging/types";
import { compressImage } from "@/lib/image-compress";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

function fileUrl(key: string): string {
  return `/api/files/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export function MessageThread({
  taskId,
  initial,
}: {
  taskId: string;
  initial: Conversation;
}) {
  const [conversation, setConversation] = useState<Conversation>(initial);
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const lastCountRef = useRef(initial.messages.length);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/tasks/${taskId}/messages`, { cache: "no-store" });
      if (!response.ok) return;
      const data = (await response.json()) as Conversation;
      setConversation(data);
    } catch {
      // keep the existing transcript
    }
  }, [taskId]);

  const { status } = useRealtime({
    onEvent: (event) => {
      if (event.type === "message.created" && event.payload?.taskId === taskId) {
        void refresh();
      }
    },
    onPoll: refresh,
    pollMs: 6_000,
  });

  useEffect(() => {
    if (conversation.messages.length !== lastCountRef.current) {
      lastCountRef.current = conversation.messages.length;
      const node = listRef.current;
      if (node) node.scrollTop = node.scrollHeight;
    }
  }, [conversation.messages.length]);

  useEffect(() => {
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, []);

  const send = async () => {
    if (sending) return;
    if (!body.trim() && !file) return;
    if (!navigator.onLine) {
      setError("You are offline. Reconnect to send messages.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      let payloadFile: File | null = file;
      if (payloadFile && payloadFile.type.startsWith("image/")) {
        payloadFile = await compressImage(payloadFile, 1400, 0.8);
      }
      const formData = new FormData();
      formData.set("body", body.trim());
      if (payloadFile) formData.set("file", payloadFile);
      const response = await fetch(`/api/v1/tasks/${taskId}/messages`, {
        method: "POST",
        body: formData,
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not send the message");
      setBody("");
      setFile(null);
      await refresh();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Could not send the message");
    } finally {
      setSending(false);
    }
  };

  const otherReadAt = conversation.reads.find(
    (read) => read.userId !== conversation.currentUserId,
  )?.lastReadAt;
  const otherReadTime = otherReadAt ? new Date(otherReadAt).getTime() : 0;
  const lastOwn = [...conversation.messages].reverse().find(
    (message) => message.senderId === conversation.currentUserId,
  );

  return (
    <div className="flex flex-col">
      <div className="mb-2.5 flex justify-end gap-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span
            className={cn(
              "size-1.5 rounded-full",
              status === "open" ? "bg-success" : "bg-warning",
            )}
            aria-hidden
          />
          {status === "open" ? "Live" : status === "polling" ? "Polling" : "Connecting…"}
        </span>
      </div>

      {error ? (
        <Alert variant="error" className="mb-2">
          {error}
        </Alert>
      ) : null}

      <div
        ref={listRef}
        className="max-h-[26rem] min-h-40 space-y-3 overflow-y-auto rounded-2xl border border-border/80 bg-muted/25 p-3"
        aria-live="polite"
        aria-label="Task messages"
      >
        {conversation.messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No messages yet. Say hello or share an update.
          </p>
        ) : (
          conversation.messages.map((message) => {
            const mine = message.senderId === conversation.currentUserId;
            return (
              <div key={message.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-[0_1px_2px_rgb(18_26_22/0.05)]",
                    mine
                      ? "rounded-br-md bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_6px_14px_-10px_rgb(13_95_76/0.7)]"
                      : "rounded-bl-md border border-border/85 bg-card",
                  )}
                >
                  {!mine ? (
                    <p className="mb-0.5 text-[11px] font-semibold opacity-80">
                      {message.senderName}
                    </p>
                  ) : null}
                  {message.body ? <p className="whitespace-pre-wrap break-words">{message.body}</p> : null}
                  {message.attachments.map((attachment) =>
                    attachment.mime.startsWith("image/") ? (
                      <a
                        key={attachment.key}
                        href={fileUrl(attachment.key)}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 block overflow-hidden rounded-lg"
                      >
                        <img
                          src={fileUrl(attachment.key)}
                          alt={attachment.name}
                          loading="lazy"
                          className="max-h-56 w-full object-cover"
                        />
                      </a>
                    ) : (
                      <a
                        key={attachment.key}
                        href={fileUrl(attachment.key)}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block underline"
                      >
                        {attachment.name}
                      </a>
                    ),
                  )}
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground" suppressHydrationWarning>
                  {formatRelative(message.createdAt)}
                  {mine && message.id === lastOwn?.id ? (
                    <span className="ml-1">
                      {otherReadTime >= new Date(message.createdAt).getTime() ? "· Read" : "· Sent"}
                    </span>
                  ) : null}
                </p>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-3 space-y-2">
        {file ? (
          <div className="flex items-center gap-2 rounded-lg bg-muted px-2 py-1 text-xs">
            {file.type.startsWith("image/") ? (
              <ImageIcon className="size-3.5" aria-hidden />
            ) : (
              <Paperclip className="size-3.5" aria-hidden />
            )}
            <span className="min-w-0 flex-1 truncate">{file.name}</span>
            <button
              type="button"
              aria-label="Remove attachment"
              onClick={() => setFile(null)}
              className="rounded p-1 hover:bg-background"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        ) : null}
        <div className="flex items-end gap-2">
          <label
            className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border border-input/80 bg-card text-muted-foreground transition-colors hover:bg-muted"
            title="Attach a photo"
          >
            <Paperclip className="size-4" aria-hidden />
            <span className="sr-only">Attach a photo</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                event.target.value = "";
              }}
            />
          </label>
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            rows={1}
            placeholder="Write a message…"
            className="min-h-11 max-h-32 flex-1 resize-none py-2.5"
            aria-label="Message"
          />
          <Button
            type="button"
            onClick={send}
            disabled={sending || (!body.trim() && !file)}
            size="icon"
            aria-label="Send message"
            className="shrink-0"
          >
            {sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
          </Button>
        </div>
      </div>
    </div>
  );
}
