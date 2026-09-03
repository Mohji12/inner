-- Original photo + last crop framing so coaches and admins can re-edit profile/banner.
-- Safe to skip if columns already exist (then this ALTER will error — ignore / use startup DDL).

ALTER TABLE mentors
  ADD COLUMN profile_image_original VARCHAR(512) NULL AFTER profile_image,
  ADD COLUMN profile_image_crop JSON NULL AFTER profile_image_original,
  ADD COLUMN banner_image_original VARCHAR(512) NULL AFTER banner_image,
  ADD COLUMN banner_image_crop JSON NULL AFTER banner_image_original;
