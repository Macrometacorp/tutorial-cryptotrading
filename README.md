# 1. Overview

Demo to show a real-time trading dashboard for three different exchanges.

The complete crypto-trading demo has two components:

1. A stream application.
2. A UI application written in Reactjs


The UI then makes use of all the streams and the `trades` collection to show the charts and suggestions at one place.

For each of the three exchanges `USD`, `EUR` and `JPY`, this demo makes use of the following streams:

1. `CrytoTraderQuotes{USD/EUR/JPY}`
2. `CryptoTraderQuotesAvg{USD/EUR/JPY}`

The below steps will describe on how to deploy the node and UI application.

# 2. Prerequisites

Clone tutorial-cryptotrading.

`nodejs` and `npm` must be installed on your system.

`trades` collection should be present.

# 3. How to run app(UI) locally

> NOTE: This step is just for running the UI locally. The actual app is deployed on an AWS S3 Bucket. For the steps on S3 goto the `How to deploy app on S3` section.

Go to crypto-demo and run the following
If `node_modules` is not there, execute `npm install`.

Once all the node modules have been installed execute `npm start` to start the development server. This will start a local development server on `localhost:<some_port>`.

# 4. How to deploy app(UI) on S3

If `node_modules` is not there, execute `npm install`.

Do to crypto-demo and run `npm run build`.
This will create a folder build.

The contents of this `build` folder need to be copied to the S3 bucket.

If using aws cli run `aws s3 cp build s3://<your-s3-bucket-name> --recursive` to recursively copy all files and folders inside the `build` folder to the S3 bucket.

The bucket needs to be public in order for the website to be visible.

A sample `bucket policy` is:

```js
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::<your-s3-bucket-name>/*"
        }
    ]
}
```

Now goto the `Properties` tab in the aws console for this bucket and open `Static website hosting` option. Then select the option `Use this bucket to host a website` and provide `index.html` for both `Index document` and `Error document` text fields. Click on save and the website is now live!

# 5. How to deploy the stream application.

Deploy the following stream application on your federation and activate the app.

```
@App:name("Crypto-Trading-App")
@App:description("Crypto Trading demo")

-- The trigger
define trigger CryptoTraderEventsTrigger at every 5 sec;

/*
This app reads every 5 seconds the close prices from Coinbase, Bitstamp and Bitflyer exchanges APIs.
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
@sink(type = 'c8streams', stream = "CryptoTraderQuotesAvgUSD", @map(type='json'), replication.type="global")
define stream CryptoTraderQuotesAvgUSD(exchange string, quote_region string, symbol string, ma double, close double, timestamp long);

@sink(type = 'c8streams', stream = "CryptoTraderQuotesAvgEUR", @map(type='json'), replication.type="global")
define stream CryptoTraderQuotesAvgEUR(exchange string, quote_region string, symbol string, ma double, close double, timestamp long);

@sink(type = 'c8streams', stream = "CryptoTraderQuotesAvgJPY", @map(type='json'), replication.type="global")
define stream CryptoTraderQuotesAvgJPY(exchange string, quote_region string, symbol string, ma double, close double, timestamp long);

-- Common trades store
@store(type='c8db', collection='trades', replication.type="local")
define table trades(exchange string, quote_region string, symbol string, timestamp long, trade_location string,
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
  from  UsdCryptoTraderTickerResponseStream#window.length(10)
insert into CryptoTraderQuotesAvgUSD;

@info(name='Query for BTC/USD trading strategy BUY')
select e2.exchange, e2.quote_region, e2.symbol, e2.timestamp,
       "gdn1.prod.macrometa.io" as trade_location,
       e2.close as trade_price, "MA Trading" as trade_strategy,
  	   'BUY' as trade_type
  from every e1=CryptoTraderQuotesAvgUSD[e1.close < e1.ma], e2=CryptoTraderQuotesAvgUSD[e2.close > e2.ma]
insert into trades;

@info(name='Query for BTC/USD trading strategy SELL')
select e2.exchange, e2.quote_region, e2.symbol, e2.timestamp,
       "gdn1.prod.macrometa.io" as trade_location,
       e2.close as trade_price, "MA Trading" as trade_strategy,
  	   'SELL' as trade_type
  from every e1=CryptoTraderQuotesAvgUSD[e1.close > e1.ma], e2=CryptoTraderQuotesAvgUSD[e2.close < e2.ma]
insert into trades;

select timestamp, symbol
  from CryptoTraderQuotesAvgUSD#window.time(10 min)
delete trades for expired events on trades.timestamp < timestamp and trades.symbol == symbol;

-- Bitstamp BTC/EUR trading strategy generation
-----------------------------------------------------------------------------------------
@info(name='Query for BTC/EUR close and average prices within moving 10 events windows')
select "Bitstamp" as exchange, "Europe" as quote_region,
        "BTC/EUR" as symbol, avg(convert(last, 'double')) as ma, convert(last, 'double') as close, 
        --convert(timestamp, 'long') as timestamp
        time:timestampInMilliseconds()/1000 as timestamp
  from  EurCryptoTraderTickerResponseStream#window.length(10)
insert into CryptoTraderQuotesAvgEUR;

@info(name='Query for BTC/EUR trading strategy BUY')
select e2.exchange, e2.quote_region, e2.symbol, e2.timestamp,
       "gdn1.prod.macrometa.io" as trade_location,
       e2.close as trade_price, "MA Trading" as trade_strategy,
  	   'BUY' as trade_type
  from every e1=CryptoTraderQuotesAvgEUR[e1.close < e1.ma], e2=CryptoTraderQuotesAvgEUR[e2.close > e2.ma]
insert into trades;

@info(name='Query for BTC/EUR trading strategy SELL')
select e2.exchange, e2.quote_region, e2.symbol, e2.timestamp,
       "gdn1.prod.macrometa.io" as trade_location,
       e2.close as trade_price, "MA Trading" as trade_strategy,
  	   'SELL' as trade_type
  from every e1=CryptoTraderQuotesAvgEUR[e1.close > e1.ma], e2=CryptoTraderQuotesAvgEUR[e2.close < e2.ma]
insert into trades;

select timestamp, symbol
  from CryptoTraderQuotesAvgEUR#window.time(10 min)
delete trades for expired events on trades.timestamp < timestamp and trades.symbol == symbol;

-- Bitflyer BTC/JPY strategy generation
----------------------------------------------------------------------------------------------
@info(name='Query for BTC/JPY close and average prices within moving 10 events windows')
select "Bitflyer" as exchange, "Asia-Pacific" as quote_region,
        "BTC/JPY" as symbol, avg(ltp) as ma, ltp as close, 
        --time:timestampInMilliseconds(str:replaceFirst(timestamp, 'T', ' '), 'yyyy-MM-dd HH:mm:ss.SSS') as timestamp
        time:timestampInMilliseconds()/1000 as timestamp
  from  JpyCryptoTraderTickerResponseStream#window.length(10)
insert into CryptoTraderQuotesAvgJPY;

@info(name='Query for BTC/JPY trading strategy BUY')
select e2.exchange, e2.quote_region, e2.symbol, e2.timestamp,
       "gdn1.prod.macrometa.io" as trade_location,
       e2.close as trade_price, "MA Trading" as trade_strategy,
  	   'BUY' as trade_type
  from every e1=CryptoTraderQuotesAvgJPY[e1.close < e1.ma], e2=CryptoTraderQuotesAvgJPY[e2.close > e2.ma]
insert into trades;

@info(name='Query for BTC/JPY trading strategy SELL')
select e2.exchange, e2.quote_region, e2.symbol, e2.timestamp,
       "gdn1.prod.macrometa.io" as trade_location,
       e2.close as trade_price, "MA Trading" as trade_strategy,
  	   'SELL' as trade_type
  from every e1=CryptoTraderQuotesAvgJPY[e1.close > e1.ma], e2=CryptoTraderQuotesAvgJPY[e2.close < e2.ma]
insert into trades;
 
select timestamp, symbol
  from CryptoTraderQuotesAvgJPY#window.time(10 min)
delete trades for expired events on trades.timestamp < timestamp and trades.symbol == symbol;

```

Activate the app and you will be able to see the data in the UI.

# 6. Already deployed demo

Go to `http://crypto.gdn1.s3-website-us-east-1.amazonaws.com/`

Login using your own credentials or the default ones.

Start the Node server locally to see the data on the Graphs.
