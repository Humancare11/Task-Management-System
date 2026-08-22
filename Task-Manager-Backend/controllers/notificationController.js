const { Notification, User } = require("../models");

// GET /api/notifications
exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: {
        user_id: req.user.id,
        organization_id: req.user.organization_id,
      },
      include: [
        {
          model: User,
          as: "actor",
          attributes: ["id", "first_name", "last_name", "avatar_url"],
        },
      ],
      order: [["created_at", "DESC"]],
      limit: 50,
    });

    const unreadCount = await Notification.count({
      where: {
        user_id: req.user.id,
        organization_id: req.user.organization_id,
        is_read: false,
      },
    });

    return res.json({ notifications, unread_count: unreadCount });
  } catch (error) {
    console.error("Get notifications error:", error);
    return res.status(500).json({ message: "Server error while fetching notifications." });
  }
};

// PATCH /api/notifications/:id/read
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findOne({
      where: { id, user_id: req.user.id, organization_id: req.user.organization_id },
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found." });
    }

    notification.is_read = true;
    await notification.save();

    return res.json({ message: "Notification marked as read.", notification });
  } catch (error) {
    console.error("Mark notification read error:", error);
    return res.status(500).json({ message: "Server error while updating notification." });
  }
};

// PATCH /api/notifications/read-all
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.update(
      { is_read: true },
      {
        where: {
          user_id: req.user.id,
          organization_id: req.user.organization_id,
          is_read: false,
        },
      },
    );

    return res.json({ message: "All notifications marked as read." });
  } catch (error) {
    console.error("Mark all notifications read error:", error);
    return res.status(500).json({ message: "Server error while updating notifications." });
  }
};