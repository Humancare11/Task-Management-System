// Local "current activity session" tracking (application + idle aware).
//
// Each poll provides:
//   sample : { applicationName, windowTitle } | null   (active foreground window)
//   idle   : { idleSeconds, thresholdSeconds } | null   (system idle time)
//
// Behaviour:
//   * While the user is active and the foreground app/window is unchanged, the
//     current application session is simply extended.
//   * When the app/window changes, the previous application session is closed
//     into a completed activity and a new one starts.
//   * When system idle time reaches the threshold, the current application
//     session is closed at the moment idle began (now - idleSeconds) and a
//     single "idle" session starts. The idle session is extended every poll
//     until input resumes — it never produces one row per poll.
//   * When input resumes, the idle session is closed at the resume moment
//     (now - idleSeconds) and a fresh application session begins from the
//     current foreground window.
//
// Sessions never overlap: each new session starts exactly when the previous
// one ended.
//
// This module is pure logic (no timers, no I/O) so it can be unit-tested.

// Two samples describe the "same monitored activity" only when the application,
// the window title AND the website/domain all match. Domain detection can fail
// transiently (return null) while the browser stays on a page; a null domain on
// the new sample is treated as "unknown / unchanged" so it never churns the
// session. A change between two *known* domains (or first acquiring one) does
// start a new session — e.g. Chrome youtube.com -> Chrome linkedin.com.
function sameWindow(a, b) {
    if (!a || !b) return false;
    if (a.applicationName !== b.applicationName) return false;
    if (a.windowTitle !== b.windowTitle) return false;
    const prevDomain = a.domain || null;
    const nextDomain = b.domain || null;
    if (nextDomain && nextDomain !== prevDomain) return false;
    return true;
}

function clampDate(date, min, max) {
    let t = date.getTime();
    if (min && t < min.getTime()) t = min.getTime();
    if (max && t > max.getTime()) t = max.getTime();
    return new Date(t);
}

function buildActivity(session, endedAt) {
    const durationMs = endedAt.getTime() - session.startedAt.getTime();
    const duration_seconds = Math.max(0, Math.round(durationMs / 1000));

    const isIdle = session.type === "idle";

    return {
        activity_type: isIdle ? "idle" : "application",
        application_name: isIdle ? null : session.applicationName || "Unknown",
        window_title: isIdle ? null : session.windowTitle || null,
        domain: isIdle ? null : session.domain || null,
        started_at: session.startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        duration_seconds,
    };
}

class ActivitySessionTracker {
    constructor() {
        this.current = null;
    }

    _startApplication(sample, at) {
        this.current = {
            type: "application",
            applicationName: sample.applicationName,
            windowTitle: sample.windowTitle,
            domain: sample.domain || null,
            startedAt: at,
        };
    }

    _startIdle(at) {
        this.current = { type: "idle", startedAt: at };
    }

    /**
     * Feed one poll.
     * @param {{applicationName:string,windowTitle:string}|null} sample
     * @param {Date} now
     * @param {{idleSeconds:number,thresholdSeconds:number}|null} [idle]
     * @returns {object|null} a completed activity when a session ended, else null
     */
    update(sample, now = new Date(), idle = null) {
        const idleSeconds =
            idle && Number.isFinite(idle.idleSeconds) ? idle.idleSeconds : 0;
        const thresholdSeconds =
            idle && Number.isFinite(idle.thresholdSeconds)
                ? idle.thresholdSeconds
                : 0;
        const isIdle =
            thresholdSeconds > 0 && idleSeconds >= thresholdSeconds;

        // The instant idle began / ended, bounded to [sessionStart, now].
        const boundaryFor = (session) =>
            clampDate(
                new Date(now.getTime() - idleSeconds * 1000),
                session ? session.startedAt : null,
                now,
            );

        // ---- IDLE ----
        if (isIdle) {
            if (this.current && this.current.type === "idle") {
                return null; // keep extending the single idle session
            }

            if (this.current && this.current.type === "application") {
                const boundary = boundaryFor(this.current);
                const completed = buildActivity(this.current, boundary);
                this._startIdle(boundary);
                return completed;
            }

            // No session yet -> start idle.
            this._startIdle(boundaryFor(null));
            return null;
        }

        // ---- ACTIVE, resuming from idle ----
        if (this.current && this.current.type === "idle") {
            const boundary = boundaryFor(this.current);
            const completed = buildActivity(this.current, boundary);
            if (sample) {
                this._startApplication(sample, boundary);
            } else {
                this.current = null; // wait for a real window next poll
            }
            return completed;
        }

        // ---- ACTIVE, application tracking (unchanged Step 15 behaviour) ----
        if (!sample) {
            return null; // detection failed this tick: keep current session
        }

        if (!this.current) {
            this._startApplication(sample, now);
            return null;
        }

        if (sameWindow(this.current, sample)) {
            return null;
        }

        const completed = buildActivity(this.current, now);
        this._startApplication(sample, now);
        return completed;
    }

    /**
     * Close the in-progress session (e.g. on shutdown).
     * @param {Date} now
     * @returns {object|null}
     */
    flush(now = new Date()) {
        if (!this.current) return null;
        const completed = buildActivity(this.current, now);
        this.current = null;
        return completed;
    }

    describeCurrent() {
        if (!this.current) return null;
        return {
            type: this.current.type,
            applicationName: this.current.applicationName || null,
            windowTitle: this.current.windowTitle || null,
            domain: this.current.domain || null,
            startedAt: this.current.startedAt.toISOString(),
        };
    }
}

module.exports = { ActivitySessionTracker, buildActivity };
