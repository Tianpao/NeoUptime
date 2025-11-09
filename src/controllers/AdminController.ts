import { Request, Response } from "express";
import { Admin } from "../models/Admin.js";
import { generateToken } from "../middleware/auth.js";
import { logger } from "../config/logger.js";
import {
    successResponse,
    errorResponse,
    validateRequestBody,
    validateNumber,
    validateEmail,
    asyncHandler,
} from "../utils/helpers.js";

// AdminController 类
export class AdminController {
    // 管理员注册
    static register = asyncHandler(async (req: Request, res: Response): Promise<Response | void> => {
        // 验证必需字段
        const validationError = validateRequestBody(req, ["username", "password"]);
        if (validationError) {
            return errorResponse(res, 400, validationError);
        }

        const { username, password, email, qq_number } = req.body;

        // 验证数据格式
        if (username.length < 3 || username.length > 50) {
            return errorResponse(res, 400, "用户名长度必须在 3-50 个字符之间");
        }

        if (password.length < 6) {
            return errorResponse(res, 400, "密码长度必须至少为 6 个字符");
        }

        if (email && !validateEmail(email)) {
            return errorResponse(res, 400, "邮箱格式无效");
        }

        if (qq_number && !validateNumber(qq_number)) {
            return errorResponse(res, 400, "QQ号格式无效");
        }

        // 尝试创建管理员
        const newAdmin = await Admin.create({
            username,
            password,
            email,
            qq_number,
        });

        if (!newAdmin) {
            return errorResponse(res, 409, "用户名已存在");
        }

        logger.info("Admin registered successfully", { adminId: newAdmin.id, username: newAdmin.username });
        successResponse(res, { id: newAdmin.id, username: newAdmin.username }, "管理员注册成功");
    });

    // 管理员登录
    static login = asyncHandler(async (req: Request, res: Response): Promise<Response | void> => {
        // 验证必需字段
        const validationError = validateRequestBody(req, ["username", "password"]);
        if (validationError) {
            return errorResponse(res, 400, validationError);
        }

        const { username, password } = req.body;

        // 验证管理员凭据
        const admin = await Admin.login(username, password);

        if (!admin) {
            logger.warn("Failed login attempt", { username, ip: req.ip });
            return errorResponse(res, 401, "用户名或密码错误");
        }

        // 生成 JWT token
        const token = generateToken({
            id: admin.id,
            username,
        });

        logger.info("Admin logged in successfully", { adminId: admin.id, username, ip: req.ip });
        successResponse(res, { token }, "登录成功");
    });

    // 获取当前管理员信息
    static getProfile = asyncHandler(async (req: Request, res: Response): Promise<Response | void> => {
        if (!req.user) {
            return errorResponse(res, 401, "未认证");
        }

        successResponse(res, req.user, "获取管理员信息成功");
    });

    // 获取当前管理员信息（别名方法，为了兼容性）
    static getMe = asyncHandler(async (req: Request, res: Response): Promise<Response | void> => {
        if (!req.user) {
            return errorResponse(res, 401, "未认证");
        }

        successResponse(res, req.user, "获取管理员信息成功");
    });

    // 更新管理员信息（别名方法，为了兼容性）
    static updateMe = asyncHandler(async (req: Request, res: Response): Promise<Response | void> => {
        if (!req.user) {
            return errorResponse(res, 401, "未认证");
        }

        const updates: any = {};

        if (req.body.email) {
            if (!validateEmail(req.body.email)) {
                return errorResponse(res, 400, "邮箱格式无效");
            }
            updates.email = req.body.email;
        }

        if (req.body.username) {
            if (req.body.username.length < 3 || req.body.username.length > 50) {
                return errorResponse(res, 400, "用户名长度必须在 3-50 个字符之间");
            }
            updates.username = req.body.username;
        }

        const updatedAdmin = await Admin.update(req.user.id, updates);
        if (!updatedAdmin) {
            if (updates.username) {
                return errorResponse(res, 409, "用户名已存在");
            }
            return errorResponse(res, 500, "更新管理员信息失败");
        }

        logger.info("Admin profile updated", { adminId: req.user.id });
        successResponse(res, updatedAdmin, "管理员信息更新成功");
    });

    // 更新管理员密码
    static updatePassword = asyncHandler(async (req: Request, res: Response): Promise<Response | void> => {
        if (!req.user) {
            return errorResponse(res, 401, "未认证");
        }

        // 验证必需字段
        const validationError = validateRequestBody(req, ["currentPassword", "newPassword"]);
        if (validationError) {
            return errorResponse(res, 400, validationError);
        }

        const { currentPassword, newPassword } = req.body;

        // 验证新密码
        if (newPassword.length < 6) {
            return errorResponse(res, 400, "新密码长度必须至少为 6 个字符");
        }

        // 首先验证当前密码
        const admin = await Admin.login(req.user.username, currentPassword);
        if (!admin || admin.id !== req.user.id) {
            return errorResponse(res, 401, "当前密码错误");
        }

        // 更新密码
        const updated = await Admin.updatePassword(req.user.id, newPassword);
        if (!updated) {
            return errorResponse(res, 500, "更新密码失败");
        }

        logger.info("Admin password updated", { adminId: req.user.id });
        successResponse(res, null, "密码更新成功");
    });

    // 验证密码（用于修复类型问题）
    static verifyPassword = asyncHandler(async (req: Request, res: Response): Promise<Response | void> => {
        if (!req.user) {
            return errorResponse(res, 401, "未认证");
        }

        const { password } = req.body;

        if (!password) {
            return errorResponse(res, 400, "密码不能为空");
        }

        // 验证密码
        const admin = await Admin.login(req.user.username, password);
        if (!admin || admin.id !== req.user.id) {
            return successResponse(res, { valid: false }, "密码验证失败");
        }

        return successResponse(res, { valid: true }, "密码验证成功");
    });

    // 更新管理员信息
    static updateProfile = asyncHandler(async (req: Request, res: Response): Promise<Response | void> => {
        if (!req.user) {
            return errorResponse(res, 401, "未认证");
        }

        const updates: any = {};


        if (req.body.email) {
            if (!validateEmail(req.body.email)) {
                return errorResponse(res, 400, "邮箱格式无效");
            }
            updates.email = req.body.email;
        }

        if (req.body.username) {
            if (req.body.username.length < 3 || req.body.username.length > 50) {
                return errorResponse(res, 400, "用户名长度必须在 3-50 个字符之间");
            }
            updates.username = req.body.username;
        }

        const updatedAdmin = await Admin.update(req.user.id, updates);
        if (!updatedAdmin) {
            if (updates.username) {
                return errorResponse(res, 409, "用户名已存在");
            }
            return errorResponse(res, 500, "更新管理员信息失败");
        }

        logger.info("Admin profile updated", { adminId: req.user.id });
        successResponse(res, updatedAdmin, "管理员信息更新成功");
    });

    // 获取所有管理员列表（仅管理员权限）
    static list = asyncHandler(async (req: Request, res: Response): Promise<Response | void> => {
        if (!req.user) {
            return errorResponse(res, 403, "权限不足");
        }

        const admins = await Admin.list();
        successResponse(res, admins, "获取管理员列表成功");
    });

    // 删除管理员（仅管理员权限）
    static delete = asyncHandler(async (req: Request, res: Response): Promise<Response | void> => {
        if (!req.user) {
            return errorResponse(res, 403, "权限不足");
        }

        const adminId = parseInt(req.params.id);

        if (!validateNumber(adminId, 1)) {
            return errorResponse(res, 400, "无效的管理员ID");
        }

        // 不允许删除自己
        if (adminId === req.user.id) {
            return errorResponse(res, 400, "不能删除自己的账户");
        }

        const deleted = await Admin.delete(adminId);
        if (!deleted) {
            return errorResponse(res, 404, "管理员不存在或无法删除（可能是唯一的管理员）");
        }

        logger.info("Admin deleted", { adminId: req.user.id, deletedAdminId: adminId });
        successResponse(res, null, "管理员删除成功");
    });
}
