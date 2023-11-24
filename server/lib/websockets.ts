import { Server as ServerType } from 'http'
import WebSocket, { Server, OPEN } from 'ws'

import prisma from './prisma'

interface MeasuredValue {
    value: number
    timestamp: string
}

const pingIntervalTime = 1000
const savedValues: number[] = []
const measuredValues: MeasuredValue[] = []

enum SocketType {
    NODE = 'node',
    CLIENT = 'client'
}

interface CustomWebSocket extends WebSocket {
    socket_id: string
}

export const websockets = (server: ServerType) => {
    const ws = new Server({ server, clientTracking: true })
    
    let node_name: string | undefined = undefined
    let ping_time: number = Date.now()
    let pong_time: number | undefined = undefined
    let last_pong_time: number | undefined = undefined
    let latency: number | undefined = undefined
    let node_disconnected: boolean = false
    let socket_type: string | null = null
    let start_measuring: boolean = false
    let socket_id_under_measure: string | undefined = undefined
    let measure_id: number | undefined = undefined

    ws.on('connection', (socket: CustomWebSocket) => {

        socket.send('type:server')

        const pingInterval = setInterval(async () => {
            if (ping_time !== undefined && pong_time !== undefined) {
                if (
                    Date.now() - ping_time > pingIntervalTime &&
                    last_pong_time === pong_time
                ) {
                    if (node_name) {
                        try {
                            await prisma.node.update({
                                where: {
                                    name: node_name
                                },
                                data: {
                                    status: false
                                }
                            })
                        } catch (error) {
                            if (error instanceof Error) {
                                console.log(error.message)
                            }
                            console.log(error)
                        }
                    }

                    console.log(`🙁 [server]: Nodo ${node_name} desconectado`)

                    try {
                        const nodes = await prisma.node.findMany()
                        ws.clients.forEach((client) => {
                            if (client.readyState === OPEN) {
                                client.send(
                                    `client:status:${JSON.stringify(nodes)}`
                                )
                            }
                        })
                        node_disconnected = true
                        clearInterval(pingInterval)
                    } catch (error) {
                        if (error instanceof Error) {
                            console.log(error.message)
                        }
                        console.log(error)
                    }
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

        socket.on('message', async (msg: string) => {
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

                    try {
                        const nodes = await prisma.node.findMany()

                        ws.clients.forEach((client) => {
                            if (client.readyState === OPEN) {
                                client.send(
                                    `client:status:${JSON.stringify(nodes)}`
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

            if (event === 'node-name') {
                node_name = data
                socket.socket_id = node_name
                console.log(`🎉 [server]: Nodo ${node_name} conectado`)

                try {
                    const existNode = await prisma.node.findUnique({
                        where: {
                            name: node_name
                        }
                    })

                    if (!!existNode) {
                        await prisma.node.update({
                            where: {
                                name: node_name
                            },
                            data: {
                                status: true
                            }
                        })
                    } else {
                        await prisma.node.create({
                            data: {
                                name: node_name,
                                status: true
                            }
                        })
                    }

                    const nodes = await prisma.node.findMany()

                    ws.clients.forEach((client) => {
                        if (client.readyState === OPEN) {
                            client.send(
                                `client:status:${JSON.stringify(nodes)}`
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

            if (event === 'get-nodes') {
                try {
                    const nodes = await prisma.node.findMany()

                    socket.send(`client:nodes:${JSON.stringify(nodes)}`)
                } catch (error) {
                    if (error instanceof Error) {
                        console.log(error.message)
                    }
                    console.log(error)
                }
            }

            if (event === 'state-change') {
            }

            if (event === 'continuous-data') {
                const parsedValue = parseFloat(data)
                const socket_id = payload

                if (!isNaN(parsedValue)) {
                    savedValues.push(parsedValue)
                    if (start_measuring && typeof socket_id_under_measure !== 'undefined') {
                        measuredValues.push({
                            value: parsedValue,
                            timestamp: new Date().toISOString()
                        })
                    }
  
                    // { socket_id: '001', values: [{ value: 0.5, timestamp: '10-11-23' }] }

                    // try {
                    //     if (start_measuring && typeof socket_id_under_measure !== 'undefined') {
                    //         await prisma.value.create({
                    //             data: {
                    //                 value: parsedValue,
                    //                 measure: {
                    //                     connect: {
                    //                         id: measure_id
                    //                     }
                    //                 }
                    //             }
                    //         })
                    //     }
                    // } catch (error) {
                    //     if (error instanceof Error) {
                    //         console.log(error.message)
                    //     }
                    //     console.log(error)
                    // }

                    ws.clients.forEach((client) => {
                        if (client !== socket && client.readyState === OPEN) {
                            client.send(
                                `client:continuous-data:${data}/${socket_id}`
                            )
                        }
                    })
                }
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

            if (event === 'measure') {
                const measureStatus = data
                const socket_id = payload

                if (measureStatus === 'true') {
                    start_measuring = true
                    socket_id_under_measure = socket_id
                    // payload = 'socket_id; username; measure_name; readed_pin'
    
                    try {
                        const measure = await prisma.measure.create({
                            data: {
                                username: 'test',
                                measureName: 'test',
                                nodeName: socket_id_under_measure,
                                readedPin: 'A0',
                            }
                        })
    
                        measure_id = measure.id
                    } catch (error) {
                        if (error instanceof Error) {
                            console.log(error.message)
                        }
                        console.log(error)
                    }
                } else if (measureStatus === 'false') {
                    start_measuring = false

                    try {
                        for (const value of measuredValues) {
                            await prisma.value.create({
                                data: {
                                    value: value.value,
                                    timestamp: value.timestamp,
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
            }
        })

        socket.on('error', (error) => {
            console.log('error', error)
        })
    })
}
