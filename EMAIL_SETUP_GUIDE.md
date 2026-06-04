# Email Notification Setup Guide

This guide explains how to set up email notifications for staff access request approvals in Nhyiraba HMS.

## 📧 Overview

When an administrator approves a staff access request, the system automatically sends an email to the staff member containing:
- Welcome message
- Login credentials (email and password)
- Security recommendations
- Direct link to login

---

## 🚀 Quick Setup (Gmail Example)

### Step 1: Install Dependencies

```bash
npm install nodemailer
```

### Step 2: Configure Environment Variables

Add these to your `.env` file:

```env
# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:3000
```

### Step 3: Generate Gmail App Password

1. Go to your **Google Account Settings**: https://myaccount.google.com/
2. Navigate to **Security** → **2-Step Verification** (enable if not already)
3. Scroll down to **App passwords**
4. Create a new app password:
   - Select app: **Mail**
   - Select device: **Other** (enter "Nhyiraba HMS")
5. Copy the 16-character password
6. Use this password in `EMAIL_PASSWORD` environment variable

### Step 4: Restart Server

```bash
npm run dev
```

### Step 5: Test Email Configuration

Visit: http://localhost:5000/api/test-email

You should see:
```json
{
  "success": true,
  "configured": true,
  "message": "Email service is properly configured"
}
```

---

## 📧 Supported Email Services

### Gmail

```env
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
```

### Outlook/Hotmail

```env
EMAIL_SERVICE=outlook
EMAIL_USER=your-email@outlook.com
EMAIL_PASSWORD=your-password
```

### Yahoo Mail

```env
EMAIL_SERVICE=yahoo
EMAIL_USER=your-email@yahoo.com
EMAIL_PASSWORD=your-app-password
```

### Custom SMTP Server

For custom email servers, modify `server/emailService.js`:

```javascript
const transporter = nodemailer.createTransporter({
  host: 'smtp.yourdomain.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});
```

---

## 🧪 Testing

### Test Email Configuration

```bash
curl http://localhost:5000/api/test-email
```

### Send Test Approval Email

```bash
curl -X POST http://localhost:5000/api/send-approval-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "fullName": "Test User",
    "password": "TestPass123",
    "hotelName": "Nhyiraba Hotel"
  }'
```

---

## 🔧 Troubleshooting

### Error: "Email service not configured"

**Problem**: Environment variables not set

**Solution**: 
1. Check `.env` file has `EMAIL_USER` and `EMAIL_PASSWORD`
2. Restart the server after adding variables
3. Verify with: `http://localhost:5000/api/test-email`

### Error: "Invalid login" or "Authentication failed"

**Problem**: Incorrect credentials or app password not used

**Solution for Gmail**:
1. Make sure 2-Step Verification is enabled
2. Generate a new App Password (16 characters)
3. Use the app password, NOT your regular Gmail password
4. Remove any spaces from the app password

**Solution for Outlook**:
1. Ensure "Less secure apps" is enabled
2. Or use OAuth2 authentication

### Error: "Connection timeout"

**Problem**: Firewall or network blocking SMTP

**Solution**:
1. Check firewall settings
2. Try different SMTP ports (587, 465, 25)
3. Ensure your network allows outbound SMTP connections

### Emails Not Being Received

**Checklist**:
- ✅ Check spam/junk folder
- ✅ Verify recipient email is correct
- ✅ Check server logs for email send confirmation
- ✅ Test with `http://localhost:5000/api/test-email`
- ✅ Try sending to a different email address

---

## 📝 How It Works

### Approval Flow

```
1. Admin approves access request
   ↓
2. System creates user account
   ↓
3. System updates request status to "approved"
   ↓
4. System sends email with credentials
   ↓
5. Staff receives email and logs in
```

### Email Template

The email includes:
- **Professional design** with hotel branding
- **Login credentials** clearly displayed
- **Security warnings** about password changes
- **Direct login link** to the system
- **Responsive HTML** (works on mobile)

---

## 🔐 Security Best Practices

### For Administrators

1. **Never log passwords** in production
2. **Use app-specific passwords**, not main account passwords
3. **Rotate email credentials** regularly
4. **Monitor email sending** for suspicious activity
5. **Use HTTPS** in production for FRONTEND_URL

### For Staff

Emails include reminders to:
- Change password after first login
- Never share credentials
- Keep the email secure or delete it
- Report suspicious activity

---

## 🌐 Production Deployment

### Environment Variables for Production

```env
# Production Email Settings
EMAIL_SERVICE=gmail
EMAIL_USER=noreply@yourdomain.com
EMAIL_PASSWORD=your-secure-app-password
FRONTEND_URL=https://your-production-url.com

# Sender Name (optional)
SENDER_NAME=Nhyiraba HMS
```

### Using a Dedicated Email Service

For production, consider using:

1. **SendGrid** (recommended)
   - High deliverability
   - Free tier: 100 emails/day
   - Easy API integration

2. **Amazon SES**
   - Cost-effective for high volume
   - Reliable delivery

3. **Mailgun**
   - Developer-friendly
   - Good analytics

4. **Resend** (modern alternative)
   - Simple API
   - Free tier available

---

## 🆘 Support

If you encounter issues:

1. Check server logs: `console.log` output when sending emails
2. Test email configuration: `http://localhost:5000/api/test-email`
3. Verify environment variables are loaded: Check server startup logs
4. Review this guide's troubleshooting section

---

## 📚 Additional Resources

- [Nodemailer Documentation](https://nodemailer.com/about/)
- [Gmail App Passwords](https://support.google.com/accounts/answer/185833)
- [Outlook SMTP Settings](https://support.microsoft.com/en-us/office/pop-imap-and-smtp-settings-8361e398-8af4-4e97-b147-6c6c4ac95353)

---

**Last Updated**: 2025-11-09  
**Version**: 1.0.0
