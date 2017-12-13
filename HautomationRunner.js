var HautomationCore = require("./src/HautomationCore");
const events = require("events");
var core = null;
const HautomationRunnerConstants = require("./HautomationRunnerConstants");

/**
 * The runner class.
 * @class
 */
class HautomationRunner {
    /**
     * Constructor
     *
     * @returns {HautomationRunner} The instance
     */
    constructor() {
        this.core = null;
        this.runnerEventBus = new events.EventEmitter();

        const self = this;
        this.runnerEventBus.on(HautomationRunnerConstants.RESTART, () => {
            self.restart(self);
        });

        this.start(this);
    }

    /**
     * Start core
     *
     * @param  {HautomationRunner} self The instance
     */
    start(self) {
        if (!self.core) {
            console.log("Starting runner");
            self.core = new HautomationCore.class(self.runnerEventBus);
            self.core.start();
        }
    }

    /**
     * Stop core
     *
     * @param  {HautomationRunner} self The instance
     */
    stop(self) {
        if (self.core) {
            self.core.stop();
            self.core = null;
        }
    }

    /**
     * Restart core
     *
     * @param  {HautomationRunner} self The instance
     */
    restart(self) {
        self.stop(self);
        self.start(self);
    }
}

const runner = new HautomationRunner();

process.on("SIGINT", () => {
    console.log("Received SIGINT");
    runner.stop(runner);
    process.kill(process.pid, "SIGKILL");
    process.exit(0);
});

process.on("SIGTERM", () => {
    console.log("Received SIGTERM");
    runner.stop(runner);
    process.kill(process.pid, "SIGKILL");
    process.exit(0);
});
