const io = require("socket.io")(8900, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://beyinc-frontend.onrender.com",
      "https://www.beyinc.org",
      "https://beyinc-frontend.vercel.app",
      "https://beyinc-frontend-dg45.vercel.app",
      "https://yellow-mushroom-0aec0e610.2.azurestaticapps.net",
      "https://www.bloomr.world",
    ],
  },
});

/* =====================================================
   MEMORY STORES
===================================================== */

let users = [];
let quickMatchRooms = {}; // { roomName: [userIds] }

/* =====================================================
   USER HELPERS
===================================================== */

const addUser = (userId, socketId) => {
  users.push({ userId, socketId });
};

const removeUser = (socketId) => {
  users = users.filter((user) => user.socketId !== socketId);
};

const getUser = (userId) => {
  return users.filter((user) => user.userId === userId);
};

/* =====================================================
   CONNECTION
===================================================== */

io.on("connection", (socket) => {
  console.log("✅ a user connected:", socket.id);

  /* ================= DEBUG (VERY USEFUL) ================= */
  socket.onAny((event, ...args) => {
    console.log("EVENT:", event);
  });

  /* =====================================================
     ADD USER (1-1 CHAT SYSTEM)
  ===================================================== */

  socket.on("addUser", (userId) => {
    socket.userId = userId;
    addUser(userId, socket.id);
    io.emit("getUsers", users);
  });

  /* =====================================================
     ONE TO ONE CHAT
  ===================================================== */

  socket.on(
    "sendMessage",
    ({ senderId, receiverId, message, fileSent, conversationId, file }) => {
      const user = getUser(receiverId);

      for (let i = 0; i < user.length; i++) {
        io.to(user[i]?.socketId).emit("getMessage", {
          senderId,
          message,
          fileSent,
          conversationId,
          file,
        });
      }
    }
  );

  socket.on("seenMessage", ({ senderId, receiverId, conversationId }) => {
    const user = getUser(receiverId);

    for (let i = 0; i < user.length; i++) {
      io.to(user[i]?.socketId).emit("sendseenMessage", {
        senderId,
        receiverId,
        conversationId,
        message: "seen just now",
      });
    }
  });

  socket.on("chatBlocking", ({ senderId, receiverId }) => {
    const user = getUser(receiverId);

    for (let i = 0; i < user.length; i++) {
      io.to(user[i]?.socketId).emit("sendchatBlockingInfo", {
        senderId,
        receiverId,
      });
    }
  });

  /* =====================================================
     NOTIFICATIONS
  ===================================================== */

  socket.on("sendNotification", ({ senderId, receiverId }) => {
    const user = getUser(receiverId);

    for (let i = 0; i < user.length; i++) {
      io.to(user[i]?.socketId).emit("getNotification", { senderId });
    }
  });

  socket.on(
    "sendFollowerNotification",
    ({ senderId, receiverId, type, image, role, _id, userName }) => {
      const user = getUser(receiverId);

      if (!user.length) return;

      if (type === "adding") {
        io.to(user[0]?.socketId).emit("getFollowerNotification", {
          image,
          role,
          _id,
          userName,
          type,
        });
      } else {
        io.to(user[0]?.socketId).emit("getFollowerNotification", {
          _id,
          type,
        });
      }
    }
  );

  /* =====================================================
     POST LIVE CHAT
  ===================================================== */

  socket.on("joinPostChat", ({ postId }) => {
    socket.join(`post-chat-${postId}`);
    console.log(`User joined post chat ${postId}`);
  });

  socket.on("sendPostChatMessage", (messageData) => {
    const { postId } = messageData;

    socket
      .to(`post-chat-${postId}`)
      .emit("newPostChatMessage", messageData);

    socket.emit("newPostChatMessage", messageData);
  });

  socket.on("leavePostChat", ({ postId }) => {
    socket.leave(`post-chat-${postId}`);
  });

  /* =====================================================
     QUICK MATCH ROOMS
  ===================================================== */

  // JOIN ROOM
  socket.on("joinQuickMatchRoom", ({ roomId, userId }) => {
    const roomName = `quickmatch-${roomId}`;

    socket.join(roomName);
    socket.userId = userId;

    if (!quickMatchRooms[roomName]) {
      quickMatchRooms[roomName] = [];
    }

    if (!quickMatchRooms[roomName].includes(userId)) {
      quickMatchRooms[roomName].push(userId);
    }

    console.log(`User ${userId} joined ${roomName}`);

    io.to(roomName).emit("roomParticipantsUpdated", {
      roomId,
      participants: quickMatchRooms[roomName],
    });
  });

  // SEND MESSAGE
  socket.on("sendQuickMatchMessage", (data) => {
    const { roomId } = data;
    const roomName = `quickmatch-${roomId}`;

    const messagePayload = {
      ...data,
      createdAt: new Date(),
    };

    io.to(roomName).emit("receiveQuickMatchMessage", messagePayload);
  });

  // TYPING INDICATOR
  socket.on("typingQuickMatch", ({ roomId, userId }) => {
    socket
      .to(`quickmatch-${roomId}`)
      .emit("userTyping", { userId });
  });

  // LEAVE ROOM
  socket.on("leaveQuickMatchRoom", ({ roomId, userId }) => {
    const roomName = `quickmatch-${roomId}`;

    socket.leave(roomName);

    if (quickMatchRooms[roomName]) {
      quickMatchRooms[roomName] =
        quickMatchRooms[roomName].filter((id) => id !== userId);
    }

    io.to(roomName).emit("roomParticipantsUpdated", {
      roomId,
      participants: quickMatchRooms[roomName] || [],
    });

    console.log(`User ${userId} left ${roomName}`);
  });

  /* =====================================================
     DISCONNECT
  ===================================================== */

  socket.on("disconnect", () => {
    console.log("❌ user disconnected:", socket.id);

    removeUser(socket.id);

    // cleanup quickmatch rooms
    Object.keys(quickMatchRooms).forEach((room) => {
      quickMatchRooms[room] =
        quickMatchRooms[room].filter(
          (u) => u !== socket.userId
        );
    });

    io.emit("getUsers", users);
  });
});
