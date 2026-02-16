"use client";

import { memo, useRef, type RefObject } from "react";
import Markdown from "react-markdown";
import { ChatInput } from "./chat-input";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatPanelProps {
  messages: DisplayMessage[];
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  handleSubmit: (e: React.FormEvent) => void;
  scrollAreaRef: RefObject<HTMLDivElement>;
  placeholder?: string;
}

/**
 * Chat panel with message list and input. Generic placeholder.
 */
export function ChatPanel({
  messages,
  input,
  setInput,
  isLoading,
  handleSubmit,
  scrollAreaRef,
  placeholder = "Type a message...",
}: ChatPanelProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col font-mono">
      <div ref={scrollAreaRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-[1344px] space-y-4">
          {messages.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-sm text-muted-foreground">
                Send a message to start the conversation.
              </p>
            </div>
          ) : null}

          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} />
          ))}

          {isLoading && messages.at(-1)?.role !== "assistant" ? (
            <div className="flex gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm">
                …
              </div>
              <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
                <span className="size-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:0ms]" />
                <span className="size-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:150ms]" />
                <span className="size-2 animate-bounce rounded-full bg-muted-foreground/40 [animation-delay:300ms]" />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <ChatInput
        handleSubmit={handleSubmit}
        input={input}
        isLoading={isLoading}
        placeholder={placeholder}
        setInput={setInput}
      />
    </div>
  );
}

function CopyAndDownload({ content }: { content: string }) {
  const handleCopy = () => {
    void navigator.clipboard.writeText(content);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "result.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-2 flex gap-2">
      <button
        type="button"
        className="text-xs underline text-muted-foreground hover:text-foreground"
        onClick={handleCopy}
      >
        Copy
      </button>
      <button
        type="button"
        className="text-xs underline text-muted-foreground hover:text-foreground"
        onClick={handleDownload}
      >
        Download CSV
      </button>
    </div>
  );
}

const ChatMessage = memo(function ChatMessage({ message }: { message: DisplayMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm ${
          isUser ? "bg-muted" : "bg-muted"
        }`}
      >
        {isUser ? "👤" : "🤖"}
      </div>

      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "rounded-tr-sm bg-primary text-primary-foreground"
            : "rounded-tl-sm bg-muted text-foreground"
        }`}
      >
        {isUser ? (
          <span className="whitespace-pre-wrap">{message.content}</span>
        ) : (
          <>
            <div className="prose-chat prose-sm dark:prose-invert">
              <Markdown>{message.content}</Markdown>
            </div>
            <CopyAndDownload content={message.content} />
          </>
        )}
      </div>
    </div>
  );
});
