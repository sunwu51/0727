import { calculate } from "./WGYR.mjs";
import { dbFile, stockCode } from "./config.mjs";
import { readMonthKData, init, insertSerialItem, insertStockData } from "./db.mjs";

const cache = {
  'up': new Set(),
  'down': new Set(),
}
let globalSeriesId = 1;

// 数据在sqlite文件中
init(dbFile)


// 从雅虎爬取股票数据，股票代码在config.js配置
export async function ingestStockData() { 
  const now = new Date()
  const endDate = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
  const startDate = '1900-01-01'
  const fullCode = stockCode.startsWith('6') ? 'sh' + stockCode : 'sz' + stockCode
  var url = `http://quotes.sina.cn/cn/api/jsonp_v2.php/var%20_${fullCode}_${endDate}=/CN_MarketDataService.getKLineData?symbol=${fullCode}&scale=7200&ma=5&datalen=250`
  const resp = await fetch(url)
  const text = await resp.text()
  const result = JSON.parse(text.substring(text.indexOf('(') + 1, text.lastIndexOf(')')))
  result.forEach(item => {
    insertStockData(item)
  })
}

// 处理股票数据生成GYR数据item，也存入sqlite
export async function preprocess() {
  let data = await readMonthKData(stockCode);
  const startIndex = findMinValueIndex(data, 0, data.length)
  const scale = 100;
  data = data.map(it => {
    return {
      ...it,
      open_price: Math.round(it.open_price * scale),
      close_price: Math.round(it.close_price * scale),
      high_price: Math.round(it.high_price * scale),
      low_price: Math.round(it.low_price * scale),
    }
  })
  await processData(startIndex, data)
}



/**
 * 处理一个系列的数据
*/
async function processData(startIndex, data, level = 1, s = globalSeriesId, parent = null, up = true) {
  if (up) {
    if (cache.up.has(startIndex)) return
    cache.up.add(startIndex)
  } else {
    if (cache.down.has(startIndex)) return
    cache.down.add(startIndex)
  }
  var start = data[startIndex];
  var value = up ? start.low_price : start.high_price;
  var count = 0;
  var result = [
    new Item(`${level}_${s}_${++count}`, start.trade_month, level, `s_${level}_${s}`, parent, "W", "I", 1, value)
  ]

  var WGYR = ['W', 'G', 'Y', 'R']
  var stacks = [null, [], [], []]

  var basises = await calculate(parseInt(value), up)
  // 逐条处理从startIndex往后的所有数据
  for (var i = startIndex + 1; i < data.length; i++) {
    for (var j = 1; j < 4; j++) {
      var basis = basises[j], color = WGYR[j], stack = stacks[j]
      var preItemForCurrentColor = stack.findLast(() => true);
      if (up && data[i].high_price > basis) {
        // 只有下来了才能触发再上去H
        if (preItemForCurrentColor == null || preItemForCurrentColor.type == 'B') {
          var item = new Item(
            `${level}_${s}_${++count}`,
            data[i].trade_month,
            level,
            `s_${level}_${s}`,
            parent,
            color,
            'H',
            preItemForCurrentColor ? preItemForCurrentColor.index + 1 : 1,
            data[i].high_price
          )
          stack.push(item)
          result.push(item)

          // 把当前颜色前一个B节点改为final触发递归流程
          if (preItemForCurrentColor != null) {
            preItemForCurrentColor.final = true
            console.log(`add ${preItemForCurrentColor.date} ${preItemForCurrentColor.value} to recursive task`)
            const tmpIndex = data.findIndex(it => it.trade_month === preItemForCurrentColor.date)
            await processData(tmpIndex, data, level + 1, ++globalSeriesId, preItemForCurrentColor.date, up)
          }
        }
      }
      if (up && data[i].low_price < basis) {
        if (preItemForCurrentColor != null) {
          // 前一个是H则直接插入B
          if (preItemForCurrentColor.type == 'H') {
            var item = new Item(
              `${level}_${s}_${++count}`,
              data[i].trade_month,
              level,
              `s_${level}_${s}`,
              parent,
              color,
              'B',
              preItemForCurrentColor.index,
              data[i].low_price,
              false
            )
            stack.push(item)
            result.push(item)
          } else if (!preItemForCurrentColor.final) {
            // 前一个是B，则判断当前值是否更低，是的话更新前值
            if (data[i].low_price < preItemForCurrentColor.value) {
              preItemForCurrentColor.value = data[i].low_price
              preItemForCurrentColor.date = data[i].trade_month
            }
          }
        }
      }

      // todo: up = false，下降序列的处理
    }
  }
  result.forEach(item => {
    console.log(item.toString())
    insertSerialItem(item)
  })
}

class Item {
  /**
   * @param {string} id     61000101_1_1_1
   * @param {string} date   月
   * @param {Number} level  从1开始的递归层级
   * @param {Number} serial 从s_1_1开始的序列号 
   * @param {string} parent   从哪个节点衍生过来的
   * @param {string} color  WGYR之一 W是第一个节点
   * @param {string} type   HBI之一  I是第一个节点
   * @param {Number} index  第几次触发color_type
   * @param {Number} value  当前date对应的股价
   */
  constructor(id, date, level, serial, parent, color, type, index, value, final = true) {
    this.id = id;
    this.date = date;
    this.level = level;
    this.serial = serial;
    this.parent = parent;
    this.color = color;
    this.type = type;
    this.index = index;
    this.value = value;
    this.final = final;
  }
  toString() {
    return `${this.parent ? this.parent : "-------"}[${this.id}]${this.color}${this.type}${this.index}:${parseInt(this.value)}(${this.date})`
  }
}


function findMinValueIndex(data, startIndex, endIndex) {
  var min = data[startIndex].low_price;
  var minIndex = startIndex;
  for (var i = startIndex + 1; i < endIndex; i++) {
    if (data[i].low_price < min) {
      min = data[i].low_price;
      minIndex = i;
    }
  }
  return minIndex;
}


function findMaxValueIndex(data, startIndex, endIndex) {
  var max = data[startIndex].high_price;
  var maxIndex = startIndex;
  for (var i = startIndex + 1; i < endIndex; i++) {
    if (data[i].high_price > max) {
      max = data[i].high_price;
      maxIndex = i;
    }
  }
  return maxIndex;
}