import { Server as ServerType } from 'http'
import WebSocket, { Server, OPEN } from 'ws'

const pingIntervalTime = 500
const savedValues: number[] = []
const maxValues = 100

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

export const websockets = (server: ServerType) => {
    const ws = new Server({ server, clientTracking: true })

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
                if (
                    Date.now() - ping_time > pingIntervalTime &&
                    last_pong_time === pong_time
                ) {
                    if (node_name && db.has(node_name)) {
                        db.set(node_name, NodeState.OFFLINE)
                    }
                    console.log(`🙁 [server]: Nodo ${node_name} desconectado`)
                    console.log(db)
                    const parsedDB: { [nodeName: string]: any }[] = Array.from(
                        db
                    ).map(([key, value]) => {
                        return {
                            nodeName: key,
                            status: !!(value === NodeState.ONLINE)
                        }
                    })
                    ws.clients.forEach((client) => {
                        if (client.readyState === OPEN) {
                            client.send(
                                `client:status:${JSON.stringify(parsedDB)}`
                            )
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
        }, pingIntervalTime)

        const pongInterval = setInterval(() => {
            if (node_disconnected) {
                clearInterval(pongInterval)
            }

            last_pong_time = pong_time
        }, pingIntervalTime)

        socket.on('message', (msg: string) => {
            const event = Buffer.from(msg, 'base64')
                .toString('ascii')
                .split(':')[0]
            const data = Buffer.from(msg, 'base64')
                .toString('ascii')
                .split(':')[1]
            const payload = Buffer.from(msg, 'base64')
                .toString('ascii')
                .substring(event.length + data.length + 2)

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

                    const parsedDB: { [nodeName: string]: any }[] = Array.from(
                        db
                    ).map(([key, value]) => {
                        return {
                            nodeName: key,
                            status: !!(value === NodeState.ONLINE)
                        }
                    })

                    ws.clients.forEach((client) => {
                        if (client.readyState === OPEN) {
                            client.send(
                                `client:status:${JSON.stringify(parsedDB)}`
                            )
                        }
                    })
                }
            }

            if (event === 'node-name') {
                node_name = data
                socket.socket_id = node_name
                console.log(`🎉 [server]: Nodo ${node_name} conectado`)
                db.set(data, NodeState.ONLINE)
                console.log(db)
                const parsedDB: { [nodeName: string]: any }[] = Array.from(
                    db
                ).map(([key, value]) => {
                    return {
                        nodeName: key,
                        status: !!(value === NodeState.ONLINE)
                    }
                })
                ws.clients.forEach((client) => {
                    if (client.readyState === OPEN) {
                        client.send(`client:status:${JSON.stringify(parsedDB)}`)
                    }
                })
            }

            if (event === 'get-nodes') {
                const parsedDB: { [nodeName: string]: any }[] = Array.from(
                    db
                ).map(([key, value]) => {
                    return {
                        nodeName: key,
                        status: !!(value === NodeState.ONLINE)
                    }
                })

                socket.send(`client:nodes:${JSON.stringify(parsedDB)}`)
            }

            if (event === 'state-change') {
            }

            if (event === 'continuous-data') {
                const parsedValue = parseFloat(data)

                if (!isNaN(parsedValue)) {
                    savedValues.push(parsedValue)
                    // if (savedValues.length > maxValues) {
                    //     savedValues.shift()
                    // }
                }

                ws.clients.forEach((client) => {
                    if (client !== socket && client.readyState === OPEN) {
                        client.send(`client:continuous-data:${data}`)
                    }
                })
            }

            if (event === 'direction') {
                const direction = data
                const socket_id = payload

                if (direction === 'clockwise') {
                    ws.clients.forEach((client) => {
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
                    ws.clients.forEach((client) => {
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
                const socket_id = payload

                ws.clients.forEach((client) => {
                    if ('socket_id' in client) {
                        const customClient = client as CustomWebSocket

                        if (customClient.readyState === OPEN) {
                            if (customClient.socket_id === socket_id) {
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
}
