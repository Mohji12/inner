-- Anonymous public page views for admin website analytics.
CREATE TABLE IF NOT EXISTS site_page_views (
    id CHAR(36) NOT NULL PRIMARY KEY,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    path VARCHAR(255) NOT NULL,
    session_key CHAR(36) NOT NULL,
    referrer_host VARCHAR(255) NULL,
    visitor_kind VARCHAR(16) NULL,
    KEY idx_site_page_views_created (created_at),
    KEY idx_site_page_views_session (session_key),
    KEY idx_site_page_views_path (path)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
