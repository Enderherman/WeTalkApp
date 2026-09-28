import assert from 'node:assert/strict'
import sqlite3 from 'sqlite3'
import { test } from 'node:test'

test('sqlite3 opens an in-memory database and executes a query', async () => {
  const database = new sqlite3.Database(':memory:')

  try {
    const row = await new Promise((resolve, reject) => {
      database.get('SELECT 42 AS answer', (error, result) => {
        if (error) reject(error)
        else resolve(result)
      })
    })
    assert.equal(row.answer, 42)
  } finally {
    await new Promise((resolve, reject) => {
      database.close((error) => error ? reject(error) : resolve())
    })
  }
})
