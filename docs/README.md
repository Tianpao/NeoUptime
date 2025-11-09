# EasyTierMC Neo 后端文档

欢迎使用 EasyTierMC Neo 后端服务的文档目录。本目录包含项目的相关技术文档，帮助开发者和管理员更好地理解和使用系统。

## 文档列表

### 1. API 接口文档

详细的 API 接口说明，包括所有可用端点、请求参数、响应格式和示例。

-   **文件**：[api-documentation.md](api-documentation.md)
-   **内容**：包含认证、管理员管理、API Key 管理和节点管理等模块的完整接口文档

## 项目简介

EasyTierMC Neo 是一个 Minecraft 服务器节点管理系统的后端服务，提供以下主要功能：

-   **节点管理**：创建、查看、更新、删除和监控 Minecraft 服务器节点
-   **管理员认证**：用户注册、登录和权限管理
-   **API Key 管理**：为第三方应用提供受控的 API 访问
-   **节点发现**：支持节点间的自动发现和通信

## 技术栈

-   **框架**：Node.js + Express
-   **数据库**：SQLite (或其他关系型数据库)
-   **认证**：JWT (JSON Web Token) + API Key
-   **类型系统**：TypeScript

## 使用说明

### 访问 API 文档

请查看 [api-documentation.md](api-documentation.md) 获取完整的 API 接口说明。

### 开始使用

1. 首先注册管理员账号
2. 使用注册的账号登录获取 JWT Token
3. 使用 JWT Token 访问受保护的 API
4. 如需第三方集成，可以创建 API Key

## 贡献指南

欢迎提交 Issue 和 Pull Request 来改进项目。如有问题或建议，请在项目的 Issue 页面提出。

## 许可证

请参考项目根目录的许可证文件。
