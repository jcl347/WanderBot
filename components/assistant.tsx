"use client";
import React, { useEffect } from "react";
import Chat from "./chat";
import useConversationStore from "@/stores/useConversationStore";
import { Item, processMessages } from "@/lib/assistant";

export default function Assistant() {
  const {
    chatMessages,
    addConversationItem,
    addChatMessage,
    setAssistantLoading,
  } = useConversationStore();

  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return;

    const userItem: Item = {
      type: "message",
      role: "user",
      content: [{ type: "input_text", text: message.trim() }],
    };
    const userMessage: any = {
      role: "user",
      content: message.trim(),
    };

    try {
      setAssistantLoading(true);
      addConversationItem(userMessage);
      addChatMessage(userItem);
      await processMessages();
    } catch (error) {
      console.error("Error processing message:", error);
    }
  };

  const handleApprovalResponse = async (approve: boolean, id: string) => {
    const approvalItem = {
      type: "mcp_approval_response",
      approve,
      approval_request_id: id,
    } as any;
    try {
      addConversationItem(approvalItem);
      await processMessages();
    } catch (error) {
      console.error("Error sending approval response:", error);
    }
  };

  // 👇 NEW: listen for PreferencesForm "wander:start" event and kick off chat
  useEffect(() => {
    function handleAutoStart(e: Event) {
      // Support both CustomEvent<any> and plain Event
      const ce = e as CustomEvent<{ prompt?: string }>;
      const text = ce?.detail?.prompt;
      if (!text) return;
      // Reuse the same send path as the chat input
      handleSendMessage(text);
    }

    window.addEventListener("wander:start", handleAutoStart as EventListener);
    return () => {
      window.removeEventListener("wander:start", handleAutoStart as EventListener);
    };
    // handleSendMessage is stable across renders in this component; if yours isn't,
    // add it to dep array (eslint may warn). For safety, include it:
  }, [handleSendMessage]);

  return (
    <div className="h-full p-4 w-full bg-white">
      <Chat
        items={chatMessages}
        onSendMessage={handleSendMessage}
        onApprovalResponse={handleApprovalResponse}
      />
    </div>
  );
}
