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
     * This class is extended by cameras forms
     *
     * @class
     */
    class CameraForm extends api.exported.FormObject.class {
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
         * @param  {string} rotation          Rotation
         * @param  {string} ffmpeg          FFMPEG options
         * @returns {CameraForm}                 The instance
         */
        constructor(id, plugin, name, def = false, ip, port, username, password, archive = true, cv = false, cvfps = 3, cvlive = false, rotation = "0", ffmpeg) {
            super(id);

            this.plugin = plugin;

            /**
             * @Property("name");
             * @Title("camera.name");
             * @Type("string");
             * @Required(true);
             */
            this.name = name;

            /**
             * @Property("def");
             * @Title("camera.default");
             * @Type("boolean");
             * @Default(false);
             */
            this.def = def;

            /**
             * @Property("ip");
             * @Type("object");
             * @Cl("IpScanForm");
             * @Required(true);
             */
            this.ip = ip;

            /**
             * @Property("port");
             * @Title("camera.form.port");
             * @Type("number");
             * @Required(true);
             * @Min(1);
             * @Max(65535);
             * @Default(80);
             */
            this.port = port;

            /**
             * @Property("username");
             * @Title("camera.form.username");
             * @Type("string");
             * @Required(false);
             */
            this.username = username;

            /**
             * @Property("password");
             * @Title("camera.form.password");
             * @Type("string");
             * @Required(false);
             * @Display("password");
             */
            this.password = password;

            /**
             * @Property("archive");
             * @Title("camera.form.archive");
             * @Type("boolean");
             * @Default(true);
             */
            this.archive = archive;

            /**
             * @Property("rotation");
             * @Title("camera.form.rotation");
             * @Type("string");
             * @Default("0");
             * @Enum(["0", "90", "180", "270"]);
             * @EnumNames(["0°", "90°", "180°", "270°"]);
             */
            this.rotation = rotation;

            /**
             * @Property("cv");
             * @Title("camera.form.cv");
             * @Type("boolean");
             * @Default(false);
             */
            this.cv = cv;

            /**
             * @Property("cvfps");
             * @Title("camera.form.cv.fps");
             * @Type("number");
             * @Default(3);
             * @Range([0, 120, 1]);
             */
            this.cvfps = cvfps;

            /**
             * @Property("cvlive");
             * @Title("camera.form.cv.live");
             * @Type("boolean");
             * @Default(false);
             */
            this.cvlive = cvlive;

            /**
             * @Property("ffmpeg");
             * @Title("camera.form.ffmpeg");
             * @Type("string");
             * @Default("-codec:a mp2 -ar 44100");
             */
            this.ffmpeg = ffmpeg;
        }

        /**
         * Convert JSON data to object
         *
         * @param  {object} data Some data
         * @returns {CameraForm}      An instance
         */
        json(data) {
            return new CameraForm(data.id, data.plugin, data.name, data.def, data.ip, data.port, data.username, data.password, data.archive, data.cv, data.cvfps, data.cvlive, data.rotation);
        }
    }

    api.cameraAPI.registerForm(CameraForm);

    /**
     * This class is extended by cameras
     *
     * @class
     */
    class Camera {

        /**
         * Camera class (should be extended)
         *
         * @param  {PluginAPI} api                                                           A plugin api
         * @param  {number} [id=null]                                                        An id
         * @param  {object} [configuration=null]                                             The configuration for camera
         * @param  {string} [snapshotUrl=null]   The snapshot URL template (Parameters : %port%, %ip%, %username%, %password%), without protocol and ip. For example, `cgi-bin/snap.cgi?username=%username%&password=%password%`
         * @param  {string} [mjpegUrl=null]      The MJPEG URL template (Parameters : %port%, %ip%, %username%, %password%), without protocol and ip. For example, `cgi-bin/videostream.cgi?username=%username%&password=%password%`
         * @param  {string} [rtspUrl=null]       The RTSP URL template (Parameters : %port%, %ip%, %username%, %password%), without protocol and ip. For example, `cgi-bin/snap.cgi?username=%username%&password=%password%`
         * @param {[type]} [leftUrl=null]       The left URL template  (Parameters : %port%, %ip%, %username%, %password%), without protocol and ip. For example, `cgi-bin/move.cgi?username=%username%&password=%password%`
         * @param {[type]} [rightUrl=null]      The right URL template  (Parameters : %port%, %ip%, %username%, %password%), without protocol and ip. For example, `cgi-bin/move.cgi?username=%username%&password=%password%`
         * @param {[type]} [upUrl=null]         The up URL template  (Parameters : %port%, %ip%, %username%, %password%), without protocol and ip. For example, `cgi-bin/move.cgi?username=%username%&password=%password%`
         * @param {[type]} [downUrl=null]       The down URL template  (Parameters : %port%, %ip%, %username%, %password%), without protocol and ip. For example, `cgi-bin/move.cgi?username=%username%&password=%password%`
         * @param  {Function} [leftCb=null]        Move left callback
         * @param  {Function} [rightCb=null]       Move right callback
         * @param  {Function} [upCb=null]          Move up callback
         * @param  {Function} [downCb=null]        Move down callback
         * @returns {Camera}                      The instance
         */
        constructor(api, id = null, configuration = null, snapshotUrl = null, mjpegUrl = null, rtspUrl = null, leftUrl = null, rightUrl = null, upUrl = null, downUrl = null, leftCb = null, rightCb = null, upCb = null, downCb = null) {
            this.api = api;
            this.id = id;
            this.configuration = configuration;
            this.name = this.configuration.name;
            this.def = this.configuration.def;
            this.leftUrl = this.generateUrlFromTemplate(leftUrl);
            this.rightUrl = this.generateUrlFromTemplate(rightUrl);
            this.upUrl = this.generateUrlFromTemplate(upUrl);
            this.downUrl = this.generateUrlFromTemplate(downUrl);
            this.leftCb = leftCb;
            this.rightCb = rightCb;
            this.upCb = upCb;
            this.downCb = downCb;
            this.snapshotUrl = this.generateUrlFromTemplate(snapshotUrl);
            this.mjpegUrl = this.generateUrlFromTemplate(mjpegUrl);
            this.rtspUrl = this.generateUrlFromTemplate(rtspUrl, true);
            this.archive = (this.configuration.archive ? true : false);
        }

        /**
         * Needs to be call when camera is ready
         */
        init() {

        }

        /**
         * Does the plugin suppport mjpeg stream
         *
         * @returns {boolean} true if supported, false otherwise
         */
        mjpegSupport() {
            return this.mjpegUrl?true:false;
        }

        /**
         * Does the plugin suppport rtsp stream
         *
         * @returns {boolean} true if supported, false otherwise
         */
        rtspSupport() {
            return this.rtspUrl?true:false;
        }

        /**
         * Does the plugin suppport moves
         *
         * @returns {boolean} true if supported, false otherwise
         */
        moveSupport() {
            return (((this.leftUrl && this.leftUrl != "")|(this.rightUrl && this.rightUrl != "")|(this.upUrl && this.upUrl != "")|(this.downUrl && this.downUrl != ""))?true:false);
        }

        /**
         * Generate an URL from the template
         *
         * @param  {string} [url=null] An URL template (Parameters : %port%, %ip%, %username%, %password%), without protocol and ip. For example, `cgi-bin/videostream.cgi?username=%username%&password=%password%`
         * @param  {boolean} [rtsp=false] An URL template (Parameters : %port%, %ip%, %username%, %password%), without protocol and ip. For example, `cgi-bin/videostream.cgi?username=%username%&password=%password%`
         * @returns {string}            The complete URL
         */
        generateUrlFromTemplate(url = null, rtsp = false) {
            if (url && url.length > 0) {
                let pUrl = "http://";
                if (this.configuration.port) {
                    if (this.configuration.port === 443) {
                        pUrl = "https://";
                    }
                }
                if (rtsp) {
                    pUrl = "rtsp://";
                } else if (this.configuration.username && this.configuration.password){
                    pUrl += encodeURIComponent(this.configuration.username) + ":" + encodeURIComponent(this.configuration.password) + "@";
                }

                pUrl += ((this.configuration.ip.ip === "freetext") ? this.configuration.ip.freetext : this.configuration.ip.ip) + (rtsp ? "" : ":" + this.configuration.port);
                pUrl += "/" + url;

                pUrl = pUrl.replace("%username%", this.configuration.username);
                pUrl = pUrl.replace("%password%", this.configuration.password);

                return pUrl;
            }

            return null;
        }

        /**
         * Move left camera
         */
        moveLeft() {
            if (this.leftUrl) {
                request(this.leftUrl, (err) => {
                    if (this.leftCb) {
                        this.leftCb(err);
                    }
                });
            } else {
                if (this.leftCb) {
                    this.leftCb(Error("No left camera url define"));
                }
            }
        }

        /**
         * Move right camera
         */
        moveRight() {
            if (this.rightUrl) {
                request(this.rightUrl, (err) => {
                    if (this.rightCb) {
                        this.rightCb(err);
                    }
                });
            } else {
                if (this.rightCb) {
                    this.rightCb(Error("No right camera url define"));
                }
            }
        }

        /**
         * Move up camera
         */
        moveUp() {
            if (this.upUrl) {
                request(this.upUrl, (err) => {
                    if (this.upCb) {
                        this.upCb(err);
                    }
                });
            } else {
                if (this.upCb) {
                    this.upCb(Error("No up camera url define"));
                }
            }
        }

        /**
         * Move down camera
         */
        moveDown() {
            if (this.downUrl) {
                request(this.downUrl, (err) => {
                    if (this.downCb) {
                        this.downCb(err);
                    }
                });
            } else {
                if (this.downCb) {
                    this.downCb(Error("No down camera url define"));
                }
            }
        }

        /**
         * Save configuration
         */
        updateConfiguration() {
            this.api.cameraAPI.saveConfiguration(this.configuration);
        }
    }

    api.cameraAPI.registerClass(Camera);
}

module.exports.attributes = {
    loadedCallback: loaded,
    name: "camera",
    version: "0.0.0",
    category: "camera-base",
    description: "Camera base plugin"
};
