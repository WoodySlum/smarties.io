"use strict";
const fs = require("fs-extra");
const Logger = require("./../../logger/Logger");
const DeviceForm = require("./DeviceForm");
const FormConfiguration = require("./../formconfiguration/FormConfiguration");
const WebServices = require("./../../services/webservices/WebServices");
const Authentication = require("./../authentication/Authentication");
const APIResponse = require("./../../services/webservices/APIResponse");
const Tile = require("./../dashboardmanager/Tile");
const DevicesListForm = require("./DevicesListForm");
const DevicesListSimpleForm = require("./DevicesListSimpleForm");
const DevicesListScenarioTriggerForm = require("./DevicesListScenarioTriggerForm");
const DevicesListScenarioForm = require("./DevicesListScenarioForm");
const Icons = require("./../../utils/Icons");
const DeviceStatus = require("./DeviceStatus");
const EnvironmentManager = require("./../environmentmanager/EnvironmentManager");
const DbSchemaConverter = require("./../dbmanager/DbSchemaConverter");
const DbHelper = require("./../dbmanager/DbHelper");
const DbDevice = require("./DbDevice");

const DEVICE_TYPE_LIGHT = "light";
const DEVICE_TYPE_LIGHT_DIMMABLE = "light-dimmable";
const DEVICE_TYPE_LIGHT_DIMMABLE_COLOR = "light-dimmable-color";
const DEVICE_TYPE_SHUTTER = "shutter";
const DEVICE_TYPE_LIGHT_PRIORITY = 20;
const DEVICE_TYPE_LIGHT_DIMMABLE_PRIORITY = 30;
const DEVICE_TYPE_LIGHT_DIMMABLE_COLOR_PRIORITY = 40;
const DEVICE_TYPE_SHUTTER_PRIORITY = 50;

const DB_VERSION = "0.0.0";

const STATUS_ON = "on";
const STATUS_OFF = "off";
const STATUS_OPEN = "open";
const STATUS_CLOSE = "close";
const STATUS_STOP = "stop";
const STATUS_IGNORE = "ignore";
const INT_STATUS_ON = 1;
const INT_STATUS_STOP = 0;
const INT_STATUS_OFF = -1;
const STATUS_INVERT = "invert";
const ROUTE_ALL_ON = "/devices/allon/";
const ROUTE_ALL_OFF = "/devices/alloff/";
const DEVICE_NAME_COMPARE_CONFIDENCE = 0.31;
const EVENT_UPDATE_CONFIG_DEVICES = "update-config-devices";


const ITEM_CHANGE_STATUS = "status";
const ITEM_CHANGE_BRIGHTNESS = "brightness";
const ITEM_CHANGE_COLOR = "color";
const ITEM_CHANGE_COLOR_TEMP = "color-temperature";
const DEVICE_COLORS = [
    "FFFFFF",
    "EEEEEE",
    "980000",
    "FF0000",
    "FF9900",
    "FFFF00",
    "00FF00",
    "00FFFF",
    "4A86E8",
    "0000FF",
    "9900FF",
    "FF00FF"
];

const AI_KEY = "devices";
const AI_STATUS_CLASSIFIER = "STATUS@";

/**
 * This class allows to manage devices
 * @class
 */
class DeviceManager {
    /**
     * Constructor
     *
     * @param  {ConfManager} confManager  A configuration manager
     * @param  {FormManager} formManager  A form manager
     * @param  {WebServices} webServices  The web services
     * @param  {RadioManager} radioManager The radio manager
     * @param  {DashboardManager} dashboardManager The dashboard manager
     * @param  {ScenarioManager} scenarioManager    The scenario manager
     * @param  {TranslateManager} translateManager    The translate manager
     * @param  {EnvironmentManager} environmentManager    The environment manager
     * @param  {BotEngine} botEngine    The bot engine
     * @param  {SensorsManager} sensorsManager    The sensrsManager
     * @param  {EventEmitter} eventBus    The global event bus
     * @param  {DbManager} dbManager    The database manager
     * @param  {AiManager} aiManager    The ai manager
     * @returns {DeviceManager}              The instance
     */
    constructor(confManager, formManager, webServices, radioManager, dashboardManager, scenarioManager, translateManager, environmentManager, botEngine, sensorsManager, eventBus, dbManager, aiManager) {
        this.formConfiguration = new FormConfiguration.class(confManager, formManager, webServices, "devices", true, DeviceForm.class);
        this.radioManager = radioManager;
        this.dashboardManager = dashboardManager;
        this.scenarioManager = scenarioManager;
        this.formManager = formManager;
        this.translateManager = translateManager;
        this.environmentManager = environmentManager;
        this.botEngine = botEngine;
        this.sensorsManager = sensorsManager;
        this.eventBus = eventBus;
        this.dbManager = dbManager;
        this.aiManager = aiManager;
        this.switchDeviceModules = {};

        this.radioManager.deviceManager = this; // Set the device manager. used to associate devices to received radio objects

        webServices.registerAPI(this, WebServices.POST, ":/device/set/[id]/[status*]/[brightness*]/[color*]/[colorTemperature*]/", Authentication.AUTH_GUEST_LEVEL);
        webServices.registerAPI(this, WebServices.POST, ":" + ROUTE_ALL_ON, Authentication.AUTH_GUEST_LEVEL);
        webServices.registerAPI(this, WebServices.POST, ":" + ROUTE_ALL_OFF, Authentication.AUTH_GUEST_LEVEL);

        this.dbSchema = DbSchemaConverter.class.toSchema(DbDevice.class);
        this.dbManager.initSchema(this.dbSchema, DB_VERSION, null);
        this.dbHelper = new DbHelper.class(this.dbManager, this.dbSchema, DbSchemaConverter.class.tableName(DbDevice.class), DbDevice.class);

        this.registerDeviceTiles();
        this.registerDeviceListForm();

        // Register to form configuration callback
        this.formConfiguration.setUpdateCb((obj) => {
            this.registerDeviceTiles();
            this.registerDeviceListForm();
            this.eventBus.emit(EVENT_UPDATE_CONFIG_DEVICES, obj);
        });

        const self = this;
        this.scenarioManager.register(DevicesListScenarioForm.class, (scenario) => {
            self.triggerScenario(scenario, self);
        }, "devices.list.scenario.title");

        this.botEngine.registerBotAction("turnon", (action, value, type, confidence, sender, cb) => {
            let maxConfidence = 0;
            let detectedDevice = null;
            self.formConfiguration.getDataCopy().forEach((device) => {
                const stringConfidence = this.botEngine.stringSimilarity().compareTwoStrings(device.name, value);
                Logger.info("Confidence " + value + " | " + device.name + ": " + stringConfidence);
                if (stringConfidence >= DEVICE_NAME_COMPARE_CONFIDENCE && stringConfidence > maxConfidence) {
                    detectedDevice = device;
                    maxConfidence = stringConfidence;
                }
            });

            if (detectedDevice) {
                Logger.info("Match found ! : " + detectedDevice.name);
                self.switchDevice(detectedDevice.id, STATUS_ON);
                cb(this.translateManager.t("devices.bot.turnon", detectedDevice.name));
            } else {
                cb(this.translateManager.t("devices.bot.notfound"));
            }
        });

        this.botEngine.registerBotAction("turnoff", (action, value, type, confidence, sender, cb) => {
            let maxConfidence = 0;
            let detectedDevice = null;
            self.formConfiguration.getDataCopy().forEach((device) => {
                const stringConfidence = this.botEngine.stringSimilarity().compareTwoStrings(device.name, value);
                Logger.info("Confidence " + value + " | " + device.name + ": " + stringConfidence);
                if (stringConfidence >= DEVICE_NAME_COMPARE_CONFIDENCE && stringConfidence > maxConfidence) {
                    detectedDevice = device;
                    maxConfidence = stringConfidence;
                }
            });

            if (detectedDevice) {
                Logger.info("Match found ! : " + detectedDevice.name);
                self.switchDevice(detectedDevice.id, STATUS_OFF);
                cb(this.translateManager.t("devices.bot.turnoff", detectedDevice.name));
            } else {
                cb(this.translateManager.t("devices.bot.notfound"));
            }
        });

        this.formConfiguration.setSortFunction((a,b) => a.name.localeCompare(b.name));

        // Fix #56 - Refactor devices and radio
        // The radio manager will add the good radio form instead of adding statically
        this.radioManager.registerDeviceManagerForm(this);

        // Restore when power outage has occured
        this.eventBus.on(EnvironmentManager.EVENT_POWER_OUTAGE, () => {
            Logger.info("Restoring devices states due to power outage alert");
            self.getDevices().forEach((device) => {
                if (device.powerOutageRestore) {
                    self.switchDeviceWithDevice(device);
                }
            });
        });

        // Machine learning
        this.aiManager.register(AI_KEY);
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
        delete this.switchDeviceModules[key];
        this.switchDeviceModules[key] = {};
        this.switchDeviceModules[key].formName = form.prototype.constructor.name;
        this.formManager.addAdditionalFields(DeviceForm.class, title, [form], isList);
    }

    /**
     * Register a switch device function
     * The method `addForm` should be called before
     *
     * @param  {string}   key A key, the same as set in `addForm`
     * @param  {Function} cb  The callback when a device switches `(device, formData, deviceStatus) => {}`. Please note that this callback can return a DeviceStatus object to save state. You can modify and return the status as parameter.
     * @param  {string} [type=DEVICE_TYPE_LIGHT]  The device type, constant can be `DEVICE_TYPE_LIGHT`, `DEVICE_TYPE_LIGHT_DIMMABLE`, `DEVICE_TYPE_LIGHT_DIMMABLE_COLOR`, `DEVICE_TYPE_SHUTTER`
     */
    registerSwitchDevice(key, cb, type = DEVICE_TYPE_LIGHT_DIMMABLE_COLOR) {
        if (!this.switchDeviceModules[key]) {
            throw Error("You must call addForm before calling registerSwitchDevice. A form must be added in order to identify which callback should be processed.");
        }
        this.switchDeviceModules[key].type = type;
        this.switchDeviceModules[key].switch = cb;

        // Update tiles for device types
        this.registerDeviceTiles();
        this.registerDeviceListForm();
    }

    /**
     * Trigger scenario elements
     *
     * @param  {Object} scenario A dynamic scenario object
     * @param  {DeviceManager} context  The context
     */
    triggerScenario(scenario, context) {
        if (scenario && scenario.DevicesListScenarioForm) {
            if (scenario.DevicesListScenarioForm.turnOnAll) {
                context.switchAll(STATUS_ON);
            }

            if (scenario.DevicesListScenarioForm.turnOffAll) {
                context.switchAll(STATUS_OFF);
            }

            if (scenario.DevicesListScenarioForm.devices && scenario.DevicesListScenarioForm.devices.length > 0) {
                scenario.DevicesListScenarioForm.devices.forEach((scenarioDevice) => {

                    let adjustBrightness = 0;
                    if (typeof scenarioDevice.updateBrightness !== "undefined") {
                        adjustBrightness = parseFloat(scenarioDevice.updateBrightness);
                    }

                    let adjustTemperature = 0;
                    if (typeof scenarioDevice.updateTemperature !== "undefined") {
                        adjustTemperature = parseFloat(scenarioDevice.updateTemperature);
                    }

                    let adjustColor = 0;
                    if (typeof scenarioDevice.updateColor !== "undefined") {
                        adjustColor = parseFloat(scenarioDevice.updateColor);
                    }

                    const newColor = (adjustColor, color) => {
                        let i = 0;
                        let found = 0;
                        DEVICE_COLORS.forEach((deviceColor) => {
                            if (deviceColor == color) {
                                found = i;
                            }
                            i++;
                        });
                        if ((found + adjustColor) >= 0 && (found + adjustColor) < DEVICE_COLORS.length) {
                            color = DEVICE_COLORS[(found + adjustColor)];
                        } else if ((found + adjustColor) >= DEVICE_COLORS.length) {
                            color = DEVICE_COLORS[0];
                        } else if ((found + adjustColor) < 0) {
                            color = DEVICE_COLORS[DEVICE_COLORS.length - 1];
                        }

                        return color;
                    };

                    if (!scenarioDevice.keepParams) {
                        context.switchDevice(scenarioDevice.identifier, scenarioDevice.status, scenarioDevice.brightness, scenarioDevice.color, scenarioDevice.colorTemperature);
                    } else {
                        const device = context.getDeviceById(scenarioDevice.identifier);
                        if (device) {
                            if (typeof device.brightness === "undefined") {
                                device.brightness = 0;
                            }
                            if (typeof device.colorTemperature === "undefined") {
                                device.colorTemperature = 0;
                            }

                            context.switchDevice(scenarioDevice.identifier, scenarioDevice.status, (parseFloat(device.brightness) + adjustBrightness), newColor(adjustColor, device.color), parseFloat(device.colorTemperature) + adjustTemperature);
                        }
                    }
                });
            }
        }
    }

    /**
     * Register a device list form
     */
    registerDeviceListForm() {
        const devicesName = [];
        const devicesId = [];
        this.formConfiguration.data.sort((a,b) => a.name.localeCompare(b.name)).forEach((device) => {
            const deviceType = this.bestDeviceType(this.getDeviceTypes(device));
            devicesName.push((deviceType ? (deviceType.charAt(0).toUpperCase() + String(deviceType.slice(1)).replace(/-/g, " ") + " - ") : "") + device.name);
            devicesId.push(device.id);
        });
        this.formManager.register(DevicesListForm.class, devicesName, devicesId);
        this.formManager.register(DevicesListSimpleForm.class, devicesName, devicesId);
        this.formManager.register(DevicesListScenarioTriggerForm.class, devicesName, devicesId);
    }

    /**
     * Register all devices on dashboard to get tiles on UI
     */
    registerDeviceTiles() {
        // Devices tiles
        let data = this.formConfiguration.data.sort((a,b) => a.name.localeCompare(b.name));
        data.forEach((device) => {
            this.registerDeviceTile(device, data);
        });

        // All on tile
        const tileAllOn = new Tile.class(this.dashboardManager.themeManager, "all-on", Tile.TILE_GENERIC_ACTION, Icons.class.list()["plug"], null, this.translateManager.t("device.manager.allon"), null, null, null, null, 10300, ROUTE_ALL_ON, null);
        this.dashboardManager.registerTile(tileAllOn, 9600);
        // All off tile
        const tileAllOff = new Tile.class(this.dashboardManager.themeManager, "all-off", Tile.TILE_GENERIC_ACTION, Icons.class.list()["unplug"], null, this.translateManager.t("device.manager.alloff"), null, null, null, null, 10200, ROUTE_ALL_OFF, null);
        this.dashboardManager.registerTile(tileAllOff, 9601);
    }

    /**
     * Return the list of devices
     *
     * @returns {Array} The list of devices
     */
    getDevices() {
        const devices = this.formConfiguration.getDataCopy();
        devices.forEach((device) => {
            device.bestDeviceType = this.bestDeviceType(this.getDeviceTypes(device));
        });

        return devices;
    }

    /**
     * Return a status of a device
     *
     * @param  {number} id            A device identifier
     * @returns {boolean} Status of the device
     */
    getDeviceStatus(id) {
        let foundDevice = null;
        this.getDevices().forEach((device) => {
            if (device.id === id) {
                foundDevice = device;
            }
        });

        return foundDevice.status;
    }

    /**
     * Return a best device type
     *
     * @param  {Array} deviceTypes            A list of device types
     * @returns {string} Best device type;
     */
    bestDeviceType(deviceTypes) {
        let bestDeviceTypePriority = 0;
        let bestDeviceType = DEVICE_TYPE_LIGHT;
        deviceTypes.forEach((deviceType) => {
            if (deviceType == DEVICE_TYPE_LIGHT && DEVICE_TYPE_LIGHT_PRIORITY > bestDeviceTypePriority) {
                bestDeviceTypePriority = DEVICE_TYPE_LIGHT_PRIORITY;
                bestDeviceType = DEVICE_TYPE_LIGHT;
            } else if (deviceType == DEVICE_TYPE_LIGHT_DIMMABLE && DEVICE_TYPE_LIGHT_DIMMABLE_PRIORITY > bestDeviceTypePriority) {
                bestDeviceTypePriority = DEVICE_TYPE_LIGHT_DIMMABLE_PRIORITY;
                bestDeviceType = DEVICE_TYPE_LIGHT_DIMMABLE;
            } else if (deviceType == DEVICE_TYPE_LIGHT_DIMMABLE_COLOR && DEVICE_TYPE_LIGHT_DIMMABLE_COLOR_PRIORITY > bestDeviceTypePriority) {
                bestDeviceTypePriority = DEVICE_TYPE_LIGHT_DIMMABLE_COLOR_PRIORITY;
                bestDeviceType = DEVICE_TYPE_LIGHT_DIMMABLE_COLOR;
            } else if (deviceType == DEVICE_TYPE_SHUTTER && DEVICE_TYPE_SHUTTER_PRIORITY > bestDeviceTypePriority) {
                bestDeviceTypePriority = DEVICE_TYPE_SHUTTER_PRIORITY;
                bestDeviceType = DEVICE_TYPE_SHUTTER;
            }

        });

        return bestDeviceType;
    }

    /**
     * Register a device on dashboard
     *
     * @param  {DeviceForm} device A device
     * @param  {Array} data Some data
     * @param  {number} [index=-1] An index
     */
    registerDeviceTile(device, data = [], index = -1) {
        if (device.visible) {
            let i = (index === -1)?(9000 + data.indexOf(device)):index;
            const deviceTypes = this.getDeviceTypes(device);
            const deviceType = this.bestDeviceType(deviceTypes);
            const deviceStatus = new DeviceStatus.class(deviceTypes, device.status, device.brightness, device.color, device.colorTemperature);

            let deviceInfos = deviceStatus.tileFormat();
            if (deviceType == DEVICE_TYPE_LIGHT_DIMMABLE_COLOR) {
                deviceInfos = Object.assign(deviceInfos, {colors:DEVICE_COLORS});
            }

            let tile;
            if (deviceType === DEVICE_TYPE_LIGHT || deviceType === DEVICE_TYPE_LIGHT_DIMMABLE || deviceType === DEVICE_TYPE_LIGHT_DIMMABLE_COLOR) {
                tile = new Tile.class(this.dashboardManager.themeManager, device.id, Tile.TILE_DEVICE, device.icon.icon, null, device.name, null, null, null, device.status > 0?1:0, i, "/device/set/" + device.id + "/", deviceInfos, null, Authentication.AUTH_GUEST_LEVEL);
            } else if (deviceType === DEVICE_TYPE_SHUTTER) {
                tile = new Tile.class(this.dashboardManager.themeManager, device.id, Tile.TILE_SHUTTER, device.icon.icon, null, device.name, null, fs.readFileSync("./res/tiles/shutter.jpg").toString("base64"), null, device.status > 0?1:0, i, "/device/set/" + device.id + "/", deviceInfos, null, Authentication.AUTH_GUEST_LEVEL);
            }

            this.dashboardManager.registerTile(tile);
        }
    }

    /**
     * Returns the supported modes for a specific device (e.g. light, dimmable, color, ...)
     *
     * @param  {Object} device A device
     * @returns {[string]}        The list of supported modes
     */
    getDeviceTypes(device) {
        const modes = [];
        Object.keys(this.switchDeviceModules).forEach((switchDeviceModuleKey) => {

            const switchDeviceModule = this.switchDeviceModules[switchDeviceModuleKey];
            if (device && device[switchDeviceModule.formName]) {
                if (modes.indexOf(switchDeviceModule.type) === -1) {
                    modes.push(switchDeviceModule.type);
                }
            }
        });

        return modes;
    }

    /**
     * Returns a device from an identifier
     *
     * @param  {string} id An identifier
     * @returns {Object}    A device
     */
    getDeviceById(id) {
        let found = null;
        this.getDevices().forEach((device) => {
            if (device.id == id) {
                found = device;
            }
        });

        return found;
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
        const device = this.getDeviceById(id);
        if (device && device.subDevices && device.subDevices.length > 0) {
            device.subDevices.forEach((subDevice) => {
                this.switchDevice(subDevice.identifier, status, brightness, color, colorTemperature);
            });
        }
        color = color ? color.replace("#", "") : color; // Remove sharp
        if (typeof status === "string") {
            if (status && (status.toLowerCase() === STATUS_ON || status.toLowerCase() === STATUS_OPEN)) {
                status = INT_STATUS_ON;
            } else if (status && (status.toLowerCase() === STATUS_OFF || status.toLowerCase() === STATUS_CLOSE)) {
                status = INT_STATUS_OFF;
            } else if (status && status.toLowerCase() === STATUS_STOP) {
                status = INT_STATUS_STOP;
            } else if (status && status.toLowerCase() === STATUS_INVERT) {
                if (device.status === INT_STATUS_ON) {
                    status = INT_STATUS_OFF;
                } else {
                    status = INT_STATUS_ON;
                }
            } else {
                status = parseInt(status);
            }
        }

        this.formConfiguration.getDataCopy().forEach((deviceConfiguration) => {
            if (parseInt(deviceConfiguration.id) === parseInt(id)) {
                Logger.info("Switch device " + deviceConfiguration.name + " (" + deviceConfiguration.id + "). Status (" + status + ") / Brightness (" + brightness + ") / Color (" + color + ") / ColorTemperature (" + colorTemperature + ")");
                // Check for day and night mode
                if (!deviceConfiguration.worksOnlyOnDayNight
                    || (deviceConfiguration.worksOnlyOnDayNight === 1)
                    || (deviceConfiguration.worksOnlyOnDayNight === 2 && !this.environmentManager.isNight())
                    || (deviceConfiguration.worksOnlyOnDayNight === 3 && this.environmentManager.isNight())
                    || deviceConfiguration.status === INT_STATUS_ON) {

                    let newDeviceStatus = null;
                    if (device && device.subDevices && device.subDevices.length > 0) {
                        newDeviceStatus = new DeviceStatus.class(this.getDeviceTypes(device), status, brightness, color, colorTemperature, []);
                    }
                    Object.keys(this.switchDeviceModules).forEach((switchDeviceModuleKey) => {
                        const switchDeviceModule = this.switchDeviceModules[switchDeviceModuleKey];
                        if (deviceConfiguration[switchDeviceModule.formName]) {
                            // Detect what changed
                            const changes = [];
                            if (deviceConfiguration.status != status) {
                                changes.push(ITEM_CHANGE_STATUS);
                            }

                            if (deviceConfiguration.brightness != brightness) {
                                changes.push(ITEM_CHANGE_BRIGHTNESS);
                            }
                            if (deviceConfiguration.color != color) {
                                changes.push(ITEM_CHANGE_COLOR);
                            }
                            if (deviceConfiguration.colorTemperature != colorTemperature) {
                                changes.push(ITEM_CHANGE_COLOR_TEMP);
                            }

                            newDeviceStatus = switchDeviceModule.switch(deviceConfiguration, deviceConfiguration[switchDeviceModule.formName], new DeviceStatus.class(this.getDeviceTypes(deviceConfiguration), status, brightness, color, colorTemperature, changes));
                        }
                    });

                    if (newDeviceStatus) {
                        deviceConfiguration.status = newDeviceStatus.getStatus();
                        deviceConfiguration.brightness = newDeviceStatus.getBrightness();
                        deviceConfiguration.color = newDeviceStatus.getColor();
                        deviceConfiguration.colorTemperature = newDeviceStatus.getColorTemperature();
                        this.saveDevice(deviceConfiguration);
                    }
                } else {
                    Logger.warn("Turning device " + device.id + " is not authorized due to day / night mode. Device configuration (" + device.worksOnlyOnDayNight + "), Current mode is night (" + this.environmentManager.isNight() + "), Status (" + device.status + "), Compared status (" + INT_STATUS_ON + ")");
                }
            }
        });

        // Trigger scenarios
        this.scenarioManager.getScenarios().forEach((scenario) => {
            if (scenario.DevicesListScenarioForm) {
                if (scenario.DevicesListScenarioForm.triggerOnDevice && scenario.DevicesListScenarioForm.triggerOnDevice.length > 0) {
                    let shouldExecuteAction = false;
                    scenario.DevicesListScenarioForm.triggerOnDevice.forEach((deviceTriggerScenario) => {
                        if (deviceTriggerScenario.identifier.toString() === id.toString()) {
                            if ((deviceTriggerScenario.status === STATUS_ON || deviceTriggerScenario.status === STATUS_OPEN) && status === INT_STATUS_ON) {
                                shouldExecuteAction = true;
                            } else if ((deviceTriggerScenario.status === STATUS_OFF || deviceTriggerScenario.status === STATUS_CLOSE) && status === INT_STATUS_OFF) {
                                shouldExecuteAction = true;
                            } else if (deviceTriggerScenario.status === STATUS_IGNORE) {
                                shouldExecuteAction = true;
                            } else if (deviceTriggerScenario.status === STATUS_STOP) {
                                shouldExecuteAction = true;
                            }
                        }
                    });

                    if (shouldExecuteAction) {
                        this.scenarioManager.triggerScenario(scenario);
                    }
                }
            }
        });

        // Save device to database
        const dbDevice = new DbDevice.class(this.dbHelper, id, status, brightness, color, colorTemperature);
        dbDevice.save();

        // Machine learning
        if (!process.env.TEST) {
            const device = this.getDeviceById(id);
            const aiClassifiers = [device.id, (AI_STATUS_CLASSIFIER + status)];
            if (device && device.room && device.room.room) {
                aiClassifiers.push(device.room.room);
            }

            if (device.name) {
                aiClassifiers.push(device.name);
            }
            const classifiedValue = device.status + "@" + device.brightness;
            this.aiManager.learnWithTime(AI_KEY, aiClassifiers, classifiedValue).then(() => {
                Logger.verbose("Learned new value for " + device.id);
            }).catch((e) => {
                Logger.err("Error while learning sensor : " + e.message);
            });
        }
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
        const aiClassifiers = [];
        if (identifier) {
            aiClassifiers.push(identifier);
        } else {
            if (room) {
                aiClassifiers.push(room);
            }

            if (name) {
                aiClassifiers.push(name);
            }
        }

        if (status != null) {
            aiClassifiers.push((AI_STATUS_CLASSIFIER + status));
        }

        if (cb) {
            this.aiManager.guessWithTime(AI_KEY, aiClassifiers, timestamp).then((res) => {
                if (res && res.indexOf("@") > 0) {
                    const resSplit = res.split("@");
                    cb(null, parseInt(resSplit[0]), parseFloat(resSplit[1]));
                } else {
                    cb(Error("No value"), null, null);
                }
            }).catch((err) => {
                cb(err, null, null);
            });

            return null;
        } else {
            return new Promise((resolve, reject) => {
                this.aiManager.guessWithTime(AI_KEY, aiClassifiers, timestamp).then((res) => {
                    if (res && res.indexOf("@") > 0) {
                        const resSplit = res.split("@");
                        cb(null, parseInt(resSplit[0]), parseFloat(resSplit[1]));
                    } else {
                        reject(Error("No value"));
                    }
                }).catch((err) => {
                    reject(err, null, null);
                });
            });
        }
    }

    /**
     * Switch device with a device object
     *
     * @param  {Object} device A device
     */
    switchDeviceWithDevice(device) {
        this.switchDevice(device.id, device.status, device.brightness, device.color);
    }

    /**
     * Save device
     *
     * @param  {Object} device A device
     */
    saveDevice(device) {
        this.formConfiguration.saveConfig(device);

        // Devices tiles
        let data = this.formConfiguration.data.sort((a,b) => a.name.localeCompare(b.name));

        this.registerDeviceTile(device, data); // Save to dashboard !
    }

    /**
     * Switch all devices depending on excludeAll flag
     *
     * @param  {string} status The status
     */
    switchAll(status) {
        const self = this;

        this.formConfiguration.getDataCopy().forEach((device) => {
            if (!device.excludeFromAll) {
                device.status = status;
                self.switchDeviceWithDevice(device);
            }
        });
    }

    /**
     * Get db helper
     *
     * @returns {DbHelper} The device DbHelper object
     */
    getDbHelper() {
        return this.dbHelper;
    }

    /**
     * Process API callback
     *
     * @param  {APIRequest} apiRequest An APIRequest
     * @returns {Promise}  A promise with an APIResponse object
     */
    processAPI(apiRequest) {
        const self = this;
        if (apiRequest.route.startsWith( ":/device/set/")) {
            return new Promise((resolve) => {
                self.switchDevice(apiRequest.data.id, apiRequest.data.status, apiRequest.data.brightness, apiRequest.data.color, apiRequest.data.colorTemperature);
                resolve(new APIResponse.class(true, {success:true}));
            });
        } else if (apiRequest.route ===  ":" + ROUTE_ALL_ON) {
            return new Promise((resolve) => {
                self.switchAll(STATUS_ON);
                resolve(new APIResponse.class(true, {success:true}));
            });
        } else if (apiRequest.route ===  ":" + ROUTE_ALL_OFF) {
            return new Promise((resolve) => {
                self.switchAll(STATUS_OFF);
                resolve(new APIResponse.class(true, {success:true}));
            });
        }
    }
}

module.exports = {class:DeviceManager, STATUS_ON:STATUS_ON, STATUS_OPEN:STATUS_OPEN, STATUS_CLOSE:STATUS_CLOSE, STATUS_STOP:STATUS_STOP, INT_STATUS_ON:INT_STATUS_ON, INT_STATUS_OFF:INT_STATUS_OFF, INT_STATUS_STOP:INT_STATUS_STOP, STATUS_OFF:STATUS_OFF, STATUS_INVERT:STATUS_INVERT, EVENT_UPDATE_CONFIG_DEVICES:EVENT_UPDATE_CONFIG_DEVICES, DEVICE_TYPE_LIGHT:DEVICE_TYPE_LIGHT, DEVICE_TYPE_LIGHT_DIMMABLE: DEVICE_TYPE_LIGHT_DIMMABLE, DEVICE_TYPE_LIGHT_DIMMABLE_COLOR:DEVICE_TYPE_LIGHT_DIMMABLE_COLOR, DEVICE_TYPE_SHUTTER:DEVICE_TYPE_SHUTTER, ITEM_CHANGE_STATUS:ITEM_CHANGE_STATUS, ITEM_CHANGE_BRIGHTNESS:ITEM_CHANGE_BRIGHTNESS, ITEM_CHANGE_COLOR:ITEM_CHANGE_COLOR, ITEM_CHANGE_COLOR_TEMP: ITEM_CHANGE_COLOR_TEMP};
