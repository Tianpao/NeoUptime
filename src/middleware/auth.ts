import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/config.js";
import { logger } from "../config/logger.js";

// JWT 有效载荷接口
interface JwtPayload {
    id: number;
    username: string;
}

// 扩展 Express 的 Request 接口
declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}

// 认证中间件
export const authenticateJwt = (req: Request, res: Response, next: NextFunction): Response | void => {
    try {
        // 从请求头获取 token
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({
                error: "未提供认证令牌",
                message: "Authorization header is required",
            });
        }

        // 检查 Bearer 前缀
        const [bearer, token] = authHeader.split(" ");

        if (bearer !== "Bearer" || !token) {
            return res.status(401).json({
                error: "认证令牌格式无效",
                message: "Invalid authorization header format",
            });
        }

        // 验证 token
        const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

        // 将用户信息存储到请求对象中
        req.user = decoded;

        return next();
    } catch (error: any) {
        // 处理不同类型的错误
        if (error.name === "JsonWebTokenError") {
            logger.warn("Invalid JWT token", { error: error.message, ip: req.ip });
            return res.status(401).json({
                error: "无效的认证令牌",
                message: "Invalid token",
            });
        } else if (error.name === "TokenExpiredError") {
            logger.warn("JWT token expired", { error: error.message, ip: req.ip });
            return res.status(401).json({
                error: "认证令牌已过期",
                message: "Token expired",
            });
        } else {
            logger.error("JWT authentication error", { error: error.message, ip: req.ip });
            return res.status(500).json({
                error: "认证服务器错误",
                message: "Authentication server error",
            });
        }
    }
};

// 管理员权限中间件
export const requireAdmin = (req: Request, res: Response, next: NextFunction): Response | void => {
    if (!req.user) {
        return res.status(401).json({
            error: "未认证",
            message: "Authentication required",
        });
    }

    return next();
};

// 任意管理员权限中间件（包括 viewer 角色）
export const requireAnyAdmin = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
        res.status(401).json({
            error: "未认证",
            message: "Authentication required",
        });
        return;
    }

    next();
};

// 生成 JWT token
export const generateToken = (payload: JwtPayload): string => {
    // 确保 expiresIn 是数字类型
    let expiresInValue: number = 3600; // 默认1小时
    if (typeof config.jwt.expiresIn === "number") {
        expiresInValue = config.jwt.expiresIn;
    } else if (typeof config.jwt.expiresIn === "string") {
        expiresInValue = parseInt(config.jwt.expiresIn) || 3600;
    }

    // 使用显式类型转换确保参数类型正确
    const secret: string = String(config.jwt.secret);

    return jwt.sign(payload, secret, { expiresIn: expiresInValue });
};

// 验证请求方法的中间件
export const requireMethod = (...allowedMethods: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!allowedMethods.includes(req.method)) {
            res.status(405).json({
                error: "不允许的请求方法",
                message: `Method ${req.method} not allowed`,
                allowed_methods: allowedMethods,
            });
            return;
        }
        next();
    };
};
