"use strict";
const Logger = require("./../../logger/Logger");
const Authentication = require("./../authentication/Authentication");
const FormConfiguration = require("./../formconfiguration/FormConfiguration");
const UserForm = require("./UserForm");
const ImageUtils = require("./../../utils/ImageUtils");
const Tile = require("./../dashboardmanager/Tile");
const WebServices = require("./../../services/webservices/WebServices");
const APIResponse = require("./../../services/webservices/APIResponse");
const GeoUtils = require("./../../utils/GeoUtils");
const UserScenarioForm = require("./UserScenarioForm");
const UserScenarioTriggerForm = require("./UserScenarioTriggerForm");
const Icons = require("./../../utils/Icons");
const sha256 = require("sha256");

const CONF_KEY = "users";
const ERROR_USER_NOT_FOUND = "ERROR_USER_NOT_FOUND";

const ROUTE_USER_ZONE = ":/user/zone/set/";
const ROUTE_USER_LOCATION = ":/user/location/set/";
const ROUTE_USER_SETTINGS = ":/user/settings/get/";

const USER_COMPARE_CONFIDENCE = 0.31;

/**
* This class allows to manage users (create, delete, search, ...)
 *
* @class
*/
class UserManager {
    /**
    * Constructor
    *
    * @param  {ConfManager} confManager A configuration manager needed for persistence
    * @param  {FormManager} formManager  A form manager
    * @param  {WebServices} webServices  The web services
    * @param  {DashboardManager} dashboardManager  The dashboard manager
    * @param  {AppConfiguration} appConfiguration The app configuration object
    * @param  {ScenarioManager} scenarioManager  The scenario manager
    * @param  {EnvironmentManager} environmentManager  The environment manager
    * @param  {TranslateManager} translateManager  The translate manager
    * @param {ThemeManager} themeManager       The theme manager
    * @returns {UserManager} The instance
    */
    constructor(confManager, formManager, webServices, dashboardManager, appConfiguration, scenarioManager, environmentManager, translateManager, themeManager) {
        this.formConfiguration = new FormConfiguration.class(confManager, formManager, webServices, CONF_KEY, true, UserForm.class);
        this.confManager = confManager;
        this.dashboardManager = dashboardManager;
        this.webServices = webServices;
        this.appConfiguration = appConfiguration;
        this.scenarioManager = scenarioManager;
        this.environmentManager = environmentManager;
        this.botEngine = null;
        this.translateManager = translateManager;
        this.themeManager = themeManager;
        this.updateTile();
        this.registeredHomeNotifications = {};
        this.dashboardManager.setUserManager(this);

        this.webServices.registerAPI(this, WebServices.POST, ROUTE_USER_ZONE + "[status]/", Authentication.AUTH_USAGE_LEVEL);
        this.webServices.registerAPI(this, WebServices.POST, ROUTE_USER_LOCATION + "[longitude]/[latitude]/[radius*]/[speed*]/[timestamp*]/", Authentication.AUTH_USAGE_LEVEL);
        this.webServices.registerAPI(this, WebServices.GET, ROUTE_USER_SETTINGS, Authentication.AUTH_USAGE_LEVEL);
        this.formConfiguration.setUpdateCb(() => {
            this.setAllUsersTheme();
            this.updateTile();
            this.registerScenarioForms();
        });

        this.registerScenarioForms();
        this.formConfiguration.setSortFunction((a,b) => a.username.localeCompare(b.username));
        this.setAllUsersTheme();
    }

    /**
     * Register scenario forms
     */
    registerScenarioForms() {
        this.scenarioManager.register(UserScenarioForm.class, null, "user.scenario.form.mode.trigger", 200);
        const usernames = ["-"];
        const usernamesLabels = [this.translateManager.t("user.scenario.form.provided")];
        this.getUsers().forEach((user) => {
            usernames.push(user.username);
            usernamesLabels.push(user.name);
        });

        this.scenarioManager.registerWithInjection(UserScenarioTriggerForm.class, (scenario, additionalInfos) => {
            if (scenario && scenario.UserScenarioTriggerForm && scenario.UserScenarioTriggerForm.length > 0) {
                scenario.UserScenarioTriggerForm.forEach((userScenarioTriggerForm) => {
                    const user = this.getUser(userScenarioTriggerForm.username === "-" ? additionalInfos.username : userScenarioTriggerForm.username);
                    if (user) {
                        if (userScenarioTriggerForm.inorout === 1) {
                            this.setUserZone(user.username, true);
                        } else if (userScenarioTriggerForm.inorout === 2) {
                            this.setUserZone(user.username, false);
                        } else if (userScenarioTriggerForm.inorout === 3) {
                            this.setUserZone(user.username, !user.atHome);
                        }
                    } else {
                        Logger.err("Could not find user " + additionalInfos.username);
                    }
                });
            }
        }, "user.scenario.form.trigger.mode.trigger", 100, true, usernames, usernamesLabels);
    }

    /**
    * Update user tile
    */
    updateTile() {
        const pics = [];
        let foundPics = false;
        this.getUsers().forEach((user) => {
            if (user.picture) {
                const pic = ImageUtils.class.sanitizeFormConfiguration(user.picture);
                if (pic) {
                    if (user.atHome) {
                        foundPics = true;
                        ImageUtils.class.resize(pic, (err, data) => {
                            if (!err) {
                                pics.push(data);
                                const uTile = new Tile.class(this.dashboardManager.themeManager, "users", Tile.TILE_PICTURES, Icons.icons["user"], null, null, null, null, pics);
                                this.dashboardManager.registerTile(uTile);
                            } else {
                                Logger.err(err.message);
                            }
                        });
                    }
                }
            }
        });

        if (!foundPics) {
            const tile = new Tile.class(this.dashboardManager.themeManager, "users", Tile.TILE_PICTURES, Icons.icons["user"], null, null, null, null, pics);
            this.dashboardManager.registerTile(tile);
        }
    }

    /**
    * Return a COPY of the user array
    *
    * @returns {[User]} An array of Users
    */
    getUsers() {
        return this.formConfiguration.getDataCopy();
    }

    /**
    * Get a theme for a specific user
    *
    * @param  {string} username The username
    * @returns {object}   A theme
    */
    getTheme(username) {
        const user = this.getUser(username);
        if (user && user.theme && user.theme.length > 0) {
            const base64Array = user.theme.split("base64,");
            if (base64Array.length === 2) {
                const buf = Buffer.from(base64Array[1], "base64");
                const themeStr = buf.toString("ascii");
                try {
                    const theme = JSON.parse(themeStr);
                    return theme;
                } catch (e) {
                    Logger.err("Invalid JSON for theme. User : " + username);
                }
            } else {
                Logger.err("Invalid base64 for theme. User : " + username);
            }
        }

        return null;
    }

    /**
     * Set all users theme to theme manager
     */
    setAllUsersTheme() {
        this.getUsers().forEach((user) => {
            const theme = this.getTheme(user.username);
            this.themeManager.setThemeForUser(user.username, theme);
        });
    }

    /**
    * Get a user with username
    *
    * @param  {string} username The username
    * @returns {User}   A user, null if user does not exists
    */
    getUser(username) {
        let foundUser = null;
        this.formConfiguration.getDataCopy().forEach((user) => {
            if (user.username && username && user.username.toLowerCase() === username.toLowerCase()) {
                foundUser = user;
            }
        });
        return foundUser;
    }

    /**
    * Get the admin user
    *
    * @returns {User} The admin user, null if admin user is disabled
    */
    getAdminUser() {
        if (this.confManager.appConfiguration.admin.enable) {
            return new UserForm.class(0, this.confManager.appConfiguration.admin.username, this.confManager.appConfiguration.admin.password, Authentication.AUTH_MAX_LEVEL);
        }

        return null;
    }

    /**
    * Check if all users are at home
    *
    * @returns {boolean} True if everybody is at home, false otherwise
    */
    allUsersAtHome() {
        let allUsersAtHome = true;
        this.formConfiguration.getDataCopy().forEach((user) => {
            if (!user.atHome && user.level >= Authentication.AUTH_USAGE_LEVEL && user.level != Authentication.AUTH_TABLET_LEVEL) {
                allUsersAtHome = false;
            }
        });

        return allUsersAtHome;
    }

    /**
    * Check if no users are at home
    *
    * @returns {boolean} True if nobody is at home, false otherwise
    */
    nobodyAtHome() {
        let nobodyAtHome = true;
        this.formConfiguration.getDataCopy().forEach((user) => {
            if (user.atHome && user.level >= Authentication.AUTH_USAGE_LEVEL && user.level != Authentication.AUTH_TABLET_LEVEL) {
                nobodyAtHome = false;
            }
        });

        return nobodyAtHome;
    }

    /**
    * Check if a user is at home
    *
    * @returns {boolean} True if somebody is at home, false otherwise
    */
    somebodyAtHome() {
        let somebodyAtHome = false;
        this.formConfiguration.getDataCopy().forEach((user) => {
            if (user.atHome && user.level >= Authentication.AUTH_USAGE_LEVEL && user.level != Authentication.AUTH_TABLET_LEVEL) {
                somebodyAtHome = true;
            }
        });

        return somebodyAtHome;
    }

    /**
    * Set user zone
    *
    * @param {string} username The username
    * @param {boolean} inZone True if user is in zone, false otherwise
    */
    setUserZone(username, inZone) {
        const self = this;
        let u = null;
        this.formConfiguration.getDataCopy().forEach((user) => {
            if (user.username === username) {
                u = user;
            }
        });

        if (u) {
            if (u.level >= Authentication.AUTH_USAGE_LEVEL && u.level != Authentication.AUTH_TABLET_LEVEL) {
                if (u.atHome !== inZone) {
                    u.atHome = inZone;
                    this.formConfiguration.saveConfig(u);
                    Object.keys(this.registeredHomeNotifications).forEach((registeredHomeNotificationsKey) => {
                        this.registeredHomeNotifications[registeredHomeNotificationsKey](u);
                    });

                    // Trigger scenarios
                    this.scenarioManager.getScenarios().forEach((scenario) => {
                        if (scenario.UserScenarioForm && scenario.UserScenarioForm.mode) {
                            switch(scenario.UserScenarioForm.mode) {
                            case 0:
                                break;
                            case 1:
                                if (self.allUsersAtHome()) {
                                    self.scenarioManager.triggerScenario(scenario, false, {username: username, inZone: inZone, allUsersAtHome: true});
                                }
                                break;
                            case 2:
                                if (self.nobodyAtHome()) {
                                    self.scenarioManager.triggerScenario(scenario, false, {username: username, inZone: inZone, nobodyAtHome: true});
                                }
                                break;
                            case 3:
                                if (self.somebodyAtHome()) {
                                    self.scenarioManager.triggerScenario(scenario, false, {username: username, inZone: inZone, somebodyAtHome: true});
                                }
                                break;
                            }
                        }
                    });
                } else {
                    Logger.info("User " + username + " home status does not changed");
                }
            }
        } else {
            Logger.warn("Could not change user zone. Unknown user " + username);
        }

        this.updateTile();
    }

    /**
    * Register for user's home notifications, ie when a user leaves / enter home
    *
    * @param  {Function} cb A callback `(user) => {}`
    */
    registerHomeNotifications(cb) {
        const key = sha256(cb.toString());
        this.registeredHomeNotifications[key] = cb;
    }

    /**
    * Unregister for user's home notifications, ie when a user leaves / enter home
    *
    * @param  {Function} cb A callback `(user) => {}`
    */
    unregisterHomeNotifications(cb) {
        const key = sha256(cb.toString());
        delete this.registeredHomeNotifications[key];
    }

    /**
    * Process API callback
    *
    * @param  {APIRequest} apiRequest An APIRequest
    * @returns {Promise}  A promise with an APIResponse object
    */
    processAPI(apiRequest) {
        var self = this;

        if (apiRequest.route.startsWith(ROUTE_USER_ZONE)) {
            return new Promise((resolve) => {
                self.setUserZone(apiRequest.authenticationData.username, Boolean(parseInt(apiRequest.data.status)));
                resolve(new APIResponse.class(true, {success:true}));
            });
        } else if (apiRequest.route.startsWith(ROUTE_USER_LOCATION)) {
            return new Promise((resolve) => {
                self.setUserZone(apiRequest.authenticationData.username, GeoUtils.class.isInZone(this.appConfiguration.home.longitude, this.appConfiguration.home.latitude, this.appConfiguration.home.radius, parseFloat(apiRequest.data.longitude), parseFloat(apiRequest.data.latitude)));
                resolve(new APIResponse.class(true, {success:true}));
            });
        } else if (apiRequest.route.startsWith(ROUTE_USER_SETTINGS)) {
            return new Promise((resolve) => {
                const settings = {
                    home: this.environmentManager.getCoordinates(),
                    tilesExcluded:[]
                };
                resolve(new APIResponse.class(true, settings));
            });
        }
    }

    /**
     * Register bot actions
     *
     * @param  {BotEngine} botEngine The bot engine
     */
    registerBotActions(botEngine) {
        this.botEngine = botEngine;
        const self = this;
        if (this.botEngine) {
            this.botEngine.registerBotAction("whoisathome", (action, value, type, confidence, sender, cb) => {
                let maxConfidence = 0;
                let detectedUser = null;
                const usersAtHome = [];
                self.formConfiguration.getDataCopy().forEach((user) => {
                    const stringConfidence = this.botEngine.stringSimilarity().compareTwoStrings(user.name, value);
                    Logger.info("Confidence " + value + " | " + user.name + ": " + stringConfidence);
                    if (stringConfidence >= USER_COMPARE_CONFIDENCE && stringConfidence > maxConfidence) {
                        detectedUser = user;
                        maxConfidence = stringConfidence;
                    }
                    if (user.atHome) {
                        usersAtHome.push(user.name);
                    }
                });

                if (detectedUser) {
                    Logger.info("Match found ! : " + detectedUser.name);
                    if (detectedUser.atHome) {
                        cb(this.translateManager.t("user.bot.at.home", detectedUser.name));
                    } else {
                        cb(this.translateManager.t("user.bot.not.at.home", detectedUser.name));
                    }
                } else if (self.nobodyAtHome()){
                    cb(this.translateManager.t("user.bot.nobody.at.home"));
                } else {
                    if (usersAtHome.length === 1) {
                        cb(this.translateManager.t("user.bot.who.single.at.home", usersAtHome.concat()));
                    } else {
                        cb(this.translateManager.t("user.bot.who.at.home", usersAtHome.concat()));
                    }
                }
            });
        }
    }
}

module.exports = {class:UserManager, ERROR_USER_NOT_FOUND:ERROR_USER_NOT_FOUND};
