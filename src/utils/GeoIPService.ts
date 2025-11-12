// src/utils/GeoIPService.ts

import * as maxmind from 'maxmind';
import { CityResponse, AsnResponse, Reader } from 'maxmind';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../config/logger.js';
 
// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 定义数据库文件的路径
const cityDbPath = path.join(__dirname, '..', 'data', 'GeoLite2-City.mmdb');
const asnDbPath = path.join(__dirname, '..', 'data', 'GeoLite2-ASN.mmdb');

class GeoIPService {
    private static instance: GeoIPService;
    private cityReader: Reader<CityResponse> | null = null;
    private asnReader: Reader<AsnResponse> | null = null;
    private initialized: boolean = false;
    private cache: Map<string, { location: CityResponse | null; network: AsnResponse | null; timestamp: number }> = new Map();
    private cacheTTL: number = 3600000; // 缓存有效期：1小时

    private constructor() {}

    // 获取单例实例
    public static getInstance(): GeoIPService {
        if (!GeoIPService.instance) {
            GeoIPService.instance = new GeoIPService();
        }
        return GeoIPService.instance;
    }

    /**
     * 异步初始化服务，加载数据库
     */
    public async initialize(): Promise<boolean> {
        try {
            logger.info(`Loading GeoIP City database from: ${cityDbPath}`);
            this.cityReader = await maxmind.open<CityResponse>(cityDbPath);
            logger.info('GeoIP City database loaded successfully.');
            
            logger.info(`Loading GeoIP ASN database from: ${asnDbPath}`);
            this.asnReader = await maxmind.open<AsnResponse>(asnDbPath);
            logger.info('GeoIP ASN database loaded successfully.');
            
            this.initialized = true;
            return true;
        } catch (error) {
            logger.error('Failed to load GeoIP databases:', error);
            this.initialized = false;
            logger.warn('GeoIP service will be disabled. Continuing without geo-location features.');
            return false;
        }
    }
    
    /**
     * 检查服务是否已初始化
     */
    public isInitialized(): boolean {
        return this.initialized && this.cityReader !== null && this.asnReader !== null;
    }
    
    /**
     * 验证IP地址格式
     */
    private isValidIP(ipAddress: string): boolean {
        const ipRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
        if (!ipRegex.test(ipAddress)) {
            return false;
        }
        
        const parts = ipAddress.split('.');
        return parts.every(part => parseInt(part) >= 0 && parseInt(part) <= 255);
    }
    
    /**
     * 将域名解析为IP地址
     * @param hostname 域名或IP地址
     * @returns 解析后的IP地址，如果是IP则直接返回，如果解析失败则返回null
     */
    private async resolveHostToIP(hostname: string): Promise<string | null> {
        // 如果已经是有效的IP地址，直接返回
        if (this.isValidIP(hostname)) {
            return hostname;
        }
        
        try {
            logger.debug(`Resolving domain ${hostname} to IP address`);
            const dns = await import('dns');
            const addresses = await dns.promises.resolve4(hostname);
            
            if (addresses && addresses.length > 0) {
                logger.debug(`Successfully resolved domain ${hostname} to IP ${addresses[0]}`);
                return addresses[0];
            }
            
            logger.warn(`No IP addresses found for domain ${hostname}`);
            return null;
        } catch (error: any) {
            logger.error(`Error resolving domain ${hostname}:`, error.message);
            return null;
        }
    }

    /**
     * 根据 IP 地址或域名查询地理位置和运营商信息
     * @param target - 要查询的 IP 地址或域名
     * @returns 包含地理位置和运营商信息的对象
     */
    public async lookup(target: string): Promise<{ location: CityResponse | null; network: AsnResponse | null; }> {
        if (!this.initialized || !this.cityReader || !this.asnReader) {
            logger.warn('GeoIPService has not been initialized.');
            return { location: null, network: null };
        }
        
        // 尝试将域名解析为IP地址
        const ipAddress = await this.resolveHostToIP(target);
        if (!ipAddress) {
            logger.warn(`Failed to resolve or invalid target: ${target}`);
            return { location: null, network: null };
        }
        
        // 检查缓存（使用解析后的IP作为缓存键）
        const cached = this.cache.get(ipAddress);
        const now = Date.now();
        
        if (cached && (now - cached.timestamp) < this.cacheTTL) {
            logger.debug(`Cache hit for IP: ${ipAddress}`);
            return { location: cached.location, network: cached.network };
        }
        
        try {
            const location = this.cityReader.get(ipAddress);
            const network = this.asnReader.get(ipAddress);
            
            // 更新缓存
            this.cache.set(ipAddress, {
                location,
                network,
                timestamp: now
            });
            
            // 清理过期缓存（简单实现）
            if (this.cache.size > 1000) {
                this.cleanExpiredCache();
            }
            
            return { location, network };
        } catch (error: any) {
            logger.error(`Error looking up IP ${ipAddress}:`, error.message);
            return { location: null, network: null };
        }
    }
    
    /**
     * 清理过期缓存
     */
    private cleanExpiredCache(): void {
        const now = Date.now();
        let deletedCount = 0;
        
        for (const [ip, cacheEntry] of this.cache.entries()) {
            if (now - cacheEntry.timestamp > this.cacheTTL) {
                this.cache.delete(ip);
                deletedCount++;
            }
        }
        
        logger.debug(`Cache cleaned, deleted ${deletedCount} entries, current size: ${this.cache.size}`);
    }
}

// 导出单例实例
export const geoIPService = GeoIPService.getInstance();