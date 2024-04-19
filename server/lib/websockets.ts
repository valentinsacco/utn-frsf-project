import { Server as ServerType } from 'http'
import WebSocket, { Server, OPEN } from 'ws'
import { Node } from '@prisma/client'

import prisma from './prisma'

const DEBUG = process.env.NODE_ENV === 'development' || true

interface MeasuredValue {
    value: string
    time: string
}

const pingIntervalTime = 1000
const measuredValues: MeasuredValue[] = []

enum SocketType {
    NODE = 'node',
    CLIENT = 'client'
}

interface CustomWebSocket extends WebSocket {
    socket_id: string
}

export const websockets = async (server: ServerType) => {
    const ws = new Server({ server, clientTracking: true })

    let node_name: string | undefined = undefined
    let ping_time: number = Date.now()
    let pong_time: number | undefined = undefined
    let latency: number | undefined = undefined
    let socket_type: string | null = null
    let start_measuring: boolean = false
    let socket_id_under_measure: string | undefined = undefined
    let measure_id: number | undefined = undefined
    let nodes: Node[] = []

    const sockets = await prisma.node.findMany()

    const activeSockets: string[] = []
    let inactiveSockets: Node[] = []
    let lastInactiveSocketsLength = 0

    setInterval(async () => {
        ;(ws.clients as Set<CustomWebSocket>).forEach(
            (client: CustomWebSocket) => {
                const socketId = client.socket_id

                if (typeof socketId === 'string' && socketId !== 'client') {
                    activeSockets.includes(socketId)
                        ? null
                        : activeSockets.push(socketId)
                }
            }
        )

        inactiveSockets = sockets.filter((socket) => {
            return !activeSockets.includes(socket.name)
        })

    }, 1000)

    if (lastInactiveSocketsLength !== inactiveSockets.length) {
        lastInactiveSocketsLength = inactiveSockets.length

        for (const inactiveSocket of inactiveSockets) {
            try {
                await prisma.node.update({
                    where: {
                        name: inactiveSocket.name
                    },
                    data: {
                        status: false
                    }
                })

                const nodesFromDB = await prisma.node.findMany()

                nodes = nodesFromDB

                ws.clients.forEach((client) => {
                    if (client.readyState === OPEN) {
                        client.send(
                            JSON.stringify({
                                destination: 'client',
                                event: 'status',
                                data: nodesFromDB
                            })
                        )
                    }
                })
            } catch (error) {
                if (error instanceof Error) {
                    console.log(error.message)
                }
                console.log(error)
            }
        }
    }

    ws.on('connection', async (socket: CustomWebSocket) => {
        // Indentificar que tipo de conexión es: 'client' o 'node'
        socket.send(JSON.stringify({ event: 'type', data: 'server' }))
        
        setInterval(() => {
            const currentTime = Date.now()
            socket.send(JSON.stringify({ event: 'ping', data: currentTime }))
            ping_time = currentTime
        }, pingIntervalTime)

        socket.on('message', async (msg: string) => {
            const message = JSON.parse(msg)

            const { event, data } = message
            const nodeName = message?.nodeName

            if (DEBUG) {
                console.log('📨 [server]:', event, data)
            }

            if (event === 'pong') {
                const end_time: number = Date.now()
                latency = end_time - ping_time!
                pong_time = end_time

                if (DEBUG) {
                    console.log(pong_time, ' - ', ping_time)

                    console.log(
                        `🏓 [server]: Latencia (${nodeName}): ${latency}ms`
                    )
                }

                const nodeWithLatency = nodes.map((node) => {
                    if (node.name === nodeName) {
                        return {
                            ...node,
                            status: latency && latency > 500 ? false : true,
                            latency
                        }
                    }
                    return { ...node, latency: null }
                })

                ws.clients.forEach((client) => {
                    if (client.readyState === OPEN) {
                        client.send(
                            JSON.stringify({
                                destination: 'client',
                                event: 'nodeLatency',
                                nodeName,
                                data: nodeWithLatency
                            })
                        )
                    }
                })
            }

            if (event === 'type') {
                if (data === 'node') {
                    socket_type = SocketType.NODE
                    node_name = nodeName
                    socket.socket_id = nodeName
                    console.log(`🎉 [server]: Nodo ${node_name} conectado`)

                    activeSockets.push(node_name!)

                    inactiveSockets = sockets.filter((socket) => {
                        return !activeSockets.includes(socket.name)
                    })

                    try {
                        await prisma.node.upsert({
                            where: {
                                name: node_name
                            },
                            update: {
                                status: true
                            },
                            create: {
                                name: node_name!,
                                status: true
                            }
                        })

                        const nodesFromDB = await prisma.node.findMany()

                        nodes = nodesFromDB

                        ws.clients.forEach((client) => {
                            if (client.readyState === OPEN) {
                                client.send(
                                    JSON.stringify({
                                        destination: 'client',
                                        event: 'status',
                                        data: nodesFromDB
                                    })
                                )
                            }
                        })
                    } catch (error) {
                        if (error instanceof Error) {
                            console.log(error.message)
                        }
                        console.log(error)
                    }
                }

                if (data === 'client') {
                    socket_type = SocketType.CLIENT
                    socket.socket_id = 'client'
                    console.log('🎉 [server]: Nuevo cliente conectado')

                    try {
                        const nodesFromDB = await prisma.node.findMany()

                        nodes = nodesFromDB

                        ws.clients.forEach((client) => {
                            if (client.readyState === OPEN) {
                                client.send(
                                    JSON.stringify({
                                        destination: 'client',
                                        event: 'status',
                                        data: nodesFromDB
                                    })
                                )
                            }
                        })
                    } catch (error) {
                        if (error instanceof Error) {
                            console.log(error.message)
                        }
                        console.log(error)
                    }
                }
            }

            // Obtiene los valores iniciales de un nodo al conectarse el nodo
            if (event === 'initialStateNode') {
                ws.clients.forEach((client) => {
                    if (client.readyState === OPEN) {
                        client.send(
                            JSON.stringify({
                                destination: 'client',
                                event: 'initialState',
                                nodeName,
                                data
                            })
                        )
                    }
                })
            }

            if (event === 'currentStateClient') {
                ws.clients.forEach((client) => {
                    if (client.readyState === OPEN) {
                        client.send(
                            JSON.stringify({
                                destination: 'node',
                                event: 'currentStateNode',
                                nodeName: data
                            })
                        )
                    }
                })
            }

            if (event === 'currentStateNode') {
                ws.clients.forEach((client) => {
                    if (client.readyState === OPEN) {
                        client.send(
                            JSON.stringify({
                                destination: 'client',
                                event: 'currentState',
                                nodeName,
                                data
                            })
                        )
                    }
                })
            }

            // Obtiene los valores leidos por el puerto analóogico A0
            if (event === 'continuousData') {
                if (
                    start_measuring &&
                    typeof socket_id_under_measure !== 'undefined'
                ) {
                    measuredValues.push({
                        value: data.value,
                        time: new Date().toISOString()
                    })
                }

                ws.clients.forEach((client) => {
                    // Este if hace que se envién los datos a todos los clientes menos al que envía los datos
                    if (client !== socket && client.readyState === OPEN) {
                        client.send(
                            JSON.stringify({
                                destination: 'client',
                                event: 'continuousData',
                                nodeName,
                                data
                            })
                        )
                    }
                })
            }

            if (event === 'startMotor') {
                ws.clients.forEach((client) => {
                    if (client.readyState === OPEN) {
                        client.send(
                            JSON.stringify({
                                event: 'startMotorNode',
                                nodeName,
                                data
                            })
                        )
                    }
                })
            }

            if (event === 'stopMotor') {
                ws.clients.forEach((client) => {
                    if (client.readyState === OPEN) {
                        client.send(
                            JSON.stringify({
                                event: 'stopMotorNode',
                                nodeName,
                                data
                            })
                        )
                    }
                })
            }

            if (event === 'motorControl') {
                ws.clients.forEach((client) => {
                    console.log('⚙ [server]: Planta en estado', data)
                    if (client.readyState === OPEN) {
                        client.send(
                            JSON.stringify({
                                destination: 'node',
                                event: 'motorControl',
                                nodeName,
                                data
                            })
                        )
                    }
                })
            }

            if (event === 'startMeasure') {
                const { username, measureName, readedPin } = data

                socket_id_under_measure = nodeName
                start_measuring = true

                try {
                    const measure = await prisma.measure.create({
                        data: {
                            username,
                            measureName,
                            nodeName,
                            readedPin
                        }
                    })

                    measure_id = measure.id
                } catch (error) {
                    if (error instanceof Error) {
                        console.log(error.message)
                    }
                    console.log(error)
                }
            }

            if (event === 'stopMeasure') {
                start_measuring = false

                try {
                    for (const value of measuredValues) {
                        await prisma.value.create({
                            data: {
                                value: parseFloat(value.value),
                                timestamp: value.time,
                                measure: {
                                    connect: {
                                        id: measure_id
                                    }
                                }
                            }
                        })
                    }
                } catch (error) {
                    if (error instanceof Error) {
                        console.log(error.message)
                    }
                    console.log(error)
                }

                socket_id_under_measure = undefined
                measure_id = undefined
                measuredValues.length = 0
            }
        })

        socket.on('error', (error) => {
            console.log('error', error)
        })
    })
}
