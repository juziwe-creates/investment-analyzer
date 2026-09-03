export type DailyMarketPrice = {
  priceDate: string;
  openPrice: number | null;
  highPrice: number | null;
  lowPrice: number | null;
  closePrice: number;
  adjustedClosePrice: number | null;
  volume: number | null;
};

export type MarketDividend = {
  exDividendDate: string;
  declarationDate: string | null;
  recordDate: string | null;
  paymentDate: string | null;
  amountPerShare: number;
};

export type FetchMarketDataInput = {
  symbol: string;
  fromDate?: string;
  toDate?: string;
};

export type MarketDataProvider = {
  id: string;
  fetchDailyPrices(input: FetchMarketDataInput): Promise<DailyMarketPrice[]>;
  fetchDividends(input: FetchMarketDataInput): Promise<MarketDividend[]>;
};
