const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/authMiddleware");
const { getActivities } = require("../controllers/activityController");

router.use(requireAuth);

router.get("/", getActivities);

module.exports = router;
