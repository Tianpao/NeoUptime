import { Request, Response } from "express";
import { ApiKey } from "../models/ApiKey.js";
import { logger } from "../config/logger.js";
import {
    extractPagination,
    paginatedResponse,
    successResponse,
    errorResponse,
    validateNumber,
    asyncHandler,
} from "../utils/helpers.js";

// ApiKeyController 类
export class ApiKeyController {
    // 创建新的 API Key
    static create = asyncHandler(async (req: Request, res: Response): Promise<Response | void> => {
        const { description, rate_limit } = req.body;

        // 验证速率限制
        if (rate_limit !== undefined) {
            if (!validateNumber(rate_limit, 1, 10000)) {
                return errorResponse(res, 400, "速率限制必须在 1-10000 之间");
            }
        }

        // 生成新的 API Key
        const newApiKey = await ApiKey.create({
            description,
            rate_limit,
        });

        if (!newApiKey) {
            return errorResponse(res, 500, "生成 API Key 失败");
        }

        logger.info("API Key created successfully", { apiKeyId: newApiKey.id });
        successResponse(
            res,
            {
                id: newApiKey.id,
                key: newApiKey.key,
                description: newApiKey.description,
                rate_limit: newApiKey.rate_limit,
                created_at: newApiKey.created_at,
            },
            "API Key 生成成功"
        );
    });

    // 获取 API Key 列表
    static list = asyncHandler(async (req: Request, res: Response): Promise<Response | void> => {
        // 获取分页参数
        const { page, limit } = extractPagination(req);

        // 获取查询参数
        const search = req.query.search as string;
        const isActiveParam = req.query.is_active as string;
        const isActive = isActiveParam !== undefined ? isActiveParam.toLowerCase() === "true" : undefined;

        const result = await ApiKey.list({
            page,
            limit,
            search,
            is_active: isActive,
        });

        // 对列表中的 API Key 进行安全处理，隐藏部分密钥内容
        const safeKeys = result.keys.map((key) => {
            // 只显示前 8 位和后 8 位，中间用星号代替
            const maskedKey = key.key.slice(0, 8) + "************************" + key.key.slice(-8);
            return {
                ...key,
                key: maskedKey,
            };
        });

        paginatedResponse(res, safeKeys, { page, limit, total: result.total }, "API Key 列表获取成功");
    });

    // 获取单个 API Key 详情
    static getById = asyncHandler(async (req: Request, res: Response): Promise<Response | void> => {
        const keyId = parseInt(req.params.id);

        if (!validateNumber(keyId, 1)) {
            return errorResponse(res, 400, "无效的 API Key ID");
        }

        // 获取所有 API Key，然后筛选出指定 ID 的
        const result = await ApiKey.list({ page: 1, limit: 100 });
        const apiKey = result.keys.find((k) => k.id === keyId);

        if (!apiKey) {
            return errorResponse(res, 404, "API Key 不存在");
        }

        // 安全处理密钥显示
        const maskedKey = apiKey.key.slice(0, 8) + "************************" + apiKey.key.slice(-8);

        successResponse(
            res,
            {
                ...apiKey,
                key: maskedKey,
            },
            "API Key 详情获取成功"
        );
    });

    // 启用/禁用 API Key
    static toggleStatus = asyncHandler(async (req: Request, res: Response): Promise<Response | void> => {
        const keyId = parseInt(req.params.id);
        const { is_active } = req.body;

        if (!validateNumber(keyId, 1)) {
            return errorResponse(res, 400, "无效的 API Key ID");
        }

        if (is_active === undefined) {
            return errorResponse(res, 400, "必须指定 is_active 参数");
        }

        const updated = await ApiKey.updateStatus(keyId, Boolean(is_active));
        if (!updated) {
            return errorResponse(res, 404, "API Key 不存在");
        }

        logger.info("API Key status updated", { keyId, is_active: Boolean(is_active) });
        successResponse(res, null, `API Key ${is_active ? "启用" : "禁用"}成功`);
    });

    // 更新 API Key 速率限制
    static updateRateLimit = asyncHandler(async (req: Request, res: Response): Promise<Response | void> => {
        const keyId = parseInt(req.params.id);
        const { rate_limit } = req.body;

        if (!validateNumber(keyId, 1)) {
            return errorResponse(res, 400, "无效的 API Key ID");
        }

        if (rate_limit === undefined) {
            return errorResponse(res, 400, "必须指定 rate_limit 参数");
        }

        if (!validateNumber(rate_limit, 1, 10000)) {
            return errorResponse(res, 400, "速率限制必须在 1-10000 之间");
        }

        const updated = await ApiKey.updateRateLimit(keyId, rate_limit);
        if (!updated) {
            return errorResponse(res, 404, "API Key 不存在");
        }

        logger.info("API Key rate limit updated", { keyId, rate_limit });
        successResponse(res, null, "API Key 速率限制更新成功");
    });

    // 删除 API Key
    static delete = asyncHandler(async (req: Request, res: Response): Promise<Response | void> => {
        const keyId = parseInt(req.params.id);

        if (!validateNumber(keyId, 1)) {
            return errorResponse(res, 400, "无效的 API Key ID");
        }

        const deleted = await ApiKey.delete(keyId);
        if (!deleted) {
            return errorResponse(res, 404, "API Key 不存在");
        }

        logger.info("API Key deleted", { keyId });
        successResponse(res, null, "API Key 删除成功");
    });

    // 获取 API Key 访问统计
    static getAccessStats = asyncHandler(async (req: Request, res: Response): Promise<Response | void> => {
        const keyId = parseInt(req.params.id);
        const days = parseInt(req.query.days as string) || 7;

        if (!validateNumber(keyId, 1)) {
            return errorResponse(res, 400, "无效的 API Key ID");
        }

        if (!validateNumber(days, 1, 30)) {
            return errorResponse(res, 400, "统计天数必须在 1-30 之间");
        }

        // 先检查 API Key 是否存在
        const result = await ApiKey.list({ page: 1, limit: 100 });
        const apiKeyExists = result.keys.some((k) => k.id === keyId);

        if (!apiKeyExists) {
            return errorResponse(res, 404, "API Key 不存在");
        }

        const stats = await ApiKey.getAccessStats(keyId, days);

        successResponse(
            res,
            {
                ...stats,
                days,
            },
            `API Key ${days} 天访问统计获取成功`
        );
    });
}
