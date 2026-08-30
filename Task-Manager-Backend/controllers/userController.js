const path = require("path");
const fs = require("fs");
const { User } = require("../models");

const uploadDir = path.join(__dirname, "../uploads");

// Max lengths mirror the users table column definitions.
const JOB_TITLE_MAX = 150;
const DEPARTMENT_MAX = 150;
const BIO_MAX = 1000;

const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
];

// The single source of truth for the profile response shape. role and
// organization_id always come from the authenticated context, never the row.
function serializeProfile(user, req) {
  return {
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    avatar_url: user.avatar_url,
    job_title: user.job_title,
    department: user.department,
    bio: user.bio,
    role: req.user.role,
    organization_id: req.user.organization_id,
  };
}

// Delete a stored avatar file best-effort. Never throws.
function removeAvatarFile(avatarUrl) {
  if (!avatarUrl || !avatarUrl.startsWith("/uploads/")) return;
  const filename = path.basename(avatarUrl);
  const filePath = path.join(uploadDir, filename);
  fs.promises.unlink(filePath).catch(() => {});
}

// GET /api/users/me
exports.getMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    return res.json({ user: serializeProfile(user, req) });
  } catch (error) {
    console.error("Get profile error:", error);
    return res.status(500).json({ message: "Server error while loading profile." });
  }
};

// PATCH /api/users/me
// Self-service only. Strict whitelist — email / role / organization_id / id and
// any other column can never be changed here.
exports.updateMe = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const body = req.body || {};
    const updates = {};

    // first_name — required, non-empty after trim
    if (body.first_name !== undefined) {
      const firstName = String(body.first_name).trim();
      if (!firstName) {
        return res.status(400).json({ message: "First name is required." });
      }
      if (firstName.length > 100) {
        return res.status(400).json({ message: "First name is too long." });
      }
      updates.first_name = firstName;
    }

    // Optional free-text fields — empty string is stored as null
    const optionalText = {
      last_name: 100,
      job_title: JOB_TITLE_MAX,
      department: DEPARTMENT_MAX,
      bio: BIO_MAX,
    };

    for (const [field, max] of Object.entries(optionalText)) {
      if (body[field] === undefined) continue;
      const raw = body[field] === null ? "" : String(body[field]).trim();
      if (raw.length > max) {
        return res.status(400).json({
          message: `${field.replace("_", " ")} must be ${max} characters or fewer.`,
        });
      }
      updates[field] = raw === "" ? null : raw;
    }

    if (Object.keys(updates).length === 0) {
      return res.json({ user: serializeProfile(user, req) });
    }

    await user.update(updates);

    return res.json({ user: serializeProfile(user, req) });
  } catch (error) {
    console.error("Update profile error:", error);
    return res.status(500).json({ message: "Server error while saving profile." });
  }
};

// POST /api/users/me/avatar  (multipart, field: "file")
exports.updateMyAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image uploaded." });
    }

    // The shared upload middleware also accepts documents — constrain this
    // route to images only, and drop the file that just got written.
    if (!IMAGE_MIME_TYPES.includes(req.file.mimetype)) {
      fs.promises
        .unlink(path.join(uploadDir, req.file.filename))
        .catch(() => {});
      return res
        .status(400)
        .json({ message: "Avatar must be a JPG, PNG, GIF or WebP image." });
    }

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const previousAvatar = user.avatar_url;
    await user.update({ avatar_url: `/uploads/${req.file.filename}` });

    // Best-effort cleanup of the replaced file.
    if (previousAvatar && previousAvatar !== user.avatar_url) {
      removeAvatarFile(previousAvatar);
    }

    return res.json({ user: serializeProfile(user, req) });
  } catch (error) {
    console.error("Update avatar error:", error);
    return res.status(500).json({ message: "Server error while uploading avatar." });
  }
};

// DELETE /api/users/me/avatar
exports.deleteMyAvatar = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const previousAvatar = user.avatar_url;
    if (previousAvatar) {
      await user.update({ avatar_url: null });
      removeAvatarFile(previousAvatar);
    }

    return res.json({ user: serializeProfile(user, req) });
  } catch (error) {
    console.error("Delete avatar error:", error);
    return res.status(500).json({ message: "Server error while removing avatar." });
  }
};
