/* eslint-disable */
var Service, Characteristic, Api;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  Api = homebridge;

  homebridge.registerAccessory("homebridge-smarties-leak", "Smarties leak sensor", SmartiesLeakAccessory);
}

function SmartiesLeakAccessory(log, config) {
  this.log = log;
  this.service = new Service.LeakSensor(this.name);
  this.identifier = config.identifier;
  this.name = config.name;

  this.service
    .getCharacteristic(Characteristic.LeakDetected)
    .on('get', this.handleLeakDetectedGet.bind(this));
}

  SmartiesLeakAccessory.prototype.handleLeakDetectedGet = function(callback) {
      let cb = (data) => {
          if (data.sensor == this.identifier) {
              Api.removeListener("getValueRes", cb);
              if (!data.err) {
                  if (data.res.value == 0) {
                      callback(null, Characteristic.LeakDetected.LEAK_NOT_DETECTED);
                  } else {
                      callback(null, Characteristic.LeakDetected.LEAK_DETECTED);
                  }

              } else {
                  callback(Error("Invalid value"));
              }
          }
      };
      Api.on("getValueRes", cb);
      Api.emit("getValue", this.identifier);
}



SmartiesLeakAccessory.prototype.getServices = function() {
  return [this.service];
}
