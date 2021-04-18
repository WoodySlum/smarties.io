/* eslint-disable */
var Service, Characteristic, Api;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  Api = homebridge;

  homebridge.registerAccessory("homebridge-smarties-shutter", "Smarties shutter", SmartiesShutterAccessory);
}

function SmartiesShutterAccessory(log, config) {
  this.log = log;
  this.service = new Service.WindowCovering(this.name);
  this.coreApi = config.coreApi;
  this.identifier = config.identifier;
  this.status = config.status;
  this.name = config.name;
  this.device = config.device;
  this.deviceTypes = config.deviceTypes;
  this.deviceConstants = config.deviceConstants;

  this.service
    .getCharacteristic(Characteristic.CurrentPosition)
    .on('get', this.handleCurrentPositionGet.bind(this));

    this.service
      .getCharacteristic(Characteristic.PositionState)
      .on('get', this.handlePositionStateGet.bind(this));

    this.service
      .getCharacteristic(Characteristic.TargetPosition)
      .on('get', this.handleTargetPositionGet.bind(this))
      .on('set', this.handleTargetPositionSet.bind(this));

}

  SmartiesShutterAccessory.prototype.handleCurrentPositionGet = function(callback) {
      let cb = (data) => {
          if (data.device.id == this.device.id) {
              Api.removeListener("getDeviceStatusRes", cb);
              callback(null, 100);
          }
      };
      Api.on("getDeviceStatusRes", cb);
      Api.emit("getDeviceStatus", this.device);
  }

  SmartiesShutterAccessory.prototype.handlePositionStateGet = function(callback) {
      let cb = (data) => {
          if (data.device.id == this.device.id) {
              Api.removeListener("getDeviceStatusRes", cb);
              callback(null, Characteristic.PositionState.STOPPED);
          }
      };
      Api.on("getDeviceStatusRes", cb);
      Api.emit("getDeviceStatus", this.device);
  }

  SmartiesShutterAccessory.prototype.handleTargetPositionGet = function(callback) {
      let cb = (data) => {
          if (data.device.id == this.device.id) {
              Api.removeListener("getDeviceStatusRes", cb);
              callback(null, 100);
          }
      };
      Api.on("getDeviceStatusRes", cb);
      Api.emit("getDeviceStatus", this.device);
  }

  SmartiesShutterAccessory.prototype.handleTargetPositionSet = function(state, callback) {
      let cb = (data) => {
          if (data.device.id == this.device.id) {
              const device = data.device;
              device.status = data.constants.STATUS_OFF;
              if (state >= 80) {
                  device.status = data.constants.STATUS_OPEN;
              } else if (state <= 20) {
                  device.status = data.constants.STATUS_CLOSE;
              } else {
                  device.status = data.constants.STATUS_STOP;
              }

              Api.emit("switchDeviceWithDevice", device);

              Api.removeListener("getDeviceByIdRes", cb);
              callback(null); // success
          }
      };
      Api.on("getDeviceByIdRes", cb);
      Api.emit("getDeviceById", this.device);
  }


SmartiesShutterAccessory.prototype.getServices = function() {
  return [this.service];
}
