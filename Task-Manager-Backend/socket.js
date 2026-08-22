const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { Project, Task } = require("./models");

let io = null;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: "*",
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("No token provided."));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded; // { id, organization_id, role }
      next();
    } catch (error) {
      next(new Error("Invalid or expired token."));
    }
  });

  io.on("connection", (socket) => {
    // Personal room — used for direct notifications
    socket.join(`user:${socket.user.id}`);

    socket.on("project:join", async (projectId) => {
      try {
        const project = await Project.findOne({
          where: { id: projectId, organization_id: socket.user.organization_id },
        });
        if (project) {
          socket.join(`project:${projectId}`);
        }
      } catch (err) {
        console.error("project:join error:", err.message);
      }
    });

    socket.on("project:leave", (projectId) => {
      socket.leave(`project:${projectId}`);
    });

    socket.on("task:join", async (taskId) => {
      try {
        const task = await Task.findOne({
          where: { id: taskId, organization_id: socket.user.organization_id },
        });
        if (task) {
          socket.join(`task:${taskId}`);
        }
      } catch (err) {
        console.error("task:join error:", err.message);
      }
    });

    socket.on("task:leave", (taskId) => {
      socket.leave(`task:${taskId}`);
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error("Socket.io not initialized. Call initSocket first.");
  }
  return io;
}

module.exports = { initSocket, getIO };
