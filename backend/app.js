import express from "express";
import helmet from "helmet";

import cookieParser from "cookie-parser";
import cors from "cors";
// import { connectDB } from "./database/db.js";
import authRoutes from "./routes/userRoutes.js";
import userRoutes from "./routes/userroute.js";
import dashboardRoutes from "./routes/dashboard.js";
import { errormiddleware } from "./middleware/errormiddleware.js";
import adminRoutes from "./routes/adminRoutes.js";
import forumRoutes from "./routes/forumRoutes.js";
import progrssRoutes from "./routes/progressRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import leaderboardRoutes from "./routes/leaderboardRoutes.js";
import quizRoutes from "./routes/quizRoutes.js";
import teacherRoutes from "./routes/teacherRoutes.js";
import { isAuthenticated } from "./middleware/authMiddleware.js";
import adminRouter from "./routes/adminRoutes.js"
import adminQuizRouter from "./routes/adminQuizRoutes.js"
import notificationRoutes from "./routes/notificationRoutes.js"


export const app = express();

const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL,
  ...(process.env.FRONTEND_URLS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
].filter(Boolean);

app.use(
  helmet({
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
  })
);

app.use(
  // cors({
  //   origin: true,
  //   methods: ["GET", "POST", "PUT", "DELETE","OPTIONS","PATCH"],
  //   credentials: true,
  // })

  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test route
app.get("/", isAuthenticated, (req, res) => {
  res.status(200).json({
    user: {
      name: req.user.name,
      role: req.user.role,
    },
  });
});

// Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
// app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/forum", forumRoutes);
app.use("/api/v1/progress", progrssRoutes);
app.use("/api/v1/chat", chatRoutes);
app.use("/api/v1/leaderboard", leaderboardRoutes);
app.use("/api/v1/quiz", quizRoutes);
app.use("/api/v1/teacher", teacherRoutes);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/adminquiz", adminQuizRouter);
app.use("/api/v1/notifications", notificationRoutes);



// Error middleware
app.use(errormiddleware);
