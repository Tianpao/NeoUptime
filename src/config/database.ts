import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import { config } from "./config.js";
import path from "path";

// 数据库初始化SQL脚本
const INITIALIZE_SQL = `
-- 创建nodes表
CREATE TABLE IF NOT EXISTS "nodes" (
    "id" INTEGER NOT NULL,
    "description" TEXT,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "protocol" TEXT NOT NULL,
    "allow_relay" INTEGER NOT NULL,
    "network_name" TEXT,
    "network_secret" TEXT,
    "max_connections" INTEGER NOT NULL,
    "region" TEXT,
    "ISP" TEXT,
    "qq_number" TEXT,
    "mail" TEXT,
    "created_at" TEXT NOT NULL,
    "status" TEXT DEFAULT 'Offline',
    "last_status_update" TEXT,
    "response_time" INTEGER,
    "updated_at" TEXT NOT NULL,
    PRIMARY KEY("id" AUTOINCREMENT)
);

-- 创建admins表
CREATE TABLE IF NOT EXISTS "admins" (
    "id" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "qq_number" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    "last_login" TEXT,
    PRIMARY KEY("id" AUTOINCREMENT),
    UNIQUE("qq_number"),
    UNIQUE("email")
);

-- 创建node_status_history表
CREATE TABLE IF NOT EXISTS "node_status_history" (
    "id" INTEGER NOT NULL,
    "node_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "checked_at" TEXT NOT NULL,
    "response_time" INTEGER,
    "metadata" TEXT,
    PRIMARY KEY("id" AUTOINCREMENT),
    FOREIGN KEY("node_id") REFERENCES "nodes"("id") ON DELETE CASCADE
);

-- 创建api_keys表
CREATE TABLE IF NOT EXISTS "api_keys" (
    "id" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "created_by" INTEGER,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    "expires_at" TEXT,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "last_used_at" TEXT,
    "rate_limit" INTEGER NOT NULL DEFAULT 1000,
    PRIMARY KEY("id" AUTOINCREMENT),
    FOREIGN KEY("created_by") REFERENCES "admins"("id") ON DELETE SET NULL
);

-- 创建api_access_logs表
CREATE TABLE IF NOT EXISTS "api_access_logs" (
    "id" INTEGER NOT NULL,
    "api_key_id" INTEGER,
    "ip_address" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "response_time" INTEGER,
    "created_at" TEXT NOT NULL,
    PRIMARY KEY("id" AUTOINCREMENT),
    FOREIGN KEY("api_key_id") REFERENCES "api_keys"("id") ON DELETE SET NULL
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_nodes_status ON node_status_history(node_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_api_logs_key_time ON api_access_logs(api_key_id, created_at);
`;

// 数据库连接实例
let db: Database | null = null;

// 初始化数据库连接
export const initDatabase = async () => {
    try {
        // 确保数据库目录存在
        const dbDir = path.dirname(config.database.path);
        const fs = await import("fs").then((m) => m.promises);
        await fs.mkdir(dbDir, { recursive: true });

        // 打开数据库连接
        db = await open({
            filename: config.database.path,
            driver: sqlite3.Database,
        });

        // 启用外键约束
        await db.exec("PRAGMA foreign_keys = ON;");

        // 执行初始化SQL
        await db.exec(INITIALIZE_SQL);
        console.log("Database initialized successfully");

        return db;
    } catch (error) {
        console.error("Failed to initialize database:", error);
        throw error;
    }
};

// 获取数据库连接实例
export const getDb = () => {
    if (!db) {
        throw new Error("Database not initialized");
    }
    return db;
};

// 关闭数据库连接
export const closeDatabase = async () => {
    if (db) {
        await db.close();
        db = null;
    }
};

// 数据库事务辅助函数
export const transaction = async (callback: (tx: Database) => Promise<any>) => {
    const database = getDb();

    try {
        await database.run("BEGIN TRANSACTION");
        const result = await callback(database);
        await database.run("COMMIT");
        return result;
    } catch (error) {
        await database.run("ROLLBACK");
        throw error;
    }
};
