"use strict";
const dropboxV2Api = require("dropbox-v2-api");
const fs = require("fs-extra");
const BACKUP_FILE_NAME = "smarties-backup.zip";
const TIME_EVENT_KEY = "dropbox-backup";

/**
 * Loaded plugin function
 *
 * @param  {PluginAPI} api The core APIs
 */
function loaded(api) {
    api.init();

    /**
     * This class manage Dropbox form configuration
     *
     * @class
     */
    class DropboxForm extends api.exported.FormObject.class {
        /**
         * Constructor
         *
         * @param  {number} id The identifier
         * @param  {string} accessToken Dropbox access token
         * @param  {number} manualAction Manual actions
         * @param  {boolean} confirmRestore Confirm restore
         * @param  {boolean} saveConfiguration Save conf files
         * @param  {boolean} saveDatabase Save database file
         * @param  {boolean} saveCameraHistory Save camera history
         * @param  {number} autoBackup Automatic backup
         * @returns {DropboxForm}        The instance
         */
        constructor(id, accessToken, manualAction, confirmRestore, saveConfiguration, saveDatabase, saveCameraHistory, autoBackup) {
            super(id);

            /**
             * @Property("accessToken");
             * @Type("string");
             * @Title("dropbox.access.token");
             */
            this.accessToken = accessToken;

            /**
             * @Property("saveConfiguration");
             * @Type("boolean");
             * @Title("dropbox.save.configuration");
             * @Default(true);
             */
            this.saveConfiguration = saveConfiguration;

            /**
             * @Property("saveDatabase");
             * @Type("boolean");
             * @Title("dropbox.save.database");
             * @Default(true);
             */
            this.saveDatabase = saveDatabase;

            /**
             * @Property("saveCameraHistory");
             * @Type("boolean");
             * @Title("dropbox.save.camera.history");
             * @Default(false);
             */
            this.saveCameraHistory = saveCameraHistory;

            /**
             * @Property("autoBackup");
             * @Type("number");
             * @Title("dropbox.auto.backup");
             * @Enum([0, 1, 2, 3]);
             * @EnumNames(["dropbox.auto.backup.none", "dropbox.auto.backup.every.day", "dropbox.auto.backup.every.week", "dropbox.auto.backup.every.month"]);
             * @Default(0);
             * @Display("radio");
             */
            this.autoBackup = autoBackup;

            /**
             * @Property("manualAction");
             * @Type("number");
             * @Title("dropbox.manual.actions");
             * @Enum([0, 1, 2]);
             * @EnumNames(["dropbox.manual.actions.none", "dropbox.manual.actions.backup", "dropbox.manual.actions.restore"]);
             * @Default(0);
             * @Display("radio");
             */
            this.manualAction = manualAction;

            /**
             * @Property("confirmRestore");
             * @Type("boolean");
             * @Title("dropbox.restore.confirm");
             * @Default(false);
             */
            this.confirmRestore = confirmRestore;

        }


        /**
         * Convert a json object to DropboxForm object
         *
         * @param  {object} data Some data
         * @returns {DropboxForm}      An instance
         */
        json(data) {
            return new DropboxForm(data.id, data.accessToken, data.manualAction, data.confirmRestore, data.saveConfiguration, data.saveDatabase, data.saveCameraHistory, data.autoBackup);
        }
    }

    // Register the dropbox form
    api.configurationAPI.register(DropboxForm);

    /**
     * This class manage Dropbox backups
     *
     * @class
     */
    class Dropbox {
        /**
         * Constructor
         *
         * @param  {PluginAPI} api The core APIs
         * @returns {Dropbox}        The instance
         */
        constructor(api) {
            this.api = api;

            const self = this;

            api.configurationAPI.setUpdateCb((data, username) => {
                if (data.manualAction === 1) {
                    self.backup(data, self, username);
                } else if (data.manualAction === 2 && data.confirmRestore) {
                    self.restore(self);
                }

                data.manualAction = 0;
                data.confirmRestore = false;
                api.configurationAPI.saveData(data);

                self.autoBackup(data, self);
            });

            this.autoBackup(api.configurationAPI.getConfiguration(), this);
        }

        /**
         * Automatic backup
         *
         * @param  {object} data    Form configuration data
         * @param  {Dropbox} context The context. If null, set to this
         */
        autoBackup(data, context) {
            if (!context) {
                context = this;
            }

            context.api.timeEventAPI.unregister(null, null, null, null, null, TIME_EVENT_KEY);

            if (data && data.autoBackup && data.autoBackup > 0) {
                context.api.timeEventAPI.register((self) => {
                    const date = new Date();
                    const day = date.getDate();
                    const weekDay = date.getDay();

                    // Every day
                    if (self.api.configurationAPI.getConfiguration().autoBackup === 1) {
                        self.backup(data, self);
                    } else if (self.api.configurationAPI.getConfiguration().autoBackup === 2) {
                        // Every week monday at 5 am
                        if (weekDay === 0) {
                            self.backup(data, self);
                        }
                    } else if (self.api.configurationAPI.getConfiguration().autoBackup === 3) {
                        // Every month 1st
                        if (day === 1) {
                            self.backup(data, self);
                        }
                    }
                }, context, context.api.timeEventAPI.constants().EVERY_DAYS, null, null, null, TIME_EVENT_KEY);
            }
        }

        /**
         * Backup to dropbox
         *
         * @param  {object} data    Form configuration data
         * @param  {Dropbox} context The context. If null, set to this
         * @param  {string} username The username
         */
        backup(data, context = null, username = null) {
            if (!context) {
                context = this;
            }

            if (data.accessToken) {
                context.api.backupAPI.backup((err, backupFilePath) => {
                    if (err) {
                        context.api.exported.Logger.err(err.message);
                    } else {
                        const dropbox = dropboxV2Api.authenticate({
                            token: data.accessToken
                        });
                        dropbox({
                            resource: "files/delete",
                            parameters: {
                                path: "/" + BACKUP_FILE_NAME
                            }
                        }, (err) => {
                            if (err) {
                                api.exported.Logger.err(err);
                            }
                            dropbox({
                                resource: "files/upload",
                                parameters: {
                                    path: "/" + BACKUP_FILE_NAME
                                },
                                readStream: fs.createReadStream(backupFilePath)
                            }, (err) => {
                                if (err) {
                                    api.exported.Logger.err(err);
                                    if (username) {
                                        context.api.messageAPI.sendMessage([username], context.api.translateAPI.t("dropbox.backup.failed"));
                                    }
                                } else {
                                    if (username) {
                                        context.api.messageAPI.sendMessage([username], context.api.translateAPI.t("dropbox.backup.success"));
                                    }
                                }
                            });
                        });
                    }
                }, data.saveConfiguration, data.saveDatabase, data.saveCameraHistory);
            } else {
                context.api.exported.Logger.err("Missing dropbox access token");
            }
        }

        /**
         * Restore file from dropbox
         *
         * @param  {Dropbox} context The context. If null, set to this
         */
        restore(context) {
            const accessToken = context.api.configurationAPI.getConfiguration().accessToken;
            if (accessToken) {
                const dropbox = dropboxV2Api.authenticate({
                    token: accessToken
                });
                const backupFilePath = api.exported.cachePath + "backup-" + api.exported.DateUtils.class.timestamp() + ".zip";
                context.api.exported.Logger.info("Downloading backup ...");
                dropbox({
                    resource: "files/download",
                    parameters: {
                        path: "/" + BACKUP_FILE_NAME
                    }
                }, (err) => {
                    if (!err) {
                        context.api.exported.Logger.info("Backup downloaded, now restoring ...");
                        context.api.backupAPI.restore(backupFilePath, (err) => {
                            if (err) {
                                context.api.exported.Logger.err(err.message);
                            }

                            fs.removeSync(backupFilePath);
                        });
                    } else {
                        api.exported.Logger.err(err);
                    }
                })
                    .pipe(fs.createWriteStream(backupFilePath));
            } else {
                context.api.exported.Logger.err("Missing dropbox access token");
            }
        }
    }

    new Dropbox(api);
}

module.exports.attributes = {
    loadedCallback: loaded,
    name: "dropbox",
    version: "0.0.0",
    category: "backup",
    description: "Dropbox backup support",
    defaultDisabled: true,
    dependencies:[]
};
