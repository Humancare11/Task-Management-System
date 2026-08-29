// Bridge between the setup UI (renderer) and the main process.
//
// The renderer can ONLY: ask for the current agent state, submit credentials
// for validation, and request a reconfigure. It can never read the stored
// Agent Secret back — the secret only ever lives in the main process and the
// OS-encrypted store.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("agentSetup", {
    getState: () => ipcRenderer.invoke("agent:getState"),
    connect: (credentials) => ipcRenderer.invoke("agent:connect", credentials),
    reconfigure: () => ipcRenderer.invoke("agent:reconfigure"),
    // The main process asks the UI to re-read state after a tray-initiated
    // action (e.g. Reconfigure from the tray menu). No data is passed.
    onRefresh: (handler) => {
        if (typeof handler === "function") {
            ipcRenderer.on("agent:refresh", () => handler());
        }
    },
});
