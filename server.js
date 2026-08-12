import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import studentRoutes from "./routes/students.js";
import recruiterRoutes from "./routes/recruiters.js";
import ambassadorRoutes from "./routes/ambassador.js";
import postRoutes from "./routes/posts.js";
import applicationRoutes from "./routes/applications.js";
import userRoutes from "./routes/users.js";
import pingRoute from "./routes/ping.js";
import { requireAuth } from "./middleware/auth.js";

const app = express();
app.use(cors());
app.use(express.json());

// public routes
app.use("/", pingRoute);
app.use("/ping", pingRoute);
app.use("/users", userRoutes); // must stay public — /users/create is hit pre-login by the signIn callback

// protected routes
app.use("/students", requireAuth, studentRoutes);
app.use("/recruiters", requireAuth, recruiterRoutes);
app.use("/ambassador", requireAuth, ambassadorRoutes);
app.use("/posts", requireAuth, postRoutes);
app.use("/applications", requireAuth, applicationRoutes);

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`Backend running at http://localhost:${PORT}`);
}); 