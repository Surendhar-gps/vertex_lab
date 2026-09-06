const axios = require('axios');

const sendEmail = async ({ to, subject, html, text }) => {
  console.log('[sendEmail] BREVO_API_KEY set:', !!process.env.BREVO_API_KEY);

  if (!process.env.BREVO_API_KEY) {
    throw new Error('BREVO_API_KEY is not set.');
  }

  try {
    const response = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: { name: 'Vertex Lab', email: process.env.EMAIL_USER },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      },
      {
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );

    console.log('[sendEmail] Message sent. messageId:', response.data.messageId);
    return response.data;
  } catch (err) {
    const errMsg = err.response?.data?.message || err.message;
    console.error('[sendEmail] Brevo error:', errMsg);
    throw new Error(errMsg);
  }
};

module.exports = sendEmail;