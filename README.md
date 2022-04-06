<p align="center">

<img src="https://github.com/homebridge/branding/raw/master/logos/homebridge-wordmark-logo-vertical.png" width="150">

</p>

# Homebridge Broadlink Platform Outlet

Original plugins from [@smka](https://github.com/smka/homebridge-broadlink-platform) to support Broadlink SP2/SP3 & MP1 in [Homebridge](https://github.com/nfarina/homebridge/). Work with SP plugs and MP1 in your local network. The only difference between this and the original plugins are this plugins will display outlet instead of switch icon, I also added Homebridge Config UI X support for configuring your devices. This plugins also will auto update power status, useful for automation.

# Installation
0. Configure your SP or MP device using Broadlink app to connect to your router. Make note of your device MAC address, you'll need later for setting up the plugins.
1. Install Homebridge and Homebridge Config UI X, follow the instruction https://github.com/oznu/homebridge-config-ui-x
2. Search for "Broadlink Outlet" Homebridge Config UI X or install it using: `sudo npm install -g homebridge-broadlink-platform-outlet`
3. Add your device from Plugin's Setting in Homebridge Config UI X.
4. Now you can turn on/off your SP and MP devices using homebridge, homeKit and Siri.

# Configuration

If you prefer to configure your device using config.json, here's the example of configuration:
```
  {
      "accessories": [
          {
              "name": "TV",
              "type": "MP",
              "mac": "23:b1:34:f8:e3:73"
          },
          {
              "name": "Sofa",
              "type": "SP",
              "mac": "32:ba:24:e3:e1:65"
          }
      ],
      "platform": "broadlinkPlatformOutlet"
  }
```
