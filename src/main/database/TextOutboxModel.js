import { queryAll, run } from './ADB'
import store from '../store'

export const loadTextOutbox = () => queryAll('SELECT * FROM text_outbox WHERE user_id = ? ORDER BY created_at, client_message_id', [store.getUserId()])
export const saveTextDraft = (item) => run('INSERT OR REPLACE INTO text_outbox(user_id,client_message_id,contact_id,session_id,message_content,created_at,status,error,retryable) VALUES(?,?,?,?,?,?,?,?,?)', [store.getUserId(), item.clientMessageId, item.contactId, item.sessionId, item.messageContent, item.createdAt, item.status, item.error || '', item.retryable ? 1 : 0])
export const removeTextDraft = (clientMessageId) => run('DELETE FROM text_outbox WHERE user_id = ? AND client_message_id = ?', [store.getUserId(), clientMessageId])
