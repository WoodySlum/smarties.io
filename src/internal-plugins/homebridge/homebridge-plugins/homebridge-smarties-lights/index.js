/* eslint-disable */
var Service, Characteristic, Api;
const colorutil = require("color-util");
const constants = require("./../constants-plugins");

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
    let called = false;
    const securityProcess = setTimeout(() => {
        called = true;
        callback(null);
    }, constants.TIMER_SECURITY_S);
    let cb = (data) => {
        if (data.device.id == this.device.id) {
            Api.removeListener("getDeviceStatusRes", cb);
            if (!called) callback(null, data.status);
            clearTimeout(securityProcess);
        }
    };
    Api.on("getDeviceStatusRes", cb);
    Api.emit("getDeviceStatus", this.device);
}

SmartiesAccessory.prototype.setState = function(state, callback) {
    let called = false;
    const securityProcess = setTimeout(() => {
        called = true;
        callback(null);
    }, constants.TIMER_SECURITY_S);
    let cb = (data) => {
        if (data.device.id == this.device.id) {
            const device = data.device;
            device.status = data.constants.STATUS_OFF;
            if (state) {
                device.status = data.constants.STATUS_ON;
            }

            Api.emit("switchDeviceWithDevice", device);

            Api.removeListener("getDeviceByIdRes", cb);
            if (!called) callback(null); // success
            clearTimeout(securityProcess);
        }
    };
    Api.on("getDeviceByIdRes", cb);
    Api.emit("getDeviceById", this.device);
}

SmartiesAccessory.prototype.getBrightness = function(callback) {
    let called = false;
    const securityProcess = setTimeout(() => {
        called = true;
        callback(null);
    }, constants.TIMER_SECURITY_S);
    let cb = (data) => {
        if (data.device.id == this.device.id) {
            const device = data.device;
            Api.removeListener("getDeviceByIdRes", cb);
            if (device && device.brightness) {
                if (!called) callback(null, (device.brightness * 100));
            } else {
                if (!called) callback(null, 100);
            }
            clearTimeout(securityProcess);
        }
    };
    Api.on("getDeviceByIdRes", cb);
    Api.emit("getDeviceById", this.device);
}

SmartiesAccessory.prototype.setBrightness = function(brightness, callback) {
    let called = false;
    const securityProcess = setTimeout(() => {
        called = true;
        callback(null);
    }, constants.TIMER_SECURITY_S);
    let cb = (data) => {
        if (data.device.id == this.device.id) {
            const device = data.device;
            device.brightness = parseFloat(brightness / 100);

            Api.emit("switchDeviceWithDevice", device);

            Api.removeListener("getDeviceByIdRes", cb);
            if (!called) callback(null); // success
            clearTimeout(securityProcess);
        }
    };
    Api.on("getDeviceByIdRes", cb);
    Api.emit("getDeviceById", this.device);
}

SmartiesAccessory.prototype.getHue = function(callback) {
    let called = false;
    const securityProcess = setTimeout(() => {
        called = true;
        callback(null);
    }, constants.TIMER_SECURITY_S);
    let cb = (data) => {
        if (data.device.id == this.device.id) {
            const device = data.device;
            Api.removeListener("getDeviceByIdRes", cb);
            if (device.color) {
                const rgbColor = colorutil.hex.to.rgb("#" + device.color);
                const hsvColor = colorutil.rgb.to.hsv(rgbColor);
                if (!called) callback(null, parseInt(hsvColor.h * 360));
            } else {
                if (!called) callback(null);
            }
            clearTimeout(securityProcess);
        }
    };
    Api.on("getDeviceByIdRes", cb);
    Api.emit("getDeviceById", this.device);
}

SmartiesAccessory.prototype.setHue = function(hue, callback) {
    let called = false;
    const securityProcess = setTimeout(() => {
        called = true;
        callback(null);
    }, constants.TIMER_SECURITY_S);
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
            if (!called) callback(null); // success
            clearTimeout(securityProcess);
        }
    };
    Api.on("getDeviceByIdRes", cb);
    Api.emit("getDeviceById", this.device);
}

SmartiesAccessory.prototype.getSaturation = function(callback) {
    let called = false;
    const securityProcess = setTimeout(() => {
        called = true;
        callback(null);
    }, constants.TIMER_SECURITY_S);
    let cb = (data) => {
        if (data.device.id == this.device.id) {
            const device = data.device;
            Api.removeListener("getDeviceByIdRes", cb);
            if (device.color) {
                const rgbColor = colorutil.hex.to.rgb("#" + device.color);
                const hsvColor = colorutil.rgb.to.hsv(rgbColor);
                if (!called) callback(null, parseInt(hsvColor.s * 100));
            } else {
                if (!called) callback(null);
            }
            clearTimeout(securityProcess);
        }
    };
    Api.on("getDeviceByIdRes", cb);
    Api.emit("getDeviceById", this.device);
}

SmartiesAccessory.prototype.setSaturation = function(sat, callback) {
    let called = false;
    const securityProcess = setTimeout(() => {
        called = true;
        callback(null);
    }, constants.TIMER_SECURITY_S);
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
            if (!called) callback(null); // success
            clearTimeout(securityProcess);
        }
    };
    Api.on("getDeviceByIdRes", cb);
    Api.emit("getDeviceById", this.device);
}

SmartiesAccessory.prototype.getServices = function() {
  return [this.service];
}
