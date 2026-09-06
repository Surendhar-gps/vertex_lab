const nodemailer = require('nodemailer');

/**
 * Sends an email via SMTP using nodemailer.
 *
 * Required env vars:
 *   EMAIL_USER     - the sending mailbox address (e.g. yourapp@gmail.com)
 *   EMAIL_PASS     - an app password (NOT your normal account password —
 *                    Gmail blocks regular passwords for SMTP logins)
 *   EMAIL_SERVICE  - optional, defaults to 'gmail'. Set to a different
 *                    value if you switch providers later.
 *
 * @param {Object} options
 * @param {string} options.to
 * @param {string} options.subject
 * @param {string} options.html
 * @param {string} [options.text]
 */
const sendEmail = async ({ to, subject, html, text }) => {
  const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: `"Vertex Lab" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  });
};

module.exports = sendEmail;
