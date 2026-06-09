-- ============================================================
-- INFINITY LIQUOR SHOP — Complete Supabase Schema
-- Shop: 2975 Patterson Rd, Florissant, MO 63031
-- ============================================================

-- ============================================================
-- 1. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 2. PROFILES TABLE
-- Extends Supabase auth.users with extra customer info
-- ============================================================
CREATE TABLE public.profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT NOT NULL,
  phone           TEXT,
  date_of_birth   DATE NOT NULL,
  age_verified    BOOLEAN DEFAULT FALSE,
  street_address  TEXT,
  city            TEXT,
  state           TEXT,
  zip_code        TEXT,
  latitude        DECIMAL(10, 8),
  longitude       DECIMAL(11, 8),
  is_admin        BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. CATEGORIES TABLE
-- ============================================================
CREATE TABLE public.categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL UNIQUE,
  slug        TEXT NOT NULL UNIQUE,
  icon        TEXT,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default categories
INSERT INTO public.categories (name, slug, icon, sort_order) VALUES
  ('Whiskey',   'whiskey',   '🥃', 1),
  ('Vodka',     'vodka',     '🍸', 2),
  ('Rum',       'rum',       '🍹', 3),
  ('Tequila',   'tequila',   '🌵', 4),
  ('Gin',       'gin',       '🌿', 5),
  ('Wine',      'wine',      '🍷', 6),
  ('Beer',      'beer',      '🍺', 7),
  ('Champagne', 'champagne', '🥂', 8),
  ('Brandy',    'brandy',    '🍶', 9),
  ('Other',     'other',     '🍾', 10);

-- ============================================================
-- 4. PRODUCTS TABLE
-- ============================================================
CREATE TABLE public.products (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  description   TEXT,
  category_id   UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  price         DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  stock         INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image_url     TEXT,
  brand         TEXT,
  volume_ml     INT,
  abv           DECIMAL(5, 2),   -- Alcohol By Volume %
  is_featured   BOOLEAN DEFAULT FALSE,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. ORDERS TABLE
-- ============================================================
CREATE TABLE public.orders (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number        TEXT UNIQUE NOT NULL DEFAULT ('INF-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 8))),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  
  -- Delivery address snapshot at time of order
  delivery_address    TEXT NOT NULL,
  delivery_city       TEXT NOT NULL,
  delivery_state      TEXT NOT NULL,
  delivery_zip        TEXT NOT NULL,
  delivery_lat        DECIMAL(10, 8),
  delivery_lng        DECIMAL(11, 8),
  delivery_notes      TEXT,
  
  -- Financials
  subtotal            DECIMAL(10, 2) NOT NULL,
  cod_fee             DECIMAL(10, 2) DEFAULT 0,
  total               DECIMAL(10, 2) NOT NULL,
  
  -- Payment
  payment_method      TEXT NOT NULL CHECK (payment_method IN ('cod', 'apple_pay', 'card')),
  payment_status      TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'failed')),
  stripe_payment_id   TEXT,
  stripe_refund_id    TEXT,
  
  -- Order Status
  status              TEXT NOT NULL DEFAULT 'pending' CHECK (
                        status IN ('pending', 'accepted', 'preparing', 'dispatched', 'delivered', 'cancelled')
                      ),
  
  -- Timestamps per status
  accepted_at         TIMESTAMPTZ,
  preparing_at        TIMESTAMPTZ,
  dispatched_at       TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  cancel_reason       TEXT,
  
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. ORDER ITEMS TABLE
-- ============================================================
CREATE TABLE public.order_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES public.products(id) ON DELETE SET NULL,
  
  -- Snapshot at time of order (in case product changes later)
  product_name    TEXT NOT NULL,
  product_image   TEXT,
  unit_price      DECIMAL(10, 2) NOT NULL,
  quantity        INT NOT NULL CHECK (quantity > 0),
  line_total      DECIMAL(10, 2) NOT NULL,
  
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. PAYMENTS TABLE
-- For Stripe refund tracking
-- ============================================================
CREATE TABLE public.payments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id          UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  amount            DECIMAL(10, 2) NOT NULL,
  currency          TEXT DEFAULT 'usd',
  method            TEXT NOT NULL CHECK (method IN ('cod', 'apple_pay', 'card')),
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'refunded', 'failed')),
  stripe_id         TEXT,
  stripe_refund_id  TEXT,
  refund_reason     TEXT,
  refunded_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. SHOP SETTINGS TABLE
-- Owner can update from admin portal
-- ============================================================
CREATE TABLE public.shop_settings (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_name             TEXT DEFAULT 'Infinity Liquor Shop',
  shop_address          TEXT DEFAULT '2975 Patterson Rd, Florissant, MO 63031',
  shop_phone            TEXT DEFAULT '(314) 555-0100',
  shop_email            TEXT DEFAULT 'info@infinityliquor.com',
  shop_lat              DECIMAL(10, 8) DEFAULT 38.7895,
  shop_lng              DECIMAL(11, 8) DEFAULT -90.3227,
  delivery_radius_km    DECIMAL(5, 2) DEFAULT 10.0,
  cod_fee               DECIMAL(10, 2) DEFAULT 5.00,
  min_order_amount      DECIMAL(10, 2) DEFAULT 20.00,
  is_open               BOOLEAN DEFAULT TRUE,
  closed_message        TEXT DEFAULT 'We are currently closed. Please check back during business hours.',
  hours_mon             TEXT DEFAULT '10:00 AM - 9:00 PM',
  hours_tue             TEXT DEFAULT '10:00 AM - 9:00 PM',
  hours_wed             TEXT DEFAULT '10:00 AM - 9:00 PM',
  hours_thu             TEXT DEFAULT '10:00 AM - 9:00 PM',
  hours_fri             TEXT DEFAULT '10:00 AM - 9:00 PM',
  hours_sat             TEXT DEFAULT '10:00 AM - 9:00 PM',
  hours_sun             TEXT DEFAULT 'Closed',
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Seed shop settings
INSERT INTO public.shop_settings (id) VALUES (uuid_generate_v4());

-- ============================================================
-- 9. NOTIFICATIONS TABLE
-- For admin order notifications
-- ============================================================
CREATE TABLE public.notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type        TEXT NOT NULL CHECK (type IN ('new_order', 'cancelled_order', 'low_stock')),
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  order_id    UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. UPDATED_AT TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_products
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_orders
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_shop_settings
  BEFORE UPDATE ON public.shop_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 11. AUTO-CREATE PROFILE ON SIGNUP
-- Fires when a new user registers via Supabase Auth
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, date_of_birth, age_verified)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE((NEW.raw_user_meta_data->>'date_of_birth')::DATE, '2000-01-01'),
    FALSE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 12. REDUCE STOCK ON ORDER PLACEMENT
-- ============================================================
CREATE OR REPLACE FUNCTION public.reduce_stock_on_order()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.products
  SET stock = stock - NEW.quantity
  WHERE id = NEW.product_id AND stock >= NEW.quantity;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient stock for product %', NEW.product_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_order_item_inserted
  AFTER INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.reduce_stock_on_order();

-- ============================================================
-- 13. RESTORE STOCK ON ORDER CANCEL
-- ============================================================
CREATE OR REPLACE FUNCTION public.restore_stock_on_cancel()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    UPDATE public.products p
    SET stock = p.stock + oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id AND oi.product_id = p.id;
    
    -- Create notification
    INSERT INTO public.notifications (type, title, message, order_id)
    VALUES (
      'cancelled_order',
      'Order Cancelled',
      'Order ' || NEW.order_number || ' has been cancelled.',
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_order_cancelled
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.restore_stock_on_cancel();

-- ============================================================
-- 14. LOW STOCK NOTIFICATION (threshold: 5 units)
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_low_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.stock <= 5 AND OLD.stock > 5 THEN
    INSERT INTO public.notifications (type, title, message)
    VALUES (
      'low_stock',
      'Low Stock Alert',
      'Product "' || NEW.name || '" is low on stock (' || NEW.stock || ' units remaining).'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_low_stock
  AFTER UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.notify_low_stock();

-- ============================================================
-- 15. NEW ORDER NOTIFICATION
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (type, title, message, order_id)
  VALUES (
    'new_order',
    'New Order Received!',
    'Order ' || NEW.order_number || ' placed for $' || NEW.total || ' via ' || NEW.payment_method,
    NEW.id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_new_order
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_order();

-- ============================================================
-- 16. ROW LEVEL SECURITY POLICIES
-- ============================================================

-- ---- PROFILES ----
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- ---- PRODUCTS ----
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active products"
  ON public.products FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Admins can manage products"
  ON public.products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- ---- CATEGORIES ----
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view categories"
  ON public.categories FOR SELECT
  USING (TRUE);

CREATE POLICY "Admins can manage categories"
  ON public.categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- ---- ORDERS ----
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own orders"
  ON public.orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own orders"
  ON public.orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all orders"
  ON public.orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

CREATE POLICY "Admins can update all orders"
  ON public.orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- ---- ORDER ITEMS ----
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own order items"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = order_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own order items"
  ON public.order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE id = order_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all order items"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- ---- PAYMENTS ----
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all payments"
  ON public.payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- ---- SHOP SETTINGS ----
ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view shop settings"
  ON public.shop_settings FOR SELECT
  USING (TRUE);

CREATE POLICY "Admins can update shop settings"
  ON public.shop_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- ---- NOTIFICATIONS ----
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage notifications"
  ON public.notifications FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- ============================================================
-- 17. STORAGE BUCKET FOR PRODUCT IMAGES
-- Run this in Supabase Dashboard → Storage → New Bucket
-- OR via API — included here for reference
-- ============================================================
-- NOTE: Run these separately in the Supabase Storage UI:
-- Bucket name: product-images
-- Public: YES
-- File size limit: 5MB
-- Allowed MIME types: image/jpeg, image/png, image/webp

-- ============================================================
-- 18. INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX idx_products_category ON public.products(category_id);
CREATE INDEX idx_products_active ON public.products(is_active);
CREATE INDEX idx_products_featured ON public.products(is_featured);
CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);

-- ============================================================
-- 19. SAMPLE PRODUCTS (Optional — delete before production)
-- ============================================================
INSERT INTO public.products (name, description, category_id, price, stock, brand, volume_ml, abv, is_featured)
SELECT
  'Jack Daniel''s Old No. 7',
  'The iconic Tennessee whiskey. Smooth, mellow character with notes of vanilla and oak.',
  c.id, 34.99, 50, 'Jack Daniel''s', 750, 40.0, TRUE
FROM public.categories c WHERE c.slug = 'whiskey';

INSERT INTO public.products (name, description, category_id, price, stock, brand, volume_ml, abv, is_featured)
SELECT
  'Grey Goose Vodka',
  'Premium French vodka distilled from fine French wheat. Exceptionally smooth.',
  c.id, 44.99, 35, 'Grey Goose', 750, 40.0, TRUE
FROM public.categories c WHERE c.slug = 'vodka';

INSERT INTO public.products (name, description, category_id, price, stock, brand, volume_ml, abv, is_featured)
SELECT
  'Patron Silver Tequila',
  'Ultra-premium tequila with a smooth, sweet taste and light pepper finish.',
  c.id, 49.99, 28, 'Patron', 750, 40.0, TRUE
FROM public.categories c WHERE c.slug = 'tequila';

INSERT INTO public.products (name, description, category_id, price, stock, brand, volume_ml, abv, is_featured)
SELECT
  'Hennessy VS Cognac',
  'A blend of over 40 eaux-de-vie. Elegant and lively with fruity notes.',
  c.id, 39.99, 40, 'Hennessy', 750, 40.0, TRUE
FROM public.categories c WHERE c.slug = 'brandy';

INSERT INTO public.products (name, description, category_id, price, stock, brand, volume_ml, abv)
SELECT
  'Bacardi Superior Rum',
  'Light and clean rum. Perfect for cocktails or sipping straight.',
  c.id, 19.99, 60, 'Bacardi', 750, 37.5
FROM public.categories c WHERE c.slug = 'rum';

INSERT INTO public.products (name, description, category_id, price, stock, brand, volume_ml, abv)
SELECT
  'Bombay Sapphire Gin',
  'Premium gin with 10 exotic botanicals. Crisp and aromatic.',
  c.id, 29.99, 45, 'Bombay Sapphire', 750, 47.0
FROM public.categories c WHERE c.slug = 'gin';

INSERT INTO public.products (name, description, category_id, price, stock, brand, volume_ml, abv)
SELECT
  'Moët & Chandon Brut',
  'The world''s most celebrated champagne. Fresh, vibrant, and seductive.',
  c.id, 54.99, 20, 'Moët & Chandon', 750, 12.0
FROM public.categories c WHERE c.slug = 'champagne';

INSERT INTO public.products (name, description, category_id, price, stock, brand, volume_ml, abv)
SELECT
  'Cabernet Sauvignon Reserve',
  'Full-bodied red wine with rich dark fruit, cedar and tobacco notes.',
  c.id, 24.99, 55, 'Infinity Private Label', 750, 13.5
FROM public.categories c WHERE c.slug = 'wine';

-- ============================================================
-- DONE! 
-- Next Steps:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Paste this entire file and click RUN
-- 3. Go to Storage → Create bucket "product-images" (public)
-- 4. Go to Authentication → Settings → Enable Email confirmations OFF (for easy testing)
-- ============================================================