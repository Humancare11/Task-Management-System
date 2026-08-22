import { io } from "socket.io-client";
import { API_ORIGIN } from "../api/client.js";

let socket = null;

export function getSocket() {
  if (!socket) {
    const token = localStorage.getItem("token");
    socket = io(API_ORIGIN, {
      auth: { token },
    });
  }
  return socket;
}