import express from "express";
import prisma from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

// GET /recruiters/getinfo/:id → Get recruiter by userId
// Ownership check: you can only fetch your own profile
router.get("/getinfo/:id", async (req, res) => {
  const { id } = req.params;

  // Ownership check — the token's user ID must match the requested profile ID
  if (req.user.id !== id) {
    return res.status(403).json({ message: "Forbidden: you can only view your own profile" });
  }

  try {
    const recruiter = await prisma.recruiter.findUnique({
      where: { userId: id },
      include: {
        user: {
          select: {
            email: true,
            createdAt: true,
          },
        },
        posts: {
          include: {
            applications: true,
          },
        },
      },
    });

    if (!recruiter) {
      return res.status(404).json({
        error: "RECRUITER_NOT_FOUND",
        message: "To access recruiter dashboard, kindly login as recruiter",
        redirectTo: "/grow-your-resume/login",
      });
    }

    return res.status(200).json(recruiter);
  } catch (error) {
    console.error("Error fetching recruiter:", error);
    return res
      .status(500)
      .json({ message: "Error fetching recruiter", error: error.message });
  }
});

// PUT /recruiters/update/:id → Update recruiter profile
// Ownership check: you can only update your own profile
router.put("/update/:id", requireRole("RECRUITER"), async (req, res) => {
  const { id } = req.params;

  // Ownership check
  if (req.user.id !== id) {
    return res.status(403).json({ message: "Forbidden: you can only update your own profile" });
  }

  const { companyName, address, websiteUrl, phoneNumber } = req.body;

  try {
    const recruiter = await prisma.recruiter.update({
      where: { userId: id },
      data: {
        companyName,
        address,
        websiteUrl,
        phoneNumber,
      },
    });

    return res.status(200).json(recruiter);
  } catch (error) {
    console.error("Error updating recruiter:", error);
    return res
      .status(500)
      .json({ message: "Error updating recruiter", error: error.message });
  }
});

// POST /recruiters → Create recruiter if not exists
router.post("/register", async (req, res) => {
  const { userId, companyName, websiteUrl, address, phoneNumber } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "Missing userId" });
  }

  try {
    const existing = await prisma.recruiter.findUnique({
      where: { userId },
    });

    if (existing) {
      return res.status(200).json(existing);
    }

    const newRecruiter = await prisma.recruiter.create({
      data: {
        userId,
        companyName: companyName || "", // fallback to empty string if undefined
        websiteUrl: websiteUrl || "",
        address: address || "",
        phoneNumber: phoneNumber || "",
      },
    });

    return res.status(201).json(newRecruiter);
  } catch (err) {
    console.error("Failed to create recruiter:", err);
    return res.status(500).json({ message: "Failed to create recruiter" });
  }
});

// PUT /recruiters/verify/:id → Approve a recruiter (Admin only)
router.put("/verify/:id", requireRole("ADMIN"), async (req, res) => {
  const { id } = req.params;

  try {
    const recruiter = await prisma.recruiter.update({
      where: { id },
      data: { verified: true }
    });

    return res.status(200).json({ success:true , recruiter });
  } catch (error) {
    console.error("Error verifying recruiter:" , error);
    return res.status(500)
    .json({ success: false, message: "Verification failed", error: error.message });
  }
});

// GET /recruiters/pending → Get all unverified recruiters (Admin only)
router.get("/pending", requireRole("ADMIN"), async (req, res) => {
  try {
    const pendingRecruiters = await prisma.recruiter.findMany({
      where : { verified: false },
    });

    return res.status(200).json(pendingRecruiters);
  } catch (error) {
    console.error("Error fecthing pending recruiters:" , error);
    return res.status(500)
    .json({ success:false , message: "Failed to fetch pending recruiters" , error: error.message });
  }
});



export default router;
