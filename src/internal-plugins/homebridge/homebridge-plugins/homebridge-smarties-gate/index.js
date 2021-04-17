/* eslint-disable */
var Service, Characteristic, Api;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  Api = homebridge;

  homebridge.registerAccessory("homebridge-smarties-gate", "Smarties gate", SmartiesGateAccessory);
}
/*
OPEN: 0,
CLOSED: 1,
OPENING: 2,
CLOSING: 3,
STOPPED: 4
*/

function SmartiesGateAccessory(log, config) {
  this.log = log;
  this.service = new Service.GarageDoorOpener(this.name);
  this.coreApi = config.coreApi;
  this.identifier = config.identifier;
  this.status = config.status;
  this.name = config.name;
  this.device = config.device;
  this.deviceTypes = config.deviceTypes;
  this.deviceConstants = config.deviceConstants;

  this.service
    .getCharacteristic(Characteristic.CurrentDoorState)
    .on('get', this.handleCurrentDoorStateGet.bind(this));

    this.service
      .getCharacteristic(Characteristic.TargetDoorState)
      .on('get', this.handleCurrentDoorStateGet.bind(this))
      .on('set', this.handleTargetDoorStateSet.bind(this));

  this.service.getCharacteristic(Characteristic.ObstructionDetected)
    .onGet(this.handleObstructionDetectedGet.bind(this));
}

  SmartiesGateAccessory.prototype.handleCurrentDoorStateGet = function(callback) {
      let cb = (data) => {
          if (data.device.id == this.device.id) {
              Api.removeListener("getDeviceStatusRes", cb);
              callback(null, Characteristic.CurrentDoorState.CLOSED);
          }
      };
      Api.on("getDeviceStatusRes", cb);
      Api.emit("getDeviceStatus", this.device);
}


  SmartiesGateAccessory.prototype.handleTargetDoorStateGet = function(callback) {
      let cb = (data) => {
          if (data.device.id == this.device.id) {
              Api.removeListener("getDeviceStatusRes", cb);
              callback(null, Characteristic.CurrentDoorState.CLOSED);
          }
      };
      Api.on("getDeviceStatusRes", cb);
      Api.emit("getDeviceStatus", this.device);
  }

  /**
   * Handle requests to set the "Target Door State" characteristic
   */
  SmartiesGateAccessory.prototype.handleTargetDoorStateSet = function(state, callback) {
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
          }
      };
      Api.on("getDeviceByIdRes", cb);
      Api.emit("getDeviceById", this.device);
  }

  /**
   * Handle requests to get the current value of the "Obstruction Detected" characteristic
   */
  SmartiesGateAccessory.prototype.handleObstructionDetectedGet = function() {
    const currentValue = 0;
    return currentValue;
  }


SmartiesGateAccessory.prototype.getServices = function() {
  return [this.service];
}
