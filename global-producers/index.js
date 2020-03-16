var Fabric = require("jsc8");
const { regionUrl, email, password, fabricName } = require("./Config.js");
const { consumeData } = require("./consumer.js");
const { produceData } = require("./producer.js");
// BEGIN GLOBAL CONSTANTS
const QUOTECURR_EXCHANGE_MAP = {
  USD: {
    region: "USA",
    exchange: "gdax", //This is the id of the exchange in ccxt
    quoteStream: null,
    maStream: null
  },
  EUR: {
    region: "Europe",
    exchange: "bitstamp", //This is the id of the exchange in ccxt
    quoteStream: null,
    maStream: null
  },
  JPY: {
    region: "Asia-Pacific",
    exchange: "bitflyer", //This is the id of the exchange in ccxt
    quoteStream: null,
    maStream: null
  }
};

const BACKLOG_CLEAR_INTERVAL = 60 * 60 * 1000;
const LOGIN_INTERVAL = 6 * 60 * 60 * 1000;

// C8Streams
const QUOTES_TOPIC_PREFIX = "crypto-trader-quotes-";
const AVGQUOTES_TOPIC_PREFIX = "crypto-trader-quotes-avg-";

let fabric;

async function init() {
  fabric = new Fabric(`https://${regionUrl}`);
  await fabric.login(email, password);
  fabric.useFabric(fabricName);

  const response = await fabric.listPersistentStreams(false);
  const streams = response.result;

  const keys = Object.keys(QUOTECURR_EXCHANGE_MAP);
  for (let key of keys) {
    const obj = QUOTECURR_EXCHANGE_MAP[key];

    const quote_topic = `${QUOTES_TOPIC_PREFIX}${key}`;
    obj.quoteStream = fabric.stream(quote_topic, false);

    if (!streams.find(stream => stream.topic === obj.quoteStream.topic)) {
      await obj.quoteStream.createStream();
    }

    const ma_topic = `${AVGQUOTES_TOPIC_PREFIX}${key}`;
    obj.maStream = fabric.stream(ma_topic, false);

    if (!streams.find(stream => stream.topic === obj.maStream.topic)) {
      await obj.maStream.createStream();
    }

    const onOpenCallback = () => {
      produceData(key, obj, regionUrl);
    };

    await consumeData(obj, onOpenCallback, regionUrl, fabric);
  }

  setInterval(async () => {
    try {
      await fabric.clearBacklog();
      console.log("Backlog cleared");
    } catch (e) {
      console.log("Coudn't clear backlog");
    }
  }, BACKLOG_CLEAR_INTERVAL);

  // re-login to get a new token
  let loginCount = 1;
  const login = resetCounter => {
    if (resetCounter) loginCount = 1;
    fabric
      .login(email, password)
      .then(() => {
        console.log(`LOGGED IN ON TRY:${loginCount}`);
      })
      .catch(e => {
        ++loginCount;
        if (loginCount <= 5) {
          console.log(`LOGIN FAILED. Retrying...Retry count: ${loginCount}`);
          login();
        } else {
          console.log(`LOGIN RETRIES EXHAUSTED: ${e}`);
        }
      });
  };
  setInterval(async () => {
    login(true);
  }, LOGIN_INTERVAL);
}

init();
