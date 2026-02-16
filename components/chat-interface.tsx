"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChatPanel } from "./chat-panel";
import { FileUpload } from "./file-upload";
import { Sidebar } from "./sidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface PromptOption {
  id: string;
  name: string;
}

const AGENT_IDS = ["default", "analyst", "writer"] as const;
const AGENT_LABELS: Record<string, string> = {
  default: "Default",
  analyst: "Analyst",
  writer: "Writer",
};

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

/**
 * Main chat UI: sidebar + chat panel, file upload, prompt selector.
 * Uses cookie for session. When file + prompt selected, sends data flow and shows CSV result with Copy/Download.
 */
export function ChatInterface() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [agentId, setAgentId] = useState<string>("default");
  const [prompts, setPrompts] = useState<PromptOption[]>([]);
  const [promptId, setPromptId] = useState<string>("");
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    const container = scrollAreaRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/prompts", { credentials: "include" });
        if (res.ok) {
          const data = (await res.json()) as { prompts: PromptOption[] };
          setPrompts(data.prompts ?? []);
          if (data.prompts?.length > 0 && !promptId) {
            setPromptId(data.prompts[0].id);
          }
        }
      } catch {
        // ignore
      }
    };
    load();
  }, []);

  const loadChatHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/chat/history", {
        credentials: "include",
      });

      if (!response.ok) return;

      const data = (await response.json()) as {
        messages: Array<{
          id: string;
          role: string;
          content: string;
        }>;
      };

      if (data.messages.length > 0) {
        setMessages(
          data.messages.map((m) => ({
            id: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
          }))
        );
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
    }
  }, []);

  const sendMessage = useCallback(
    async (messageText: string) => {
      if (isLoading) return;

      const trimmed = messageText.trim();
      if (!trimmed) return;

      const useDataFlow = fileContent && promptId;

      setIsLoading(true);

      const userMsg: DisplayMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: useDataFlow
          ? `[${promptId}] ${trimmed} (with ${fileName ?? "file"})`
          : trimmed,
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        const body: {
          message: string;
          agentId?: string;
          promptId?: string;
          attachment?: { type: "csv"; content: string; filename?: string };
        } = {
          message: trimmed,
        };

        if (useDataFlow) {
          body.promptId = promptId;
          body.attachment = {
            type: "csv",
            content: fileContent,
            filename: fileName ?? undefined,
          };
        } else {
          if (agentId !== "default") body.agentId = agentId;
        }

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(
            (errorData as { error?: string })?.error ?? "Request failed"
          );
        }

        const contentType = response.headers.get("content-type") ?? "";

        if (contentType.includes("application/json")) {
          const data = (await response.json()) as { result?: string };
          const resultText = data.result ?? "";
          const assistantMsg: DisplayMessage = {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: resultText,
          };
          setMessages((prev) => [...prev, assistantMsg]);
        } else {
          const reader = response.body?.getReader();
          if (!reader) throw new Error("No response body");

          const assistantMsgId = `assistant-${Date.now()}`;
          let fullContent = "";

          setMessages((prev) => [
            ...prev,
            { id: assistantMsgId, role: "assistant", content: "" },
          ]);

          const decoder = new TextDecoder();
          let done = false;

          while (!done) {
            const readResult = await reader.read();
            done = readResult.done;
            if (readResult.value) {
              const chunk = decoder.decode(readResult.value, { stream: true });
              const lines = chunk.split("\n");
              for (const line of lines) {
                if (line.startsWith("0:")) {
                  try {
                    const text = JSON.parse(line.slice(2));
                    if (typeof text === "string") fullContent += text;
                  } catch {
                    // skip
                  }
                }
              }
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, content: fullContent }
                    : msg
                )
              );
            }
          }
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        toast.error(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, agentId, promptId, fileContent, fileName]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      sendMessage(input);
      setInput("");
    },
    [input, sendMessage]
  );

  useEffect(() => {
    if (initialized) return;
    loadChatHistory();
    setInitialized(true);
  }, [initialized, loadChatHistory]);

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex shrink-0 flex-wrap items-center gap-4 border-b border-border px-4 py-3">
        <button
          aria-label="Toggle sidebar"
          className="md:hidden"
          type="button"
          onClick={() => setSidebarOpen((o) => !o)}
        >
          ☰
        </button>
        <h1 className="text-lg font-semibold">Chat</h1>
        <FileUpload
          fileContent={fileContent}
          fileName={fileName}
          onClear={() => {
            setFileContent(null);
            setFileName(null);
          }}
          onFileRead={(content, name) => {
            setFileContent(content);
            setFileName(name);
          }}
        />
        {prompts.length > 0 ? (
          <Select value={promptId || prompts[0]?.id} onValueChange={setPromptId}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Prompt" />
            </SelectTrigger>
            <SelectContent>
              {prompts.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <Select value={agentId} onValueChange={setAgentId}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Agent" />
          </SelectTrigger>
          <SelectContent>
            {AGENT_IDS.map((id) => (
              <SelectItem key={id} value={id}>
                {AGENT_LABELS[id] ?? id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      <div className="flex min-h-0 flex-1">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <ChatPanel
          handleSubmit={handleSubmit}
          input={input}
          isLoading={isLoading}
          messages={messages}
          scrollAreaRef={scrollAreaRef}
          setInput={setInput}
        />
      </div>
    </div>
  );
}
