const dotenv = require("dotenv");
dotenv.config();
const mysql = require('mysql2/promise');

async function getConnection() {
    // Return the shared pool so callers can use pool.execute(...) directly.
    // Creating the pool on each call would defeat the purpose; create one and reuse.
    if (!global.__mysqlPool) {
        global.__mysqlPool = mysql.createPool({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,
            user: process.env.DB_USERNAME,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_DATABASE,
            waitForConnections: true,
            connectionLimit: parseInt(process.env.DB_POOL_LIMIT || '10', 10),
            queueLimit: 0,
        });
    }
    return global.__mysqlPool.getConnection();
}

async function closeConnection(connection) {
    if (connection) {
        await connection.release();
    }
}

module.exports = { getConnection, closeConnection };