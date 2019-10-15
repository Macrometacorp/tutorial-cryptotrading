
var Fabric = require('jsc8');
const { regionUrl, email, password, fabricName } = require("./Config.js");
const { consumeData } = require("./consumer.js");
const { produceData } = require("./producer.js");
// BEGIN GLOBAL CONSTANTS 
const QUOTECURR_EXCHANGE_MAP = {
    "USD": {
        "region": "USA",
        "exchange": "gdax", //This is the id of the exchange in ccxt
        quoteStream: null,
        maStream: null
    },
    "EUR": {
        "region": "Europe",
        "exchange": "bitstamp", //This is the id of the exchange in ccxt
        quoteStream: null,
        maStream: null
    },
    "JPY": {
        "region": "Asia-Pacific",
        "exchange": "bitflyer", //This is the id of the exchange in ccxt
        quoteStream: null,
        maStream: null
    },
}

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
        }

        await consumeData(obj, onOpenCallback, regionUrl, fabric);
    }
};

init();