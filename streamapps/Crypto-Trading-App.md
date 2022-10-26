# Stream App Definition

```js

@App:name("Crypto-Trading-App")
@App:description("Crypto Trading demo")
@App:qlVersion('2')

-- The trigger
CREATE TRIGGER CryptoTraderEventsTrigger WITH ( interval = 5 sec );

/*
This app reads every 5 seconds the close prices FROM Coinbase, Bitstamp and Bitflyer exchanges APIs.
Then it calculates the average prices within 10 events window and creates a "BUY/SELL" trading strategy.
The close and average prices are stored in CryptoTraderQuotesAvgXXX streams 
whereas the strategy is kept in trades collection.
*/

/**
Testing the Stream Application:
    1. Publish the app
       
    2. Start the GUI against the same federation
*/

-- Streams for the http call requests
-------------------------------------------------------------------------------------------------------------------------------------

CREATE SINK UsdCryptoTraderRequestStream WITH (type='http-call', publisher.url='https://api.pro.coinbase.com/products/btc-usd/ticker', method='GET', headers="'User-Agent:c8cep'", sink.id='coinbase-ticker', map.type='json') (triggered_time string);

CREATE SINK EurCryptoTraderRequestStream WITH (type='http-call', publisher.url='https://www.bitstamp.net/api/v2/ticker/btceur', method='GET', sink.id='bitstamp-ticker', map.type='json') (triggered_time string);

CREATE SINK JpyCryptoTraderRequestStream WITH (type='http-call', publisher.url='https://api.bitflyer.com/v1/ticker', method='GET', sink.id='bitflyer-ticker', map.type='json') (triggered_time string);

-- Streams for the http call responses
-------------------------------------------------------------------------------------------------------------------------------------

CREATE SOURCE UsdCryptoTraderTickerResponseStream WITH (type='http-call-response', sink.id='coinbase-ticker', http.status.code='200', map.type='json', map.enclosing.element='$.*') (time string, price string);

CREATE SOURCE EurCryptoTraderTickerResponseStream WITH (type='http-call-response', sink.id='bitstamp-ticker', http.status.code='200', map.type='json') (timestamp string, last string);

CREATE SOURCE JpyCryptoTraderTickerResponseStream WITH (type='http-call-response', sink.id='bitflyer-ticker', http.status.code='200', map.type='json') (timestamp string, ltp double);

-- Streams for the close and average prices
-------------------------------------------------------------------------------------------------------------------------------------
CREATE SINK STREAM GLOBAL CryptoTraderQuotesAvgUSDNew(exchange string, quote_region string, symbol string, ma double, close double, timestamp long);

CREATE SINK STREAM GLOBAL CryptoTraderQuotesAvgEURNew(exchange string, quote_region string, symbol string, ma double, close double, timestamp long);

CREATE SINK STREAM GLOBAL CryptoTraderQuotesAvgJPYNew(exchange string, quote_region string, symbol string, ma double, close double, timestamp long);

CREATE SINK TradesBuy WITH (type="logger", prefix='BUY') (exchange string, quote_region string, symbol string, timestamp long, trade_location string,
                          trade_price double, trade_strategy string, trade_type string);

CREATE SINK TradesSell WITH (type="logger", prefix='SELL') (exchange string, quote_region string, symbol string, timestamp long, trade_location string,
                          trade_price double, trade_strategy string, trade_type string);                      

-- Common trades store
CREATE TABLE GLOBAL trades(exchange string, quote_region string, symbol string, timestamp long, trade_location string,
                          trade_price double, trade_strategy string, trade_type string);
                          
-- Common trades store inserts
-------------------------------------------------------------------------------
INSERT INTO trades
SELECT exchange, quote_region, symbol, timestamp, trade_location,
          trade_price, trade_strategy, trade_type
FROM TradesBuy;

INSERT INTO trades
SELECT exchange, quote_region, symbol, timestamp, trade_location,
          trade_price, trade_strategy, trade_type
FROM TradesSell;
                          
-- Fire Coinbase Pro BTC/USD requests initiated by a trigger
-------------------------------------------------------------------------------
INSERT INTO UsdCryptoTraderRequestStream
SELECT time:currentTimestamp() as triggered_time 
FROM CryptoTraderEventsTrigger;

-- Fire Bitstamp BTC/EUR requests initiated by a trigger
-------------------------------------------------------------------------------
INSERT INTO EurCryptoTraderRequestStream
SELECT time:currentTimestamp() as triggered_time 
FROM CryptoTraderEventsTrigger;

-- Fire Bitflyer BTC/JPY requests initiated by a trigger
-------------------------------------------------------------------------------
INSERT INTO JpyCryptoTraderRequestStream
SELECT time:currentTimestamp() as triggered_time 
FROM CryptoTraderEventsTrigger;

-- Coinbase Pro BTC/USD strategy generation
-------------------------------------------------------------------------------------------------
@info(name='Query for BTC/USD close and average prices within moving 10 events windows')
INSERT INTO CryptoTraderQuotesAvgUSDNew
SELECT "Coinbase Pro" as exchange, "USA" as quote_region,
        "BTC/USD" as symbol, avg(convert(price, 'double')) as ma, convert(price, 'double') as close, 
        time:timestampInMilliseconds()/1000 as timestamp
FROM UsdCryptoTraderTickerResponseStream[context:getVar('region') == 'gdn-us-west'] WINDOW SLIDING_LENGTH(10);

@info(name='Query for BTC/USD trading strategy BUY')
INSERT INTO TradesBuy
SELECT e2.exchange, e2.quote_region, e2.symbol, e2.timestamp,
       context:getVar('region') as trade_location,
       e2.close as trade_price, "MA Trading" as trade_strategy,
          'BUY' as trade_type
FROM every e1=CryptoTraderQuotesAvgUSDNew[e1.close < e1.ma], e2=CryptoTraderQuotesAvgUSDNew[e2.close > e2.ma];

@info(name='Query for BTC/USD trading strategy SELL')
INSERT INTO TradesSell
SELECT e2.exchange, e2.quote_region, e2.symbol, e2.timestamp,
       context:getVar('region') as trade_location,
       e2.close as trade_price, "MA Trading" as trade_strategy,
          'SELL' as trade_type
FROM every e1=CryptoTraderQuotesAvgUSDNew[e1.close > e1.ma], e2=CryptoTraderQuotesAvgUSDNew[e2.close < e2.ma];

DELETE trades for expired events 
       ON trades.trade_location == trade_location and trades.symbol == symbol and trades.timestamp < timestamp 
SELECT context:getVar('region') as trade_location, symbol, timestamp
FROM CryptoTraderQuotesAvgUSDNew WINDOW SLIDING_TIME(10);

-- Bitstamp BTC/EUR trading strategy generation
-----------------------------------------------------------------------------------------
@info(name='Query for BTC/EUR close and average prices within moving 10 events windows')
INSERT INTO CryptoTraderQuotesAvgEURNew
SELECT "Bitstamp" as exchange, "Europe" as quote_region,
        "BTC/EUR" as symbol, avg(convert(last, 'double')) as ma, convert(last, 'double') as close, 
        time:timestampInMilliseconds()/1000 as timestamp
FROM EurCryptoTraderTickerResponseStream[context:getVar('region') == 'gdn-us-west'] WINDOW SLIDING_LENGTH(10);

@info(name='Query for BTC/EUR trading strategy BUY')
INSERT INTO TradesBuy
SELECT e2.exchange, e2.quote_region, e2.symbol, e2.timestamp,
       context:getVar('region') as trade_location,
       e2.close as trade_price, "MA Trading" as trade_strategy,
          'BUY' as trade_type
FROM every e1=CryptoTraderQuotesAvgEURNew[e1.close < e1.ma], e2=CryptoTraderQuotesAvgEURNew[e2.close > e2.ma];

@info(name='Query for BTC/EUR trading strategy SELL')
INSERT INTO TradesSell
SELECT e2.exchange, e2.quote_region, e2.symbol, e2.timestamp,
       context:getVar('region') as trade_location,
       e2.close as trade_price, "MA Trading" as trade_strategy,
          'SELL' as trade_type
FROM every e1=CryptoTraderQuotesAvgEURNew[e1.close > e1.ma], e2=CryptoTraderQuotesAvgEURNew[e2.close < e2.ma];

DELETE trades for expired events 
       ON trades.trade_location == trade_location and trades.symbol == symbol and trades.timestamp < timestamp 
SELECT context:getVar('region') as trade_location, symbol, timestamp
FROM CryptoTraderQuotesAvgEURNew WINDOW SLIDING_TIME(10);

-- Bitflyer BTC/JPY strategy generation
----------------------------------------------------------------------------------------------
@info(name='Query for BTC/JPY close and average prices within moving 10 events windows')
INSERT INTO CryptoTraderQuotesAvgJPYNew
SELECT "Bitflyer" as exchange, "Asia-Pacific" as quote_region,
        "BTC/JPY" as symbol, avg(ltp) as ma, ltp as close, 
        time:timestampInMilliseconds()/1000 as timestamp
FROM JpyCryptoTraderTickerResponseStream[context:getVar('region') == 'gdn-us-west'] WINDOW SLIDING_LENGTH(10);

@info(name='Query for BTC/JPY trading strategy BUY')
INSERT INTO TradesBuy
SELECT e2.exchange, e2.quote_region, e2.symbol, e2.timestamp,
       context:getVar('region') as trade_location,
       e2.close as trade_price, "MA Trading" as trade_strategy,
          'BUY' as trade_type
FROM every e1=CryptoTraderQuotesAvgJPYNew[e1.close < e1.ma], e2=CryptoTraderQuotesAvgJPYNew[e2.close > e2.ma];

@info(name='Query for BTC/JPY trading strategy SELL')
INSERT INTO TradesSell
SELECT e2.exchange, e2.quote_region, e2.symbol, e2.timestamp,
       context:getVar('region') as trade_location,
       e2.close as trade_price, "MA Trading" as trade_strategy,
          'SELL' as trade_type
FROM every e1=CryptoTraderQuotesAvgJPYNew[e1.close > e1.ma], e2=CryptoTraderQuotesAvgJPYNew[e2.close < e2.ma];
 
DELETE trades for expired events 
       ON trades.trade_location == trade_location and trades.symbol == symbol and trades.timestamp < timestamp 
SELECT context:getVar('region') as trade_location, symbol, timestamp
FROM CryptoTraderQuotesAvgJPYNew WINDOW SLIDING_TIME(10);

```
