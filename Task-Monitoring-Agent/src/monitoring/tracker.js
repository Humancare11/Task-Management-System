// Active-application + idle tracking loop.
//
// Every config.activityPollIntervalSeconds:
//   1. Detect the active window (application_name + window_title).
//   2. Detect system idle time (seconds since last keyboard/mouse input).
//   3. Feed both to the session tracker.
//   4. When a session ends, buffer the completed activity and submit the buffer.
//   5. Also submit when the buffer reaches config.activityBufferMaxSize.
//
// A failed submission does not crash the agent and does not lose the activity
// (see ActivityReporter). This module does not touch the heartbeat.

const { buildConfig, validateConfig } = require("../config/config");
const { getActiveWindow } = require("./activeWindow");
const { getActiveDomain } = require("./domainDetector");
const { getIdleSeconds } = require("./idleTime");
const { ActivitySessionTracker } = require("./activitySession");
const { ActivityReporter } = require("./activityReporter");
const logger = require("../utils/logger");

let timer = null;
let running = false;

async function tick(session, reporter, config) {
    if (running) return; // avoid overlap if a poll runs long
    running = true;
    try {
        const [sample, idleSeconds] = await Promise.all([
            getActiveWindow(),
            getIdleSeconds(),
        ]);
        const now = new Date();

        const idle = {
            idleSeconds: Number.isFinite(idleSeconds) ? idleSeconds : 0,
            thresholdSeconds: config.idleThresholdSeconds,
        };
        const idleNow =
            idle.thresholdSeconds > 0 &&
            idle.idleSeconds >= idle.thresholdSeconds;

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

        const wasIdle =
            session.describeCurrent() &&
            session.describeCurrent().type === "idle";
        const isIdleNow = idleNow;

        if (!wasIdle && isIdleNow) {
            logger.info(`User idle detected (>= ${idle.thresholdSeconds}s without input)`);
        } else if (wasIdle && !isIdleNow) {
            logger.info("User activity resumed");
        } else if (!isIdleNow && activeSample) {
            const previous = session.describeCurrent();
            const prevDomain = (previous && previous.domain) || null;
            const isNew =
                !previous ||
                previous.type !== "application" ||
                previous.applicationName !== activeSample.applicationName ||
                previous.windowTitle !== activeSample.windowTitle ||
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
            if (completed.activity_type === "application") {
                logger.info(`Application: ${completed.application_name}`);
                if (completed.domain) {
                    logger.info(`Website: ${completed.domain}`);
                }
            }
            logger.info(`Duration: ${completed.duration_seconds}s`);
            reporter.add(completed);
            await reporter.flush();
        } else if (reporter.shouldFlush()) {
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
    const reporter = new ActivityReporter(config);

    logger.info(
        `Activity tracking started (poll every ${config.activityPollIntervalSeconds}s, ` +
        `buffer ${config.activityBufferMaxSize}, idle threshold ${config.idleThresholdSeconds}s)`,
    );

    tick(session, reporter, config);
    timer = setInterval(
        () => tick(session, reporter, config),
        config.activityPollIntervalSeconds * 1000,
    );
    if (timer.unref) timer.unref();

    async function stopActivityTracking() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
        const completed = session.flush(new Date());
        if (completed) {
            logger.info("Activity completed (shutdown)");
            logger.info(`Type: ${completed.activity_type}`);
            if (completed.activity_type === "application") {
                logger.info(`Application: ${completed.application_name}`);
                if (completed.domain) {
                    logger.info(`Website: ${completed.domain}`);
                }
            }
            logger.info(`Duration: ${completed.duration_seconds}s`);
            reporter.add(completed);
        }
        if (reporter.pendingCount > 0) {
            await reporter.flush();
        }
    }

    return { session, reporter, stopActivityTracking };
}

module.exports = { startActivityTracking };
