import chalk from "chalk";
import { config } from "./config.js";

// 日志级别枚举
enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3,
}

// 日志级别映射
const levelMap: Record<string, LogLevel> = {
    error: LogLevel.ERROR,
    warn: LogLevel.WARN,
    info: LogLevel.INFO,
    debug: LogLevel.DEBUG,
};

// 当前日志级别
const currentLevel = levelMap[config.logging.level] || LogLevel.INFO;

// 格式化时间戳
const formatTimestamp = () => {
    return new Date().toISOString();
};

// 日志输出函数
const log = (level: LogLevel, levelName: string, color: (text: string) => string, ...args: any[]) => {
    if (level > currentLevel) return;

    const timestamp = formatTimestamp();
    const formattedLevel = color(`[${levelName}]`);
    const message = args
        .map((arg) => {
            if (typeof arg === "object") {
                return JSON.stringify(arg, null, 2);
            }
            return arg;
        })
        .join(" ");

    console.log(`${timestamp} ${formattedLevel} ${message}`);
};

// 日志对象
export const logger = {
    error: (...args: any[]) => log(LogLevel.ERROR, "ERROR", chalk.red, ...args),
    warn: (...args: any[]) => log(LogLevel.WARN, "WARN", chalk.yellow, ...args),
    info: (...args: any[]) => log(LogLevel.INFO, "INFO", chalk.green, ...args),
    debug: (...args: any[]) => log(LogLevel.DEBUG, "DEBUG", chalk.blue, ...args),
};

// HTTP请求日志中间件
export const httpLogger = (req: any, res: any, next: any) => {
    const start = Date.now();
    const originalSend = res.send;

    // 重写send方法以记录响应体
    res.send = function (body: any) {
        const duration = Date.now() - start;
        const statusColor = res.statusCode < 400 ? chalk.green : res.statusCode < 500 ? chalk.yellow : chalk.red;
        const methodColor =
            req.method === "GET"
                ? chalk.blue
                : req.method === "POST"
                ? chalk.green
                : req.method === "PUT"
                ? chalk.yellow
                : req.method === "DELETE"
                ? chalk.red
                : chalk.white;

        logger.info(
            methodColor(req.method),
            req.originalUrl,
            statusColor(res.statusCode),
            `${duration}ms`,
            `IP: ${req.ip}`
        );

        return originalSend.call(this, body);
    };

    next();
};
