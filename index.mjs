import { ingestStockData, preprocess } from "./preprocess.mjs";

async function main() {
    // 拉取股票数据，配置在config.js，存到sqlite stock_monthly表
    await ingestStockData()
    // 预处理数据，存到sqlite serial_item表，每次跑回有个新的run_id，数据不断增加
    await preprocess()
}

main()