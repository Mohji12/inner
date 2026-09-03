-- Ensure password_reset:{user|mentor} OTP roles fit (was VARCHAR(16) in 003).
ALTER TABLE email_otp_codes MODIFY COLUMN role VARCHAR(32) NOT NULL COMMENT 'user|mentor|password_reset:user|password_reset:mentor';

-- Clean truncated historical rows that block verify lookups.
DELETE FROM email_otp_codes WHERE role = 'password_reset:m';
