update public.market_prices
set
  currency = 'EUR',
  updated_at = now()
where
  provider = 'eodhd'
  and upper(provider_symbol) ~ '\.(XETRA|F)$'
  and currency <> 'EUR';

update public.market_dividends
set
  currency = 'EUR',
  updated_at = now()
where
  provider = 'eodhd'
  and upper(provider_symbol) ~ '\.(XETRA|F)$'
  and currency <> 'EUR';
