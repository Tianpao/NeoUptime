import { Request, Response } from "express";
import { Node, NodeData, NodeStatus, NodeProtocol } from "../models/Node.js";
import { logger } from "../config/logger.js";
import {
    extractPagination,
    paginatedResponse,
    successResponse,
    errorResponse,
    validateRequestBody,
    validateNumber,
    validatePort,
    asyncHandler,
} from "../utils/helpers.js";
import { geoIPService } from "../utils/GeoIPService.js";

// NodeController 类
export class NodeController {
    // 创建节点
    static create = asyncHandler(async (req: Request, res: Response): Promise<Response | void> => {
        // 检查请求体是否存在
        if (!req.body) {
            logger.error("Request body is empty");
            return errorResponse(res, 400, "请求体不能为空");
        }
        
        // 单独检查name字段并立即返回错误
        if (req.body.name === undefined || req.body.name === null || req.body.name.trim() === "") {
            logger.error("Missing required 'name' field in request body");
            return errorResponse(res, 400, "节点名称是必填字段");
        }
        
        logger.debug("Name field exists and has value:", req.body.name);

        // 验证请求体中的其他字段
        const validationError = validateRequestBody(req, ["host", "port", "protocol", "max_connections"]);
        if (validationError) {
            logger.warn("Validation error:", validationError);
            return errorResponse(res, 400, validationError);
        }

        const {
            name,
            description,
            host,
            port,
            protocol,
            allow_relay,
            network_name,
            network_secret,
            max_connections,
            qq_number,
            mail,
        } = req.body;

        // 验证数据格式
        if (!validatePort(port)) {
            return errorResponse(res, 400, "端口号必须在 1-65535 之间");
        }

        if (!["http", "https", "ws", "wss"].includes(protocol)) {
            return errorResponse(res, 400, "不支持的协议类型，支持的类型: http, https, ws, wss");
        }

        if (!validateNumber(max_connections, 1)) {
            return errorResponse(res, 400, "最大连接数必须大于 0");
        }

        // 获取节点地理位置信息
        let geoData = null;
        
        // 检查geoIPService是否初始化成功
        if (!geoIPService.isInitialized()) {
            logger.warn("GeoIP service not initialized, skipping location lookup");
        } else {
            try {
                //从GEOIP数据库获取地理位置信息和ASN信息
                geoData = await geoIPService.lookup(host);
                if (!geoData || (!geoData.location && !geoData.network)) {
                    logger.debug(`No geo data found for ${host}`);
                }
            } catch (error) {
                logger.error(`Error looking up geo data for ${host}:`, error);
            }
        }
        
        // 获取地理位置信息
        let region = "";
        let ISP = "";
        
        try {
            if (geoData && geoData.location) {
                // 获取region
                const location = geoData.location;
                if (location.country && location.country.names) {
                    region = location.country.names.en || "";
                    // TODO: 位置具体到城市 (当前数据库无对应数据)
                }
            }
            
            // 获取ISP
            if (geoData && geoData.network) {
                ISP = geoData.network.autonomous_system_organization || ""
            }
        } catch (error) {
            logger.error("Error extracting geo location data:", error);
            // 发生错误时使用默认空字符串
            region = "";
            ISP = "";
        }

        // 尝试创建节点
        const nodeData: NodeData = {
            name,
            description,
            host,
            port,
            protocol: protocol as NodeProtocol,
            allow_relay: allow_relay !== undefined ? Boolean(allow_relay) : true,
            network_name,
            network_secret,
            max_connections,
            region,
            ISP,
            qq_number,
            mail,
        };
        const newNode = await Node.create(nodeData);

        if (!newNode) {
            logger.error("Node.create returned null");
            return errorResponse(res, 500, "创建节点失败");
        }

        logger.info("Node created successfully", { nodeId: newNode.id, nodeName: newNode.name });
        successResponse(res, newNode, "节点创建成功");
    });

    // 获取节点列表
    static list = asyncHandler(async (req: Request, res: Response): Promise<Response | void> => {
        // 获取分页参数
        const { page, limit } = extractPagination(req);

        // 获取查询参数
        const search = req.query.search as string;
        const status = (req.query.status as NodeStatus) || undefined;
        const protocol = (req.query.protocol as NodeProtocol) || undefined;

        // 判断是否是管理员请求（通过 req.user 检查）
        const isAdmin = req.user !== undefined;

        const result = await Node.list({
            page,
            limit,
            search,
            status,
            protocol,
            isAdmin,
        });

        // 为管理员返回完整信息，为普通用户只返回必要信息
        paginatedResponse(res, result.nodes, { page, limit, total: result.total }, "节点列表获取成功");
    });

    // 获取单个节点信息
    static getById = asyncHandler(async (req: Request, res: Response): Promise<Response | void> => {
        const nodeId = parseInt(req.params.id);

        if (!validateNumber(nodeId, 1)) {
            return errorResponse(res, 400, "无效的节点ID");
        }

        // 判断是否是管理员请求
        const isAdmin = req.user !== undefined;

        const node = await Node.getById(nodeId, isAdmin);
        if (!node) {
            return errorResponse(res, 404, "节点不存在");
        }

        successResponse(res, node, "节点信息获取成功");
    });

    // 更新节点信息
    static update = asyncHandler(async (req: Request, res: Response): Promise<Response | void> => {
        const nodeId = parseInt(req.params.id);

        if (!validateNumber(nodeId, 1)) {
            return errorResponse(res, 400, "无效的节点ID");
        }

        // 验证更新数据
        const updates: Partial<NodeData> = {};

        if (req.body.name !== undefined) updates.name = req.body.name;
        if (req.body.description !== undefined) updates.description = req.body.description;
        if (req.body.host !== undefined) updates.host = req.body.host;
        if (req.body.port !== undefined) {
            if (!validatePort(req.body.port)) {
                return errorResponse(res, 400, "端口号必须在 1-65535 之间");
            }
            updates.port = req.body.port;
        }
        if (req.body.protocol !== undefined) {
            if (!["http", "https", "ws", "wss"].includes(req.body.protocol)) {
                return errorResponse(res, 400, "不支持的协议类型，支持的类型: http, https, ws, wss");
            }
            updates.protocol = req.body.protocol as NodeProtocol;
        }
        if (req.body.allow_relay !== undefined) updates.allow_relay = Boolean(req.body.allow_relay);
        if (req.body.network_name !== undefined) updates.network_name = req.body.network_name;
        if (req.body.network_secret !== undefined) updates.network_secret = req.body.network_secret;
        if (req.body.max_connections !== undefined) {
            if (!validateNumber(req.body.max_connections, 1)) {
                return errorResponse(res, 400, "最大连接数必须大于 0");
            }
            updates.max_connections = req.body.max_connections;
        }
        if (req.body.qq_number !== undefined) updates.qq_number = req.body.qq_number;
        if (req.body.mail !== undefined) updates.mail = req.body.mail;

        const updatedNode = await Node.update(nodeId, updates);
        if (!updatedNode) {
            return errorResponse(res, 404, "节点不存在");
        }

        logger.info("Node updated successfully", { nodeId: updatedNode.id, nodeName: updatedNode.name });
        successResponse(res, updatedNode, "节点更新成功");
    });

    // 删除节点
    static delete = asyncHandler(async (req: Request, res: Response): Promise<Response | void> => {
        const nodeId = parseInt(req.params.id);

        if (!validateNumber(nodeId, 1)) {
            return errorResponse(res, 400, "无效的节点ID");
        }

        const deleted = await Node.delete(nodeId);
        if (!deleted) {
            return errorResponse(res, 404, "节点不存在");
        }

        logger.info("Node deleted successfully", { nodeId });
        successResponse(res, null, "节点删除成功");
    });

    // 获取节点状态
    static getStatus = asyncHandler(async (req: Request, res: Response): Promise<Response | void> => {
        const nodeId = parseInt(req.params.id);

        if (!validateNumber(nodeId, 1)) {
            return errorResponse(res, 400, "无效的节点ID");
        }

        const status = await Node.getStatus(nodeId);
        if (!status) {
            return errorResponse(res, 404, "节点不存在");
        }

        successResponse(res, status, "节点状态获取成功");
    });

    // 更新节点状态
    static updateStatus = asyncHandler(async (req: Request, res: Response): Promise<Response | void> => {
        const nodeId = parseInt(req.params.id);

        if (!validateNumber(nodeId, 1)) {
            return errorResponse(res, 400, "无效的节点ID");
        }

        // 验证状态数据
        const validationError = validateRequestBody(req, ["status"]);
        if (validationError) {
            return errorResponse(res, 400, validationError);
        }

        let { status, response_time } = req.body;

        if (!["Online", "Offline"].includes(status)) {
            return errorResponse(res, 400, "无效的状态值，支持的值: Online, Offline");
        }

        // 确保 response_time 是数字类型
        response_time = Number(response_time);
        if (!validateNumber(response_time, 0)) {
            response_time = 0;
        }

        // 记录节点状态，将response_time转换为metadata字符串
        const metadata = response_time !== undefined ? JSON.stringify({ response_time }) : undefined;
        console.log('Debug info:', response_time, typeof response_time);
        await Node.updateStatus(nodeId, status as NodeStatus, metadata, response_time);

        logger.info("Node status updated", { nodeId, status });
        successResponse(res, null, "节点状态更新成功");
    });

    // 获取 Peer 节点列表（用于 Peer 发现）
    static getPeers = asyncHandler(async (req: Request, res: Response): Promise<Response | void> => {
        // 获取查询参数
        const count = parseInt(req.query.count as string) || 5;
        const protocol = (req.query.protocol as NodeProtocol) || undefined;
        const region = (req.query.region as string) || undefined;

        // 验证参数
        if (!validateNumber(count, 1, 20)) {
            return errorResponse(res, 400, "节点数量必须在 1-20 之间");
        }

        // 获取节点列表（带负载均衡）
        const result = await Node.getPeers({
            count,
            protocol,
            region,
        });

        // 记录访问日志
        logger.info("Peer discovery request", {
            count: result.peers.length,
            total_available: result.total_available,
            protocol,
            region,
            ip: req.ip,
        });

        successResponse(
            res,
            {
                peers: result.peers,
                total_available: result.total_available,
                next_batch_available: result.next_batch_available,
            },
            "Peer 节点列表获取成功"
        );
    });
}
