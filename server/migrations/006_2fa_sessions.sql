-- ============================================================
-- Phase 3: 2FA TOTP + Session Management + Phone Auth
-- ============================================================

-- P3.3: 2FA (TOTP)
CREATE TABLE IF NOT EXISTS user_mfa (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  totp_secret VARCHAR(64) NOT NULL,
  is_enabled BOOLEAN DEFAULT false,
  backup_codes TEXT[], -- массив одноразовых кодов (хешированных)
  enabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- P3.5: Session Management
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(128) NOT NULL, -- SHA-256 хеш JWT
  device_name VARCHAR(200),
  device_type VARCHAR(50), -- 'web', 'desktop', 'mobile', 'api'
  ip_address VARCHAR(45),
  user_agent TEXT,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  is_revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, is_revoked);
CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);

-- P3.4: Phone Auth — добавить поле для верификации телефона
CREATE TABLE IF NOT EXISTS phone_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) NOT NULL,
  code VARCHAR(6) NOT NULL,
  attempts INT DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone ON phone_verifications(phone, used);
