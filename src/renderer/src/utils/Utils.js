import moment from 'moment'

// 创建简体中文的 locale 配置
moment.locale('zh-cn', {
  months: '一月_二月_三月_四月_五月_六月_七月_八月_九月_十月_十一月_十二月'.split('_'),
  monthsShort: '1月_2月_3月_4月_5月_6月_7月_8月_9月_10月_11月_12月'.split('_'),
  weekdays: '星期日_星期一_星期二_星期三_星期四_星期五_星期六'.split('_'),
  weekdaysShort: '周日_周一_周二_周三_周四_周五_周六'.split('_'),
  weekdaysMin: '日_一_二_三_四_五_六'.split('_'),
  longDateFormat: {
    LT: 'HH:mm',
    LTS: 'HH:mm:ss',
    L: 'YYYY/MM/DD',
    LL: 'YYYY年M月D日',
    LLL: 'YYYY年M月D日 HH:mm',
    LLLL: 'YYYY年M月D日dddd HH:mm',
    l: 'YYYY/MM/DD',
    ll: 'YYYY年M月D日',
    lll: 'YYYY年M月D日 HH:mm',
    llll: 'YYYY年M月D日dddd HH:mm'
  }
})

const isEmpty = (str) => {
  return str == null || str === '' || str === undefined
}

const getAreaInfo = (data) => {
  if (isEmpty(data)) {
    return '-'
  }
  return data.replace(',', ' ')
}

const formatDate = (timestamp) => {
  const timestampTime = moment(timestamp)
  const days = moment().startOf('day').diff(timestampTime.clone().startOf('day'), 'days')
  if (days === 0) {
    return timestampTime.format('HH:mm')
  } else if (days === 1) {
    return '昨天'
  } else if (days >= 2 && days < 7) {
    //大于1天小于7天显示星期几
    return timestampTime.format('dddd')
  } else if (days >= 7) {
    //显示年月日
    return timestampTime.format('YY/MM/DD')
  }
  return timestampTime.format('HH:mm')
}

const sizeToStr = (limit) => {
  var size = ''
  if (limit < 0.1 * 1024) {
    //小于0.1KB,则转化成B
    size = limit.toFixed(2) + 'B'
  } else if (limit < 1024 * 1024) {
    //小于0.1MB，则转化成KB
    size = (limit / 1024).toFixed(2) + 'KB'
  } else if (limit < 1024 * 1024 * 1024) {
    //小于1GB，则转化成MB
    size = (limit / (1024 * 1024)).toFixed(2) + 'MB'
  } else {
    //其他转化成GB
    size = (limit / (1024 * 1024 * 1024)).toFixed(2) + 'GB'
  }
  var sizeStr = size + '' //转成字符串
  var index = sizeStr.indexOf('.') //获取小数点处的索引
  var dou = sizeStr.substring(index + 1, 2) //获取小数点后两位的值
  if (dou === '00') {
    //判断后两位是否为00，如果是则删除00
    return sizeStr.substring(0, index) + sizeStr.substring(index + 3, 2)
  }
  return size
}
export default {
  isEmpty,
  getAreaInfo,
  formatDate,
  sizeToStr
}
