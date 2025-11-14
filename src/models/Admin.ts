import crypto from "crypto";
import { getDb, transaction } from "../config/database.js";

// 管理员数据接口
export interface AdminData {
    id?: number;
    username: string;
    password: string;
    email: string;
    qq_number: string;
    created_at?: string;
    updated_at?: string;
}

// Admin 模型类
export class Admin {
    // 生成密码哈希
    private static hashPassword(password: string): string {
        const salt = crypto.randomBytes(16).toString("hex");
        const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
        return `${salt}:${hash}`;
    }

    // 验证密码
    private static verifyPassword(password: string, hashedPassword: string): boolean {
        const [salt, hash] = hashedPassword.split(":");
        const computedHash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
        return hash === computedHash;
    }

    // 创建管理员
    static async create(adminData: AdminData): Promise<Omit<AdminData, "password"> | null> {
        return transaction(async (tx) => {
            // 检查用户名是否已存在
            const existing = await tx.get("SELECT id FROM admins WHERE username = ?", [adminData.username]);
            if (existing) return null;

            const now = new Date().toISOString();
            const hashedPassword = adminData.password ? this.hashPassword(adminData.password) : "";

            const result = await tx.run(
                `INSERT INTO admins (username, password, email, qq_number, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
                [adminData.username, hashedPassword, adminData.email || null, adminData.qq_number || null, now, now]
            );

            return {
                id: result.lastID,
                username: adminData.username,
                email: adminData.email,
                created_at: now,
                updated_at: now,
            };
        });
    }

    // 通过用户名获取管理员
    static async getByUsername(username: string): Promise<{ id: number; password: string } | null> {
        const db = getDb();
        const admin = await db.get<{ id: number; password: string }>(
            "SELECT id, password FROM admins WHERE username = ?",
            [username]
        );
        return admin!;
    }

    // 管理员登录验证
    static async login(username: string, password: string): Promise<{ id: number } | null> {
        const admin = await this.getByUsername(username);
        if (!admin) return null;

        if (this.verifyPassword(password, admin.password)) {
            return { id: admin.id };
        }

        return null;
    }

    // 更新管理员密码
    static async updatePassword(id: number, newPassword: string): Promise<boolean> {
        const db = getDb();
        const hashedPassword = this.hashPassword(newPassword);
        const now = new Date().toISOString();

        const result = await db.run("UPDATE admins SET password = ?, updated_at = ? WHERE id = ?", [
            hashedPassword,
            now,
            id,
        ]);

        return result.changes !== undefined && result.changes > 0;
    }

    // 更新管理员信息
    static async update(
        id: number,
        updates: Partial<Omit<AdminData, "password">>
    ): Promise<Omit<AdminData, "password"> | null> {
        return transaction(async (tx) => {
            const existingAdmin = await tx.get("SELECT id FROM admins WHERE id = ?", [id]);
            if (!existingAdmin) return null;

            const now = new Date().toISOString();
            const updateFields: string[] = [];
            const updateValues: any[] = [];

            if (updates.username !== undefined) {
                // 检查新用户名是否已被其他管理员使用
                const otherAdmin = await tx.get("SELECT id FROM admins WHERE username = ? AND id != ?", [
                    updates.username,
                    id,
                ]);
                if (otherAdmin) return null;

                updateFields.push("username = ?");
                updateValues.push(updates.username);
            }
            if (updates.email !== undefined) {
                updateFields.push("email = ?");
                updateValues.push(updates.email);
            }

            // 添加更新时间
            updateFields.push("updated_at = ?");
            updateValues.push(now);

            // 添加ID参数
            updateValues.push(id);

            // 执行更新
            await tx.run(`UPDATE admins SET ${updateFields.join(", ")} WHERE id = ?`, updateValues);

            // 返回更新后的管理员信息
            const updatedAdmin = await tx.get<any>(
                "SELECT id, username, email, created_at, updated_at FROM admins WHERE id = ?",
                [id]
            );

            return updatedAdmin;
        });
    }

    // 删除管理员
    static async delete(id: number): Promise<boolean> {
        // 不允许删除唯一的管理员
        const db = getDb();
        const countResult = await db.get<{ count: number }>("SELECT COUNT(*) as count FROM admins", []);

        if (!countResult || countResult.count <= 1) {
            return false;
        }

        const result = await db.run("DELETE FROM admins WHERE id = ?", [id]);
        return result.changes !== undefined && result.changes > 0;
    }

    // 获取所有管理员列表
    static async list(): Promise<Omit<AdminData, "password">[]> {
        const db = getDb();
        const admins = await db.all<any[]>(
            "SELECT id, username, email, created_at, updated_at FROM admins ORDER BY created_at DESC"
        );
        return admins;
    }
}
