export type WatchlistColumnKey =
  | "symbol" | "name" | "lastPrice" | "openPrice" | "highPrice" | "lowPrice"
  | "prevClose" | "vwap" | "upperLimit" | "lowerLimit"
  | "change" | "changePct" | "amplitude" | "gapPct"
  | "volume" | "volumeRatio" | "turnover" | "turnoverRate"
  | "avgVolume5d" | "avgVolume10d" | "relativeVolume" | "netVolume" | "openInterest"
  | "bidPrice1" | "askPrice1" | "spread" | "spreadPct" | "bidAskRatio" | "tradeCount"
  | "ma5" | "ma10" | "ma20" | "ma60" | "ma120" | "ma250"
  | "ema20" | "ema50" | "ema200" | "priceMa5Pct" | "priceMa20Pct"
  | "macdDif" | "macdDea" | "macdHistogram" | "rsi6" | "rsi14"
  | "kdjK" | "kdjD" | "kdjJ" | "cci14" | "williamR14" | "mfi14" | "obv"
  | "bollUpper" | "bollMiddle" | "bollLower" | "bollWidth" | "atr14" | "adx14" | "parabolicSar"
  | "historicalVol10d" | "historicalVol20d" | "beta" | "sharpeRatio" | "maxDrawdown"
  | "return1d" | "return5d" | "return1m" | "return3m" | "return6m" | "return1y" | "returnYtd"
  | "high52w" | "low52w" | "pctFrom52wHigh" | "pctFrom52wLow"
  | "rsRating" | "sectorRank" | "industryRank"
  | "marketCap" | "floatMarketCap" | "peRatioTtm" | "pbRatio" | "psRatioTtm" | "evEbitda" | "pegRatio"
  | "eps" | "bookValuePerShare" | "dividendYield" | "dividendPerShare"
  | "revenueGrowthYoy" | "netIncomeGrowthYoy" | "grossMargin" | "netMargin" | "roe" | "roa" | "debtToEquity"
  | "circulatingSupply" | "totalSupply" | "fullyDilutedValuation" | "fundingRate" | "longShortRatio" | "stakingYield"
  | "analystRating" | "priceTarget" | "priceTargetUpside" | "nextEarningsDate"
  | "exchange" | "sector" | "industry" | "lastUpdateTime" | "notes" | "tags" | "annotation" | "watchlistAddedAt"
  | "miniKline";

export interface ColumnDefinition {
  key: WatchlistColumnKey;
  label: string;
  category: string;
  width: number;
  align: "left" | "right" | "center";
  render?: "number" | "percent" | "currency" | "sparkline" | "text" | "time";
}

export const DEFAULT_COLUMNS: WatchlistColumnKey[] = [
  "symbol", "name", "lastPrice", "changePct", "change",
  "volume", "turnover", "turnoverRate", "miniKline", "annotation",
];

export const COLUMN_DEFINITIONS: ColumnDefinition[] = [
  { key: "symbol", label: "代码", category: "基础价格", width: 80, align: "left", render: "text" },
  { key: "name", label: "名称", category: "基础价格", width: 80, align: "left", render: "text" },
  { key: "lastPrice", label: "最新价", category: "基础价格", width: 80, align: "right", render: "currency" },
  { key: "openPrice", label: "开盘价", category: "基础价格", width: 80, align: "right", render: "currency" },
  { key: "highPrice", label: "最高价", category: "基础价格", width: 80, align: "right", render: "currency" },
  { key: "lowPrice", label: "最低价", category: "基础价格", width: 80, align: "right", render: "currency" },
  { key: "prevClose", label: "昨收价", category: "基础价格", width: 80, align: "right", render: "currency" },
  { key: "upperLimit", label: "涨停价", category: "基础价格", width: 80, align: "right", render: "currency" },
  { key: "lowerLimit", label: "跌停价", category: "基础价格", width: 80, align: "right", render: "currency" },
  { key: "vwap", label: "均价(VWAP)", category: "基础价格", width: 90, align: "right", render: "currency" },
  { key: "change", label: "涨跌额", category: "涨跌指标", width: 80, align: "right", render: "currency" },
  { key: "changePct", label: "涨跌幅", category: "涨跌指标", width: 80, align: "right", render: "percent" },
  { key: "amplitude", label: "振幅", category: "涨跌指标", width: 70, align: "right", render: "percent" },
  { key: "volume", label: "成交量", category: "成交量", width: 90, align: "right", render: "number" },
  { key: "volumeRatio", label: "量比", category: "成交量", width: 60, align: "right", render: "number" },
  { key: "turnover", label: "成交额", category: "成交量", width: 100, align: "right", render: "currency" },
  { key: "turnoverRate", label: "换手率", category: "成交量", width: 70, align: "right", render: "percent" },
  { key: "ma5", label: "MA5", category: "技术指标-均线", width: 80, align: "right", render: "currency" },
  { key: "ma10", label: "MA10", category: "技术指标-均线", width: 80, align: "right", render: "currency" },
  { key: "ma20", label: "MA20", category: "技术指标-均线", width: 80, align: "right", render: "currency" },
  { key: "ma60", label: "MA60", category: "技术指标-均线", width: 80, align: "right", render: "currency" },
  { key: "rsi14", label: "RSI14", category: "技术指标-动量", width: 60, align: "right", render: "number" },
  { key: "macdDif", label: "MACD-DIF", category: "技术指标-动量", width: 80, align: "right", render: "number" },
  { key: "macdHistogram", label: "MACD柱", category: "技术指标-动量", width: 80, align: "right", render: "number" },
  { key: "atr14", label: "ATR14", category: "技术指标-趋势", width: 80, align: "right", render: "number" },
  { key: "bollUpper", label: "布林上轨", category: "技术指标-趋势", width: 90, align: "right", render: "currency" },
  { key: "bollLower", label: "布林下轨", category: "技术指标-趋势", width: 90, align: "right", render: "currency" },
  { key: "return1d", label: "1日涨幅", category: "区间表现", width: 80, align: "right", render: "percent" },
  { key: "return5d", label: "5日涨幅", category: "区间表现", width: 80, align: "right", render: "percent" },
  { key: "return1m", label: "1月涨幅", category: "区间表现", width: 80, align: "right", render: "percent" },
  { key: "returnYtd", label: "年初至今", category: "区间表现", width: 80, align: "right", render: "percent" },
  { key: "marketCap", label: "总市值", category: "基本面-估值", width: 100, align: "right", render: "currency" },
  { key: "peRatioTtm", label: "PE(TTM)", category: "基本面-估值", width: 80, align: "right", render: "number" },
  { key: "pbRatio", label: "PB", category: "基本面-估值", width: 60, align: "right", render: "number" },
  { key: "dividendYield", label: "股息率", category: "基本面-每股", width: 70, align: "right", render: "percent" },
  { key: "roe", label: "ROE", category: "基本面-成长", width: 70, align: "right", render: "percent" },
  { key: "fundingRate", label: "资金费率", category: "加密货币", width: 80, align: "right", render: "percent" },
  { key: "longShortRatio", label: "多空比", category: "加密货币", width: 70, align: "right", render: "number" },
  { key: "annotation", label: "AI标注", category: "其他", width: 200, align: "left", render: "text" },
  { key: "miniKline", label: "mini K线", category: "其他", width: 80, align: "center", render: "sparkline" },
  { key: "watchlistAddedAt", label: "加入时间", category: "其他", width: 100, align: "right", render: "time" },
  { key: "notes", label: "备注", category: "其他", width: 150, align: "left", render: "text" },
];
