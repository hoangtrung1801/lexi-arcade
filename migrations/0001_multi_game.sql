CREATE TABLE `sentences` (
	`id` integer PRIMARY KEY NOT NULL,
	`unit_id` integer NOT NULL,
	`word_id` integer NOT NULL,
	`en` text NOT NULL,
	`vi` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`word_id`) REFERENCES `words`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sentences_unit_idx` ON `sentences` (`unit_id`);--> statement-breakpoint
CREATE INDEX `sentences_word_idx` ON `sentences` (`word_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_user_unit_progress` (
	`user_id` text NOT NULL,
	`unit_id` integer NOT NULL,
	`game_id` text DEFAULT 'word-blaster' NOT NULL,
	`best_stars` integer DEFAULT 0 NOT NULL,
	`best_score` integer DEFAULT 0 NOT NULL,
	`best_wpm` real DEFAULT 0 NOT NULL,
	`plays` integer DEFAULT 0 NOT NULL,
	`completed_at` integer,
	PRIMARY KEY(`user_id`, `unit_id`, `game_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_user_unit_progress`("user_id", "unit_id", "game_id", "best_stars", "best_score", "best_wpm", "plays", "completed_at") SELECT "user_id", "unit_id", 'word-blaster', "best_stars", "best_score", "best_wpm", "plays", "completed_at" FROM `user_unit_progress`;--> statement-breakpoint
DROP TABLE `user_unit_progress`;--> statement-breakpoint
ALTER TABLE `__new_user_unit_progress` RENAME TO `user_unit_progress`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `game_sessions` ADD `sentence_ids_json` text;--> statement-breakpoint
ALTER TABLE `game_sessions` ADD `duration_ms` integer;--> statement-breakpoint
ALTER TABLE `game_sessions` ADD `ghost_json` text;--> statement-breakpoint
CREATE INDEX `gs_game_unit_duration_idx` ON `game_sessions` (`game_id`,`unit_id`,`duration_ms`);