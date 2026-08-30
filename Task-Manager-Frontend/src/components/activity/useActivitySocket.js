import { useEffect, useRef } from "react";
import { getSocket } from "../../lib/socket.js";

/**
 * Subscribe to the shared "activity:new" real-time event.
 *
 * The backend only emits to the caller's own `organization:<id>` room, so every
 * activity received here already belongs to the current organization. Optional
 * `projectId` / `taskId` narrow it to a scoped feed (client-side, matching the
 * REST `?project_id=` / `?task_id=` filters).
 *
 * `onActivity` is read through a ref so re-renders never re-subscribe; the
 * listener is registered exactly once per (projectId, taskId) and cleaned up on
 * unmount — safe under React Strict Mode's double-invoke.
 */
export function useActivitySocket({ projectId = null, taskId = null, onActivity }) {
  const cb = useRef(onActivity);
  cb.current = onActivity;

  useEffect(() => {
    const socket = getSocket();

    const handler = (activity) => {
      if (!activity || activity.id == null) return;
      if (
        projectId != null &&
        String(activity.project_id) !== String(projectId)
      ) {
        return;
      }
      if (taskId != null && String(activity.task_id) !== String(taskId)) {
        return;
      }
      cb.current(activity);
    };

    socket.on("activity:new", handler);
    return () => {
      socket.off("activity:new", handler);
    };
  }, [projectId, taskId]);
}
