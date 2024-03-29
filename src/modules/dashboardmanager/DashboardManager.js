"use strict";
const Logger = require("./../../logger/Logger");
const BreakException = require("./../../utils/BreakException").BreakException;
const Tile = require("./Tile");
const WebServices = require("./../../services/webservices/WebServices");
const Authentication = require("./../authentication/Authentication");
const APIResponse = require("./../../services/webservices/APIResponse");
const DateUtils = require("./../../utils/DateUtils");
const DashboardScenarioTrigger = require("./DashboardScenarioTrigger");

const BASE_ROUTE = ":/dashboard/get/";
const ROUTE = BASE_ROUTE + "[timestamp*]/[all*]/[light*]/";
const BASE_ROUTE_CUSTOMIZE = ":/dashboard/preferences/set/";
const SCENARIO_BASE_ROUTE = ":/scenario/dashboard/trigger/set/";
const SCENARIO_ROUTE = SCENARIO_BASE_ROUTE + "[scenarioId]/";
const CONF_KEY = "dashboard-preferences";

/**
 * This class generates dashboard from tiles
 *
 * @class
 */
class DashboardManager {
    /**
     * Constructor
     *
     * @param  {ThemeManager} themeManager     A theme manager
     * @param  {WebServices} webServices      Web services instance
     * @param  {TranslateManager} translateManager A translate manager
     * @param  {ConfManager} confManager A configuration manager
     * @param  {ScenarioManager} scenarioManager A scenario manager
     * @returns {DashboardManager}                  The instance
     */
    constructor(themeManager, webServices, translateManager, confManager, scenarioManager) {
        this.themeManager = themeManager;
        this.webServices = webServices;
        this.translateManager = translateManager;
        this.confManager = confManager;
        this.scenarioManager = scenarioManager;
        this.userManager = null;
        this.webServices.registerAPI(this, WebServices.GET, ROUTE, Authentication.AUTH_GUEST_LEVEL);
        this.webServices.registerAPI(this, WebServices.POST, BASE_ROUTE_CUSTOMIZE, Authentication.AUTH_GUEST_LEVEL);
        this.webServices.registerAPI(this, WebServices.POST, SCENARIO_ROUTE, Authentication.AUTH_GUEST_LEVEL);

        try {
            this.dashboardPreferences = this.confManager.loadData(Object, CONF_KEY, true);
        } catch(e) {
            this.dashboardPreferences = {};
        }

        this.lastGenerated = DateUtils.class.timestamp();

        this.tiles = [];
        this.unregistered = [];

        // Scenario
        this.scenarioManager.register(DashboardScenarioTrigger.class, null, "dashboard.scenario.trigger.form.title", 200);
        this.scenarioManager.registerForScenarioChanges(() => {
            this.generateScenarioTiles();
        });
        this.generateScenarioTiles();
    }

    /**
     * Set the user manager
     *
     * @param  {UserManager} userManager Set the user DbManager
     */
    setUserManager(userManager) {
        this.userManager = userManager;
    }

    /**
     * Get readable tiles object (without methods, simple POJO)
     *
     * @param  {string} [username=null] A username, for tile customization
     * @param  {boolean} light `true` if no images in stream, `false` otherwise
     * @returns {[Object]} The readable tiles
     */
    getReadableTiles(username = null, light) {
        const tiles = [];
        let user = null;
        if (this.userManager != null) {
            user = this.userManager.getUser(username);
        }

        this.tiles.forEach((tile) => {
            if (!user || user && user.level >= tile.authentication) {
                tile.customize(username); // Customize tile colors depending on theme
                tile.applyMode(username, light);

                let shouldDisplay = true;
                // In case of TABLET, alarm tile should not be displayed
                if (tile.identifier == "alarm" && user && user.level && user.level == Authentication.AUTH_TABLET_LEVEL) {
                    shouldDisplay = false;
                }

                if (shouldDisplay) {
                    tiles.push(tile.get());
                }
            }
        });

        return tiles;
    }

    /**
     * Returns a tile for a specific identifier
     *
     * @param  {string} identifier The tile identifier
     * @returns {Tile}            A tile or `null` if no tile found
     */
    getTile(identifier) {
        let foundTile = null;
        try {
            this.tiles.forEach((tile) => {
                if (tile.identifier === identifier) {
                    foundTile = tile;
                    throw BreakException;
                }
            });
        } catch (e) {
            if (e !== BreakException) throw e;
        }

        return foundTile;
    }

    /**
     * Register a tile locally, replace if exists and order array
     *
     * @param  {Tile} tile A tile object
     */
    registerTile(tile) {
        const existingTile = this.getTile(tile.identifier);
        let shouldRegister = true;

        if (existingTile && (existingTile.hash() === tile.hash())) {
            shouldRegister = false;
        }

        if (shouldRegister) {
            this.unregisterTile(tile.identifier);
            tile.lastGenerated = DateUtils.class.timestamp();
            // Add tile
            this.tiles.push(tile);

            // Sort
            this.tiles.sort((tile1, tile2) => {
                return tile1.order - tile2.order;
            });

            if (this.unregistered.indexOf(tile.identifier) >= 0) {
                this.unregistered.splice(this.unregistered.indexOf(tile.identifier), 1);
            }

            Logger.verbose("Tile " + tile.identifier + " registered");

            // Save generation date
            this.lastGenerated = DateUtils.class.timestamp();
        } else {
            Logger.verbose("The tile " + tile.identifier + " can not be registered. The hash is strictly equal to existing one");
        }
    }

    /**
     * Remove a tile with identifier
     *
     * @param  {string} identifier A tile identifier
     */
    unregisterTile(identifier) {
        const indexes = [];
        if (identifier instanceof Tile.class) { // In case of registered Tile object
            identifier = identifier.identifier;
        }

        // Collect registered indexes
        for (let i = 0 ; i < this.tiles.length ; i++) {
            if (this.tiles[i].identifier === identifier) {
                indexes.push(i);
            }
        }

        // Remove existing tiles
        indexes.forEach((index) => {
            this.tiles.splice(index, 1);
        });

        if (this.unregistered.indexOf(identifier) == -1) {
            this.unregistered.push(identifier);
        }

        // Save generation date
        this.lastGenerated = DateUtils.class.timestamp();
    }

    /**
     * Remove tiles depending on user preferences
     *
     * @param  {Array} tiles The tiles
     * @param  {string} username Username
     * @param  {number} [timestamp=0] The last refresh timestamp
     * @returns {Array}          Tiles
     */
    filterTiles(tiles, username = null, timestamp = 0) {
        if (this.dashboardPreferences[username] && this.dashboardPreferences[username].excludeTiles) {
            const includeTiles = [];
            tiles.forEach((tile) => {
                if (this.dashboardPreferences[username].excludeTiles.indexOf(tile.identifier) === -1 && tile.lastGenerated > timestamp) {
                    includeTiles.push(tile);
                }
            });

            return includeTiles;
        } else {
            return tiles;
        }
    }

    /**
     * Build a dashboard object
     *
     * @param  {string} username Username
     * @param  {boolean} allTiles `true` if should return all tiles, `false` otherwise
     * @param  {boolean} light `true` if no images in stream, `false` otherwise
     * @param  {number} [timestamp=0] The last refresh timestamp
     * @returns {object} A dashboard object
     */
    buildDashboard(username, allTiles = true, light = false, timestamp = 0) {
        const tiles = this.getReadableTiles(username, light).sort(function(a, b) {
            if (parseFloat(a.order) > parseFloat(b.order)) {
                return 1;
            } else if (parseFloat(a.order) < parseFloat(b.order)) {
                return -1;
            }

            // Fix #67 - Sort on tiles and other stiff works strangely
            if (a.identifier < b.identifier) {
                return -1;
            } else if (a.identifier > b.identifier) {
                return 1;
            } else {
                return 0;
            }
        });

        let allTilesGenerated = true;
        tiles.forEach((tile) => {
            if (timestamp > tile.lastGenerated) {
                allTilesGenerated = false;
            }
        });

        const realTiles = this.filterTiles(tiles, allTiles?null:username, timestamp);

        let excludedTiles = this.unregistered;
        if (this.dashboardPreferences[username] && this.dashboardPreferences[username].excludeTiles) {
            excludedTiles = excludedTiles.concat(this.dashboardPreferences[username].excludeTiles);
        }


        excludedTiles = excludedTiles.filter((elem, pos) => { // Remove duplicates
            return excludedTiles.indexOf(elem) == pos;
        });

        return {
            timestamp:this.lastGenerated,
            allTilesGenerated: allTilesGenerated,
            timestampFormatted: DateUtils.class.dateFormatted(this.translateManager.t("datetime.format"), this.lastGenerated),
            excludeTiles: excludedTiles,
            tiles: realTiles
        };
    }

    /**
     * Process API callback
     *
     * @param  {APIRequest} apiRequest An APIRequest
     * @returns {Promise}  A promise with an APIResponse object
     */
    processAPI(apiRequest) {
        const self = this;
        if (apiRequest.route.startsWith(BASE_ROUTE)) {
            return new Promise((resolve) => {
                if (apiRequest.data.timestamp) {
                    if (parseInt(apiRequest.data.timestamp) >= parseInt(this.lastGenerated)) {
                        // Up to date !
                        resolve(new APIResponse.class(true, {}, null, null, true));
                    } else {
                        resolve(new APIResponse.class(true, self.buildDashboard(apiRequest.authenticationData.username, apiRequest.data.all?(apiRequest.data.all == "1"?true:false):false, apiRequest.data.light?(apiRequest.data.light == "1"?true:false):false, apiRequest.data.timestamp)));
                    }
                } else {
                    resolve(new APIResponse.class(true, self.buildDashboard(apiRequest.authenticationData.username, apiRequest.data.all?(apiRequest.data.all == "1"?true:false):false, apiRequest.data.light?(apiRequest.data.light == "1"?true:false):false, apiRequest.data.timestamp)));
                }
            });
        } else if (apiRequest.route === BASE_ROUTE_CUSTOMIZE) {
            return new Promise((resolve) => {
                if (apiRequest.data.excludeTiles) {
                    // Remove duplicates
                    let excludedTiles = apiRequest.data.excludeTiles;
                    excludedTiles = excludedTiles.filter((elem, pos) => { // Remove duplicates
                        return excludedTiles.indexOf(elem) == pos;
                    });
                    self.dashboardPreferences[apiRequest.authenticationData.username] = {excludeTiles: excludedTiles};

                    self.confManager.saveData(this.dashboardPreferences, CONF_KEY);
                    self.lastGenerated = DateUtils.class.timestamp();
                    resolve(new APIResponse.class(true, {success:true}));
                } else {
                    resolve(new APIResponse.class(false, {success:true}));
                }

            });
        } else if (apiRequest.route.startsWith(SCENARIO_BASE_ROUTE)) {
            return new Promise((resolve) => {
                self.scenarioManager.getScenarios().forEach((scenario) => {
                    if (parseInt(scenario.id) === parseInt(apiRequest.data.scenarioId)) {
                        self.scenarioManager.triggerScenario(scenario, false, {username: apiRequest.authenticationData.username});
                    }
                });
                resolve(new APIResponse.class(true, {success:true}));
            });
        }

    }

    /**
     * Generate tiles created from scenario
     */
    generateScenarioTiles() {
        this.scenarioManager.getScenarios().forEach((scenario) => {
            if (scenario && scenario.DashboardScenarioTriggerForm && scenario.DashboardScenarioTriggerForm.status) {
                if (scenario.DashboardScenarioTriggerForm.status === "on") {
                    const tile = new Tile.class(this.themeManager, "scenario-" + scenario.id, Tile.TILE_GENERIC_ACTION, scenario.DashboardScenarioTriggerForm.icon.icon, null, scenario.DashboardScenarioTriggerForm.title, null, null, null, null, 10000, SCENARIO_BASE_ROUTE.replace(":", "") + scenario.id + "/");
                    this.registerTile(tile);
                } else {
                    this.unregisterTile("scenario-" + scenario.id);
                }
            }
        });
    }
}

module.exports = {class:DashboardManager};
