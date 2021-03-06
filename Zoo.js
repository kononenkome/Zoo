//simple WIFI - MQTT connector for simple IoT devices based on ESP8266 with Espruino
//(c) 2018 by Mr.Parker
const VERSION = 0.1;

var Thing = { 
  name: '',
  ssid: '',
  pass: '',
  mqtt: '', //address
};

var Options = {
  verbose: true, 
  attempts: 5, //reconnection attempts before reboot  
  connect_timeout: 30, //seconds
  mqtt_ping_interval: 120,  //seconds
  mqtt_ping_timeout: 1000,  //milliseconds
  pin: D12, //output pin for LED indicator. pulse when connection. use D1, D2 etc.
  wifi_blink_interval: 1000, //milliseconds
  mqtt_blink_interval: 100, //milliseconds
}

var Context = {
  wifi_connected: false,
  mqtt_connected: false,
  mqtt_connection_timeout: 0,
  wifi_connection_timeout: 0,
  mqtt: null,
  attempts: 0,
  pin_blink_interval: 0,
  mqtt_ping_interval: 0,
  mqtt_ping_timeout: 0, 
  pinged: false,
};

const NNTP = 'ntp1.stratum2.ru';

var wifi = require('Wifi');

function say(msg) {
	if (Options.verbose)
		console.log(msg);
}

function pin_setup() {
  if (!Options.pin)
    return;
    Options.pin.mode('output');
    Options.pin.reset();
}

function pin_blink(interval) {
  if (!Options.pin)
    return;
  if (Context.pin_blink_interval) {
    clearInterval(Context.pin_blink_interval);
    Context.pin_blink_interval = 0;
  }
    Context.pin_blink_interval = setInterval(function() { Options.pin.toggle(); }, interval); 
}

function pin_noblink() {
  if (!Options.pin)
    return;
  if (Context.pin_blink_interval) {
    clearInterval(Context.pin_blink_interval);
    Context.pin_blink_interval = 0;
  }
  Options.pin.set();  
}

function check_thing() {
  if (!Thing.name.length)
    return false;
  if (!Thing.ssid.length)
    return false;  
  return true;
}

function wifi_connect() {
  if (!check_thing()) {
    say('ERROR: set thing name, ssid etc...');
    return;
  }
  wifi_clear_connection_timeout();
  pin_setup();
  pin_blink(Options.wifi_blink_interval);
  say('connecting to ' + Thing.ssid + ' as ' + Thing.name + '...');
  wifi.setHostname(Thing.name);
  wifi.connect(Thing.ssid, { password: Thing.pass }, wifi_connection_error);
}

function wifi_reconnect() {
 	if (Context.attempts < Options.attempts) {
  		Context.attempts++;
		say('trying to reconnect to ' + Thing.ssid + ' in ' + Options.connect_timeout + 's, ' 
		+ ' attempt ' + Context.attempts + ' of ' + Options.attempts + '...');
	    Context.wifi_connection_timeout = setTimeout(wifi_connect, Options.connect_timeout * 1000);
    } else {
    	say('attempts are over, rebooting...');
    	E.reboot();
    }
}

function wifi_connection_error(err) {
  if (!err)
    return;
  say('cannot connect wifi: ' + err);
  wifi.emit('reconnect');
}

function wifi_clear_connection_timeout() {
  if (Context.wifi_connection_timeout) {
  	clearTimeout(Context.wifi_connection_timeout);
  	Context.wifi_connection_timeout = 0;
  }
}

function wifi_connected() {  
  Context.wifi_connected = true;
  Context.attempts = 0;
  wifi_clear_connection_timeout();
  pin_noblink();
  wifi.stopAP();
  say('wifi connected as ' + wifi.getHostname());
  say(wifi.getIP());
  wifi.setSNTP(NNTP, 3); 
  wifi.emit('wifi');
}

function wifi_disconnected(err) {
  if (!Context.wifi_connected)
    return;  
  Context.wifi_connected = false;
  
  say('wifi disconnected');
  
  if (Context.mqtt)
    Context.mqtt.disconnect();

  Context.attempts = 0;
  wifi.emit('reconnect');
}

function mqtt_pong() {
  if (!Context.wifi_connected)
    return;
  if (!Context.mqtt_connected)
    return;
  if (Context.pinged)
    return;
  Context.pinged = true;	
  mqtt_clear_ping_timeout();  
  say('mqtt pong! ');
}

function mqtt_nopong() {  
  say('mqtt ping timeout, reboot...');
  E.reboot(); //because many memory problems with MQTT reconnect
}

function mqtt_ping() {
  if (!Context.wifi_connected)
    return; 
  say('mqtt ping...');
  Context.pinged = false;   
  Context.mqtt_ping_timeout = setTimeout(mqtt_nopong, Options.mqtt_ping_timeout);
  wifi.ping(Thing.mqtt, mqtt_pong);
}

function mqtt_clear_connection_timeout() {
  if (Context.mqtt_connection_timeout) 
    clearTimeout(Context.mqtt_connection_timeout);
  Context.mqtt_connection_timeout = 0;
}
function mqtt_clear_ping_timeout() {
  if (Context.mqtt_ping_timeout) {
    clearTimeout(Context.mqtt_ping_timeout);
    Context.mqtt_ping_timeout = 0;
  }
}
function mqtt_clear_ping_interval() {
  if (Context.mqtt_ping_interval) {
    clearInterval(Context.mqtt_ping_interval);
    Context.mqtt_ping_interval = 0;
  }
  mqtt_clear_ping_timeout();
}

var mqtt_options = { // ALL OPTIONAL - the defaults are below
  client_id: Thing.name,   // the client ID sent to MQTT - it's a good idea to define your own static one based on `getSerial()` 
  keep_alive: 60,         // keep alive time in seconds
  port: 1883,             // port number
  clean_session: true,
  //  username: "username",   // default is undefined
  //  password: "password",   // default is undefined
  protocol_name: "MQTT",  // or MQIsdp, etc..
  protocol_level: 4,      // protocol level
};    

function mqtt_connect() {
  if (!Context.wifi_connected)
    return;
  
  if (Context.mqtt_connected) {
    say('WARNING: mqtt connect called, but mqtt already connected');
    return;
  }
  
  if (Context.mqtt) {
  	Context.mqtt_connected = false;
  	Context.mqtt.disconnect();
  }
  
  say('connecting to mqtt broker ' + Thing.mqtt + '...');
  
  if (!Context.mqtt) {
    Context.mqtt = require('MQTT').create(Thing.mqtt, mqtt_options);
    Context.mqtt.on('connected', mqtt_connected);
    Context.mqtt.on('disconnected', mqtt_disconnected);
  }

  mqtt_clear_connection_timeout();
  
  Context.mqtt_connection_timeout = setTimeout(function() {
  	if (Context.attempts < Options.attempts) {
  		Context.attempts++;
		say('mqtt connect timeout, trying to reconnect in ' + Options.connect_timeout + 's, ' 
		+ ' attempt ' + Context.attempts + ' of ' + Options.attempts + '...');
    	mqtt_connect();
    } else {
    	say('attempts are over, rebooting...');
    	E.reboot();
    }
  }, Options.connect_timeout * 1000);
  
  pin_blink(Options.mqtt_blink_interval);
  
  Context.mqtt.connect();
}

function mqtt_connected() {
  pin_noblink();  
  mqtt_clear_connection_timeout();
  mqtt_clear_ping_interval(); 
  Context.mqtt_ping_interval = setInterval(mqtt_ping, Options.mqtt_ping_interval * 1000);
  Context.mqtt_connected = true;   
  say('mqtt connected');
  Thing.emit('connected');
}

function mqtt_disconnected() {
  if (!Context.mqtt_connected)
  	return;
  Context.mqtt_connected = false; 
  if (!Context.wifi_connected)
      return;  
  mqtt_clear_ping_interval();  
  Thing.emit('disconnected');      
  say('mqtt_disconnected, trying to reconnect in ' + Options.connect_timeout + 's...');
  mqtt_clear_connection_timeout()  
  setTimeout(mqtt_connect, Options.connect_timeout * 1000);
}

wifi.on('connected', wifi_connected);
wifi.on('disconnected', wifi_disconnected);
wifi.on('reconnect', wifi_reconnect);
wifi.on('wifi', mqtt_connect);

exports.Thing = Thing;
exports.options = Options;
exports.mqtt = function() { return Context.mqtt; };
exports.is_connected = function() { return Context.mqtt_connected; }
exports.connect = wifi_connect;



