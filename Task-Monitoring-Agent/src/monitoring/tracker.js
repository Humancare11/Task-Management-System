// Active-application + idle tracking loop.
//
// Every config.activityPollIntervalSeconds:
//   1. Detect the active window (application_name + window_title).
//   2. Read the cached physical-display-power state (displayPowerWatcher — a
//      persistent power-setting notification, no per-poll process spawn). The
//      user counts as "idle" for the LEGACY /activities path only when the
//      display is OFF — never for a lack of keyboard/mouse input while it is on.
//   3. Feed both to the session tracker.
//   4. When a session ends, buffer the completed activity and submit the buffer.
//   5. Also submit when the buffer reaches config.activityBufferMaxSize.
//
// The events pipeline (Phase 3) additionally folds Electron powerMonitor
// lock/unlock/suspend/resume into the screen_state stream via notifyPowerState()
// — that is a pure side-channel and never changes the legacy idle rule above.
//
// A failed submission does not crash the agent and does not lose the activity
// (see ActivityReporter). This module does not touch the heartbeat.

const { buildConfig, validateConfig } = require("../config/config");
const { getActiveWindow } = require("./activeWindow");
const { getActiveDomain, canonicalBrowser } = require("./domainDetector");
const { DisplayPowerWatcher } = require("./displayPowerWatcher");
const { ActivitySessionTracker } = require("./activitySession");
const { ActivityReporter } = require("./activityReporter");
const { emitEvent } = require("./eventPipeline");
const { ScreenReducer } = require("./screenReducer");
const { startInputStateTracking } = require("./inputState");
const logger = require("../utils/logger");

let timer = null;
let running = false;

// Emit app_focus / browser_state transition events into the events pipeline.
// Pure side-channel — never touches the legacy session/reporter path, skipped
// entirely when eventCtx is null (events pipeline disabled). Screen state is
// handled separately (emitScreenTransition) because it is also driven by the
// display watcher and by powerMonitor, not only by the poll.
function emitFocusEvents(eventCtx, activeSample) {
    if (!eventCtx || !activeSample) return;
    try {
        const appName = activeSample.applicationName || "Unknown";
        if (appName !== eventCtx.focus.app) {
            eventCtx.focus.app = appName;
            emitEvent("app_focus", {
                application_name: appName,
                window_title: activeSample.windowTitle || null,
            });
        }

        const browser = canonicalBrowser(activeSample.applicationName);
        if (browser) {
            const key = `${browser}|${activeSample.domain || ""}`;
            if (key !== eventCtx.focus.browserKey) {
                eventCtx.focus.browserKey = key;
                emitEvent("browser_state", {
                    browser,
                    domain: activeSample.domain || null,
                    is_private: false, // incognito detection lands later
                });
            }
        } else {
            eventCtx.focus.browserKey = null;
        }
    } catch (err) {
        logger.warn(`Failed to emit monitoring focus events: ${err.message}`);
    }
}

async function tick(session, reporter, config, ctx) {
    if (running) return; // avoid overlap if a poll runs long
    running = true;
    try {
        const sample = await getActiveWindow();
        const screen = ctx.watcher.current(); // cached — no spawn
        const now = new Date();

        // "Idle" for the legacy path means one thing only: the physical display
        // is OFF. No keyboard/mouse-inactivity timer, no lock or screensaver
        // check — a long meeting, reading session, or presentation with the
        // display on keeps the foreground app tracked. Display off -> idle;
        // display on -> resume.
        const idleNow = screen.displayOff;
        const idle = { isIdle: idleNow };

        // Enrich the active-window sample with the website/domain when the
        // foreground application is a supported browser and the user is active.
        // Non-browser apps and idle periods always carry domain = null.
        let activeSample = sample;
        if (sample) {
            let domain = null;
            if (!idleNow) {
                try {
                    domain = await getActiveDomain(sample);
                } catch {
                    domain = null;
                }
            }
            activeSample = { ...sample, domain: domain || null };
        }

        // Dual-mode: feed the events pipeline. Does not affect anything below.
        // Reconcile the screen reducer against the cached display state in case
        // a watcher edge was missed between polls (idempotent — the reducer
        // dedupes), then emit focus/browser transitions.
        if (ctx.eventCtx) {
            ctx.emitScreenTransition(
                ctx.eventCtx.screenReducer.applyDisplay(Boolean(idleNow)),
            );
            emitFocusEvents(ctx.eventCtx, activeSample);
        }

        const wasIdle =
            session.describeCurrent() &&
            session.describeCurrent().type === "idle";
        const isIdleNow = idleNow;

        if (!wasIdle && isIdleNow) {
            logger.info("Display turned off — pausing activity tracking.");
        } else if (wasIdle && !isIdleNow) {
            logger.info("Display turned on — resuming activity tracking.");
        } else if (!isIdleNow && activeSample) {
            const previous = session.describeCurrent();
            const prevDomain = (previous && previous.domain) || null;
            // Mirrors sameActivity() in activitySession.js: a bare window-title
            // change keeps the same session, so it must not be logged as a new
            // "Active application".
            const isNew =
                !previous ||
                previous.type !== "application" ||
                previous.applicationName !== activeSample.applicationName ||
                (activeSample.domain && activeSample.domain !== prevDomain);

            if (isNew) {
                logger.info(`Active application: ${activeSample.applicationName}`);
                logger.info(`Window: ${activeSample.windowTitle || "(no title)"}`);
                if (activeSample.domain) {
                    logger.info(`Website: ${activeSample.domain}`);
                }
            }
        }

        const completed = session.update(activeSample, now, idle);

        if (completed) {
            logger.info("Activity completed");
            logger.info(`Type: ${completed.activity_type}`);
            if (completed.activity_type !== "idle") {
                logger.info(`Application: ${completed.application_name}`);
                if (completed.domain) {
                    logger.info(`Website: ${completed.domain}`);
                }
            }
            logger.info(`Duration: ${completed.duration_seconds}s`);
            // Legacy POST /agent/activities — only when pipelineMode allows it.
            if (reporter) {
                reporter.add(completed);
                await reporter.flush();
            }
        } else if (reporter && reporter.shouldFlush()) {
            await reporter.flush();
        }
    } catch (err) {
        logger.warn("Activity poll failed: unexpected error.");
    } finally {
        running = false;
    }
}

function startActivityTracking(providedConfig) {
    const config = providedConfig || buildConfig();
    validateConfig(config);

    const session = new ActivitySessionTracker();
    // Legacy /activities reporter — created only when pipelineMode keeps the
    // legacy path alive ("legacy" / "dual", or as a fallback when the events
    // pipeline is force-disabled). null in the default "events" mode: the
    // session tracker still runs (for the local "Active application" logs) but
    // nothing is POSTed to /agent/activities.
    const reporter = config.legacyActivitiesEnabled
        ? new ActivityReporter(config)
        : null;

    // Events-pipeline side-channel (dual mode). eventCtx / inputTracker are
    // null / skipped when EVENTS_PIPELINE_ENABLED is false, leaving legacy
    // behaviour identical. The display watcher runs EITHER WAY — the legacy
    // idle rule needs the display-power reading.
    const eventCtx = config.eventsPipelineEnabled
        ? { screenReducer: new ScreenReducer(), focus: { app: null, browserKey: null } }
        : null;

    function emitScreenTransition(transition) {
        if (!transition || !eventCtx) return;
        try {
            const payload = { state: transition.state, reason: transition.reason };
            if (transition.state === "off" && transition.reasons && transition.reasons.length) {
                payload.reasons = transition.reasons;
            }
            emitEvent("screen_state", payload);
        } catch (err) {
            logger.warn(`Failed to emit screen_state event: ${err.message}`);
        }
    }

    // Persistent display-power watcher. onChange drives the reducer at event
    // granularity (a few hundred ms), so screen on/off boundaries are accurate
    // even between polls; the poll's applyDisplay call is a reconciliation net.
    const watcher = new DisplayPowerWatcher({
        onChange: (state) => {
            if (!eventCtx) return;
            emitScreenTransition(
                eventCtx.screenReducer.applyDisplay(Boolean(state.displayOff)),
            );
        },
    });
    watcher.start();

    const inputTracker = config.eventsPipelineEnabled
        ? startInputStateTracking(config, emitEvent)
        : null;

    logger.info(
        `Activity tracking started (poll every ${config.activityPollIntervalSeconds}s, ` +
        `buffer ${config.activityBufferMaxSize}, idle = display off, ` +
        `pipeline=${config.pipelineMode}` +
        `${config.eventsPipelineEnabled ? " [events]" : ""}` +
        `${reporter ? " [legacy /activities]" : ""})`,
    );

    const ctx = { eventCtx, watcher, emitScreenTransition };

    tick(session, reporter, config, ctx);
    timer = setInterval(
        () => tick(session, reporter, config, ctx),
        config.activityPollIntervalSeconds * 1000,
    );
    if (timer.unref) timer.unref();

    // Fold an Electron powerMonitor lock/unlock/suspend/resume change into the
    // screen_state stream. No-op when the events pipeline is disabled — the
    // legacy idle rule stays display-power-only.
    function notifyPowerState(patch) {
        if (!eventCtx) return;
        try {
            emitScreenTransition(eventCtx.screenReducer.applyPower(patch || {}));
        } catch (err) {
            logger.warn(`Failed to apply power state ${JSON.stringify(patch)}: ${err.message}`);
        }
    }

    async function stopActivityTracking() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
        watcher.stop();
        if (inputTracker) inputTracker.stop();
        const completed = session.flush(new Date());
        if (completed && reporter) {
            logger.info("Activity completed (shutdown)");
            logger.info(`Type: ${completed.activity_type}`);
            if (completed.activity_type !== "idle") {
                logger.info(`Application: ${completed.application_name}`);
                if (completed.domain) {
                    logger.info(`Website: ${completed.domain}`);
                }
            }
            logger.info(`Duration: ${completed.duration_seconds}s`);
            reporter.add(completed);
        }
        if (reporter && reporter.pendingCount > 0) {
            await reporter.flush();
        }
    }

    return { session, reporter, notifyPowerState, stopActivityTracking };
}

module.exports = { startActivityTracking };
