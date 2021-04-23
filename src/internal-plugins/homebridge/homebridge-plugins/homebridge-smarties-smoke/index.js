/* eslint-disable */
var Service, Characteristic, Api;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  Api = homebridge;

  homebridge.registerAccessory("homebridge-smarties-smoke", "Smarties smoke sensor", SmartiesSmokeAccessory);
}

function SmartiesSmokeAccessory(log, config) {
  this.log = log;
  this.service = new Service.SmokeSensor(this.name);
  this.identifier = config.identifier;
  this.name = config.name;

  this.service
    .getCharacteristic(Characteristic.SmokeDetected)
    .on('get', this.handleSmokeDetectedGet.bind(this));
}

  SmartiesSmokeAccessory.prototype.handleSmokeDetectedGet = function(callback) {
      let cb = (data) => {
          if (data.sensor == this.identifier) {
              Api.removeListener("getValueRes", cb);
              if (!data.err) {
                  if (data.tValue != null && data.tValue > 0) {
                      callback(null, Characteristic.SmokeDetected.SMOKE_DETECTED);
                  } else {
                      callback(null, Characteristic.SmokeDetected.SMOKE_NOT_DETECTED);
                  }

              } else {
                  callback(Error("Invalid value"));
              }
          }
      };
      Api.on("getValueRes", cb);
      Api.emit("getValue", this.identifier);
}



SmartiesSmokeAccessory.prototype.getServices = function() {
  return [this.service];
}
