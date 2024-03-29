"use strict";
const request = require("request");
const rtsp = require("rtsp-ffmpeg");
const MjpegProxy = require("./MjpegProxy");
const fs = require("fs-extra");
const sha256 = require("sha256");
const Logger = require("./../../logger/Logger");
const PluginsManager = require("./../pluginsmanager/PluginsManager");
const WebServices = require("./../../services/webservices/WebServices");
const APIResponse = require("./../../services/webservices/APIResponse");
const Authentication = require("./../authentication/Authentication");
const DateUtils = require("./../../utils/DateUtils");
const TimerWrapper = require("./../../utils/TimerWrapper");
const CamerasForm = require("./CamerasForm");
const CamerasListForm = require("./CamerasListForm");
const Tile = require("./../dashboardmanager/Tile");
const ImageUtils = require("./../../utils/ImageUtils");
const TimeEventService = require("./../../services/timeeventservice/TimeEventService");
const TimelapseGenerator = require("./TimelapseGenerator");
const CameraRecordScenarioForm = require("./CameraRecordScenarioForm");
const Icons = require("./../../utils/Icons");

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
const CAMERAS_MANAGER_TIMELAPSE_DAILY_HOT_STREAM_BASE = ":/camera/timelapse/daily-hot/stream/";
const CAMERAS_MANAGER_TIMELAPSE_DAILY_HOT_STREAM = CAMERAS_MANAGER_TIMELAPSE_DAILY_HOT_STREAM_BASE + "[id]/";
const CAMERAS_MANAGER_TIMELAPSE_DAILY_HOT_GET_BASE = ":/camera/timelapse/daily-hot/get/";
const CAMERAS_MANAGER_TIMELAPSE_DAILY_HOT_GET = CAMERAS_MANAGER_TIMELAPSE_DAILY_HOT_GET_BASE + "[id]/";
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

const CAMERAS_MANAGER_LIST = ":/cameras/list/";
const CAMERAS_RETRIEVE_BASE = ":/camera/get/";
const CAMERAS_RETRIEVE_GET = CAMERAS_RETRIEVE_BASE + "[mode]/[id]/[base64*]/[timestamp*]/[useCache*]/[setContentTypeStatic*]/";
const CAMERAS_MOVE_BASE = ":/camera/move/";
const CAMERAS_MOVE_SET = CAMERAS_MOVE_BASE + "[id]/[direction]/";

const MODE_STATIC = "static";
const MODE_MJPEG = "mjpeg";
const MODE_RTSP = "rtsp";

const DAILY_DURATION = 24 * 60 * 60;
const SEASON_DURATION = 100 * 12 * 30 * 24 * 60 * 60;
const CAMERAS_RETENTION_TIME = 60 * 60 * 24 * 7; // In seconds
const CAMERA_RECORD_HOTFILE_DURATION_S = 60;
const CAMERA_RECORD_HOTFILE_LOCK_NO_RECORD_S = 4 * 60;
const CAMERA_FILE_EXTENSION = ".JPG";
const CAMERA_SEASON_EXTENSION = "-season";
const CAMERA_DAILY_EXTENSION = "-daily";
const CAMERA_DAILY_HOT_EXTENSION = "-hot-daily";

const ERROR_ALREADY_REGISTERED = "Already registered";
const ERROR_NOT_REGISTERED = "Not registered";
const ERROR_UNKNOWN_IDENTIFIER = "Unknown camera identifier";
const ERROR_NO_URL_DEFINED = "No url defined";
const ERROR_NO_IMAGE = "No image";
const ERROR_UNKNOWN_MODE = "Unknown mode";
const ERROR_UNSUPPORTED_MODE = "Unsupported mode";
const ERROR_TIMELAPSE_NOT_GENERATED = "Timelapse not generated";
const ERROR_UNKNOWN_TIMELAPSE_TOKEN = "Unknown timelapse token";
const ERROR_UNEXISTING_PICTURE = "Unexisting picture";
// const ERROR_RECORD_ALREADY_RUNNING = "Already recording camera";
const ERROR_RECORD_UNKNOWN = "Unknown record";

const AI_KEY = "cameras";

// Multi process
const THREAD_ARCHIVE_CAMERA = "camerasManagerArchive";

/**
 * This class allows to manage cameras
 *
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
     * @param  {object} [camerasConfiguration=null]    Cameras configuration
     * @param  {string} [cachePath=null]    Temporary files path
     * @param  {string} [installationManager=null]    Installation manager
     * @param  {MessageManager} messageManager    The message manager
     * @param  {GatewayManager} gatewayManager    The gateway manager
     * @param  {ScenarioManager} scenarioManager    The scenario manager
     * @param  {AiManager} aiManager    The ai manager
     * @param  {ThreadsManager} threadsManager    The threads manager
     * @returns {CamerasManager}                       The instance
     */
    constructor(pluginsManager, eventBus, webServices, formManager, confManager, translateManager, themeManager, dashboardManager, timeEventService, camerasConfiguration = null, cachePath = null, installationManager = null, messageManager, gatewayManager, scenarioManager, aiManager, threadsManager) {
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
        this.threadsManager = threadsManager;
        this.eventBus = eventBus;
        this.cameras = [];
        this.delegates = {};
        this.currentTimelapse = null;
        this.timelapseQueue = [];
        this.currentRecording = {};
        this.generatedTimelapses = {};
        this.recordedFiles = [];
        this.registeredCamerasEvents = {};
        this.cameraCapture = {};
        this.detectedObjects = {};
        this.isRecording = {};
        this.cameraHotFileLocks = {};
        this.rtspTokenExpired = [];

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
        this.webServices.registerAPI(this, WebServices.GET, CAMERAS_MANAGER_TIMELAPSE_DAILY_HOT_STREAM, Authentication.AUTH_USAGE_LEVEL, 30 * 60);
        this.webServices.registerAPI(this, WebServices.GET, CAMERAS_MANAGER_TIMELAPSE_DAILY_HOT_GET, Authentication.AUTH_USAGE_LEVEL);
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
            self.cleanVideoFiles(self);

        }, this, TimeEventService.EVERY_DAYS);

        // Machine learning
        this.aiManager.register(AI_KEY);

        // Multi process optimization
        this.prepareMultiProcess();
    }

    /**
     * Prepare multi process events
     */
    prepareMultiProcess() {
        this.threadsManager.run(() => {
            this.saveCameraPicture = (data) => {
                const fs = require("fs-extra");
                fs.writeFile(data.file, Buffer.from(data.data.data),  (err) => {
                    if (err) {
                        Logger.err("Error while writing camera archive for file " + data.file);
                        Logger.err(err.message);
                    }
                });
            };

        }, THREAD_ARCHIVE_CAMERA, {}, () => {

        });
    }

    /**
     * Save camera configuration
     *
     * @param  {object} cameraConfiguration The camera configuration
     */
    saveCamera(cameraConfiguration) {
        this.camerasConfiguration = this.confManager.setData(CONF_MANAGER_KEY, cameraConfiguration, this.camerasConfiguration, this.comparator);
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
                                                Logger.err(error);
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
                                try {
                                    context.cameraCapture[camera.id.toString()] = data;
                                    context.threadsManager.send(THREAD_ARCHIVE_CAMERA, "saveCameraPicture", {file: cameraArchiveFolder + timestamp + CAMERA_FILE_EXTENSION, data: data});
                                } catch(e) {
                                    e;
                                }
                            }
                        }, null, true);

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
                                    context.threadsManager.send(THREAD_ARCHIVE_CAMERA, "saveCameraPicture", {file: cameraArchiveFolderSeason + dailyTimestamp + CAMERA_FILE_EXTENSION, data: data});
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
     * @param  {object} configuration The camera configuration
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
                    // const cameraTransform = camera.configuration.cvlive ? true : false;

                    let timerLast = Date.now();
                    let isProcessing = false;
                    let validResults = [];
                    const timeEventCb = (self) => {
                        const timerLastTmp = Date.now();
                        const diff = timerLastTmp - timerLast;
                        if (diff >= recognitionFrame && camera.configuration.cv && !isProcessing) {
                            self.getImage(configuration.id, (err, img) => {
                                if (!err) {
                                    this.cameraCapture[camera.id.toString()] = img;
                                    if (camera.configuration.cv && img && !isProcessing && !this.currentTimelapse) {
                                        // Evaluate framerate
                                        const timerLastTmp = Date.now();
                                        const diff = timerLastTmp - timerLast;
                                        let cameraImage = img;
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

                                                this.detectedObjects[camera.id.toString()] = validResults;
                                                if (validResults.length > 0) {
                                                    let drawedImg = this.aiManager.drawCvRectangles(validResults, img);
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

                                                        if (!this.isRecording[camera.id.toString()] && !this.cameraHotFileLocks[camera.id.toString()]) {
                                                            this.isRecording[camera.id.toString()] = "recording";
                                                            this.cameraHotFileLocks[camera.id.toString()] = "recording";
                                                            TimerWrapper.class.setTimeout((self) => {
                                                                delete self.cameraHotFileLocks[camera.id.toString()];
                                                            }, (CAMERA_RECORD_HOTFILE_LOCK_NO_RECORD_S + CAMERA_RECORD_HOTFILE_DURATION_S) * 1000, this);

                                                            this.record(camera.id, (err, generatedFilepath) => {
                                                                if (!err) {
                                                                    const cameraDailyHotFile = this.dailyHotFilepath(camera, this.camerasArchiveFolder);
                                                                    if (!fs.existsSync(cameraDailyHotFile)) {
                                                                        fs.moveSync(generatedFilepath, cameraDailyHotFile);
                                                                        delete this.isRecording[camera.id.toString()];
                                                                    } else {
                                                                        const intermediate1File = this.cachePath + camera.id.toString() + "-intermediate1.ts";
                                                                        const intermediate2File = this.cachePath + camera.id.toString() + "-intermediate2.ts";
                                                                        fs.remove(intermediate1File, () => {
                                                                            this.installationManager.executeCommand("ffmpeg -y -i " + cameraDailyHotFile + " -c copy -bsf:v h264_mp4toannexb -f mpegts " + intermediate1File, false, (error) => {
                                                                                if (!error) {
                                                                                    fs.remove(intermediate2File, () => {
                                                                                        this.installationManager.executeCommand("ffmpeg -y -i " + generatedFilepath + " -c copy -bsf:v h264_mp4toannexb -f mpegts " + intermediate2File, false, (error) => {
                                                                                            if (!error) {
                                                                                                this.installationManager.executeCommand("ffmpeg -y -i \"concat:" + intermediate1File + "|" + intermediate2File + "\" -c copy -bsf:a aac_adtstoasc " + cameraDailyHotFile, false, (error) => {
                                                                                                    if (!error) {
                                                                                                        // OK !
                                                                                                    } else {
                                                                                                        Logger.err(error);
                                                                                                    }

                                                                                                    fs.remove(intermediate1File);
                                                                                                    fs.remove(intermediate2File);
                                                                                                    fs.remove(generatedFilepath);
                                                                                                    delete this.isRecording[camera.id.toString()];
                                                                                                });
                                                                                            } else {
                                                                                                Logger.err(error);
                                                                                                fs.remove(intermediate1File);
                                                                                                fs.remove(generatedFilepath);
                                                                                                delete this.isRecording[camera.id.toString()];
                                                                                            }

                                                                                        });
                                                                                    });
                                                                                } else {
                                                                                    Logger.err(error);
                                                                                    fs.remove(generatedFilepath);
                                                                                    delete this.isRecording[camera.id.toString()];
                                                                                }
                                                                            });
                                                                        });
                                                                    }
                                                                }
                                                            }, CAMERA_RECORD_HOTFILE_DURATION_S, false);
                                                        }
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
                                } else {
                                    Logger.err("Error : " + err.message);
                                    isProcessing = false;
                                    timerLast = Date.now();
                                }

                                timerLast = timerLastTmp;
                            }, null, true);
                        }
                    };

                    const timeEventServiceKey = "camera-" + camera.id.toString();
                    this.timeEventService.unregister(timeEventCb, TimeEventService.EVERY_SECONDS, null, null, null, timeEventServiceKey);
                    this.timeEventService.register(timeEventCb, this, TimeEventService.EVERY_SECONDS, null, null, null, timeEventServiceKey);
                } else {
                    Logger.err("Plugin " + configuration.plugin + " does not have linked camera class, or plugin is disabled");
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
     * @returns {object} On object with id:name
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
        let tile = new Tile.class(context.dashboardManager.themeManager, "cameras", Tile.TILE_GENERIC_ACTION_DARK, Icons.icons["camera"], null, context.translateManager.t("cameras.tile"), null, null, null, 0, 100, "cameras");
        if (context.cameras.length > 0) {
            context.dashboardManager.registerTile(tile);
        }

        const defaultCamera = context.getDefaultCamera();
        if (defaultCamera) {
            context.getImage(defaultCamera.id, (err, data) => {
                if (!err) {
                    ImageUtils.class.resize(data.toString("base64"), (error, tData) => {
                        tile = new Tile.class(context.dashboardManager.themeManager, "cameras", Tile.TILE_GENERIC_ACTION_DARK, Icons.icons["camera"], null, context.translateManager.t("cameras.tile"), null, tData, null, 0, 100, "cameras");
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
                        if (cameraPlugin && cameraPlugin.cameraAPI) {
                            cameras.push({
                                identifier: camera.id,
                                name: camera.name,
                                icon: Icons.icons["camera"],
                                category:"TEST",
                                form:Object.assign(self.formManager.getForm(cameraPlugin.cameraAPI.form), {data:camera})
                            });
                        }
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

                            self.saveCamera(apiRequest.data);
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
            const timestamp = apiRequest.data.timestamp? ((parseInt(apiRequest.data.timestamp) > 1) ? parseInt(apiRequest.data.timestamp):null) : null;
            const useCache = apiRequest.data.useCache ? (parseInt(apiRequest.data.useCache) == 1 ? true : false) : false;
            const setContentTypeStatic = apiRequest.data.setContentTypeStatic ? (parseInt(apiRequest.data.setContentTypeStatic) == 1 ? true : false) : false;
            const camera = self.getCamera(id);
            return new Promise((resolve, reject) => {
                if (camera && mode === MODE_STATIC) {
                    Logger.info("STATIC mode");
                    self.getImage(id, (err, data, contentType) => {
                        if (err) {
                            reject(new APIResponse.class(false, {}, 765, err.message));
                        } else if (base64) {
                            resolve(new APIResponse.class(true, {data:data.toString("base64")}));
                        } else {
                            resolve(new APIResponse.class(true, data, null, null, false, contentType));
                        }
                    }, timestamp, !useCache);
                } else if (camera && (mode === MODE_MJPEG || (mode === MODE_RTSP && !camera.rtspSupport()))) {
                    Logger.info("MJPEG mode");
                    let mjpegProxy;
                    if (camera && camera.configuration && camera.configuration.cvlive) {
                        mjpegProxy = new MjpegProxy.class(camera.mjpegUrl, camera.rtspUrl, camera.configuration.rotation, true, (err, img) => {
                            if (!err && self.detectedObjects[camera.id.toString()] && self.detectedObjects[camera.id.toString()].length > 0) {
                                img = self.aiManager.drawCvRectangles(self.detectedObjects[camera.id.toString()], img);
                            }

                            if (err) {
                                Logger.err(err);
                            }

                            // Fix issue where mjpeg stream was not displayed
                            if (img && img.indexOf(MjpegProxy.JPG_FOOTER, 0, "hex") < 0) {
                                img = Buffer.concat([img, Buffer.from(MjpegProxy.JPG_FOOTER, "hex")]);
                            }

                            return img;
                        }, setContentTypeStatic);
                    } else {
                        mjpegProxy = new MjpegProxy.class(camera.mjpegUrl, camera.rtspUrl, camera.configuration.rotation, false, null, setContentTypeStatic);
                    }

                    apiRequest.req.on("close", () => {
                        Logger.info("Closed mjpeg connection");
                        mjpegProxy.disconnect();
                        reject(new APIResponse.class(false, {}, 766, ERROR_UNSUPPORTED_MODE));
                    });

                    mjpegProxy.proxyRequest(apiRequest.req, apiRequest.res);
                } else  if (camera && mode === MODE_RTSP && camera.rtspSupport()) {
                    Logger.info("RTSP mode");
                    try {
                        // Fix pkg issue
                        let rtspRelayFile = fs.readFileSync(__dirname + "/../../../node_modules/rtsp-relay/index.js").toString();

                        rtspRelayFile = rtspRelayFile.replace(/require\('@ffmpeg/g,"require('" + __dirname + "/../../../node_modules/@ffmpeg");
                        rtspRelayFile = rtspRelayFile.replace(/const { path: ffmpegPath }/g,"//const { path: ffmpegPath }");
                        rtspRelayFile = rtspRelayFile.replace(/require\('express-ws/g,"require('" + __dirname + "/../../../node_modules/express-ws");
                        rtspRelayFile = rtspRelayFile.replace(/require\('ps-node/g,"require('" + __dirname + "/../../../node_modules/ps-node");
                        rtspRelayFile = rtspRelayFile.replace(/require\('.\/package\.json/g,"require('" + __dirname + "/../../../node_modules/rtsp-relay/package.json");
                        rtspRelayFile = rtspRelayFile.replace(/'-i',/g,"'-rtsp_transport', 'tcp', '-flags', 'low_delay', '-fflags', 'nobuffer', '-fflags', 'discardcorrupt', '-i',");
                        rtspRelayFile = rtspRelayFile.replace(/url,\n/g,"'\"' + url + '\"',\n");
                        //rtspRelayFile = rtspRelayFile.replace(/'-i',/g,"'-rtsp_transport', 'tcp', '-flags', 'low_delay', '-strict', 'experimental', '-avioflags', 'direct', '-fflags', 'nobuffer', '-fflags', 'discardcorrupt', '-frame_drop_threshold', '1.0', '-probesize', '32', '-analyzeduration', '0', '-i',");
                        rtspRelayFile = rtspRelayFile.replace(/require\('@ffmpeg/g,"require('" + __dirname + "/../../../node_modules/@ffmpeg");
                        // Replace bin for pkg
                        rtspRelayFile = rtspRelayFile.replace(/ffmpegPath,/g,"\"ffmpeg\",");
                        // TODO: REMOVE THIS
                        rtspRelayFile = rtspRelayFile.replace(/this.verbose/g,"true");
                        rtspRelayFile = rtspRelayFile.replace(/true = options.verbose;/g,"//");

                        fs.removeSync(this.cachePath + "rtsp-relay.js");
                        fs.writeFileSync(this.cachePath + "rtsp-relay.js", rtspRelayFile);

                        const { proxy } = require(this.cachePath + "rtsp-relay.js")(this.webServices.app);
                        let handler = proxy({
                            url: camera.rtspUrl,
                            additionalFlags: (camera.configuration && camera.configuration.ffmpeg && camera.configuration.ffmpeg.length > 0) ? camera.configuration.ffmpeg.split(" ") : ["-rtsp_transport", "tcp", "-codec:a", "mp2", "-ar", "44100"],
                            verbose: true
                        });

                        const token = sha256((camera.rtspUrl + DateUtils.class.timestamp() + ((Math.random() * 10000000) + 1)).toString()).substr(((Math.random() * 40) + 1), 16);
                        
                        const timeoutConnexion = TimerWrapper.class.setTimeout(() => {
                            self.rtspTokenExpired.push(token);
                            handler = null;
                        }, 30000);
                        this.webServices.webSocket.on("connection", (webSocketClient, req) => {
                            if (req.url == "/" + token) {
                                if (handler && self.rtspTokenExpired.indexOf(token) === -1) {
                                    handler(webSocketClient);
                                    self.rtspTokenExpired.push(token);
                                    TimerWrapper.class.clearTimeout(timeoutConnexion);
                                }

                                webSocketClient.on("close", ()=> {
                                    Logger.info("Disconnect RTSP client");
                                    handler = null;
                                    self.rtspTokenExpired.push(token);
                                });
                            }
                        });

                        resolve(new APIResponse.class(true, {token: token, ws: this.webServices.webSocketTunnel}));
                    } catch(e) {
                        Logger.err(e);
                        reject(new APIResponse.class(false, {}, 743, "Error in RTSP"));
                    }

                } else {
                    reject(new APIResponse.class(false, {}, 764, ERROR_UNKNOWN_MODE));
                }
            });
        } else if (apiRequest.route.startsWith(CAMERAS_MOVE_BASE)) {
            return new Promise((resolve, reject) => {
                const id = parseInt(apiRequest.data.id);
                const direction = parseInt(apiRequest.data.direction);
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
        } else if (apiRequest.route.startsWith(CAMERAS_MANAGER_TIMELAPSE_DAILY_HOT_STREAM_BASE)) {
            return new Promise((resolve, reject) => {
                self.stream(apiRequest, self.dailyHotFilepath, reject);
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
        } else if (apiRequest.route.startsWith(CAMERAS_MANAGER_TIMELAPSE_DAILY_HOT_GET_BASE)) {
            return new Promise((resolve, reject) => {
                const camera = this.getCamera(apiRequest.data.id);
                if (camera) {
                    const dailyHotFilepath = this.dailyHotFilepath(camera, this.camerasArchiveFolder);
                    if (fs.existsSync(dailyHotFilepath)) {
                        apiRequest.res.setHeader("Content-disposition", "attachment; filename=daily-hot-" + camera.id + TimelapseGenerator.VIDEO_EXTENSION);
                        apiRequest.res.setHeader("Content-type", "video/mp4");
                        const filestream = fs.createReadStream(dailyHotFilepath);
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
     * @param  {object} cameraData1 Camera data 1
     * @param  {object} cameraData2 Camera data 2
     * @returns {boolean}             True if id is the same, false otherwise
     */
    comparator(cameraData1, cameraData2) {
        return (cameraData1.id === cameraData2.id);
    }

    /**
     * Get camera configuration. If no parameters are passed, returns the array of all camera configuration.
     *
     * @param  {string} [cameraId=null] The camera identifier. Can be null.
     * @returns {object}                 The camera configuration, or configurations, or null if nothing found
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
            if (cam.def) {
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
     * @param  {boolean}   [force=false] Force retrieve picture
     */
    getImage(id, cb, timestamp = null, force = false) {
        if (id) {
            const camera = this.getCamera(id);
            const self = this;
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
                    if (this.cameraCapture[camera.id.toString()] && !force) {
                        cb(null, this.cameraCapture[camera.id.toString()], "image/jpeg");
                    } else {
                        if (camera.snapshotUrl && camera.snapshotUrl.length > 0) {
                            Logger.verbose("Retrieving picture from camera " + id);
                            let url = camera.snapshotUrl;
                            if (camera.snapshotUrl.indexOf("?") === -1) {
                                url += "?rnd=" + DateUtils.class.timestamp();
                            } else {
                                url += "&rnd=" + DateUtils.class.timestamp();
                            }
                            request(url, {encoding: "binary", "timeout": 60000}, function(error, response, body) {
                                if (error) {
                                    Logger.err("Camera picture " + id + " error");
                                    Logger.err(error);
                                    cb(error);
                                } else {
                                    Logger.verbose("Camera picture " + id + " done !");
                                    if (camera.configuration && camera.configuration.rotation && camera.configuration.rotation != "0") {
                                        ImageUtils.class.rotateb(Buffer.from(body, "binary"), (err, data) => {
                                            self.cameraCapture[id.toString()] = data;
                                            cb(err, data, response.headers["content-type"]);
                                        }, parseInt(camera.configuration.rotation));
                                    } else {
                                        cb(null, Buffer.from(body, "binary"), response.headers["content-type"]);
                                    }
                                }
                            });
                        } else if (camera.rtspUrl && camera.rtspUrl.length > 0) {
                            if (this.cameraCapture[camera.id.toString()] && !force) {
                                cb(null, this.cameraCapture[camera.id.toString()], "image/jpeg");
                            } else {
                                try {
                                    const stream = new rtsp.FFMpeg({input: camera.rtspUrl, rate: 1, resolution: "640x480"});

                                    let childProcess = null;
                                    let timeout = TimerWrapper.class.setTimeout(() => {
                                        stream.stop();
                                        cb(Error(ERROR_NO_IMAGE));
                                    }, 5000);
                                    stream.on("data", (data) => {
                                        stream.child = childProcess;
                                        stream.stop();
                                        clearInterval(timeout);
                                        if (camera.configuration && camera.configuration.rotation && camera.configuration.rotation != "0") {
                                            ImageUtils.class.rotateb(data, (err, data) => {
                                                self.cameraCapture[id.toString()] = data;
                                                cb(err, data, "image/jpeg");
                                            }, parseInt(camera.configuration.rotation));
                                        } else {
                                            cb(null, data, "image/jpeg");
                                        }
                                    });


                                    childProcess = stream.child;
                                } catch(e) {
                                    Logger.err(e);
                                    cb(e);
                                }
                            }
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
     * Get the daily hot file path
     *
     * @param  {Camera} camera               A camera
     * @param  {string} camerasArchiveFolder Camera archive folder
     * @returns {string}                      The path
     */
    dailyHotFilepath(camera, camerasArchiveFolder) {
        return camerasArchiveFolder + camera.id + CAMERA_DAILY_HOT_EXTENSION + TimelapseGenerator.VIDEO_EXTENSION;
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
     * Clean video files
     *
     * @param  {CamerasManager} context The context (self)
     */
    cleanVideoFiles(context) {
        const cameras = context.cameras;
        cameras.forEach((camera) => {
            fs.remove(context.dailyHotFilepath(camera, context.camerasArchiveFolder));
        });
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

                    Logger.info("Timelapse generated ! file : " + filename);
                } else {
                    Logger.info("Timelapse error ! file : " + filename);
                    Logger.err(error);
                }
                this.currentTimelapse = null;
                if (this.timelapseQueue.length > 0) {
                    const nextTimeLapse = this.timelapseQueue.pop();
                    Logger.warn("Generating next timelapse queue. Generating " + nextTimeLapse.filename);
                    this.processAutotimelapse(nextTimeLapse.timelapse, nextTimeLapse.filename);
                } else {
                    Logger.info("No more timelapse in queue");
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
        // if (!this.currentRecording[parseInt(id)]) {
        this.currentRecording[parseInt(id)] = {};
        const camera = this.getCamera(id);
        if (camera.mjpegUrl) {
            try {
                const recordSessionFile = this.cachePath + id + "-" + DateUtils.class.timestamp() + "-record";
                const recordSessionFileAi = this.cachePath + id + "-" + DateUtils.class.timestamp() + "-record-ai";
                const showRectangles = (camera.configuration && camera.configuration.cvlive) ? true : false;
                Logger.info("Recording video for camera " + id + " for " + timer + " seconds");
                let frameCount = 0;
                const wstream = fs.createWriteStream(recordSessionFile + ".mjpg");
                const req = request(camera.mjpegUrl);
                const PassThrough = require("stream").PassThrough;
                const pt = new PassThrough();
                let currentPic = Buffer.alloc(0); // Buffer

                req.pipe(pt).pipe(wstream);

                pt.on("data", (chunk) => {
                    if (chunk.toString("utf8").indexOf("JFIF") !==-1 ) {
                        frameCount++;
                    }

                    if (showRectangles) {
                        // A footer
                        if (chunk.indexOf(MjpegProxy.JPG_FOOTER, 0, "hex") != -1 && currentPic && currentPic.length > 0) {
                            currentPic = Buffer.concat([currentPic, chunk.slice(0, chunk.indexOf(MjpegProxy.JPG_FOOTER, 0, "hex") + MjpegProxy.JPG_FOOTER.length)]);
                            if (this.detectedObjects[camera.id.toString()] && this.detectedObjects[camera.id.toString()].length > 0) {
                                currentPic = this.aiManager.drawCvRectangles(this.detectedObjects[camera.id.toString()], currentPic);
                            }
                            fs.appendFile(recordSessionFileAi, Buffer.concat([Buffer.from("\r\n--bounds\r\nContent-type: image/jpeg\r\nContent-Length: " + currentPic.length + "\r\n\r\n"), Buffer.from(currentPic)]));

                            currentPic = Buffer.alloc(0);
                        }

                        // No header, no footer
                        if (chunk.indexOf(MjpegProxy.JPG_HEADER, 0, "hex") == -1 && chunk.indexOf(MjpegProxy.JPG_HEADER, 0, "hex") == -1 && currentPic && currentPic.length > 0) {
                            currentPic = Buffer.concat([Buffer.from(currentPic), chunk]);
                        }

                        // New header
                        if (chunk.indexOf(MjpegProxy.JPG_HEADER, 0, "hex") != -1) {
                            currentPic = Buffer.concat([chunk.slice(chunk.indexOf(MjpegProxy.JPG_HEADER, 0, "hex"), chunk.length)]);
                        }
                    }
                });
                req.on("error", (err) => {
                    cb(err);
                });

                TimerWrapper.class.setTimeout((vwstream, vreq, self) => {
                    vwstream.end();
                    vreq.abort();
                    const frameRate = Math.round(frameCount / timer);
                    Logger.info("Record session stop");
                    delete this.currentRecording[parseInt(id)];
                    Logger.info("Detected frames : " + frameCount);
                    Logger.info("Detected framerate : " + frameRate);
                    Logger.info("Converting video session");

                    this.installationManager.executeCommand("ffmpeg -r " + ((frameRate < 1) ? 1:frameRate) + " -i " + (showRectangles ? recordSessionFileAi : recordSessionFile + ".mjpg") + " -vcodec libx264 " + recordSessionFile + TimelapseGenerator.VIDEO_EXTENSION, false, (error, stdout, stderr) => {
                        // Clean mjpg stream
                        fs.remove(recordSessionFile + ".mjpg");
                        if (showRectangles) {
                            fs.remove(recordSessionFileAi);
                        }

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
        // } else {
        //     cb(Error(ERROR_RECORD_ALREADY_RUNNING));
        // }
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

module.exports = {class:CamerasManager, ERROR_ALREADY_REGISTERED:ERROR_ALREADY_REGISTERED, ERROR_NOT_REGISTERED:ERROR_NOT_REGISTERED, CAMERA_FILE_EXTENSION:CAMERA_FILE_EXTENSION, ERROR_TIMELAPSE_NOT_GENERATED:ERROR_TIMELAPSE_NOT_GENERATED, MODE_STATIC:MODE_STATIC, MODE_MJPEG:MODE_MJPEG, MODE_RTSP:MODE_RTSP};
