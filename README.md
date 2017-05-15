# homebridge-broadlink-mp

Broadlink SP2/SP3 & MP1 plugin for [Homebridge](https://github.com/nfarina/homebridge/).
Work with SP plugs and MP1 in your local network. I've tested with two SP3 - works great! 


# Installation
0. Config your SP or MP with default e-Control app (for the first time)
1. Install homebridge using: `(sudo) npm install -g homebridge`
2. Install this plugin using: `(sudo) npm install -g homebridge-broadlink-mp`
3. Update your configuration file. See example: `config-sample.json`. (type may be "SP" or "MP" only; remove broadlinkSP accessories if you have it)
4. Now you can turn on/off your SP and MP devices using homebridge, homekit and siri.
