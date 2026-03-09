import { getDb, type DataAdapter } from "./index"

export const sqliteAdapter: DataAdapter = {
  async get(table, id) {
    const db = await getDb()
    const rows = await db.select<Record<string, unknown>[]>(
      `SELECT * FROM ${table} WHERE id = $1`,
      [id]
    )
    return rows[0] ?? null
  },

  async getAll(table, filters) {
    const db = await getDb()
    if (!filters || Object.keys(filters).length === 0) {
      return db.select(`SELECT * FROM ${table} ORDER BY sort_order`)
    }
    const keys = Object.keys(filters)
    const where = keys.map((k, i) => `${k} = $${i + 1}`).join(" AND ")
    const values = keys.map((k) => filters[k])
    return db.select(`SELECT * FROM ${table} WHERE ${where} ORDER BY sort_order`, values)
  },

  async insert(table, data) {
    const db = await getDb()
    const keys = Object.keys(data)
    const cols = keys.join(", ")
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ")
    const values = keys.map((k) => data[k])
    const result = await db.execute(
      `INSERT INTO ${table} (${cols}) VALUES (${placeholders})`,
      values
    )
    return String(result.lastInsertId)
  },

  async update(table, id, data) {
    const db = await getDb()
    const keys = Object.keys(data)
    const set = keys.map((k, i) => `${k} = $${i + 1}`).join(", ")
    const values = [...keys.map((k) => data[k]), id]
    await db.execute(
      `UPDATE ${table} SET ${set} WHERE id = $${keys.length + 1}`,
      values
    )
  },

  async remove(table, id) {
    const db = await getDb()
    await db.execute(`DELETE FROM ${table} WHERE id = $1`, [id])
  },

  async query<T = unknown>(sql: string, params?: unknown[]) {
    const db = await getDb()
    return db.select<T[]>(sql, params ?? [])
  },

  async execute(sql: string, params?: unknown[]) {
    const db = await getDb()
    await db.execute(sql, params ?? [])
  },
}
