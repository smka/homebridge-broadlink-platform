var Service, Characteristic, UUIDGen;
var broadlink = require('broadlinkjs-sm');

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Accessory = homebridge.hap.Accessory;
    Characteristic = homebridge.hap.Characteristic;
    UUIDGen = homebridge.hap.uuid;
    homebridge.registerAccessory("homebridge-broadlink-mp", "broadlinkMP", broadlinkMP);
}

function broadlinkMP(log, config, api) {
    this.log = log;
    this.ip = config['ip'];
    this.name = config['name'];
    this.mac = config['mac'];
    this.s1_powered = false;
    this.s2_powered = false;
    this.s3_powered = false;
    this.s4_powered = false;

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

broadlinkMP.prototype.getState = function(callback, Snumber) {
    var self = this
    var b = new broadlink();
    b.discover();

    b.on("deviceReady", (dev) => {
        if (self.mac_buff(self.mac).equals(dev.mac) || dev.host.address == self.ip) {
            dev.check_power();
            self.log("checking power for " + Snumber);
            switch(Snumber) {
                case "S1":
                    dev.on("s1_power", (s1) => {
                        self.log("s1 power is on " + s1);
                        self.s1_powered = s1;
                        return callback(null, s1);
                    });
                case "S2":
                    dev.on("s2_power", (s2) => {
                        self.log("s2 power is on " + s2);
                        self.s2_powered = s2;
                        return callback(null, s2);
                    });
                case "S3":
                    dev.on("s3_power", (s3) => {
                        self.log("s3 power is on " + s3);
                        self.s3_powered = s3;
                        return callback(null, s3);
                    });
                case "S4":
                    dev.on("s4_power", (s4) => {
                        self.log("s4 power is on " + s4);
                        self.s4_powered = s4;
                        return callback(null, s4);
                        });
            }

        } else {
            dev.exit();
        }
    });
}
         
broadlinkMP.prototype.setState = function(Snumber, state, callback) {
    var self = this
    self.log("state="+state+"_callback="+callback+"_Snumber="+Snumber)
    var b = new broadlink();
    var socketPowered, Snum;
    b.discover();
    self.log("set " + Snumber + " state to " + state);
    switch(Snumber) {
        case "S1":
            socketPowered = self.s1_powered;
            Snum = 1;
            break;
        case "S2":
            socketPowered = self.s2_powered;
            Snum = 2;
            break;
        case "S3":
            socketPowered = self.s3_powered;
            Snum = 3;
            break;
        case "S4":
            socketPowered = self.s4_powered;
            Snum = 4;
            break;
    }
    if (state) {
        if (socketPowered) {
            return callback(null, true)
        } else {
            b.on("deviceReady", (dev) => {
                if (self.mac_buff(self.mac).equals(dev.mac) || dev.host.address == self.ip) {
                    dev.set_power(Snum, 1);
                    self.log(Snumber + "is ON!");
                    dev.exit();
                    switch(Snumber) {
                        case "S1":
                            self.s1_powered = state;
                            break;
                        case "S2":
                            self.s2_powered = state;
                            break;
                        case "S3":
                            self.s3_powered = state;
                            break;
                        case "S4":
                            self.s4_powered = state;
                            break;
                    }
                    return callback(null, true);
                } else {
                    dev.exit();
                }
            });
        }
    } else {
        if (this.powered) {
            b.on("deviceReady", (dev) => {
                if (self.mac_buff(self.mac).equals(dev.mac) || dev.host.address == self.ip) {
                    self.log(Snumber + "is OFF!");
                    dev.set_power(Snum, 0);
                    dev.exit();
                    switch(Snumber) {
                        case "S1":
                            self.s1_powered = state;
                            break;
                        case "S2":
                            self.s2_powered = state;
                            break;
                        case "S3":
                            self.s3_powered = state;
                            break;
                        case "S4":
                            self.s4_powered = state;
                            break;
                    }
                    return callback(null);
                } else {
                    dev.exit();
                }
            });
        }
    }
}

broadlinkMP.prototype.getServices = function() {
    this.services = [];
    var Snumber;
    for (var i = 1; i < 5; i++) {
        
        Snumber = "S"+i;
        var outletUUID = UUIDGen.generate('hap-nodejs:accessories:' + Snumber);
        var OutletService  = new Accessory(Snumber, outletUUID);
        
        OutletService.username = Snumber;
        OutletService.pincode = "031-45-154";
        OutletService.displayName = Snumber;
        
        OutletService
          .getService(Service.AccessoryInformation)
          .setCharacteristic(Characteristic.Manufacturer, "Broadlink")
          .setCharacteristic(Characteristic.Model, "MP1")
          .setCharacteristic(Characteristic.SerialNumber, Snumber);
        
        OutletService
          .addService(Service.Outlet, Snumber)
          .getCharacteristic(Characteristic.On)
          .on('set', this.setState(Snumber).bind(this));
        
        OutletService
          .getService(Service.Outlet)
          .getCharacteristic(Characteristic.On)
          .on('get', this.getState(Snumber).bind(this));
        
        this.services.push(OutletService);
    }
    return this.services;
}
