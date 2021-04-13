/* eslint-disable */
var Service, Characteristic, Api;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  Api = homebridge;

  homebridge.registerAccessory("homebridge-smarties-temperature", "Smarties temperature sensor", SmartiesTemperatureAccessory);
}

function SmartiesTemperatureAccessory(log, config) {
  this.log = log;

  this.service = new Service.TemperatureSensor(this.name);

  this.identifier = config.identifier;
  this.name = config.name;

  this.service
    .getCharacteristic(Characteristic.CurrentTemperature)
    .on('get', this.getTemperature.bind(this))
    .setProps({ minValue: -50 , maxValue: 50});
}

SmartiesTemperatureAccessory.prototype.getTemperature = function(callback) {
    let cb = (data) => {
        if (data.sensor == this.identifier) {
            Api.removeListener("getValueRes", cb);
            if (!data.err && data.res) {
                callback(null, parseFloat(data.res.value));
            } else {
                callback(Error("Invalid value"));
            }
        }
    };
    Api.on("getValueRes", cb);
    Api.emit("getValue", this.identifier);
}


SmartiesTemperatureAccessory.prototype.getServices = function() {
  return [this.service];
}
