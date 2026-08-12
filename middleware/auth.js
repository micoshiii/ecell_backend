import { decode } from "next-auth/jwt";

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];
    const secret = process.env.NEXTAUTH_SECRET; // read at request time, not module-load time

    if (!secret) {
      console.error("NEXTAUTH_SECRET is not set");
      return res.status(500).json({ message: "Server misconfiguration" });
    }

    const decoded = await decode({ token, secret });

    if (!decoded) {
      return res.status(401).json({ message: "Invalid token" });
    }

    req.user = decoded;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error.message);
    return res.status(401).json({ message: "Invalid token" });
  }
};

export const requireRole = (role) => (req, res, next) => {
  if (!req.user || !req.user.roles?.includes(role)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};