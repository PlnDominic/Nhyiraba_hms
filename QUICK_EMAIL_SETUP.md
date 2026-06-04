# ⚡ Quick Email Setup (5 Minutes)

## ✅ What You'll Get

When you approve a staff access request, they'll automatically receive an email with:
- Their login credentials
- Direct link to the system
- Security instructions

---

## 🚀 Setup Steps

### 1. Install Required Package

```bash
npm install nodemailer
```

### 2. Add to `.env` File

```env
# Email Configuration
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-16-char-app-password
FRONTEND_URL=http://localhost:3000
```

### 3. Get Gmail App Password

1. Visit: https://myaccount.google.com/apppasswords
2. Create app password for "Mail"
3. Copy the 16-character code
4. Paste into `EMAIL_PASSWORD` in `.env`

⚠️ **Important**: Use the App Password, NOT your regular Gmail password!

### 4. Restart Server

```bash
npm run dev
```

### 5. Test It

Visit: **http://localhost:5000/api/test-email**

Should show:
```json
{
  "configured": true,
  "message": "Email service is properly configured"
}
```

---

## 🧪 Try It Out

1. Go to **Access Control** in your app
2. Select a pending access request
3. Create the user account
4. Check the email inbox - you should see the approval email! ✉️

---

## ❓ Troubleshooting

**"Email service not configured"**
- Double-check your `.env` file has the email settings
- Restart the server after adding them

**"Invalid login"**
- Make sure you're using the **App Password**, not regular password
- Enable 2-Step Verification first

**Still not working?**
- Check out `EMAIL_SETUP_GUIDE.md` for detailed help

---

## 📧 Without Email Setup

If you don't configure email:
- ✅ Users can still be created
- ✅ Everything else works normally
- ℹ️ No emails will be sent (you'll need to share credentials manually)

---

**Ready?** Start with step 1 above! 🎉
