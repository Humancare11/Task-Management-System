const express = require("express");
const http = require("http");
const cors = require("cors");
const session = require("express-session");
require("dotenv").config();

const { connectDB } = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const organizationRoutes = require("./routes/organizationRoutes");
const passport = require("./config/passport");
const OrganizationInvitation = require("./models/OrganizationInvitation");
const projectRoutes = require("./routes/projectRoutes");
const invitationRoutes = require("./routes/invitationRoutes");
const { initSocket } = require("./socket");
const notificationRoutes = require("./routes/notificationRoutes");
const questionRoutes = require("./routes/questionRoute");
const monitoringRoutes = require("./routes/monitoringRoute");
const activityRoutes = require("./routes/activityRoutes");
const userRoutes = require("./routes/userRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/uploads", require("express").static(require("path").join(__dirname, "uploads")));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "your-secret-key-change-this",
    resave: false,
    saveUninitialized: false,
  }),
);

app.use(passport.initialize());
app.use(passport.session());

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Server is running",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/organization", organizationRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/invitations", invitationRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/monitoring", monitoringRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/users", userRoutes);

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);
initSocket(server);

async function start() {
  await connectDB();

  server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

start();
