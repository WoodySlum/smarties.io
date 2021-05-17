var SmartiesCore = require("./src/SmartiesCore");
const events = require("events");
const colors = require("colors");

var core = null;
const SmartiesRunnerConstants = require("./SmartiesRunnerConstants");
const Logger = require("./src/logger/Logger");
const os = require("os");
const fs = require("fs-extra");
const childProcess = require("child_process");
const CHILD_PROCESS_STOP_SIGNAL = "SIGTERM";
const RESTART_DELAY = 5; // In seconds
const STOP_DELAY_S = 3; // In seconds

/**
 * The runner class.
 * @class
 */
class SmartiesRunner {
    /**
     * Constructor
     *
     * @returns {SmartiesRunner} The instance
     */
    constructor() {
        this.core = null;
        this.runnerEventBus = new events.EventEmitter();
        this.childPids = [];

        const self = this;
        this.runnerEventBus.on(SmartiesRunnerConstants.RESTART, () => {
            setTimeout((me) => {
                me.restart(me);
            }, RESTART_DELAY * 1000, self);
        });

        try {
            if (!process.env.TEST) {
                try {
                    os.setPriority(process.pid, -20); // Highest priority
                } catch(e) {
                    Logger.err(e);
                }

                process.title = "smarties.io";
            }
            this.start(this);
        } catch (e) {
            Logger.err(e);
            fs.writeFileSync(SmartiesRunnerConstants.CRASH_FILE, JSON.stringify({message:e.message, stack:e.stack}));
            self.childPids.forEach((childPid) => {
                process.kill(childPid, CHILD_PROCESS_STOP_SIGNAL);
            });
            this.stop(this);
            process.exit(1);
        }
    }

    /**
     * Start core
     *
     * @param  {SmartiesRunner} self The instance
     */
    start(self) {
        if (!self.core) {
            this.runnerEventBus.on(SmartiesRunnerConstants.PID_SPAWN, (pid) => {
                try {
                    self.childPids.push(pid);
                } catch (e) {

                }
            });
            Logger.info("Starting runner");
            self.core = new SmartiesCore.class(self.runnerEventBus, SmartiesRunnerConstants);
            self.core.start();
        }
    }

    /**
     * Stop core
     *
     * @param  {SmartiesRunner} self The instance
     */
    stop(self) {
        if (self.core) {
            Logger.info("Sopping runner");
            this.runnerEventBus.emit(SmartiesRunnerConstants.STOP);
            self.core.stop();
            self.childPids.forEach((childPid) => {
                try {
                    process.kill(childPid, CHILD_PROCESS_STOP_SIGNAL);
                } catch (e) {

                }
            });
            self.runnerEventBus.eventNames().forEach((eventName) => {
                if (eventName !== SmartiesRunnerConstants.RESTART && eventName !== SmartiesRunnerConstants.STOP) {
                    self.runnerEventBus.removeAllListeners(eventName);
                }
            });

            self.core = null;
        }
    }

    /**
     * Restart core
     *
     * @param  {SmartiesRunner} self The instance
     */
    restart(self) {
        self.stop(self);
        self.start(self);
    }
}

if (process.argv.length > 2) {
    if (process.argv[2] == "create-plugin") {
        require("./scripts/create-plugin");
    } else if (process.argv[2] == "push-plugin") {
        require("./scripts/push-plugin");
    } else {
        console.log(colors.red("Invalid command"));
    }
} else {
    const runner = new SmartiesRunner();

    process.on("SIGINT", () => {
        Logger.info("Received SIGINT");
        runner.stop(runner);
        process.kill(process.pid, "SIGKILL");
        setTimeout(() => {
            process.exit(0);
        }, STOP_DELAY_S * 1000);
    });

    process.on("SIGTERM", () => {
        Logger.info("Received SIGTERM");
        runner.stop(runner);
        process.kill(process.pid, "SIGKILL");
        setTimeout(() => {
            process.exit(0);
        }, STOP_DELAY_S * 1000);
    });
}
