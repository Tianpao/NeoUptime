import express from "express";
import morgan from "morgan";
import chalk from "chalk";
import { router } from "./routes/index.js";
import { logger, httpLogger } from "./config/logger.js";
import { initDatabase } from "./config/database.js";
import { config, validateConfig } from "./config/config.js";
import { errorResponse } from "./utils/helpers.js";
import { Admin } from "./models/Admin.js";

// 验证配置
validateConfig();

// 创建 Express 应用
const app = express();

// 中间件配置
app.use(express.json());
app.set("X-Powered-By", "OpenEasyTier")
app.enable('trust proxy') 

// 日志中间件
app.use(httpLogger);
app.use(morgan("dev"));

// 添加 CORS 支持
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
    next();
});

// 健康检查端点
app.get("/health", (req, res) => {
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || "1.0.0",
    });
});

// 注册路由
app.use("/api", router);

// 404 处理
app.use((req, res) => {
    errorResponse(res, 404, "接口不存在");
});

// 错误处理中间件
app.use((err: any, req: any, res: any, next: any) => {
    logger.error("未捕获的异常:", { error: err.message, stack: err.stack });

    // 检查是否已经发送了响应
    if (res.headersSent) {
        return next(err);
    }

    // 返回错误响应
    errorResponse(res, 500, "服务器内部错误", err.message);
});

// 初始化数据库并启动服务器
async function startServer() {
    try {
        // 初始化数据库
        await initDatabase();
        logger.info("数据库初始化成功");

        // 创建默认管理员账户（如果不存在）
        const existingAdmin = await Admin.getByUsername("admin");
        if (!existingAdmin) {
            // 使用 Admin 类的 create 方法创建管理员
            const newAdmin = await Admin.create({
                username: "admin",
                password: "admin123",
                email: "admin@example.com",
                qq_number: "10000",
            });
            if (newAdmin) {
                logger.info("创建了默认管理员账户", { username: "admin", password: "admin123" });
            }
        }

        // 启动服务器
        const PORT = config.server.port || 3000;
        app.listen(PORT, () => {
            console.log(chalk.green(`✅ 服务器启动成功`));
            console.log(chalk.blue(`📡 监听端口: ${PORT}`));
            console.log(chalk.blue(`🔗 健康检查: http://localhost:${PORT}/health`));
            console.log(chalk.blue(`📚 API 文档: http://localhost:${PORT}/api`));
            console.log(chalk.yellow(`⚠️ 默认管理员账户: admin/admin123 (请尽快修改)`));
        });
    } catch (error) {
        logger.error("服务器启动失败:", error);
        process.exit(1);
    }
}

// 启动服务器
startServer();

// 优雅关闭处理
process.on("SIGINT", async () => {
    logger.info("收到 SIGINT 信号，正在关闭服务器...");
    // 这里可以添加清理资源的代码
    process.exit(0);
});

process.on("SIGTERM", async () => {
    logger.info("收到 SIGTERM 信号，正在关闭服务器...");
    // 这里可以添加清理资源的代码
    process.exit(0);
});
