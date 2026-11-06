ALTER TABLE `organizations` ADD `logo_key` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `brand_color` text DEFAULT '#0d5f4c' NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `accent_color` text DEFAULT '#b98132' NOT NULL;