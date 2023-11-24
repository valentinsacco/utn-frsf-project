import express, { Express } from 'express'
import { createServer } from 'http'
import { engine } from 'express-handlebars'
import path from 'path'

import router from './routes'

import { websockets } from './lib/websockets'

const app: Express = express()

const server = createServer(app)

app.set('port', process.env.PORT || 4200)
app.engine('hbs', engine({ extname: '.hbs', defaultLayout: 'main' }))
app.set('view engine', 'hbs')
app.set('views', './pages')

websockets(server)

app.use(express.json())
app.use(express.urlencoded({ extended: false }))

app.use(router)

app.use(express.static(path.join(__dirname, '../public')))

server.listen(app.get('port'), () => {
    console.log(`⚡️ [server]: Server listening on port: ${app.get('port')}`)
})
