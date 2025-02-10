const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const fileUrl = `/uploads/${req.file.filename}`;
  res.json({ fileUrl });
});

app.use("/uploads", express.static(uploadDir));

let rooms = {}; // Store messages per room

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", ({ roomCode }) => {
    socket.join(roomCode);
    console.log(`User ${socket.id} joined room ${roomCode}`);

    // Send existing chat history
    if (!rooms[roomCode]) {
      rooms[roomCode] = [];
    }
    socket.emit("chat-history", rooms[roomCode]);
  });

  socket.on("send-message", ({ roomCode, message }) => {
    if (!rooms[roomCode]) {
      rooms[roomCode] = [];
    }
    rooms[roomCode].push(message);

    // Broadcast to all users in the room EXCEPT the sender
    socket.to(roomCode).emit("receive-message", message);
    console.log(`Message sent in room ${roomCode}:`, message);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

server.listen(3001, () => {
  console.log("WebSocket server running on port 3001");
});
