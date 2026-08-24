import { io } from "socket.io-client";
import { API_ORIGIN } from "../api/client.js";

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(API_ORIGIN, {
      auth: (cb) => cb({ token: localStorage.getItem("token") }),
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}