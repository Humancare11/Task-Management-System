export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.log("Browser notifications are not supported.");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission === "denied") {
    return false;
  }

  const permission = await Notification.requestPermission();

  return permission === "granted";
}

export function showBrowserNotification(notification) {
  if (!("Notification" in window)) {
    return;
  }

  if (Notification.permission !== "granted") {
    return;
  }

  const browserNotification = new Notification("Task Manager", {
    body: notification.message,
    icon: "/favicon.ico",
  });

  browserNotification.onclick = () => {
    window.focus();
    browserNotification.close();
  };
}