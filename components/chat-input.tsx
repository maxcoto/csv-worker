"use client";

import { useCallback, useRef } from "react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  handleSubmit: (e: React.FormEvent) => void;
  placeholder?: string;
}

/**
 * Simple text input and submit for chat. No math or phase-specific UI.
 */
export function ChatInput({
  input,
  setInput,
  isLoading,
  handleSubmit,
  placeholder = "Type a message...",
}: ChatInputProps) {
  const formRef = useRef<HTMLFormElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!isLoading && input.trim()) {
          formRef.current?.requestSubmit();
        }
      }
    },
    [isLoading, input]
  );

  return (
    <form
      ref={formRef}
      className="flex gap-2 border-t border-border bg-background p-4"
      onSubmit={handleSubmit}
    >
      <Textarea
        aria-label="Message"
        className="min-h-[44px] max-h-[200px] resize-none"
        disabled={isLoading}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      <Button
        className="shrink-0"
        disabled={isLoading || !input.trim()}
        type="submit"
      >
        {isLoading ? "..." : "Send"}
      </Button>
    </form>
  );
}
