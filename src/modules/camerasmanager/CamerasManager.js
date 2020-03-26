"use strict";
const request = require("request");
const MjpegProxy = require("./MjpegProxy");
const cv = require("opencv4nodejs");
const fs = require("fs-extra");
const sha256 = require("sha256");
const Logger = require("./../../logger/Logger");
const PluginsManager = require("./../pluginsmanager/PluginsManager");
const WebServices = require("./../../services/webservices/WebServices");
const APIResponse = require("./../../services/webservices/APIResponse");
const Authentication = require("./../authentication/Authentication");
const DateUtils = require("./../../utils/DateUtils");
const CamerasForm = require("./CamerasForm");
const CamerasListForm = require("./CamerasListForm");
const Tile = require("./../dashboardmanager/Tile");
const Icons = require("./../../utils/Icons");
const ImageUtils = require("./../../utils/ImageUtils");
const TimeEventService = require("./../../services/timeeventservice/TimeEventService");
const TimelapseGenerator = require("./TimelapseGenerator");
const CameraRecordScenarioForm = require("./CameraRecordScenarioForm");

const CONF_MANAGER_KEY = "cameras";
const CAMERAS_MANAGER_AVAILABLE_GET = ":/cameras/available/get/";
const CAMERAS_MANAGER_POST_BASE = ":/cameras/set";
const CAMERAS_MANAGER_POST = CAMERAS_MANAGER_POST_BASE + "/[id*]/";
const CAMERAS_MANAGER_GET = ":/cameras/get/";
const CAMERAS_MANAGER_DEL_BASE = ":/cameras/del";
const CAMERAS_MANAGER_DEL = CAMERAS_MANAGER_DEL_BASE + "/[id*]/";
const CAMERAS_MANAGER_TIMELAPSE_DAILY_STREAM_BASE = ":/camera/timelapse/daily/stream/";
const CAMERAS_MANAGER_TIMELAPSE_DAILY_STREAM = CAMERAS_MANAGER_TIMELAPSE_DAILY_STREAM_BASE + "[id]/";
const CAMERAS_MANAGER_TIMELAPSE_DAILY_GET_BASE = ":/camera/timelapse/daily/get/";
const CAMERAS_MANAGER_TIMELAPSE_DAILY_GET = CAMERAS_MANAGER_TIMELAPSE_DAILY_GET_BASE + "[id]/";
const CAMERAS_MANAGER_TIMELAPSE_SEASON_STREAM_BASE = ":/camera/timelapse/season/stream/";
const CAMERAS_MANAGER_TIMELAPSE_SEASON_STREAM = CAMERAS_MANAGER_TIMELAPSE_SEASON_STREAM_BASE + "[id]/";
const CAMERAS_MANAGER_TIMELAPSE_SEASON_GET_BASE = ":/camera/timelapse/season/get/";
const CAMERAS_MANAGER_TIMELAPSE_SEASON_GET = CAMERAS_MANAGER_TIMELAPSE_SEASON_GET_BASE + "[id]/";
const CAMERAS_MANAGER_TIMELAPSE_GENERATE_POST_BASE = ":/camera/timelapse/set/";
const CAMERAS_MANAGER_TIMELAPSE_GENERATE_POST = CAMERAS_MANAGER_TIMELAPSE_GENERATE_POST_BASE + "[id]/[duration]/";
const CAMERAS_MANAGER_TIMELAPSE_STATUS_GET_BASE = ":/camera/timelapse/status/get/";
const CAMERAS_MANAGER_TIMELAPSE_STATUS_GET = CAMERAS_MANAGER_TIMELAPSE_STATUS_GET_BASE + "[token]/";
const CAMERAS_MANAGER_TIMELAPSE_GET_BASE = ":/camera/timelapse/get/";
const CAMERAS_MANAGER_TIMELAPSE_GET = CAMERAS_MANAGER_TIMELAPSE_GET_BASE + "[token]/";
const CAMERAS_MANAGER_TIMELAPSE_STREAM_BASE = ":/camera/timelapse/stream/";
const CAMERAS_MANAGER_TIMELAPSE_STREAM = CAMERAS_MANAGER_TIMELAPSE_STREAM_BASE + "[token]/";
const CAMERAS_MANAGER_RECORD_GET_BASE = ":/camera/record/get/";
const CAMERAS_MANAGER_RECORD_GET = CAMERAS_MANAGER_RECORD_GET_BASE + "[recordKey]/";
const CAMERAS_MANAGER_RECORD_GET_TOKEN_DURATION = 7 * 24 * 60 * 60;
const CAMERAS_RESTREAM_AFTER_REQ_ABORT_DURATION = 5000;
const CAMERAS_RESTREAM_AFTER_UNREACH_DURATION = 30000;
const CAMERAS_RECONNECT_S = 1 * 90 * 60; // Restart stream every to avoid camera overhead / network congestion
const CAMERAS_PAUSE_ON_RECONNECT_S = 2 * 60; // After restart stream, wait for this time before restream.

const CAMERAS_MANAGER_LIST = ":/cameras/list/";
const CAMERAS_RETRIEVE_BASE = ":/camera/get/";
const CAMERAS_RETRIEVE_GET = CAMERAS_RETRIEVE_BASE + "[mode]/[id]/[base64*]/[timestamp*]/";
const CAMERAS_MOVE_BASE = ":/camera/move/";
const CAMERAS_MOVE_SET = CAMERAS_MOVE_BASE + "[id]/[direction]/";

const MODE_STATIC = "static";
const MODE_MJPEG = "mjpeg";
const MODE_RTSP = "rtsp";

const DAILY_DURATION = 24 * 60 * 60;
const SEASON_DURATION = 100 * 12 * 30 * 24 * 60 * 60;
const CAMERAS_RETENTION_TIME = 60 * 60 * 24 * 7; // In seconds
const CAMERA_FILE_EXTENSION = ".JPG";
const CAMERA_SEASON_EXTENSION = "-season";
const CAMERA_DAILY_EXTENSION = "-daily";

const ERROR_ALREADY_REGISTERED = "Already registered";
const ERROR_NOT_REGISTERED = "Not registered";
const ERROR_UNKNOWN_IDENTIFIER = "Unknown camera identifier";
const ERROR_NO_URL_DEFINED = "No url defined";
const ERROR_UNKNOWN_MODE = "Unknown mode";
const ERROR_UNSUPPORTED_MODE = "Unsupported mode";
const ERROR_TIMELAPSE_NOT_GENERATED = "Timelapse not generated";
const ERROR_UNKNOWN_TIMELAPSE_TOKEN = "Unknown timelapse token";
const ERROR_UNEXISTING_PICTURE = "Unexisting picture";
const ERROR_RECORD_ALREADY_RUNNING = "Already recording camera";
const ERROR_RECORD_UNKNOWN = "Unknown record";

const AI_KEY = "cameras";

/**
 * This class allows to manage cameras
 * @class
 */
class CamerasManager {
    /**
     * Constructor
     *
     * @param  {PluginsManager} pluginsManager A plugin manager
     * @param  {EventEmitter} eventBus    The global event bus
     * @param  {WebServices} webServices    The web services
     * @param  {FormManager} formManager    The form manager
     * @param  {ConfManager} confManager    The configuration manager
     * @param  {TranslateManager} translateManager    The translate manager
     * @param  {ThemeManager} themeManager    The theme manager
     * @param  {DashboardManager} dashboardManager    The dashboard manager
     * @param  {TimeEventService} timeEventService    The time event service
     * @param  {Object} [camerasConfiguration=null]    Cameras configuration
     * @param  {string} [cachePath=null]    Temporary files path
     * @param  {string} [installationManager=null]    Installation manager
     * @param  {MessageManager} messageManager    The message manager
     * @param  {GatewayManager} gatewayManager    The gateway manager
     * @param  {ScenarioManager} scenarioManager    The scenario manager
     * @param  {AiManager} aiManager    The ai manager
     * @returns {CamerasManager}                       The instance
     */
    constructor(pluginsManager, eventBus, webServices, formManager, confManager, translateManager, themeManager, dashboardManager, timeEventService, camerasConfiguration = null, cachePath = null, installationManager = null, messageManager, gatewayManager, scenarioManager, aiManager) {
        this.pluginsManager = pluginsManager;
        this.webServices = webServices;
        this.formManager = formManager;
        this.confManager = confManager;
        this.translateManager = translateManager;
        this.themeManager = themeManager;
        this.dashboardManager = dashboardManager;
        this.timeEventService = timeEventService;
        this.camerasArchiveFolder = (camerasConfiguration && camerasConfiguration.archiveFolder)?camerasConfiguration.archiveFolder:"/tmp/";
        this.cachePath = (cachePath) ? cachePath : "/tmp/";
        this.enableHistory = (camerasConfiguration && camerasConfiguration.history)?camerasConfiguration.history:true;
        this.enableSeason = (camerasConfiguration && camerasConfiguration.season)?camerasConfiguration.season:true;
        this.enableTimelapse = (camerasConfiguration && camerasConfiguration.timelapse)?camerasConfiguration.timelapse:true;
        this.installationManager = installationManager;
        this.messageManager = messageManager;
        this.gatewayManager = gatewayManager;
        this.scenarioManager = scenarioManager;
        this.aiManager = aiManager;
        this.cameras = [];
        this.delegates = {};
        this.currentTimelapse = null;
        this.timelapseQueue = [];
        this.currentRecording = {};
        this.generatedTimelapses = {};
        this.recordedFiles = [];
        this.registeredCamerasEvents = {};
        this.cameraCapture = {};
        this.streamPipe = {};

        try {
            this.camerasConfiguration = this.confManager.loadData(Object, CONF_MANAGER_KEY, true);
        } catch(e) {
            Logger.warn(e.message);
        }

        if (!this.camerasConfiguration) {
            this.camerasConfiguration = [];
        }

        const self = this;
        eventBus.on(PluginsManager.EVENT_LOADED, (pluginsManager) => {
            self.pluginsLoaded(pluginsManager, self);
        });

        // Web services
        this.webServices.registerAPI(this, WebServices.GET, CAMERAS_MANAGER_AVAILABLE_GET, Authentication.AUTH_ADMIN_LEVEL);
        this.webServices.registerAPI(this, WebServices.GET, CAMERAS_MANAGER_GET, Authentication.AUTH_ADMIN_LEVEL);
        this.webServices.registerAPI(this, WebServices.POST, CAMERAS_MANAGER_POST, Authentication.AUTH_ADMIN_LEVEL);
        this.webServices.registerAPI(this, WebServices.DELETE, CAMERAS_MANAGER_DEL, Authentication.AUTH_ADMIN_LEVEL);

        this.webServices.registerAPI(this, WebServices.GET, CAMERAS_MANAGER_LIST, Authentication.AUTH_USAGE_LEVEL);
        this.webServices.registerAPI(this, WebServices.GET, CAMERAS_RETRIEVE_GET, Authentication.AUTH_USAGE_LEVEL);
        this.webServices.registerAPI(this, WebServices.POST, CAMERAS_MOVE_SET, Authentication.AUTH_USAGE_LEVEL);

        // Timelapse
        this.webServices.registerAPI(this, WebServices.GET, CAMERAS_MANAGER_TIMELAPSE_DAILY_STREAM, Authentication.AUTH_USAGE_LEVEL, 30 * 60);
        this.webServices.registerAPI(this, WebServices.GET, CAMERAS_MANAGER_TIMELAPSE_DAILY_GET, Authentication.AUTH_USAGE_LEVEL);
        this.webServices.registerAPI(this, WebServices.POST, CAMERAS_MANAGER_TIMELAPSE_GENERATE_POST, Authentication.AUTH_USAGE_LEVEL);
        this.webServices.registerAPI(this, WebServices.GET, CAMERAS_MANAGER_TIMELAPSE_STATUS_GET, Authentication.AUTH_USAGE_LEVEL);
        this.webServices.registerAPI(this, WebServices.GET, CAMERAS_MANAGER_TIMELAPSE_GET, Authentication.AUTH_USAGE_LEVEL);
        this.webServices.registerAPI(this, WebServices.GET, CAMERAS_MANAGER_TIMELAPSE_STREAM, Authentication.AUTH_USAGE_LEVEL, 30 * 60);
        // Season
        this.webServices.registerAPI(this, WebServices.GET, CAMERAS_MANAGER_TIMELAPSE_SEASON_STREAM, Authentication.AUTH_USAGE_LEVEL, 30 * 60);
        this.webServices.registerAPI(this, WebServices.GET, CAMERAS_MANAGER_TIMELAPSE_SEASON_GET, Authentication.AUTH_USAGE_LEVEL);
        // Record
        this.webServices.registerAPI(this, WebServices.GET, CAMERAS_MANAGER_RECORD_GET, Authentication.AUTH_USAGE_LEVEL, CAMERAS_MANAGER_RECORD_GET_TOKEN_DURATION);

        // Register tile refresh :)
        this.timeEventService.register((self) => {
            self.registerTile(self);
        }, this, TimeEventService.EVERY_HOURS);

        this.timeEventService.register((self) => {
            self.archiveCameras(self);
        }, this, TimeEventService.EVERY_MINUTES);

        this.timeEventService.register((self) => {
            self.generateDailyTimeLapses(self);
            self.generateSeasonTimeLapses(self);
        }, this, TimeEventService.EVERY_DAYS);

        // Reboot stream
        let rebootStreamTimer = 0;
        this.timeEventService.register((self) => {
            if (rebootStreamTimer == CAMERAS_RECONNECT_S) {
                Logger.info("Stop cameras stream for reboot. Next stream in " + CAMERAS_PAUSE_ON_RECONNECT_S + " s");
                Object.keys(this.streamPipe).forEach((key) => {
                    this.streamPipe[key].disconnect();
                    this.streamPipe[key] = null;
                });

                setTimeout(() => {
                    // Reboot streams
                    Logger.info("Restream cameras");
                    Object.keys(this.streamPipe).forEach((key) => {
                        self.initCamera(self.getCamera(key).configuration, true);
                    });
                    rebootStreamTimer = 0;
                }, CAMERAS_PAUSE_ON_RECONNECT_S * 1000);
            }

            rebootStreamTimer++;
        }, this, TimeEventService.EVERY_SECONDS);

        // Machine learning
        this.aiManager.register(AI_KEY);
    }

    /**
     * Called automatically when plugins are loaded. Used in separate methods for testing.
     * Initially, this method wad used in contructor.
     *
     * @param  {PluginsManager} pluginsManager The plugins manager instance
     * @param  {CamerasManager} context        The context (self, this, etc ...)
     */
    pluginsLoaded(pluginsManager, context) {
        context.pluginsManager = pluginsManager;
        context.initCameras();
        context.registerCamerasListForm();
        context.registerTile(context);
    }

    /**
     * Archive all cameras
     *
     * @param  {CamerasManager} context The instance
     */
    archiveCameras(context) {
        const timestamp = DateUtils.class.roundedTimestamp(DateUtils.class.timestamp(), DateUtils.ROUND_TIMESTAMP_MINUTE);
        if (context.camerasArchiveFolder) {
            context.cameras.forEach((camera) => {
                // All time
                if (this.enableHistory && camera.archive) {
                    const cameraArchiveFolder = context.camerasArchiveFolder + camera.id + "/";
                    try {
                        fs.accessSync(cameraArchiveFolder);
                    } catch(e) {
                        fs.mkdirsSync(cameraArchiveFolder);
                    } finally {
                        // Clean
                        fs.readdir(cameraArchiveFolder, (err, files) => {
                            files.forEach((file) => {
                                if (!err) {
                                    const fileTimestamp = file.split(".")[0];
                                    if (fileTimestamp && parseInt(fileTimestamp) < (timestamp - CAMERAS_RETENTION_TIME)) {
                                        fs.unlink(cameraArchiveFolder + file, (error) => {
                                            if (error) {
                                                Logger.err("Error while deleting file " + file + " camera archive for id " + camera.id);
                                                Logger.err(err.message);
                                            }
                                        });
                                    }
                                } else {
                                    Logger.err("Error while listing camera archive for id " + camera.id);
                                    Logger.err(err.message);
                                }
                            });
                        });

                        // Save camera
                        context.getImage(camera.id, (err, data) => {
                            if (!err) {
                                fs.writeFile(cameraArchiveFolder + timestamp + CAMERA_FILE_EXTENSION, data,  (err) => {
                                    if (err) {
                                        Logger.err("Error while writing camera archive for id " + camera.id);
                                        Logger.err(err.message);
                                    }
                                });
                            }
                        });
                    }
                }

                // Seasons
                if (this.enableSeason) {
                    const cameraArchiveFolderSeason = context.camerasArchiveFolder + camera.id + CAMERA_SEASON_EXTENSION + "/";
                    try {
                        fs.accessSync(cameraArchiveFolderSeason);
                    } catch(e) {
                        fs.mkdirsSync(cameraArchiveFolderSeason);
                    } finally {
                        // Camera name
                        const minute = parseInt(DateUtils.class.dateFormatted("mm", timestamp));
                        const hour = parseInt(DateUtils.class.dateFormatted("HH", timestamp));

                        if (parseInt(hour) === 12 && parseInt(minute) === 0) {
                            const dailyTimestamp = DateUtils.class.roundedTimestamp(DateUtils.class.timestamp(), DateUtils.ROUND_TIMESTAMP_DAY);
                            // Save camera
                            context.getImage(camera.id, (err, data) => {
                                if (!err) {
                                    fs.writeFile(cameraArchiveFolderSeason + dailyTimestamp + CAMERA_FILE_EXTENSION, data,  (err) => {
                                        if (err) {
                                            Logger.err("Error while writing camera archive for id " + camera.id);
                                            Logger.err(err.message);
                                        }
                                    });
                                }
                            });
                        }
                    }
                }
            });
        }
    }

    /**
     * Initialize cameras
     */
    initCameras() {
        this.cameras = [];
        this.camerasConfiguration.forEach((cameraConfiguration) => {
            this.initCamera(cameraConfiguration);
        });

        // Register forms
        const ids = [];
        const names = [];

        this.cameras.forEach((camera) => {
            ids.push(parseInt(camera.id));
            names.push(camera.name);
        });

        this.formManager.register(CamerasForm.class, ids, names);
        this.registerTile(this);

        // Scenario
        this.scenarioManager.registerWithInjection(CameraRecordScenarioForm.class, (scenario) => {
            if (scenario && scenario.CameraRecordScenarioForm && scenario.CameraRecordScenarioForm.length > 0) {
                scenario.CameraRecordScenarioForm.forEach((cameraRecordScenarioForm) => {
                    const camera = this.getCamera(cameraRecordScenarioForm.camera);
                    if (camera) {
                        this.record(cameraRecordScenarioForm.camera, () => {
                            Logger.info("Scenario complete. Camera record done for id " + cameraRecordScenarioForm.camera);
                        }, cameraRecordScenarioForm.timer);
                    } else {
                        Logger.err("Could not find camera id " + cameraRecordScenarioForm.camera);
                    }
                });
            }
        }, this.translateManager.t("camera.scenario.title"), null, true, ids, names);
    }

    /**
     * Init a camera instance and add to local array
     *
     * @param  {Object} configuration The camera configuration
     * @param  {boolean} [reload=false] Reload flag
     */
    initCamera(configuration, reload = false) {
        if (configuration.plugin) {
            const p = this.pluginsManager.getPluginByIdentifier(configuration.plugin, false);
            if (p) {
                if (p.cameraAPI.cameraClass) {
                    const camera = new p.cameraAPI.cameraClass(p, configuration.id, configuration);
                    if (!reload) {
                        camera.init();
                        this.cameras.push(camera);
                        Logger.verbose("Camera '" + configuration.name + "' loaded (#" + configuration.id + ")");
                    } else {
                        Logger.verbose("Camera '" + configuration.name + "' reloaded (#" + configuration.id + ")");
                    }

                    const recognitionFrame = (camera.configuration.cvfps ? parseInt(camera.configuration.cvfps * 1000) : 3000);// in ms
                    const cameraTransform = camera.configuration.cvlive ? true : false;
                    if (!this.streamPipe[camera.id.toString()]) {
                        let timerLast = Date.now();
                        let isProcessing = false;

                        if (!this.streamPipe[camera.id.toString()]) {
                            let validResults = [];
                            this.streamPipe[camera.id.toString()] = new MjpegProxy.class(camera.mjpegUrl, cameraTransform, (err, img) => {
                                if (!err) {
                                    this.cameraCapture[camera.id.toString()] = img;
                                    let cameraImage = img;
                                    if (cameraTransform) {
                                        cameraImage = cv.imdecode(img);
                                    }

                                    if (camera.configuration.cv && img && !isProcessing && !this.currentTimelapse) {
                                        // Evaluate framerate
                                        const timerLastTmp = Date.now();
                                        const diff = timerLastTmp - timerLast;

                                        if (diff >= recognitionFrame) {
                                            isProcessing = true;
                                            this.aiManager.processCvSsd(cameraImage).then((r) => {
                                                Logger.verbose("Analyze frame for camera " + camera.id);
                                                const results = r.results;
                                                Logger.verbose(results);
                                                validResults = [];
                                                for (let i = 0 ; i < results.length ; i++) {
                                                    const detectedObject = this.getAvailableDetectedObjects()[results[i].classLabel];
                                                    const confidence = parseInt(results[i].confidence * 100);
                                                    if (results.length <= this.aiManager.cvMap.maxElements && results[i].confidence > this.aiManager.cvMap.confidence && results[i].confidence < 1 && this.aiManager.cvMap.authorized.indexOf(detectedObject) != -1) {
                                                        Logger.info("Detected on camera " + camera.name + " : " + detectedObject + " / confidence : " + confidence + "%");
                                                        validResults.push(results[i]);

                                                        // Learn value
                                                        const aiClassifiers = [camera.id];

                                                        if (camera.name) {
                                                            aiClassifiers.push(camera.name);
                                                        }

                                                        this.aiManager.learnWithTime(AI_KEY, aiClassifiers, detectedObject).then(() => {
                                                            Logger.verbose("Learned new value for " + camera.id);
                                                        }).catch((e) => {
                                                            Logger.err("Error while learning sensor : " + e.message);
                                                        });
                                                    }
                                                }

                                                if (validResults.length > 0) {
                                                    let drawedImg = this.aiManager.drawCvRectangles(validResults, r.frame);
                                                    for (let i = 0 ; i < validResults.length ; i++) {
                                                        const confidence = parseInt(validResults[i].confidence * 100);
                                                        const detectedObject = this.getAvailableDetectedObjects()[validResults[i].classLabel];
                                                        // Dispatch value
                                                        Object.keys(this.registeredCamerasEvents).forEach((key) => {
                                                            if (this.registeredCamerasEvents[key].cameraId.toString() === camera.id.toString() || this.registeredCamerasEvents[key].cameraId === "*") {
                                                                if ((!Array.isArray(this.registeredCamerasEvents[key].detectedObject) && (this.registeredCamerasEvents[key].detectedObject === detectedObject || this.registeredCamerasEvents[key].detectedObject === "*")) || (Array.isArray(this.registeredCamerasEvents[key].detectedObject) && this.registeredCamerasEvents[key].detectedObject.indexOf(detectedObject) != -1)) {
                                                                    if (this.registeredCamerasEvents[key].cb) {
                                                                        this.registeredCamerasEvents[key].cb(camera.id, detectedObject, confidence, results[i], img, drawedImg);
                                                                    }
                                                                }
                                                            }
                                                        });
                                                    }
                                                }
                                                timerLast = timerLastTmp;
                                                isProcessing = false;
                                                const aiDuration = Date.now() - timerLastTmp;
                                                Logger.verbose("Frame analysis duration : " + aiDuration + " ms");
                                            })
                                                .catch(() => {
                                                    timerLast = timerLastTmp;
                                                    isProcessing = false;
                                                });
                                        }
                                    }

                                    if (cameraTransform) {
                                        if (validResults.length > 0) {
                                            return this.aiManager.drawCvRectangles(validResults, cameraImage);
                                        } else {
                                            return this.cameraCapture[camera.id.toString()];
                                        }
                                    }
                                } else {
                                    if (err && err.code && (err.code == "ETIMEDOUT" || err.code == "ENOTFOUND")) {
                                        this.streamPipe[camera.id.toString()].disconnect();
                                        Logger.warn("Could not connect to camera " + camera.id + " Retry in " + CAMERAS_RESTREAM_AFTER_REQ_ABORT_DURATION + " ms");
                                        setTimeout((self) => {
                                            this.streamPipe[camera.id.toString()] = null;
                                            self.initCamera(configuration, true);
                                        }, CAMERAS_RESTREAM_AFTER_REQ_ABORT_DURATION, this);
                                    } else if (err == MjpegProxy.ERROR_CLOSE || err == MjpegProxy.ERROR_TIMEOUT)  {
                                        this.streamPipe[camera.id.toString()].disconnect();
                                        Logger.verbose("Camera stream closed " + camera.id + " Retry now.");
                                        setTimeout((self) => {
                                            this.streamPipe[camera.id.toString()] = null;
                                            self.initCamera(configuration, true);
                                        }, CAMERAS_RESTREAM_AFTER_REQ_ABORT_DURATION, this);
                                    } else if (err && err.code)  {
                                        Logger.verbose(err);
                                        Logger.verbose("Other error. Retry in " + CAMERAS_RESTREAM_AFTER_UNREACH_DURATION + " ms");
                                        setTimeout((self) => {
                                            this.streamPipe[camera.id.toString()] = null;
                                            self.initCamera(configuration, true);
                                        }, CAMERAS_RESTREAM_AFTER_UNREACH_DURATION, this);
                                    }
                                }
                            });
                        }
                    }
                } else {
                    Logger.err("Plugin " + configuration.plugin + " does not have linked camera class");
                }
            } else {
                Logger.err("Plugin " + configuration.plugin + " can not be found");
            }
        } else {
            Logger.err("No plugin associated found for camera " + configuration.name);
        }
    }

    /**
     * Get all cameras
     *
     * @returns {Object} On object with id:name
     */
    getAllCameras() {
        const cameras = {};
        this.cameras.forEach((camera) => {
            cameras[camera.id] = camera.name;
        });

        return cameras;
    }

    /**
     * Register camera tile
     *
     * @param  {CamerasManager} context The instance
     */
    registerTile(context) {
        let tile = new Tile.class(context.dashboardManager.themeManager, "cameras", Tile.TILE_ACTION_ONE_ICON, Icons.class.list()["facetime_video"], null, context.translateManager.t("cameras.tile"), null, null, null, 0, 100, "cameras");
        if (context.cameras.length > 0) {
            context.dashboardManager.registerTile(tile);
        }

        const defaultCamera = context.getDefaultCamera();
        if (defaultCamera) {
            context.getImage(defaultCamera.id, (err, data) => {
                if (!err) {
                    ImageUtils.class.resize(data.toString("base64"), (error, tData) => {
                        tile = new Tile.class(context.dashboardManager.themeManager, "cameras", Tile.TILE_PICTURE_TEXT, null, null, context.translateManager.t("cameras.tile"), null, tData, null, 0, 100, "cameras");
                        if (context.cameras.length > 0) {
                            context.dashboardManager.registerTile(tile);
                        }
                    }, 300);
                }
            });
        }
    }

    /**
     * Process API callback
     *
     * @param  {APIRequest} apiRequest An APIRequest
     * @returns {Promise}  A promise with an APIResponse object
     */
    processAPI(apiRequest) {
        const self = this;
        if (apiRequest.route === CAMERAS_MANAGER_AVAILABLE_GET) {
            return new Promise((resolve) => {
                const cameras = [];
                self.pluginsManager.getPluginsByCategory("camera", false).forEach((camera) => {
                    if (camera.cameraAPI.form) {
                        cameras.push({
                            identifier: camera.identifier,
                            description: camera.description,
                            form:self.formManager.getForm(camera.cameraAPI.form)
                        });
                    }
                });
                resolve(new APIResponse.class(true, cameras));
            });
        } else if (apiRequest.route === CAMERAS_MANAGER_GET) {
            return new Promise((resolve) => {
                const cameras = [];
                self.camerasConfiguration.forEach((camera) => {
                    if (self.pluginsManager.isEnabled(camera.plugin)) {
                        const cameraPlugin = self.pluginsManager.getPluginByIdentifier(camera.plugin, false);
                        cameras.push({
                            identifier: camera.id,
                            name: camera.name,
                            icon: "E908",
                            category:"TEST",
                            form:Object.assign(self.formManager.getForm(cameraPlugin.cameraAPI.form), {data:camera})
                        });
                    }
                });
                resolve(new APIResponse.class(true, cameras.sort((a,b) => a.name.localeCompare(b.name))));
            });
        } else if (apiRequest.route.startsWith(CAMERAS_MANAGER_POST_BASE)) {
            return new Promise((resolve, reject) => {
                if (apiRequest.data && Object.keys(apiRequest.data).length > 1) {
                    if (apiRequest.data.plugin) {
                        if (self.pluginsManager.getPluginByIdentifier(apiRequest.data.plugin, false)) {
                            // Set id
                            if (!apiRequest.data.id) {
                                apiRequest.data.id = DateUtils.class.timestamp();
                            } else {
                                apiRequest.data.id = parseInt(apiRequest.data.id);
                            }

                            self.camerasConfiguration = self.confManager.setData(CONF_MANAGER_KEY, apiRequest.data, self.camerasConfiguration, self.comparator);
                            Object.keys(self.streamPipe).forEach((streamPipeKey) => {
                                if (self.streamPipe[streamPipeKey]) {
                                    self.streamPipe[streamPipeKey].disconnect();
                                }
                            });
                            self.streamPipe = {};
                            self.initCameras();
                            resolve(new APIResponse.class(true, {success:true}));
                        } else {
                            reject(new APIResponse.class(false, {}, 8108, "Unexisting plugin found"));
                        }
                    } else {
                        reject(new APIResponse.class(false, {}, 8107, "No plugin attached"));
                    }
                } else {
                    reject(new APIResponse.class(false, {}, 8106, "No data request"));
                }

            });
        } else if (apiRequest.route.startsWith(CAMERAS_MANAGER_DEL_BASE)) {
            return new Promise((resolve, reject) => {
                try {
                    self.confManager.removeData(CONF_MANAGER_KEY, {id:parseInt(apiRequest.data.id)}, self.camerasConfiguration, self.comparator);
                    self.initCameras();
                    resolve(new APIResponse.class(true, {success:true}));
                } catch(e) {
                    reject(new APIResponse.class(false, {}, 8109, e.message));
                }
            });
        } else if (apiRequest.route === CAMERAS_MANAGER_LIST) {
            return new Promise((resolve) => {
                resolve(new APIResponse.class(true, self.getCamerasList().sort((a,b) => a.name.localeCompare(b.name))));
            });
        } else if (apiRequest.route.startsWith(CAMERAS_RETRIEVE_BASE)) {
            const id = parseInt(apiRequest.data.id);
            const mode = apiRequest.data.mode;
            const base64 = apiRequest.data.base64?(parseInt(apiRequest.data.base64)>0?true:false):false;
            return new Promise((resolve, reject) => {
                if (mode === MODE_STATIC) {
                    self.getImage(id, (err, data, contentType) => {
                        if (err) {
                            reject(new APIResponse.class(false, {}, 765, err.message));
                        } else if (base64) {
                            resolve(new APIResponse.class(true, {data:data.toString("base64")}));
                        } else {
                            resolve(new APIResponse.class(true, data, null, null, false, contentType));
                        }
                    }, apiRequest.data.timestamp?apiRequest.data.timestamp:null);
                } else if (mode === MODE_MJPEG) {
                    const camera = this.getCamera(id);
                    if (camera && this.streamPipe[camera.id.toString()]) {
                        this.streamPipe[camera.id.toString()].proxyRequest(apiRequest.req, apiRequest.res);
                    } else {
                        reject(new APIResponse.class(false, {}, 766, ERROR_UNKNOWN_IDENTIFIER));
                    }
                } else if (mode === MODE_RTSP) {
                    const camera = this.getCamera(id);
                    if (camera) {
                        if (camera.rtspUrl) {
                            if (apiRequest.authenticationData) {
                                apiRequest.res  = new MjpegProxy.class(camera.rtspUrl).proxyRequest(apiRequest.req, apiRequest.res);
                            }
                        } else {
                            reject(new APIResponse.class(false, {}, 766, ERROR_UNSUPPORTED_MODE));
                        }
                    } else {
                        reject(new APIResponse.class(false, {}, 766, ERROR_UNKNOWN_IDENTIFIER));
                    }
                } else {
                    reject(new APIResponse.class(false, {}, 764, ERROR_UNKNOWN_MODE));
                }
            });
        } else if (apiRequest.route.startsWith(CAMERAS_MOVE_BASE)) {
            return new Promise((resolve, reject) => {
                const id = parseInt(apiRequest.data.id);
                const direction = apiRequest.data.direction;
                const camera = this.getCamera(id);
                if (camera) {
                    if (camera.moveSupport()) {
                        switch(direction) {
                        case 1:
                            camera.moveLeft();
                            break;
                        case 2:
                            camera.moveRight();
                            break;
                        case 3:
                            camera.moveUp();
                            break;
                        case 4:
                            camera.moveDown();
                            break;
                        }

                        resolve(new APIResponse.class(true, {success:true}));
                    } else {
                        reject(new APIResponse.class(false, {}, 766, ERROR_UNSUPPORTED_MODE));
                    }
                } else {
                    reject(new APIResponse.class(false, {}, 766, ERROR_UNKNOWN_IDENTIFIER));
                }
            });
        } else if (apiRequest.route.startsWith(CAMERAS_MANAGER_TIMELAPSE_SEASON_STREAM_BASE)) {
            return new Promise((resolve, reject) => {
                self.stream(apiRequest, self.seasonFilepath, reject);
            });
        } else if (apiRequest.route.startsWith(CAMERAS_MANAGER_TIMELAPSE_DAILY_STREAM_BASE)) {
            return new Promise((resolve, reject) => {
                self.stream(apiRequest, self.dailyFilepath, reject);
            });
        } else if (apiRequest.route.startsWith(CAMERAS_MANAGER_TIMELAPSE_DAILY_GET_BASE)) {
            return new Promise((resolve, reject) => {
                const camera = this.getCamera(apiRequest.data.id);
                if (camera) {
                    const dailyFilepath = this.dailyFilepath(camera, this.camerasArchiveFolder);
                    if (fs.existsSync(dailyFilepath)) {
                        apiRequest.res.setHeader("Content-disposition", "attachment; filename=daily-" + camera.id + TimelapseGenerator.VIDEO_EXTENSION);
                        apiRequest.res.setHeader("Content-type", "video/mp4");
                        const filestream = fs.createReadStream(dailyFilepath);
                        filestream.pipe(apiRequest.res);
                    } else {
                        reject(new APIResponse.class(false, {}, 770, ERROR_TIMELAPSE_NOT_GENERATED));
                    }
                } else {
                    reject(new APIResponse.class(false, {}, 766, ERROR_UNKNOWN_IDENTIFIER));
                }
            });
        } else if (apiRequest.route.startsWith(CAMERAS_MANAGER_TIMELAPSE_SEASON_GET_BASE)) {
            return new Promise((resolve, reject) => {
                const camera = this.getCamera(apiRequest.data.id);
                if (camera) {
                    const seasonFilepath = this.seasonFilepath(camera, this.camerasArchiveFolder);
                    if (fs.existsSync(seasonFilepath)) {
                        apiRequest.res.setHeader("Content-disposition", "attachment; filename=season-" + camera.id + TimelapseGenerator.VIDEO_EXTENSION);
                        apiRequest.res.setHeader("Content-type", "video/mp4");
                        const filestream = fs.createReadStream(seasonFilepath);
                        filestream.pipe(apiRequest.res);
                    } else {
                        reject(new APIResponse.class(false, {}, 770, ERROR_TIMELAPSE_NOT_GENERATED));
                    }
                } else {
                    reject(new APIResponse.class(false, {}, 766, ERROR_UNKNOWN_IDENTIFIER));
                }
            });
        } else if (apiRequest.route.startsWith(CAMERAS_MANAGER_TIMELAPSE_GENERATE_POST_BASE)) {
            return new Promise((resolve, reject) => {
                const camera = this.getCamera(apiRequest.data.id);
                const duration = parseInt(apiRequest.data.duration);
                if (camera) {
                    try {
                        this.generateTimelapse(camera.id, duration);
                        resolve(new APIResponse.class(true, {token:this.currentTimelapse.token}));
                    } catch(e) {
                        reject(new APIResponse.class(false, {}, 782, e.message));
                    }
                } else {
                    reject(new APIResponse.class(false, {}, 766, ERROR_UNKNOWN_IDENTIFIER));
                }
            });
        } else if (apiRequest.route.startsWith(CAMERAS_MANAGER_TIMELAPSE_STATUS_GET_BASE)) {
            return new Promise((resolve, reject) => {
                if (this.generatedTimelapses[apiRequest.data.token]) {
                    resolve(new APIResponse.class(true, {token:apiRequest.data.token, status:this.timelapseStatus(apiRequest.data.token)}));
                } else {
                    reject(new APIResponse.class(false, {}, 774, ERROR_UNKNOWN_TIMELAPSE_TOKEN));
                }
            });
        } else if (apiRequest.route.startsWith(CAMERAS_MANAGER_TIMELAPSE_GET_BASE)) {
            return new Promise((resolve, reject) => {
                if (this.generatedTimelapses[apiRequest.data.token]) {
                    if (fs.existsSync(this.generatedTimelapses[apiRequest.data.token].path)) {
                        apiRequest.res.setHeader("Content-disposition", "attachment; filename=daily-" + apiRequest.data.token + TimelapseGenerator.VIDEO_EXTENSION);
                        apiRequest.res.setHeader("Content-type", "video/mp4");
                        const filestream = fs.createReadStream(this.generatedTimelapses[apiRequest.data.token].path);
                        filestream.pipe(apiRequest.res);
                    } else {
                        reject(new APIResponse.class(false, {}, 770, ERROR_TIMELAPSE_NOT_GENERATED));
                    }
                } else {
                    reject(new APIResponse.class(false, {}, 774, ERROR_UNKNOWN_TIMELAPSE_TOKEN));
                }
            });
        } else if (apiRequest.route.startsWith(CAMERAS_MANAGER_TIMELAPSE_STREAM_BASE)) {
            return new Promise((resolve, reject) => {
                if (this.generatedTimelapses[apiRequest.data.token]) {
                    if (fs.existsSync(this.generatedTimelapses[apiRequest.data.token].path)) {
                        fs.stat(this.generatedTimelapses[apiRequest.data.token].path, (err, stats) => {
                            if (err) {
                                if (err.code === "ENOENT") {
                                    // 404 Error if file not found
                                    apiRequest.res.sendStatus(404);
                                }
                                apiRequest.res.end(err);
                            }
                            const range = apiRequest.req.headers.range;
                            if (!range) {
                                // 416 Wrong range
                                return apiRequest.res.sendStatus(416);
                            }
                            const positions = range.replace(/bytes=/, "").split("-");
                            const start = parseInt(positions[0], 10);
                            const total = stats.size;
                            const end = positions[1] ? parseInt(positions[1], 10) : total - 1;
                            const chunksize = (end - start) + 1;

                            apiRequest.res.writeHead(206, {
                                "Content-Range": "bytes " + start + "-" + end + "/" + total,
                                "Accept-Ranges": "bytes",
                                "Content-Length": chunksize,
                                "Content-Type": "video/mp4"
                            });

                            const stream = fs.createReadStream(this.generatedTimelapses[apiRequest.data.token].path, { start: start, end: end })
                                .on("open", function() {
                                    stream.pipe(apiRequest.res);
                                }).on("error", function(err) {
                                    apiRequest.res.end(err);
                                });
                        });
                    } else {
                        reject(new APIResponse.class(false, {}, 770, ERROR_TIMELAPSE_NOT_GENERATED));
                    }
                } else {
                    reject(new APIResponse.class(false, {}, 774, ERROR_UNKNOWN_TIMELAPSE_TOKEN));
                }
            });
        } else if (apiRequest.route.startsWith(CAMERAS_MANAGER_RECORD_GET_BASE)) {
            return new Promise((resolve, reject) => {
                if (apiRequest && apiRequest.data && apiRequest.data.recordKey && this.recordedFiles[apiRequest.data.recordKey]) {
                    if (fs.existsSync(this.recordedFiles[apiRequest.data.recordKey])) {
                        apiRequest.res.setHeader("Content-disposition", "attachment; filename=record-" + apiRequest.data.recordKey + TimelapseGenerator.VIDEO_EXTENSION);
                        apiRequest.res.setHeader("Content-type", "video/mp4");
                        const filestream = fs.createReadStream(this.recordedFiles[apiRequest.data.recordKey]);
                        filestream.pipe(apiRequest.res);
                    } else {
                        reject(new APIResponse.class(false, {}, 795, ERROR_RECORD_UNKNOWN));
                    }
                } else {
                    reject(new APIResponse.class(false, {}, 794, ERROR_RECORD_UNKNOWN));
                }

                // if (this.generatedTimelapses[apiRequest.data.token]) {
                //     if (fs.existsSync(this.generatedTimelapses[apiRequest.data.token].path)) {
                //         apiRequest.res.setHeader("Content-disposition", "attachment; filename=daily-" + apiRequest.data.token + TimelapseGenerator.VIDEO_EXTENSION);
                //         apiRequest.res.setHeader("Content-type", "video/mp4");
                //         const filestream = fs.createReadStream(this.generatedTimelapses[apiRequest.data.token].path);
                //         filestream.pipe(apiRequest.res);
                //     } else {
                //         reject(new APIResponse.class(false, {}, 770, ERROR_TIMELAPSE_NOT_GENERATED));
                //     }
                // } else {
                //     reject(new APIResponse.class(false, {}, 774, ERROR_UNKNOWN_TIMELAPSE_TOKEN));
                // }
            });
        }
    }

    /**
     * Method called to stream video through APIRequest
     *
     * @param  {APIRequest} apiRequest An APIRequest
     * @param  {Function} filePathMethod The filepath method
     * @param  {Function} reject         The reject function
     */
    stream(apiRequest, filePathMethod, reject) {
        const camera = this.getCamera(apiRequest.data.id);
        if (camera) {
            const streamFilepath = filePathMethod(camera, this.camerasArchiveFolder);
            if (fs.existsSync(streamFilepath)) {
                fs.stat(streamFilepath, (err, stats) => {
                    if (err) {
                        if (err.code === "ENOENT") {
                            // 404 Error if file not found
                            apiRequest.res.sendStatus(404);
                        }
                        apiRequest.res.end(err);
                    } else {
                        try {
                            let range = apiRequest.req.headers.range;
                            if (!range) {
                                // 416 Wrong range
                                //return apiRequest.res.sendStatus(416);
                                range = "bytes=0-";
                            }
                            const positions = range.replace(/bytes=/, "").split("-");
                            const start = parseInt(positions[0], 10);
                            const total = stats.size;
                            const end = positions[1] ? parseInt(positions[1], 10) : total - 1;
                            const chunksize = (end - start) + 1;

                            apiRequest.res.writeHead(206, {
                                "Content-Range": "bytes " + start + "-" + end + "/" + total,
                                "Accept-Ranges": "bytes",
                                "Content-Length": chunksize,
                                "Content-Type": "video/mp4"
                            });

                            const stream = fs.createReadStream(streamFilepath, { start: start, end: end })
                                .on("open", function() {
                                    stream.pipe(apiRequest.res);
                                }).on("error", function(err) {
                                    apiRequest.res.end(err);
                                });
                        } catch(e) {
                            Logger.err(e.message);
                        }

                    }
                });
            } else {
                reject(new APIResponse.class(false, {}, 770, ERROR_TIMELAPSE_NOT_GENERATED));
            }
        } else {
            reject(new APIResponse.class(false, {}, 766, ERROR_UNKNOWN_IDENTIFIER));
        }
    }

    /**
     * Compare camera data
     *
     * @param  {Object} cameraData1 Camera data 1
     * @param  {Object} cameraData2 Camera data 2
     * @returns {boolean}             True if id is the same, false otherwise
     */
    comparator(cameraData1, cameraData2) {
        return (cameraData1.id === cameraData2.id);
    }

    /**
     * Get camera configuration. If no parameters are passed, returns the array of all camera configuration.
     *
     * @param  {string} [cameraId=null] The camera identifier. Can be null.
     * @returns {Object}                 The camera configuration, or configurations, or null if nothing found
     */
    getCameraConfiguration(cameraId = null) {
        if (!cameraId) {
            return this.camerasConfiguration;
        } else {
            let foundConfiguration = null;
            this.camerasConfiguration.forEach((cameraConfiguration) => {
                if (cameraConfiguration.id === cameraId) {
                    foundConfiguration = cameraConfiguration;
                }
            });

            return foundConfiguration;
        }
    }

    /**
     * Register a cameras list form
     */
    registerCamerasListForm() {
        const camerasName = [];
        const camerasId = [];
        this.camerasConfiguration.sort((a,b) => a.name.localeCompare(b.name)).forEach((camera) => {
            camerasName.push(camera.name);
            camerasId.push(camera.id);
        });
        this.formManager.register(CamerasListForm.class, camerasName, camerasId);
    }

    /**
     * Retrieve the list of cameras with name and identifier
     *
     * @returns {Array} The list of cameras
     */
    getCamerasList() {
        const cameras = [];
        this.cameras.forEach((camera) => {
            cameras.push({id:camera.id, name:camera.name, mjpeg:camera.mjpegSupport(), rtsp:camera.rtspSupport(), move:camera.moveSupport()});
        });
        return cameras;
    }

    /**
     * Get the camera Object
     *
     * @param  {number} id Camera identifier
     * @returns {Camera}    A camera extended object. Returns null if nothing found.
     */
    getCamera(id) {
        let camera = null;
        this.cameras.forEach((cam) => {
            if (cam.id === parseInt(id)) {
                camera = cam;
            }
        });

        return camera;
    }

    /**
     * Get the default camera
     *
     * @returns {Camera} A default camera
     */
    getDefaultCamera() {
        let camera = null;
        this.cameras.forEach((cam) => {
            if (cam.default) {
                camera = cam;
            }
        });

        return camera;
    }

    /**
     * Get a picture
     *
     * @param  {number}   id Camera identifier
     * @param  {Function} cb         A callback with error, image buffer and mime type. Example : `(err, data, mime) => {}`
     * @param  {number}   [timestamp=null] The timestamp of the picture. If `null`, live snapshot.
     */
    getImage(id, cb, timestamp = null) {
        if (id) {
            const camera = this.getCamera(id);
            if (camera) {
                if (timestamp) {
                    const filePath = this.camerasArchiveFolder + camera.id + "/" + timestamp + CAMERA_FILE_EXTENSION;
                    if (fs.existsSync(filePath)) {
                        fs.readFile(filePath, (err, data) => {
                            if (err) {
                                cb(err);
                            } else {
                                cb(null, Buffer.from(data, "binary"), "image/jpeg");
                            }
                        });
                    } else {
                        cb(Error(ERROR_UNEXISTING_PICTURE));
                    }
                } else {
                    if (this.cameraCapture[camera.id.toString()]) {
                        cb(null, this.cameraCapture[camera.id.toString()], "image/jpeg");
                    } else {
                        if (camera.snapshotUrl) {
                            Logger.info("Retrieving picture from camera " + id);
                            request(camera.snapshotUrl, {encoding: "binary"}, function(error, response, body) {
                                if (error) {
                                    Logger.err("Camera picture " + id + " error");
                                    Logger.err(error);
                                    cb(error);
                                } else {
                                    Logger.info("Camera picture " + id + " done !");
                                    cb(null, Buffer.from(body, "binary"), response.headers["content-type"]);
                                }
                            });
                        } else {
                            cb(Error(ERROR_NO_URL_DEFINED));
                        }
                    }
                }
            } else {
                cb(Error(ERROR_UNKNOWN_IDENTIFIER));
            }
        } else {
            cb(Error(ERROR_UNKNOWN_IDENTIFIER));
        }
    }

    /**
     * Retrieve a timelapse status for a specific token
     *
     * @param  {string} token Time lapse token
     * @returns {number}       The status
     */
    timelapseStatus(token) {
        if (this.currentTimelapse && (token === this.currentTimelapse.token)) {
            return this.currentTimelapse.status;
        } else {
            if (this.generatedTimelapses[token]) {
                return this.generatedTimelapses[token].status;
            }
        }

        return null;
    }

    /**
     * Get the daily timelapse file path
     *
     * @param  {Camera} camera               A camera
     * @param  {string} camerasArchiveFolder Camera archive folder
     * @returns {string}                      The path
     */
    dailyFilepath(camera, camerasArchiveFolder) {
        return camerasArchiveFolder + camera.id + CAMERA_DAILY_EXTENSION + TimelapseGenerator.VIDEO_EXTENSION;
    }

    /**
     * Get the season timelapse file path
     *
     * @param  {Camera} camera               A camera
     * @param  {string} camerasArchiveFolder Camera archive folder
     * @returns {string}                      The path
     */
    seasonFilepath(camera, camerasArchiveFolder) {
        return camerasArchiveFolder + camera.id + CAMERA_SEASON_EXTENSION + TimelapseGenerator.VIDEO_EXTENSION;
    }

    /**
     * Generate a daily timelapse
     *
     * @param  {CamerasManager} context The context (self)
     */
    generateDailyTimeLapses(context) {
        Logger.info("Timelapse camera generation requested");
        if (context.enableTimelapse) {
            Logger.info("Timelapse enabled");
            context.cameras.forEach((camera) => {
                const timelapse = new TimelapseGenerator.class(camera, context.installationManager, context.cachePath, context.camerasArchiveFolder, DAILY_DURATION);
                const dailyFilename = context.dailyFilepath(camera, context.camerasArchiveFolder);
                context.processAutotimelapse(timelapse, dailyFilename);
            });
        }
    }

    /**
     * Generate a season timelapse
     *
     * @param  {CamerasManager} context The context (self)
     */
    generateSeasonTimeLapses(context) {
        Logger.info("Timelapse season camera generation requested");
        if (context.enableSeason) {
            Logger.info("Timelapse enabled");
            context.cameras.forEach((camera) => {
                const cameraArchiveFolderSeason = context.camerasArchiveFolder + camera.id + CAMERA_SEASON_EXTENSION + "/";
                const timelapse = new TimelapseGenerator.class(camera, context.installationManager, context.cachePath, cameraArchiveFolderSeason, SEASON_DURATION, false);
                const seasonFilename = context.seasonFilepath(camera, context.camerasArchiveFolder);
                context.processAutotimelapse(timelapse, seasonFilename);
            });
        }
    }

    /**
     * Generates an auto timelapse compilation with the queue
     *
     * @param  {TimelapseGenerator} timelapse A time lapse generator instance
     * @param  {string} filename  The file name of the destination file
     */
    processAutotimelapse(timelapse, filename) {
        if (!this.currentTimelapse) {
            this.currentTimelapse = timelapse;
            timelapse.generateTimelapse((status, error, timelapseFilepath) => {
                if (!error && timelapseFilepath) {
                    fs.remove(filename);
                    fs.move(timelapseFilepath, filename);
                }
                this.currentTimelapse = null;
                if (this.timelapseQueue.length > 0) {
                    const nextTimeLapse = this.timelapseQueue.pop();
                    Logger.warn("Generating next timelapse queue. Generating " + nextTimeLapse.filename);
                    this.processAutotimelapse(nextTimeLapse.timelapse, nextTimeLapse.filename);
                }
            });
        }  else {
            Logger.warn("Timelapse " + filename + " already running. Adding to queue.");
            this.timelapseQueue.push({timelapse: timelapse, filename: filename});
        }
    }

    /**
     * Generate a timelapse for a camera id
     *
     * @param  {number} id           The camera identifier
     * @param  {number} [duration=24 * 60 * 60] The duration in seconds
     */
    generateTimelapse(id, duration = 24 * 60 * 60) {
        if (!this.currentTimelapse) {
            const camera = this.getCamera(id);
            if (camera) {
                this.currentTimelapse = new TimelapseGenerator.class(camera, this.installationManager, this.cachePath, this.camerasArchiveFolder, duration);
                this.generatedTimelapses[this.currentTimelapse.token] = {
                    status:this.currentTimelapse.status,
                    path:null
                };

                this.currentTimelapse.generateTimelapse((status, error, timelapseFilepath) => {
                    this.generatedTimelapses[this.currentTimelapse.token] = {
                        status:status,
                        path:timelapseFilepath?timelapseFilepath:null
                    };

                    this.currentTimelapse = null;

                    if (this.timelapseQueue.length > 0) {
                        const nextTimeLapse = this.timelapseQueue.pop();
                        Logger.warn("Generating next timelapse queue. Generating " + nextTimeLapse.id);
                        this.generateTimelapse(nextTimeLapse.id, nextTimeLapse.duration);
                    }
                });
            } else {
                throw Error(ERROR_UNKNOWN_IDENTIFIER);
            }
        } else {
            Logger.warn("Timelapse " + id + " already running. Adding to queue.");
            this.timelapseQueue.push({id:id, duration:duration});
        }
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
        if (!this.currentRecording[parseInt(id)]) {
            this.currentRecording[parseInt(id)] = {};
            const camera = this.getCamera(id);
            if (camera.mjpegUrl) {
                try {
                    const recordSessionFile = this.cachePath + id + "-" + DateUtils.class.timestamp() + "-record";
                    Logger.info("Recording video for camera " + id + " for " + timer + " seconds");
                    let frameCount = 0;
                    const wstream = fs.createWriteStream(recordSessionFile + ".mjpg");
                    const req = request(camera.mjpegUrl);
                    const PassThrough = require("stream").PassThrough;
                    const pt = new PassThrough();
                    req.pipe(pt).pipe(wstream);
                    pt.on("data", (chunk) => {
                        if (chunk.toString("utf8").indexOf("JFIF")!==-1) {
                            frameCount++;
                        }
                    });
                    req.on("error", (err) => {
                        cb(err);
                    });

                    setTimeout((vwstream, vreq, self) => {
                        vwstream.end();
                        vreq.abort();
                        const frameRate = Math.round(frameCount / timer);
                        Logger.info("Record session stop");
                        delete this.currentRecording[parseInt(id)];
                        Logger.info("Detected frames : " + frameCount);
                        Logger.info("Detected framerate : " + frameRate);
                        Logger.info("Converting video session");

                        this.installationManager.executeCommand("avconv -r " + ((frameRate < 1) ? 1:frameRate) + " -i " + recordSessionFile + ".mjpg -vcodec libx264 " + recordSessionFile + TimelapseGenerator.VIDEO_EXTENSION, false, (error, stdout, stderr) => {
                            // Clean mjpg stream
                            fs.remove(recordSessionFile + ".mjpg");
                            if (error) {
                                Logger.err(stderr);
                                cb(error);
                            } else {
                                Logger.info("Video session encoding terminated.");
                                const key = sha256(recordSessionFile).substr(1, 6);
                                this.recordedFiles[key] = recordSessionFile + TimelapseGenerator.VIDEO_EXTENSION;
                                const link = self.gatewayManager.getDistantApiUrl() + CAMERAS_MANAGER_RECORD_GET_BASE.replace(":/", "") + key + "/?t=" + self.webServices.getToken(CAMERAS_MANAGER_RECORD_GET, CAMERAS_MANAGER_RECORD_GET_TOKEN_DURATION);
                                if (sendMessage) {
                                    self.messageManager.sendMessage("*",  self.translateManager.t("camera.record.download.message", this.getCamera(id).configuration.name, link));
                                }

                                cb(null, this.recordedFiles[key], key, link);
                            }
                        });
                    }, timer * 1000, wstream, req, this);
                } catch(err) {
                    cb(err);
                }
            } else {
                cb(Error(ERROR_UNSUPPORTED_MODE));
            }
        } else {
            cb(Error(ERROR_RECORD_ALREADY_RUNNING));
        }
    }

    /**
     * Get available detected objects list for computer vision
     *
     * @returns {Array}                      The detected objects
     */
    getAvailableDetectedObjects() {
        return this.aiManager.cvMap.mapper.sort();
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
        this.registeredCamerasEvents[key] = {cameraId: cameraId, detectedObject: detectedObject, cb: cb};
    }

    /**
     * Unregister to camera events with computer vision
     *
     * @param  {string}   key         The register key
     */
    unregisterCameraEvent(key) {
        delete this.registeredCamerasEvents[key];
    }
}

module.exports = {class:CamerasManager, ERROR_ALREADY_REGISTERED:ERROR_ALREADY_REGISTERED, ERROR_NOT_REGISTERED:ERROR_NOT_REGISTERED, CAMERA_FILE_EXTENSION:CAMERA_FILE_EXTENSION, ERROR_TIMELAPSE_NOT_GENERATED:ERROR_TIMELAPSE_NOT_GENERATED};
