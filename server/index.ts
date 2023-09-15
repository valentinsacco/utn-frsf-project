import express, { Express } from 'express'
import { createServer } from 'http'
import WebSocket, { Server, OPEN } from 'ws'
import { engine } from 'express-handlebars'
import path from 'path'

const app: Express = express()

const server = createServer(app)

const ws = new Server({ server, clientTracking: true })

enum NodeState {
    ONLINE = 'online',
    OFFLINE = 'offline',
    UNKNOWN = 'unknown'
}

enum SocketType {
    NODE = 'node',
    CLIENT = 'client'
}

interface CustomWebSocket extends WebSocket {
    socket_id: string
}

const db = new Map<string, NodeState>()

app.set('port', process.env.PORT || 4200)
app.engine('hbs', engine({ extname: '.hbs', defaultLayout: 'main' }))
app.set('view engine', 'hbs')
app.set('views', './pages')

app.get('/', (_, res) => {
    res.render('index')
})

app.get('/node/:node_name', (req, res) => {
    const { node_name } = req.params
    res.render('node', { node_name, db })
})

ws.on('connection', (socket: CustomWebSocket) => {
    let node_name: string | undefined = undefined
    let ping_time: number = Date.now()
    let pong_time: number | undefined = undefined
    let last_pong_time: number | undefined = undefined
    let latency: number | undefined = undefined
    let node_disconnected: boolean = false
    let socket_type: string | null = null

    socket.send('type:server')
    
    const pingInterval = setInterval(() => {
        if (ping_time !== undefined && pong_time !== undefined) {
            if (Date.now() - ping_time > 500 && last_pong_time === pong_time) {
                if (node_name && db.has(node_name)) {
                    db.set(node_name, NodeState.OFFLINE)
                }
                console.log(`🙁 [server]: Nodo ${node_name} desconectado`)
                console.log(db)
                const parsedDB: { [nodeName: string]: any }[] = Array.from(db).map(
                    ([key, value]) => {
                        return { nodeName: key, status: !!(value === NodeState.ONLINE) }
                    }
                )
                ws.clients.forEach((client) => {
                    if (client.readyState === OPEN) {
                        client.send(`client:status:${JSON.stringify(parsedDB)}`)
                    }
                })
                node_disconnected = true
                clearInterval(pingInterval)
            } else {
                ping_time = Date.now()
                socket.ping()
            }
        } else {
            ping_time = Date.now()
            socket.ping()
        }
    }, 500)

    const pongInterval = setInterval(() => {
        if (node_disconnected) {
            clearInterval(pongInterval)
        }

        last_pong_time = pong_time
    }, 500)

    socket.on('message', (msg: string) => {
        const event = Buffer.from(msg, 'base64').toString('ascii').split(':')[0]
        const data = Buffer.from(msg, 'base64').toString('ascii').split(':')[1]

        if (event === 'ping') {
            const end_time: number = Date.now()
            latency = end_time - ping_time!
            pong_time = end_time
        }

        if (event === 'type') {
            if (data === 'node') {
                socket_type = SocketType.NODE
                socket.send('node-name:test')
            }
            if (data === 'client') {
                socket_type = SocketType.CLIENT
                console.log('🎉 [server]: Nuevo cliente conectado')
            }
        }

        if (event === 'node-name') {
            node_name = data
            socket.socket_id = node_name
            console.log(`🎉 [server]: Nodo ${node_name} conectado`)
            db.set(data, NodeState.ONLINE)
            console.log(db)
            const parsedDB: { [nodeName: string]: any }[] = Array.from(db).map(
                ([key, value]) => {
                    return { nodeName: key, status: !!(value === NodeState.ONLINE) }
                }
            )
            ws.clients.forEach((client) => {
                if (client.readyState === OPEN) {
                    client.send(`client:status:${JSON.stringify(parsedDB)}`)
                }
            })
        }

        if (event === 'get-nodes') {
            const parsedDB: { [nodeName: string]: any }[] = Array.from(db).map(
                ([key, value]) => {
                    return { nodeName: key, status: !!(value === NodeState.ONLINE) }
                }
            )

            socket.send(`client:nodes:${JSON.stringify(parsedDB)}`)
        }

        if (event === 'state-change') {
        }

        if (event === 'direction') {
            const direction = data.split('.')[0]
            const socket_id = data.split('.')[1]

            if (direction === 'clockwise') {
                ws.clients.forEach(client => {
                    if ('socket_id' in client) {
                        const customClient = client as CustomWebSocket
    
                        if (customClient.readyState === OPEN) {
                            if (customClient.socket_id === socket_id) {
                                customClient.send('direction:clockwise')
                            }
                        }
                    }
                })                
            } else {
                ws.clients.forEach(client => {
                    if ('socket_id' in client) {
                        const customClient = client as CustomWebSocket
    
                        if (customClient.readyState === OPEN) {
                            if (customClient.socket_id === socket_id) {
                                customClient.send('direction:anticlockwise')
                            }
                        }
                    }
                })                
            }
        }

        if (event === 'stop-motor') {
            ws.clients.forEach(client => {
                if ('socket_id' in client) {
                    const customClient = client as CustomWebSocket

                    if (customClient.readyState === OPEN) {
                        if (customClient.socket_id === 'planta-001') {
                            customClient.send('stop-motor:true')
                        }
                    }
                }
            })
        }
    })

    socket.on('error', (error) => {
        console.log('error', error)
    })
})

app.use(express.static(path.join(__dirname, '../public')))

server.listen(app.get('port'), () => {
    console.log(`⚡️ [server]: Server listening on port: ${app.get('port')}`)
})
