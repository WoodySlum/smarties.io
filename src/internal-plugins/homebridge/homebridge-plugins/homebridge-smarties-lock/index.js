/* eslint-disable */
var Service, Characteristic, Api;
const constants = require("./../constants-plugins");

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  Api = homebridge;

  homebridge.registerAccessory("homebridge-smarties-lock", "Smarties lock", SmartiesLockAccessory);
}


function SmartiesLockAccessory(log, config) {
  this.log = log;
  this.service = new Service.LockMechanism(this.name);
  this.coreApi = config.coreApi;
  this.identifier = config.identifier;
  this.status = config.status;
  this.name = config.name;
  this.device = config.device;
  this.deviceTypes = config.deviceTypes;
  this.deviceConstants = config.deviceConstants;

  this.service
    .getCharacteristic(Characteristic.LockCurrentState)
    .on('get', this.handleLockCurrentStateGet.bind(this));

    this.service
      .getCharacteristic(Characteristic.LockTargetState)
      .on('get', this.handleLockTargetStateGet.bind(this))
      .on('set', this.handleLockTargetStateSet.bind(this));

}

  SmartiesLockAccessory.prototype.handleLockCurrentStateGet = function(callback) {
      let called = false;
      const securityProcess = setTimeout(() => {
          called = true;
          callback(null);
      }, constants.TIMER_SECURITY_S);
      let cb = (data) => {
          if (data.device.id == this.device.id) {
              if (data.device.status == this.deviceConstants.INT_STATUS_ON) {
                  Api.removeListener("getDeviceStatusRes", cb);
                  if (!called) callback(null, Characteristic.LockCurrentState.SECURED);
              } else {
                  Api.removeListener("getDeviceStatusRes", cb);
                  if (!called) callback(null, Characteristic.LockCurrentState.UNSECURED);
              }
              clearTimeout(securityProcess);
          }
      };
      Api.on("getDeviceStatusRes", cb);
      Api.emit("getDeviceStatus", this.device);
}


  SmartiesLockAccessory.prototype.handleLockTargetStateGet = function(callback) {
      let called = false;
      const securityProcess = setTimeout(() => {
          called = true;
          callback(null);
      }, constants.TIMER_SECURITY_S);
      let cb = (data) => {
          if (data.device.id == this.device.id) {
              // console.log("=>");
              // console.log(data.device);
              Api.removeListener("getDeviceStatusRes", cb);
              if (data.device.status == this.deviceConstants.INT_STATUS_ON) {
                  if (!called) callback(null, Characteristic.LockCurrentState.SECURED);
              } else {
                  if (!called) callback(null, Characteristic.LockCurrentState.UNSECURED);
              }
              clearTimeout(securityProcess);
          }
      };
      Api.on("getDeviceStatusRes", cb);
      Api.emit("getDeviceStatus", this.device);
  }

  /**
   * Handle requests to set the "Target Door State" characteristic
   */
  SmartiesLockAccessory.prototype.handleLockTargetStateSet = function(state, callback) {
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



SmartiesLockAccessory.prototype.getServices = function() {
  return [this.service];
}
