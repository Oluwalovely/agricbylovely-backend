import { success, fail } from '../utils/response.js'
import {
    getCalendarEvents,
    getUpcomingEvents,
    getMonthlySummary,
} from '../services/calendar.service.js'

// ─────────────────────────────────────────
// GET CALENDAR EVENTS
// GET /api/calendar
// Returns all planting and harvest events
// Optional filters: ?month=5&year=2026
// ─────────────────────────────────────────
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

// ─────────────────────────────────────────
// GET UPCOMING EVENTS
// GET /api/calendar/upcoming
// Returns harvests due in the next 30 days
// Used for the dashboard and notifications
// Optional: ?days=7 to change the window
// ─────────────────────────────────────────
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

// ─────────────────────────────────────────
// GET MONTHLY SUMMARY
// GET /api/calendar/summary
// Returns planting and harvest counts per month
// Used for the year-view calendar
// Optional: ?year=2026
// ─────────────────────────────────────────
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