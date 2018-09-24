var Zoo = require('Zoo');

Zoo.Thing.on('connected', function() { connected(); });
Zoo.Thing.on('disconnected', function() { disconnected(); });

Zoo.Thing.name = 'Thermometer';
Zoo.Thing.ssid = 'ssid';
Zoo.Thing.pass = 'password';
Zoo.Thing.mqtt = '192.168.1.4';

Zoo.connect();

var dht = require('DHT11').connect(13);
var timer = 0;

function connected() {
  if (timer)
    clearInterval(timer);
  
  timer = setInterval(function() {
    if (!Zoo.is_connected())
      return;
    dht.read(function(d) {
      Zoo.mqtt().publish('temperature/' + Zoo.Thing.name, d.temp);
      Zoo.mqtt().publish('humidity/' + Zoo.Thing.name, d.rh);
    });
  }, 5000);
}

function disconnected() {
  if (timer) {
    clearInterval(timer);
    timer = 0;
  }
}

