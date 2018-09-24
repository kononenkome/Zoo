//simple WIFI - MQTT connector for simple IoT devices based on ESP8266 with Espruino
//(c) 2018 by Mr.Parker
const VERSION = 0.1;

var Thing = {
  name: '',
  ssid: '',
  pass: '',
  mqtt: '', //address
  connect_timeout: 60, //seconds
  ping_interval: 120,  //seconds
  verbose: true, 
  attempts: 5, //reconnection attempts before reboot
  nntp: 'ntp1.stratum2.ru'; //NNTP server
};

var Context = {
  wifi_connected: false,
  mqtt_connected: false,
  mqtt_connection_timeout: 0,
  wifi_connection_timeout: 0,
  mqtt: null,
  attempts: 0,
};

var wifi = require('Wifi');

function say(msg) {
	if (Thing.verbose)
		console.log(msg);
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
  say('connecting to ' + Thing.ssid + ' as ' + Thing.name + '...');
  wifi.setHostname(Thing.name);
  wifi.connect(Thing.ssid, { password: Thing.pass }, wifi_connection_error);
}

function wifi_reconnect() {
 	if (Context.attempts < Thing.attempts) {
  		Context.attempts++;
		say('trying to reconnect to ' + Thing.ssid + ' in ' + Thing.connect_timeout + 's, ' 
		+ ' attempt ' + Context.attempts + ' of ' + Thing.attempts + '...');
	    Context.wifi_connection_timeout = setTimeout(wifi_connect, Thing.connect_timeout * 1000);
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

function clear_mqtt_connection_timeout() {
  if (Context.mqtt_connection_timeout) 
    clearTimeout(Context.mqtt_connection_timeout);
  Context.mqtt_connection_timeout = 0;
}

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
  
  clear_mqtt_connection_timeout();
  
  let options = { // ALL OPTIONAL - the defaults are below
    client_id: Thing.name,   // the client ID sent to MQTT - it's a good idea to define your own static one based on `getSerial()` 
    keep_alive: 60,         // keep alive time in seconds
    port: 1883,             // port number
    clean_session: true,
    //  username: "username",   // default is undefined
    //  password: "password",   // default is undefined
    protocol_name: "MQTT",  // or MQIsdp, etc..
    protocol_level: 4,      // protocol level
  };    

  if (!Context.mqtt) {
    Context.mqtt = require("MQTT").create(Thing.mqtt, options);
    Context.mqtt.on('connected', function() { mqtt_connected(); });
    Context.mqtt.on('disconnected', function() { mqtt_disconnected(); });
  }
  
  Context.mqtt_connection_timeout = setTimeout(function() {
  	if (Context.attempts < Thing.attempts) {
  		Context.attempts++;
		say('mqtt connect timeout, trying to reconnect in ' + Thing.connect_timeout + 's, ' 
		+ ' attempt ' + Context.attempts + ' of ' + Thing.attempts + '...');
    	mqtt_connect();
    } else {
    	say('attempts are over, rebooting...');
    	E.reboot();
    }
  }, Thing.connect_timeout * 1000);
  
  Context.mqtt.connect();
}

function mqtt_connected() {
  clear_mqtt_connection_timeout();
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
  Thing.emit('disconnected');      
  say('mqtt_disconnected, trying to reconnect in ' + Thing.connect_timeout + 's...');
  setTimeout(mqtt_connect, Thing.connect_timeout * 1000);
}

wifi.on('connected', wifi_connected);
wifi.on('disconnected', wifi_disconnected);
wifi.on('reconnect', wifi_reconnect);
wifi.on('wifi', mqtt_connect);

exports.Thing = Thing;
exports.mqtt = function() { return Context.mqtt; };
exports.is_connected = function() { return Context.mqtt_connected; }
exports.connect = wifi_connect;
