# EasyTier NeoUptime 后端 API 文档

## 项目简介

EasyTier NeoUptime 是一个服务器节点管理系统的后端服务，提供节点管理、管理员认证、API Key 管理等功能。

## API 前缀说明

所有 API 接口均需添加 `/api` 前缀，例如文档中提到的 `GET /peers` 实际访问路径应为 `GET /api/peers`。

## 认证方式

系统支持两种认证方式：

1. **JWT 认证**：管理员登录后获得 token，用于访问需要管理员权限的接口
2. **API Key 认证**：通过 HTTP Header 中的 `Authorization: Bearer {apiKey}` 访问公共 API

## API 接口文档

### 1. 认证模块

#### 1.1 管理员注册

**接口路径**：`POST /auth/register`

**请求体**：

```json
{
    "username": "admin",
    "password": "password123",
    "email": "admin@example.com",
}
```

**参数说明**：

-   `username`（必填）：用户名，长度 3-50 字符
-   `password`（必填）：密码，长度至少 6 字符
-   `email`（可选）：邮箱地址

**成功响应**：

```json
{
    "code": 200,
    "message": "管理员注册成功",
    "data": {
        "id": 1,
        "username": "admin",
    }
}
```

**失败响应**：

```json
{
    "code": 400,
    "message": "用户名长度必须在 3-50 个字符之间"
}
```

#### 1.2 管理员登录

**接口路径**：`POST /auth/login`

**请求体**：

```json
{
    "username": "admin",
    "password": "password123"
}
```

**参数说明**：

-   `username`（必填）：用户名
-   `password`（必填）：密码

**成功响应**：

```json
{
    "code": 200,
    "message": "登录成功",
    "data": {
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    }
}
```

**失败响应**：

```json
{
    "code": 401,
    "message": "用户名或密码错误"
}
```

#### 1.3 获取当前管理员信息

**接口路径**：`GET /auth/me`

**认证方式**：JWT Token（需要在请求头中添加 `Authorization: Bearer {token}`）

**成功响应**：

```json
{
    "code": 200,
    "message": "获取管理员信息成功",
    "data": {
        "id": 1,
        "username": "admin",
        "email": "admin@example.com",
    }
}
```

#### 1.4 更新当前管理员信息

**接口路径**：`PUT /auth/me`

**认证方式**：JWT Token

**请求体**：

```json
{
    "username": "newadmin",
    "email": "newadmin@example.com",
}
```

**参数说明**：

-   `username`（可选）：新用户名，长度 3-50 字符
-   `email`（可选）：新邮箱地址

**成功响应**：

```json
{
    "code": 200,
    "message": "管理员信息更新成功",
    "data": {
        "id": 1,
        "username": "newadmin",
        "email": "newadmin@example.com",
    }
}
```

#### 1.5 更新密码

**接口路径**：`PUT /auth/password`

**认证方式**：JWT Token

**请求体**：

```json
{
    "currentPassword": "oldpassword",
    "newPassword": "newpassword123"
}
```

**参数说明**：

-   `currentPassword`（必填）：当前密码
-   `newPassword`（必填）：新密码，长度至少 6 字符

**成功响应**：

```json
{
    "code": 200,
    "message": "密码更新成功",
    "data": null
}
```

**失败响应**：

```json
{
    "code": 401,
    "message": "当前密码错误"
}
```

### 2. 管理员管理（需要管理员权限）

#### 2.1 获取管理员列表

**接口路径**：`GET /admins`

**认证方式**：JWT Token，需要 admin 角色

**成功响应**：

```json
{
    "code": 200,
    "message": "获取管理员列表成功",
    "data": [
        {
            "id": 1,
            "username": "admin",
            "email": "admin@example.com",
        },
        {
            "id": 2,
            "username": "viewer",
            "email": "viewer@example.com",
        }
    ]
}
```

#### 2.2 删除管理员

**接口路径**：`DELETE /admins/:id`

**认证方式**：JWT Token，需要 admin 角色

**路径参数**：

-   `id`：管理员 ID

**成功响应**：

```json
{
    "code": 200,
    "message": "删除管理员成功",
    "data": null
}
```

### 3. API Key 管理（需要管理员权限）

#### 3.1 创建 API Key

**接口路径**：`POST /api-keys`

**认证方式**：JWT Token，需要 admin 角色

**请求体**：

```json
{
    "description": "测试 API Key",
    "rate_limit": 1000
}
```

**参数说明**：

-   `description`（可选）：API Key 描述
-   `rate_limit`（可选）：速率限制，1-10000 之间，默认值未指定

**成功响应**：

```json
{
    "code": 200,
    "message": "API Key 生成成功",
    "data": {
        "id": 1,
        "key": "ak_5f7d9e3c1b8a6d2e4f1c9b7a5d3e1c8b",
        "description": "测试 API Key",
        "rate_limit": 1000,
        "created_at": "2024-01-01T00:00:00Z"
    }
}
```

#### 3.2 获取 API Key 列表

**接口路径**：`GET /api-keys`

**认证方式**：JWT Token，需要 admin 角色

**查询参数**：

-   `page`：页码，默认为 1
-   `limit`：每页数量，默认为 20
-   `search`：搜索关键词
-   `is_active`：是否激活，true 或 false

**成功响应**：

```json
{
    "code": 200,
    "message": "API Key 列表获取成功",
    "data": {
        "items": [
            {
                "id": 1,
                "key": "ak_5f7d***************1c8b",
                "description": "测试 API Key",
                "rate_limit": 1000,
                "is_active": true,
                "created_at": "2024-01-01T00:00:00Z"
            }
        ],
        "page": 1,
        "limit": 20,
        "total": 1,
        "total_pages": 1
    }
}
```

#### 3.3 获取单个 API Key 详情

**接口路径**：`GET /api-keys/:id`

**认证方式**：JWT Token，需要 admin 角色

**路径参数**：

-   `id`：API Key ID

**成功响应**：

```json
{
    "code": 200,
    "message": "API Key 详情获取成功",
    "data": {
        "id": 1,
        "key": "ak_5f7d***************1c8b",
        "description": "测试 API Key",
        "rate_limit": 1000,
        "is_active": true,
        "created_at": "2024-01-01T00:00:00Z"
    }
}
```

#### 3.4 启用/禁用 API Key

**接口路径**：`PATCH /api-keys/:id/status`

**认证方式**：JWT Token，需要 admin 角色

**路径参数**：

-   `id`：API Key ID

**请求体**：

```json
{
    "is_active": false
}
```

**参数说明**：

-   `is_active`（必填）：是否激活

**成功响应**：

```json
{
    "code": 200,
    "message": "API Key 禁用成功",
    "data": null
}
```

#### 3.5 更新 API Key 速率限制

**接口路径**：`PATCH /api-keys/:id/rate-limit`

**认证方式**：JWT Token，需要 admin 角色

**路径参数**：

-   `id`：API Key ID

**请求体**：

```json
{
    "rate_limit": 2000
}
```

**参数说明**：

-   `rate_limit`（必填）：新的速率限制，1-10000 之间

**成功响应**：

```json
{
    "code": 200,
    "message": "API Key 速率限制更新成功",
    "data": null
}
```

#### 3.6 删除 API Key

**接口路径**：`DELETE /api-keys/:id`

**认证方式**：JWT Token，需要 admin 角色

**路径参数**：

-   `id`：API Key ID

**成功响应**：

```json
{
    "code": 200,
    "message": "API Key 删除成功",
    "data": null
}
```

#### 3.7 获取 API Key 访问统计

**接口路径**：`GET /api-keys/:id/stats`

**认证方式**：JWT Token，需要 admin 角色

**路径参数**：

-   `id`：API Key ID

**查询参数**：

-   `days`：统计天数，1-30 之间，默认为 7

**成功响应**：

```json
{
    "code": 200,
    "message": "API Key 7 天访问统计获取成功",
    "data": {
        "total_requests": 125,
        "daily_stats": [
            { "date": "2024-01-01", "count": 20 },
            { "date": "2024-01-02", "count": 25 }
        ],
        "days": 7
    }
}
```

### 4. 节点管理

#### 4.1 创建节点

**接口路径**：`POST /nodes`

**认证方式**：JWT Token，需要 admin 角色

**请求体**：

```json
{
    "name": "节点1",
    "description": "测试节点",
    "host": "192.168.1.100",
    "port": 25565,
    "protocol": "http",
    "allow_relay": true,
    "network_name": "main",
    "network_secret": "secret_key",
    "max_connections": 100,
    "qq_number": "123456789",
    "mail": "node@example.com"
}
```

**参数说明**：

-   `name`（必填）：节点名称
-   `description`（可选）：节点描述
-   `host`（必填）：节点主机地址
-   `port`（必填）：节点端口，1-65535 之间
-   `protocol`（必填）：协议类型，支持 http, https, ws, wss
-   `allow_relay`（可选）：是否允许中继，默认为 true
-   `network_name`（可选）：网络名称
-   `network_secret`（可选）：网络密钥
-   `max_connections`（必填）：最大连接数，必须大于 0
-   `qq_number`（可选）：QQ 号码
-   `mail`（可选）：邮箱地址

**成功响应**：

```json
{
    "code": 200,
    "message": "节点创建成功",
    "data": {
        "id": 1,
        "name": "节点1",
        "description": "测试节点",
        "host": "192.168.1.100",
        "port": 25565,
        "protocol": "http",
        "allow_relay": true,
        "network_name": "main",
        "network_secret": "secret_key",
        "max_connections": 100,
        "qq_number": "123456789",
        "mail": "node@example.com",
        "region": "China",
        "isp": "China Telecom",
        "status": "Offline",
        "created_at": "2024-01-01T00:00:00Z"
    }
}
```

#### 4.2 获取节点列表

**接口路径**：`GET /nodes`

**认证方式**：JWT Token，需要 admin 角色

**查询参数**：

-   `page`：页码，默认为 1
-   `limit`：每页数量，默认为 20
-   `search`：搜索关键词
-   `status`：节点状态
-   `protocol`：协议类型
-   `region`：区域过滤

**成功响应**：

```json
{
    "code": 200,
    "message": "节点列表获取成功",
    "data": {
        "items": [
            {
                "id": 1,
                "name": "节点1",
                "host": "192.168.1.100",
                "port": 25565,
                "protocol": "http",
                "region": "China",
                "isp": "China Telecom",
                "status": "Online",
                "created_at": "2024-01-01T00:00:00Z"
            }
        ],
        "page": 1,
        "limit": 20,
        "total": 1,
        "total_pages": 1
    }
}
```

#### 4.3 获取单个节点信息

**接口路径**：`GET /nodes/:id`

**认证方式**：JWT Token，需要 admin 角色

**路径参数**：

-   `id`：节点 ID

**成功响应**：

```json
{
    "code": 200,
    "message": "节点信息获取成功",
    "data": {
        "id": 1,
        "name": "节点1",
        "description": "测试节点",
        "host": "192.168.1.100",
        "port": 25565,
        "protocol": "http",
        "allow_relay": true,
        "network_name": "main",
        "network_secret": "secret_key",
        "max_connections": 100,
        "qq_number": "123456789",
        "mail": "node@example.com",
        "region": "China",
        "isp": "China Telecom",
        "status": "Online",
        "created_at": "2024-01-01T00:00:00Z"
    }
}
```

#### 4.4 更新节点信息

**接口路径**：`PUT /nodes/:id`

**认证方式**：JWT Token，需要 admin 角色

**路径参数**：

-   `id`：节点 ID

**请求体**：

```json
{
    "name": "更新后的节点",
    "description": "更新后的描述",
    "max_connections": 200
}
```

**参数说明**：可更新任意非必填字段，必填字段更新时需要重新验证格式。支持更新region（可包含详细地理位置信息）和isp字段。

**成功响应**：

```json
{
    "code": 200,
    "message": "节点更新成功",
    "data": {
        "id": 1,
        "name": "更新后的节点",
        "description": "更新后的描述",
        "host": "192.168.1.100",
        "port": 25565,
        "protocol": "http",
        "allow_relay": true,
        "network_name": "main",
        "network_secret": "secret_key",
        "max_connections": 200,
        "qq_number": "123456789",
        "mail": "node@example.com",
        "region": "China",
        "isp": "China Telecom",
        "status": "Online",
        "created_at": "2024-01-01T00:00:00Z"
    }
}
```

#### 4.5 删除节点

**接口路径**：`DELETE /nodes/:id`

**认证方式**：JWT Token，需要 admin 角色

**路径参数**：

-   `id`：节点 ID

**成功响应**：

```json
{
    "code": 200,
    "message": "节点删除成功",
    "data": null
}
```

#### 4.6 获取节点状态

**接口路径**：`GET /nodes/:id/status`

**认证方式**：JWT Token，需要 admin 角色

**路径参数**：

-   `id`：节点 ID

**成功响应**：

```json
{
    "code": 200,
    "message": "节点状态获取成功",
    "data": {
        "status": "Online",
        "last_check": "2024-01-01T01:00:00Z",
        "response_time": 50
    }
}
```

#### 4.7 更新节点状态

**接口路径**：`PUT /nodes/:id/status`

**认证方式**：JWT Token，需要 admin 角色

**路径参数**：

-   `id`：节点 ID

**请求体**：

```json
{
    "status": "Online",
    "response_time": 50
}
```

**参数说明**：

-   `status`（必填）：节点状态
-   `response_time`（必填）：响应时间（毫秒）

**成功响应**：

```json
{
    "code": 200,
    "message": "节点状态更新成功",
    "data": null
}
```

### 5. 公共 API

#### 5.1 获取节点列表（用于节点发现）

**接口路径**：`GET /peers`

**认证方式**：可选 API Key（通过请求头 `Authorization: Bearer {apiKey}`）

**查询参数**：

-   `region`：区域过滤，可选参数

**成功响应**：

```json
{
    "code": 200,
    "message": "Peer 节点列表获取成功",
    "data": {
        "peers": [
            {
                "id": 1,
                "name": "节点1",
                "host": "192.168.1.100",
                "port": 25565,
                "protocol": "http",
                "network_name": "main",
                "status": "Online",
                "response_time": 50
            },
            {
                "id": 2,
                "name": "节点2",
                "host": "192.168.1.101",
                "port": 25565,
                "protocol": "https",
                "network_name": "test",
                "status": "Online",
                "response_time": 75
            }
        ],
        "total_available": 100,
        "next_batch_available": true
    }
}
```

## 错误码说明

| 错误码 | 说明                       |
| ------ | -------------------------- |
| 200    | 成功                       |
| 400    | 请求参数错误               |
| 401    | 认证失败                   |
| 403    | 权限不足                   |
| 404    | 资源不存在                 |
| 409    | 资源冲突（如用户名已存在） |
| 500    | 服务器内部错误             |

## 响应格式统一说明

所有 API 响应均采用以下统一格式：

**成功响应**：

```json
{
    "code": 200,
    "message": "操作成功的描述信息",
    "data": {}
}
```

**分页响应**：

```json
{
    "code": 200,
    "message": "操作成功的描述信息",
    "data": {
        "items": [],
        "page": 1,
        "limit": 20,
        "total": 100,
        "total_pages": 5
    }
}
```

**错误响应**：

```json
{
  "code": 错误码,
  "message": "错误描述信息",
  "data": null
}
```
