var Service, Characteristic;
var broadlink = require('broadlinkjs-dw');

const MP = "MP";

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerPlatform("homebridge-broadlink-platform-outlet", "broadlinkPlatformOutlet", broadlinkPlatform);
}

class broadlinkPlatform {
    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        if (api)
            this.api = api;
    }
    accessories(callback) {
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

                    accessoriesList.push(new broadlinkAccessory(this.log, accessories[i]));
                }
                this.log(`${accessories[i].name} - Created`);
            } else {
                accessoriesList.push(new broadlinkAccessory(this.log, accessories[i]));
                this.log(`${accessories[i].name} - Created`);
            }
        }
        callback(accessoriesList);
    }
}

class broadlinkAccessory {
    constructor(log, config) {
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
        this.device = null;

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
        };
    }

    getServices() {
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
    }

    discover(broadlink) {
        try {
            broadlink.discover();
        } catch (error) {
            this.onGetState = false;
            this.onSetState = false;
        }
    }

    // Get device
    async _getDevice() {
        return new Promise(async (resolve) => {
            var device = new broadlink();
            var checkAgain;

            // Find device
            this.discover(device);
            checkAgain = setInterval(() => {
                this.discover(device);
            }, 1000);

            // Device is ready
            device.on("deviceReady", (dev) => {
                if (this.mac_buff(this.mac).equals(dev.mac)) {
                    clearInterval(checkAgain);
                    device = null;

                    // return the device
                    resolve(dev);
                }
            });
        });
    }

    // Initiialized device
    async _initDevice() {
        this.device = await this._getDevice();

        // When recived power
        this.device.on(this.type == MP ? "mp_power" : "power", (statuses) => {
            var status = (this.type == MP ? statuses[this.index - 1] : statuses) ? true : false;

            if (this.firstTime || this.powered != status) {
                if (this.firstTime) this.firstTime = false;

                this.powered = status ? true : false;
                this.switchService.updateCharacteristic(Characteristic.On, this.powered);

                this.logState();
            }

            this.onGetState = false;
        });
    }

    // Get MP/SP outlets status
    async getState(callback) {
        callback(null, this.powered);
    }

    // Set MP/SP outlets status
    async setState(state, callback) {
        // Initialized device if it get disconnected
        if (!this.device) await this._initDevice();

        // Log state
        this.log(`[${this.name}] 👈`);

        // Set the power
        this.powered = state ? true : false;
        if (this.type == MP) this.device.set_power(this.index, this.powered);
        else this.device.set_power(this.powered);
        this.switchService.updateCharacteristic(Characteristic.On, this.powered);

        // Log state
        this.logState();

        // Send check power command
        this.device.check_power();

        // Callback;
        callback(null);
    }

    // Update outlets status based on the last status
    async updateState() {
        // Send check power command and loop it
        if (this.mainInterval) clearInterval(this.mainInterval);
        this.mainInterval = setInterval(async () => {
            this.onGetState = true;

            // Initialized device if it get disconnected
            if (!this.device) await this._initDevice();

            // Send check power command
            this.device.check_power();
        }, this.interval);
    }

    logState(extra, tail) {
        var message = `${extra ? extra + ": " : ""}${this.bulb(this.powered)} [${this.name}] ${tail ? "-> " + tail : ""}`;

        if (message != this._message) this.log(message);
        this._message = message;
    }

    bulb(state) {
        return state ? "🟡" : "⚪️";
    }
}
