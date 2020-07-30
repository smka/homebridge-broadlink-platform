<p align="center">

<img src="https://github.com/homebridge/branding/raw/master/logos/homebridge-wordmark-logo-vertical.png" width="150">

</p>

# Homebridge Broadling Platform Outlet

Original plugins from [@smka](https://github.com/smka/homebridge-broadlink-platform) to support Broadlink SP2/SP3 & MP1 in [Homebridge](https://github.com/nfarina/homebridge/). Work with SP plugs and MP1 in your local network. The only difference between this and the original plugins are this plugins will display outlet instead of switch icon, I also added Homebridge Config UI X support for configuring your devices.

# Installation
0. Config your SP or MP devices with default Broadlink / e-Control app (for the first time)
1. Install homebridge using: `(sudo) npm install -g homebridge`
2. Install this plugin using: `(sudo) npm install -g homebridge-broadlink-platform-outlet`
3. Update your configuration file. See example: `config-sample.json`. (type may be "SP" or "MP" only) or you can use Homebridge Config UI X to configure your devices.
4. Now you can turn on/off your SP and MP devices using homebridge, homeKit and Siri.
