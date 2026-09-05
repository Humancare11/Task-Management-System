// Bridge for the Screenshot notice window. This window shows a brief message
// naming who requested the screenshot and then closes itself (from main) — it
// has no controls, no network access, and no access to the Agent Secret.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("screenshotNotice", {
    onInfo: (h) => ipcRenderer.on("ss:info", (_e, d) => h(d)),
});
