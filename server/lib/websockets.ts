import { Server as ServerType } from 'http'
import WebSocket, { Server, OPEN } from 'ws'

import prisma from './prisma'

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

        // Indentificar que tipo de conexión es: 'client' o 'node'
        socket.send(JSON.stringify({event: 'type', data: 'server'})) 

        // const pingInterval = setInterval(async () => {
        //     if (ping_time !== undefined && pong_time !== undefined) {
        //         if (
        //             Date.now() - ping_time > pingIntervalTime &&
        //             last_pong_time === pong_time
        //         ) {
        //             if (node_name) {
        //                 try {
        //                     await prisma.node.update({
        //                         where: {
        //                             name: node_name
        //                         },
        //                         data: {
        //                             status: false
        //                         }
        //                     })
        //                 } catch (error) {
        //                     if (error instanceof Error) {
        //                         console.log(error.message)
        //                     }
        //                     console.log(error)
        //                 }
        //             }

        //             console.log(`🙁 [server]: Nodo ${node_name} desconectado`)

        //             try {
        //                 const nodes = await prisma.node.findMany()
        //                 ws.clients.forEach((client) => {
        //                     if (client.readyState === OPEN) {
        //                         client.send(
        //                             `client:status:${JSON.stringify(nodes)}`
        //                         )
        //                     }
        //                 })
        //                 node_disconnected = true
        //                 clearInterval(pingInterval)
        //             } catch (error) {
        //                 if (error instanceof Error) {
        //                     console.log(error.message)
        //                 }
        //                 console.log(error)
        //             }
        //         } else {
        //             ping_time = Date.now()
        //             socket.ping()
        //         }
        //     } else {
        //         ping_time = Date.now()
        //         socket.ping()
        //     }
        // }, pingIntervalTime)

        // const pongInterval = setInterval(() => {
        //     if (node_disconnected) {
        //         clearInterval(pongInterval)
        //     }

        //     last_pong_time = pong_time
        // }, pingIntervalTime)

        socket.on('message', async (msg: string) => {
            const message = JSON.parse(msg)

            const { event, data } = message
            const nodeName = message?.nodeName
            
            // if (event === 'ping') {
            //     const end_time: number = Date.now()
            //     latency = end_time - ping_time!
            //     pong_time = end_time
            // }

            if (event === 'type') {
                if (data === 'node') {
                    socket_type = SocketType.NODE
                    node_name = nodeName
                    console.log(`🎉 [server]: Nodo ${node_name} conectado`)

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
    
                        const nodes = await prisma.node.findMany()
    
                        ws.clients.forEach((client) => {
                            if (client.readyState === OPEN) {
                                client.send(JSON.stringify({ destination: 'client', event: 'status', data: nodes }))
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
                    console.log('🎉 [server]: Nuevo cliente conectado')

                    try {
                        const nodes = await prisma.node.findMany()

                        ws.clients.forEach((client) => {
                            if (client.readyState === OPEN) {
                                client.send(JSON.stringify({ destination: 'client', event: 'status', data: nodes }))
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
                        client.send(JSON.stringify({ destination: 'client', event: 'initialState', nodeName, data }))
                    }
                })
            }

            // Obtiene los valores iniciales de un nodo al conectarse un nuevo cliente
            if (event === 'currentStateClient') {
                ws.clients.forEach((client) => {
                    if (client.readyState === OPEN) {
                        client.send(JSON.stringify({ destination: 'node', event: 'currentStateNode', nodeName: data }))
                    }
                })
            }

            if (event === 'currentStateNode') {
                ws.clients.forEach((client) => {
                    if (client.readyState === OPEN) {
                        client.send(JSON.stringify({ destination: 'client', event: 'currentState', nodeName, data }))
                    }
                })
            }

            // Obtiene los valores leidos por el puerto analóogico A0
            if (event === 'continuousData') {
                if (start_measuring && typeof socket_id_under_measure !== 'undefined') {
                    measuredValues.push({
                        value: data.value,
                        time: new Date().toISOString()
                    })
                }

                ws.clients.forEach((client) => {
                    // Este if hace que se envién los datos a todos los clientes menos al que envía los datos
                    if (client !== socket && client.readyState === OPEN) { // client !== socket
                        client.send(JSON.stringify({ destination: 'client', event: 'continuousData', nodeName, data }))   // Cambiar a continuousData
                    }
                })
            }

            if (event === 'startMotor') {
                ws.clients.forEach((client) => {
                    if (client.readyState === OPEN) {
                        client.send(JSON.stringify({ event: 'startMotorNode', nodeName, data }))
                    }
                })
            }

            if (event === 'stopMotor') {
                ws.clients.forEach((client) => {
                    if (client.readyState === OPEN) {
                        client.send(JSON.stringify({ event: 'stopMotorNode', nodeName, data }))
                    }
                })
            }

            if (event === 'motorControl') {
                ws.clients.forEach((client) => {
                    if (client.readyState === OPEN) {
                        client.send(JSON.stringify({ destination: 'node', event: 'motorControl', nodeName, data }))
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
