var nj = require("jsnumpy");
var sma = require("sma");

const ma_len = 10;
let trade_doc_count_max = 20;
const trade_doc_count_delete = 10;
let tradectr = "";
const TRADES_COLLECTION = "trades";

async function insert_trade_into_c8db(cluster, tradeobj, fabric) {
  if (cluster === undefined || cluster === null) {
    console.log("ERROR: cluster is null or empty!");
  }

  if (tradeobj === undefined || tradeobj === null) {
    console.log("ERROR:  trade data object is null or empty!");
  }

  let c8url = cluster;

  const collection = fabric.collection("trades");
  let exists = await collection.exists();

  if (exists === false) {
    await collection.create();
  }

  //Insert the trade
  let doc = {};
  doc.exchange = tradeobj.exchange;
  doc.symbol = tradeobj.symbol;
  doc.quote_region = tradeobj.quote_region;
  doc.trade_strategy = tradeobj.trade_strategy;
  doc.timestamp = tradeobj.timestamp;
  doc.trade_type = tradeobj.trade_type;
  doc.trade_price = tradeobj.trade_price;
  doc.trade_location = cluster;
  collection.save(doc);
  console.log("Saved trade info to C8DB at '" + c8url + "': " + doc.toString());
}

async function delete_first_n_trades_from_c8db(c8_cluster, fabric) {
  if (c8_cluster === undefined || c8_cluster === null) {
    console.log("ERROR: cluster is null or empty!");
  }

  if (!trade_doc_count_delete) {
    console.log(
      "Number of trade documents to delete is null or empty! Must be an integer > 0"
    );
  }

  let ql =
    "FOR doc IN " +
    TRADES_COLLECTION +
    " SORT doc._key ASC LIMIT " +
    trade_doc_count_delete.toString() +
    " REMOVE { _key: doc._key } IN " +
    TRADES_COLLECTION +
    " RETURN doc";

  // Remove the first 'delint' documents from the collection.
  // We first sort by ascending order of key, then limit the
  // output to the first 'delint' records, then issue the remove.
  // The QL output will be the deleted docs, in case you want to
  // use them for something.
  console.log(
    "Deleting first " +
      trade_doc_count_delete.toString() +
      " documents from collection '" +
      TRADES_COLLECTION
  );
  let result = await fabric.query(ql);

  return result;
}

async function consumeData(obj, onOpenCallback, regionUrl, fabric) {
  let collectionhandle = await fabric.collection("trades");
  tradectr = await collectionhandle.count();
  tradectr = tradectr.count;

  const close_history = [];
  const ma_history = [];
  const { quoteStream, region, exchange, maStream } = obj;
  const subscriptionName = `${region}-${exchange}`;
  quoteStream.consumer(
    subscriptionName,
    {
      onopen: () => {
        // start the producer for this stream
        onOpenCallback();
      },
      onmessage: async msg => {
        try {
          let decode_msg_obj = JSON.parse(msg);
          let buff = new Buffer(decode_msg_obj.payload, "base64");
          let dec = buff.toString("ascii");
          dec = JSON.parse(dec);

          // Parse message to extract buy and sell prices
          var close = dec.close;
          var timestamp = dec.timestamp;
          var symbol = dec.symbol;
          var exchange = dec.exchange;
          var quoteregion = dec.region;

          if (close && timestamp) {
            close_history.push(close);
          }

          //Compute & Publish SMA
          if (close_history.length > ma_len) {
            ma_history.push(parseFloat(sma(close_history)[0]));
            var diff = close_history.length - ma_len;
            for (i = 0; i < diff; i++) {
              close_history.splice(0, 1);
            }

            let sma_dict = {};
            sma_dict["region"] = quoteregion;
            sma_dict["exchange"] = exchange;
            sma_dict["symbol"] = symbol;
            sma_dict["ma"] = ma_history[ma_history.length - 1];
            sma_dict["close"] = close;
            sma_dict["timestamp"] = timestamp.toString();
            let sma_dic_str = JSON.stringify(sma_dict);
            maStream.producer(sma_dic_str, regionUrl);
          }

          if (ma_history.length > ma_len) {
            ma_history.splice(0, 1);
          }

          let tradeobj = {};
          tradeobj["exchange"] = exchange;
          tradeobj["symbol"] = symbol;
          tradeobj["quote_region"] = quoteregion;
          tradeobj["trade_strategy"] = "MA Trading";
          tradeobj["timestamp"] = timestamp;
          tradeobj["trade_price"] = close;

          //Do we need to BUY?
          if (
            ma_history.length > 3 &&
            close_history[close_history.length - 1] >
              ma_history[ma_history.length - 1] &&
            close_history[close_history.length - 2] <
              ma_history[ma_history.length - 2]
          ) {
            tradeobj["_key"] = "BUY-" + timestamp.toString();
            tradeobj["trade_type"] = "BUY";
            try {
              await insert_trade_into_c8db(regionUrl, tradeobj, fabric);
              tradectr += 1; // Increment the number of trades we put into the DB
            } catch (e) {
              console.log("Error in inserting to collection", e);
            }
          }

          // Do we need to SELL?
          else if (
            ma_history.length > 3 &&
            close_history[close_history.length - 1] <
              ma_history[ma_history.length - 1] &&
            close_history[close_history.length - 2] >
              ma_history[ma_history.length - 2]
          ) {
            tradeobj["_key"] = "SELL-" + timestamp.toString();
            tradeobj["trade_type"] = "SELL";

            try {
              await insert_trade_into_c8db(regionUrl, tradeobj, fabric);
              tradectr += 1; // Increment the number of trades we put into the DB
            } catch (e) {
              console.log("Error in inserting to collection", e);
            }
          }

          // Check if we need to clean out old trades in the DB.
          // We will remove the first 'trade_doc_count_delete' records from the DB.
          if (tradectr >= trade_doc_count_max) {
            try {
              await delete_first_n_trades_from_c8db(regionUrl, fabric);
              // After the first set of deletes, we set max to the number of docs we
              // deleted the firs time, to keep the number of docs in the DB constant.
              tradectr = await collectionhandle.count(); // Fetch the number of documents in the collection after deletion
              tradectr = tradectr.count;
            } catch (err) {
              console.log("Error in deletion:" + err);
            }
          }
        } catch (e) {
          console.log("Most likely got empty payload");
        }
      }
    },
    regionUrl
  );
}

module.exports = {
  consumeData: consumeData
};
