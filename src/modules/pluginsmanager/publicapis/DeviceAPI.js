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
     * Switch a device status
     *
     * @param  {number} id            A device identifier
     * @param  {string} [status=null] A status  (`on`, `off` or int status)
     * @param  {int} [brightness=0] Brightness (between 0 and 1)
     * @param  {string} [color=FFFFFF] Color (hex color)
     * @param  {int} [colorTemperature=0] Color temperature (between 0 and 1)
     */
    switchDevice(id, status = null, brightness = 0, color = "FFFFFF", colorTemperature = 0) {
        PrivateProperties.oprivate(this).deviceManager.switchDevice(id, status, brightness, color, colorTemperature);
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
     * @param  {...Object} inject    The injected objects
     */
    addForm(key, form, title, isList = false, ...inject) {
        PrivateProperties.oprivate(this).deviceManager.formManager.register(form, ...inject);
        PrivateProperties.oprivate(this).deviceManager.addForm(key, form, title, isList);
    }

    /**
     * Register a switch device function
     * The method `addForm` should be called before
     *
     * @param  {string}   key A key, the same as set in `addForm`
     * @param  {Function} cb  The callback when a device switches `(device, formData, deviceStatus) => {}`. Please note that this callback can return a DeviceStatus object to save state. You can modify and return the status as parameter.
     * @param  {string} type  The device type, constant can be `DEVICE_TYPE_LIGHT`, `DEVICE_TYPE_LIGHT_DIMMABLE`, `DEVICE_TYPE_LIGHT_DIMMABLE_COLOR`, `DEVICE_TYPE_SHUTTER`
     */
    registerSwitchDevice(key, cb, type) {
        PrivateProperties.oprivate(this).deviceManager.registerSwitchDevice(key, cb, type);
    }

    /**
     * Save a device
     *
     * @param  {Object} device A device
     */
    saveDevice(device) {
        PrivateProperties.oprivate(this).deviceManager.saveDevice(device);
    }

    /**
     * Returns the supported modes for a specific device (e.g. light, dimmable, color, ...)
     *
     * @param  {Object} device A device
     * @returns {[string]}        The list of supported modes
     */
    getDeviceTypes(device) {
        return PrivateProperties.oprivate(this).deviceManager.getDeviceTypes(device);
    }

    /**
     * Returns a device from an identifier
     *
     * @param  {string} id An identifier
     * @returns {Object}    A device
     */
    getDeviceById(id) {
        return PrivateProperties.oprivate(this).deviceManager.getDeviceById(id);
    }

    /**
     * Switch device with a device object
     *
     * @param  {Object} device A device
     */
    switchDeviceWithDevice(device) {
        PrivateProperties.oprivate(this).deviceManager.switchDeviceWithDevice(device);
    }

    /**
     * Get db helper
     *
     * @returns {DbHelper} The device DbHelper object
     */
    getDbHelper() {
        return PrivateProperties.oprivate(this).deviceManager.getDbHelper();
    }

    /**
     * Guess a device status and brightness with machine learning
     *
     * @param  {number} timestamp   The projected timestamp
     * @param  {string} [identifier=null]     A device identifier. If this parameter is set, there is no need to set `room` and `name`
     * @param  {string} [status=null]     A status (INT_STATUS_ON or INT_STATUS_OFF)
     * @param  {string} [room=null]     A room
     * @param  {string} [name=null]     A sensor name
     * @param  {Function} [cb=null]    A callback. If not provided, a promise will be returned. Example : `(err, status, brightness) => {}`
     *
     * @returns {Promise|null} If cb is not provided, a promise will be returned.
     */
    guessDeviceStatus(timestamp, identifier = null, status = null, room = null, name = null, cb = null) {
        return PrivateProperties.oprivate(this).deviceManager.guessDeviceStatus(timestamp, identifier, status, room, name, cb);
    }
}

module.exports = {class:DeviceAPI};
