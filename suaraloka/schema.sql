CREATE TABLE IF NOT EXISTS articles (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 title TEXT NOT NULL,
 slug TEXT NOT NULL UNIQUE,
 excerpt TEXT NOT NULL DEFAULT '',
 body TEXT NOT NULL,
 category TEXT NOT NULL DEFAULT 'Umum',
 image TEXT NOT NULL DEFAULT '',
 author TEXT NOT NULL DEFAULT 'Redaksi Suaraloka',
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now')),
 published_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_articles_status_date ON articles(status,published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category,status);
