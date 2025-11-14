import path from "path";

// 应用配置
export const config = {
    // 服务器配置
    server: {
        port: process.env.PORT || 3000,
        host: process.env.HOST || "0.0.0.0",
    },

    // 数据库配置
    database: {
        path: path.resolve(process.cwd(), process.env.DB_PATH || "data.db"),
    },

    // JWT配置
    jwt: {
        secret: process.env.JWT_SECRET || "73b4689a-08a6-4e10-86b0-b04475c0d403",
        expiresIn: process.env.JWT_EXPIRES_IN || "24h",
    },

    // API Key配置
    apiKey: {
        rateLimit: {
            maxRequests: process.env.API_RATE_LIMIT || 1000,
            windowMs: 60 * 60 * 1000, // 1小时
        },
        hashRounds: 10,
    },

    // 日志配置
    logging: {
        level: process.env.LOG_LEVEL || "info",
    },

    // 节点状态检查配置
    nodeCheck: {
        timeout: 5000, // 5秒超时
        cacheTTL: 60000, // 1分钟缓存
    },
};

// 验证必需的配置项
export const validateConfig = () => {
    const errors: string[] = [];

    if (!config.jwt.secret || config.jwt.secret === "your-secret-key-change-in-production") {
        errors.push("JWT_SECRET is not set or using default value. Please set a secure secret in production.");
    }

    if (errors.length > 0) {
        console.error("Configuration errors:");
        errors.forEach((error) => console.error(`- ${error}`));
        if (process.env.NODE_ENV === "production") {
            process.exit(1);
        }
    }
};
