import { Router } from 'express'
import { Measure } from '@prisma/client'

import prisma from '../lib/prisma'

const router = Router()

router.get('/api/measures', async (_, res) => {
    try {
        const measures = await prisma.measure.findMany({
            take: 100
        })

        res.json({ response: measures, success: true, message: '' })
    } catch (error) {
        console.log(error)
        res.json({ response: [], success: false, message: 'Algo salió mal' })
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
    let measures: Measure[] = []
    try {
        measures = await prisma.measure.findMany({
            take: 100
        })
    } catch (error) {
        console.log(error)
    }
    
    res.render('measures', { measures })
})

export default router