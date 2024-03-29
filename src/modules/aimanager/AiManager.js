"use strict";

const bayes = require("bayes");
const cv = require("opencv4nodejs");
const fs = require("fs");
const Logger = require("./../../logger/Logger");
const DateUtils = require("./../../utils/DateUtils");
const TimeEventService = require("./../../services/timeeventservice/TimeEventService");

const ERROR_NO_CLASSIFIER = "No classifier registered";
const DB_FILE_EXTENSION = ".ai";
const CLASS_DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const CLASS_MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const CLASS_DAYOFF = ["workon", "workoff"];
const CLASS_DAYNIGHT = ["day", "night"];
const CLASS_TIME = "time";

const CV_DEFAULT_MAPPER = ["background", "aeroplane", "bicycle", "bird", "boat", "bottle", "bus", "car", "cat", "chair", "cow", "diningtable", "dog", "horse", "motorbike", "person", "pottedplant", "sheep", "sofa", "train", "tvmonitor"];
const CV_DEFAULT_AUTHORIZED = ["car", "cat", "dog", "bicycle", "motorbike", "person", "bus"];
const CV_DEFAULT_CONFIDENCE = 0.35;
const CV_DEFAULT_MAX_ELEMENTS = 10;
const CV_DEFAULT_BOX_SIZE = 350;
const CV_DEFAULT_NB_THREADS = 4;
const CV_DEFAULT_RESIZE = false;
const CV_DEFAULT_MEAN = 127.5;
const CV_DEFAULT_MIN_RATIO_HEIGHT_PERC = 0.05;
const CV_DEFAULT_MIN_RATIO_WIDTH_PERC = 0.05;
const CV_DEFAULT_MAX_RATIO_HEIGHT_PERC = 0.95;
const CV_DEFAULT_MAX_RATIO_WIDTH_PERC = 0.95;

const THREAD_OPEN_CV = "opencv";

/**
 * This class is used for artificial intelligence and machine learning
 *
 * @class
 */
class AiManager {
    /**
     * Constructor
     *
     * @param  {object} appConfiguration The configuration
     * @param  {EventEmitter} eventBus    The global event bus
     * @param  {string} stopEventName    The stop event name
     * @param  {TimeEventService} timeEventService    The time event service
     * @param  {EnvironmentManager} environmentManager    The environment manager
     * @param  {ThemeManager} themeManager    The theme manager
     * @param  {TranslateManager} translateManager    The translate manager
     * @param  {ThreadsManager} threadsManager    The threads manager
     *
     * @returns {AiManager} The instance
     */
    constructor(appConfiguration, eventBus, stopEventName, timeEventService, environmentManager, themeManager, translateManager, threadsManager) {
        this.appConfiguration = appConfiguration;
        this.databaseFile = appConfiguration.configurationPath + "data" + DB_FILE_EXTENSION;
        this.timeEventService = timeEventService;
        this.environmentManager = environmentManager;
        this.themeManager = themeManager;
        this.translateManager = translateManager;
        this.threadsManager = threadsManager;
        this.classifiers = {};
        this.cvPromises = {};

        // Computer vision
        this.cvMap = null;
        this.cvProtoTxt = null;
        this.cvModelFile = null;
        this.initCv();

        try {
            const serializedData = JSON.parse(fs.readFileSync(this.databaseFile));
            Object.keys(serializedData).forEach((key) => {
                this.classifiers[key] = bayes.fromJson(serializedData[key]);
                this.classifiers[key].tokenizer = this.tokenizer;
            });
        } catch(e) {
            Logger.warn(e.message);
        }


        // Save classifiers on stop core
        const self = this;
        if (eventBus) {
            eventBus.on(stopEventName, () => {
                self.saveClassifiers();
            });
        }

        this.timeEventService.register(() => {
            self.saveClassifiers();
        }, this, TimeEventService.EVERY_HOURS_INACCURATE);


        this.threadsManager.run(this.processCvSandboxed, THREAD_OPEN_CV, {cvMap:this.cvMap, translateManager: this.translateManager}, (data) => {
            if (this.cvPromises[data.timestamp]) {
                if (data.error) {
                    this.cvPromises[data.timestamp].reject(data.error);
                } else {
                    this.cvPromises[data.timestamp].resolve(data.success);
                }

                delete this.cvPromises[data.timestamp];
            }
        });
    }

    /**
     * Init computer vision (called in constructor)
     */
    initCv() {
        this.cvMap = {};

        if (this.appConfiguration.ai && this.appConfiguration.ai.cv && this.appConfiguration.ai.cv.mapper) {
            this.cvMap.mapper = this.appConfiguration.ai.cv.mapper;
        } else {
            this.cvMap.mapper = CV_DEFAULT_MAPPER;
        }

        if (this.appConfiguration.ai && this.appConfiguration.ai.cv && this.appConfiguration.ai.cv.mapper) {
            this.cvMap.authorized = this.appConfiguration.ai.cv.authorized;
        } else {
            this.cvMap.authorized = CV_DEFAULT_AUTHORIZED;
        }

        if (this.appConfiguration.ai && this.appConfiguration.ai.cv && this.appConfiguration.ai.cv.confidence) {
            this.cvMap.confidence = this.appConfiguration.ai.cv.confidence;
        } else {
            this.cvMap.confidence = CV_DEFAULT_CONFIDENCE;
        }

        if (this.appConfiguration.ai && this.appConfiguration.ai.cv && this.appConfiguration.ai.cv.maxElements) {
            this.cvMap.maxElements = this.appConfiguration.ai.cv.maxElements;
        } else {
            this.cvMap.maxElements = CV_DEFAULT_MAX_ELEMENTS;
        }

        if (this.appConfiguration.ai && this.appConfiguration.ai.cv && this.appConfiguration.ai.cv.boxSize) {
            this.cvMap.boxSize = this.appConfiguration.ai.cv.boxSize;
        } else {
            this.cvMap.boxSize = CV_DEFAULT_BOX_SIZE;
        }

        if (this.appConfiguration.ai && this.appConfiguration.ai.cv && this.appConfiguration.ai.cv.resize != null) {
            this.cvMap.resize = this.appConfiguration.ai.cv.resize;
        } else {
            this.cvMap.resize = CV_DEFAULT_RESIZE;
        }

        if (this.appConfiguration.ai && this.appConfiguration.ai.cv && this.appConfiguration.ai.cv.mean) {
            this.cvMap.mean = this.appConfiguration.ai.cv.mean;
        } else {
            this.cvMap.mean = CV_DEFAULT_MEAN;
        }

        if (this.appConfiguration.ai && this.appConfiguration.ai.cv && this.appConfiguration.ai.cv.scaleFactor) {
            this.cvMap.scaleFactor = this.appConfiguration.ai.cv.scaleFactor;
        } else {
            this.cvMap.scaleFactor = (1.0 / this.cvMap.mean);
        }

        if (this.appConfiguration.ai && this.appConfiguration.ai.cv && this.appConfiguration.ai.cv.minHeightPerc != null) {
            this.cvMap.minHeightPerc = this.appConfiguration.ai.cv.minHeightPerc;
        } else {
            this.cvMap.minHeightPerc = CV_DEFAULT_MIN_RATIO_HEIGHT_PERC;
        }

        if (this.appConfiguration.ai && this.appConfiguration.ai.cv && this.appConfiguration.ai.cv.minWidthPerc != null) {
            this.cvMap.minWidthPerc = this.appConfiguration.ai.cv.minWidthPerc;
        } else {
            this.cvMap.minWidthPerc = CV_DEFAULT_MIN_RATIO_WIDTH_PERC;
        }

        if (this.appConfiguration.ai && this.appConfiguration.ai.cv && this.appConfiguration.ai.cv.maxHeightPerc != null) {
            this.cvMap.maxHeightPerc = this.appConfiguration.ai.cv.maxHeightPerc;
        } else {
            this.cvMap.maxHeightPerc = CV_DEFAULT_MAX_RATIO_HEIGHT_PERC;
        }

        if (this.appConfiguration.ai && this.appConfiguration.ai.cv && this.appConfiguration.ai.cv.maxWidthPerc != null) {
            this.cvMap.maxWidthPerc = this.appConfiguration.ai.cv.maxWidthPerc;
        } else {
            this.cvMap.maxWidthPerc = CV_DEFAULT_MAX_RATIO_WIDTH_PERC;
        }

        if (this.appConfiguration.ai && this.appConfiguration.ai.cv && this.appConfiguration.ai.cv.nbThreads) {
            this.cvMap.nbThreads = this.appConfiguration.ai.cv.nbThreads;
        } else {
            this.cvMap.nbThreads = CV_DEFAULT_NB_THREADS;
        }

        Logger.info("Computer vision params : " + JSON.stringify(this.cvMap));

        const cvProtoTxt = "./res/ai/model/deploy.prototxt.txt";
        const cvModelFile = "./res/ai/model/deploy.caffemodel";
        this.cvMap.cvProtoTxt = cvProtoTxt;
        this.cvMap.cvModelFile = cvModelFile;
    }

    /**
     * Learn data to ai engine
     *
     * @param  {string} key A key
     * @param  {string|Array} data    The data
     * @param  {string} classification    The classification
     *
     * @returns {Promise} The promise
     */
    learn(key, data, classification) {
        if (this.classifiers[key]) {
            return this.classifiers[key].learn(data, classification);
        } else {
            throw Error(ERROR_NO_CLASSIFIER + " " + key);
        }
    }

    /**
     * Learn time data to ai engine
     *
     * @param  {string} key A key
     * @param  {Array} data    The data
     * @param  {string} classification    The classification
     *
     * @returns {Promise} The promise
     */
    learnWithTime(key, data, classification) {
        const timestamp = DateUtils.class.timestamp();
        const date = new Date(DateUtils.class.dateFormatted("YYYY-MM-DD HH:mm:ss", timestamp));

        data.push(CLASS_DAYS[date.getDay()]);

        data.push(CLASS_MONTHS[date.getMonth()]);
        if (this.environmentManager.getCoordinates() && this.environmentManager.getCountry()) {
            data.push(CLASS_DAYOFF[(DateUtils.class.isHoliday(this.environmentManager.getCountry(), timestamp) ? 0 : 1)]);
        }
        data.push(CLASS_DAYNIGHT[(this.environmentManager.isNight() ? 1 : 0)]);
        data.push(this.environmentManager.getSeason(timestamp));
        data.push(CLASS_TIME + date.getHours());

        return this.learn(key, data, classification);
    }

    /**
     * Guess the classification
     *
     * @param  {string} key A key
     * @param  {string|Array} data    The data
     *
     * @returns {Promise} The promise with the classification
     */
    guess(key, data) {
        if (this.classifiers[key]) {
            return this.classifiers[key].categorize(data);
        } else {
            throw Error(ERROR_NO_CLASSIFIER + " " + key);
        }
    }

    /**
     * Guess time data to ai engine
     *
     * @param  {string} key A key
     * @param  {Array} data    The data
     * @param  {number} timestamp    The desired timestamp
     *
     * @returns {Promise} The promise
     */
    guessWithTime(key, data, timestamp) {
        const date = new Date(DateUtils.class.dateFormatted("YYYY-MM-DD HH:mm:ss", timestamp));

        data.push(CLASS_DAYS[date.getDay()]);

        data.push(CLASS_MONTHS[date.getMonth()]);
        if (this.environmentManager.getCoordinates() && this.environmentManager.getCountry()) {
            data.push(CLASS_DAYOFF[(DateUtils.class.isHoliday(this.environmentManager.getCountry(), timestamp) ? 0 : 1)]);
        }

        data.push(this.environmentManager.getSeason(timestamp));
        data.push(CLASS_TIME + date.getHours());

        return this.guess(key, data);
    }

    /**
     * Register
     *
     * @param  {string} key A key
     * @param  {Function} [tokenizer=null]    A tokenizer function. If not provided, default tokenizer.
     */
    register(key, tokenizer = null) {
        if (!this.classifiers[key]) {
            this.classifiers[key] = bayes({
                tokenizer: (tokenizer ? tokenizer : this.tokenizer)
            });

        } else if (tokenizer) {
            this.classifiers[key].tokenizer = tokenizer;
        }
    }

    /**
     * Unregister. Thus will destroy the learned data.
     * /!\ THIS WILL DELETE HISTORY DATA !
     *
     * @param  {string} key A key
     */
    unregister(key) {
        delete this.classifiers[key];
    }

    /**
     * Tokenizer
     *
     * @param  {string|Array} data    The data
     */
    tokenizer(data) {
        if (Array.isArray(data)) {
            const d = [];
            data.forEach((token) => {
                d.push(token.toString());
            });
            return d;
        } else {
            return data.split(" ");
        }
    }


    /**
     * Save classifiers
     */
    saveClassifiers() {
        const json = {};
        Object.keys(this.classifiers).forEach((key) => {
            json[key] = this.classifiers[key].toJson();
        });
        fs.writeFileSync(this.databaseFile, JSON.stringify(json));
    }

    /**
     * Process neuronal artificial recognition on image
     *
     * @param  {Buffer|Mat} img An image
     *
     * @returns {Promise} The promise with a 2 properties object resolve - `results` and `frame`
     */
    processCvSsd(img) {
        const self = this;
        return new Promise((resolve, reject) => {
            const timestamp = Date.now();
            self.cvPromises[timestamp] = {resolve: resolve, reject: reject};
            self.threadsManager.send(THREAD_OPEN_CV, "processCvSsd", {img: img, timestamp:timestamp});
        });
    }

    /**
     * Process neuronal artificial recognition on image
     *
     * @param  {object} input The input data for new process
     * @param  {Function} message The message function for IPC
     */
    processCvSandboxed(input, message) {
        const cv = require("opencv4nodejs");
        cv.setNumThreads(input.cvMap.nbThreads);
        input.cvNet = cv.readNetFromCaffe(input.cvMap.cvProtoTxt, input.cvMap.cvModelFile);
        this.processCvSsd = (data) => {
            const img = Buffer.from(data.img.data);
            const tFrame = ((img instanceof cv.Mat) ? img : cv.imdecode(img));
            cv.blobFromImageAsync((input.cvMap.resize ? tFrame.resizeToMax(input.cvMap.boxSize) : tFrame), input.cvMap.scaleFactor, new cv.Size(input.cvMap.boxSize, input.cvMap.boxSize), new cv.Vec3(input.cvMap.mean, input.cvMap.mean, input.cvMap.mean), true)
                .then(inputBlob => input.cvNet.setInputAsync(inputBlob))
                .then(() => input.cvNet.forwardAsync())
                .then(outputBlob => {
                    outputBlob.flattenFloat(outputBlob.sizes[2], outputBlob.sizes[3]);
                    outputBlob = outputBlob.flattenFloat(outputBlob.sizes[2], outputBlob.sizes[3]);

                    const results = Array(outputBlob.rows)
                        .fill(0)
                        .map((res, i) => {
                            const classLabel = outputBlob.at(i, 1);
                            const confidence = outputBlob.at(i, 2);
                            const bottomLeft = new cv.Point(
                                outputBlob.at(i, 3) * tFrame.cols,
                                outputBlob.at(i, 6) * tFrame.rows
                            );
                            const topRight = new cv.Point(
                                outputBlob.at(i, 5) * tFrame.cols,
                                outputBlob.at(i, 4) * tFrame.rows
                            );
                            const rect = new cv.Rect(
                                bottomLeft.x,
                                topRight.y,
                                topRight.x - bottomLeft.x,
                                bottomLeft.y - topRight.y
                            );

                            return ({
                                classLabel,
                                confidence,
                                rect
                            });
                        })
                        .filter((item) => {
                            const height = tFrame.sizes[0];
                            const width = tFrame.sizes[1];
                            item.classLabelTranslated = input.translateManager.translations["ai." + input.cvMap.mapper[item.classLabel]];
                            let valid = false;

                            if (item.confidence > 0) {
                                if (((item.rect.height / height) >= input.cvMap.minHeightPerc) && ((item.rect.width / width) >= input.cvMap.minWidthPerc) && ((item.rect.height / height) <= input.cvMap.maxHeightPerc) && ((item.rect.width / width) <= input.cvMap.maxWidthPerc)) {
                                    valid = true;
                                } else {
                                    Logger.verbose("Reject item : width " + item.rect.width + " / " + width + " width " + item.rect.height + " / " + height);
                                }
                            }

                            return valid;
                        });

                    message({success:{results: results, frame: tFrame}, error: null, timestamp:data.timestamp});
                })
                .catch((e) => {
                    Logger.err(e);
                    message({success:null, error: e, timestamp:data.timestamp});
                });
        };
    }

    /**
     * Surround elements on picture
     *
     * @param  {Array} results The `processCvSsd` results
     * @param  {Buffer|Mat} img The cv initial mat
     *
     * @returns {Buffer} The JPG image
     */
    drawCvRectangles(results, img) {
        let frame = ((img instanceof cv.Mat) ? img : cv.imdecode(img));
        const overlay = frame.copy();
        const opacity = 0.3;
        const colors = this.themeManager.getColors();
        const clearColor = new cv.Vec(parseInt(colors.clearColor.substr(5, 2), 16), parseInt(colors.clearColor.substr(3, 2), 16), parseInt(colors.clearColor.substr(1, 2), 16));
        //B,V,R
        const headerColor = new cv.Vec(parseInt(colors.darkenColor.substr(5, 2), 16), parseInt(colors.darkenColor.substr(3, 2), 16), parseInt(colors.darkenColor.substr(1, 2), 16));

        for (let i = 0 ; i < results.length ; i++) {
            // const t = 1 + (this.cvMap.scaleFactor);
            // results[i].rect.x = results[i].rect.x * t;
            // results[i].rect.y = results[i].rect.y * t;
            // results[i].rect.width = results[i].rect.width * t;
            // results[i].rect.height = results[i].rect.height * t;

            // Overlay
            overlay.drawRectangle(
                new cv.Rect(results[i].rect.x, results[i].rect.y, results[i].rect.width, results[i].rect.height),
                clearColor,
                -1,
                cv.LINE_AA
            );

            frame  = overlay.addWeighted(opacity, frame, 1 - opacity, 0, frame).copy();

            // Text background
            frame.drawRectangle(
                new cv.Rect(results[i].rect.x, results[i].rect.y - 15, results[i].rect.width, 15),
                headerColor,
                -1,
                cv.LINE_AA
            );

            // Text
            frame.putText(results[i].classLabelTranslated + " - " + parseInt(results[i].confidence * 100) + "%", new cv.Point2(results[i].rect.x + 4, results[i].rect.y - 5), cv.FONT_HERSHEY_SIMPLEX, 0.35 /* font size */, clearColor, 1 /* line type */, 2 /* thickness */);

            // Border
            // frame.drawRectangle(
            //     results[i].rect,
            //     clearColor,
            //     1,
            //     cv.LINE_AA
            // );
        }


        return cv.imencode(".jpg", frame);
    }
}

module.exports = {class:AiManager, ERROR_NO_CLASSIFIER:ERROR_NO_CLASSIFIER, DB_FILE_EXTENSION:DB_FILE_EXTENSION};
