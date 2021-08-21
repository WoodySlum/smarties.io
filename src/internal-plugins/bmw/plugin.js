"use strict";

const request = require("request");
const fs = require("fs-extra");
const sha256 = require("sha256");
const ConnectedDrive  = require("bmw-connected-drive").ConnectedDrive;
const Regions  = require("bmw-connected-drive").Regions;
const BMW_REGISTER_KEY = "bmw-action";

/**
 * Loaded function
 *
 * @param  {PluginAPI} api The api
 */
function loaded(api) {
    api.init();

    /**
    * This class is used for bmw form
     *
    * @class
    */
    class BmwForm extends api.exported.FormObject.class {
        /**
         * Constructor
         *
         * @param  {number} id           Identifier
         * @param  {string} zone       The zone
         * @param  {string} username       The username
         * @param  {string} password       The password
         * @param  {Array} options       The options
         * @returns {BmwForm}              The instance
         */
        constructor(id, zone, username, password, options) {
            super(id);

            /**
             * @Property("zone");
             * @Type("string");
             * @Title("bmw.zone");
             * @Enum(["eu", "us", "cn"]);
             * @EnumNames(["eu", "us", "cn"]);
             * @Default("eu");
             */
            this.zone = zone;

            /**
             * @Property("username");
             * @Type("string");
             * @Title("bmw.username");
             */
            this.username = username;

            /**
             * @Property("password");
             * @Type("string");
             * @Display("password");
             * @Title("bmw.password");
             */
            this.password = password;

            /**
             * @Property("trigger");
             * @Type("string");
             * @Title("bmw.options");
             * @Display("checkbox");
             * @Enum(["alertOnCharge"]);
             * @EnumNames(["bmw.alertOnCharge"]);
             */
            this.options = options;
        }

        /**
         * Convert json data
         *
         * @param  {object} data Some key / value data
         * @returns {BmwForm}      A form object
         */
        json(data) {
            return new BmwForm(data.id, data.zone, data.username, data.password, data.options);
        }
    }

    api.configurationAPI.register(BmwForm);

    /**
     * This class manage bmw cars
     *
     * @class
     */
    class Bmw {
        /**
         * Constructor
         *
         * @param  {PluginAPI} api The api
         * @returns {Bmw}     The instance
         */
        constructor(api) {
            this.api = api;
            this.updateCarInfos();
            this.previousChargingStatus = {};
            this.carPictures = {};
            this.carLocations = {};
            this.registeredElements = {};

            this.api.configurationAPI.setUpdateCb(() => {
                this.updateCarInfos();
            });


            this.api.timeEventAPI.register((self, hour, minute) => {
                if (minute % 5 == 0) {
                    self.updateCarInfos();
                }
            }, this, this.api.timeEventAPI.constants().EVERY_MINUTES);
        }

        /**
         * Register for car infos
         *
         * @param  {Function} cb            A callback triggered when weather information is received. Example : `(d) => {}`
         * @param  {string} id            An identifier
         */
        register(cb, id = null) {
            const index = sha256(cb.toString() + id);
            this.registeredElements[index] = cb;
        }

        /**
         * Unregister car infos
         *
         * @param  {Function} cb             A callback triggered when weather information is received. Example : `(d) => {}`
         * @param  {string} id            An identifier
         */
        unregister(cb, id = null) {
            const index = sha256(cb.toString() + id);
            if (this.registeredElements[index]) {
                delete this.registeredElements[index];
            } else {
                api.exported.Logger.warn("Element not found");
            }
        }

        /**
         * Update car picture
         *
         * @param  {Vehicle} vehicle           The vehicle
         */
        updateCarPicture(vehicle) {
            vehicle.getImage(800, 800).then((pic) => {
                if (pic) {
                    api.exported.ImageUtils.class.crop(pic.split(",")[1], 250, 200, 250, 250, (err, picture) => {
                        this.carPictures[vehicle.originalData.vin] = picture;
                        this.previousChargingStatus[vehicle.originalData.vin] = "";
                        this.updateCarInfos();
                    });
                }
            }).catch((e) => {
                api.exported.Logger.err(e.message);
            });
        }

        /**
         * Update car infos
         */
        updateCarInfos() {
            const configuration = api.configurationAPI.getConfiguration();

            if (configuration && configuration.zone && configuration.username && configuration.password) {
                let r = Regions.RestOfWorld;
                if (configuration.zone == "us")  {
                    r = Regions.NorthAmerica;
                } else if (configuration.zone == "cn") {
                    r = Regions.China;
                }
                const bmwApi = new ConnectedDrive(configuration.username, configuration.password, r);
                bmwApi.getVehicles()
                    .then((vehicles) => {
                        vehicles.forEach((vehicle) => {
                            
                            bmwApi.getVehicleStatus(vehicle.vin)
                                .then((status) => {
                                    status.originalData = vehicle;
                                    // Total
                                    const miniTiles = [];
                                    Object.keys(this.registeredElements).forEach((registeredKey) => {
                                        this.registeredElements[registeredKey](status);
                                    });

                                    if ((!this.carLocations[status.originalData.vin] || this.carLocations[status.originalData.vin].gpsLng != status.gpsLng || this.carLocations[status.originalData.vin].gpsLat != status.gpsLat)) {
                                        this.carLocations[status.originalData.vin] = {gpsLng: status.gpsLng, gpsLat: status.gpsLat};
                                        const userAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.106 Safari/537.36";
                                        const reverseGeocodingUrl = "https://nominatim.openstreetmap.org/reverse?lat=" + status.gpsLat + "&lon=" + status.gpsLng + "&format=json";
                                        request({url: reverseGeocodingUrl, headers: { "User-Agent": userAgent}}, (error, response, body) => {
                                            let metaData = null;
                                            if (!error && response.statusCode == 200) {
                                                metaData = JSON.parse(body);
                                            } else {
                                                api.exported.Logger.err(body);
                                            }

                                            const long2tile = (lon, zoom) => { return (Math.floor((lon + 180)/ 360 * Math.pow(2, zoom))); };
                                            const lat2tile = (lat, zoom) => { return (Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom))); };
                                            const zoom = 19;
                                            // const url = "http://c.tile.openstreetmap.fr/osmfr/" + zoom + "/" + long2tile(status.position.lon, zoom) + "/" + lat2tile(status.position.lat, zoom) + ".png";
                                            const url = "http://mt1.google.com/vt/lyrs=y&x=" + long2tile(status.gpsLng, zoom) + "&y=" + lat2tile(status.gpsLat, zoom) + "&z=" + zoom;

                                            request({url: url, encoding: "binary", headers: { "User-Agent": userAgent}}, (error, response, body) => {
                                                if (!error && response.statusCode == 200) {
                                                    const tile = Buffer.alloc(body.length, body, "binary").toString("base64");
                                                    const car = fs.readFileSync("./res/pictures/car.png").toString("base64");

                                                    api.exported.ImageUtils.class.rotate(car, (err, data) => {
                                                        if (!err && data) {
                                                            api.exported.ImageUtils.class.merge(tile, (err, data) => {
                                                                if (!err && data) {
                                                                    const tileId = status.originalData.vin + "-pic";
                                                                    const tile = api.dashboardAPI.Tile(tileId, api.dashboardAPI.TileType().TILE_GENERIC_ACTION_DARK, " ", null, (metaData && metaData.address && metaData.address.town) ? metaData.address.town : null, null, data, null, 0, 110, null, miniTiles, api.webAPI.Authentication().AUTH_USAGE_LEVEL);
                                                                    api.dashboardAPI.registerTile(tile);
                                                                } else {
                                                                    api.exported.Logger.err(err);
                                                                }

                                                            }, data, api.exported.cachePath, 116, 110);
                                                        } else {
                                                            api.exported.Logger.err(err);
                                                        }

                                                    }, status.heading);

                                                } else {
                                                    api.exported.Logger.err(body);
                                                }
                                            });
                                        });
                                    }


                                    // Credits : Freepik / https://www.flaticon.com/free-icon/bmw_805952
                                    const bmwSigle = "<svg version=\"1.1\" id=\"Capa_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"	 viewBox=\"0 0 512 512\" style=\"enable-background:new 0 0 512 512;\" xml:space=\"preserve\"><g>	<g>		<path d=\"M265.987,24.24c-3.716,0-7.156,1.178-9.987,3.168c-2.831-1.99-6.272-3.168-9.988-3.168			c-9.609,0-17.426,7.817-17.426,17.426v33.616c0,4.142,3.358,7.5,7.5,7.5c4.142,0,7.5-3.358,7.5-7.5V41.667			c0-1.338,1.089-2.426,2.427-2.426s2.426,1.088,2.426,2.426v33.616c0,4.142,3.358,7.5,7.5,7.5c0.021,0,0.041-0.003,0.061-0.003			c0.021,0,0.04,0.003,0.061,0.003c4.142,0,7.5-3.358,7.5-7.5V41.667c0-1.338,1.088-2.426,2.426-2.426			c1.338,0,2.427,1.088,2.427,2.426v33.616c0,4.142,3.357,7.5,7.5,7.5s7.5-3.358,7.5-7.5V41.667			C283.414,32.058,275.597,24.24,265.987,24.24z\"/>	</g></g><g>	<g>		<path d=\"M181.23,75.719c-1.933-3.386-4.842-5.986-8.333-7.549c0.412-3.691-0.278-7.536-2.256-11			c-4.969-8.706-16.095-11.746-24.8-6.777L126.98,61.159c-3.598,2.053-4.849,6.634-2.796,10.231l10.588,18.55l10.588,18.55			c1.384,2.425,3.916,3.784,6.521,3.784c1.26,0,2.538-0.318,3.711-0.988l18.861-10.766C183.159,95.551,186.199,84.425,181.23,75.719			z M144.08,75.99l-3.152-5.522l12.348-7.048c1.522-0.87,3.468-0.338,4.337,1.185c0.869,1.522,0.337,3.468-1.185,4.337L144.08,75.99			z M167.017,87.493l-12.348,7.048l-3.153-5.523l6.703-3.826l5.646-3.222c0.994-0.568,1.939-0.436,2.414-0.306			c0.475,0.129,1.355,0.496,1.923,1.491C169.071,84.678,168.54,86.624,167.017,87.493z\"/>	</g></g><g>	<g>		<path d=\"M385.396,62.052c-3.599-2.052-8.179-0.8-10.231,2.798l-16.657,29.2c-0.434,0.759-1.104,1.039-1.467,1.138			c-0.363,0.099-1.082,0.2-1.843-0.233c-0.759-0.433-1.038-1.105-1.138-1.467c-0.099-0.362-0.2-1.083,0.233-1.842l16.656-29.199			c2.053-3.598,0.8-8.179-2.799-10.231c-0.015-0.009-0.031-0.015-0.047-0.024c-0.02-0.012-0.038-0.025-0.058-0.037			c-3.598-2.053-8.179-0.8-10.231,2.798l-16.657,29.198c-0.663,1.163-2.148,1.57-3.31,0.906c-1.162-0.663-1.568-2.148-0.905-3.311			l16.657-29.198c2.053-3.598,0.8-8.178-2.798-10.231c-3.599-2.052-8.179-0.799-10.231,2.798l-16.657,29.198			c-4.761,8.346-1.845,19.01,6.502,23.772c2.717,1.55,5.68,2.286,8.605,2.286c0.547,0,1.091-0.035,1.633-0.086			c1.513,3.219,3.958,5.899,7.111,7.697c2.667,1.521,5.619,2.298,8.608,2.298c1.543,0,3.096-0.207,4.624-0.625			c4.49-1.228,8.233-4.131,10.539-8.174l16.657-29.199C390.247,68.686,388.994,64.105,385.396,62.052z\"/>	</g></g><g>	<g>		<path d=\"M437.02,74.98C388.668,26.629,324.38,0,256,0C193.958,0,134.107,22.478,87.473,63.292			c-3.117,2.728-3.432,7.466-0.704,10.583c2.729,3.118,7.467,3.432,10.583,0.704C141.251,36.159,197.593,15,256,15			c132.888,0,241,108.112,241,241S388.888,497,256,497S15,388.888,15,256c0-56.646,20.041-111.685,56.43-154.976			c2.665-3.17,2.255-7.902-0.916-10.567c-3.171-2.665-7.902-2.256-10.567,0.916C21.29,137.363,0,195.829,0,256			c0,68.38,26.629,132.667,74.98,181.02C123.333,485.371,187.62,512,256,512s132.668-26.629,181.02-74.98			C485.371,388.667,512,324.38,512,256S485.371,123.333,437.02,74.98z\"/>	</g></g><g>	<g>		<path d=\"M256,90.5c-91.257,0-165.5,74.243-165.5,165.5S164.743,421.5,256,421.5S421.5,347.257,421.5,256S347.257,90.5,256,90.5z			 M248.5,105.687V248.5H105.687C109.486,171.47,171.47,109.486,248.5,105.687z M263.5,406.313v-22.479c0-4.142-3.357-7.5-7.5-7.5			c-4.142,0-7.5,3.358-7.5,7.5v22.479c-77.03-3.799-139.014-65.783-142.813-142.813H248.5v88.167c0,4.142,3.358,7.5,7.5,7.5			c4.143,0,7.5-3.358,7.5-7.5V263.5H288c4.143,0,7.5-3.358,7.5-7.5c0-4.142-3.357-7.5-7.5-7.5h-24.5V105.687			c77.031,3.799,139.014,65.783,142.813,142.813H320.5c-4.143,0-7.5,3.358-7.5,7.5c0,4.142,3.357,7.5,7.5,7.5h85.813			C402.514,340.53,340.531,402.514,263.5,406.313z\"/>	</g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g></svg>";
                                    const carRepair =  api.exported.Icons.class.list()["wrench"];
                                    // Credits : yut1655 / https://www.flaticon.com/premium-icon/oil-gauge_2902370
                                    const carFuel = "<svg id=\"Tempate\" height=\"512\" viewBox=\"0 0 900 900\" width=\"512\" xmlns=\"http://www.w3.org/2000/svg\"><g id=\"_36-Fuel_gauge\" data-name=\"36-Fuel gauge\"><path d=\"m731.8 473.5a15.58 15.58 0 0 0 8-2.2l100.6-58.2a16.46 16.46 0 0 0 7.5-9.8 16 16 0 0 0 -1.6-12.1 460.06 460.06 0 0 0 -796.8.1 16 16 0 0 0 5.9 21.9l96.2 55.7a15.58 15.58 0 0 0 8 2.2 16 16 0 0 0 8.1-29.9l-82.2-47.6a427.49 427.49 0 0 1 134.6-134.4l27.9 48.5a16.07 16.07 0 0 0 13.9 8 16.49 16.49 0 0 0 8-2.1 16 16 0 0 0 5.9-21.9l-28-48.6a428.49 428.49 0 0 1 183.9-49.6v88.7a16 16 0 0 0 32 0v-88.7a426.93 426.93 0 0 1 184 49.4l-28.1 48.7a16 16 0 0 0 5.9 21.9 16.49 16.49 0 0 0 8 2.1 16.19 16.19 0 0 0 13.9-8l28-48.7a427.4 427.4 0 0 1 134.8 134.5l-86.5 50a16 16 0 0 0 -5.8 21.9 15.76 15.76 0 0 0 13.9 8.2z\"/><path d=\"m535.3 621.9-72.5-284a16 16 0 0 0 -15.5-12 16 16 0 0 0 -15.5 12.1l-71.7 285.3c0 .2-.1.4-.1.6a92.78 92.78 0 0 0 -3.1 23.7 91.1 91.1 0 1 0 182.2 0 94.48 94.48 0 0 0 -3.8-25.7zm-87.9-214.9 40.5 158.7a91.17 91.17 0 0 0 -40-9.3 90 90 0 0 0 -40.4 9.5zm.5 299.6a59.1 59.1 0 1 1 59.1-59.1 59.15 59.15 0 0 1 -59.1 59.1z\"/><path d=\"m163.6 578.1a16 16 0 1 0 0-32h-100.2a16 16 0 0 0 -16 16v160.5a16 16 0 0 0 16 16h100.2a16 16 0 1 0 0-32h-84.2v-48h84.2a16 16 0 1 0 0-32h-84.2v-48.4h84.2z\"/><path d=\"m837.2 546.1h-100.6a16 16 0 0 0 -16 16v160.5a16 16 0 0 0 32 0v-64h64.4a16 16 0 0 0 0-32h-64.4v-48.4h84.6a16.05 16.05 0 0 0 0-32.1z\"/></g></svg>";
                                    miniTiles.push({icon: bmwSigle, text: status.originalData.model.split(" ")[0], colorDefault: api.themeAPI.constants().DARK_COLOR_KEY});

                                    if (status.beRemainingRangeFuel != null && status.beRemainingRangeFuel != "undefined") {
                                        miniTiles.push({icon: carFuel, text: status.beRemainingRangeFuel + (status.beRemainingRangeElectricKm ? status.beRemainingRangeElectricKm : 0) + " km", colorDefault: api.themeAPI.constants().DARK_COLOR_KEY});
                                    }
                                    

                                    if (status.chargingLevelHv != null && status.chargingLevelHv != "undefined") {
                                        let icon = api.exported.Icons.class.list()["battery-2"];
                                        if (status.chargingStatus == "CHARGING") {
                                            icon = api.exported.Icons.class.list()["battery-charging"];
                                        } else if (status.chargingLevelHv < 25) {
                                            icon = api.exported.Icons.class.list()["battery-0"];
                                        } else if (status.chargingLevelHv < 50) {
                                            icon = api.exported.Icons.class.list()["battery-1"];
                                        } else if (status.chargingLevelHv < 75) {
                                            icon = api.exported.Icons.class.list()["battery-2"];
                                        } else if (status.chargingLevelHv < 95) {
                                            icon = api.exported.Icons.class.list()["battery-3"];
                                        } else {
                                            icon = api.exported.Icons.class.list()["battery-4"];
                                        }

                                        miniTiles.push({icon: icon, text: status.chargingLevelHv + "%" + (status.remainingRangeElectric ? " [" + status.remainingRangeElectric + "]" : ""), colorDefault: api.themeAPI.constants().DARK_COLOR_KEY});

                                        // Send notifications
                                        if (this.previousChargingStatus[status.originalData.vin] == "CHARGING" && status.chargingStatus != "CHARGING" && configuration && configuration.options && configuration.options.trigger.indexOf("alertOnCharge") != -1) {
                                            api.messageAPI.sendMessage("*", api.translateAPI.t("bmw.charged.message", status.model));
                                        }

                                        this.previousChargingStatus[status.originalData.vin] = status.chargingStatus;
                                    }

                                    // Closed status
                                    if (status.doorLockState == "UNLOCKED" || status.doorDriverFront != "CLOSED" || status.doorDriverRear != "CLOSED" || status.doorPassengerFront != "CLOSED" || status.doorPassengerRear != "CLOSED" || status.hoodState != "CLOSED" || status.windowDriverFront != "CLOSED" || status.windowDriverRear != "CLOSED" || status.windowPassengerFront != "CLOSED" || status.windowPassengerRear != "CLOSED") {
                                        miniTiles.push({icon: api.exported.Icons.class.list()["unlocked"], text: api.translateAPI.t("bmw.unlocked"), colorDefault: api.themeAPI.constants().OFF_COLOR_KEY});
                                    } else {
                                        miniTiles.push({icon: api.exported.Icons.class.list()["locked"], text: api.translateAPI.t("bmw.locked"), colorDefault: api.themeAPI.constants().DARK_COLOR_KEY});
                                    }

                                    // Health
                                    if (status.conditionBasedServices) {
                                        let health = true;
                                        if (status.conditionBasedServices.indexOf("KO") >= 0) {
                                            health = false;
                                        }
                                        miniTiles.push({icon: carRepair, text: (health ? api.translateAPI.t("bmw.health.ok") : api.translateAPI.t("bmw.health.ko")), colorDefault: (health ? api.themeAPI.constants().DARK_COLOR_KEY : api.themeAPI.constants().OFF_COLOR_KEY)});
                                    }

                                    miniTiles.push({icon: api.exported.Icons.class.list()["road"], text: status.mileage + " km", colorDefault: api.themeAPI.constants().DARK_COLOR_KEY});

                                    // Mini tiles
                                    const tileId = "bmw-"+status.originalData.vin;
                                    const startClimate = "<svg version= \"1.1 \" id= \"Capa_1 \" xmlns= \"http://www.w3.org/2000/svg \" xmlns:xlink= \"http://www.w3.org/1999/xlink \" x= \"0px \" y= \"0px \"  viewBox= \"0 0 512.003 512.003 \" style= \"enable-background:new 0 0 512.003 512.003; \" xml:space= \"preserve \"><g> <g>  <path d= \"M511.949,382.379c-0.611-18.329-6.417-35.725-16.79-50.307c-11.196-15.737-27.25-27.32-46.426-33.495l-51.345-16.535   c-5.256-1.692-10.891,1.196-12.584,6.453c-1.693,5.257,1.196,10.891,6.453,12.584l51.345,16.535   c35.162,11.323,48.551,41.224,49.357,65.431c0.807,24.208-10.563,54.933-44.894,68.571l-94.547,37.56   c-17.918,7.12-32.88-0.783-40.906-10.553c-8.025-9.77-12.872-25.979-2.409-42.176c21.522-33.314,23.432-75.822,4.984-110.934   L298.5,295.658c9.676-10.366,15.615-24.263,15.615-39.529c0-9.499-2.31-18.462-6.376-26.383l27.074-14.226   c28.73-15.096,63.516-13.534,90.778,4.079c20.795,13.433,46.594,11.961,65.724-3.754c19.13-15.714,25.585-40.735,16.445-63.744   L470.2,57.554c-7.438-18.723-20.063-33.97-36.511-44.094c-15.24-9.38-32.976-14.017-51.313-13.405   c-18.329,0.611-35.725,6.417-50.307,16.79c-15.737,11.196-27.32,27.25-33.495,46.426l-43.441,134.896   c-9.088,0.154-17.668,2.407-25.285,6.297l-14.331-27.274c-15.096-28.732-13.534-63.516,4.079-90.778   c13.434-20.795,11.96-46.593-3.754-65.724C200.129,1.555,175.108-4.9,152.1,4.24L57.552,41.8   c-18.723,7.438-33.97,20.063-44.094,36.511c-9.38,15.24-14.016,32.984-13.405,51.313c0.611,18.329,6.417,35.725,16.79,50.307   c11.196,15.737,27.25,27.32,46.426,33.495l66.612,21.451c1.019,0.328,2.052,0.484,3.068,0.484c4.225,0,8.151-2.7,9.516-6.938   c1.693-5.257-1.196-10.891-6.453-12.584L69.4,194.389c-35.162-11.323-48.551-41.224-49.357-65.431   c-0.807-24.207,10.563-54.933,44.894-68.571l94.547-37.56c17.92-7.117,32.881,0.784,40.906,10.553s12.872,25.979,2.409,42.176   c-21.522,33.314-23.432,75.822-4.984,110.934l15.863,30.191c-9.631,10.357-15.538,24.222-15.538,39.447   c0,9.377,2.251,18.232,6.219,26.078l-27.172,14.277c-28.73,15.096-63.516,13.534-90.778-4.079   c-20.795-13.434-46.594-11.96-65.724,3.754C1.555,311.873-4.9,336.894,4.24,359.903L41.8,454.45   c7.438,18.723,20.063,33.97,36.511,44.094c14.351,8.833,30.921,13.458,48.111,13.458c1.065,0,2.133-0.018,3.203-0.053   c18.329-0.611,35.725-6.417,50.307-16.79c15.737-11.196,27.32-27.25,33.495-46.426L256.783,314.1   c9.175-0.102,17.841-2.348,25.529-6.257l14.172,26.972c15.096,28.732,13.534,63.516-4.079,90.778   c-13.434,20.795-11.96,46.594,3.754,65.724c10.976,13.362,26.49,20.54,42.69,20.54c6.993,0,14.116-1.338,21.054-4.094   l94.547-37.56c18.723-7.438,33.97-20.063,44.094-36.511C507.924,418.453,512.56,400.708,511.949,382.379z M194.389,442.602   c-11.323,35.162-41.224,48.551-65.431,49.357c-24.207,0.8-54.933-10.563-68.571-44.894l-37.56-94.547   c-7.119-17.92,0.784-32.88,10.553-40.906c9.77-8.024,25.98-12.871,42.176-2.409c33.314,21.522,75.821,23.432,110.934,4.984   l30.019-15.773c5.792,5.43,12.691,9.686,20.324,12.388L194.389,442.602z M256.128,294.117c-20.947,0-37.988-17.042-37.988-37.988   c0-20.946,17.042-37.988,37.988-37.988c20.946,0,37.988,17.042,37.988,37.988C294.116,277.075,277.075,294.117,256.128,294.117z    M295.485,213.592c-5.814-5.383-12.728-9.585-20.364-12.241L317.613,69.4c11.323-35.162,41.224-48.551,65.431-49.357   c24.208-0.813,54.933,10.563,68.571,44.894l37.56,94.547c7.119,17.92-0.784,32.88-10.553,40.906   c-9.769,8.025-25.979,12.872-42.176,2.409c-33.314-21.523-75.821-23.432-110.934-4.984L295.485,213.592z \"/> </g></g><g> <g>  <path d= \"M352.022,268.591c-1.86-1.86-4.44-2.93-7.07-2.93s-5.21,1.07-7.07,2.93c-1.86,1.86-2.93,4.44-2.93,7.07   s1.07,5.21,2.93,7.07c1.86,1.86,4.44,2.93,7.07,2.93s5.21-1.07,7.07-2.93c1.86-1.86,2.93-4.44,2.93-7.07   S353.882,270.451,352.022,268.591z \"/> </g></g><g> <g>  <path d= \"M178.641,230.721c-1.87-1.86-4.44-2.93-7.07-2.93c-2.64,0-5.21,1.07-7.07,2.93c-1.87,1.86-2.93,4.44-2.93,7.07   c0,2.64,1.06,5.22,2.93,7.08c1.86,1.86,4.43,2.92,7.07,2.92c2.63,0,5.21-1.06,7.07-2.92c1.86-1.87,2.93-4.44,2.93-7.08   C181.571,235.161,180.501,232.591,178.641,230.721z \"/> </g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g></svg>";
                                    const stopClimate = "<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" version=\"1.1\" style=\"\" xml:space=\"preserve\" x= \"0px \" y= \"0px \"  viewBox= \"0 0 512.003 512.003 \"><rect id=\"backgroundrect\" width=\"100%\" height=\"100%\" x=\"0\" y=\"0\" fill=\"none\" stroke=\"none\"/><g class=\"currentLayer\" style=\"\"><g id=\"svg_1\"> <g id=\"svg_2\">  <path d=\"M511.949,382.379c-0.611-18.329-6.417-35.725-16.79-50.307c-11.196-15.737-27.25-27.32-46.426-33.495l-51.345-16.535    c-5.256-1.692-10.891,1.196-12.584,6.453c-1.693,5.257,1.196,10.891,6.453,12.584l51.345,16.535    c35.162,11.323,48.551,41.224,49.357,65.431c0.807,24.208-10.563,54.933-44.894,68.571l-94.547,37.56    c-17.918,7.12-32.88-0.783-40.906-10.553c-8.025-9.77-12.872-25.979-2.409-42.176c21.522-33.314,23.432-75.822,4.984-110.934    L298.5,295.658c9.676-10.366,15.615-24.263,15.615-39.529c0-9.499-2.31-18.462-6.376-26.383l27.074-14.226    c28.73-15.096,63.516-13.534,90.778,4.079c20.795,13.433,46.594,11.961,65.724-3.754c19.13-15.714,25.585-40.735,16.445-63.744    L470.2,57.554c-7.438-18.723-20.063-33.97-36.511-44.094c-15.24-9.38-32.976-14.017-51.313-13.405    c-18.329,0.611-35.725,6.417-50.307,16.79c-15.737,11.196-27.32,27.25-33.495,46.426l-43.441,134.896    c-9.088,0.154-17.668,2.407-25.285,6.297l-14.331-27.274c-15.096-28.732-13.534-63.516,4.079-90.778    c13.434-20.795,11.96-46.593-3.754-65.724C200.129,1.555,175.108-4.9,152.1,4.24L57.552,41.8    c-18.723,7.438-33.97,20.063-44.094,36.511c-9.38,15.24-14.016,32.984-13.405,51.313c0.611,18.329,6.417,35.725,16.79,50.307    c11.196,15.737,27.25,27.32,46.426,33.495l66.612,21.451c1.019,0.328,2.052,0.484,3.068,0.484c4.225,0,8.151-2.7,9.516-6.938    c1.693-5.257-1.196-10.891-6.453-12.584L69.4,194.389c-35.162-11.323-48.551-41.224-49.357-65.431    c-0.807-24.207,10.563-54.933,44.894-68.571l94.547-37.56c17.92-7.117,32.881,0.784,40.906,10.553s12.872,25.979,2.409,42.176    c-21.522,33.314-23.432,75.822-4.984,110.934l15.863,30.191c-9.631,10.357-15.538,24.222-15.538,39.447    c0,9.377,2.251,18.232,6.219,26.078l-27.172,14.277c-28.73,15.096-63.516,13.534-90.778-4.079    c-20.795-13.434-46.594-11.96-65.724,3.754C1.555,311.873-4.9,336.894,4.24,359.903L41.8,454.45    c7.438,18.723,20.063,33.97,36.511,44.094c14.351,8.833,30.921,13.458,48.111,13.458c1.065,0,2.133-0.018,3.203-0.053    c18.329-0.611,35.725-6.417,50.307-16.79c15.737-11.196,27.32-27.25,33.495-46.426L256.783,314.1    c9.175-0.102,17.841-2.348,25.529-6.257l14.172,26.972c15.096,28.732,13.534,63.516-4.079,90.778    c-13.434,20.795-11.96,46.594,3.754,65.724c10.976,13.362,26.49,20.54,42.69,20.54c6.993,0,14.116-1.338,21.054-4.094    l94.547-37.56c18.723-7.438,33.97-20.063,44.094-36.511C507.924,418.453,512.56,400.708,511.949,382.379z M194.389,442.602    c-11.323,35.162-41.224,48.551-65.431,49.357c-24.207,0.8-54.933-10.563-68.571-44.894l-37.56-94.547    c-7.119-17.92,0.784-32.88,10.553-40.906c9.77-8.024,25.98-12.871,42.176-2.409c33.314,21.522,75.821,23.432,110.934,4.984    l30.019-15.773c5.792,5.43,12.691,9.686,20.324,12.388L194.389,442.602z M256.128,294.117c-20.947,0-37.988-17.042-37.988-37.988    c0-20.946,17.042-37.988,37.988-37.988c20.946,0,37.988,17.042,37.988,37.988C294.116,277.075,277.075,294.117,256.128,294.117z     M295.485,213.592c-5.814-5.383-12.728-9.585-20.364-12.241L317.613,69.4c11.323-35.162,41.224-48.551,65.431-49.357    c24.208-0.813,54.933,10.563,68.571,44.894l37.56,94.547c7.119,17.92-0.784,32.88-10.553,40.906    c-9.769,8.025-25.979,12.872-42.176,2.409c-33.314-21.523-75.821-23.432-110.934-4.984L295.485,213.592z\" id=\"svg_3\"/> </g></g><g id=\"svg_4\"> <g id=\"svg_5\">  <path d=\"M352.022,268.591c-1.86-1.86-4.44-2.93-7.07-2.93s-5.21,1.07-7.07,2.93c-1.86,1.86-2.93,4.44-2.93,7.07    s1.07,5.21,2.93,7.07c1.86,1.86,4.44,2.93,7.07,2.93s5.21-1.07,7.07-2.93c1.86-1.86,2.93-4.44,2.93-7.07    S353.882,270.451,352.022,268.591z\" id=\"svg_6\"/> </g></g><g id=\"svg_7\"> <g id=\"svg_8\">  <path d=\"M178.641,230.721c-1.87-1.86-4.44-2.93-7.07-2.93c-2.64,0-5.21,1.07-7.07,2.93c-1.87,1.86-2.93,4.44-2.93,7.07    c0,2.64,1.06,5.22,2.93,7.08c1.86,1.86,4.43,2.92,7.07,2.92c2.63,0,5.21-1.06,7.07-2.92c1.86-1.87,2.93-4.44,2.93-7.08    C181.571,235.161,180.501,232.591,178.641,230.721z\" id=\"svg_9\"/> </g></g><g id=\"svg_10\"></g><g id=\"svg_11\"></g><g id=\"svg_12\"></g><g id=\"svg_13\"></g><g id=\"svg_14\"></g><g id=\"svg_15\"></g><g id=\"svg_16\"></g><g id=\"svg_17\"></g><g id=\"svg_18\"></g><g id=\"svg_19\"></g><g id=\"svg_20\"></g><g id=\"svg_21\"></g><g id=\"svg_22\"></g><g id=\"svg_23\"></g><g id=\"svg_24\"></g><path fill-opacity=\"1\" stroke=\"#FFFFFF\" stroke-width=\"30\" stroke-dasharray=\"none\" stroke-linejoin=\"round\" stroke-linecap=\"butt\" stroke-dashoffset=\"\" fill-rule=\"nonzero\" opacity=\"1\" marker-start=\"\" marker-mid=\"\" marker-end=\"\" d=\"M37.36795901629088,21.906882144736514L482.08845195928615,484.01867928103314\" id=\"svg_25\" class=\"\"/></g></svg>";
                                    const flashLights = "<svg version=\"1.1\" id=\"Capa_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"  viewBox=\"0 0 512 512\" style=\"enable-background:new 0 0 512 512;\" xml:space=\"preserve\"><g> <g>  <path d=\"M156.086,99.914C70.02,99.914,0,169.935,0,256.001s70.02,156.086,156.086,156.086h94.498V99.914H156.086z    M220.584,382.087h-64.498C86.562,382.087,30,325.525,30,256.001c0-69.525,56.562-126.087,126.086-126.087h64.498V382.087z\"/> </g></g><g> <g>  <rect x=\"335.31\" y=\"241.001\" width=\"176.69\" height=\"30\"/> </g></g><g> <g>     <rect x=\"328.217\" y=\"131.795\" transform=\"matrix(0.9811 -0.1936 0.1936 0.9811 -20.5382 83.4224)\" width=\"176.693\" height=\"30.001\"/> </g></g><g> <g>     <rect x=\"401.568\" y=\"277.852\" transform=\"matrix(0.1936 -0.9811 0.9811 0.1936 -23.3496 703.9905)\" width=\"30.001\" height=\"176.693\"/> </g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g></svg>";
                                    const blowHorn = "<svg version=\"1.1\" id=\"Capa_1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\"  viewBox=\"0 0 512.007 512.007\" style=\"enable-background:new 0 0 512.007 512.007;\" xml:space=\"preserve\"><g> <g>  <path d=\"M508.877,173.799L338.21,3.132c-2.417-2.427-5.823-3.552-9.25-2.99c-3.385,0.552-6.302,2.698-7.833,5.76L310.46,27.236   c-1.177,2.354-1.438,5.063-0.74,7.604l7.729,28.031c-19.438,66.24-55.458,126.969-104.375,175.875l-64.111,65.806l-2.754-2.754   c-4.167-4.167-10.917-4.167-15.083,0l-19.594,19.594c-5.365-0.927-10.49-1.385-15.531-1.385c-52.937,0-96,43.063-96,96   s43.063,96,96,96s96-43.063,96-96c0-5.042-0.458-10.167-1.385-15.531l19.594-19.594c4.167-4.167,4.167-10.917,0-15.083   l-2.701-2.701l66.003-64.102c48.833-48.833,109.573-84.854,175.802-104.281l27.885,7.583c2.531,0.719,5.25,0.438,7.573-0.75   l21.333-10.667c3.063-1.531,5.208-4.448,5.76-7.833C512.419,179.663,511.304,176.226,508.877,173.799z M171.491,389.434   c-2.594,2.594-3.677,6.344-2.854,9.927c1.365,5.969,2.031,11.406,2.031,16.646c0,41.167-33.5,74.667-74.667,74.667   c-41.167,0-74.667-33.5-74.667-74.667c0-41.167,33.5-74.667,74.667-74.667c5.24,0,10.677,0.667,16.646,2.031   c3.573,0.844,7.323-0.271,9.927-2.854l16.094-16.094l48.917,48.917L171.491,389.434z M478.877,180.642l-26.854-7.302   c-1.896-0.51-3.865-0.51-5.729,0.031c-70.813,20.229-135.771,58.448-187.75,110.427l-66.121,64.212l-28.372-28.372l64.202-65.902   c52.083-52.073,90.313-117.031,110.542-187.865c0.531-1.885,0.542-3.875,0.021-5.76l-7.438-26.99l2.219-4.438l149.729,149.729   L478.877,180.642z\"/> </g></g><g></g><g></g><g></g<g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g><g></g></svg>";
                                    const actionTiles = [ 
                                        {lock: api.exported.Icons.class.list()["locked"]},
                                        {unlock: api.exported.Icons.class.list()["unlocked"]},
                                        {startClimate: startClimate},
                                        {stopClimate: stopClimate},
                                        {flashLights: flashLights},
                                        {blowHorn: blowHorn}
                                    ];

                                    const tile = api.dashboardAPI.Tile(tileId, api.dashboardAPI.TileType().TILE_SUB_TILES, null, null, null, null, null, null, 0, 109, BMW_REGISTER_KEY, {miniTiles: miniTiles, buttons: actionTiles}, api.webAPI.Authentication().AUTH_USAGE_LEVEL);
                                    api.dashboardAPI.registerTile(tile);

                                    this.api.webAPI.register(this, this.api.webAPI.constants().POST, ":/" + tileId + "/[set*]/[action*]/", api.webAPI.Authentication().AUTH_USAGE_LEVEL);
                                })
                                .catch((e) => {
                                    api.exported.Logger.err(e.message);
                                });
                        });
                    })
                    .catch((e) => {
                        api.exported.Logger.err(e.message);
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
            if (apiRequest.route.startsWith(":/bmw")) {
                return new Promise((resolve, reject) => {
                    
                    const vin = apiRequest.route.split("/")[1].split("-")[1].replace(" ", "");
                    if (apiRequest.data && apiRequest.data.action) {
                        const configuration = api.configurationAPI.getConfiguration();

                        let r = Regions.RestOfWorld;
                        if (configuration.zone == "us")  {
                            r = Regions.NorthAmerica;
                        } else if (configuration.zone == "cn") {
                            r = Regions.China;
                        }
                        const bmwApi = new ConnectedDrive(configuration.username, configuration.password, r);
                        if (apiRequest.data.action == "lock") {
                            api.messageAPI.sendMessage([apiRequest.authenticationData.username], api.translateAPI.t("bmw.locking"));
                            bmwApi.lockDoors(vin, true)
                                .then(() => {
                                    api.messageAPI.sendMessage([apiRequest.authenticationData.username], api.translateAPI.t("bmw.locked"));
                                    resolve(self.api.webAPI.APIResponse(true, {success:true}));
                                })
                                .catch((e) => {
                                    api.exported.Logger.err(e.message);
                                    reject(this.api.webAPI.APIResponse(false, {}, 6965, "Fail"));
                                });
                        } else if (apiRequest.data.action == "unlock") {
                            api.messageAPI.sendMessage([apiRequest.authenticationData.username], api.translateAPI.t("bmw.unlocking"));
                            bmwApi.unlockDoors(vin, true)
                                .then(() => {
                                    api.messageAPI.sendMessage([apiRequest.authenticationData.username], api.translateAPI.t("bmw.unlocked"));
                                    resolve(self.api.webAPI.APIResponse(true, {success:true}));
                                })
                                .catch((e) => {
                                    api.exported.Logger.err(e.message);
                                    reject(this.api.webAPI.APIResponse(false, {}, 6966, "Fail"));
                                });
                        } else if (apiRequest.data.action == "startClimate") {
                            api.messageAPI.sendMessage([apiRequest.authenticationData.username], api.translateAPI.t("bmw.start.climate"));
                            bmwApi.startClimateControl(vin, true)
                                .then(() => {
                                    api.messageAPI.sendMessage([apiRequest.authenticationData.username], api.translateAPI.t("bmw.started.climate"));
                                    resolve(self.api.webAPI.APIResponse(true, {success:true}));
                                })
                                .catch((e) => {
                                    api.exported.Logger.err(e.message);
                                    reject(this.api.webAPI.APIResponse(false, {}, 6967, "Fail"));
                                });
                        } else if (apiRequest.data.action == "stopClimate") {
                            api.messageAPI.sendMessage([apiRequest.authenticationData.username], api.translateAPI.t("bmw.stop.climate"));
                            bmwApi.stopClimateControl(vin, true)
                                .then(() => {
                                    api.messageAPI.sendMessage([apiRequest.authenticationData.username], api.translateAPI.t("bmw.stopped.climate"));
                                    resolve(self.api.webAPI.APIResponse(true, {success:true}));
                                })
                                .catch((e) => {
                                    api.exported.Logger.err(e.message);
                                    reject(this.api.webAPI.APIResponse(false, {}, 6968, "Fail"));
                                });
                        } else if (apiRequest.data.action == "flashLights") {
                            api.messageAPI.sendMessage([apiRequest.authenticationData.username], api.translateAPI.t("bmw.flashing.light"));
                            bmwApi.flashLights(vin, true)
                                .then(() => {
                                    api.messageAPI.sendMessage([apiRequest.authenticationData.username], api.translateAPI.t("bmw.flashed.light"));
                                    resolve(self.api.webAPI.APIResponse(true, {success:true}));
                                })
                                .catch((e) => {
                                    api.exported.Logger.err(e.message);
                                    reject(this.api.webAPI.APIResponse(false, {}, 6969, "Fail"));
                                });
                        } else if (apiRequest.data.action == "blowHorn") {
                            api.messageAPI.sendMessage([apiRequest.authenticationData.username], api.translateAPI.t("bmw.blowing.horn"));
                            bmwApi.blowHorn(vin, true)
                                .then(() => {
                                    api.messageAPI.sendMessage([apiRequest.authenticationData.username], api.translateAPI.t("bmw.blowed.horn"));
                                    resolve(self.api.webAPI.APIResponse(true, {success:true}));
                                })
                                .catch((e) => {
                                    api.exported.Logger.err(e.message);
                                    reject(this.api.webAPI.APIResponse(false, {}, 6970, "Fail"));
                                });
                        }
                    }
                });
            }
        }
    }

    api.registerInstance(new Bmw(api));
}

module.exports.attributes = {
    loadedCallback: loaded,
    name: "bmw",
    version: "0.0.0",
    category: "misc",
    defaultDisabled: true,
    description: "BMW connected drive"
};
