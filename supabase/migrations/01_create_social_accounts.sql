-- Create social_accounts table
-- Handles storage of encrypted tokens for Meta, TikTok, and Restream
CREATE TABLE IF NOT EXISTS public.social_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    -- Currently linking to Mock ID "1" or UUID strings
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('meta', 'tiktok', 'restream')),
    -- Security: Tokens are encrypted at rest using AES-GCM (client-side)
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT,
    iv TEXT NOT NULL,
    -- Initialization Vector required for decryption
    scopes TEXT,
    -- JSON string or comma-separated list of scopes granted
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    -- Compuesto único para evitar duplicados por plataforma/usuario
    UNIQUE(user_id, platform)
);
-- RLS Policies (Optional but recommended if RLS is enabled)
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
-- Allow reading own accounts
CREATE POLICY "Users can view own social accounts" ON public.social_accounts FOR
SELECT USING (
        user_id = auth.uid()::text
        OR user_id = '1'
    );
-- Allow Mock ID "1" for dev
-- Allow inserting/updating own accounts
CREATE POLICY "Users can insert own social accounts" ON public.social_accounts FOR
INSERT WITH CHECK (
        user_id = auth.uid()::text
        OR user_id = '1'
    );
CREATE POLICY "Users can update own social accounts" ON public.social_accounts FOR
UPDATE USING (
        user_id = auth.uid()::text
        OR user_id = '1'
    );
CREATE POLICY "Users can delete own social accounts" ON public.social_accounts FOR DELETE USING (
    user_id = auth.uid()::text
    OR user_id = '1'
);