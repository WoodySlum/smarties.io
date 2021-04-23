/* eslint-disable */
var Service, Characteristic, Api;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  Api = homebridge;

  homebridge.registerAccessory("homebridge-smarties-light", "Smarties light sensor", SmartiesLightAccessory);
}

function SmartiesLightAccessory(log, config) {
  this.log = log;
  this.service = new Service.LightSensor(this.name);
  this.identifier = config.identifier;
  this.name = config.name;

  this.service
    .getCharacteristic(Characteristic.CurrentAmbientLightLevel)
    .on('get', this.handleCurrentAmbientLightLevelGet.bind(this));
}

  SmartiesLightAccessory.prototype.handleCurrentAmbientLightLevelGet = function(callback) {
      let cb = (data) => {
          if (data.sensor == this.identifier) {
              Api.removeListener("getValueRes", cb);
              if (!data.err) {
                  if (data.res.value == 0) {
                      callback(null, 0.0001);
                  } else {
                      callback(null, data.res.value);
                  }
              } else {
                  callback(Error("Invalid value"));
              }
          }
      };
      Api.on("getValueRes", cb);
      Api.emit("getValue", this.identifier);
}



SmartiesLightAccessory.prototype.getServices = function() {
  return [this.service];
}
