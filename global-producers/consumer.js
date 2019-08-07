var nj = require('jsnumpy');

const ma_len = 10;
let trade_doc_count_max = 50;
const trade_doc_count_delete = 20;
let tradectr = 0;
const TRADES_COLLECTION = "trades";

async function insert_trade_into_c8db(cluster, tradeobj, fabric) {
    if (cluster === undefined || cluster === null) {
        console.log("ERROR: cluster is null or empty!")
    }

    if (tradeobj === undefined || tradeobj === null) {
        console.log(("ERROR:  trade data object is null or empty!"))
    }

    let c8url = cluster

    const collection = fabric.collection('trades')
    let exists = await collection.exists()

    if (exists === false) {
        await collection.create()
    }

    //Insert the trade
    let doc = {}
    doc.exchange = tradeobj.exchange
    doc.symbol = tradeobj.symbol
    doc.quote_region = tradeobj.quote_region
    doc.trade_strategy = tradeobj.trade_strategy
    doc.timestamp = tradeobj.timestamp
    doc.trade_type = tradeobj.trade_type
    doc.trade_price = tradeobj.trade_price
    doc.trade_location = cluster
    collection.save(doc)
    console.log("Saved trade info to C8DB at '" + c8url + "': " + (doc).toString())
}

async function delete_first_n_trades_from_c8db(c8_cluster, trade_doc_count_delete, fabricName, fabric) {
    if (c8_cluster === undefined || c8_cluster === null) {
        console.warn("ERROR: cluster is null or empty!")
    }

    if (!trade_doc_count_delete) {
        console.warn("Number of trade documents to delete is null or empty! Must be an integer > 0")
    }

    let delint = Number(trade_doc_count_delete)
    let quotecurr = get_quotecurrency(c8_cluster.split(".macrometa.io")[0])
    let ql;
    if (quotecurr) {
        //Filter earliest n docs for quotecurr and delete them
        console.log("DELETE: Filter oldest docs for fiat currency: " + quotecurr)
        ql = "FOR doc IN " + TRADES_COLLECTION + " FILTER doc.symbol == \"BTC/" + quotecurr + "\" SORT doc._key ASC LIMIT " + delint.toString() + " REMOVE { _key: doc._key } IN " + TRADES_COLLECTION + " RETURN doc"
    }

    else {
        //Fallback - delete earliest n docs without first filtering for quotecurr
        console.log("DELETE: WARNING : Could not determine fiat currency for region. Fallback to deleting non-filtered oldest.")
        ql = "FOR doc IN " + TRADES_COLLECTION + " SORT doc._key ASC LIMIT " + delint.toString() + " REMOVE { _key: doc._key } IN " + TRADES_COLLECTION + " RETURN doc"
    }


    // Remove the first 'delint' documents from the collection.
    // We first sort by ascending order of key, then limit the
    // output to the first 'delint' records, then issue the remove.
    // The QL output will be the deleted docs, in case you want to
    // use them for something.
    console.log("Deleting first " + delint.toString() + " documents from collection '" + TRADES_COLLECTION + "' in the database: " + fabricName)
    let result = await fabric.query(ql)
    return result
}

async function consumeData(obj, onOpenCallback, regionUrl, fabric) {
    const close_history = [];
    const ma_history = [];
    const { quoteStream, region, exchange, maStream } = obj;
    const subscriptionName = `${region}-${exchange}`;
    quoteStream.consumer(subscriptionName, {
        onopen: () => {
            // start the producer for this stream
            onOpenCallback();
        },
        onmessage: (msg) => {
            try {
                let decode_msg_obj = JSON.parse(msg);
                let buff = new Buffer(decode_msg_obj.payload, 'base64');
                let dec = buff.toString('ascii');
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
                if (close_history.length >= ma_len) {
                    ma_history.push(nj.mean(close_history));

                    let sma_dict = {};
                    sma_dict['region'] = quoteregion;
                    sma_dict['exchange'] = exchange;
                    sma_dict['symbol'] = symbol;
                    sma_dict['ma'] = ma_history[ma_history.length - 1];
                    sma_dict['close'] = close;
                    sma_dict['timestamp'] = timestamp.toString();

                    let sma_dic_str = JSON.stringify(sma_dict);
                    maStream.producer(sma_dic_str, regionUrl);
                }

                //Do we need to BUY?
                if (ma_history.length > 3 &&
                    close_history[close_history.length - 1] > ma_history[ma_history.length - 1] &&
                    close_history[close_history.length - 2] < ma_history[ma_history.length - 2]) {
                    let tradeobj = {};
                    tradeobj["_key"] = "BUY-" + (timestamp).toString();
                    tradeobj["exchange"] = exchange;
                    tradeobj["symbol"] = symbol;
                    tradeobj["quote_region"] = quoteregion;
                    tradeobj["trade_strategy"] = "MA Trading";
                    tradeobj["timestamp"] = timestamp;
                    tradeobj["trade_type"] = "BUY";
                    tradeobj["trade_price"] = close;

                    insert_trade_into_c8db(regionUrl, tradeobj, fabric);
                    tradectr += 1  // Increment the number of trades we put into the DB
                    console.log("Buy Trade: " + JSON.stringify(tradeobj));
                }


                // Check if we need to clean out old trades in the DB.
                // We will remove the first 'trade_doc_count_delete' records from the DB.
                if (tradectr >= trade_doc_count_max) {
                    try {
                        delete_first_n_trades_from_c8db(regionUrl, trade_doc_count_delete, fabricName, fabric);
                        // After the first set of deletes, we set max to the number of docs we
                        // deleted the firs time, to keep the number of docs in the DB constant.
                        trade_doc_count_max = trade_doc_count_delete
                        tradectr = 0  // Reset tradectr back to 0
                    }
                    catch (err) {
                        console.log("Error in deletion:" + err)
                    }
                }

            } catch (e) {
                console.warn("Most likely got empty payload");
            }
        }
    }, regionUrl);
}

module.exports = {
    consumeData: consumeData
}