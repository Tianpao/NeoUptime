import { Request, Response, NextFunction } from "express";
import { ApiKey } from "../models/ApiKey.js";
import { logger } from "../config/logger.js";

// API Key 验证中间件
export const apiKeyAuth = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
        // 开始时间，用于计算响应时间
        const startTime = Date.now();

        // 从请求头获取 API Key
        let apiKey = req.headers["x-api-key"] as string;

        // 如果请求头中没有，则从查询参数获取
        if (!apiKey) {
            apiKey = req.query["api_key"] as string;
        }

        // 如果还是没有提供 API Key
        if (!apiKey) {
            logger.warn("API Key missing", {
                endpoint: req.originalUrl,
                method: req.method,
                ip: req.ip,
            });
            return res.status(401).json({
                error: "缺少 API 密钥",
                message: "API key is required",
                code: "MISSING_API_KEY",
            });
        }

        // 验证 API Key 是否有效
        const keyInfo = await ApiKey.validate(apiKey);

        if (!keyInfo) {
            logger.warn("Invalid API Key", {
                endpoint: req.originalUrl,
                method: req.method,
                ip: req.ip,
            });
            return res.status(401).json({
                error: "无效的 API 密钥",
                message: "Invalid API key",
                code: "INVALID_API_KEY",
            });
        }

        // 检查速率限制
        const rateLimitCheck = await ApiKey.checkRateLimit(keyInfo.id!);

        if (!rateLimitCheck.allowed) {
            logger.warn("API rate limit exceeded", {
                api_key_id: keyInfo.id,
                endpoint: req.originalUrl,
                method: req.method,
                ip: req.ip,
            });
            return res.status(429).json({
                error: "API 速率限制超出",
                message: "Too many requests",
                code: "RATE_LIMIT_EXCEEDED",
                reset_at: rateLimitCheck.reset_at,
            });
        }

        // 设置响应头
        res.setHeader("X-RateLimit-Limit", keyInfo.rate_limit.toString());
        res.setHeader("X-RateLimit-Remaining", rateLimitCheck.remaining.toString());
        res.setHeader("X-RateLimit-Reset", rateLimitCheck.reset_at.toString());

        // 将 API Key 信息添加到请求对象中，供后续处理使用
        req.apiKey = {
            id: keyInfo.id!,
            rateLimit: keyInfo.rate_limit,
            remaining: rateLimitCheck.remaining,
        };

        // 捕获响应结束事件，记录访问日志
        const originalSend = res.send;
        res.send = function (body: any) {
            // 计算响应时间
            const responseTime = Date.now() - startTime;

            // 记录 API 访问日志
            ApiKey.logAccess({
                api_key_id: keyInfo.id!,
                endpoint: req.originalUrl,
                method: req.method,
                ip_address: req.ip!,
                user_agent: req.headers["user-agent"] || undefined,
                status_code: res.statusCode,
                response_time: responseTime,
            }).catch((error) => {
                logger.error("Failed to log API access", { error: error.message });
            });

            return originalSend.call(this, body);
        };

        return next();
    } catch (error: any) {
        logger.error("API key authentication error", {
            error: error.message,
            endpoint: req.originalUrl,
            method: req.method,
            ip: req.ip,
        });
        return res.status(500).json({
            error: "API 认证服务器错误",
            message: "API authentication server error",
            code: "AUTHENTICATION_ERROR",
        });
    }
};

// API Key 中间件的安全配置
// interface ApiKeyConfig {
//     id: number;
//     rateLimit: number;
//     remaining: number;
// }

// 扩展 Express 的 Request 接口
declare global {
    namespace Express {
        interface Request {
            apiKey?: {
                id: number;
                rateLimit: number;
                remaining: number;
            };
        }
    }
}

// 可选的 API Key 验证中间件 - 不强制要求 API Key，但如果提供了则进行验证
export const optionalApiKeyAuth = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // 开始时间，用于计算响应时间
        const startTime = Date.now();

        // 从请求头获取 API Key
        let apiKey = req.headers["x-api-key"] as string;

        // 如果请求头中没有，则从查询参数获取
        if (!apiKey) {
            apiKey = req.query["api_key"] as string;
        }

        // 如果没有提供 API Key，则直接继续
        if (!apiKey) {
            // 对于未提供 API Key 的请求，可以进行一些限制
            // 例如：降低默认的速率限制，或者限制访问某些资源
            return next();
        }

        // 验证 API Key 是否有效
        const keyInfo = await ApiKey.validate(apiKey);

        if (!keyInfo) {
            // 如果提供了无效的 API Key，不拒绝请求，但记录警告
            logger.warn("Optional API Key is invalid", {
                endpoint: req.originalUrl,
                method: req.method,
                ip: req.ip,
            });
            return next();
        }

        // 检查速率限制
        const rateLimitCheck = await ApiKey.checkRateLimit(keyInfo.id!);

        if (!rateLimitCheck.allowed) {
            // 如果超出速率限制，不拒绝请求，但记录警告
            logger.warn("Optional API rate limit exceeded", {
                api_key_id: keyInfo.id,
                endpoint: req.originalUrl,
                method: req.method,
                ip: req.ip,
            });
            return next();
        }

        // 设置响应头
        res.setHeader("X-RateLimit-Limit", keyInfo.rate_limit.toString());
        res.setHeader("X-RateLimit-Remaining", rateLimitCheck.remaining.toString());
        res.setHeader("X-RateLimit-Reset", rateLimitCheck.reset_at.toString());

        // 将 API Key 信息添加到请求对象中
        req.apiKey = {
            id: keyInfo.id!,
            rateLimit: keyInfo.rate_limit,
            remaining: rateLimitCheck.remaining,
        };

        // 捕获响应结束事件，记录访问日志
        const originalSend = res.send;
        res.send = function (body: any) {
            // 计算响应时间
            const responseTime = Date.now() - startTime;

            // 记录 API 访问日志
            ApiKey.logAccess({
                api_key_id: keyInfo.id!,
                endpoint: req.originalUrl,
                method: req.method,
                ip_address: req.ip!,
                user_agent: req.headers["user-agent"] || undefined,
                status_code: res.statusCode,
                response_time: responseTime,
            }).catch((error) => {
                logger.error("Failed to log API access", { error: error.message });
            });

            return originalSend.call(this, body);
        };

        next();
    } catch (error: any) {
        logger.error("Optional API key authentication error", {
            error: error.message,
            endpoint: req.originalUrl,
            method: req.method,
            ip: req.ip,
        });
        // 对于可选的 API Key 认证，即使出现错误也不拒绝请求
        next();
    }
};

// 针对特定路径的 API Key 配置中间件
export const apiKeyProtectedPaths = (
    paths: Array<{
        path: string | RegExp;
        exact?: boolean;
        methods?: string[];
    }>
) => {
    return (req: Request, res: Response, next: NextFunction) => {
        // 检查当前请求是否需要 API Key 保护
        const requiresProtection = paths.some((pathConfig) => {
            const matchesPath = pathConfig.exact
                ? req.path === pathConfig.path
                : typeof pathConfig.path === "string"
                ? req.path.startsWith(pathConfig.path)
                : pathConfig.path.test(req.path);

            const matchesMethod = !pathConfig.methods || pathConfig.methods.includes(req.method);

            return matchesPath && matchesMethod;
        });

        if (requiresProtection) {
            // 需要保护，使用强制 API Key 验证
            return apiKeyAuth(req, res, next);
        } else {
            // 不需要保护，可以使用可选验证或直接继续
            return next();
        }
    };
};
