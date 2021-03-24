"use strict";

const { exec, spawn } = require("child_process");
const sha256 = require("sha256");
const fs = require("fs-extra");
const os = require("os");

const RSYNC_ACTION_BASE = "/rsync/";
const RSYNC_ACTION = RSYNC_ACTION_BASE + "[hash]/";

/**
 * Loaded function
 *
 * @param  {PluginAPI} api The api
 */
function loaded(api) {
    api.init();

    /**
     * This class manage rsync subform
     *
     * @class
     */
    class RsyncSubform extends api.exported.FormObject.class {
        /**
         * Constructor
         *
         * @param  {number} id The identifier
         * @param  {string} ip Ip 1
         * @param  {string} path Path 1
         * @param  {string} username Username 1
         * @param  {string} password Password 1
         * @param  {string} ip2 Ip 2
         * @param  {string} path2 Path 2
         * @param  {string} username2 Username 2
         * @param  {string} password2 Password 2
         * @param  {string} trigger Trigger
         * @param  {string} tileName Tile name
         * @returns {RsyncSubform}        The instance
         */
        constructor(id, ip, path, username, password, ip2, path2, username2, password2, trigger, tileName) {
            super(id);

            /**
             * @Property("tileName");
             * @Type("string");
             * @Title("rsync.tile.name");
             * @Required(true);
             */
            this.tileName = tileName;

            /**
             * @Property("ip");
             * @Type("string");
             * @Title("rsync.ip");
             * @Required(true);
             */
            this.ip = ip;

            /**
             * @Property("path");
             * @Type("string");
             * @Title("rsync.path");
             * @Required(true);
             * @Default("/");
             */
            this.path = path;

            /**
             * @Property("username");
             * @Type("string");
             * @Title("rsync.username");
             */
            this.username = username;

            /**
             * @Property("password");
             * @Type("string");
             * @Title("rsync.passsword");
             * @Display("password");
             */
            this.password = password;

            /**
             * @Property("ip2");
             * @Type("string");
             * @Title("rsync.ip2");
             * @Required(true);
             */
            this.ip2 = ip2;

            /**
             * @Property("path2");
             * @Type("string");
             * @Title("rsync.path2");
             * @Required(true);
             * @Default("/");
             */
            this.path2 = path2;

            /**
             * @Property("username2");
             * @Type("string");
             * @Title("rsync.username2");
             */
            this.username2 = username2;

            /**
             * @Property("password2");
             * @Type("string");
             * @Title("rsync.password2");
             * @Display("password");
             */
            this.password2 = password2;

            /**
             * @Property("trigger");
             * @Type("string");
             * @Title("rsync.triggers");
             * @Display("checkbox");
             * @Enum(["connection", "tile"]);
             * @EnumNames(["rsync.connection", "rsync.tile"]);
             */
            this.trigger = trigger;
        }


        /**
         * Convert a json object to DropboxForm object
         *
         * @param  {object} data Some data
         * @returns {RsyncSubform}      An instance
         */
        json(data) {
            return new RsyncSubform(data.id, data.ip, data.path, data.username, data.password, data.ip2, data.path2, data.username2, data.password2, data.trigger, data.tileName);
        }
    }

    api.configurationAPI.registerSubform(RsyncSubform);

    /**
     * This class manage rsync sform
     *
     * @class
     */
    class RsyncForm extends api.exported.FormObject.class {
        /**
         * Constructor
         *
         * @param  {number} id The identifier
         * @param  {Array} items Items
         * @returns {RsyncForm}        The instance
         */
        constructor(id, items) {
            super(id);

            /**
             * @Property("items");
             * @Type("objects");
             * @Cl("RsyncSubform");
             * @Title("rsync.items");
             */
            this.items = items;
        }


        /**
         * Rsync form
         *
         * @param  {object} data Some data
         * @returns {RsyncForm}      An instance
         */
        json(data) {
            return new RsyncForm(data.id, data.items);
        }
    }

    api.configurationAPI.register(RsyncForm);

    /**
     * This class manage rsync actions
     *
     * @class
     */
    class Rsync {
        /**
         * Constructor
         *
         * @param  {PluginAPI} api The core APIs
         * @returns {Rsync}        The instance
         */
        constructor(api) {
            this.api = api;
            api.installerAPI.register(["darwin-x32", "darwin-x64"], "brew install unison", false, true, true);
            api.installerAPI.register(["linux-arm", "linux-arm64", "linux-x32", "linux-x64", "docker"], "apt-get install -y --allow-unauthenticated unison", true, true);
            this.pids = {};
            this.states = {};

            const self = this;
            this.registerTiles();
            this.api.webAPI.register(this, api.webAPI.constants().POST, ":" + RSYNC_ACTION, api.webAPI.Authentication().AUTH_USAGE_LEVEL);
            this.api.configurationAPI.setUpdateCb(() => {
                this.registerTiles();
            });

            api.exported.EventBus.on(api.environmentAPI.constants().EVENT_SCAN_IP_CHANGES, (data) => {
                if (api.configurationAPI.getConfiguration() && api.configurationAPI.getConfiguration().items && api.configurationAPI.getConfiguration().items.length > 0) {
                    api.configurationAPI.getConfiguration().items.forEach((item) => {
                        if ((data.target.ip == item.ip || data.target.ip == item.ip2) && item.trigger.indexOf("connection") != -1) {
                            try {
                                let ip1Found = false;
                                let ip2Found = false;
                                data.scannedIp.forEach((scannedIp) => {
                                    if (scannedIp.ip == item.ip) {
                                        ip1Found = true;
                                    } else if (scannedIp.ip == item.ip2) {
                                        ip2Found = true;
                                    }
                                });

                                if (ip1Found && ip2Found && !data.left) {
                                    self.sync(item);
                                } else if (data.left) {
                                    self.stop(item);
                                }
                            } catch (e) {
                                api.exported.Logger.err(e);
                            }
                        }
                    });
                }
            });
        }

        /**
         * Register tiles
         */
        registerTiles() {
            const icon = "<svg height=\"459pt\" viewBox=\"0 -1 459.085 459\" width=\"459pt\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"m228.070312 14.042969c37.671876 0 75.382813 10.679687 109.0625 30.886719 24.363282 14.640624 45.855469 33.589843 63.433594 55.925781l-65.421875-2.160157c-2.511719-.101562-4.886719 1.152344-6.21875 3.28125-1.332031 2.132813-1.421875 4.8125-.230469 7.027344 1.1875 2.214844 3.476563 3.621094 5.988282 3.683594l77.117187 2.542969c2.722657 1.484375 6.101563.992187 8.292969-1.203125 2.191406-2.195313 2.679688-5.570313 1.195312-8.296875l-2.546874-77.105469c-.152344-3.839844-3.378907-6.835938-7.222657-6.710938s-6.863281 3.328126-6.765625 7.171876l1.878906 57c-17.699218-21.027344-38.746093-38.988282-62.292968-53.160157-35.859375-21.511719-76.0625-32.8828122-116.269532-32.8828122-64.242187 0-123.464843 26.4921872-166.757812 74.5898432-19.332031 21.578126-34.707031 46.398438-45.414062 73.320313-10.398438 26.285156-15.898438 54-15.898438 80.167969 0 3.863281 3.132812 7 7 7s7-3.136719 7-7c0-50.082032 21.578125-103.957032 57.722656-144.121094 40.597656-45.113281 96.121094-69.957031 156.347656-69.957031zm0 0\"/><path d=\"m452.089844 221.117188c-3.863282 0-7 3.132812-7 7 0 50.082031-21.578125 103.957031-57.722656 144.117187-40.597657 45.113281-96.128907 69.957031-156.351563 69.957031-37.667969 0-75.382813-10.679687-109.0625-30.886718-24.359375-14.640626-45.855469-33.589844-63.429687-55.925782l65.421874 2.160156c3.867188.125 7.101563-2.902343 7.230469-6.765624.125-3.863282-2.902343-7.101563-6.769531-7.226563l-77.113281-2.542969c-2.726563-1.484375-6.101563-.992187-8.296875 1.203125-2.191406 2.195313-2.679688 5.570313-1.191406 8.296875l2.539062 77.105469c.0625 2.511719 1.46875 4.796875 3.683594 5.988281 2.214844 1.1875 4.894531 1.101563 7.027344-.234375 2.128906-1.332031 3.382812-3.707031 3.28125-6.214843l-1.878907-57c17.695313 21.027343 38.742188 38.988281 62.292969 53.160156 35.851562 21.511718 76.058594 32.882812 116.261719 32.882812 64.246093 0 123.46875-26.488281 166.757812-74.589844 19.335938-21.578124 34.710938-46.398437 45.414063-73.316406 10.402344-26.285156 15.902344-54 15.902344-80.167968 0-3.863282-3.132813-6.996094-6.996094-7zm0 0\"/><path d=\"m286.054688 116.667969h-45.101563c-.066406 0-.132813-.03125-.179687-.082031l-19.730469-21.578126c-6.820313-7.449218-16.449219-11.691406-26.546875-11.703124h-64.984375c-19.855469.023437-35.945313 16.113281-35.96875 35.96875v169.867187c.023437 19.855469 16.113281 35.945313 35.96875 35.96875h192.066406c19.855469-.023437 35.941406-16.113281 35.964844-35.96875v-101.640625c-.019531-19.691406-15.851563-35.710938-35.539063-35.964844-.617187-19.417968-16.523437-34.847656-35.949218-34.867187zm-131.527344 172.472656c-.011719 12.128906-9.839844 21.957031-21.964844 21.96875h-3.050781c-12.128907-.011719-21.953125-9.839844-21.96875-21.96875v-169.867187c.015625-12.128907 9.839843-21.957032 21.96875-21.96875h64.984375c6.167968.007812 12.050781 2.597656 16.21875 7.148437l19.730468 21.582031c2.699219 2.945313 6.511719 4.628906 10.511719 4.632813h45.097657c11.699218.011719 21.339843 9.179687 21.941406 20.863281h-117.5c-19.855469.023438-35.945313 16.113281-35.96875 35.96875zm189.015625-101.640625v101.640625c-.011719 12.128906-9.839844 21.957031-21.964844 21.96875h-160.554687c4.871093-6.285156 7.507812-14.015625 7.5-21.96875v-101.640625c.011718-12.128906 9.839843-21.957031 21.96875-21.96875h131.085937c12.125.011719 21.953125 9.839844 21.964844 21.96875zm0 0\"/></svg>";
            if (api.configurationAPI.getConfiguration() && api.configurationAPI.getConfiguration().items && api.configurationAPI.getConfiguration().items.length > 0) {
                api.configurationAPI.getConfiguration().items.forEach((item) => {
                    const hash = this.hash(item);
                    if (item.trigger.indexOf("tile") != -1) {
                        let title = "rsync.start";
                        if (this.states[hash]) {
                            title = "rsync." + this.states[hash];
                        }
                        const tile = api.dashboardAPI.Tile("rsync-" + hash, api.dashboardAPI.TileType().TILE_INFO_TWO_TEXT, icon, null, item.tileName,  api.translateAPI.t(title), null, null, 0, 997000, RSYNC_ACTION_BASE + hash + "/");
                        api.dashboardAPI.registerTile(tile);
                    } else {
                        api.dashboardAPI.unregisterTile("rsync-" + hash);
                    }
                });
            }
        }

        /**
         * Constructor
         *
         * @param  {object} item The configuration item
         * @returns {string}        The hash of item
         */
        hash(item) {
            return sha256(JSON.stringify(item));
        }

        /**
         * Start synchronization
         *
         * @param  {object} item The configuration item
         */
        sync(item) {
            const hash = this.hash(item);
            if (this.pids[hash] || this.states[hash]) {
                api.exported.Logger.info("Could not sync, already running : " + hash);
            } else {
                api.exported.Logger.info("Start sync item : " + hash);
                const self = this;
                const mntFolder1 = api.exported.cachePath + sha256(item.ip + item.path);
                const mntFolder2 = api.exported.cachePath + sha256(item.ip2 + item.path2);
                this.states[hash] = "starting";
                this.registerTiles();
                // Mount folder 1
                exec("umount " + mntFolder1, () => {
                    fs.ensureDirSync(mntFolder1);
                    exec(self.getMountCmd(item, mntFolder1, 0), (error) => {
                        if (error) {
                            api.exported.Logger.err(error);
                            self.stop(item);
                        } else {
                            api.exported.Logger.info("Mount : " + mntFolder1);
                            // Mount folder 2
                            exec("umount " + mntFolder2, () => {
                                fs.ensureDirSync(mntFolder2);
                                exec(self.getMountCmd(item, mntFolder2, 1), (error) => {
                                    if (error) {
                                        api.exported.Logger.err(error);
                                        self.stop(item);
                                    } else {
                                        api.exported.Logger.info("Mount : " + mntFolder2);
                                        api.exported.Logger.info("Synchronizing data ...");

                                        const unison = spawn("unison", ["-batch", "-copythreshold", "1024", "-fastcheck", "true", mntFolder1, mntFolder2]);
                                        self.pids[hash] = unison.pid;

                                        unison.stdout.on("data", (code) => {
                                            if (code) {
                                                const codeStr = code.toString();
                                                if (codeStr.substr(0,1) == "/" || codeStr.substr(0,1) == "-" || codeStr.substr(0,1) == "\\" || codeStr.substr(0,1) == "|") {
                                                    self.states[hash] = "analyzing";
                                                    self.registerTiles();
                                                } else if (codeStr.indexOf("%") > 0) {
                                                    self.states[hash] = "synch";
                                                    self.registerTiles();

                                                }
                                                api.exported.Logger.info(codeStr);
                                            }
                                        });

                                        unison.stderr.on("data", (data) => {
                                            if (data) {
                                                api.exported.Logger.err(data.toString());
                                                delete this.states[hash];
                                            }
                                        });

                                        unison.on("exit", (code) => {
                                            if (code) {
                                                const codeStr = code.toString();
                                                api.exported.Logger.info(codeStr);
                                                delete this.states[hash];
                                            }
                                            self.stop(item);
                                        });
                                    }
                                });
                            });
                        }
                    });
                });
            }
        }

        /**
         * Start synchronization
         *
         * @param  {object} item The configuration item
         */
        stop(item) {
            api.exported.Logger.info("Stop rsync : " + this.hash(item));
            const mntFolder1 = api.exported.cachePath + sha256(item.ip + item.path);
            const mntFolder2 = api.exported.cachePath + sha256(item.ip2 + item.path2);
            const pid = this.pids[this.hash(item)];
            if (pid) {
                try {
                    process.kill(pid, 2); // SIGINT
                } catch(e) {
                    e;
                }

                delete this.pids[this.hash(item)];
            }

            if (this.states[this.hash(item)]) {
                delete this.states[this.hash(item)];
            }

            this.registerTiles();

            exec("umount " + mntFolder1, () => {
                // if (error) {
                //     api.exported.Logger.err(error);
                // }

                exec("umount " + mntFolder2, () => {
                    // if (error) {
                    //     api.exported.Logger.err(error);
                    // }
                });
            });
        }

        /**
         * Get mount command
         *
         * @param  {object} item The configuration item
         * @param  {string} folder The tmp folder
         * @param  {int} index The index (0 or 1)
         */
        getMountCmd(item, folder, index = 0) {
            if (index == 0) {
                if (os.platform() == "darwin") {
                    return "mount -t smbfs //" + ((item.username && item.username.length > 0) ? "" + item.username + ":" + encodeURIComponent(item.password).replace(/!/g, "%21").replace(/@/g, "%40").replace(/\$/g, "%24") + "@" : "")  + item.ip + item.path + " " + folder;
                } else if (os.platform() == "linux") {
                    return "mount -t cifs " + ((item.username && item.username.length > 0) ? "-o username=" + item.username + ",password=" + item.password + " " : " ")  + "//" + item.ip + item.path + " " + folder;
                }
            } else {
                if (os.platform() == "darwin") {
                    return "mount -t smbfs //" + ((item.username2 && item.username2.length > 0) ? "" + item.username2 + ":" + encodeURIComponent(item.password2).replace(/!/g, "%21").replace(/@/g, "%40").replace(/\$/g, "%24") + "@" : "")  + item.ip2 + item.path2 + " " + folder;
                } else if (os.platform() == "linux") {
                    return "mount -t cifs " + ((item.username2 && item.username2.length > 0) ? "-o username=" + item.username2 + ",password=" + item.password2 + " " : " ")  + "//" + item.ip2 + item.path2 + " " + folder;
                }
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
            return new Promise((resolve, reject) => {
                let started = false;
                if (apiRequest.data && apiRequest.data.hash) {
                    if (api.configurationAPI.getConfiguration() && api.configurationAPI.getConfiguration().items && api.configurationAPI.getConfiguration().items.length > 0) {
                        api.configurationAPI.getConfiguration().items.forEach((item) => {
                            if (self.hash(item) == apiRequest.data.hash) {
                                self.sync(item);
                                started = true;
                            }
                        });
                    }
                }
                if (started) {
                    resolve(self.api.webAPI.APIResponse(true, {success:true}));
                } else {
                    reject(self.api.webAPI.APIResponse(false, {}, 986041, "No hash found"));
                }
            });
        }
    }

    new Rsync(api);
}

module.exports.attributes = {
    loadedCallback: loaded,
    name: "rsync",
    version: "0.0.0",
    category: "misc",
    description: "Synchronize samba folders with Unison",
    defaultDisabled: true,
    dependencies:[]
};
