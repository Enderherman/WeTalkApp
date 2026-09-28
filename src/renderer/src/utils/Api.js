const localApiOrigin = 'http://127.0.0.1:5050'
const localWsOrigin = 'ws://127.0.0.1:5051/ws'
const configuredApiOrigin = String(import.meta.env.RENDERER_VITE_WETALK_SERVER_ORIGIN || '').trim().replace(/\/+$/, '')
const configuredWsOrigin = String(import.meta.env.RENDERER_VITE_WETALK_WS_ORIGIN || '').trim().replace(/\/+$/, '')
const apiOrigin = configuredApiOrigin || localApiOrigin
const wsOrigin = configuredWsOrigin || (configuredApiOrigin
  ? `${configuredApiOrigin.replace(/^http/, 'ws')}/ws`
  : localWsOrigin)

const api = {
  prodDomain: apiOrigin,
  devDomain: apiOrigin,
  prodWsDomain: wsOrigin,
  devWsDomain: wsOrigin,
  checkCode: '/account/checkCode', //验证码
  registerEmailCode: '/account/registerEmailCode', //注册邮箱验证码
  login: '/account/login', //登录
  register: '/account/register', //注册
  getSysSetting: '/account/getSysSetting',
  loadMyGroup: '/group/loadMyGroup', //获取我创建的群组
  saveGroup: '/group/saveGroup', //保存群组
  getGroupInfo: '/group/getGroupInfo', //获取群组信息
  getGroupInfo4Chat: '/group/getGroupInfo4Chat', //获取群聊群详细信息
  dissolutionGroup: '/group/dissolutionGroup', //解散群组
  leaveGroup: '/group/leaveGroup', //退出群组
  addOrRemoveGroupUser: '/group/addOrRemoveGroupUser', //添加或者删除群成员
  search: '/contact/search', //搜索好友
  applyAdd: '/contact/applyAdd', //申请加入
  searchByKeyword: '/contact/searchByKeyword', //按邮箱或昵称搜索联系人
  loadApply: '/contact/loadApply', //获取申请列表
  dealWithApply: '/contact/dealWithApply', //处理申请
  loadContact: '/contact/loadContact', //获取联系人列表
  getContactUserInfo: '/contact/getContactUserInfo', // 获取联系人信息
  addContact2BlackList: '/contact/addContact2BlackList', //拉黑联系人
  delContact: '/contact/delContact', //删除联系人
  getContactInfo: '/contact/getContactInfo', //获取联系人信息
  saveUserInfo: '/account/saveUserInfo', //保存用户信息
  getUserInfo: '/account/getUserInfo', //获取用户信息
  updatePassword: '/account/updatePassword',
  logout: '/account/logout',
  sendMessage: '/chat/sendMessage', //发送消息
  uploadFile: '/chat/uploadFile', //上传文件地址
  loadAdminAccount: '/admin/loadUser', //后台获取用户列表
  updateUserStatus: '/admin/updateUserStatus', //后台更新用户状态
  forceOffLine: '/admin/forcedOffOnline', //强制下线
  loadGroup: '/admin/loadGroup', //群组列表
  adminDissolutionGroup: '/admin/dissolutionGroup', //解散群组
  saveSysSetting: '/admin/saveSystemSetting', //保存系统设置
  getSysSetting4Admin: '/admin/getSystemSetting', //获取系统设置
  loadUpdateDatalist: '/app/loadUpdateList', //获取更新列表
  delUpdate: '/app/deleteUpdate', //删除更新
  saveUpdate: '/app/saveUpdate', //保存更新
  postUpdate: '/app/postUpdate', //发布更新
  loadBeautyAccount: '/userInfoBeauty/loadBeautyAccountList', //靓号列表
  saveBeautAccount: '/userInfoBeauty/saveBeautyAccount', //保存靓号
  delBeautAccount: '/userInfoBeauty/deleteBeautyAccount', //删除靓号
  checkVersion: '/app/checkUpdate' //更新检测
}

export default api
