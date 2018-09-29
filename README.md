# Zoo
Simple WIFI and MQTT connector for Espruino, suitable for IoT.

Just set properties of Zoo.Thing object and call Zoo.connect()

Zoo will automatically reconnect if WIFI or MQTT connection is lost. 

Use Zoo.mqtt() object for publish and subscribe.

There two events emits: 
Zoo.Thing.on('connected)
Zoo.Thing.on('disconnected)

