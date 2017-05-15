var Accessory, Service, Characteristic, UUIDGen;
var broadlink = require('broadlinkjs-sm');
var assign = require('object-assign');

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    HomebridgeAPI = homebridge;
    homebridge.registerPlatform("homebridge-broadlink-mp", "broadlinkMP", broadlinkMP);
}

function broadlinkMP(log, config, api) {
    this.log = log;
    this.config = config;

    if (api) {
        this.api = api;
    }

}

broadlinkMP.prototype = {
    accessories: function(callback) {
        //For each device in cfg, create an accessory!
        var foundAccessories = this.config.accessories;
        var myAccessories = [];

        for (var i = 0; i < foundAccessories.length; i++) {
            if (foundAccessories[i].type == "MP") {
                for (var a = 1; a <= 4; a++) {
                    foundAccessories[i].sname = "s" + a;
                    var accessory = new BroadlinkAccessory(this.log, foundAccessories[i]);
                    myAccessories.push(accessory);
                    this.log('Created ' + accessory.name + ' ' + accessory.sname + ' Accessory');
                }
            } else {
                var accessory = new BroadlinkAccessory(this.log, foundAccessories[i]);
                myAccessories.push(accessory);
                this.log('Created ' + accessory.name + ' Accessory');
            }
        }
        callback(myAccessories);
    }
}

function BroadlinkAccessory(log, config) {
    this.storage = require('node-persist');
    this.log = log;
    this.config = config;
    this.sname = config.sname || "";
    this.name = config.name + this.sname;
    this.type = config.type || "MP";
    this.ip = config.ip;
    this.mac = config.mac;
    this.powered = false;
    

    this.storage.initSync({
        dir: HomebridgeAPI.user.persistPath()
      });
    this.storage.setItem("MP1", [0, [false, false, false, false]]);

    if (!this.ip && !this.mac) throw new Error("You must provide a config value for 'ip' or 'mac'.");

    // MAC string to MAC buffer
    this.mac_buff = function(mac) {
        var mb = new Buffer(6);
        if (mac) {
            var values = mac.split(':');
            if (!values || values.length !== 6) {
                throw new Error('Invalid MAC [' + mac + ']; should follow pattern ##:##:##:##:##:##');
            }
            for (var i = 0; i < values.length; ++i) {
                var tmpByte = parseInt(values[i], 16);
                mb.writeUInt8(tmpByte, i);
            }
        } else {
            //this.log("MAC address emtpy, using IP: " + this.ip);
        }
        return mb;
    }
}

BroadlinkAccessory.prototype = {
    getServices: function() {
        var type = this.config.type;
        var services = [];
        var informationService = new Service.AccessoryInformation();
        informationService
            .setCharacteristic(Characteristic.Manufacturer, 'Broadlink');

        if (type == 'SP') {
            var switchService = new Service.Switch(this.name);
            switchService
                .getCharacteristic(Characteristic.On)
                .on('get', this.getSPState.bind(this))
                .on('set', this.setSPState.bind(this));

            informationService
                .setCharacteristic(Characteristic.Model, 'SP')
                .setCharacteristic(Characteristic.SerialNumber, '1.0');

            services.push(switchService, informationService);

        } else if (type == 'MP') {
            var switchService = new Service.Switch(this.sname);
            switchService
                .getCharacteristic(Characteristic.On)
                .on('get', this.getMPstate.bind(this))
                .on('set', this.setMPstate.bind(this));

            informationService
                .setCharacteristic(Characteristic.Model, 'MP')
                .setCharacteristic(Characteristic.SerialNumber, this.sname);

            services.push(switchService, informationService);

        }

        return services;
    },

    getSPState: function(callback) {
        var self = this;
        var b = new broadlink();
        b.discover();

        b.on("deviceReady", (dev) => {
            if (self.mac_buff(self.mac).equals(dev.mac) || dev.host.address == self.ip) {
                dev.check_power();
                dev.on("power", (pwr) => {
                    self.log(self.name + self.sname + " power is on - " + pwr);
                    dev.exit();
                    if (!pwr) {
                        self.powered = false;
                        return callback(null, false);
                    } else {
                        self.powered = true;
                        return callback(null, true);
                    }
                });
            } else {
                dev.exit();
            }
        });
    },

    setSPState: function(state, callback) {
        var self = this;
        var b = new broadlink();
        b.discover();

        self.log("set SP state: " + state);
        if (state) {
            if (self.powered) {
                return callback(null, true)
            } else {
                b.on("deviceReady", (dev) => {
                    if (self.mac_buff(self.mac).equals(dev.mac) || dev.host.address == self.ip) {
                        self.log("ON!");
                        dev.set_power(true);
                        dev.exit();
                        self.powered = true;
                        return callback(null, true);
                    } else {
                        dev.exit();
                    }
                });
            }
        } else {
            if (self.powered) {
                b.on("deviceReady", (dev) => {
                    if (self.mac_buff(self.mac).equals(dev.mac) || dev.host.address == self.ip) {
                        self.log("OFF!");
                        dev.set_power(false);
                        dev.exit();
                        self.powered = false;
                        return callback(null, false);
                    } else {
                        dev.exit();
                    }
                });
            } else {
                return callback(null, false)
            }
        }
    },

    getMPstate: function(callback) {
        var self = this;
        var b = new broadlink();
        var s_index = self.sname[1];
        var timer = 0;
        for (i=0; i<s_index; i++){
            timer+=800;
        }

        setTimeout(function(){
            var storageData = self.storage.getItem("MP1");
            var socketsStatus = storageData[1];
            var lastCheck = storageData[0];
            var threshold = Date.now() - lastCheck;
            if (threshold > 20000) {
                self.log("checking status for " +self.name);
                b.discover();
                b.on("deviceReady", (dev) => {
                    if (self.mac_buff(self.mac).equals(dev.mac) || dev.host.address == self.ip) {
                        //self.log("check power for " + self.name);
                        //self.log("device type:" + dev.type + " @ " + dev.host.address);
                        dev.check_power();
                        dev.on("mp_power", (status_array) => {
                            self.log(self.name + " power is on - " + status_array[s_index - 1]);
                            dev.exit();
                            self.storage.setItem("MP1", [Date.now(), status_array])
                            if (!status_array[s_index - 1]) {
                                self.powered = false;
                                return callback(null, false);
                            } else {
                                self.powered = true;
                                return callback(null, true);
                            }
                        });

                    } else {
                        dev.exit();
                    }
                });  
            } else {
                self.log("NOT checking status for " +self.name+" - using Persist");
                if (!socketsStatus[s_index - 1]) {
                    self.powered = false;
                    return callback(null, false);
                } else {
                    self.powered = true;
                    return callback(null, true);
                }
            }
        }, timer);
    },

    setMPstate: function(state, callback) {
        var self = this
        var s_index = self.sname[1];
        var b = new broadlink();
        
        self.log("set " + self.sname + " state to " + state);
        if (state) {
            if (self.powered) {
                return callback(null, true);
            } else {
                b.discover();
                b.on("deviceReady", (dev) => {
                    if (self.mac_buff(self.mac).equals(dev.mac) || dev.host.address == self.ip) {
                        self.log(self.sname + " ON!");
                        dev.set_power(s_index, true);
                        dev.exit();
                        self.powered = true;
                        return callback(null, true);
                    } else {
                        dev.exit();
                    }
                });
            }
        } else {
            if (self.powered) {
                b.discover();
                b.on("deviceReady", (dev) => {
                    if (self.mac_buff(self.mac).equals(dev.mac) || dev.host.address == self.ip) {
                        self.log(self.sname + " OFF!");
                        dev.set_power(s_index, false);
                        dev.exit();
                        self.powered = false;
                        return callback(null, false);
                    } else {
                        dev.exit();
                    }
                });
            } else {
                return callback(null, false)
            }
        }
    }

}
