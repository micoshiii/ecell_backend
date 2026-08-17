import express from "express";
import prisma from "../lib/prisma.js";
import { requireRole } from "../middleware/auth.js";

const router = express.Router();

// GET /students/getinfo/:id → fetch student by userId
// Ownership check: you can only fetch your own profile
router.get("/getinfo/:id", async (req, res) => {
  const { id } = req.params;

  // Ownership check — the token's user ID must match the requested profile ID
  if (req.user.id !== id) {
    return res.status(403).json({ message: "Forbidden: you can only view your own profile" });
  }

  try {
    const student = await prisma.student.findUnique({
      where: { userId: id },
      include: {
        user: {
          select: {
            email: true,
            createdAt: true,
          },
        },
        applications: {
          include: {
            post: true,
          },
        },
      },
    });

    if (!student) {
      return res.status(404).json({
        error: "STUDENT_NOT_FOUND",
        message: "To access student dashboard, kindly login as student",
        redirectTo: "/student-internship-portal/login",
      });
    }

    return res.status(200).json(student);
  } catch (error) {
    console.error("Error fetching student:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// PUT /students/update/:id → update student by userId
// Ownership check: you can only update your own profile
router.put("/update/:id", requireRole("STUDENT"), async (req, res) => {
  const { id } = req.params;

  // Ownership check
  if (req.user.id !== id) {
    return res.status(403).json({ message: "Forbidden: you can only update your own profile" });
  }
  const {
    name,
    rollNo,
    branch,
    cpi,
    courseType,
    year,
    linkedinUrl,
    githubUrl,
    resumeUrl,
  } = req.body;

  try {
    const updated = await prisma.student.update({
      where: { userId: id },
      data: {
        name,
        rollNo,
        branch,
        cpi,
        courseType,
        year,
        linkedinUrl,
        githubUrl,
        resumeUrl,
      },
    });

    return res.status(200).json(updated);
  } catch (error) {
    console.error("Error updating student:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// POST /students → create new student
router.post("/register", async (req, res) => {
  const {
    userId,
    name,
    rollNo,
    branch,
    cpi,
    courseType,
    year,
    linkedinUrl,
    githubUrl,
    resumeUrl,
  } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "Missing userId" });
  }

  try {
    const existing = await prisma.student.findUnique({
      where: { userId },
    });

    if (existing) {
      return res.status(200).json(existing);
    }

    const newStudent = await prisma.student.create({
      data: {
        userId,
        name,
        rollNo,
        branch,
        cpi,
        courseType,
        year,
        linkedinUrl,
        githubUrl,
        resumeUrl,
      },
    });

    return res.status(201).json(newStudent);
  } catch (err) {
    console.error("Failed to create student:", err);
    return res.status(500).json({ message: "Failed to create student" });
  }
});


export default router;
