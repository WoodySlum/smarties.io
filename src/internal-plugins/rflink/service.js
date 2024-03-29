"use strict";

/**
 * Loaded plugin function
 *
 * @param  {PluginAPI} api The core APIs
 */
function loaded(api) {
    var Logger;
    var self = null;

    /**
     * This class conect to RFLink using serial port on a pseicif thread.
     *
     * @class
     */
    class RFLinkService extends api.exported.Service.class {
        /**
         * Constructor
         *
         * @param  {RFLink} plugin The RFLink plugin
         * @returns {RFLinkService}        The instance
         */
        constructor(plugin) {
            super("rflink", null, api.exported.Service.SERVICE_MODE_THREADED);
            this.port = null;
            this.plugin = plugin;
            self = this;
        }

        /**
         * Start the service
         */
        start() {
            super.start();
            this.send("getPorts", {});
            this.send("listen", this.port);
        }

        /**
         * Main threaded loop
         *
         * @param  {object} data    A data passed as initial value
         * @param  {Function} send Send a message to parent process
         */
        run(data, send) {
            process.on("SIGINT", () => {
                process.kill(process.pid, "SIGKILL");
                process.exit(0);
            });

            process.on("SIGTERM", () => {
                process.kill(process.pid, "SIGKILL");
                process.exit(0);
            });

            const TYPE_RADIO = "RADIO";
            const TYPE_VERSION = "VERSION";
            const TYPE_ACK = "ACK";
            const TYPE_OTHER = "OTHER";
            const AUTO_REFRESH_TIMER = 5; // In seconds

            let sclient;
            let sp;
            let processData = (telegram) => {
                var elements = telegram.split(";");
                let version = null;
                let revision = null;
                let type = null;
                const rflinkId = elements[0].toLowerCase();

                // Version
                if ((elements.length > 2 && elements[2].startsWith("Nodo RadioFrequencyLink")) || (elements.length > 3 && elements[3].startsWith("Nodo RadioFrequencyLink")) || (elements.length > 4 && elements[4].startsWith("Nodo RadioFrequencyLink"))) {
                    //20;00;Nodo RadioFrequencyLink - RFLink Gateway V1.1 - R47;
                    let versionFull = "";
                    if (elements.length === 3) {
                        versionFull = elements[1].split("-");
                    } else if (elements.length === 4) {
                        versionFull = elements[2].split("-");
                    } else if (elements.length === 5) {
                        versionFull = elements[3].split("-");
                    }

                    if (versionFull.length === 3) {
                        revision = versionFull[2].trim();
                        version = 0;
                        const mainVersionFull = versionFull[1].split(" V");
                        if (mainVersionFull.length === 2) {
                            version = parseFloat(mainVersionFull[1].trim());
                        }
                        type = TYPE_VERSION;
                    }

                    return {
                        type:type,
                        timestamp: Math.floor((Date.now() / 1000) | 0),
                        raw: telegram,
                        version: version,
                        revision: revision
                    };
                } else if (elements.length > 4) {
                    const commandId = elements[1].toLowerCase();
                    const protocol = elements[2].toLowerCase();
                    type = TYPE_RADIO;

                    if (protocol.indexOf("=") !== -1) {
                        return null;
                    }

                    let deviceId = null;
                    let switchId = null;
                    let sensor = null;
                    let status = null;
                    let value = null;

                    if (elements.length >= 4) {
                        if (elements[3].indexOf("ID=") !== -1) {
                            deviceId = elements[3].split("=")[1].toLowerCase();
                        }
                    }

                    if (elements.length >= 5) {
                        if (elements[4].indexOf("SWITCH=") !== -1) {
                            switchId = elements[4].split("=")[1].toLowerCase();
                        }

                        if (elements[4].indexOf("TEMP=") !== -1) {
                            sensor = "TEMP";
                            value = parseInt(elements[4].split("=")[1]);
                        }

                        if (elements[4].indexOf("HUM=") !== -1) {
                            sensor = "HUM";
                            value = parseInt(elements[4].split("=")[1]);
                        }

                        if (elements[4].indexOf("UV=") !== -1) {
                            sensor = "UV";
                            value = parseInt(elements[4].split("=")[1]);
                        }
                    }

                    if (elements.length >= 6) {
                        if (elements[5].indexOf("CMD=") !== -1) {
                            status = elements[5].split("=")[1];
                        }
                    }

                    return {
                        type:type,
                        rflink_id: rflinkId,
                        sensor_id: commandId,
                        protocol: protocol,
                        code: deviceId,
                        subcode: switchId,
                        status: status,
                        value: value,
                        sensor: sensor,
                        timestamp: Math.floor((Date.now() / 1000) | 0),
                        raw: telegram,
                        version: version,
                        revision: revision
                    };
                } else if (elements.length === 4) {
                    const rflinkId = elements[0].toLowerCase();
                    const commandId = elements[1].toLowerCase();
                    const data = elements[2].toLowerCase();
                    if (data === "ok") {
                        let type = TYPE_ACK;
                        return {
                            type:type,
                            rflink_id: rflinkId,
                            ack_id: commandId,
                            raw: telegram
                        };
                    } else {
                        Logger.warn("Unknown telegram");
                        let type = TYPE_OTHER;
                        return {
                            type:type,
                            timestamp: Math.floor((Date.now() / 1000) | 0),
                            raw: telegram
                        };
                    }
                } else {
                    Logger.warn("Invalid number of lines in telegram (" + telegram.length + ")");

                    let type = TYPE_OTHER;
                    return {
                        type:type,
                        timestamp: Math.floor((Date.now() / 1000) | 0),
                        raw: telegram
                    };
                }
            };

            try {
                const SerialPort = require("serialport");
                const Readline = SerialPort.parsers.Readline;
                var gPort = null;
                var status = 0;

                if (!process.env.TEST) {
                    /*const usbDetect = require("usb-detection");
                    usbDetect.startMonitoring();
                    usbDetect.on("change", () => {
                        Logger.info("USB status changed");
                        if (gPort && gPort != "" && status == 0) {
                            this.listen(gPort);
                        }
                        setTimeout((self) => {
                            self.getPorts();
                        }, 2000, this);

                    });*/
                }

                var autoConnect = () => {
                    if (gPort && gPort != "" && status == 0) {
                        setTimeout((self) => {
                            if (self.plugin) {
                                self.listen(gPort);
                                self.plugin.startRFLinkInLanMode();
                            }
                        }, AUTO_REFRESH_TIMER * 1000, this);
                    }
                };

                this.listen = (port) => {
                    if (port) {
                        gPort = port;
                        Logger.info("Trying to connect RFLink on port " + port);
                        sp = new SerialPort(port, {
                            baudRate: 57600
                        });
                        const parser = new Readline();
                        sclient = sp.pipe(parser);

                        sclient.on("data", function(data) {
                            const line = data.toString("utf8");
                            Logger.verbose("RFLink data received : " + line);
                            const d = processData(line);
                            if (d) {
                                if (d.type === TYPE_RADIO) {
                                    send({method:"rflinkData", data:d});
                                } else if (d.type === TYPE_VERSION) {
                                    send({method:"rflinkVersion", data:d});
                                }  else if (d.type === TYPE_ACK) {
                                    send({method:"rflinkAck", data:d});
                                } else if (d.type === TYPE_OTHER) {
                                    send({method:"rflinkOther", data:d});
                                }
                            }
                        });

                        sp.on("open", function() {
                            Logger.info("RFLink connected, ready to receive data");
                            send({method:"connected", data:{}});
                            // Request version
                            sp.write("10;VERSION\r\n");
                            status = 1;
                        });

                        sp.on("close", function() {
                            Logger.info("RFLink connection closed");
                            send({method:"disconnected", data:{}});
                            status = 0;
                            autoConnect();
                        });

                        sp.on("error", function(err) {
                            Logger.warn("RFLink error : ");
                            Logger.warn(err.message);
                            status = 0;
                            autoConnect();
                        });
                    } else {
                        Logger.info("RFLink empty port. Could not start.");
                        this.getPorts();
                        autoConnect();
                    }
                };



                this.getPorts = () => {
                    const detectedPorts = [];
                    SerialPort.list().then(ports => {
                        ports.forEach(function(port) {
                            detectedPorts.push({endpoint:port.path, manufacturer:port.path});
                        });
                        send({method:"detectedPorts", data:detectedPorts});
                    }).catch((e) => {
                        Logger.err(e.message);
                    });
                };

            } catch(e) {
                Logger.err(e.message);
            }

            this.rflinkSend = (data) => {
                Logger.info("RFLink sending data : " + data);
                if (sp && sp.write) {
                    sp.write(data + "\r\n");
                } else {
                    Logger.err("Could not send RFLink data - serialport is not responding");
                }
            };

            // Logger.warn(JSON.stringify(processData("20;01;Blyss;ID=6968;SWITCH=C4;CMD=ON;")));

            /*setTimeout(() => {
                send(processData("20;01;Blyss;ID=6968;SWITCH=C4;CMD=ON;"));
            }, 3000);

            setTimeout(() => {
                send(processData("20;01;Blyss;ID=6968;SWITCH=C4;CMD=ON;"));
            }, 30000);
            setTimeout(() => {
                send(processData("20;01;Blyss;ID=6968;SWITCH=C4;CMD=ON;"));
            }, 70000);*/
            //send(processData("20;03;Cresta;ID=8301;WINDIR=0005;WINSP=0000;WINGS=0000;WINTMP=00c3;WINCHL=00c3;BAT=LOW;"));
            //send(processData("06;CMD=ON;"));
            //Logger.warn(JSON.stringify(processData("20;03;Cresta;ID=8301;WINDIR=0005;WINSP=0000;WINGS=0000;WINTMP=00c3;WINCHL=00c3;BAT=LOW;")));
            // 20;00;Nodo RadioFrequencyLink - RFLink Gateway V1.1 - R46;
            // 20;01;Blyss;ID=6968;SWITCH=C4;CMD=ON;
            // 20;02;Blyss;ID=6968;SWITCH=C4;CMD=OFF;
            // 20;00;Nodo 20;00;Nodo RadioFrequencyLink - RFLink Gateway V1.1 - R48;
            // setTimeout(() => {
            // setTimeout(() => {
            //     send({method:"rflinkVersion", data:processData("20;00;Nodo 20;Nodo RadioFrequencyLink - RFLink Gateway V1.1 - R46;")});
            // }, 2000);
        }

        /**
         * Retrieve data from process
         * Should be overloaded by service
         *
         * @param  {object} data    A data passed as initial value
         */
        threadCallback(data) {
            if (data.method === "rflinkData") {
                self.plugin.onRflinkReceive(data.data);
            } else if (data.method === "rflinkVersion") {
                self.plugin.onRflinkVersion(data.data.version, data.data.revision, data.data);
            } else if (data.method === "detectedPorts") {
                self.plugin.onDetectedPortsReceive(data.data);
            } else if (data.method === "rflinkAck") {
                self.plugin.onRflinkAck(data.data.ack_id, data.data);
            } else if (data.method === "rflinkOther") {
                self.plugin.onRflinkOther(data.data);
            } else if (data.method === "connected") {
                self.plugin.onConnected();
            } else if (data.method === "disconnected") {
                self.plugin.onDisconnected();
            }
        }
    }

    return RFLinkService;
}

module.exports = loaded;
