# Infinity Liquor Shop Setup

## 1. Supabase

1. Run `supabase/schema.sql` in Supabase SQL Editor.
2. Run `supabase/post_setup.sql` after that.
3. Create a normal account from the website signup form.
4. Make that account an admin in Supabase SQL Editor:

```sql
UPDATE public.profiles AS p
SET is_admin = TRUE
FROM auth.users AS u
WHERE p.id = u.id
  AND u.email = 'owner@example.com';
```

Replace `owner@example.com` with your real owner email.

## 2. Local test

Open `index.html` in a browser for the customer website.

Open `admin/index.html` for the hidden admin portal.

Customer flow:

1. Pass age verification.
2. Sign up or sign in.
3. Add products to cart.
4. Enter delivery coordinates or use Detect.
5. Place order with Cash on Delivery.

Admin flow:

1. Sign in at `admin/index.html`.
2. View pending orders.
3. Mark orders accepted, preparing, dispatched, delivered, or cancelled.
4. Add/edit products and stock.

## 3. Deploy

Use Netlify or Vercel as a static site.

For Netlify:

1. Drag the project folder into Netlify Drop, or connect the folder through Git.
2. Build command: leave empty.
3. Publish directory: project root.

For Vercel:

1. Import the project.
2. Framework preset: Other.
3. Build command: leave empty.
4. Output directory: `.`.

## 4. Apple Pay

Apple Pay cannot be completed safely with only frontend HTML/JS. Production Apple Pay requires:

1. Stripe account.
2. Apple merchant domain verification.
3. A server endpoint or Supabase Edge Function to create a Stripe PaymentIntent.
4. Refund handling from server-side Stripe APIs.

The current site keeps Apple Pay visible but blocks checkout until that secure server flow is added. Cash on Delivery is fully wired.
