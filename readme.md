# Installar dependecias 
### Dependencias del servidor
Dentro de la carpeta **server**, escriba el siguiente comando en la terminal para instalar las dependecias necesarias `npm i` o `yarn`.
### Dependencias ESP 
Dentro de la carpeta **client**, abra el archivo **client.ino** y agregue las librerías: **WebSockets by Markus Sattler; SocketIoClient; ArduinoJson**.
En `webSocket.begin("ip", 4200)`, cambie la dirección ip a la ip local de la maquina en cual está corriendo el servidor, el puerto *4200* no debe cambiarlo. 

> El servidor y la ESP 8266 debe estar conectados a la misma red WiFi

### Iniciar Servidor
Para iniciar el servidor en entorno de desarrollo, dentro de la carpeta **server**, en la terminal escriba `npm run dev` o `yarn dev`.
Para iniciarlo en modo de producción, primero hay que hacer una build del codigo `npm run build` o `yarn build`, y luego  `npm run start` o `yarn start`