# Levantar Contenedor Docker
    `docker compose up`

# Comando Tailwind 
    `npx tailwindcss -i ./public/globals.css -o ./public/output.css`

# Saber Dirección IP Contenedor De Docker 
    `docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' nombre_o_id_del_contenedor`
    en nuestro caso el nombre designado para el contenedor es 'server'