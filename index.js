var Service, Characteristic;
var broadlink = require('broadlinkjs-dw');

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerPlatform("homebridge-broadlink-platform-outlet", "broadlinkPlatformOutlet", broadlinkPlatform);
}

function broadlinkPlatform(log, config, api) {
    this.log = log;
    this.config = config;

    if (api) {
        this.api = api;
    }
}

broadlinkPlatform.prototype = {
    accessories: function(callback) {
        //For each device in cfg, create an accessory!
        var foundAccessories = this.config.accessories;
        var myAccessories = [];

        for (var i = 0; i < foundAccessories.length; i++) {
            if (foundAccessories[i].type == "MP") {
                for (var a = 1; a <= 4; a++) {
                    foundAccessories[i].sname = "S" + a;
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
    this.log = log;
    this.config = config;
    this.sname = config.sname || "";
    this.name = config.name + this.sname;
    this.type = config.type || "MP";
    this.ip = config.ip;
    this.mac = config.mac;
    this.powered = false;
    this.first_time = true;
    this.local_ip_address = config.local_ip_address;

    if (!this.ip && !this.mac) throw new Error("You must provide a config value for 'ip' or 'mac'.");

    // MAC string to MAC buffer
    this.mac_buff = function(mac) {
        var mb = new Buffer.alloc(6,0);
        if (mac) {
            var values = mac.split(':');
            if (!values || values.length !== 6) {
                throw new Error('Invalid MAC [' + mac + ']; should follow pattern ##:##:##:##:##:##');
            }
            for (var i = 0; i < values.length; ++i) {
                var tmpByte = parseInt(values[i], 16);
                mb.writeUInt8(tmpByte, i);
            }
        }

        return mb;
    }
}

BroadlinkAccessory.prototype = {
    getServices: function() {
        var type = this.config.type;
        var services = [];

        this.informationService = new Service.AccessoryInformation();
        this.informationService
            .setCharacteristic(Characteristic.Manufacturer, 'Broadlink');

        if (type == 'SP') {
            this.switchService = new Service.Outlet(this.name);
            this.switchService
                .getCharacteristic(Characteristic.On)
                .on('get', this.getSPState.bind(this))
                .on('set', this.setSPState.bind(this));

            this.switchService
                .getCharacteristic(Characteristic.OutletInUse)
                .on('get', this.getSPState.bind(this));

            this.informationService
                .setCharacteristic(Characteristic.Model, 'SP')
                .setCharacteristic(Characteristic.SerialNumber, '1.0');

            services.push(this.switchService, this.informationService);
        } else if (type == 'MP') {
            this.switchService = new Service.Outlet(this.sname);
            this.switchService
                .getCharacteristic(Characteristic.On)
                .on('get', this.getMPstate.bind(this))
                .on('set', this.setMPstate.bind(this));

            this.switchService
                .getCharacteristic(Characteristic.OutletInUse)
                .on('get', this.getMPstate.bind(this));

            this.informationService
                .setCharacteristic(Characteristic.Model, 'MP')
                .setCharacteristic(Characteristic.SerialNumber, this.sname);

            services.push(this.switchService, this.informationService);
        }

        return services;
    },

    // b: broadlink
    discover: function(b) {
        b.discover(this.local_ip_address);
    },

    getSPState: function(callback) {
        var self = this;
        var b = new broadlink();
        var checkAgain;

        self.discover(b);
        checkAgain = setInterval(function() {
            self.discover(b);
        }, 1000);

        b.on("deviceReady", (dev) => {
            if (self.mac_buff(self.mac).equals(dev.mac) || dev.host.address == self.ip) {
                dev.check_power();
                dev.on("power", (pwr) => {
                    dev.exit();

                    if(self.first_time || self.powered !== pwr) {
                        self.first_time = false;
                        self.powered = pwr? true: false;
                        self.switchService.setCharacteristic(Characteristic.On, self.powered);

                        self.log(self.name + " " + self.sname + " is: " + (self.powered? "ON": "OFF"));
                    }

                    clearInterval(checkAgain)
                });
            } else {
                dev.exit();
            }
        });

        callback(null, self.powered);
    },

    setSPState: function(state, callback) {
        var self = this;
        var s_index = self.sname[1];
        var b = new broadlink();
        var checkAgain;

        if (state !== self.powered) {
            self.discover(b);

            checkAgain = setInterval(function() {
                self.discover(b);
            }, 1000);
        }

        b.on("deviceReady", (dev) => {
            if (self.mac_buff(self.mac).equals(dev.mac) || dev.host.address == self.ip) {
                self.powered = state;

                dev.set_power(self.powered);

                self.log(self.name + " is: " + (self.powered? "ON": "OFF"));
                clearInterval(checkAgain);
            }

            dev.exit();
        });

        callback(null);
    },

    getMPstate: function(callback) {
        var self = this;
        var b = new broadlink();
        var s_index = self.sname[1];
        var checkAgain;

        self.discover(b);
        checkAgain = setInterval(function() {
            self.discover(b);
        }, 1000);

        b.on("deviceReady", (dev) => {
            if (self.mac_buff(self.mac).equals(dev.mac) || dev.host.address == self.ip) {
                dev.check_power();

                dev.on("mp_power", (status_array) => {
                    dev.exit();

                    if(self.first_time || self.powered !== status_array[s_index - 1]) {
                        self.first_time = false;
                        self.powered = status_array[s_index - 1]? true: false;
                        self.switchService.setCharacteristic(Characteristic.On, self.powered);

                        self.log(self.name + " is: " + (self.powered? "ON": "OFF"));
                    }

                    clearInterval(checkAgain);
                });
            } else {
                dev.exit();
            }
        });

        callback(null, self.powered);
    },

    setMPstate: function(state, callback) {
        var self = this;
        var s_index = self.sname[1];
        var b = new broadlink();
        var checkAgain;

        if (state !== self.powered) {
            self.discover(b);

            checkAgain = setInterval(function() {
                self.discover(b);
            }, 1000);
        }

        b.on("deviceReady", (dev) => {
            if (self.mac_buff(self.mac).equals(dev.mac) || dev.host.address == self.ip) {
                self.powered = state;

                dev.set_power(s_index, self.powered);

                self.log(self.name + " is: " + (self.powered? "ON": "OFF"));
                clearInterval(checkAgain);
            }

            dev.exit();
        });

        callback(null);
    }
}
