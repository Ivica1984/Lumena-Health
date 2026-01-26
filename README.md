
# Swiss Health Flow – Ready-to-run Site (local or any host)

## Run locally
1) Install Node 18+
2) In this folder:
   ```
   npm install
   npm start
   ```
3) Open http://localhost:3000

## Configure (optional)
- PUBLIC_BASE_URL = http://localhost:3000
- STRIPE_SECRET_KEY = sk_test_...
- STRIPE_WEBHOOK_SECRET = whsec_...
- STRIPE_PAYMENT_LINK = https://buy.stripe.com/...
- NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE for PDF uploads
- OPENAI_API_KEY, OPENAI_MODEL

API endpoints:
- POST /api/checkout         → returns { url } for payment
- POST /api/files/signed-upload → returns { url, key } for PDF upload to Supabase
- POST /api/ai/comment       → returns { text } AI comment
