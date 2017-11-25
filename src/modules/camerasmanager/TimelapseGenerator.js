"use strict";
const Logger = require("./../../logger/Logger");
const fs = require("fs-extra");
const DateUtils = require("./../../utils/DateUtils");
const sha256 = require("sha256");

const VIDEO_EXTENSION = ".mp4";
const PICTURE_PREFIX = "snapshot-";
const MIN_DURATION = 1; // In seconds
const FRAMERATE = 25;
const ERROR_NO_ENOUGH_PICTURES = "No enough pictures";

const STATUS_PENDING = 0;
const STATUS_STARTED = 1;
const STATUS_RUNNING = 2;
const STATUS_SUCCESS = 3;
const STATUS_ERROR   = 4;

/**
 * This class allows to generate timelapse
 * @class
 */
class TimelapseGenerator {
    /**
     * Generate a timelapse for a camera
     *
     * @param  {Camera} camera              A camera object
     * @param  {InstallationManager} installationManager The installation manager instance
     * @param  {string} cachePath           The cache path
     * @param  {string} cameraArchiveFolder The camera archive path
     * @param  {number} [duration=24 * 60 * 60] The duration in seconds
     * @returns {TimelapseGenerator}                     The instance
     */
    constructor(camera, installationManager, cachePath, cameraArchiveFolder, duration = 24 * 60 * 60) {
        this.camera = camera;
        this.installationManager = installationManager;
        this.cachePath = cachePath;
        this.cameraArchiveFolder = cameraArchiveFolder;
        this.duration = duration;
        this.token = sha256(DateUtils.class.timestamp() + "");
        this.status = STATUS_PENDING;
    }

    /**
     * Generate a timelapse
     *
     * @param  {Function} cb A callback as `(status, error, timelapseFilepath) => {}`
     */
    generateTimelapse(cb) {
        this.status = STATUS_STARTED;
        this.prepareFiles((err, pictureList, cacheImages, folder) => {
            if (!err) {
                this.status = STATUS_RUNNING;
                this.installationManager.executeCommand("avconv -y -i " + cacheImages + PICTURE_PREFIX + "%5d"+ require("./CamerasManager").CAMERA_FILE_EXTENSION + " -r " + FRAMERATE + " -vcodec libx264 -qscale 1 -aq 1 -s 1024x768 -threads auto " + folder + this.token + VIDEO_EXTENSION, false, (error, stdout, stderr) => {
                    Logger.info("Timelapse generation done.");
                    Logger.verbose(stdout);
                    if (error) {
                        Logger.err(stderr);
                        this.status = STATUS_ERROR;
                        if (cb) cb(this.status, Error(error));
                    } else {
                        this.status = STATUS_SUCCESS;
                        if (cb) cb(this.status, null, folder + this.token + VIDEO_EXTENSION);
                    }

                    // Clean
                    fs.remove(cacheImages);
                });
            } else {
                this.status = STATUS_ERROR;
                if (cb) {
                    cb(this.status, err);
                }
            }
        });
    }

    /**
     * Add padding to number
     *
     * @param  {number} num  The number
     * @param  {number} size The leading 0 count
     * @returns {string}      The transformed number
     */
    pad(num, size) {
        let s = num + "";
        while (s.length < size) s = "0" + s;
        return s;
    }

    /**
     * Prepare camera files
     *
     * @param  {Function} cb A callback as `(err, pictureList, cacheImages, folder) => {}`
     */
    prepareFiles(cb) {
        Logger.info("Generating timelapse for camera " + this.camera.id);
        // Prepare file copy
        const folder = this.cachePath + DateUtils.class.timestamp() + "/";
        const cameraArchiveFolder = this.cameraArchiveFolder + this.camera.id + "/";
        const cacheImages = folder + "snapshots/";
        fs.mkdirsSync(cacheImages);
        const beginTimestamp = DateUtils.class.timestamp() - this.duration;
        fs.readdir(cameraArchiveFolder, (err, files) => {
            if (!err) {
                const pictureList = [];
                files.forEach((file) => {
                    const fileTimesamp = parseInt(file.split(".")[0]);

                    if (fileTimesamp >= beginTimestamp) {
                        pictureList.push(file);
                    }
                });

                Logger.info("Time lapse with " + pictureList.length + " pictures");

                if (pictureList.length / FRAMERATE >= MIN_DURATION) {
                    let i = 0;
                    let j = 0;
                    pictureList.forEach((file) => {
                        fs.copy(cameraArchiveFolder + file, cacheImages + PICTURE_PREFIX + this.pad(j, 5) + require("./CamerasManager").CAMERA_FILE_EXTENSION, (errorCopy) => {
                            if (errorCopy) {
                                Logger.err(errorCopy.message);
                            }
                            if (i === (pictureList.length -1)) {
                                cb(null, pictureList, cacheImages, folder);
                            }
                            i++;
                        });
                        j++;
                    });
                } else {
                    cb(Error(ERROR_NO_ENOUGH_PICTURES));
                }
            } else {
                cb(err);
            }
        });
    }
}

module.exports = {class:TimelapseGenerator, VIDEO_EXTENSION:VIDEO_EXTENSION, ERROR_NO_ENOUGH_PICTURES:ERROR_NO_ENOUGH_PICTURES, STATUS_PENDING:STATUS_PENDING, STATUS_STARTED:STATUS_STARTED, STATUS_RUNNING:STATUS_RUNNING, STATUS_ERROR:STATUS_ERROR, STATUS_SUCCESS:STATUS_SUCCESS};
