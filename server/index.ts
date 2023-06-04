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

const db = new Map<string, string>() 

app.set('port', process.env.PORT || 4200)

app.get('/', (_, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'))
})

io.on('connection', (socket) => {
    console.log('🎉 a user connected')
    let socket_id = ''

    socket.emit('ping', 'pong')

    socket.on('node_id', (id: string) => {
        socket_id = id
        db.set(id, 'online')
        console.log(db)
    })
    
    socket.emit('data', { data: 'Hello from server' })
    
    socket.on('data', (data) => {
        console.log(data)
    })
    
    socket.on('disconnect', () => {
        db.set(socket_id, 'offline')
        console.log('user disconnected')
        console.log(db)
    })
})

app.use(express.static(path.join(__dirname, '../public')))

server.listen(app.get('port'), () => {
    console.log(`⚡️ [server]: Server listening on port: ${app.get('port')}`)
})
