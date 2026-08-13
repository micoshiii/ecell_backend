import express from "express";
import prisma from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

// GET /applications/student → paginated list of the logged-in student's own applications
router.get("/student", requireAuth, requireRole("STUDENT"), async (req, res) => {
  const studentId = req.user.id;
  if (!req.user.roleData?.student) {
    return res.status(403).json({ message: "No student profile linked to this account" });
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  try {
    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where: { studentId },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          status: true,
          appliedAt: true,
          post: {
            select: {
              id: true,
              companyName: true,
              jobTitle: true,
              location: true,
              jobType: true,
              stipend: true,
            },
          },
        },
        orderBy: { appliedAt: "desc" },
      }),
      prisma.application.count({ where: { studentId } }),
    ]);

    return res.status(200).json({
      data: applications,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error fetching student applications:", error);
    return res.status(500).json({ message: "Error fetching applications" });
  }
});

// GET /applications/post/:postId → paginated list of applicants for a specific post
// only the recruiter who owns the post can access this
router.get("/post/:postId", requireAuth, requireRole("RECRUITER"), async (req, res) => {
  const { postId } = req.params;
  const recruiterId = req.user.roleData?.recruiter?.id;

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  try {
    const post = await prisma.post.findUnique({ where: { id: postId } });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    if (post.recruiterId !== recruiterId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const where = { postId };
    if (req.query.status) where.status = req.query.status;

    const [applications, total] = await Promise.all([
      prisma.application.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          status: true,
          appliedAt: true,
          student: {
            select: {
              name: true,
              rollNo: true,
              branch: true,
              cpi: true,
              year: true,
              resumeUrl: true,
              linkedinUrl: true,
            },
          },
        },
        orderBy: { appliedAt: "desc" },
      }),
      prisma.application.count({ where }),
    ]);

    return res.status(200).json({
      data: applications,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error fetching post applications:", error);
    return res.status(500).json({ message: "Error fetching applications" });
  }
});

// GET /applications/getone/:id → single application, scoped to the requester
router.get("/getone/:id", requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const application = await prisma.application.findUnique({
      where: { id },
      include: {
        student: { select: { userId: true, name: true, rollNo: true, branch: true, cpi: true } },
        post: { select: { id: true, recruiterId: true, companyName: true, jobTitle: true } },
      },
    });

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    const isOwnerStudent = req.user.roles?.includes("STUDENT") && application.student.userId === req.user.id;
    const isOwnerRecruiter = req.user.roles?.includes("RECRUITER") && application.post.recruiterId === req.user.roleData?.recruiter?.id;

    if (!isOwnerStudent && !isOwnerRecruiter) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.status(200).json(application);
  } catch (error) {
    console.error("Error fetching application:", error);
    return res.status(500).json({ message: "Error fetching application" });
  }
});

// PUT /applications/update/:id → recruiter updates status of an application to their own post
router.put("/update/:id", requireAuth, requireRole("RECRUITER"), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const recruiterId = req.user.roleData?.recruiter?.id;

  const allowedStatuses = ["PENDING", "ACCEPTED", "REJECTED"];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ message: "Invalid status value" });
  }

  try {
    const application = await prisma.application.findUnique({
      where: { id },
      include: { post: true },
    });

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    if (application.post.recruiterId !== recruiterId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const updated = await prisma.application.update({
      where: { id },
      data: { status },
    });

    return res.status(200).json(updated);
  } catch (error) {
    console.error("Error updating application:", error);
    return res.status(500).json({ message: "Error updating application" });
  }
});

// DELETE /applications/delete/:id → student withdraws their own application
router.delete("/delete/:id", requireAuth, requireRole("STUDENT"), async (req, res) => {
  const { id } = req.params;
  const studentId = req.user.id;

  try {
    const application = await prisma.application.findUnique({ where: { id } });

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    if (application.studentId !== studentId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const status = application.status?.toLowerCase?.();
    if (status === "rejected") {
      return res.status(400).json({ message: "Cannot withdraw a rejected application" });
    }

    await prisma.application.delete({ where: { id } });

    return res.status(200).json({ message: "Application withdrawn successfully" });
  } catch (error) {
    console.error("Error deleting application:", error);
    return res.status(500).json({ message: "Error deleting application" });
  }
});

// POST /applications/create → student applies to a post
router.post("/create", requireAuth, requireRole("STUDENT"), async (req, res) => {
  const { postId } = req.body;
  const studentId = req.user.id;

  if (!postId) {
    return res.status(400).json({ message: "Missing postId" });
  }
  if (!req.user.roleData?.student) {
    return res.status(403).json({ message: "No student profile linked to this account" });
  }

  try {
    const application = await prisma.application.create({
      data: {
        studentId,
        postId,
        status: "PENDING",
      },
      select: {
        id: true,
        status: true,
        appliedAt: true,
        post: { select: { id: true, companyName: true, jobTitle: true } },
      },
    });

    return res.status(201).json(application);
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: "You have already applied for this position" });
    }
    console.error("Error creating application:", error);
    return res.status(500).json({ message: "Error creating application" });
  }
});

export default router;