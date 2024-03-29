"use strict";
const PrivateProperties = require("./../PrivateProperties");

/**
 * Public API for camera
 *
 * @class
 */
class CameraAPI {
    /* eslint-disable */
    // /**
    //  * Constructor
    //  *
    //  * @param  {FormManager} formManager A form manager
    //  * @param  {PluginAPI} plugin        Plugin API
    //  * @param  {CamerasManager} camerasManager        The cameras manager
    //  * @return {CameraAPI}             The instance
    //  */
    constructor(formManager, plugin, camerasManager) {
        PrivateProperties.createPrivateState(this);
        PrivateProperties.oprivate(this).formManager = formManager;
        PrivateProperties.oprivate(this).plugin = plugin;
        PrivateProperties.oprivate(this).camerasManager = camerasManager;
        this.form = null;
        this.cameraClass = null;
    }
    /* eslint-enable */

    /**
     * Register a camera form
     *
     * @param  {Class} formClass A form annotation's implemented class
     * @param  {...object} inject    The injected objects
     */
    registerForm(formClass, ...inject) {
        this.form = formClass;
        PrivateProperties.oprivate(this).formManager.registerWithAdditionalFields(formClass,{plugin:[{ key: "Type", value: "string" },{ key: "Hidden", value: true },{ key: "Default", value: PrivateProperties.oprivate(this).plugin.identifier}]}, ...inject);
        PrivateProperties.oprivate(this).plugin.exportClass(formClass);
    }

    /**
     * Register a camera class
     *
     * @param  {Class} c A camera extended class
     */
    registerClass(c) {
        this.cameraClass = c;
        PrivateProperties.oprivate(this).plugin.exportClass(c);
    }

    /**
     * Get all cameras
     *
     * @returns {object} On object with id:name
     */
    getCameras() {
        return PrivateProperties.oprivate(this).camerasManager.getAllCameras();
    }

    /**
     * Get a picture
     *
     * @param  {number}   id Camera identifier
     * @param  {Function} cb         A callback with error, image buffer and mime type. Example : `(err, data, mime) => {}`
     * @param  {number}   [timestamp=null] The timestamp of the picture. If `null`, live snapshot.
     */
    getImage(id, cb, timestamp = null) {
        return PrivateProperties.oprivate(this).camerasManager.getImage(id, cb, timestamp);
    }

    /**
     * Record a video session for a specific camera
     *
     * @param  {number}   id         The camera identifier
     * @param  {Function} cb         A callback `(err, generatedFilepath, key, link) => {}`
     * @param  {number}   [timer=60] Duration of capture in seconds
     * @param  {boolean}   [sendMessage=true] Send message to users when record is done
     */
    record(id, cb, timer = 60, sendMessage = true) {
        return PrivateProperties.oprivate(this).camerasManager.record(id, cb, timer, sendMessage);
    }

    /**
     * Get available detected objects list for computer vision
     *
     * @returns {Array}                      The detected objects
     */
    getAvailableDetectedObjects() {
        return PrivateProperties.oprivate(this).camerasManager.getAvailableDetectedObjects();
    }

    /**
     * Register to camera events with computer vision
     *
     * @param  {string}   [cameraId="*"] Camera identifier. `*` if all camera needed
     * @param  {string|Array}   [detectedObject="*"] Detected objects on computer vision
     * @param  {string}   key         The register key
     * @param  {Function} cb         A callback `(cameraId, detectedObject, confidence, cvData, img, drawedImg) => {}`
     */
    registerCameraEvent(cameraId = "*", detectedObject = "*", key, cb) {
        PrivateProperties.oprivate(this).camerasManager.registerCameraEvent(cameraId, detectedObject, key, cb);
    }

    /**
     * Unregister to camera events with computer vision
     *
     * @param  {string}   key         The register key
     */
    unregisterCameraEvent(key) {
        PrivateProperties.oprivate(this).camerasManager.unregisterCameraEvent(key);
    }

    /**
     * Save camera configuration
     *
     * @param  {object} cameraConfiguration The camera configuration
     */
    saveConfiguration(cameraConfiguration) {
        PrivateProperties.oprivate(this).camerasManager.saveCamera(cameraConfiguration);
    }

    /**
     * Get the camera Object
     *
     * @param  {number} id Camera identifier
     * @returns {Camera}    A camera extended object. Returns null if nothing found.
     */
    getCamera(id) {
        return PrivateProperties.oprivate(this).camerasManager.getCamera(id);
    }
}

module.exports = {class:CameraAPI};
