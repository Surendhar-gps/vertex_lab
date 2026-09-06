const nodemailer = require('nodemailer');

/**
 * Sends an email via Gmail SMTP using nodemailer.
 *
 * Required env vars:
 *   EMAIL_USER - the sending Gmail address
 *   EMAIL_PASS - a Gmail App Password (not your normal password)
 */
const sendEmail = async ({ to, subject, html, text }) => {
  console.log('[sendEmail] EMAIL_USER set:', !!process.env.EMAIL_USER);
  console.log('[sendEmail] EMAIL_PASS set:', !!process.env.EMAIL_PASS);

  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('EMAIL_USER or EMAIL_PASS is not set.');
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  try {
    await transporter.verify();
    console.log('[sendEmail] SMTP connection verified successfully.');
  } catch (verifyError) {
    console.error('[sendEmail] SMTP verify failed:', verifyError.message);
    throw verifyError;
  }

  try {
    const info = await transporter.sendMail({
      from: `"Vertex Lab" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html,
    });

    console.log('[sendEmail] Message sent. messageId:', info.messageId);
    console.log('[sendEmail] Accepted:', info.accepted);
    console.log('[sendEmail] Rejected:', info.rejected);

    return info;
  } catch (sendError) {
    console.error('[sendEmail] sendMail failed:', sendError.message);
    throw sendError;
  }
};

module.exports = sendEmail;