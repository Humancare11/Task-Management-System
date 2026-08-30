const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");
const {
  getMe,
  updateMe,
  updateMyAvatar,
  deleteMyAvatar,
} = require("../controllers/userController");

// All profile routes are self-service — the acting user is always req.user.id.
router.use(requireAuth);

router.get("/me", getMe);
router.patch("/me", updateMe);
router.post("/me/avatar", upload.single("file"), updateMyAvatar);
router.delete("/me/avatar", deleteMyAvatar);

module.exports = router;
