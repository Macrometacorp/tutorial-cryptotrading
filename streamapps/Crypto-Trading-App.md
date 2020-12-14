# Stream App Definition

```js

@App:name("Crypto-Trading-App")
@App:description("Crypto Trading demo")

-- The trigger
define trigger CryptoTraderEventsTrigger at every 5 sec;

/*
This app reads every 5 seconds the close prices from Coinbase, Bitstamp and Bitflyer exchanges APIs.
Then it calculates the average prices within 10 events window and creates a "BUY/SELL" trading strategy.
The close and average prices are stored in CryptoTraderQuotesAvgXXXNew streams 
whereas the strategy is kept in trades collection.
*/

/**
Testing the Stream Application:
    1. Publish the app
       
    2. Start the GUI against the same federation
*/

-- Streams for the http call requests
-------------------------------------------------------------------------------------------------------------------------------------
@sink(type='http-call', publisher.url='https://api.pro.coinbase.com/products/btc-usd/ticker',
      method='GET', headers="'User-Agent:c8cep'", sink.id='coinbase-ticker', @map(type='json'))
define stream UsdCryptoTraderRequestStream (triggered_time string);

@sink(type='http-call', publisher.url='https://www.bitstamp.net/api/v2/ticker/btceur',
      method='GET', sink.id='bitstamp-ticker', @map(type='json'))
define stream EurCryptoTraderRequestStream (triggered_time string);

@sink(type='http-call', publisher.url='https://api.bitflyer.com/v1/ticker',
      method='GET', sink.id='bitflyer-ticker', @map(type='json'))
define stream JpyCryptoTraderRequestStream (triggered_time string);

-- Streams for the http call responses
-------------------------------------------------------------------------------------------------------------------------------------
@source(type='http-call-response', sink.id='coinbase-ticker', http.status.code='200', @map(type='json', enclosing.element="$.*"))
define stream UsdCryptoTraderTickerResponseStream(time string, price string);

@source(type='http-call-response', sink.id='bitstamp-ticker', http.status.code='200', @map(type='json'))
define stream EurCryptoTraderTickerResponseStream(timestamp string, last string);

@source(type='http-call-response', sink.id='bitflyer-ticker', http.status.code='200', @map(type='json'))
define stream JpyCryptoTraderTickerResponseStream(timestamp string, ltp double);

-- Streams for the close and average prices
-------------------------------------------------------------------------------------------------------------------------------------
@sink(type = 'c8streams', stream = "CryptoTraderQuotesAvgUSDNew", @map(type='json'), replication.type="global")
define stream CryptoTraderQuotesAvgUSDNew(exchange string, quote_region string, symbol string, ma double, close double, timestamp long);

@sink(type = 'c8streams', stream = "CryptoTraderQuotesAvgEURNew", @map(type='json'), replication.type="global")
define stream CryptoTraderQuotesAvgEURNew(exchange string, quote_region string, symbol string, ma double, close double, timestamp long);

@sink(type = 'c8streams', stream = "CryptoTraderQuotesAvgJPYNew", @map(type='json'), replication.type="global")
define stream CryptoTraderQuotesAvgJPYNew(exchange string, quote_region string, symbol string, ma double, close double, timestamp long);

-- Common trades store
@store(type='c8db', collection='trades', replication.type="global")
define table trades(exchange string, quote_region string, symbol string, timestamp long,
		            trade_price double, trade_strategy string, trade_type string);
		            
-- Fire Coinbase Pro BTC/USD requests initiated by a trigger
-------------------------------------------------------------------------------
select time:currentTimestamp() as triggered_time from CryptoTraderEventsTrigger
insert into UsdCryptoTraderRequestStream;

-- Fire Bitstamp BTC/EUR requests initiated by a trigger
-------------------------------------------------------------------------------
select time:currentTimestamp() as triggered_time from CryptoTraderEventsTrigger
insert into EurCryptoTraderRequestStream;

-- Fire Bitflyer BTC/JPY requests initiated by a trigger
-------------------------------------------------------------------------------
select time:currentTimestamp() as triggered_time from CryptoTraderEventsTrigger
insert into JpyCryptoTraderRequestStream;

-- Coinbase Pro BTC/USD strategy generation
-------------------------------------------------------------------------------------------------
@info(name='Query for BTC/USD close and average prices within moving 10 events windows')
select "Coinbase Pro" as exchange, "USA" as quote_region,
        "BTC/USD" as symbol, avg(convert(price, 'double')) as ma, convert(price, 'double') as close, 
        --time:timestampInMilliseconds(str:replaceFirst(str:replaceFirst(time, 'T', ' '), 'Z','0'), 'yyyy-MM-dd HH:mm:ss.SSS') as timestamp
        time:timestampInMilliseconds()/1000 as timestamp
  from  UsdCryptoTraderTickerResponseStream[context:getVar('region') == 'gdn-us-west']#window.length(10)
insert into CryptoTraderQuotesAvgUSDNew;

@info(name='Query for BTC/USD trading strategy BUY')
select e2.exchange, e2.quote_region, e2.symbol, e2.timestamp,
       e2.close as trade_price, "MA Trading" as trade_strategy,
  	   'BUY' as trade_type
  from every e1=CryptoTraderQuotesAvgUSDNew[e1.close < e1.ma], e2=CryptoTraderQuotesAvgUSDNew[e2.close > e2.ma]
insert into trades;

@info(name='Query for BTC/USD trading strategy SELL')
select e2.exchange, e2.quote_region, e2.symbol, e2.timestamp,
       e2.close as trade_price, "MA Trading" as trade_strategy,
  	   'SELL' as trade_type
  from every e1=CryptoTraderQuotesAvgUSDNew[e1.close > e1.ma], e2=CryptoTraderQuotesAvgUSDNew[e2.close < e2.ma]
insert into trades;

select timestamp, symbol
  from CryptoTraderQuotesAvgUSDNew#window.time(10 min)
delete trades for expired events on trades.timestamp < timestamp and trades.symbol == symbol;

-- Bitstamp BTC/EUR trading strategy generation
-----------------------------------------------------------------------------------------
@info(name='Query for BTC/EUR close and average prices within moving 10 events windows')
select "Bitstamp" as exchange, "Europe" as quote_region,
        "BTC/EUR" as symbol, avg(convert(last, 'double')) as ma, convert(last, 'double') as close, 
        --convert(timestamp, 'long') as timestamp
        time:timestampInMilliseconds()/1000 as timestamp
  from  EurCryptoTraderTickerResponseStream[context:getVar('region') == 'gdn-us-west']#window.length(10)
insert into CryptoTraderQuotesAvgEURNew;

@info(name='Query for BTC/EUR trading strategy BUY')
select e2.exchange, e2.quote_region, e2.symbol, e2.timestamp,
       e2.close as trade_price, "MA Trading" as trade_strategy,
  	   'BUY' as trade_type
  from every e1=CryptoTraderQuotesAvgEURNew[e1.close < e1.ma], e2=CryptoTraderQuotesAvgEURNew[e2.close > e2.ma]
insert into trades;

@info(name='Query for BTC/EUR trading strategy SELL')
select e2.exchange, e2.quote_region, e2.symbol, e2.timestamp,
       e2.close as trade_price, "MA Trading" as trade_strategy,
  	   'SELL' as trade_type
  from every e1=CryptoTraderQuotesAvgEURNew[e1.close > e1.ma], e2=CryptoTraderQuotesAvgEURNew[e2.close < e2.ma]
insert into trades;

select timestamp, symbol
  from CryptoTraderQuotesAvgEURNew#window.time(10 min)
delete trades for expired events on trades.timestamp < timestamp and trades.symbol == symbol;

-- Bitflyer BTC/JPY strategy generation
----------------------------------------------------------------------------------------------
@info(name='Query for BTC/JPY close and average prices within moving 10 events windows')
select "Bitflyer" as exchange, "Asia-Pacific" as quote_region,
        "BTC/JPY" as symbol, avg(ltp) as ma, ltp as close, 
        --time:timestampInMilliseconds(str:replaceFirst(timestamp, 'T', ' '), 'yyyy-MM-dd HH:mm:ss.SSS') as timestamp
        time:timestampInMilliseconds()/1000 as timestamp
  from  JpyCryptoTraderTickerResponseStream[context:getVar('region') == 'gdn-us-west']#window.length(10)
insert into CryptoTraderQuotesAvgJPYNew;

@info(name='Query for BTC/JPY trading strategy BUY')
select e2.exchange, e2.quote_region, e2.symbol, e2.timestamp,
       e2.close as trade_price, "MA Trading" as trade_strategy,
  	   'BUY' as trade_type
  from every e1=CryptoTraderQuotesAvgJPYNew[e1.close < e1.ma], e2=CryptoTraderQuotesAvgJPYNew[e2.close > e2.ma]
insert into trades;

@info(name='Query for BTC/JPY trading strategy SELL')
select e2.exchange, e2.quote_region, e2.symbol, e2.timestamp,
       e2.close as trade_price, "MA Trading" as trade_strategy,
  	   'SELL' as trade_type
  from every e1=CryptoTraderQuotesAvgJPYNew[e1.close > e1.ma], e2=CryptoTraderQuotesAvgJPYNew[e2.close < e2.ma]
insert into trades;
 
select timestamp, symbol
  from CryptoTraderQuotesAvgJPYNew#window.time(10 min)
delete trades for expired events on trades.timestamp < timestamp and trades.symbol == symbol;

```
