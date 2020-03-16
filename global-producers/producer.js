var ccxt = require("ccxt");

const RATE_LIMIT = 5000;
const delay = RATE_LIMIT;
const base_currency = "BTC";

async function init_exchange(value) {
  if (!value) throw "Quote object not passed";

  const eid = value.exchange;
  const exchange = new ccxt[eid]();
  exchange.enableRateLimit = true;
  exchange.rateLimit = RATE_LIMIT;
  await exchange.load_markets();
  console.log("Loaded markets for Cryptocurrency exchange: " + exchange.name);

  return exchange;
}

async function get_ticker(exchange, quote_currency, regionName) {
  if (!exchange) throw "ERROR : exchange is null or empty!";

  let symbol = `${base_currency}/${quote_currency}`;
  let ticker = await exchange.fetch_ticker(symbol);

  let close = ticker["close"];
  let ts = Math.floor(Date.now() / 1000);

  let quote_dict = {};
  quote_dict.region = regionName;
  quote_dict.exchange = exchange.name;
  quote_dict.symbol = symbol;
  quote_dict.timestamp = ts;
  quote_dict.close = close;

  return JSON.stringify(quote_dict);
}

async function produceData(key, value, regionUrl) {
  const exchangeObj = await init_exchange(value);
  const { quoteStream, region } = value;

  setInterval(async () => {
    let ticker = await get_ticker(exchangeObj, key, region);
    quoteStream.producer(ticker, regionUrl);
  }, delay);
}

module.exports = {
  produceData: produceData
};
