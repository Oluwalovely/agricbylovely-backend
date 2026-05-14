import nodemailer from 'nodemailer'
import prisma from '../config/prisma.js'
import { env } from '../config/env.js'

// ─────────────────────────────────────────
// EMAIL SERVICE
// Handles all outgoing emails for AgricbyLovely
// Uses Nodemailer with Resend SMTP
// Logs every sent email to the database
// ─────────────────────────────────────────

// ── Create transporter ────────────────────
// This is the connection to the email server
// Created once and reused for all emails
const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: parseInt(env.SMTP_PORT),
    secure: true, 
    auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
    },
})

// ── Base email wrapper ────────────────────
// Sends any email and logs it to the database
const sendEmail = async ({ to, subject, html, farmerId = null, template }) => {
    try {
        await transporter.sendMail({
            from: `AgricbyLovely <${env.EMAIL_FROM}>`,
            to,
            subject,
            html,
        })

        // Log successful send to database
        await prisma.emailLog.create({
            data: {
                to,
                subject,
                template,
                status: 'sent',
                farmerId: farmerId || null,
            },
        })

        console.log(`Email sent: "${subject}" to ${to}`)
        return true

    } catch (err) {
        console.error(`Email failed: "${subject}" to ${to} —`, err.message)

        // Log failed send so we know what to retry
        await prisma.emailLog.create({
            data: {
                to,
                subject,
                template,
                status: 'failed',
                error: err.message,
                farmerId: farmerId || null,
            },
        })

        return false
    }
}

// ─────────────────────────────────────────
// EMAIL TEMPLATES
// Each template is a function that returns
// an HTML string for a specific email type
// ─────────────────────────────────────────

// ── Brand colors and shared styles ────────
const styles = `
  body { margin:0; padding:0; font-family: Arial, sans-serif; background:#f4f7f0; }
  .wrapper { max-width:600px; margin:0 auto; background:#ffffff; }
  .header { background:#3B6D11; padding:30px 40px; text-align:center; }
  .header h1 { color:#ffffff; margin:0; font-size:24px; letter-spacing:-0.5px; }
  .header p { color:#C5E09A; margin:8px 0 0; font-size:14px; }
  .body { padding:40px; }
  .body h2 { color:#3B6D11; font-size:20px; margin:0 0 16px; }
  .body p { color:#444444; font-size:15px; line-height:1.6; margin:0 0 16px; }
  .highlight { background:#EAF3DE; border-left:4px solid #3B6D11; padding:16px 20px; border-radius:4px; margin:20px 0; }
  .highlight p { margin:0; color:#27500A; font-weight:500; }
  .btn { display:inline-block; background:#3B6D11; color:#ffffff; padding:12px 28px; border-radius:6px; text-decoration:none; font-size:15px; font-weight:500; margin:20px 0; }
  .alert-card { border:1px solid #e5e7eb; border-radius:8px; padding:16px 20px; margin:12px 0; }
  .alert-weather { border-left:4px solid #185FA5; }
  .alert-pest { border-left:4px solid #BA7517; }
  .alert-harvest { border-left:4px solid #639922; }
  .alert-planting { border-left:4px solid #3B6D11; }
  .alert-title { font-weight:600; color:#1a1a1a; font-size:14px; margin:0 0 6px; }
  .alert-msg { color:#555555; font-size:13px; margin:0; line-height:1.5; }
  .footer { background:#f4f7f0; padding:24px 40px; text-align:center; }
  .footer p { color:#888888; font-size:12px; margin:0; line-height:1.8; }
`

// ── Welcome email ─────────────────────────
// Sent when a farmer registers
const welcomeTemplate = (farmer) => ({
    subject: `Welcome to AgricbyLovely, ${farmer.firstName}!`,
    html: `
    <!DOCTYPE html><html><head><style>${styles}</style></head>
    <body><div class="wrapper">
      <div class="header">
        <h1>AgricbyLovely</h1>
        <p>Smart Farming Intelligence for Nigerian Farmers</p>
      </div>
      <div class="body">
        <h2>Welcome, ${farmer.firstName}!</h2>
        <p>Your account has been created successfully. You now have access to everything AgricbyLovely has to offer:</p>
        <div class="highlight">
          <p>Farm: ${farmer.farmName}</p>
        </div>
        <p>Here is what you can do right now:</p>
        <p>
          <strong>Track your crops</strong> — Add the crops you are growing and monitor their progress from planting to harvest.<br><br>
          <strong>Get weather alerts</strong> — Receive real-time weather alerts specific to your farm location and farming zone.<br><br>
          <strong>Plan your planting</strong> — Use the planting calendar to plan your seasons and never miss a harvest date.<br><br>
          <strong>Browse the encyclopedia</strong> — Access detailed growing guides for hundreds of Nigerian and international crops.
        </p>
        <a href="${env.CLIENT_URL}" class="btn">Open AgricbyLovely</a>
        <p>If you have any questions, simply reply to this email.</p>
        <p>Happy farming!</p>
      </div>
      <div class="footer">
        <p>AgricbyLovely — Smart Farming Intelligence<br>You are receiving this email because you registered on AgricbyLovely.</p>
      </div>
    </div></body></html>
  `,
})

// ── Weather alert email ───────────────────
// Sent when dangerous weather conditions are detected
const weatherAlertTemplate = (farmer, alerts) => {
    const alertCards = alerts.map(alert => `
    <div class="alert-card alert-${alert.type.toLowerCase()}">
      <p class="alert-title">${alert.title}</p>
      <p class="alert-msg">${alert.message}</p>
    </div>
  `).join('')

    return {
        subject: `Weather Alert for ${farmer.farmName} — Action Required`,
        html: `
      <!DOCTYPE html><html><head><style>${styles}</style></head>
      <body><div class="wrapper">
        <div class="header">
          <h1>AgricbyLovely</h1>
          <p>Weather Alert for Your Farm</p>
        </div>
        <div class="body">
          <h2>Hi ${farmer.firstName}, your farm needs attention</h2>
          <p>We have detected weather conditions that may affect your crops. Please review the alerts below and take action:</p>
          ${alertCards}
          <a href="${env.CLIENT_URL}/weather" class="btn">View Full Forecast</a>
          <p>Stay safe and protect your harvest.</p>
        </div>
        <div class="footer">
          <p>AgricbyLovely — Smart Farming Intelligence<br>To stop receiving weather alerts, update your notification preferences in the app.</p>
        </div>
      </div></body></html>
    `,
    }
}

// ── Harvest reminder email ────────────────
// Sent 7 days, 3 days and 1 day before harvest
const harvestReminderTemplate = (farmer, crops) => {
    const cropRows = crops.map(c => `
    <div class="alert-card alert-harvest">
      <p class="alert-title">${c.cropName} ${c.fieldName ? `— ${c.fieldName}` : ''}</p>
      <p class="alert-msg">
        ${c.daysLeft === 0 ? 'Ready to harvest TODAY' :
            c.daysLeft === 1 ? 'Ready to harvest TOMORROW' :
                `Ready to harvest in ${c.daysLeft} days — ${c.date}`}
      </p>
    </div>
  `).join('')

    return {
        subject: `Harvest Reminder — ${crops.length} crop${crops.length > 1 ? 's' : ''} ready soon`,
        html: `
      <!DOCTYPE html><html><head><style>${styles}</style></head>
      <body><div class="wrapper">
        <div class="header">
          <h1>AgricbyLovely</h1>
          <p>Harvest Reminder</p>
        </div>
        <div class="body">
          <h2>Hi ${farmer.firstName}, harvest time is approaching!</h2>
          <p>The following crops on your farm are due for harvest soon. Prepare your tools and storage facilities:</p>
          ${cropRows}
          <a href="${env.CLIENT_URL}/calendar" class="btn">View Planting Calendar</a>
          <p>Harvest at the right time for the best yield and quality.</p>
        </div>
        <div class="footer">
          <p>AgricbyLovely — Smart Farming Intelligence</p>
        </div>
      </div></body></html>
    `,
    }
}

// ── Weekly digest email ───────────────────
// Sent every Monday morning with a farm summary
const weeklyDigestTemplate = (farmer, data) => {
    const cropRows = data.activeCrops.slice(0, 5).map(fc => `
    <div class="alert-card">
      <p class="alert-title">${fc.crop.name} ${fc.field ? `— ${fc.field.name}` : ''}</p>
      <p class="alert-msg">Stage: ${fc.stage} ${fc.expectedHarvestAt ?
            `• Harvest: ${new Date(fc.expectedHarvestAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}` : ''
        }</p>
    </div>
  `).join('')

    return {
        subject: `Your Weekly Farm Summary — ${new Date().toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' })}`,
        html: `
      <!DOCTYPE html><html><head><style>${styles}</style></head>
      <body><div class="wrapper">
        <div class="header">
          <h1>AgricbyLovely</h1>
          <p>Weekly Farm Summary</p>
        </div>
        <div class="body">
          <h2>Good morning, ${farmer.firstName}!</h2>
          <p>Here is your weekly summary for <strong>${farmer.farmName}</strong>:</p>
          <div class="highlight">
            <p>
              Active crops: ${data.activeCrops.length} &nbsp;|&nbsp;
              Fields: ${data.totalFields} &nbsp;|&nbsp;
              Upcoming harvests: ${data.upcomingHarvests}
            </p>
          </div>
          ${data.activeCrops.length > 0 ? `
            <p><strong>Your active crops this week:</strong></p>
            ${cropRows}
          ` : '<p>You have no active crops. Visit the app to start tracking your planting.</p>'}
          <a href="${env.CLIENT_URL}/dashboard" class="btn">View Full Dashboard</a>
          <p>Have a productive week on the farm!</p>
        </div>
        <div class="footer">
          <p>AgricbyLovely — Smart Farming Intelligence<br>Sent every Monday morning.</p>
        </div>
      </div></body></html>
    `,
    }
}

// ─────────────────────────────────────────
// EMAIL SEND FUNCTIONS
// One function per email type
// These are called from controllers and jobs
// ─────────────────────────────────────────

// Send welcome email on registration
const sendWelcomeEmail = async (farmer) => {
    const { subject, html } = welcomeTemplate(farmer)
    return sendEmail({
        to: farmer.email,
        subject,
        html,
        farmerId: farmer.id,
        template: 'welcome',
    })
}

// Send weather alert email
const sendWeatherAlertEmail = async (farmer, alerts) => {
    if (!alerts || alerts.length === 0) return false
    const { subject, html } = weatherAlertTemplate(farmer, alerts)
    return sendEmail({
        to: farmer.email,
        subject,
        html,
        farmerId: farmer.id,
        template: 'weather-alert',
    })
}

// Send harvest reminder email
const sendHarvestReminderEmail = async (farmer, crops) => {
    if (!crops || crops.length === 0) return false
    const { subject, html } = harvestReminderTemplate(farmer, crops)
    return sendEmail({
        to: farmer.email,
        subject,
        html,
        farmerId: farmer.id,
        template: 'harvest-reminder',
    })
}

// Send weekly digest email
const sendWeeklyDigestEmail = async (farmer, data) => {
    const { subject, html } = weeklyDigestTemplate(farmer, data)
    return sendEmail({
        to: farmer.email,
        subject,
        html,
        farmerId: farmer.id,
        template: 'weekly-digest',
    })
}

export {
    sendEmail,
    sendWelcomeEmail,
    sendWeatherAlertEmail,
    sendHarvestReminderEmail,
    sendWeeklyDigestEmail,
}