import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../../api/notifications.js";
import { getSocket } from "../../lib/socket.js";
import {
  requestNotificationPermission,
  showBrowserNotification,
} from "../../utils/browserNotification.js";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const ref = useRef(null);
  const navigate = useNavigate();

  async function loadNotifications() {
    try {
      const { data } = await listNotifications();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unread_count ?? 0);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    }
  }

  useEffect(() => {
    loadNotifications();
    requestNotificationPermission();

    const socket = getSocket();
    function handleNew(notification) {
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((c) => c + 1);

      // Show browser/system notification
      if (Notification.permission === "granted") {
        const popup = new Notification("Task Manager", {
          body: notification.message,
          icon: "/favicon.ico",
        });
        popup.onclick = () => {
          window.focus();
          if (notification.project_id && notification.task_id) {
            navigate(
              `/projects/${notification.project_id}/tasks/${notification.task_id}`
            );
          }
        };
      }
    }
    socket.on("notification:new", handleNew);

    return () => {
      socket.off("notification:new", handleNew);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleOpen() {
    const granted = await requestNotificationPermission();

    if (granted) {
      console.log("Browser notifications enabled.");
    }

    setOpen((v) => !v);
  }

  async function handleNotificationClick(notification) {
    if (!notification.is_read) {
      try {
        await markNotificationRead(notification.id);
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, is_read: true } : n,
          ),
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (err) {
        console.error("Failed to mark notification read:", err);
      }
    }
  }

  async function handleView(notification) {
    if (!notification.is_read) {
      try {
        await markNotificationRead(notification.id);
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, is_read: true } : n,
          ),
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (err) {
        console.error("Failed to mark notification read:", err);
      }
    }
    setOpen(false);
    if (notification.project_id && notification.task_id) {
      navigate(
        `/projects/${notification.project_id}/tasks/${notification.task_id}`,
      );
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all notifications read:", err);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleOpen}
        className="relative rounded-md p-1 text-txt-muted hover:text-txt-primary"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-lg border border-hair bg-surface-1 py-1 shadow-lg">
          <div className="flex items-center justify-between border-b border-hair px-3 py-2">
            <span className="text-sm font-medium text-txt-primary">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-accentblue hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-txt-muted">
                No notifications yet.
              </p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleView(n)}
                  className={`flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-surface-2 ${n.is_read ? "text-txt-muted" : "bg-accentblue-soft text-txt-primary"
                    }`}
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate">{n.message}</span>
                    <span className="text-xs text-txt-muted">
                      {new Date(n.created_at).toLocaleString()}
                    </span>
                  </div>
                  {n.task_id && n.project_id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleView(n);
                      }}
                      className="shrink-0 text-xs font-medium text-accentblue hover:underline"
                    >
                      View
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
