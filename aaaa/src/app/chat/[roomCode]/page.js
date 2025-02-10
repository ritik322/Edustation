"use client";

import { useParams, useSearchParams } from "next/navigation";
import ChatRoom from "@/components/ChatRoom";

export default function ChatPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomCode = params?.roomCode;
  const username = searchParams.get("nickname") || "Anonymous"; // Default if not provided

  if (!roomCode) {
    return <div>Loading...</div>; 
  }

  return <ChatRoom room={roomCode} username={username} />;
}