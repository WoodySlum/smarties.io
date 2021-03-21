"use strict";
const fs = require("fs-extra");

/**
 * Utility class for file locks
 *
 * @class
 */
class FileLock {
    /**
     * Constructor
     *
     * @param  {string} cachePath Temporary file
     * @param  {SchedulerService} schedulerService The scheduler service
     */
    constructor(cachePath, schedulerService) {
        this.path = cachePath;
        this.schedulerService = schedulerService;
    }

    /**
     * Create a lock file
     *
     * @param  {string} id An identifier
     */
    lock(id) {
        fs.writeFileSync(this.path + "lock-" + id, "lock");
    }

    /**
     * Check if it's locked
     *
     * @param  {string} id An identifier
     *
     * @return  {boolean} `true` if it's locked, `false` otherwise
     */
    isLocked(id) {
        if (fs.existsSync(this.path + "lock-" + id)) {
            return true;
        } else {
            return false;
        }
    }

    /**
     * Unlock previously locked
     *
     * @param  {string} id An identifier
     */
    unlock(id) {
        if (this.isLocked) {
            fs.removeSync(this.path + "lock-" + id);
            this.schedulerService.unregister("lock-" + id);
        }
    }

    /**
     * Unlock previously locked
     *
     * @param  {string} id An identifier
     * @param  {int} schedulerServiceDelay A cheduler service delay
     */
    unlockAfterDelay(id, schedulerServiceDelay) {
        const self = this;
        this.schedulerService.register("lock-" + id, (data) => {
            if (data.id) {
                self.unlock(data.id);
            }
        });
        this.schedulerService.schedule("lock-" + id, schedulerServiceDelay, {id:"lock-" + id});
    }
}

module.exports = {class:FileLock};
