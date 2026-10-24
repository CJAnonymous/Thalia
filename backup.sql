-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: thalia_grocery
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `thalia_grocery`
--

/*!40000 DROP DATABASE IF EXISTS `thalia_grocery`*/;

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `thalia_grocery` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */;

USE `thalia_grocery`;

--
-- Table structure for table `store_debts`
--

DROP TABLE IF EXISTS `store_debts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `store_debts` (
  `id` varchar(64) NOT NULL,
  `customer` varchar(200) NOT NULL,
  `amount` decimal(12,2) NOT NULL,
  `paid` decimal(12,2) NOT NULL DEFAULT 0.00,
  `note` text NOT NULL,
  `updated_at` datetime(3) NOT NULL,
  `last_charge_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `last_charge_date` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_debts_customer` (`customer`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `store_debts`
--

LOCK TABLES `store_debts` WRITE;
/*!40000 ALTER TABLE `store_debts` DISABLE KEYS */;
INSERT INTO `store_debts` VALUES ('d1','Maria Santos',640.00,200.00,'Rice, eggs, and cooking oil','2026-10-07 01:30:00.000',0.00,NULL),('d2','Jun Reyes',380.00,0.00,'Weekly groceries','2026-10-07 02:15:00.000',0.00,NULL),('d3','Aling Nena',520.00,220.00,'Milk and pantry items','2026-10-06 08:00:00.000',0.00,NULL);
/*!40000 ALTER TABLE `store_debts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `store_meta`
--

DROP TABLE IF EXISTS `store_meta`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `store_meta` (
  `meta_key` varchar(64) NOT NULL,
  `meta_value` varchar(255) NOT NULL,
  PRIMARY KEY (`meta_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `store_meta`
--

LOCK TABLES `store_meta` WRITE;
/*!40000 ALTER TABLE `store_meta` DISABLE KEYS */;
INSERT INTO `store_meta` VALUES ('initialized','1');
/*!40000 ALTER TABLE `store_meta` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `store_products`
--

DROP TABLE IF EXISTS `store_products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `store_products` (
  `id` varchar(64) NOT NULL,
  `name` varchar(200) NOT NULL,
  `sku` varchar(100) NOT NULL DEFAULT '',
  `category` varchar(120) NOT NULL,
  `price` decimal(12,2) NOT NULL,
  `stock` int(10) unsigned NOT NULL DEFAULT 0,
  `unit` varchar(40) NOT NULL DEFAULT 'pc',
  PRIMARY KEY (`id`),
  KEY `idx_products_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `store_products`
--

LOCK TABLES `store_products` WRITE;
/*!40000 ALTER TABLE `store_products` DISABLE KEYS */;
INSERT INTO `store_products` VALUES ('p1','Jasmine Rice','GRN-001','Grains',58.00,32,'kg'),('p2','Fresh Eggs','DAI-004','Dairy & eggs',12.00,47,'pc'),('p3','Whole Milk','DAI-012','Dairy & eggs',92.00,7,'bottle'),('p4','Lucky Me Pancit Canton','INS-021','Instant food',16.00,27,'pack'),('p5','Cooking Oil','PAN-009','Pantry',48.00,12,'bottle'),('p6','White Sugar','PAN-014','Pantry',42.00,17,'kg'),('p7','Canned Sardines','TIN-003','Canned goods',27.00,2,'can'),('p8','Mineral Water','DRK-008','Drinks',20.00,31,'bottle');
/*!40000 ALTER TABLE `store_products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `store_sales`
--

DROP TABLE IF EXISTS `store_sales`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `store_sales` (
  `id` varchar(64) NOT NULL,
  `sale_id` varchar(64) DEFAULT NULL,
  `product_id` varchar(64) DEFAULT NULL,
  `product_name` varchar(200) NOT NULL,
  `customer_name` varchar(200) DEFAULT NULL,
  `quantity` int(10) unsigned NOT NULL DEFAULT 1,
  `total` decimal(12,2) NOT NULL,
  `type` varchar(20) NOT NULL DEFAULT 'sale',
  `occurred_at` datetime(3) NOT NULL,
  `payment_method` varchar(20) NOT NULL DEFAULT 'cash',
  `amount_received` decimal(12,2) NOT NULL DEFAULT 0.00,
  `change_due` decimal(12,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `idx_sales_date` (`occurred_at`),
  KEY `idx_sales_type` (`type`),
  KEY `idx_sales_receipt` (`sale_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `store_sales`
--

LOCK TABLES `store_sales` WRITE;
/*!40000 ALTER TABLE `store_sales` DISABLE KEYS */;
INSERT INTO `store_sales` VALUES ('2996a9c4-56e5-40fd-b53a-de85745f6304','9f7efaa9-cb05-4b4d-8139-018cf699368d','p6','White Sugar',NULL,1,42.00,'sale','2026-10-07 06:01:21.745','cash',0.00,0.00),('360e2771-8416-456d-8503-ff7e97ef2b53','360e2771-8416-456d-8503-ff7e97ef2b53','p2','Fresh Eggs',NULL,1,12.00,'sale','2026-10-07 05:37:51.243','cash',0.00,0.00),('5b6e707c-2698-44e6-bdd7-c619de6d711a','1a017862-3165-4cc7-afbe-78ef57821cd1','p6','White Sugar',NULL,1,42.00,'sale','2026-10-07 06:01:42.954','cash',0.00,0.00),('a8738263-1f32-4e3f-be3c-86eb9859f95e','1a017862-3165-4cc7-afbe-78ef57821cd1','p7','Canned Sardines',NULL,3,81.00,'sale','2026-10-07 06:01:42.954','cash',0.00,0.00),('b9806166-b859-4486-a4e5-1d6fa5774248','1a017862-3165-4cc7-afbe-78ef57821cd1','p1','Jasmine Rice',NULL,2,116.00,'sale','2026-10-07 06:01:42.954','cash',0.00,0.00),('demo--1','demo--1',NULL,'Store sales',NULL,1,1890.00,'sale','2026-10-06 04:00:00.000','cash',0.00,0.00),('demo--2','demo--2',NULL,'Store sales',NULL,1,1310.00,'sale','2026-10-05 04:00:00.000','cash',0.00,0.00),('demo--3','demo--3',NULL,'Store sales',NULL,1,1560.00,'sale','2026-10-04 04:00:00.000','cash',0.00,0.00),('demo--4','demo--4',NULL,'Store sales',NULL,1,870.00,'sale','2026-10-03 04:00:00.000','cash',0.00,0.00),('demo--5','demo--5',NULL,'Store sales',NULL,1,1240.00,'sale','2026-10-02 04:00:00.000','cash',0.00,0.00),('demo--6','demo--6',NULL,'Store sales',NULL,1,950.00,'sale','2026-10-01 04:00:00.000','cash',0.00,0.00);
/*!40000 ALTER TABLE `store_sales` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'thalia_grocery'
--

--
-- Dumping routines for database 'thalia_grocery'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-07 15:00:47
