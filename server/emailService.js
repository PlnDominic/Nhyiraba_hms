// Email service using nodemailer
// Sends approval emails to staff when their access request is approved

const nodemailer = require('nodemailer');

// Create reusable transporter
const createTransporter = () => {
  // Check if email credentials are configured
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASSWORD;
  const emailService = process.env.EMAIL_SERVICE || 'gmail';

  if (!emailUser || !emailPass) {
    console.warn('⚠️ Email credentials not configured. Set EMAIL_USER and EMAIL_PASSWORD in .env file');
    return null;
  }

  return nodemailer.createTransport({
    service: emailService, // 'gmail', 'outlook', 'yahoo', etc.
    auth: {
      user: emailUser,
      pass: emailPass
    }
  });
};

/**
 * Send approval email to staff member
 * @param {Object} options - Email options
 * @param {string} options.email - Recipient email
 * @param {string} options.fullName - Recipient full name
 * @param {string} options.password - Generated password
 * @param {string} options.hotelName - Hotel name (optional)
 * @returns {Promise<Object>} - Result with success status
 */
const sendApprovalEmail = async ({ email, fullName, password, hotelName = 'Nhyiraba Hotel Management System' }) => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      console.log('📧 Email service not configured, skipping email send');
      return {
        success: false,
        error: 'Email service not configured',
        skipped: true
      };
    }

    // Email HTML template
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .container {
              background: white;
              border-radius: 10px;
              overflow: hidden;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
            }
            .content {
              padding: 30px;
            }
            .credentials-box {
              background: #f8f9fa;
              border: 2px solid #667eea;
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
            }
            .credential-item {
              margin: 15px 0;
              padding: 12px;
              background: white;
              border-radius: 5px;
              border-left: 4px solid #667eea;
            }
            .credential-label {
              font-weight: bold;
              color: #667eea;
              display: block;
              margin-bottom: 5px;
              font-size: 12px;
              text-transform: uppercase;
            }
            .credential-value {
              font-family: 'Courier New', monospace;
              font-size: 16px;
              color: #1f2937;
              word-break: break-all;
            }
            .button {
              display: inline-block;
              background: #667eea;
              color: white;
              padding: 14px 35px;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
              font-weight: bold;
            }
            .warning {
              background: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 15px;
              margin: 20px 0;
              border-radius: 5px;
            }
            .warning strong {
              color: #856404;
            }
            .warning ul {
              margin: 10px 0 0 0;
              padding-left: 20px;
            }
            .footer {
              background: #1f2937;
              color: #9ca3af;
              padding: 20px;
              text-align: center;
              font-size: 12px;
            }
            .footer p {
              margin: 5px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Access Request Approved!</h1>
            </div>
            
            <div class="content">
              <p>Dear <strong>${fullName}</strong>,</p>
              
              <p>Great news! Your access request to <strong>${hotelName}</strong> has been approved by the administrator.</p>
              
              <p>You can now log in to the system using the credentials below:</p>
              
              <div class="credentials-box">
                <h3 style="margin-top: 0; color: #667eea;">Your Login Credentials</h3>
                
                <div class="credential-item">
                  <span class="credential-label">📧 Email Address</span>
                  <span class="credential-value">${email}</span>
                </div>
                
                <div class="credential-item">
                  <span class="credential-label">🔑 Password</span>
                  <span class="credential-value">${password}</span>
                </div>
              </div>
              
              <div class="warning">
                <strong>⚠️ Important Security Notice:</strong>
                <ul>
                  <li>Please change your password after your first login</li>
                  <li>Never share your credentials with anyone</li>
                  <li>Keep this email secure or delete it after logging in</li>
                  <li>Contact your administrator if you notice any suspicious activity</li>
                </ul>
              </div>
              
              <div style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/landing" class="button">
                  Login to Dashboard →
                </a>
              </div>
              
              <p style="margin-top: 30px;">If you have any questions or need assistance, please contact your system administrator.</p>
              
              <p style="margin-top: 20px;">
                Best regards,<br>
                <strong>${hotelName} Administration Team</strong>
              </p>
            </div>
            
            <div class="footer">
              <p><strong>This is an automated email. Please do not reply to this message.</strong></p>
              <p>&copy; ${new Date().getFullYear()} ${hotelName}. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Plain text version for email clients that don't support HTML
    const emailText = `
Dear ${fullName},

Great news! Your access request to ${hotelName} has been approved.

Your Login Credentials:
------------------------
Email: ${email}
Password: ${password}

IMPORTANT SECURITY NOTICE:
- Please change your password after your first login
- Never share your credentials with anyone
- Keep this email secure or delete it after logging in

Login URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/landing

If you have any questions, please contact your system administrator.

Best regards,
${hotelName} Administration Team

---
This is an automated email. Please do not reply to this message.
© ${new Date().getFullYear()} ${hotelName}. All rights reserved.
    `;

    // Send email
    const info = await transporter.sendMail({
      from: `"${hotelName}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `✅ Access Approved - ${hotelName}`,
      text: emailText,
      html: emailHtml
    });

    console.log('✅ Email sent successfully:', info.messageId);

    return {
      success: true,
      messageId: info.messageId,
      recipient: email
    };

  } catch (error) {
    console.error('❌ Error sending email:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Test email configuration
 * @returns {Promise<boolean>} - True if configured correctly
 */
const testEmailConfig = async () => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      return false;
    }

    await transporter.verify();
    console.log('✅ Email service is ready to send emails');
    return true;
  } catch (error) {
    console.error('❌ Email service configuration error:', error.message);
    return false;
  }
};

module.exports = {
  sendApprovalEmail,
  testEmailConfig
};
