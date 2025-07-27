import sqlite3 from 'sqlite3'
import { runId, stockCode } from './config.mjs';

const vb = sqlite3.verbose();


var db = null

// 获取db连接
export async function init(fileName) {
    return new Promise((resolve, reject) => {
        db = new vb.Database(fileName, (err) => {
            if (err) {
                console.error('连接数据库失败:', err.message);
                reject(err);
            } else {
                console.log('成功连接到SQLite数据库');
                resolve(db);
            }
        });
    }).then(db => {
        createTables()
    });
}

// 关闭数据库
async function closeDBConnection(db) {
    return new Promise((resolve, reject) => {
        db.close((err) => {
            if (err) {
                console.error('关闭数据库失败:', err.message);
                reject(err);
            } else {
                console.log('数据库连接已关闭');
                resolve();
            }
        });
    });
}
export async function createTables() {
    return new Promise((resolve, reject) => {
        const sql1 = `
        CREATE TABLE IF NOT EXISTS stock_monthly (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            stock_code TEXT NOT NULL,
            trade_month TEXT NOT NULL,
            open_price REAL NOT NULL,
            high_price REAL NOT NULL,
            low_price REAL NOT NULL,
            close_price REAL NOT NULL,
            volume INTEGER NOT NULL,
            UNIQUE(stock_code, trade_month)
        )
        `;
        const sql2 = `
            CREATE TABLE IF NOT EXISTS serial_item (
                id TEXT NOT NULL,
                stock_code TEXT NOT NULL,
                run_id TEXT NOT NULL,
                date TEXT NOT NULL,
                value REAL NOT NULL,
                level INTEGER NOT NULL,
                serial_id INTEGER NOT NULL,
                parent_date INTEGER NOT NULL,
                color TEXT NOT NULL,
                type  TEXT NOT NULL,
                num INTEGER NOT NULL,
                UNIQUE(id, run_id)
            )
        `;

        db.run(sql1, (err) => {
            if (err) {
                console.error('创建表失败:', err.message);
                reject(err);
            } else {
                console.log('表创建成功或已存在');
                resolve();
            }
        });
        db.run(sql2, (err) => {
            if (err) {
                console.error('创建表失败:', err.message);
                reject(err);
            } else {
                console.log('表创建成功或已存在');
                resolve();
            }
        });
    });
}
export async function readMonthKData(stockCode) { 
    return new Promise((resolve, reject) => {
        const sql = "SELECT * FROM stock_monthly where stock_code = ? ORDER BY trade_month ";
        db.all(sql, [stockCode], (err, rows) => { 
            if (err) {
                console.error('查询数据失败:', err.message);
                reject(err);
            } else {
                console.log(`查询到${rows.length}条数据`);
                resolve(rows);
            }
        });
    });
}


export async function insertStockData(stockData) {
    return new Promise((resolve, reject) => {
        const sql = `
        INSERT OR REPLACE INTO stock_monthly (stock_code, trade_month, open_price, high_price, low_price,close_price, volume)
        VALUES (?, ?, ?, ?, ?, ?, ?)`;
        db.run(sql, [stockCode, stockData.day.substring(0, 7), stockData.open, stockData.high, stockData.low, stockData.close, stockData.volume])
    })
}



export async function insertSerialItem(item) { 
    return new Promise((resolve, reject) => {
        const sql = `
        INSERT OR REPLACE INTO serial_item 
                (id,
                date,
                value ,
                level,
                serial_id,
                parent_date,
                color,
                type,
                num,
                stock_code,
                run_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
        db.run(sql, [item.id, item.date, item.value, item.level, item.serial, item.parent ? item.parent : "-", item.color, item.type, item.index, stockCode, runId], (err, rows) => { 
            if (err) {
                console.error('插入数据失败:', err.message);
                reject(err);
            }
        });
    });
}

// 插入预处理数据

