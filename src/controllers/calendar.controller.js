import { success, fail } from '../utils/response.js'
import {
    getCalendarEvents,
    getUpcomingEvents,
    getMonthlySummary,
} from '../services/calendar.service.js'


const getEvents = async (req, res, next) => {
    try {
        const { month, year } = req.query

        const events = await getCalendarEvents(req.farmer.id, month, year)

        res.json(success({
            events,
            total: events.length,
            month: month ? parseInt(month) : null,
            year: year ? parseInt(year) : null,
        }, 'Calendar events fetched successfully'))
    } catch (err) {
        next(err)
    }
}


const getUpcoming = async (req, res, next) => {
    try {
        const days = req.query.days ? parseInt(req.query.days) : 30

        const events = await getUpcomingEvents(req.farmer.id, days)

        res.json(success({
            events,
            total: events.length,
            withinDays: days,
        }, 'Upcoming events fetched successfully'))
    } catch (err) {
        next(err)
    }
}


const getSummary = async (req, res, next) => {
    try {
        const year = req.query.year || new Date().getFullYear()

        const months = await getMonthlySummary(req.farmer.id, year)

        res.json(success({
            year: parseInt(year),
            months,
        }, 'Monthly summary fetched successfully'))
    } catch (err) {
        next(err)
    }
}

export { getEvents, getUpcoming, getSummary }