// Local "current activity session" tracking (application + idle aware).
//
// Each poll provides:
//   sample : { applicationName, windowTitle } | null   (active foreground window)
//   idle   : { isIdle } | { idleSeconds, thresholdSeconds } | null   (idle signal)
//
// Behaviour:
//   * While the user is active and stays in the same application (and, for a
//     browser, the same website), the current application session is simply
//     extended. Window-title changes alone (tab renames, unread-count badges,
//     "file.js — Project" editor captions, media timers, …) do NOT split the
//     session — the latest title is folded into the ongoing session instead.
//   * When the application changes — or a browser navigates to a different
//     known website — the previous application session is closed into a
//     completed activity and a new one starts.
//   * When the caller reports the user as idle (tracker.js: the physical display
//     is off), the current application session is closed and a single "idle"
//     session starts. The idle session is extended every poll until the user is
//     no longer idle — it never produces one row per poll.
//   * When the user is no longer idle, the idle session is closed and a fresh
//     application session begins from the current foreground window.
//
//   (A legacy caller may instead pass { idleSeconds, thresholdSeconds }; the
//    boundary is then back-dated by idleSeconds. Still supported, unused today.)
//
// Sessions never overlap: each new session starts exactly when the previous
// one ended.
//
// This module is pure logic (no timers, no I/O) so it can be unit-tested.

// Two samples describe the "same monitored activity" while the application is
// unchanged and — for a browser — the website is unchanged. The window title is
// deliberately NOT part of this check: real titles churn constantly within a
// single continuous period of use (tab names, unread badges, editor captions,
// media timers) and keying on them shreds one session into dozens of ~poll-
// interval rows.
//
// Domain detection can fail transiently (return null) while the browser stays
// on a page; a null domain on the new sample is treated as "unknown / unchanged"
// so it never churns the session. A change between two *known* domains (or first
// acquiring one) does start a new session — e.g. Chrome youtube.com -> Chrome
// linkedin.com.
function sameActivity(a, b) {
    if (!a || !b) return false;
    if (a.applicationName !== b.applicationName) return false;
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
    const domain = isIdle ? null : session.domain || null;

    return {
        // A browser session that resolved to a website is reported as "website"
        // (it still carries application_name + domain); everything else active
        // is "application".
        activity_type: isIdle ? "idle" : domain ? "website" : "application",
        application_name: isIdle ? null : session.applicationName || "Unknown",
        window_title: isIdle ? null : session.windowTitle || null,
        domain,
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
     * @param {{isIdle:boolean}|{idleSeconds:number,thresholdSeconds:number}|null} [idle]
     * @returns {object|null} a completed activity when a session ended, else null
     */
    update(sample, now = new Date(), idle = null) {
        const idleSeconds =
            idle && Number.isFinite(idle.idleSeconds) ? idle.idleSeconds : 0;
        const thresholdSeconds =
            idle && Number.isFinite(idle.thresholdSeconds)
                ? idle.thresholdSeconds
                : 0;
        // An explicit `isIdle` from the caller (e.g. "the screen is locked/off")
        // wins; otherwise fall back to the legacy input-inactivity threshold.
        // `idleSeconds` still back-dates the active/idle boundary when supplied
        // (0 — the default — means the boundary is exactly `now`).
        const isIdle =
            idle && typeof idle.isIdle === "boolean"
                ? idle.isIdle
                : thresholdSeconds > 0 && idleSeconds >= thresholdSeconds;

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

        if (sameActivity(this.current, sample)) {
            // Same application (and website) — keep the one continuous session.
            // Fold in the newest window title so the reported row reflects the
            // current foreground context; a transient empty title is ignored so
            // it can never wipe a good one.
            if (sample.windowTitle) {
                this.current.windowTitle = sample.windowTitle;
            }
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
