const io = require("socket.io")(8900, {
    cors: {
        origin: ["http://localhost:3000", "https://beyinc-frontend.onrender.com", "https://www.beyinc.org", "https://beyinc-frontend.vercel.app", "https://yellow-mushroom-0aec0e610.2.azurestaticapps.net",'https://www.bloomr.world'],
    },
});

let users = [];

const addUser = (userId, socketId) => {
    // !users.some((user) => user.userId === userId) &&
    users.push({ userId, socketId });
};

const removeUser = (socketId) => {
    users = users.filter((user) => user.socketId !== socketId);
};

const getUser = (userId) => {
    return users.filter((user) => user.userId === userId);
};

io.on("connection", (socket) => {
    //when ceonnect
    console.log("a user connected.");

    //take userId and socketId from user
    socket.on("addUser", (userId) => {
        addUser(userId, socket.id);
        io.emit("getUsers", users);
    });

    //send and get message
    socket.on("sendMessage", ({ senderId, receiverId, message, fileSent, conversationId, file }) => {
        const user = getUser(receiverId);
        console.log(senderId);
        console.log(user);
        console.log(receiverId);
        console.log(fileSent);
        console.log(conversationId);
        for (let i = 0; i < user.length; i++) {
            io.to(user[i]?.socketId).emit("getMessage", {
                senderId,
                message,
                fileSent,
                conversationId, file
            });
        }

    });


    socket.on("logoutAll", ({ userId }) => {
        const user = getUser(userId);
        for (let i = 0; i < user.length; i++) {
            io.to(user[i]?.socketId).emit("allDeviceLogout", "logout");
        }

    });


    socket.on("seenMessage", ({ senderId, receiverId, conversationId }) => {
        const user = getUser(receiverId);
        console.log(senderId);
        console.log(receiverId);
        console.log({ message: 'seen just now' });
        console.log(user?.socketId);
        for (let i = 0; i < user.length; i++) {
            io.to(user[i]?.socketId).emit("sendseenMessage", {
                senderId, receiverId,
                conversationId,
                message: 'seen just now'
            });
        }
    });


    socket.on("chatBlocking", ({ senderId, receiverId }) => {
        const user = getUser(receiverId);
        for (let i = 0; i < user.length; i++) {
            io.to(user[i]?.socketId).emit("sendchatBlockingInfo", {
                senderId, receiverId,
            });
        }
    });


    socket.on("sendNotification", ({ senderId, receiverId }) => {
        const user = getUser(receiverId);
        console.log(user);
        console.log(receiverId);
        for (let i = 0; i < user.length; i++) {
            io.to(user[i]?.socketId).emit("getNotification", {
                senderId
            });
        }
    });
    socket.on("sendFollowerNotification", ({ senderId, receiverId, type, image, role, _id, userName }) => {
        const user = getUser(receiverId);
        if (type == 'adding') {
            io.to(user[0]?.socketId).emit("getFollowerNotification", {
                image, role, _id, userName, type
            });
        } else {
            io.to(user[0]?.socketId).emit("getFollowerNotification", {
                _id, type
            });
        }

    });


    //LiveChat on post page
    // Join post chat room
    socket.on("joinPostChat", ({ postId }) => {
        socket.join(`post-chat-${postId}`);
        console.log(`User ${socket.id} joined post chat: ${postId}`);
    });

    socket.on("sendPostChatMessage", (messageData) => {
        const { postId,  message, } = messageData;
        console.log("Broadcasting message:", message);
        
        // Broadcast to all users in the post chat room
        socket.to(`post-chat-${postId}`).emit("newPostChatMessage", messageData);
        
        // Also emit back to sender for confirmation
        socket.emit("newPostChatMessage", messageData);
        
        console.log(`Message broadcasted in post ${postId}: ${message}`);
    });

    // Leave post chat room
    socket.on("leavePostChat", ({ postId }) => {
        socket.leave(`post-chat-${postId}`);
        console.log(`User ${socket.id} left post chat: ${postId}`);
    });
    
    socket.on("disconnect", () => {
        console.log("a user disconnected!");
        removeUser(socket.id);
        io.emit("getUsers", users);
    });
});
