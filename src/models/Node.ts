import { getDb, transaction } from "../config/database.js";

// 节点状态类型
export type NodeStatus = "Online" | "Offline";

// 节点协议类型
export type NodeProtocol = "http" | "https" | "ws" | "wss";

// 节点数据接口
export interface NodeData {
    id?: number;
    name: string;
    description?: string;
    host: string;
    port: number;
    protocol: NodeProtocol;
    allow_relay: boolean;
    network_name?: string;
    network_secret?: string;
    max_connections: number;
    region?: string;
    ISP?: string;
    qq_number?: string;
    mail?: string;
    created_at?: string;
    updated_at?: string;
}

// 节点状态信息接口
export interface NodeStatusInfo {
    id: number;
    status: NodeStatus;
    response_time?: number;
    last_checked?: string;
}

// Peer 发现接口返回的节点信息
export interface PeerNodeInfo {
    id: number;
    name: string;
    host: string;
    port: number;
    protocol: NodeProtocol;
    network_name?: string;
    status: NodeStatus;
    response_time?: number;
}

// Node 模型类
export class Node {
    // 创建新节点
    static async create(nodeData: NodeData): Promise<NodeData> {
        // 检查name属性是否存在（额外安全检查）
        if (nodeData.name === undefined) {
            throw new Error("Missing required field: name");
        }
        
        const db = getDb();
        const now = new Date().toISOString();

        const result = await db.run(
            `INSERT INTO nodes 
       (name, description, host, port, protocol, allow_relay, network_name, 
        network_secret, max_connections, region, ISP, qq_number, mail, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                nodeData.name,
                nodeData.description || null,
                nodeData.host,
                nodeData.port,
                nodeData.protocol,
                nodeData.allow_relay ? 1 : 0,
                nodeData.network_name || null,
                nodeData.network_secret || null,
                nodeData.max_connections,
                nodeData.region || null,
                nodeData.ISP || null,
                nodeData.qq_number || null,
                nodeData.mail || null,
                now,
                now,
            ]
        );

        return {
            ...nodeData,
            id: result.lastID,
            created_at: now,
            updated_at: now,
        };
    }

    // 根据ID获取节点
    static async getById(id: number, isAdmin: boolean = false): Promise<NodeData | null> {
        const db = getDb();

        // 根据用户权限选择要返回的字段
        const fields = isAdmin
            ? "*"
            : "id, name, description, host, port, protocol, allow_relay, network_name, max_connections";

        const node = await db.get<NodeData>(`SELECT ${fields} FROM nodes WHERE id = ?`, [id]);

        if (!node) return null;

        // 转换布尔值字段
        if (node.allow_relay !== undefined) {
            node.allow_relay = Boolean(node.allow_relay);
        }

        return node;
    }

    // 更新节点
    static async update(id: number, updates: Partial<NodeData>): Promise<NodeData | null> {
        return transaction(async (tx) => {
            const existingNode = await tx.get("SELECT * FROM nodes WHERE id = ?", [id]);
            if (!existingNode) return null;

            const now = new Date().toISOString();
            const updateFields: string[] = [];
            const updateValues: any[] = [];

            // 构建更新字段和值
            if (updates.name !== undefined) {
                updateFields.push("name = ?");
                updateValues.push(updates.name);
            }
            if (updates.description !== undefined) {
                updateFields.push("description = ?");
                updateValues.push(updates.description);
            }
            if (updates.host !== undefined) {
                updateFields.push("host = ?");
                updateValues.push(updates.host);
            }
            if (updates.port !== undefined) {
                updateFields.push("port = ?");
                updateValues.push(updates.port);
            }
            if (updates.protocol !== undefined) {
                updateFields.push("protocol = ?");
                updateValues.push(updates.protocol);
            }
            if (updates.allow_relay !== undefined) {
                updateFields.push("allow_relay = ?");
                updateValues.push(updates.allow_relay ? 1 : 0);
            }
            if (updates.network_name !== undefined) {
                updateFields.push("network_name = ?");
                updateValues.push(updates.network_name);
            }
            if (updates.network_secret !== undefined) {
                updateFields.push("network_secret = ?");
                updateValues.push(updates.network_secret);
            }
            if (updates.max_connections !== undefined) {
                updateFields.push("max_connections = ?");
                updateValues.push(updates.max_connections);
            }
            if (updates.qq_number !== undefined) {
                updateFields.push("qq_number = ?");
                updateValues.push(updates.qq_number);
            }
            if (updates.mail !== undefined) {
                updateFields.push("mail = ?");
                updateValues.push(updates.mail);
            }
            if (updates.region !== undefined) {
                updateFields.push("region = ?");
                updateValues.push(updates.region || null);
            }
            if (updates.ISP !== undefined) {
                updateFields.push("ISP = ?");
                updateValues.push(updates.ISP || null);
            }

            // 添加更新时间
            updateFields.push("updated_at = ?");
            updateValues.push(now);

            // 添加ID参数
            updateValues.push(id);

            // 执行更新
            await tx.run(`UPDATE nodes SET ${updateFields.join(", ")} WHERE id = ?`, updateValues);

            // 返回更新后的节点
            const updatedNode = await tx.get<NodeData>("SELECT * FROM nodes WHERE id = ?", [id]);
            if (updatedNode && updatedNode.allow_relay !== undefined) {
                updatedNode.allow_relay = Boolean(updatedNode.allow_relay);
            }
            return updatedNode;
        });
    }

    // 删除节点
    static async delete(id: number): Promise<boolean> {
        const db = getDb();
        const result = await db.run("DELETE FROM nodes WHERE id = ?", [id]);
        return result.changes !== undefined && result.changes > 0;
    }

    // 查询节点列表
    static async list(
        params: {
            page?: number;
            limit?: number;
            search?: string;
            status?: NodeStatus;
            protocol?: NodeProtocol;
            isAdmin?: boolean;
        } = {}
    ): Promise<{ nodes: NodeData[]; total: number }> {
        const db = getDb();
        const page = params.page || 1;
        const limit = Math.min(params.limit || 20, 100);
        const offset = (page - 1) * limit;

        // 根据用户权限选择要返回的字段
        const fields = params.isAdmin
            ? "*"
            : "id, name, description, host, port, protocol, allow_relay, network_name, max_connections";

        // 构建查询条件
        const conditions: string[] = [];
        const values: any[] = [];

        if (params.search) {
            conditions.push("(name LIKE ? OR description LIKE ?)");
            values.push(`%${params.search}%`, `%${params.search}%`);
        }
        if (params.protocol) {
            conditions.push("protocol = ?");
            values.push(params.protocol);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        // 查询总数
        const totalResult = await db.get<{ count: number }>(`SELECT COUNT(*) as count FROM nodes ${whereClause}`, [
            ...values,
        ]);

        // 查询节点列表
        const nodes = await db.all<NodeData[]>(
            `SELECT ${fields} FROM nodes ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`,
            [...values, limit, offset]
        );

        // 转换布尔值字段
        nodes.forEach((node: NodeData) => {
            if (node.allow_relay !== undefined) {
                node.allow_relay = Boolean(node.allow_relay);
            }
        });

        return {
            nodes,
            total: totalResult?.count || 0,
        };
    }

    // 获取节点状态
    static async getStatus(id: number): Promise<NodeStatusInfo | null> {
        const db = getDb();

        // 直接从 nodes 表中获取缓存的最新状态
        const nodeStatus = await db.get<{
            id: number;
            status: NodeStatus;
            response_time: number;
            last_status_update: string;
        }>(
            `SELECT id, status, response_time, last_status_update
         FROM nodes
         WHERE id = ?`,
            [id]
        );

        if (!nodeStatus) {
            return null;
        }

        return {
            id: nodeStatus.id,
            status: nodeStatus.status || "Offline", // 如果状态为 null，则默认为 Offline
            response_time: nodeStatus.response_time,
            last_checked: nodeStatus.last_status_update,
        };
    }

    // 记录节点状态
    static async updateStatus(id: number, status: NodeStatus, metadata?: string, responseTime?: number): Promise<boolean> {
        const db = getDb();
        const now = new Date().toISOString();
        const logger = await import('../config/logger.js').then(m => m.logger);

        try {
            const result = await db.run("UPDATE nodes SET status = ?, response_time = ?, last_status_update = ? WHERE id = ?", [
                status,
                responseTime || null,
                now,
                id,
            ]);

            // 记录状态变更历史
            await db.run(
                "INSERT INTO node_status_history (node_id, status, metadata, checked_at, response_time) VALUES (?, ?, ?, ?, ?)",
                [id, status, metadata || null, now, responseTime || null]
            );

            return result.changes !== undefined && result.changes > 0;
        } catch (error) {
            logger.error("更新节点状态失败:", error);
            return false;
        }
    }

    // 获取用于Peer发现的节点列表（带负载均衡）
    static async getPeers(
        params: {
            count?: number;
            protocol?: NodeProtocol;
            region?: string;
        } = {}
    ): Promise<{ peers: PeerNodeInfo[]; total_available: number; next_batch_available: boolean }> {
        const db = getDb();
        const count = Math.min(params.count || 5, 20);

        // 构建基础查询（只选择在线节点）
        const conditions: string[] = ["status = 'Online'"];
        const values: any[] = [];

        if (params.protocol) {
            conditions.push("protocol = ?");
            values.push(params.protocol);
        }
        
        // 添加region过滤
        if (params.region && params.region.trim() !== "") {
            conditions.push("(region = ? OR region IS NULL)");
            values.push(params.region.trim());
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        // 获取所有在线节点及其最新状态
        // 查询总数
        const totalResult = await db.get<{ count: number }>(
            `SELECT COUNT(*) as count FROM nodes ${whereClause}`,
            values
        );
        const totalAvailable = totalResult?.count || 0;

        // 查询节点列表并进行负载均衡
        const query = `
        SELECT
            id, name, host, port, protocol, network_name, status, response_time, region, ISP
        FROM nodes
        ${whereClause}
        ORDER BY
            (response_time IS NULL) ASC,
            response_time ASC,
            RANDOM()
        LIMIT ?
        `;

        // 取前N个节点
        const peers = await db.all<PeerNodeInfo[]>(query, [...values, count]);
        const nextBatchAvailable = totalAvailable > count;

        return {
            peers,
            total_available: totalAvailable,
            next_batch_available: nextBatchAvailable,
        };
    }
}
