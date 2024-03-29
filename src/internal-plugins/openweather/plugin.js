"use strict";

const request = require("request");
const sha256 = require("sha256");
const fs = require("fs-extra");
const WEATHER_WS = "http://api.openweathermap.org/data/2.5/weather?lat=%latitude%&lon=%longitude%&units=metric&APPID=%appid%&units=metric";
const WEATHER_FORECAST_WS = "http://api.openweathermap.org/data/2.5/forecast?lat=%latitude%&lon=%longitude%&units=metric&APPID=%appid%&units=metric";
const TIME_LIMIT_DAYNIGHT = 60 * 60;
const FORECAST_TIME_SLOT = 3 * 60 * 60;

/**
 * Loaded function
 *
 * @param  {PluginAPI} api The api
 */
function loaded(api) {
    api.init();

    /**
     * This class is used for Openweather database
     *
     * @class
     */
    class OpenWeatherDb extends api.exported.DbObject.class {
        /**
         * Openweather table descriptor
         *
         * @param  {DbHelper} [dbHelper=null] A database helper
         * @param  {...object} values          The values
         * @returns {DbObject}                 A database object
         */
        constructor(dbHelper = null, ...values) {
            super(dbHelper, ...values);

            /**
            * @Property("weatherId");
            * @Type("int");
            * @Version("0.0.0");
            */
            this.weatherId;

            /**
            * @Property("weatherName");
            * @Type("string");
            * @Version("0.0.0");
            */
            this.weatherName;

            /**
            * @Property("weatherIcon");
            * @Type("string");
            * @Version("0.0.0");
            */
            this.weatherIcon;

            /**
            * @Property("visibility");
            * @Type("int");
            * @Version("0.0.0");
            */
            this.visibility;

            /**
            * @Property("temperature");
            * @Type("int");
            * @Version("0.0.0");
            */
            this.temperature;

            /**
            * @Property("pressure");
            * @Type("int");
            * @Version("0.0.0");
            */
            this.pressure;

            /**
            * @Property("humidity");
            * @Type("int");
            * @Version("0.0.0");
            */
            this.humidity;

            /**
            * @Property("windSpeed");
            * @Type("int");
            * @Version("0.0.0");
            */
            this.windSpeed;

            /**
            * @Property("windDirection");
            * @Type("int");
            * @Version("0.0.0");
            */
            this.windDirection;

            /**
            * @Property("sunrise");
            * @Type("timestamp");
            * @Version("0.0.0");
            */
            this.sunrise;

            /**
            * @Property("sunset");
            * @Type("timestamp");
            * @Version("0.0.0");
            */
            this.sunset;
        }
    }

    /**
    * This class is used for OpenWeather form
     *
    * @class
    */
    class OpenWeatherForm extends api.exported.FormObject.class {
        /**
         * Constructor
         *
         * @param  {number} id           Identifier
         * @param  {string} apiKey       The OpenWeather API key
         * @param  {boolean} autoDayNight `true` if auto day night mode enable, `false` otherwise
         * @param  {boolean} weatherTile `true` if weather tile should appear, `false` otherwise
         * @param  {number} rainForecastTileMode Rain forecast tile mode
         * @returns {OpenWeatherForm}              The instance
         */
        constructor(id, apiKey, autoDayNight = true, weatherTile = false, rainForecastTileMode = 3) {
            super(id);
            /**
             * @Property("apiKey");
             * @Type("string");
             * @Title("openweather.api.key");
             */
            this.apiKey = apiKey;

            /**
             * @Property("autoDayNight");
             * @Type("boolean");
             * @Title("openweather.autoDayNight");
             * @Type("boolean");
             * @Default(true);
             */
            this.autoDayNight = autoDayNight;

            /**
             * @Property("weatherTile");
             * @Type("boolean");
             * @Title("openweather.weatherTile");
             * @Default(false);
             */
            this.weatherTile = weatherTile;

            /**
             * @Property("rainForecastTileMode");
             * @Type("number");
             * @Title("openweather.rainForecastTileMode");
             * @Enum([0, 1, 2, 3]);
             * @EnumNames(["openweather.rainForecastTileMode.none", "openweather.rainForecastTileMode.hours", "openweather.rainForecastTileMode.day", "openweather.rainForecastTileMode.days"]);
             * @Default(2);
             */
            this.rainForecastTileMode = rainForecastTileMode;
        }

        /**
         * Convert json data
         *
         * @param  {object} data Some key / value data
         * @returns {OpenWeatherForm}      A form object
         */
        json(data) {
            return new OpenWeatherForm(data.id, data.apiKey, data.autoDayNight, data.weatherTile, data.rainForecastTileMode);
        }
    }

    api.configurationAPI.register(OpenWeatherForm);

    /**
     * This class manage openweather APIs
     *
     * @class
     */
    class OpenWeather {
        /**
         * Constructor
         *
         * @param  {PluginAPI} api The api
         * @returns {OpenWeather}     The instance
         */
        constructor(api) {
            this.api = api;
            this.registeredElements = {};
            api.configurationAPI.register(OpenWeatherForm);

            // Register a schema
            api.databaseAPI.addOptimization(OpenWeatherDb, "idx_db_ow_ts", "timestamp");
            api.databaseAPI.register(OpenWeatherDb);
            // Retrieve DbHelper
            this.dbHelper = api.databaseAPI.dbHelper(OpenWeatherDb);

            this.api.configurationAPI.setUpdateCb(() => {
                // Current
                this.registerWeatherTile();
                // Forecast
                this.forecastProcessing();
            });

            // Create tiles
            this.registerWeatherTile();
            this.forecastProcessing();

            // Save weather every hour and dispatch
            api.timeEventAPI.register((self) => {
                // Current
                self.getWeather((error, dbObject) => {
                    // Dispatch callback
                    Object.keys(this.registeredElements).forEach((registeredKey) => {
                        this.registeredElements[registeredKey](error, dbObject?api.exported.Cleaner.class.cleanDbObject(dbObject):null);
                    });

                    if (!error && dbObject) {
                        dbObject.save();
                        self.registerWeatherTile();
                    }
                });

                // Forecast
                self.forecastProcessing();
            }, this, api.timeEventAPI.constants().EVERY_HOURS);

            // Auto day / night
            api.timeEventAPI.register((self) => {
                const config = api.configurationAPI.getConfiguration();
                if (config && config.autoDayNight) {
                    self.dbHelper.getLastObject((error, object) => {
                        if (!error && object) {
                            if ((api.exported.DateUtils.class.timestamp() >= object.sunrise) && (api.exported.DateUtils.class.timestamp() <= object.sunrise + TIME_LIMIT_DAYNIGHT)) {
                                api.environmentAPI.setDay();
                            }

                            if ((api.exported.DateUtils.class.timestamp() >= object.sunset) && (api.exported.DateUtils.class.timestamp() <= object.sunset + TIME_LIMIT_DAYNIGHT)) {
                                api.environmentAPI.setNight();
                            }
                        }
                    });
                }
            }, this, api.timeEventAPI.constants().EVERY_MINUTES);
        }

        /**
         * Register for weather elements
         *
         * @param  {Function} cb            A callback triggered when weather information is received. Example : `(error, weatherDbObject) => {}`
         * @param  {string} id            An identifier
         */
        register(cb, id = null) {
            const index = sha256(cb.toString() + id);
            this.registeredElements[index] = cb;
        }

        /**
         * Unegister a weather element
         *
         * @param  {Function} cb             A callback triggered when weather information is received. Example : `(error, weatherDbObject) => {}`
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
         * Prepare weather URL
         *
         * @param  {string} url Base template URL
         * @returns {string}     Replaced URL
         */
        prepareUrl(url) {
            // Get the configuration
            const config = api.configurationAPI.getConfiguration();
            if (config) {
                url = url.replace("%appid%", config.apiKey);
            }
            if (this.api.environmentAPI.getCoordinates()) {
                url = url.replace("%longitude%", this.api.environmentAPI.getCoordinates().longitude);
                url = url.replace("%latitude%", this.api.environmentAPI.getCoordinates().latitude);
            }

            return url;
        }

        /**
         * Get weather informations
         *
         * @param  {Function} cb A callback `(error, dbObject) => {}`
         */
        getWeather(cb) {
            const url = this.prepareUrl(WEATHER_WS);
            const self = this;
            request(url, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    try {
                        const weatherInfos = JSON.parse(body);
                        if (weatherInfos.weather.length > 0) {
                            cb(null, new OpenWeatherDb(self.dbHelper, weatherInfos.weather[0].id, weatherInfos.weather[0].main, weatherInfos.weather[0].icon, weatherInfos.visibility, weatherInfos.main.temp, weatherInfos.main.pressure, weatherInfos.main.humidity, (weatherInfos.wind.speed * 3.6), weatherInfos.wind.deg, weatherInfos.sys.sunrise, weatherInfos.sys.sunset));
                        } else {
                            cb(Error("No weather infos"));
                        }
                    } catch(e) {
                        cb(e);
                    }

                } else {
                    cb(error);
                }
            });
        }

        /**
         * Get weather informations
         *
         * @param  {Function} cb A callback `(error, forecastObject) => {}`
         * @param  {number} duration Forecast duration
         */
        getWeatherForecast(cb, duration = FORECAST_TIME_SLOT) {
            const url = this.prepareUrl(WEATHER_FORECAST_WS);
            const self = this;
            request(url, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                    self.dbHelper.getLastObject((error, lastWeather) => {
                        if (!error && lastWeather) {
                            try {
                                const weatherForecastInfos = JSON.parse(body);
                                const lastWeatherSunriseSeconds = api.exported.DateUtils.class.secondsElapsedSinceMidnight(lastWeather.sunrise);
                                const lastWeatherSunsetSeconds = api.exported.DateUtils.class.secondsElapsedSinceMidnight(lastWeather.sunset);

                                let rainForecastTime = 0;
                                let snowForecastTime = 0;
                                let rainForecastMm = 0;
                                let snowForecastMm = 0;
                                let dayTemperature = [];
                                let nightTemperature = [];
                                let windSpeed = [];
                                let avgDayTemperature = 0;
                                let avgNightTemperature = 0;
                                let avgWindSpeed = 0;
                                let storm = false;
                                let hot = false;
                                let cold = false;
                                let rain = false;
                                let snow = false;

                                const currentTimestamp = api.exported.DateUtils.class.timestamp();
                                weatherForecastInfos.list.forEach((weatherForecastInfo) => {
                                    if (weatherForecastInfo.dt <= (currentTimestamp + duration)) {
                                        // Rain
                                        if (weatherForecastInfo.rain && weatherForecastInfo.rain["3h"] > 0) {
                                            rainForecastTime += FORECAST_TIME_SLOT;
                                            rainForecastMm += parseFloat(weatherForecastInfo.rain["3h"]);
                                        }

                                        // Snow
                                        if (weatherForecastInfo.snow && weatherForecastInfo.snow["3h"] > 0) {
                                            snowForecastTime += FORECAST_TIME_SLOT;
                                            snowForecastMm += parseFloat(weatherForecastInfo.snow["3h"]);
                                        }

                                        const elapsedTime = api.exported.DateUtils.class.secondsElapsedSinceMidnight(weatherForecastInfo.dt);

                                        if (elapsedTime <= lastWeatherSunriseSeconds || elapsedTime >= lastWeatherSunsetSeconds) {
                                            // Night mode
                                            nightTemperature.push(weatherForecastInfo.main.temp);
                                        } else {
                                            // Day mode
                                            dayTemperature.push(weatherForecastInfo.main.temp);
                                        }

                                        // Wind
                                        windSpeed.push((weatherForecastInfo.wind.speed * 3.6));

                                        // Rain
                                        if (weatherForecastInfo.weather[0].id >= 500 && weatherForecastInfo.weather[0].id < 600) {
                                            rain = true;
                                        }

                                        // Storm
                                        if ((weatherForecastInfo.weather[0].id >= 200 && weatherForecastInfo.weather[0].id < 300) || weatherForecastInfo.weather[0].id === 960 || weatherForecastInfo.weather[0].id === 961 ) {
                                            storm = true;
                                        }

                                        // Snow
                                        if (weatherForecastInfo.weather[0].id >= 600 && weatherForecastInfo.weather[0].id < 700) {
                                            snow = true;
                                        }

                                        // Cold
                                        if (weatherForecastInfo.weather[0].id === 903) {
                                            cold = true;
                                        }

                                        // Hot
                                        if (weatherForecastInfo.weather[0].id === 904) {
                                            hot = true;
                                        }
                                    }
                                });

                                // Calculate averages

                                // Day temperature
                                if (dayTemperature.length > 0) {
                                    dayTemperature.forEach((dt) => {
                                        avgDayTemperature += dt;
                                    });
                                    avgDayTemperature = (avgDayTemperature / dayTemperature.length);
                                }

                                // Night temperature
                                if (nightTemperature.length > 0) {
                                    nightTemperature.forEach((nt) => {
                                        avgNightTemperature += nt;
                                    });
                                    avgNightTemperature = (avgNightTemperature / nightTemperature.length);
                                }

                                // Wind speed
                                if (windSpeed.length > 0) {
                                    windSpeed.forEach((nt) => {
                                        avgWindSpeed += nt;
                                    });
                                    avgWindSpeed = (avgWindSpeed / windSpeed.length);
                                }

                                // Straighten cold
                                if (((avgDayTemperature + avgNightTemperature) / 2) < 0) {
                                    cold = true;
                                }

                                // Straighten hot
                                if (((avgDayTemperature + avgNightTemperature) / 2) > 32) {
                                    hot = true;
                                }

                                cb(null, {
                                    rainForecastTime:rainForecastTime,
                                    snowForecastTime:snowForecastTime,
                                    rainForecastMm:rainForecastMm,
                                    snowForecastMm:snowForecastMm,
                                    avgDayTemperature:avgDayTemperature,
                                    avgNightTemperature:avgNightTemperature,
                                    avgWindSpeed:avgWindSpeed,
                                    storm:storm,
                                    hot:hot,
                                    cold:cold,
                                    rain:rain,
                                    snow:snow
                                });
                            } catch(e) {
                                cb(e);
                            }
                        } else {
                            cb(Error("No weather data set"));
                        }
                    });
                } else {
                    cb(error);
                }
            });
        }

        /**
         * Transform Openweather icon to good icon
         *
         * @param  {string} weatherIcon Openweather icon
         * @returns {string}             The smarties icon's string name
         */
        weatherIcon(weatherIcon) {
            let icon = "weather-na";
            if (weatherIcon === "01d") {
                icon = "weather-sunny";
            } else if (weatherIcon === "01n") {
                icon = "weather-moon";
            } else if (weatherIcon === "02d") {
                icon = "weather-sunny-cloud";
            } else if (weatherIcon === "02n") {
                icon = "weather-night-cloud";
            } else if (weatherIcon === "03d" || weatherIcon === "03n") {
                icon = "weather-cloud";
            } else if (weatherIcon === "04d" || weatherIcon === "04n") {
                icon = "weather-clouds";
            } else if (weatherIcon === "09d" || weatherIcon === "09n") {
                icon = "weather-rain";
            } else if (weatherIcon === "10d" || weatherIcon === "10n") {
                icon = "weather-drizzle";
            } else if (weatherIcon === "11d" || weatherIcon === "11n") {
                icon = "weather-storm";
            } else if (weatherIcon === "13d" || weatherIcon === "13n") {
                icon = "weather-snow";
            } else if (weatherIcon === "50d" || weatherIcon === "50n") {
                icon = "weather-fog";
            }

            return icon;
        }

        /**
         * Register weather tile
         */
        registerWeatherTile() {
            const config = api.configurationAPI.getConfiguration();
            if (config && config.weatherTile) {
                this.dbHelper.getLastObject((error, object) => {
                    if (!error && object) {
                        const weatherIcon = this.weatherIcon(object.weatherIcon);
                        const background = fs.readFileSync("./res/tiles/" + weatherIcon + ".jpg").toString("base64");
                        const title = api.translateAPI.t("openweather.weatherIcon." + weatherIcon);

                        const tile = api.dashboardAPI.Tile("openweather-current", api.dashboardAPI.TileType().TILE_GENERIC_ACTION_DARK, api.exported.Icons.class.list()[weatherIcon], null, title, null, background);
                        api.dashboardAPI.registerTile(tile);
                    }
                });
            } else if (config && !config.weatherTile) {
                api.dashboardAPI.unregisterTile("openweather-current");
            }
        }

        /**
         * Forecast processing
         */
        forecastProcessing() {
            const config = api.configurationAPI.getConfiguration();

            if (config && config.rainForecastTileMode) {
                let duration = 0;
                if (config.rainForecastTileMode === 1) {
                    duration = 60 * 60 * 12; // 12 hours
                } else if (config.rainForecastTileMode === 2) {
                    duration = 60 * 60 * 24; // 24 hours
                } else if (config.rainForecastTileMode === 3) {
                    duration = 60 * 60 * 24 * 3; // 3 days
                }

                this.getWeatherForecast((error, forecast) => {
                    if (!error) {
                        this.registerRainForecastTile(forecast);
                    } else {
                        this.registerRainForecastTile(null);
                    }
                }, duration);
            } else {
                this.registerRainForecastTile(null);
            }
        }

        /**
         * Register weather rain forecast tile
         *
         * @param  {object} forecast Forecast object
         */
        registerRainForecastTile(forecast) {
            const config = api.configurationAPI.getConfiguration();

            if (forecast && config && config.rainForecastTileMode && config.rainForecastTileMode > 0) {


                let mode = "";
                if (config.rainForecastTileMode === 1) {
                    mode = " [12h]";
                } else if (config.rainForecastTileMode === 2) {
                    mode = " [24h]";
                } else if (config.rainForecastTileMode === 3) {
                    mode = " [72h]";
                }

                let background;
                let tile;
                if (forecast.snow) {
                    background = fs.readFileSync("./res/tiles/snow.jpg").toString("base64");
                    tile = api.dashboardAPI.Tile("openweather-rain-forecast", api.dashboardAPI.TileType().TILE_GENERIC_ACTION_DARK, api.exported.Icons.class.list()["snowflake"], null, this.api.translateAPI.t("openweather.rain.forecast.snow", Math.round(forecast.snowForecastTime / (60 * 60))) + mode, null, background);
                } else if (forecast.rain) {
                    background = fs.readFileSync("./res/tiles/rain.jpg").toString("base64");
                    tile = api.dashboardAPI.Tile("openweather-rain-forecast", api.dashboardAPI.TileType().TILE_GENERIC_ACTION_DARK, api.exported.Icons.class.list()["umbrellas"], null, this.api.translateAPI.t("openweather.rain.forecast.rain", Math.round(forecast.rainForecastTime / (60 * 60))) + mode, null, background);
                } else {
                    background = fs.readFileSync("./res/tiles/no-rain.jpg").toString("base64");
                    tile = api.dashboardAPI.Tile("openweather-rain-forecast", api.dashboardAPI.TileType().TILE_GENERIC_ACTION_DARK, api.exported.Icons.class.list()["sun"], null, this.api.translateAPI.t("openweather.rain.forecast.no.rain") + mode, null, background);
                }

                api.dashboardAPI.registerTile(tile);
            } else {
                api.dashboardAPI.unregisterTile("openweather-rain-forecast");
            }
        }
    }

    api.exportClass(OpenWeather);
    api.registerInstance(new OpenWeather(api));
}

module.exports.attributes = {
    loadedCallback: loaded,
    name: "openweather",
    version: "0.0.0",
    category: "weather",
    description: "Openweather"
};
