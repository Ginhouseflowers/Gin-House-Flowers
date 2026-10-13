# Connect your Stripe account — Gin House Flowers

The online shop is already built for Stripe Checkout. You only need to **paste your API key** and **deploy** (or run locally).

---

## Step 1 — Copy your Stripe secret key

1. Log in to [Stripe Dashboard](https://dashboard.stripe.com)
2. Stay in **Test mode** while testing (toggle top-right)
3. Go to **Developers** → **API keys**
4. Under **Secret key**, click **Reveal** and copy the key (starts with `sk_test_`)

---

## Step 2 — Add the key to this project

Open the file **`.env`** in the website folder and paste your key after the `=` sign:

```env
STRIPE_SECRET_KEY=sk_test_paste_your_key_here
URL=http://localhost:8888
```

Save the file. **Never commit `.env` to Git** (it is already in `.gitignore`).

---

## Step 3 — Test on your computer

In Terminal, from the website folder:

```bash
npm install
npm start
```

You may see yellow **deprecated** warnings during `npm install` — those are usually safe to ignore if the command finishes without **red** errors.

Open **http://localhost:8888/online-shop.html**

1. Add a bouquet to the basket  
2. Click **Pay securely**  
3. Use test card: **4242 4242 4242 4242**, any future date, any CVC  

You should return to the “Payment received” page.

---

## Step 4 — Go live on the web (Netlify)

Payments only work when the site is hosted with the API — not when opening HTML files directly.

1. Sign up at [netlify.com](https://www.netlify.com) (free tier is fine)
2. Deploy this folder:
   - Drag the website folder onto Netlify, **or**
   - Connect your Git repository
3. In Netlify → **Site configuration** → **Environment variables**, add:

   | Name | Value |
   |------|--------|
   | `STRIPE_SECRET_KEY` | Your `sk_test_…` key (later `sk_live_…` when live) |
   | `URL` | `https://www.ginhouseflowers.co.uk` (your real domain, no trailing slash) |
   | `STRIPE_WEBHOOK_SECRET` | From Stripe webhook setup (see below) |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Your mailbox's outgoing (SMTP) settings — see "Email setup" below |
   | `ORDER_NOTIFY_EMAIL` | Where order emails go, e.g. `info@ginhouseflowers.co.uk` |

4. Click **Deploy** / trigger a new deploy

5. Visit `https://your-site.netlify.app/online-shop.html` (or your custom domain) and test again

---

## Step 5 — Switch to live payments

When Stripe has verified your business and you are ready for real cards:

1. Stripe Dashboard → turn off **Test mode**
2. Copy the **live** secret key (`sk_live_…`)
3. Update `STRIPE_SECRET_KEY` in Netlify environment variables
4. Redeploy the site

---

## Order email notifications (recommended)

When someone pays, an email is sent to your shop inbox with the full order details.

### 1 — Email setup (sends the emails from your own mailbox)

Emails are sent through an ordinary mailbox on your domain — no extra service needed.

1. In your email host's control panel (e.g. cPanel → **Email Accounts**), create a mailbox just for the website, e.g. `website@ginhouseflowers.co.uk`, with a strong password
2. Find its **outgoing (SMTP) server** settings (cPanel: **Connect Devices** / "Mail Client Manual Settings") — usually server `mail.ginhouseflowers.co.uk`, port `465`, SSL
3. In Vercel → **Settings** → **Environment Variables**, add:
   - `SMTP_HOST` = `mail.ginhouseflowers.co.uk`
   - `SMTP_PORT` = `465`
   - `SMTP_USER` = `website@ginhouseflowers.co.uk`
   - `SMTP_PASS` = that mailbox's password
   - `ORDER_NOTIFY_EMAIL` = `info@ginhouseflowers.co.uk` (or your preferred inbox)
4. Redeploy

If sending fails with a connection or login error, ask your host whether outgoing SMTP from external servers is allowed for that mailbox (some hosts block it by default). Resend can still be used instead by setting `RESEND_API_KEY` and leaving the `SMTP_` settings blank.

### 2 — Stripe webhook (triggers the email)

1. Stripe Dashboard → **Developers** → **Webhooks** → **Add endpoint**
2. **Endpoint URL:** `https://www.ginhouseflowers.co.uk/api/stripe-webhook`  
   (use your Netlify URL if the custom domain is not live yet)
3. **Events:** select `checkout.session.completed`
4. Click **Add endpoint**, then **Reveal** the signing secret (`whsec_…`)
5. Add `STRIPE_WEBHOOK_SECRET` in Netlify (same value as the signing secret)
6. Redeploy the site

After a test order, check your inbox and **Netlify → Functions → stripe-webhook** logs if nothing arrives.

---

## Contact page enquiries

The contact and Flower School forms send enquiries to **info@ginhouseflowers.co.uk** using the same email setup:

1. Add the `SMTP_` settings to `.env` (local) or Vercel (live) — see above
2. Optionally set `CONTACT_NOTIFY_EMAIL=info@ginhouseflowers.co.uk` (defaults to `ORDER_NOTIFY_EMAIL`)
3. Test at `/contact.html` — submissions go to your inbox; **Reply** uses the customer’s email address

Without email settings, the form shows a message asking visitors to email or call you instead.

---

## Where orders appear

- **Your email inbox** — notification sent to `ORDER_NOTIFY_EMAIL` (when email + webhook are configured)
- **Stripe Dashboard** → **Payments** — every successful checkout  
- Customer details, address, metadata (collection/delivery, dates), and card message are on the payment record  

---

## Troubleshooting

| Message | Fix |
|---------|-----|
| Payments are not configured | Add `STRIPE_SECRET_KEY` to `.env` (local) or Netlify (live) |
| Checkout button does nothing | Use `npm start` or Netlify — not `file://` |
| Invalid API key | Check you copied the full secret key with no spaces |
| Wrong URL after payment | Set `URL` in Netlify to your exact public site address |
| No order email received | Add `STRIPE_WEBHOOK_SECRET`, the `SMTP_` settings, and `ORDER_NOTIFY_EMAIL`; check webhook logs |

---

## Need help?

Call Stripe support from your Dashboard, or email your web host with this file.
