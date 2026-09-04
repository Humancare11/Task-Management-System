// Bridge for the Live Screen windows (capture + banner).
//
// The capture window builds the RTCPeerConnection and screen MediaStream in the
// renderer; it can only send SDP/ICE/status to main and receive the viewer's
// answer/ICE and a stop signal. It has no access to files, the network, or the
// Agent Secret. The banner window can only report the employee's "Stop" click.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("liveScreen", {
    // capture window
    onInit: (h) => ipcRenderer.on("ls:init", (_e, d) => h(d)),
    onAnswer: (h) => ipcRenderer.on("ls:answer", (_e, d) => h(d)),
    onRemoteIce: (h) => ipcRenderer.on("ls:remoteIce", (_e, d) => h(d)),
    onStop: (h) => ipcRenderer.on("ls:stop", () => h()),
    sendOffer: (sdp) => ipcRenderer.send("ls:offer", { sdp }),
    sendIce: (candidate) => ipcRenderer.send("ls:ice", { candidate }),
    sendConnected: () => ipcRenderer.send("ls:connected"),
    sendError: (message) => ipcRenderer.send("ls:error", { message }),

    // banner window
    onBannerInfo: (h) => ipcRenderer.on("ls:bannerInfo", (_e, d) => h(d)),
    bannerStop: () => ipcRenderer.send("ls:bannerStop"),
});
