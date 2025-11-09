import { Request, Response } from "express";

// 分页参数接口
export interface PaginationParams {
    page: number;
    limit: number;
    offset: number;
}

// 响应格式接口
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
    meta?: {
        page?: number;
        limit?: number;
        total?: number;
        total_pages?: number;
        next_page?: number;
        prev_page?: number;
    };
}

// 从请求中提取分页参数
export const extractPagination = (req: Request): PaginationParams => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    return {
        page,
        limit,
        offset,
    };
};

// 生成分页元数据
export const generatePaginationMeta = (
    page: number,
    limit: number,
    total: number
): { page: number; limit: number; total: number; total_pages: number; next_page?: number; prev_page?: number } => {
    const totalPages = Math.ceil(total / limit);

    return {
        page,
        limit,
        total,
        total_pages: totalPages,
        next_page: page < totalPages ? page + 1 : undefined,
        prev_page: page > 1 ? page - 1 : undefined,
    };
};

// 成功响应
export const successResponse = <T = any>(
    res: Response,
    data?: T,
    message: string = "Success",
    meta?: object
): Response => {
    const response: ApiResponse<T> = {
        success: true,
        data,
        message,
    };

    if (meta) {
        response.meta = meta;
    }

    return res.status(200).json(response);
};

// 分页成功响应
export const paginatedResponse = <T = any>(
    res: Response,
    data: T,
    pagination: { page: number; limit: number; total: number },
    message: string = "Success"
): Response => {
    const meta = generatePaginationMeta(pagination.page, pagination.limit, pagination.total);

    return successResponse(res, data, message, meta);
};

// 错误响应
export const errorResponse = (
    res: Response,
    statusCode: number,
    message: string,
    error?: string
): Response<ApiResponse> => {
    return res.status(statusCode).json({
        success: false,
        message,
        error,
    });
};

// 验证请求体的辅助函数
export const validateRequestBody = (req: Request, requiredFields: string[]): string | null => {
    for (const field of requiredFields) {
        if (req.body[field] === undefined || req.body[field] === null || req.body[field] === "") {
            return `字段 '${field}' 是必需的`;
        }
    }
    return null;
};

// 验证数字的辅助函数
export const validateNumber = (value: any, min?: number, max?: number): boolean => {
    const num = Number(value);
    if (isNaN(num)) return false;
    if (min !== undefined && num < min) return false;
    if (max !== undefined && num > max) return false;
    return true;
};

// 验证邮箱的辅助函数
export const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// 验证URL的辅助函数
export const validateUrl = (url: string): boolean => {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

// 验证IP地址的辅助函数
export const validateIp = (ip: string): boolean => {
    // IPv4 验证
    const ipv4Regex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    // IPv6 验证（简化版）
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}$/;

    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
};

// 验证端口号的辅助函数
export const validatePort = (port: number): boolean => {
    return port >= 1 && port <= 65535;
};

// 格式化错误信息
export const formatErrorMessage = (error: any): string => {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === "string") {
        return error;
    }
    return JSON.stringify(error, null, 2);
};

// 获取客户端IP地址
export const getClientIp = (req: Request): string => {
    // 尝试从代理头获取真实IP
    const forwardedFor = req.headers["x-forwarded-for"] as string;
    if (forwardedFor) {
        // x-forwarded-for 可能包含多个IP，取第一个
        return forwardedFor.split(",")[0].trim();
    }

    // 尝试从其他常见的代理头获取
    const realIp = req.headers["x-real-ip"] as string;
    if (realIp) {
        return realIp;
    }

    // 使用默认的IP
    return req.ip || "";
};

// 延迟函数
export const delay = (ms: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

// 生成随机字符串
export const generateRandomString = (length: number): string => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

// 重试函数
export async function retry<T>(fn: () => Promise<T>, maxRetries: number = 3, delayMs: number = 1000): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await delay(delayMs * Math.pow(2, i)); // 指数退避
        }
    }
    throw new Error("Max retries exceeded");
}

// 处理异步控制器
export const asyncHandler = <T extends (...args: any[]) => Promise<any>>(
    fn: T
): ((...args: Parameters<T>) => Promise<void>) => {
    return async (...args: Parameters<T>) => {
        try {
            await fn(...args);
        } catch (error) {
            const res = args[1] as Response;
            const errMessage = formatErrorMessage(error);
            errorResponse(res, 500, "服务器内部错误", errMessage);
        }
    };
};
