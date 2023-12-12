import { Router } from 'express'
import { json2csv } from 'json-2-csv'
import fs from 'fs'
import path from 'path'
import dayjs from 'dayjs'

import prisma from '../lib/prisma'

const router = Router()

router.get('/api/measures', async (_, res) => {
    try {
        const measures = await prisma.measure.findMany({
            take: 100
        })

        const parsedMeasures = measures.map(measure => {
            return {
                ...measure,
                timestamp: dayjs(measure.timestamp).format('DD/MM/YYYY HH:mm:ss')
            }
        })

        res.json({ response: parsedMeasures, success: true, message: '' })
    } catch (error) {
        console.log(error)
        res.json({ response: [], success: false, message: 'Algo salió mal' })
    }
})

router.get('/api/measures/download/:measure_id', async (req, res) => {
    const { measure_id } = req.params

    try {
        const measure = await prisma.measure.findUnique({
            where: {
                id: parseInt(measure_id)
            },
            include: {
                values: true
            }
        })

        if (!measure) {
            return res.json({ response: null, success: false, message: 'Medición no encontrada' })
        }

        const values = measure.values.map(value => {
            return {
                id: value.id,
                id_medicion: value.measureId,
                valor: value.value,
                marca_de_tiempo: value.timestamp.toISOString()
            }
        })

        const csv = json2csv(values, {
            delimiter: {
                wrap: '"'
            },
            emptyFieldValue: ''
        }) 

        const filePath = path.join(__dirname, `./${measure_id}.csv`)
        fs.writeFileSync(filePath, csv, 'binary')

        const parsedDate = measure.timestamp.toISOString().split('T')[0].split('-').reverse().join('-')
        const parsedTime = measure.timestamp.toISOString().split('T')[1].split('Z')[0]
        
        res.download(filePath, `medición-${measure.nodeName}-(${parsedDate}T${parsedTime}).csv`, (err) => {
            if (err) {
                console.log(err)
            }
            fs.unlinkSync(filePath)
        })

        // res.send({ response: null, success: true, message: '' })
    } catch (error) {
        console.log(error)
        res.json({ response: null, success: false, message: 'Algo salió mal' })
    }
})

router.get('/', (_, res) => {
    res.render('index')
})


router.get('/node/:node_name', (req, res) => {
    const { node_name } = req.params

    res.render('node')
})

router.get('/measures', async (_, res) => {
    res.render('measures')
})

export default router