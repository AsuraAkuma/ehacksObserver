-- --------------------------------------------------------
-- Host:                         127.0.0.1
-- Server version:               10.11.14-MariaDB-0+deb12u2 - Debian 12
-- Server OS:                    debian-linux-gnu
-- HeidiSQL Version:             12.15.0.7171
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

-- Dumping structure for table eHacks.admin_roles
CREATE TABLE IF NOT EXISTS `admin_roles` (
  `role_id` bigint(20) NOT NULL AUTO_INCREMENT,
  `description` varchar(1000) NOT NULL,
  `permissions` text NOT NULL,
  `role_name` varchar(255) NOT NULL,
  `position` int(11) DEFAULT NULL,
  PRIMARY KEY (`role_id`),
  UNIQUE KEY `UK3votcvo0ajnc78ngrgxlu3bxf` (`role_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table eHacks.admins
CREATE TABLE IF NOT EXISTS `admins` (
  `admin_id` bigint(20) NOT NULL AUTO_INCREMENT,
  `changed_password` bit(1) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `permissions` text NOT NULL,
  `role_ids` varchar(255) DEFAULT NULL,
  `username` varchar(255) DEFAULT NULL,
  `password_reset_token` varchar(255) DEFAULT NULL,
  `token_expiry` datetime(6) DEFAULT NULL,
  `discord_id` varchar(255) NOT NULL,
  PRIMARY KEY (`admin_id`),
  UNIQUE KEY `UK47bvqemyk6vlm0w7crc3opdd4` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table eHacks.challenge_completions
CREATE TABLE IF NOT EXISTS `challenge_completions` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `completion_time` datetime(6) NOT NULL,
  `challenge_id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `FKhllbymf6tevg6ohqxcv25dbkk` (`challenge_id`),
  KEY `FKnw2c5lwdqutkijvocddgm7cq7` (`user_id`),
  CONSTRAINT `FKhllbymf6tevg6ohqxcv25dbkk` FOREIGN KEY (`challenge_id`) REFERENCES `challenges` (`id`),
  CONSTRAINT `FKnw2c5lwdqutkijvocddgm7cq7` FOREIGN KEY (`user_id`) REFERENCES `registrations` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table eHacks.challenges
CREATE TABLE IF NOT EXISTS `challenges` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `description` varchar(1000) NOT NULL,
  `name` varchar(255) NOT NULL,
  `points` int(11) NOT NULL,
  `is_hidden` bit(1) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table eHacks.commits
CREATE TABLE IF NOT EXISTS `commits` (
  `commit_id` int(11) NOT NULL,
  `installation_id` int(11) NOT NULL,
  `commit_message` text NOT NULL,
  `push_id` int(11) NOT NULL,
  `repo_id` int(11) NOT NULL,
  `author_email` varchar(50) NOT NULL,
  `author_username` varchar(50) NOT NULL,
  PRIMARY KEY (`commit_id`),
  KEY `installation_id` (`installation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table eHacks.event_details
CREATE TABLE IF NOT EXISTS `event_details` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `event_end_date` date NOT NULL,
  `event_host` varchar(255) NOT NULL,
  `event_location` varchar(255) NOT NULL,
  `event_start_date` date NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table eHacks.faq_questions
CREATE TABLE IF NOT EXISTS `faq_questions` (
  `question_id` bigint(20) NOT NULL AUTO_INCREMENT,
  `answer_text` varchar(2000) NOT NULL,
  `question_text` varchar(500) NOT NULL,
  PRIMARY KEY (`question_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table eHacks.judge_questions
CREATE TABLE IF NOT EXISTS `judge_questions` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `display_order` int(11) NOT NULL,
  `is_active` bit(1) NOT NULL,
  `label` varchar(255) NOT NULL,
  `project_category` varchar(50) NOT NULL,
  `question_key` varchar(100) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  `description` varchar(1000) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table eHacks.judge_submissions
CREATE TABLE IF NOT EXISTS `judge_submissions` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `answers_json` text NOT NULL,
  `comments` text DEFAULT NULL,
  `created_at` datetime(6) NOT NULL,
  `is_draft` bit(1) NOT NULL,
  `judge_id` bigint(20) NOT NULL,
  `project_category` varchar(50) NOT NULL,
  `submitted_at` datetime(6) DEFAULT NULL,
  `team_id` bigint(20) NOT NULL,
  `total_points` int(11) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_judge_team_submission` (`judge_id`,`team_id`),
  KEY `FK_judge_submissions_teams` (`team_id`),
  CONSTRAINT `FK_judge_submissions_teams` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table eHacks.judges
CREATE TABLE IF NOT EXISTS `judges` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `email` varchar(255) NOT NULL,
  `is_active` bit(1) NOT NULL,
  `login_code` varchar(18) NOT NULL,
  `name` varchar(150) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKhw56kuuib2andchdcvmwoo9to` (`email`),
  UNIQUE KEY `UK6ifw99wsyihi3xdcwfabto5j5` (`login_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table eHacks.registrations
CREATE TABLE IF NOT EXISTS `registrations` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `first_name` varchar(50) NOT NULL,
  `last_name` varchar(50) NOT NULL,
  `email` varchar(255) NOT NULL,
  `allergies` varchar(255) DEFAULT NULL,
  `major` varchar(100) NOT NULL,
  `public_list` bit(1) DEFAULT NULL,
  `school` varchar(100) NOT NULL,
  `school_year` varchar(10) NOT NULL,
  `shirt_size` tinyint(4) NOT NULL,
  `needs_transport` bit(1) NOT NULL DEFAULT b'0',
  `resume` varchar(200) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `profile_picture_url` varchar(255) DEFAULT NULL,
  `checked_in` bit(1) NOT NULL DEFAULT b'0',
  `password_reset_token` varchar(255) DEFAULT NULL,
  `token_expiry` datetime(6) DEFAULT NULL,
  `alt_name` varchar(100) DEFAULT NULL,
  `alt_color_background` varchar(7) DEFAULT NULL,
  `alt_color_foreground` varchar(7) DEFAULT NULL,
  `alt_profile_picture_url` varchar(255) DEFAULT NULL,
  `privacy_public_name` bit(1) NOT NULL DEFAULT b'1',
  `privacy_public_profile_picture` bit(1) NOT NULL DEFAULT b'1',
  `github_username` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UKkl9n0mqlywhdcxr2hb9f68yss` (`email`),
  KEY `FKgqqslnk13f2pmggo6kas2hnr6` (`shirt_size`),
  CONSTRAINT `FKgqqslnk13f2pmggo6kas2hnr6` FOREIGN KEY (`shirt_size`) REFERENCES `shirt_sizes` (`size_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table eHacks.schedule_events
CREATE TABLE IF NOT EXISTS `schedule_events` (
  `event_id` bigint(20) NOT NULL AUTO_INCREMENT,
  `event_name` varchar(100) NOT NULL,
  `event_start_time` bigint(20) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`event_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table eHacks.shirt_sizes
CREATE TABLE IF NOT EXISTS `shirt_sizes` (
  `size_id` tinyint(4) NOT NULL AUTO_INCREMENT,
  `size_amount` smallint(6) NOT NULL,
  `size_name` varchar(255) NOT NULL,
  PRIMARY KEY (`size_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table eHacks.site_notifications
CREATE TABLE IF NOT EXISTS `site_notifications` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) NOT NULL,
  `display_order` int(11) NOT NULL,
  `ends_at` datetime(6) DEFAULT NULL,
  `is_active` bit(1) NOT NULL,
  `message` varchar(2000) NOT NULL,
  `severity` varchar(20) NOT NULL,
  `starts_at` datetime(6) DEFAULT NULL,
  `title` varchar(200) NOT NULL,
  `updated_at` datetime(6) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table eHacks.sponsors
CREATE TABLE IF NOT EXISTS `sponsors` (
  `sponsor_id` bigint(20) NOT NULL AUTO_INCREMENT,
  `sponsor_level` int(11) NOT NULL,
  `sponsor_logo_url` varchar(255) DEFAULT NULL,
  `sponsor_name` varchar(100) NOT NULL,
  `website_url` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`sponsor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table eHacks.SPRING_SESSION
CREATE TABLE IF NOT EXISTS `SPRING_SESSION` (
  `PRIMARY_ID` char(36) NOT NULL,
  `SESSION_ID` char(36) NOT NULL,
  `CREATION_TIME` bigint(20) NOT NULL,
  `LAST_ACCESS_TIME` bigint(20) NOT NULL,
  `MAX_INACTIVE_INTERVAL` int(11) NOT NULL,
  `EXPIRY_TIME` bigint(20) NOT NULL,
  `PRINCIPAL_NAME` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`PRIMARY_ID`),
  UNIQUE KEY `SPRING_SESSION_IX1` (`SESSION_ID`),
  KEY `SPRING_SESSION_IX2` (`EXPIRY_TIME`),
  KEY `SPRING_SESSION_IX3` (`PRINCIPAL_NAME`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci ROW_FORMAT=DYNAMIC;

-- Data exporting was unselected.

-- Dumping structure for table eHacks.SPRING_SESSION_ATTRIBUTES
CREATE TABLE IF NOT EXISTS `SPRING_SESSION_ATTRIBUTES` (
  `SESSION_PRIMARY_ID` char(36) NOT NULL,
  `ATTRIBUTE_NAME` varchar(200) NOT NULL,
  `ATTRIBUTE_BYTES` blob NOT NULL,
  PRIMARY KEY (`SESSION_PRIMARY_ID`,`ATTRIBUTE_NAME`),
  CONSTRAINT `SPRING_SESSION_ATTRIBUTES_FK` FOREIGN KEY (`SESSION_PRIMARY_ID`) REFERENCES `SPRING_SESSION` (`PRIMARY_ID`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci ROW_FORMAT=DYNAMIC;

-- Data exporting was unselected.

-- Dumping structure for table eHacks.team_members
CREATE TABLE IF NOT EXISTS `team_members` (
  `user_id` bigint(20) NOT NULL,
  `is_captain` bit(1) NOT NULL DEFAULT b'0',
  `is_vice_captain` bit(1) NOT NULL DEFAULT b'0',
  `points` int(11) NOT NULL,
  `role` varchar(100) DEFAULT NULL,
  `team_id` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  KEY `FK_TeamMember_Team` (`team_id`),
  CONSTRAINT `FK_TeamMember_Registration` FOREIGN KEY (`user_id`) REFERENCES `registrations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `FK_TeamMember_Team` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table eHacks.team_requests
CREATE TABLE IF NOT EXISTS `team_requests` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `expiry_timestamp` datetime(6) NOT NULL,
  `status` varchar(255) NOT NULL,
  `team_id` bigint(20) NOT NULL,
  `user_id` bigint(20) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

-- Dumping structure for table eHacks.teams
CREATE TABLE IF NOT EXISTS `teams` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `devpost_link` varchar(255) DEFAULT NULL,
  `github_repo` varchar(255) DEFAULT NULL,
  `invite_code` varchar(50) NOT NULL,
  `name` varchar(100) NOT NULL,
  `total_points` int(11) NOT NULL,
  `looking_for` varchar(255) NOT NULL,
  `request_status` varchar(255) NOT NULL,
  `rank` int(11) DEFAULT NULL,
  `installation_id` int(11) DEFAULT NULL,
  `project_category` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UK9in08syd61oyydey3f63ai6x9` (`invite_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Data exporting was unselected.

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
