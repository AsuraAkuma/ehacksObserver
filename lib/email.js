const nodemailer = require('nodemailer');

/**
 * Send an email with both HTML and plain text fallback
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} text - Plain text content (fallback)
 * @param {string} html - HTML content (optional)
 */
async function sendEmail(to, subject, text, html = null) {
    const transporter = nodemailer.createTransport({
        host: 'smtp.dreamhost.com',
        port: 587,
        secure: false, // use TLS
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    try {
        const mailOptions = {
            from: `eHacks 2026 <${process.env.EMAIL_NOREPLY_USER}>`,
            replyTo: process.env.EMAIL_NOREPLY_USER,
            to: to,
            subject: subject,
            text: text
        };

        // Add HTML content if provided
        if (html) {
            mailOptions.html = html;
        }

        await transporter.sendMail(mailOptions);
    } catch (e) {
        console.error('Failed to send email: ', e && e.message);
        // avoid leaking errors to callers
    }
}

module.exports = { sendEmail };