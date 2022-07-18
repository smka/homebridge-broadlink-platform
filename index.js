var Service, Characteristic;
var broadlink = require('broadlinkjs-dw');

const MP = "MP";

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerPlatform("homebridge-broadlink-platform-outlet", "broadlinkPlatformOutlet", broadlinkPlatform);
}

function broadlinkPlatform(log, config, api) {
    this.log = log;
    this.config = config;
    if (api) this.api = api;
}

broadlinkPlatform.prototype = {
    accessories: function (callback) {
        //For each device in cfg, create an accessory!
        var accessories = this.config.accessories;
        var accessoriesList = [];
        var length = accessories ? accessories.length : 0;

        for (var i = 0; i < length; i++) {
            if (accessories[i].type == MP) {
                for (var outlet = 1; outlet <= 4; outlet++) {
                    accessories[i].index = outlet;
                    accessories[i].outletName = "S" + outlet;
                    accessories[i].outletTimer = [];
                    if (accessories[i].timer)
                        if (accessories[i].timer[outlet - 1])
                            accessories[i].outletTimer = accessories[i].timer[outlet - 1];
                    accessories[i].interval = accessories[i].interval || 0;

                    accessoriesList.push(new BroadlinkAccessory(this.log, accessories[i]));
                }
                this.log(`${accessories[i].name} - Created`);
            } else {
                accessoriesList.push(new BroadlinkAccessory(this.log, accessories[i]));
                this.log(`${accessories[i].name} - Created`);
            }
        }
        callback(accessoriesList);
    }
}

function BroadlinkAccessory(log, config) {
    this.log = log;
    this.config = config;
    this.type = config.type || MP; // Expected value MP or SP (default)
    this.outletName = config.outletName || "";
    this.name = (config.name || this.type) + (this.type == MP ? ": " : "") + this.outletName;
    this.index = config.index || 0;
    this.mac = config.mac;
    this.timer = config.outletTimer;
    this.interval = config.interval < 1000 ? 1000 : config.interval;

    // Other value
    this.powered = false;
    this.firstTime = true;
    this.onGetState = false;
    this.onSetState = false;

    if (!this.mac) throw new Error("You must provide a config value for 'mac' address.");

    // MAC string to MAC buffer
    this.mac_buff = function (mac) {
        var mb = new Buffer.alloc(6, 0);
        if (mac) {
            var values = mac.split(':');
            if (!values || values.length != 6) {
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
    getServices: function () {
        var type = this.config.type;
        var services = [];

        this.informationService = new Service.AccessoryInformation();
        this.informationService
            .setCharacteristic(Characteristic.Manufacturer, 'Broadlink');

        this.switchService = new Service.Outlet(this.name);
        this.switchService
            .getCharacteristic(Characteristic.On)
            .on('get', this.getState.bind(this))
            .on('set', this.setState.bind(this));

        this.informationService
            .setCharacteristic(Characteristic.Model, type)
            .setCharacteristic(Characteristic.SerialNumber, '1.0.5');

        services.push(this.switchService, this.informationService);

        // Only update once for MP
        this.updateState();

        return services;
    },

    discover: function (broadlink) {
        try {
            broadlink.discover();
        } catch (error) {
            this.onGetState = false;
            this.onSetState = false;
        }
    },

    // Get MP/SP outlets status
    getState: function (callback) {
        var device = new broadlink();

        this.onGetState = true;
        this.discover(device);
        device.on("deviceReady", (dev) => {
            if (this.mac_buff(this.mac).equals(dev.mac) && !this.onSetState) {
                dev.check_power();
                dev.on(this.type == MP ? "mp_power" : "power", (statuses) => {
                    var status = (this.type == MP ? statuses[this.index - 1] : statuses) ? true : false;

                    dev.exit();
                    this.onGetState = false;

                    if (this.firstTime || this.powered != status) {
                        this.powered = status ? true : false;
                        this.firstTime = false;
                        this.switchService.updateCharacteristic(Characteristic.On, this.powered);
                        this.logState();
                    }
                });
            } else {
                device = null;
                this.onGetState = false;
            }

            device = null;
        });

        callback(null, this.powered);
    },

    // Set MP/SP outlets status
    setState: function (state, callback) {
        var device = new broadlink();
        var checkAgain;

        this.onSetState = true;
        state = state ? true : false;

        this.log(`[${this.name}] 👈`);

        this.discover(device);
        checkAgain = setInterval(() => {
            this.discover(device);
        }, 1000);

        device.on("deviceReady", (dev) => {
            if (this.mac_buff(this.mac).equals(dev.mac)) {
                // Set the power
                this.powered = state;
                if (this.type == MP) dev.set_power(this.index, this.powered);
                else dev.set_power(this.powered);
                this.logState();

                // Check status while making sure state changed
                dev.check_power();
                dev.on(this.type == MP ? "mp_power" : "power", (statuses) => {
                    if (this.mac_buff(this.mac).equals(dev.mac)) {
                        var status = (this.type == MP ? statuses[this.index - 1] : statuses) ? true : false;

                        if (status != state) this.switchService.setCharacteristic(Characteristic.On, this.powered);

                        // Stop the set loop
                        this.onSetState = false;
                    }
                });

                // Stop the loop
                clearInterval(checkAgain);
                dev.exit();
                callback(null);
            }

            device = null;
        });
    },

    // Update outlets status based on the last status
    updateState: function () {
        setInterval(() => {
            if (!this.onGetState && !this.onSetState) this.getState(() => { });
            // this.log(`[${this.name}] - On get: ${this.onGetState}, On set: ${this.onSetState}`)
        }, this.interval);
    },

    logState: function (extra, tail) {
        var message = `${extra ? extra + ": " : ""}${this.bulb(this.powered)} [${this.name}] ${tail ? "-> " + tail : ""}`;

        if (message != this._message) this.log(message);
        this._message = message;
    },

    bulb: function (state) {
        return state ? "🟡" : "⚪️";
    }
}
