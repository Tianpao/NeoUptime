import crypto from "crypto";
import { getDb, transaction } from "../config/database.js";

// API Key 数据接口
export interface ApiKeyData {
    id?: number;
    key: string;
    description?: string;
    is_active: boolean;
    rate_limit: number;
    created_at?: string;
    updated_at?: string;
    last_used?: string;
}

// API 访问日志接口
export interface ApiAccessLog {
    id?: number;
    api_key_id: number;
    endpoint: string;
    method: string;
    ip_address: string;
    user_agent?: string;
    status_code: number;
    response_time?: number;
    created_at?: string;
}

// ApiKey 模型类
export class ApiKey {
    // 生成新的 API Key
    private static generateKey(): string {
        // 生成一个 32 字节的随机字符串并转换为十六进制格式
        const randomBytes = crypto.randomBytes(32);
        return randomBytes.toString("hex");
    }

    // 创建新的 API Key
    static async create(keyData: { description?: string; rate_limit?: number }): Promise<ApiKeyData | null> {
        return transaction(async (tx) => {
            let key: string;
            let existing: any;
            const maxAttempts = 10;
            let attempts = 0;

            // 重试生成唯一密钥（极低概率重复，但为了安全考虑）
            do {
                key = this.generateKey();
                existing = await tx.get("SELECT id FROM api_keys WHERE key = ?", [key]);
                attempts++;
            } while (existing && attempts < maxAttempts);

            // 如果达到最大重试次数仍未生成唯一密钥，返回null
            if (existing) return null;

            const now = new Date().toISOString();

            const result = await tx.run(
                `INSERT INTO api_keys (key, description, is_active, rate_limit, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    key,
                    keyData.description || null,
                    1, // 默认激活
                    keyData.rate_limit || 1000, // 默认每分钟 1000 次请求
                    now,
                    now,
                ]
            );

            return {
                id: result.lastID,
                key,
                description: keyData.description,
                is_active: true,
                rate_limit: keyData.rate_limit || 1000,
                created_at: now,
                updated_at: now,
            };
        });
    }

    // 验证 API Key
    static async validate(key: string): Promise<ApiKeyData | null> {
        const db = getDb();
        const apiKey = await db.get<ApiKeyData>(
            "SELECT id, key, description, is_active, rate_limit, created_at, updated_at, last_used FROM api_keys WHERE key = ?",
            [key]
        );

        if (!apiKey || !apiKey.is_active) {
            return null;
        }

        // 转换布尔值字段
        apiKey.is_active = Boolean(apiKey.is_active);

        return apiKey;
    }

    // 检查 API Key 是否超出速率限制
    static async checkRateLimit(apiKeyId: number): Promise<{ allowed: boolean; remaining: number; reset_at: number }> {
        const db = getDb();

        // 获取 API Key 的速率限制配置
        const apiKey = await db.get<ApiKeyData>("SELECT rate_limit FROM api_keys WHERE id = ?", [apiKeyId]);

        if (!apiKey) {
            return { allowed: false, remaining: 0, reset_at: Date.now() };
        }

        const rateLimit = apiKey.rate_limit;
        const now = new Date();
        const oneMinuteAgo = new Date(now.getTime() - 60000);

        // 计算过去一分钟内的请求次数
        const requestCount = await db.get<{ count: number }>(
            `SELECT COUNT(*) as count FROM api_access_logs 
       WHERE api_key_id = ? AND created_at > ?`,
            [apiKeyId, oneMinuteAgo.toISOString()]
        );

        const count = requestCount?.count || 0;
        const remaining = rateLimit - count;
        const allowed = remaining > 0;

        // 下一个重置时间（当前分钟的结束时间）
        const resetAt = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            now.getHours(),
            now.getMinutes() + 1,
            0
        ).getTime();

        return {
            allowed,
            remaining: Math.max(0, remaining),
            reset_at: resetAt,
        };
    }

    // 记录 API 访问日志
    static async logAccess(logData: Omit<ApiAccessLog, "id" | "created_at">): Promise<void> {
        return transaction(async (tx) => {
            const now = new Date().toISOString();

            // 插入访问日志
            await tx.run(
                `INSERT INTO api_access_logs 
         (api_key_id, endpoint, method, ip_address, user_agent, status_code, response_time, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    logData.api_key_id,
                    logData.endpoint,
                    logData.method,
                    logData.ip_address,
                    logData.user_agent || null,
                    logData.status_code,
                    logData.response_time || null,
                    now,
                ]
            );

            // 更新 API Key 的最后使用时间
            await tx.run("UPDATE api_keys SET last_used = ? WHERE id = ?", [now, logData.api_key_id]);
        });
    }

    // 获取 API Key 列表
    static async list(
        params: {
            page?: number;
            limit?: number;
            search?: string;
            is_active?: boolean;
        } = {}
    ): Promise<{ keys: ApiKeyData[]; total: number }> {
        const db = getDb();
        const page = params.page || 1;
        const limit = Math.min(params.limit || 20, 100);
        const offset = (page - 1) * limit;

        // 构建查询条件
        const conditions: string[] = [];
        const values: any[] = [];

        if (params.search) {
            conditions.push("(description LIKE ? OR key LIKE ?)");
            values.push(`%${params.search}%`, `%${params.search}%`);
        }
        if (params.is_active !== undefined) {
            conditions.push("is_active = ?");
            values.push(params.is_active ? 1 : 0);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        // 查询总数
        const totalResult = await db.get<{ count: number }>(`SELECT COUNT(*) as count FROM api_keys ${whereClause}`, [
            ...values,
        ]);

        // 查询 API Key 列表
        const keys = await db.all<ApiKeyData[]>(
            `SELECT id, key, description, is_active, rate_limit, created_at, updated_at, last_used_at 
       FROM api_keys 
       ${whereClause} 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
            [...values, limit, offset]
        );

        // 转换布尔值字段
        keys.forEach((key: ApiKeyData) => {
            if (key.is_active !== undefined) {
                key.is_active = Boolean(key.is_active);
            }
        });

        return {
            keys,
            total: totalResult?.count || 0,
        };
    }

    // 更新 API Key 状态
    static async updateStatus(id: number, is_active: boolean): Promise<boolean> {
        const db = getDb();
        const now = new Date().toISOString();

        const result = await db.run("UPDATE api_keys SET is_active = ?, updated_at = ? WHERE id = ?", [
            is_active ? 1 : 0,
            now,
            id,
        ]);

        return result.changes !== undefined && result.changes > 0;
    }

    // 更新 API Key 速率限制
    static async updateRateLimit(id: number, rate_limit: number): Promise<boolean> {
        const db = getDb();
        const now = new Date().toISOString();

        const result = await db.run("UPDATE api_keys SET rate_limit = ?, updated_at = ? WHERE id = ?", [
            rate_limit,
            now,
            id,
        ]);

        return result.changes !== undefined && result.changes > 0;
    }

    // 删除 API Key
    static async delete(id: number): Promise<boolean> {
        return transaction(async (tx) => {
            // 先删除相关的访问日志
            await tx.run("DELETE FROM api_access_logs WHERE api_key_id = ?", [id]);

            // 再删除 API Key
            const result = await tx.run("DELETE FROM api_keys WHERE id = ?", [id]);

            return result.changes !== undefined && result.changes > 0;
        });
    }

    // 获取 API Key 的访问统计
    static async getAccessStats(
        apiKeyId: number,
        days: number = 7
    ): Promise<{
        total_requests: number;
        successful_requests: number;
        failed_requests: number;
        daily_stats: Array<{ date: string; requests: number }>;
    }> {
        const db = getDb();
        const now = new Date();
        const daysAgo = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

        // 总请求数
        const totalResult = await db.get<{ count: number }>(
            `SELECT COUNT(*) as count FROM api_access_logs 
       WHERE api_key_id = ? AND created_at > ?`,
            [apiKeyId, daysAgo.toISOString()]
        );

        // 成功请求数（状态码 < 400）
        const successfulResult = await db.get<{ count: number }>(
            `SELECT COUNT(*) as count FROM api_access_logs 
       WHERE api_key_id = ? AND created_at > ? AND status_code < 400`,
            [apiKeyId, daysAgo.toISOString()]
        );

        // 失败请求数
        const failedResult = await db.get<{ count: number }>(
            `SELECT COUNT(*) as count FROM api_access_logs 
       WHERE api_key_id = ? AND created_at > ? AND status_code >= 400`,
            [apiKeyId, daysAgo.toISOString()]
        );

        // 每日统计
        const dailyStats = await db.all<{ date: string; requests: number }>(
            `SELECT 
        date(created_at) as date,
        COUNT(*) as requests
       FROM api_access_logs 
       WHERE api_key_id = ? AND created_at > ?
       GROUP BY date(created_at)
       ORDER BY date ASC`,
            [apiKeyId, daysAgo.toISOString()]
        );

        return {
            total_requests: totalResult?.count || 0,
            successful_requests: successfulResult?.count || 0,
            failed_requests: failedResult?.count || 0,
            daily_stats: Array.isArray(dailyStats) ? dailyStats : [],
        };
    }
}
