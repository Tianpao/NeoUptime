import sqlite from "node:sqlite";
import config from "./config.js";
const sql = new sqlite.DatabaseSync(config.server.db_path);

export default sql;
