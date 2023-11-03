# Instalación

## Instalar NodeJS y npm o Docker

Hay dos formas de correr la aplicación:
1. Con NodeJS en la máquina local
    > Es necesario instalar NodeJS y npm para poder correr la aplicación
    Pasos: 
        1 - Descargar el repositorio desde GitHub
        2 - Instalar las dependencias y librerías tanto del cliente como del servidor (Explicado más adelante)
        3 - Definir las variables en cada caso, en el caso del cliente (Dirección Ip del Servidor, Puerto, Nombre del Nodo), en el caso del servidor (Variables de Entorno definidas más adelante)
        4 - Subir código a ESP  
2. En contenedores con Docker
    > Es necesario tener instalado Docker
    Pasos: 
        1 - Descargar el repositorio desde GitHub
        2 - Definir las variables en cada caso, en el caso del cliente (Dirección Ip del Servidor, Puerto, Nombre del Nodo), en el caso del servidor (Variables de Entorno definidas más adelante)
        3 - Correr con la terminal situada dentro de la carpeta **server**, el comando `docker compose up`
        4 - Subir código a ESP  

## Instalar Dependencias

### Dependencias del servidor
Dentro de la carpeta **server**, escriba el siguiente comando en la terminal para instalar las dependecias necesarias `npm i` o `yarn` en caso de ternerlo instalado.
### Dependencias ESP 
Dentro de la carpeta **client**, abra el archivo *client.ino* y agregue las librerías: **WebSockets by Markus Sattler; SocketIoClient; ArduinoJson**.
En `webSocket.begin("ip", 4200)`, cambie la dirección ip a la ip local de la maquina en cual está corriendo el servidor, el puerto *4200* no debe cambiarlo. 

> El servidor y la ESP 8266 debe estar conectados a la misma red WiFi

### Iniciar Servidor sin Docker
Para iniciar el servidor en entorno de desarrollo, dentro de la carpeta **server**, en la terminal escriba `npm run dev` o `yarn dev`.
Para iniciarlo en modo de producción, primero hay que hacer una build del codigo `npm run build` o `yarn build`, y luego  `npm run start` o `yarn start`

# Iniciar Servidor desde Carpeta UTN-FRSF-PROJECT
1. Abrir terminal con `ctrl+ñ` y acceder a la carpeta del servidor con `cd server`
2. Ejecutar `docker compose up` para correr los contenedores (servidor - bases de datos) y ver las direcciones ip de cada contenedor con el comando `docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' nombre_o_id_del_contenedor`
3. Establecer las variables de entorno dentro de el archivo ".env", localizado dentro de la carpeta server

    > Estas variables las utilizará en servidor para conectarse a las bases de datos.

### Variables de Entorno a Establecer
- MYSQL_ROOT_PASSWORD = ''
- MYSQL_DATABASE = ''
- MYSQL_USER = ''
- MYSQL_PASSWORD = ''

- SHADOW_MYSQL_ROOT_PASSWORD = ''
- SHADOW_MYSQL_DATABASE = ''
- SHADOW_MYSQL_USER = ''
- SHADOW_MYSQL_PASSWORD = ''

    > Reemplazar en las URIs (DATABASE_URL & SHADOW_DATABASE_URL), con los valores asignados a cada variable de entorno, por ejemplo: MYSQL_USER = 'hola' => DATABASE_URL = 'mysql://hola:MYSQL_PASSWORD@ip-contenedor:puerto-contenedor/MYSQL_DATABASE'

- DATABASE_URL = 'mysql://MYSQL_USER:MYSQL_PASSWORD@ip-contenedor:puerto-contenedor/MYSQL_DATABASE'
- SHADOW_DATABASE_URL = 'mysql://SHADOW_MYSQL_USER:SHADOW_MYSQL_PASSWORD@ip-contenedor:puerto-contenedor/SHADOW_MYSQL_DATABASE'

    > Los puertos expuestos para los contenedores que instancian bases de datos, asignados dentro del archivo 'docker-compose.yml', son: 3306 (Base de Datos Principal); 3307 (Base de Datos Sombra), osea, para DATABASE_URL *puerto-contenedor* es 3306, y para SHADOW_DATABASE_URL *puerto-contenedor* es 3307

4. Parar los contenedores con `ctrl+c`
5. Levantar los contenedores con `docker compose up --build` 

### Ver tablas en la base de datos

    > Para poder ver las tablas de las bases de datos debe tener NodeJS y npm instalados en la computadora, puede verificar si tiene instalados estos paquetes escribiendo en la terminal `node -v` o `node --version` y `npm -v` o `npm --version`

Con la terminal situada dentro de la carpeta **server** (usuario@raspberrypi:~/Desktop/utn-frsf-project/server $), ejecutar el comando `npx prisma studio`, esto levantará un servidor en el puerto 5555, el cual renderizará una página web en la cual se podrá ver cada tabla de la base de datos principal, y que tiene guardado cada una. 

# Comandos del Servidor
Dentro del archivo *package.json* podemos encontrar los *scripts*, los cuales son los comandos que le pasaremos a la terminal para poder levantar o compilar nuestro servidor. Los *scripts* definidos son los siguientes: start, build, dev. Para poder correr cada comando haremos uso de npm, escribiendo en la terminal `npm run` seguido del script que deseamos ejecutar. En caso de tener yarn instalado podemos ejecutarlos como `yarn` y el script, por ejemplo `yarn build`.

Scripts:
- start: comando utilizado para ejecutar nuestra aplicación en producción. 
- dev: comando utilizado para ejecutar nuestra aplicación en desarrollo. Con este comando, la terminal queda escuchando por cambios mientras ejecuta la aplicación, es decir, cada vez que se haga un cambio en el código, se parará el proceso en el que se encuentra corriendo la aplicación y se volverá a ejecutar una instancia del servidor con los nuevos cambios aplicados. 
- build: comando utilizado para compilar nuestra aplicación de typescript a javascript.  

# Cambios en el Código (Docker)

## Servidor
Cada vez que se hagan cambios en el código del servidor, se debe volver a crear una imagen del servidor. Esto se puede hacer pasandole la etiqueta *--build* en el comando *docker compose*, es decir, escribir en la terminal *docker compose up --build*

## Cliente
Cada vez que se hagan cambios en el código del cliente, se debe volver a compilar en código para subir a ESP