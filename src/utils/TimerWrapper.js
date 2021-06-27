"use strict";

const Logger = require("./../logger/Logger");

const intervalTimers = [];
const timeoutTimers = [];
const immediateTimers = [];

/**
 * Utility class for timers
 *
 * @class
 */
class TimerWrapper {
    /**
     * Set interval wrapper
     *
     * @param  {Function} f     Function
     * @param  {number} time     Time
     * @param  {...object} p Parameters
     *
     * @return {object}  Object
     */
    static setInterval(f, time, ...p) {
        const r = setInterval(f, time, ...p);
        intervalTimers.push(r);
        return r;
    }

    /**
     * Clear interval wrapper
     *
     * @param  {object} n     Object
     */
    static clearInterval(n) {
        const i = intervalTimers.indexOf(n);
        if (i !== -1) {
            intervalTimers.splice(i, 1);
        }
        clearInterval(n);
    }

    /**
     * Set timeout wrapper
     *
     * @param  {Function} f     Function
     * @param  {number} time     Time
     * @param  {...object} p Parameters
     *
     * @return {object}  Object
     */
    static setTimeout(f, time, ...p) {
        const r = setTimeout(f, time, ...p);
        timeoutTimers.push(r);
        return r;
    }

    /**
     * Clear timeout wrapper
     *
     * @param  {object} n     Object
     */
    static clearTimeout(n) {
        const i = timeoutTimers.indexOf(n);
        if (i !== -1) {
            timeoutTimers.splice(i, 1);
        }
        clearTimeout(n);
    }

    /**
     * Set immediate wrapper
     *
     * @param  {Function} f     Function
     * @param  {...object} p Parameters
     *
     * @return {object}  Object
     */
    static setImmediate(f, ...p) {
        const r = setImmediate(f, ...p);
        immediateTimers.push(r);
        return r;
    }

    /**
     * Clear immediate wrapper
     *
     * @param  {object} n     Object
     */
    static clearImmediate(n) {
        const i = immediateTimers.indexOf(n);
        if (i !== -1) {
            immediateTimers.splice(i, 1);
        }
        clearImmediate(n);
    }

    /**
     * Clear all
     */
    static clearAll() {
        Logger.info("Clearing all timers");

        for (let i = 0 ; i < intervalTimers.length ; i++) {
            clearImmediate(intervalTimers[i]);
        }
        intervalTimers.splice(0, intervalTimers.length);

        for (let i = 0 ; i < timeoutTimers.length ; i++) {
            clearImmediate(timeoutTimers[i]);
        }
        timeoutTimers.splice(0, timeoutTimers.length);

        for (let i = 0 ; i < immediateTimers.length ; i++) {
            clearImmediate(immediateTimers[i]);
        }
        immediateTimers.splice(0, immediateTimers.length);
    }
}

module.exports = {class: TimerWrapper};
