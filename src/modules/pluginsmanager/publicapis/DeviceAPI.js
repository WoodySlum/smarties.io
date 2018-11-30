"use strict";
const PrivateProperties = require("./../PrivateProperties");
const Cleaner = require("./../../../utils/Cleaner");
const DeviceManager = require("./../../devicemanager/DeviceManager");

/**
 * Public API for devices
 * @class
 */
class DeviceAPI {
    /* eslint-disable */
    // /**
    //  * Constructor
    //  *
    //  * @param  {DeviceManager} deviceManager The device manager
    //  * @returns {DeviceAPI}             The instance
    //  */
    constructor(deviceManager) {
        PrivateProperties.createPrivateState(this);
        PrivateProperties.oprivate(this).deviceManager = deviceManager;
    }
    /* eslint-enable */

    /**
     * Return the list of devices
     *
     * @returns {Array} The list of devices
     */
    getDevices() {
        return PrivateProperties.oprivate(this).deviceManager.getDevices();
    }

    /**
     * Switch a device radio status
     *
     * @param  {number} id            A device identifier
     * @param  {string} [status=null] A status  (`on`, `off` or radio status)
     */
    switchDevice(id, status = null) {
        PrivateProperties.oprivate(this).deviceManager.switchDevice(id, status);
    }

    /**
     * Expose a list of constants (status)
     *
     * @returns {Object} Constants
     */
    constants() {
        return Cleaner.class.exportConstants(DeviceManager);
    }

    /**
     * Return a status of a device
     *
     * @param  {number} id            A device identifier
     * @returns {boolean} Status of the device
     */
    getDeviceStatus(id) {
        return PrivateProperties.oprivate(this).deviceManager.getDeviceStatus(id);
    }

    /**
     * Add a form device part
     *
     * @param {string}  key          A key
     * @param {Form}  form           A form
     * @param {string}  title          A title
     * @param {boolean} [isList=false] `true` if this is a list of subforms, `false` otherwise
     */
    addForm(key, form, title, isList = false) {
        PrivateProperties.oprivate(this).deviceManager.addForm(key, form, title, isList);
    }

    /**
     * Register a switch device function
     * The method `addForm` should be called before
     *
     * @param  {string}   key A key, the same as set in `addForm`
     * @param  {Function} cb  The callback when a device switches `switch(device, formData, deviceStatus) => {}`. Please note that this callback can return a DeviceStatus object to save state. You can modify and return the status as parameter.
     */
    registerSwitchDevice(key, cb) {
        PrivateProperties.oprivate(this).deviceManager.registerSwitchDevice(key, cb);
    }
}

module.exports = {class:DeviceAPI};
