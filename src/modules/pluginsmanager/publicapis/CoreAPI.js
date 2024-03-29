"use strict";
const PrivateProperties = require("./../PrivateProperties");

/**
 * Public API for core
 *
 * @class
 */
class CoreAPI {
    /* eslint-disable */
    // /**
    //  * Constructor
    //  *
    //  * @param  {EventEmitter} eventBus Core event bus
    //  * @param  {Object} appConfiguration Tha global configuration object
    //  * @returns {CoreAPI}             The instance
    //  */
    constructor(eventBus, appConfiguration) {
        PrivateProperties.createPrivateState(this);
        PrivateProperties.oprivate(this).eventBus = eventBus;
        PrivateProperties.oprivate(this).cachePath = appConfiguration.cachePath;
        this.registeredElements = [];
    }
    /* eslint-enable */


    /**
     * Dispatch an event through all registered modules
     *
     * @param  {string} name        An event name
     * @param  {object} [data=null] Some data
     */
    dispatchEvent(name, data = null) {
        // Dispatch event
        if (PrivateProperties.oprivate(this).eventBus) {
            PrivateProperties.oprivate(this).eventBus.emit(name, data);
        }
    }

    /**
     * Unregister to a specific event
     *
     * @param  {string}   name The event's name
     * @param  {Function} cb   A callback `(data) => {}``
     */
    unregisterEvent(name, cb) {
        if (PrivateProperties.oprivate(this).eventBus) {
            PrivateProperties.oprivate(this).eventBus.off(name, cb);
        }
    }

    /**
     * Register to a specific event
     *
     * @param  {string}   name The event's name
     * @param  {Function} cb   A callback `(data) => {}``
     */
    registerEvent(name, cb) {
        if (PrivateProperties.oprivate(this).eventBus) {
            PrivateProperties.oprivate(this).eventBus.on(name, cb);
            this.registeredElements.push({name: name, cb: cb});
        }
    }

    /**
     * Get the cache path
     *
     * @returns {string} A cache path
     */
    cachePath() {
        return PrivateProperties.oprivate(this).cachePath;
    }

}

module.exports = {class:CoreAPI};
