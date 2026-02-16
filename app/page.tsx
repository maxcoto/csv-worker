import { ChatInterface } from "@/components/chat-interface";

/**
 * Root page: generic chatbot with sidebar and chat.
 * Session is tracked via cookie (no magic link).
 */
export default function RootPage() {
  return <ChatInterface />;
}
