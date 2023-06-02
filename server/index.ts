import express, { Express } from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import path from 'path'

const app: Express = express()

const server = createServer(app)

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true
    },
    transports: ["websocket", "polling"],
    allowEIO3: true
})

// (future feature): show online and offline nodes 
const db = new Set<string>() 

app.set('port', process.env.PORT || 4200)

app.get('/', (_, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'))
})

io.on('connection', (socket) => {
    console.log('🎉 a user connected')

    socket.emit('ping', 'pong')

    socket.on('node_id', (id: string) => {
        db.add(id)
    })

    socket.emit('data', { data: 'Hello from server' })

    socket.on('data', (data) => {
        console.log(data)
    })

    socket.on('disconnect', () => {
        console.log('user disconnected')
    })
})

app.use(express.static(path.join(__dirname, '../public')))

server.listen(app.get('port'), () => {
    console.log(`⚡️ [server]: Server listening on port: ${app.get('port')}`)
})
