const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

router.post('/send', async (req, res) => {
  // Debug log to confirm backend is reached
  console.log("📨 Received contact form request:", req.body);

  const { name, email, message } = req.body;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_USER, // Sends email to yourself
    replyTo: email,
    subject: `Flora Carbon: New message from ${name}`,
    html: `
      <div style="font-family: Arial, sans-serif; border: 1px solid #eee; padding: 20px;">
        <h2 style="color: #059669;">New Website Message</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>User Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p style="background: #f4f4f4; padding: 10px;">${message}</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully!");
    res.status(200).json({ msg: 'Success' });
  } catch (error) {
    console.error("❌ Nodemailer Error:", error);
    res.status(500).json({ msg: 'Error sending email' });
  }
});

module.exports = router;