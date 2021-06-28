/* eslint-disable */
var Service, Characteristic, Api;
const colorutil = require("color-util");

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  Api = homebridge;

  homebridge.registerAccessory("homebridge-smarties-lights", "Smarties lights", SmartiesAccessory);
}

function SmartiesAccessory(log, config) {
  this.log = log;

  this.service = new Service.Lightbulb(this.name);
  this.coreApi = config.coreApi;
  this.identifier = config.identifier;
  this.status = config.status;
  this.name = config.name;
  this.device = config.device;
  this.deviceTypes = config.deviceTypes;
  this.deviceConstants = config.deviceConstants;

  this.service
    .getCharacteristic(Characteristic.On)
    .on('get', this.getState.bind(this))
    .on('set', this.setState.bind(this));

  const deviceTypes = this.deviceTypes;
  const deviceConstants = this.deviceConstants;

  if (deviceTypes.indexOf(deviceConstants.DEVICE_TYPE_LIGHT_DIMMABLE) >= 0 || deviceTypes.indexOf(deviceConstants.DEVICE_TYPE_LIGHT_DIMMABLE_COLOR) >= 0) {
      this.service
        .getCharacteristic(Characteristic.Brightness)
        .on('get', this.getBrightness.bind(this))
        .on('set', this.setBrightness.bind(this));
  }

  if (deviceTypes.indexOf(deviceConstants.DEVICE_TYPE_LIGHT_DIMMABLE_COLOR) >= 0) {
      this.service
        .getCharacteristic(Characteristic.Hue)
        .on('get', this.getHue.bind(this))
        .on('set', this.setHue.bind(this));

        this.service
          .getCharacteristic(Characteristic.Saturation)
          .on('get', this.getSaturation.bind(this))
          .on('set', this.setSaturation.bind(this));
  }
}

SmartiesAccessory.prototype.getState = function(callback) {
    const securityProcess = setTimeout(() => {
        callback(null);
    }, 1000);
    let cb = (data) => {
        if (data.device.id == this.device.id) {
            Api.removeListener("getDeviceStatusRes", cb);
            callback(null, data.status);
            clearTimeout(securityProcess);
        }
    };
    Api.on("getDeviceStatusRes", cb);
    Api.emit("getDeviceStatus", this.device);
}

SmartiesAccessory.prototype.setState = function(state, callback) {
    const securityProcess = setTimeout(() => {
        callback(null);
    }, 1000);
    let cb = (data) => {
        if (data.device.id == this.device.id) {
            const device = data.device;
            device.status = data.constants.STATUS_OFF;
            if (state) {
                device.status = data.constants.STATUS_ON;
            }

            Api.emit("switchDeviceWithDevice", device);

            Api.removeListener("getDeviceByIdRes", cb);
            callback(null); // success
            clearTimeout(securityProcess);
        }
    };
    Api.on("getDeviceByIdRes", cb);
    Api.emit("getDeviceById", this.device);
}

SmartiesAccessory.prototype.getBrightness = function(callback) {
    const securityProcess = setTimeout(() => {
        callback(null);
    }, 1000);
    let cb = (data) => {
        if (data.device.id == this.device.id) {
            const device = data.device;
            Api.removeListener("getDeviceByIdRes", cb);
            if (device && device.brightness) {
                callback(null, (device.brightness * 100));
            } else {
                callback(null, 100);
            }
            clearTimeout(securityProcess);
        }
    };
    Api.on("getDeviceByIdRes", cb);
    Api.emit("getDeviceById", this.device);
}

SmartiesAccessory.prototype.setBrightness = function(brightness, callback) {
    const securityProcess = setTimeout(() => {
        callback(null);
    }, 1000);
    let cb = (data) => {
        if (data.device.id == this.device.id) {
            const device = data.device;
            device.brightness = parseFloat(brightness / 100);

            Api.emit("switchDeviceWithDevice", device);

            Api.removeListener("getDeviceByIdRes", cb);
            callback(null); // success
            clearTimeout(securityProcess);
        }
    };
    Api.on("getDeviceByIdRes", cb);
    Api.emit("getDeviceById", this.device);
}

SmartiesAccessory.prototype.getHue = function(callback) {
    const securityProcess = setTimeout(() => {
        callback(null);
    }, 1000);
    let cb = (data) => {
        if (data.device.id == this.device.id) {
            const device = data.device;
            Api.removeListener("getDeviceByIdRes", cb);
            if (device.color) {
                const rgbColor = colorutil.hex.to.rgb("#" + device.color);
                const hsvColor = colorutil.rgb.to.hsv(rgbColor);
                callback(null, parseInt(hsvColor.h * 360));
            } else {
                callback(null);
            }
            clearTimeout(securityProcess);
        }
    };
    Api.on("getDeviceByIdRes", cb);
    Api.emit("getDeviceById", this.device);
}

SmartiesAccessory.prototype.setHue = function(hue, callback) {
    const securityProcess = setTimeout(() => {
        callback(null);
    }, 1000);
    let cb = (data) => {
        if (data.device.id == this.device.id) {
            const device = data.device;
            let rgbColor = colorutil.hex.to.rgb("#" + device.color);
            if (rgbColor) {
                const hsvColor = colorutil.rgb.to.hsv(rgbColor);
                hsvColor.h = parseFloat(hue / 360);
                rgbColor = colorutil.hsv.to.rgb(hsvColor);
                if (rgbColor) {
                    device.color = colorutil.rgb.to.hex(rgbColor).replace("#", "");
                    Api.emit("switchDeviceWithDevice", device);
                }
            }
            Api.removeListener("getDeviceByIdRes", cb);
            callback(null); // success
            clearTimeout(securityProcess);
        }
    };
    Api.on("getDeviceByIdRes", cb);
    Api.emit("getDeviceById", this.device);
}

SmartiesAccessory.prototype.getSaturation = function(callback) {
    const securityProcess = setTimeout(() => {
        callback(null);
    }, 1000);
    let cb = (data) => {
        if (data.device.id == this.device.id) {
            const device = data.device;
            Api.removeListener("getDeviceByIdRes", cb);
            if (device.color) {
                const rgbColor = colorutil.hex.to.rgb("#" + device.color);
                const hsvColor = colorutil.rgb.to.hsv(rgbColor);
                callback(null, parseInt(hsvColor.s * 100));
            } else {
                callback(null);
            }
            clearTimeout(securityProcess);
        }
    };
    Api.on("getDeviceByIdRes", cb);
    Api.emit("getDeviceById", this.device);
}

SmartiesAccessory.prototype.setSaturation = function(sat, callback) {
    const securityProcess = setTimeout(() => {
        callback(null);
    }, 1000);
    let cb = (data) => {
        if (data.device.id == this.device.id) {
            const device = data.device;
            let rgbColor = colorutil.hex.to.rgb("#" + device.color);
            if (rgbColor) {
                const hsvColor = colorutil.rgb.to.hsv(rgbColor);
                hsvColor.s = parseFloat(sat / 100);
                rgbColor = colorutil.hsv.to.rgb(hsvColor);
                if (rgbColor) {
                    device.color = colorutil.rgb.to.hex(rgbColor).replace("#", "");
                    Api.emit("switchDeviceWithDevice", device);
                }
            }
            Api.removeListener("getDeviceByIdRes", cb);
            callback(null); // success
            clearTimeout(securityProcess);
        }
    };
    Api.on("getDeviceByIdRes", cb);
    Api.emit("getDeviceById", this.device);
}

SmartiesAccessory.prototype.getServices = function() {
  return [this.service];
}
