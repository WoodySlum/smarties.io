"use strict";
const Logger = require("./../../logger/Logger");
const Service = require("./../../services/Service");
const TimeEventService = require("./../../services/timeeventservice/TimeEventService");
const isPidRunning = require("is-running");

/**
 * This class allows to manage services
 *
 * @class
 */
class ServicesManager {
    /**
     * Constructor
     *
     * @param  {ThreadsManager} threadsManager A thread manager
     * @param  {EventEmitter} eventBus    The global event bus
     * @param  {object} smartiesRunnerConstants Runner constants
     * @param  {TimeEventService} timeEventService    The time event service
     *
     * @returns {ServicesManager}                       The instance
     */
    constructor(threadsManager, eventBus, smartiesRunnerConstants, timeEventService) {
        this.services = [];
        this.threadsManager = threadsManager;
        this.eventBus = eventBus;
        this.smartiesRunnerConstants = smartiesRunnerConstants;
        this.timeEventService = timeEventService;

        // Watchdog
        timeEventService.register((self) => {
            self.services.forEach((service) => {
                if (service.mode === Service.SERVICE_MODE_EXTERNAL && service.status == Service.RUNNING) {
                    if (!isPidRunning(service.pid)) {
                        Logger.warn("[Watchdog] Pid " + service.pid + " is not running, restarting service");
                        service.restart();
                    }
                }
            });
        }, this, TimeEventService.EVERY_TEN_SECONDS);
    }

    /**
     * Check if a service has been already registered
     *
     * @param  {Service}  service A service
     * @returns {int}   -1 if not found, else the index
     */
    isServiceRegistered(service) {
        let found = -1;
        let i = 0;
        this.services.forEach((registeredService) => {
            if (registeredService.name === service.name) {
                found = i;
            }
            i++;
        });
        return found;
    }

    /**
     * Add a service to services pool
     *
     * @param {Service} service A service
     */
    add(service) {
        if (this.isServiceRegistered(service) === -1) {
            if (this.threadsManager) {
                service.setThreadsManager(this.threadsManager);
            }
            this.services.push(service);
        } else {
            Logger.warn("Service " + service.name + " already registered");
        }
    }

    /**
     * Remove a service to services pool
     *
     * @param {Service} service A service
     */
    remove(service) {
        let index = this.isServiceRegistered(service);
        if (index >= 0) {
            this.services.splice(index, 1);
        } else {
            Logger.warn("Service " + service.name + " not registered");
        }
    }

    /**
     * Start services
     * Can potentially throw Errors
     */
    start() {
        this.services.forEach((service) => {
            if (!service.disableAutoStart) {
                service.start();
            }
            if (!process.env.TEST) {
                if (service.pid != -1) {
                    this.eventBus.emit(this.smartiesRunnerConstants.PID_SPAWN, service.pid);
                }
            }
        });
    }

    /**
     * Start services
     * Can potentially throw Errors
     */
    stop() {
        this.services.forEach((service) => {
            service.stop();
        });
    }

    /**
     * Restart services
     * Can potentially throw Errors
     */
    restart() {
        this.services.forEach((service) => {
            service.restart();
        });
    }

    /**
     * Return the service from the name
     *
     * @param  {string} name Service name
     * @returns {Service}      The desired service, null if not found
     */
    getService(name) {
        let index = this.isServiceRegistered(new Service.class(name));
        if (index >= 0) {
            return this.services[index];
        } else {
            return null;
        }
    }

}

module.exports = {class:ServicesManager};
