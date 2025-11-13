import { Router } from "express";
import { NodeController } from "../controllers/NodeController.js";
import { AdminController } from "../controllers/AdminController.js";
import { ApiKeyController } from "../controllers/ApiKeyController.js";
import { authenticateJwt, requireAdmin, requireAnyAdmin } from "../middleware/auth.js";
import { apiKeyAuth, optionalApiKeyAuth } from "../middleware/apiKeyAuth.js";

// 创建路由实例
const router = Router();

// 管理员认证相关路由（无需 API Key）
router.post("/auth/register", AdminController.register);
router.post("/auth/login", AdminController.login);

// 需要 JWT 认证的管理员路由
const adminRoutes = Router();
adminRoutes.use(authenticateJwt);

// 获取当前管理员信息
adminRoutes.get("/auth/me", AdminController.getMe);
adminRoutes.put("/auth/me", AdminController.updateMe);
adminRoutes.put("/auth/password", AdminController.updatePassword);

// 需要管理员权限的路由
const adminOnlyRoutes = Router();
adminOnlyRoutes.use(requireAdmin);

// 管理员管理
adminOnlyRoutes.get("/admins", AdminController.list);
adminOnlyRoutes.delete("/admins/:id", AdminController.delete);

// API Key 管理
adminOnlyRoutes.post("/api-keys", ApiKeyController.create);
adminOnlyRoutes.get("/api-keys", ApiKeyController.list);
adminOnlyRoutes.get("/api-keys/:id", ApiKeyController.getById);
adminOnlyRoutes.patch("/api-keys/:id/status", ApiKeyController.toggleStatus);
adminOnlyRoutes.patch("/api-keys/:id/rate-limit", ApiKeyController.updateRateLimit);
adminOnlyRoutes.delete("/api-keys/:id", ApiKeyController.delete);
adminOnlyRoutes.get("/api-keys/:id/stats", ApiKeyController.getAccessStats);

// 节点管理路由
adminOnlyRoutes.post("/nodes", NodeController.create);
adminOnlyRoutes.get("/nodes", NodeController.list);
adminOnlyRoutes.get("/nodes/:id", NodeController.getById);
adminOnlyRoutes.put("/nodes/:id", NodeController.update);
adminOnlyRoutes.delete("/nodes/:id", NodeController.delete);
adminOnlyRoutes.get("/nodes/:id/status", NodeController.getStatus);
adminOnlyRoutes.put("/nodes/:id/status", NodeController.updateStatus);

// 公共 API 路由（需要 API Key）
const publicRoutes = Router();

// 可选 API Key 路由 - 提供默认限制
publicRoutes.get("/peers", optionalApiKeyAuth, NodeController.getPeers);

// 强制 API Key 验证的其他公共路由
publicRoutes.use(apiKeyAuth);

// 其他需要 API Key 的公共路由可以在这里添加

// 注册所有路由
router.use(adminRoutes);
router.use(adminOnlyRoutes);
router.use(publicRoutes);

export { router };
