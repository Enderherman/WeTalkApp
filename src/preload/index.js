import { contextBridge, ipcRenderer } from 'electron'
import { createRestrictedIpc } from './restrictedIpc.mjs'

contextBridge.exposeInMainWorld('ipcRenderer', createRestrictedIpc(ipcRenderer))
