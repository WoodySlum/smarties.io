"use strict";
const request = require("request");

/**
 * Loaded function
 *
 * @param  {PluginAPI} api The api
 */
function loaded(api) {
    api.init();

    /**
     * Robonect form camera
     *
     * @class
     */
    class RobonectCameraForm extends api.exported.CameraForm {
        /**
         * Convert JSON data to object
         *
         * @param  {object} data Some data
         * @returns {RobonectCameraForm}      An instance
         */
        json(data) {
            super.json(data);
        }
    }

    api.cameraAPI.registerForm(RobonectCameraForm);

    /**
     * RobonectCamera class
     *
     * @class
     */
    class RobonectCamera extends api.exported.Camera {
        /**
         * Ctronics camera
         *
         * @param  {PluginAPI} api                                                           A plugin api
         * @param  {number} [id=null]                                                        An id
         * @param  {object} [configuration=null]                                             The configuration for camera
         * @returns {RobonectCamera}                                                                  The instance
         */
        constructor(api, id, configuration) {
            super(api, id, configuration, "cam.jpg?v=1", null, null, "-", "-", "-", "-");
        }

        /**
         * Move left camera
         */
        moveLeft() {
            const token = api.getPluginInstance("robonect").manToken;
            this.leftUrl = this.generateUrlFromTemplate("json?cmd=joystick&t=" + token + "&x=-50&y=0");
            super.moveLeft();
        }

        /**
         * Move right camera
         */
        moveRight() {
            const token = api.getPluginInstance("robonect").manToken;
            this.rightUrl = this.generateUrlFromTemplate("json?cmd=joystick&t=" + token + "&x=50&y=0");
            super.moveRight();
        }

        /**
         * Move up camera
         */
        moveUp() {
            const token = api.getPluginInstance("robonect").manToken;
            this.upUrl = this.generateUrlFromTemplate("json?cmd=joystick&t=" + token + "&x=0&y=50");
            super.moveUp();
        }

        /**
         * Move down camera
         */
        moveDown() {
            const token = api.getPluginInstance("robonect").manToken;
            this.downUrl = this.generateUrlFromTemplate("json?cmd=joystick&t=" + token + "&x=0&y=-50");
            super.moveDown();
        }

    }

    api.cameraAPI.registerClass(RobonectCamera);
}

module.exports.attributes = {
    loadedCallback: loaded,
    name: "robonect-camera",
    version: "0.0.1",
    category: "camera",
    description: "Robonect camera",
    defaultDisabled: true,
    dependencies:["camera", "robonect"]
};
