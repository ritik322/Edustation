import { useState, useEffect } from "react";
import io from "socket.io-client";
import { PaperAirplaneIcon } from "@heroicons/react/24/solid";

const socket = io("http://localhost:3001");

const ChatRoom = ({ username, room }) => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    socket.emit("join-room", { roomCode: room });

    socket.on("chat-history", (history) => {
      setMessages(history);
    });

    socket.on("receive-message", (data) => {
      setMessages((prev) => [...prev, data]);
    });

    return () => {
      socket.off("chat-history");
      socket.off("receive-message");
    };
  }, [room]);

  const sendMessage = () => {
    if (message.trim() !== "") {
      const newMessage = {
        username,
        text: message,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      socket.emit("send-message", { roomCode: room, message: newMessage });

      setMessages((prev) => [...prev, newMessage]);

      setMessage("");
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-blue-600 text-lg font-semibold p-4 text-center shadow-md">
        <span className="text-white font-bold">Room ID: {room}</span>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 mb-20">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.username === username ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`p-3 max-w-xs md:max-w-md lg:max-w-lg rounded-lg shadow-md ${
                msg.username === username
                  ? "bg-blue-500 text-white self-end"
                  : "bg-gray-300 text-black self-start"
              }`}
            >
              <p className="text-sm font-semibold">{msg.username}</p>
              <p className="text-md">{msg.text}</p>
              <p className="text-xs text-gray-600 text-right">{msg.time}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Typing Bar */}
      <div className="fixed bottom-0 left-0 w-full bg-white p-4 flex items-center shadow-md">
        <input
          type="text"
          placeholder="Type a message..."
          className="flex-1 p-3 text-black border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button
          onClick={sendMessage}
          className="ml-3 bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 transition"
        >
          <PaperAirplaneIcon className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
};

export default ChatRoom;