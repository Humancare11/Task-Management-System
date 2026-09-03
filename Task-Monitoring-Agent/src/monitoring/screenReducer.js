// Screen-OFF state reducer.
//
// Folds three independent inputs into a single "is the screen usable" state and
// the reason set behind it:
//
//   displayOff   physical display power   (poll probe / persistent watcher)
//   locked       Windows session locked   (Electron powerMonitor lock/unlock)
//   suspended    machine sleeping (S3)    (Electron powerMonitor suspend/resume)
//
// The screen is "off" whenever ANY of them is true; "on" only when all are
// false. The reason set is every input currently true, mapped to the vocabulary
// the backend derivation understands ("sleep" / "locked" / "display_off"). The
// single `reason` is the highest-precedence member (reboot > sleep > locked >
// display_off — matches REASON_PRECEDENCE in the backend's monitoringDerivation).
//
// It emits at most one transition per real change:
//   - on -> off, or off -> on
//   - AND, while staying off, any change to the reason set (§2a: the user locks
//     the machine while the display is already off -> a fresh "off" event
//     carrying [locked, display_off] so the backend can split the interval).
//
// It never emits one event per poll.

// Highest precedence first. "reboot" is only ever assigned by the backend from
// os_boot_time deltas — the agent never emits it — but it is listed here so the
// precedence order is identical on both sides.
const REASON_PRECEDENCE = ["reboot", "sleep", "locked", "display_off"];

function primaryReason(reasons) {
    if (!reasons || reasons.length === 0) return null;
    return [...reasons].sort(
        (a, b) => REASON_PRECEDENCE.indexOf(a) - REASON_PRECEDENCE.indexOf(b),
    )[0];
}

function sameReasonSet(a, b) {
    if (a.length !== b.length) return false;
    const s = new Set(a);
    return b.every((x) => s.has(x));
}

class ScreenReducer {
    constructor(initialState = "on") {
        const off = initialState === "off";
        this.displayOff = off;
        this.locked = false;
        this.suspended = false;
        this.state = off ? "off" : "on";
        this.reasons = off ? ["display_off"] : [];
    }

    // Recompute state + reason set from the three inputs and return a transition
    // event payload, or null when nothing an observer cares about changed.
    _recompute() {
        const reasons = [];
        if (this.suspended) reasons.push("sleep");
        if (this.locked) reasons.push("locked");
        if (this.displayOff) reasons.push("display_off");

        const prevState = this.state;
        const prevReasons = this.reasons;
        const nextState = reasons.length > 0 ? "off" : "on";

        this.state = nextState;
        this.reasons = reasons;

        if (nextState === "on") {
            return prevState === "off" ? { state: "on", reason: null, reasons: [] } : null;
        }

        // nextState === "off": emit on the on->off edge, or when the reason set
        // shifts while already off.
        if (prevState === "on" || !sameReasonSet(prevReasons, reasons)) {
            return {
                state: "off",
                reason: primaryReason(reasons),
                reasons: [...reasons],
            };
        }
        return null;
    }

    /**
     * Apply the current physical display power reading.
     * @param {boolean} displayOff
     * @returns {{ state: "on"|"off", reason: string|null, reasons: string[] } | null}
     */
    applyDisplay(displayOff) {
        const next = Boolean(displayOff);
        if (next === this.displayOff) return null;
        this.displayOff = next;
        return this._recompute();
    }

    /**
     * Apply a powerMonitor lock / suspend change. Pass only the field(s) that
     * changed; the other keeps its current value.
     * @param {{ locked?: boolean, suspended?: boolean }} patch
     * @returns {{ state: "on"|"off", reason: string|null, reasons: string[] } | null}
     */
    applyPower(patch = {}) {
        let changed = false;
        if (typeof patch.locked === "boolean" && patch.locked !== this.locked) {
            this.locked = patch.locked;
            changed = true;
        }
        if (typeof patch.suspended === "boolean" && patch.suspended !== this.suspended) {
            this.suspended = patch.suspended;
            changed = true;
        }
        return changed ? this._recompute() : null;
    }

    getState() {
        return this.state;
    }

    getReasons() {
        return [...this.reasons];
    }
}

module.exports = { ScreenReducer, primaryReason, REASON_PRECEDENCE };
