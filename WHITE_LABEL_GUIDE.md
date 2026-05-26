# White Label Guide — How to Deploy for a New Community

This app is built for white labeling. One codebase — unlimited community apps.
Change the brand name, community, and all company details from the Admin Panel.
No code changes needed.

---

## What White Label Means

When you deploy a fresh copy of this app for a new community:

- Every page shows the new brand name
- Every email says the new brand name
- Every invoice shows new company name, GST, logo, support email
- Every notification shows new brand name
- Registration shows only the communities admin added
- Data is completely separate from all other deployments

---

## Step 1 — Copy the Code

Copy the entire project folder to a new location.
Give it a new name — example: `patel-matrimony`

---

## Step 2 — Set Up Backend

```bash
cd backend
npm install
npx tsx scripts/setup.ts
```

When prompted:
- **Admin email:** Enter the new admin email (example: `admin@patelmatrimony.com`)
- **Admin password:** Enter a strong password (min 12 characters)

This generates a fresh `.env` file with new JWT secret and encryption key.
These are different from the original app — data cannot be shared between deployments.

---

## Step 3 — Set Up Frontend

Open `.env.local` in the project root. Change:

```
VITE_API_URL=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3000
```

---

## Step 4 — Start the App Locally

```bash
npm run dev
```

Open: `http://localhost:3000`

---

## Step 5 — Configure Brand via Admin Panel

Log in with the admin email and password you set in Step 2.

Go to **Admin Panel → General Settings → Company Information**

Fill in ALL fields:

| Field | Example Value |
|---|---|
| App / Brand Name | `Patel Matrimony` |
| Company Tagline | `Trusted Matrimonial for Patel Community` |
| Support Email | `support@patelmatrimony.com` |
| Support Phone | `+91 99999 88888` |
| WhatsApp Number | `+919999988888` |
| Company Address | `456 Patel House, Ahmedabad, Gujarat 380001` |
| Company Website | `www.patelmatrimony.com` |
| GST Number | `24XXXXX1234X1ZX` (leave blank if not registered) |
| Invoice Prefix | `PM` (gives invoice numbers like PM-XYZ123) |
| Invoice Logo | Upload your logo image |
| Email Sender Name | `Patel Matrimony` |

Click **Save Company Info**.

Everything in the app updates instantly — every page, every email, every invoice,
every notification now shows your new brand name.

---

## Step 6 — Add Your Community

Go to **Admin Panel → Community Management**

Click **Add Community** and fill in:
- **Community Name:** `Patel`
- **Sub-castes:** `Leva, Kadva, Anjana, Chaudhari` (press Enter after each)
- **Gotras:** `Kashyap, Vasishth, Bharadwaj` (press Enter after each)
- **Display Order:** `1`
- **Active:** ON

Click **Create Community**.

The registration page will now show your community in the dropdown.
Users can select it and see the correct sub-castes.

---

## Step 7 — Production Deployment

1. Update `backend/.env`:
   ```
   NODE_ENV=production
   FRONTEND_URL=https://yourdomain.com
   ```

2. Build the frontend:
   ```bash
   npm run build
   ```

3. Deploy the `dist/` folder to your hosting provider.

4. Deploy the `backend/` folder to your Node.js server.

---

## What Updates Automatically When You Change Brand Name

When admin changes **App / Brand Name** in Admin Panel:

| What updates | How |
|---|---|
| All page titles | Reads `platform_name` from settings |
| Browser tab title | SEOProvider reads `platform_name` |
| Logo text | Logo component reads `platform_name` |
| All emails (subject + body) | email.service.ts calls `getAppName()` |
| All invoices | AdminFinancials reads `brandName` |
| All notifications | AdminNotifications reads `brandName` |
| Checkout page | CheckoutPage reads `brandName` |
| Invoice filename | Uses `platform_name` to build filename |
| SMTP sender name | Synced automatically when brand name changes |
| Section headings (How it Works, etc.) | Auto-replaced in stored text |

---

## Checklist for New Deployment

- [ ] Copied project to new folder
- [ ] Ran `npx tsx scripts/setup.ts` with new admin credentials
- [ ] Started server — confirmed it runs on port 3000
- [ ] Logged in to Admin Panel
- [ ] Set App / Brand Name in Company Information
- [ ] Set Support Email, Phone, Address
- [ ] Set Invoice Prefix and uploaded Invoice Logo
- [ ] Added community with sub-castes and gotras
- [ ] Tested registration page — shows correct community
- [ ] Tested invoice download — filename shows brand name
- [ ] Configured SMTP for email sending
- [ ] Configured payment gateway

---

*This guide is part of the white label matrimonial platform.*
*One codebase. Unlimited communities.*

## Step 6 — Set Up Communities

Go to **Admin Panel → Community Management**

Add your communities:
1. Click **Add Community**
2. Enter community name, sub-castes, gotras
3. Set display order (1 = shown first)
4. Mark as **Active**

If you add only **ONE** community — the app works as a single-community app.
If you add **multiple** — users choose their community during registration.

---

## Step 7 — Configure Payments

Go to **Admin Panel → Payment Gateways**

Add your Razorpay account:
- **Key ID** (public key)
- **Key Secret** (kept on server, never shown to users)

---

## Step 8 — Configure Email

Go to **Admin Panel → General Settings → Email Section**

Enter your SMTP details:
- **SMTP Host** (example: `smtp.gmail.com`)
- **SMTP Port** (`587` for Gmail)
- **SMTP Username** (your Gmail address)
- **SMTP Password** (Gmail App Password)
- **From Name** (same as your brand name)

---

## Step 9 — Deploy to Production

**Backend → Render.com:**
1. Push the `backend` folder to GitHub (`.env` is excluded by `.gitignore` — never committed)
2. Create new Web Service on render.com
3. Connect GitHub repository
4. Add all environment variables from your `.env` file manually in Render dashboard
5. Deploy

**Frontend → Vercel.com:**
1. Push the project root to GitHub
2. Import project on vercel.com
3. Add environment variables:
   - `VITE_API_URL` = your Render backend URL
   - `VITE_SOCKET_URL` = your Render backend URL
4. Deploy

---

## Security — What Is Different Per Deployment

| What | Description |
|---|---|
| JWT Secret | Generated fresh by setup script — unique per deployment |
| Encryption Key | Generated fresh — unique per deployment |
| Admin Login | Your own email and password |
| Database | Completely separate JSON file — no data shared |
| Razorpay Keys | Your own payment account |
| Firebase Keys | Your own Firebase project (for push notifications) |
| SMTP | Your own email account |

No user data from one deployment can ever be accessed by another deployment.

---

## FAQ

**Q: Can I change the brand name later?**
A: Yes. Go to Admin Panel → Settings → Company Information → change App / Brand Name → Save. Everything updates instantly.

**Q: Does changing the name affect existing users?**
A: No. Their accounts, profiles, and messages are all safe. Only the display name changes.

**Q: Can I add more communities later?**
A: Yes. Admin Panel → Community Management → Add Community. Active communities appear immediately in the registration dropdown.

**Q: What if I only want one community?**
A: Just add one community in Community Management. The registration page will show only that community.

**Q: Are API keys safe?**
A: Yes. Razorpay `key_secret`, SMTP password, Firebase server key — none of these are ever sent to the browser. They stay on the server only.
