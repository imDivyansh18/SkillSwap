
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
}));
app.use(express.json({ limit: "20kb" }));

// ---------- DATABASE MODELS ----------

const skillSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    level: {
      type: String,
      enum: ["Beginner", "Intermediate", "Expert"],
      default: "Beginner",
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false },
    role: { type: String, default: "Skill Explorer" },
    bio: { type: String, default: "", maxlength: 500 },
    teaches: { type: [skillSchema], default: [] },
    learns: { type: [skillSchema], default: [] },
  },
  { timestamps: true }
);

const connectionSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

connectionSchema.index(
  { requester: 1, recipient: 1 },
  { unique: true }
);

const User = mongoose.model("User", userSchema);
const Connection = mongoose.model("Connection", connectionSchema);

// ---------- AUTHENTICATION MIDDLEWARE ----------

function authenticate(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Please log in first." });
  }

  try {
    const token = header.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired token. Please log in again.",
    });
  }
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    bio: user.bio,
    teaches: user.teaches,
    learns: user.learns,
  };
}

function normalizeSkills(skills) {
  if (!Array.isArray(skills)) {
    throw new Error("Skills must be an array.");
  }

  if (skills.length > 30) {
    throw new Error("You can add at most 30 skills per category.");
  }

  const seen = new Set();

  return skills.map((skill) => {
    if (!skill || typeof skill.name !== "string") {
      throw new Error("Each skill must have a name.");
    }

    const name = skill.name.trim();

    if (!name || name.length > 50) {
      throw new Error("Skill names must be 1–50 characters.");
    }

    const key = name.toLowerCase();

    if (seen.has(key)) {
      throw new Error(`Duplicate skill: ${name}`);
    }

    seen.add(key);

    const level = skill.level || "Beginner";

    if (!["Beginner", "Intermediate", "Expert"].includes(level)) {
      throw new Error(`Invalid proficiency level for ${name}.`);
    }

    return { name, level };
  });
}

// ---------- HEALTH CHECK ----------

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    database: mongoose.connection.readyState === 1
      ? "connected"
      : "disconnected",
  });
});

// ---------- REGISTER ----------

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 80
    ) {
      return res.status(400).json({ message: "Enter a valid name." });
    }

    if (
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return res.status(400).json({ message: "Enter a valid email." });
    }

    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({
        message: "Password must contain at least 8 characters.",
      });
    }

    if (password.length > 128) {
      return res.status(400).json({ message: "Password is too long." });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await User.findOne({ email: normalizedEmail });

    if (existing) {
      return res.status(409).json({
        message: "An account with this email already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
    });

    const token = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "Account created successfully.",
      token,
      user: publicUser(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Email already registered." });
    }

    console.error("Registration error:", error.message);
    res.status(500).json({ message: "Could not create account." });
  }
});

// ---------- LOGIN ----------

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("+password");

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const token = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful.",
      token,
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ message: "Could not log in." });
  }
});

// ---------- CURRENT USER PROFILE ----------

app.get("/api/users/me", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.json({ user: publicUser(user) });
  } catch {
    res.status(500).json({ message: "Could not load profile." });
  }
});

app.put("/api/users/me", authenticate, async (req, res) => {
  try {
    const { name, role, bio, teaches, learns } = req.body;

    const updates = {};

    if (name !== undefined) {
      if (
        typeof name !== "string" ||
        !name.trim() ||
        name.trim().length > 80
      ) {
        return res.status(400).json({ message: "Invalid name." });
      }
      updates.name = name.trim();
    }

    if (role !== undefined) {
      if (typeof role !== "string" || role.length > 100) {
        return res.status(400).json({ message: "Invalid role." });
      }
      updates.role = role.trim();
    }

    if (bio !== undefined) {
      if (typeof bio !== "string" || bio.length > 500) {
        return res.status(400).json({ message: "Invalid bio." });
      }
      updates.bio = bio.trim();
    }

    if (teaches !== undefined) {
      updates.teaches = normalizeSkills(teaches);
    }

    if (learns !== undefined) {
      updates.learns = normalizeSkills(learns);
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.json({
      message: "Profile updated.",
      user: publicUser(user),
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// ---------- SKILL MATCHING ENGINE ----------

function skillNames(skills) {
  return skills.map((skill) => skill.name.toLowerCase());
}

function getMatch(currentUser, candidate) {
  const myTeach = skillNames(currentUser.teaches);
  const myLearn = skillNames(currentUser.learns);
  const theirTeach = skillNames(candidate.teaches);
  const theirLearn = skillNames(candidate.learns);

  const iCanLearn = candidate.teaches
    .filter((skill) => myLearn.includes(skill.name.toLowerCase()))
    .map((skill) => skill.name);

  const theyCanLearn = currentUser.teaches
    .filter((skill) => theirLearn.includes(skill.name.toLowerCase()))
    .map((skill) => skill.name);

  const iCanTeach = currentUser.teaches
    .filter((skill) => theirLearn.includes(skill.name.toLowerCase()))
    .map((skill) => skill.name);

  const theyCanTeach = candidate.teaches
    .filter((skill) => myLearn.includes(skill.name.toLowerCase()))
    .map((skill) => skill.name);

  const allSkills = new Set([...myTeach, ...myLearn]);
  const sharedInterests = [...allSkills].filter(
    (skill) =>
      [...theirTeach, ...theirLearn].includes(skill)
  );

  // Reciprocal exchange is more valuable than a one-way overlap.
  const reciprocal = iCanLearn.length > 0 && theyCanLearn.length > 0;

  let score = 20;
  score += Math.min(iCanLearn.length, 3) * 20;
  score += Math.min(theyCanLearn.length, 3) * 20;

  if (reciprocal) score += 10;
  if (sharedInterests.length > 0) score += 5;

  score = Math.min(score, 99);

  const reasons = [];

  if (iCanLearn.length) {
    reasons.push(`They can teach you ${iCanLearn.join(", ")}`);
  }

  if (theyCanLearn.length) {
    reasons.push(`You can teach them ${theyCanLearn.join(", ")}`);
  }

  if (sharedInterests.length) {
    reasons.push(`Shared interests: ${sharedInterests.join(", ")}`);
  }

  if (!reasons.length) {
    reasons.push("Explore each other's skills to find an exchange opportunity");
  }

  return {
    user: publicUser(candidate),
    score,
    reciprocal,
    skillsYouCanLearn: iCanLearn,
    skillsYouCanTeach: iCanTeach,
    sharedInterests,
    explanation: reasons.join(". ") + ".",
  };
}

app.get("/api/matches", authenticate, async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);

    if (!currentUser) {
      return res.status(404).json({ message: "User not found." });
    }

    const excludedConnections = await Connection.find({
      $or: [
        { requester: currentUser._id },
        { recipient: currentUser._id },
      ],
      status: { $in: ["pending", "accepted"] },
    }).select("requester recipient");

    const excludedIds = new Set([
      currentUser._id.toString(),
      ...excludedConnections.flatMap((connection) => [
        connection.requester.toString(),
        connection.recipient.toString(),
      ]),
    ]);

    const candidates = await User.find({
      _id: { $nin: [...excludedIds] },
    });

    const matches = candidates
      .map((candidate) => getMatch(currentUser, candidate))
      .sort((a, b) => b.score - a.score);

    res.json({ matches });
  } catch (error) {
    console.error("Matching error:", error.message);
    res.status(500).json({ message: "Could not find matches." });
  }
});

// ---------- CONNECTION REQUESTS ----------

app.post("/api/connections", authenticate, async (req, res) => {
  try {
    const { recipientId } = req.body;

    if (
      typeof recipientId !== "string" ||
      !mongoose.isValidObjectId(recipientId)
    ) {
      return res.status(400).json({ message: "Invalid recipient ID." });
    }

    if (recipientId === req.userId) {
      return res.status(400).json({
        message: "You cannot connect with yourself.",
      });
    }

    const recipient = await User.findById(recipientId);

    if (!recipient) {
      return res.status(404).json({ message: "Recipient not found." });
    }

    const existing = await Connection.findOne({
      $or: [
        { requester: req.userId, recipient: recipientId },
        { requester: recipientId, recipient: req.userId },
      ],
      status: { $in: ["pending", "accepted"] },
    });

    if (existing) {
      return res.status(409).json({
        message: "A pending or accepted connection already exists.",
        connection: existing,
      });
    }

    const connection = await Connection.create({
      requester: req.userId,
      recipient: recipientId,
    });

    res.status(201).json({
      message: "Connection request sent.",
      connection,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Connection request already exists.",
      });
    }

    console.error("Connection error:", error.message);
    res.status(500).json({ message: "Could not create connection." });
  }
});

app.get("/api/connections", authenticate, async (req, res) => {
  try {
    const connections = await Connection.find({
      $or: [
        { requester: req.userId },
        { recipient: req.userId },
      ],
    })
      .populate("requester", "name email role teaches learns")
      .populate("recipient", "name email role teaches learns")
      .sort({ createdAt: -1 });

    res.json({ connections });
  } catch (error) {
    console.error("Connection listing error:", error.message);
    res.status(500).json({ message: "Could not load connections." });
  }
});

// Accept or reject an incoming connection request.
app.patch("/api/connections/:id", authenticate, async (req, res) => {
  try {
    const { status } = req.body;

    if (!["accepted", "rejected"].includes(status)) {
      return res.status(400).json({
        message: "Status must be accepted or rejected.",
      });
    }

    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid connection ID." });
    }

    const connection = await Connection.findOne({
      _id: req.params.id,
      recipient: req.userId,
      status: "pending",
    });

    if (!connection) {
      return res.status(404).json({
        message: "Incoming pending request not found.",
      });
    }

    connection.status = status;
    await connection.save();

    res.json({ message: `Connection ${status}.`, connection });
  } catch (error) {
    console.error("Connection update error:", error.message);
    res.status(500).json({ message: "Could not update connection." });
  }
});

// ---------- SERVER START ----------

async function startServer() {
  if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) {
    throw new Error("MONGODB_URI and JWT_SECRET must be set in .env");
  }

  if (process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long.");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const port = process.env.PORT || 5000;

  app.listen(port, () => {
    console.log(`SkillSwap API running at http://localhost:${port}`);
    console.log("MongoDB connected successfully.");
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});
