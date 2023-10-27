# Levantar Contenedor Docker
    `docker compose up`

# Comando Tailwind 
    `npx tailwindcss -i ./public/globals.css -o ./public/output.css`
    
# Saber Dirección IP Contenedor De Docker 
    `docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' nombre_o_id_del_contenedor`
    en nuestro caso el nombre designado para el contenedor es 'nodes-server'

# Pasos para Poder Correr en Raspberry Pi (En caso de que las tablas no estén creadas o actualizadas en las bases de datos)
    -   instalar nodejs
    -   instalar npm (si no se instaló con nodejs)
    -   iniciar los contenedores que tienen las bases de datos, se puede correr por separado o con `docker compose up`, en caso de que haya cambios `docker compose up --build`
    -   instalar las dependencias del servidor, usando `npm i` o `yarn` en caso de que esté instalado
    -   cambiar las variables de entorno donde las dirección ip de la conexión con la bases de datos sea 'localhost'
    -   hacer una migración en al base de datos para crear las tablas o actualizarlas ejecutando `npx prisma migrate dev`
    -   reiniciar las variables de entorno, ahora las ip de las conexiones deben ser las ip de cada contenedor donde está corriendo una bases de datos