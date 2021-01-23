"use strict";
const onvif = require("onvif");

/**
 * Loaded function
 *
 * @param  {PluginAPI} api The api
 */
function loaded(api) {
    api.init();

    /**
     * This class is extended by cameras forms
     *
     * @class
     */
    class OnvifCameraForm extends api.exported.CameraForm {
        /**
         * Cemra form
         *
         * @param  {number} id              An identifier
         * @param  {string} plugin          A plugin
         * @param  {string} name            Camera's name
         * @param  {boolean} def            Camera's default
         * @param  {string} ip              Camera's IP
         * @param  {string} port              Camera's port
         * @param  {string} username          Camera's username
         * @param  {string} password          Camera's password
         * @param  {boolean} archive          Archive pictures
         * @param  {boolean} cv          Computer vision
         * @param  {boolean} cvfps          Computer vision FPS
         * @param  {boolean} cvlive          Computer vision live view
         * @returns {CameraForm}                 The instance
         */
        constructor(id, plugin, name, def = false, ip, port, username, password, archive = true, cv = false, cvfps = 3, cvlive = false) {
            super(id, plugin, name, def, ip, port, username, password, archive, cv, cvfps, cvlive);

            /**
             * @Property("ip");
             * @Type("string");
             * @Enum("getOnVifDevices");
             * @EnumNames("getOnVifDevices");
             */
            this.ip = ip;

            /**
             * @Property("port");
             * @Type("number");
             * @Hidden(true);
             * @Default(80);
             */
            this.port = port;
        }

        /**
         * Get onvif devices
         *
         * @param  {...object} inject The onvif devices list array
         * @returns {Array}        The onvif devices
         */
        static getOnVifDevices(...inject) {
            return inject[0];
        }

        /**
         * Convert JSON data to object
         *
         * @param  {object} data Some data
         * @returns {CameraForm}      An instance
         */
        json(data) {
            return super.json(data);
        }
    }

    api.cameraAPI.registerForm(OnvifCameraForm, []);
    const hostnames = [];
    const ports = {};
    onvif.Discovery.on("device", (cam) => {
        hostnames.push(cam.hostname);
        api.cameraAPI.registerForm(OnvifCameraForm, hostnames);
        ports[cam.hostname] = cam.port;
    });
    onvif.Discovery.probe();


    /**
     * Sumpple camera class
     *
     * @class
     */
    class Onvif extends api.exported.Camera {
        /**
         * Sumpple camera
         *
         * @param  {PluginAPI} api                                                           A plugin api
         * @param  {number} [id=null]                                                        An id
         * @param  {object} [configuration=null]                                             The configuration for camera
         * @returns {Sumpple}                                                                  The instance
         */
        constructor(api, id, configuration) {
            super(api, id, configuration);
            this.mjpegUrl = false;
            this.cam = null;
            if (this.configuration && this.configuration.ip) {
                if (ports[this.configuration.ip]) {
                    this.configuration.port = parseInt(ports[this.configuration.ip]);
                    this.updateConfiguration();
                }

                if (this.configuration.snapshotUrl) {
                    this.snapshotUrl = this.configuration.snapshotUrl;
                }

                if (this.configuration.rtspUrl) {
                    this.rtspUrl = this.configuration.rtspUrl;
                }

                this.cam = new onvif.Cam({
                    hostname: this.configuration.ip,
                    username: this.configuration.username,
                    password: this.configuration.password,
                    port: this.configuration.port
                }, (err) => {
                    if (err) {
                        api.exported.Logger.err(err);
                    } else {
                        this.cam.getSnapshotUri((err, res) => {
                            if (err) {
                                api.exported.Logger.err(err);
                            } else {
                                this.snapshotUrl = res.uri.replace(/\n/g, "").replace(/\r/g, "");
                                this.configuration.snapshotUrl = this.snapshotUrl;
                                api.configurationAPI.saveData(this.configuration);
                            }

                            this.cam.getStreamUri((err, res) => {
                                if (err) {
                                    api.exported.Logger.err(err);
                                } else {
                                    this.rtspUrl = res.uri.replace(/\n/g, "").replace(/\r/g, "");
                                    this.configuration.rtspUrl = this.rtspUrl;
                                    api.configurationAPI.saveData(this.configuration);
                                }
                            });
                        });
                    }
                });
            }
        }

    }

    api.cameraAPI.registerClass(Onvif);
}

module.exports.attributes = {
    loadedCallback: loaded,
    name: "onvif",
    version: "0.0.0",
    category: "camera",
    description: "Onvif camera protocol",
    defaultDisabled: false,
    dependencies:["camera"]
};
