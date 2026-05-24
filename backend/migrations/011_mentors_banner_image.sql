-- Mentor banner image URL (Cloudinary or local). Aligns ORM with DB.
-- Run against your `therapy` database after 010_mollie_mentor_fees.sql (or any prior state).
-- Safe to skip if `banner_image` already exists (then this ALTER will error — ignore).

SET NAMES utf8mb4;

ALTER TABLE mentors
  ADD COLUMN banner_image VARCHAR(512) NULL AFTER profile_image;
