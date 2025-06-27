"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

export default function Home() {
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const router = useRouter();

  const enterRoom = (roomId) => {
    if (!nickname.trim()) {
      alert("Please enter a nickname before joining.");
      return;
    }
    router.push(`/chat/${roomId}?nickname=${encodeURIComponent(nickname)}`);
  };

  const createRoom = () => {
    const newRoom = uuidv4();
    enterRoom(newRoom);
  };

  const joinRoom = () => {
    if (roomCode.trim()) {
      enterRoom(roomCode);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-blue-500 to-blue-600">
          <div className="flex justify-center mb-4">
            <div className="bg-white/10 p-3 rounded-full">
              <svg 
                className="w-8 h-8 text-white"
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth="2" 
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white text-center">Study Room</h1>
          <p className="text-blue-100 text-center mt-2">Connect and chat in real-time</p>
        </div>
        <div className="p-4">
        <input
        className="p-2 text-black border rounded-md w-full"
        placeholder="Enter Nickname"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
      />
        </div>
        

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Create Room Section */}
          <div className="space-y-3">
            <button 
              onClick={createRoom}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center space-x-2"
            >
              <span>Create New Room</span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">or join existing</span>
            </div>
          </div>

          {/* Join Room Section */}
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Enter Room Code"
              onChange={(e) => setRoomCode(e.target.value)}
              className="w-full px-4 py-3 text-black rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition duration-200"
            />
            <button
              onClick={joinRoom}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Join Room
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
