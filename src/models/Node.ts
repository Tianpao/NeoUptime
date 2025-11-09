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
        const db = getDb();
        const now = new Date().toISOString();

        const result = await db.run(
            `INSERT INTO nodes 
       (name, description, host, port, protocol, allow_relay, network_name, 
        network_secret, max_connections, qq_number, mail, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

        // 检查节点是否存在
        const nodeExists = await db.get<{ id: number }>("SELECT id FROM nodes WHERE id = ?", [id]);
        if (!nodeExists) return null;

        // 获取最新的状态记录
        const latestStatus = await db.get<any>(
            `SELECT status, response_time, checked_at 
       FROM node_status_history 
       WHERE node_id = ? 
       ORDER BY checked_at DESC 
       LIMIT 1`,
            [id]
        );

        if (latestStatus) {
            return {
                id,
                status: latestStatus.status as NodeStatus,
                response_time: latestStatus.response_time,
                last_checked: latestStatus.checked_at,
            };
        }

        // 如果没有状态记录，默认返回离线
        return {
            id,
            status: "Offline",
            last_checked: new Date().toISOString(),
        };
    }

    // 记录节点状态
    static async updateStatus(id: number, status: NodeStatus, metadata?: string): Promise<boolean> {
        const db = getDb();
        const now = new Date().toISOString();

        try {
            const result = await db.run("UPDATE nodes SET status = ?, last_status_update = ? WHERE id = ?", [
                status,
                now,
                id,
            ]);

            // 记录状态变更历史
            await db.run(
                "INSERT INTO node_status_history (node_id, status, metadata, created_at) VALUES (?, ?, ?, ?)",
                [id, status, metadata || null, now]
            );

            return result.changes !== undefined && result.changes > 0;
        } catch (error) {
            console.error("更新节点状态失败:", error);
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
        const conditions: string[] = [];
        const values: any[] = [];

        if (params.protocol) {
            conditions.push("n.protocol = ?");
            values.push(params.protocol);
        }

        // 查询在线节点的总数
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

        // 获取所有在线节点及其最新状态
        const query = `
      WITH node_latest_status AS (
        SELECT 
          n.id,
          n.name,
          n.host,
          n.port,
          n.protocol,
          n.network_name,
          COALESCE(ns.status, 'Offline') as status,
          ns.response_time,
          ROW_NUMBER() OVER (PARTITION BY n.id ORDER BY ns.checked_at DESC) as rn
        FROM nodes n
        LEFT JOIN node_status_history ns ON n.id = ns.node_id
        ${whereClause}
      )
      SELECT 
        id, name, host, port, protocol, network_name, status, response_time
      FROM node_latest_status
      WHERE rn = 1 AND status = 'Online'
      ORDER BY 
        -- 负载均衡算法：先按响应时间排序，再随机排序
        response_time ASC NULLS LAST,
        RANDOM()
    `;

        const allOnlineNodes = await db.all<PeerNodeInfo[]>(query, [...values]);
        const totalAvailable = allOnlineNodes.length;

        // 取前N个节点
        const peers = allOnlineNodes.slice(0, count);
        const nextBatchAvailable = totalAvailable > count;

        return {
            peers,
            total_available: totalAvailable,
            next_batch_available: nextBatchAvailable,
        };
    }
}
