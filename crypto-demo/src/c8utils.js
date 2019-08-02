
var Fabric = require('jsc8')
var ccxt = require('ccxt')
var nj = require('jsnumpy');



var base_currency = "BTC"



// BEGIN GLOBAL CONSTANTS 
const QUOTECURR_EXCHANGE_MAP = {
        "USD" : {
            "region":"USA",
            "exchange": "gdax" //This is the id of the exchange in ccxt
            },
        "EUR" : {
            "region":"Europe",
            "exchange": "bitstamp" //This is the id of the exchange in ccxt
            },
        "JPY" : {
            "region":"Asia-Pacific",
            "exchange": "bitflyer" //This is the id of the exchange in ccxt
            },
        }

const AWSREGION_QUOTECURR_MAP = {
        "us-east1":"USD", 
        "us-east4":"USD", 
        "us-west1":"USD", 
        "us-west2":"USD", 
        "southamerica-east1":"USD",
        "northamerica-northeast1":"USD", 
        "asia-east1":"JPY", 
        "asia-east2":"JPY", 
        "asia-southeast1":"JPY",
        "asia-northeast1":"JPY", 
        "asia-northeast2":"JPY",
        "asia-south1":"JPY",
        "australia-southeast1":"JPY", 
        "europe-west3":"EUR", 
        "europe-west1":"EUR", 
        "europe-west2":"EUR", 
        "europe-west4":"EUR"
	}

// C8Streams
const QUOTES_TOPIC_PREFIX = "crypto-trader-quotes-"
const AVGQUOTES_TOPIC_PREFIX = "crypto-trader-quotes-avg-"


//C8DB

const TRADES_COLLECTION= "trades"
let fabric;
let delay ;
let region ;
let awsregion ;

async function login(regionurl, tenantname, username, password, fabricname ){

    fabric = new Fabric(`https://${regionurl}`)
    await fabric.login(tenantname, username, password);
    fabric.useTenant(tenantname);
    fabric.useFabric(fabricname);

}



function get_quotecurrency(c8cluster){
    if(c8cluster === undefined || c8cluster === null ){
        console.log("ERROR : C8 Cluster is null or empty!")
    }
  
    console.log(AWSREGION_QUOTECURR_MAP)
    for(region of Object.keys(AWSREGION_QUOTECURR_MAP)){
        if(c8cluster.includes(region)){
            awsregion = region
            break
        }
     }

    if(awsregion === "" || awsregion === undefined){
        console.log("ERROR : Valid AWS Region string not found in input C8 Cluster URI '"+c8cluster+"'! Allowable AWS regions are: "+ Object.keys(AWSREGION_QUOTECURR_MAP).toString())
    }

    let quotecurr = AWSREGION_QUOTECURR_MAP[awsregion]
    return quotecurr

}

async function insert_trade_into_c8db(cluster, tradeobj){
    if(cluster === undefined || cluster === null ){
        console.log("ERROR: cluster is null or empty!")
    }

    if(tradeobj === undefined || tradeobj === null){
        console.log(("ERROR:  trade data object is null or empty!"))
    }

    let c8url = cluster

    const collection = fabric.collection('trades')
    let exists = await collection.exists()

    if (exists === true){
        //Collection exists
    }

    else{
        await collection.create()
    }

    //Insert the trade
    let doc = {}
    doc.exchange = tradeobj.exchange
    doc.symbol= tradeobj.symbol 
    doc.quote_region = tradeobj.quote_region
    doc.trade_strategy = tradeobj.trade_strategy 
    doc.timestamp = tradeobj.timestamp
    doc.trade_type = tradeobj.trade_type
    doc.trade_price = tradeobj.trade_price
    doc.trade_location = cluster
    collection.save(doc)
    console.log("Saved trade info to C8DB at '"+c8url+"': "+(doc).toString())
}

async function delete_first_n_trades_from_c8db(c8_cluster, trade_doc_count_delete, fabricname){
    if(c8_cluster === undefined || c8_cluster === null ){
        console.log("ERROR: cluster is null or empty!")
    }

    if(trade_doc_count_delete === undefined || trade_doc_count_delete === null ){
        console.log("Number of trade documents to delete is null or empty! Must be an integer > 0")
    }

    let delint = Number(trade_doc_count_delete)
    let quotecurr = get_quotecurrency(c8_cluster.split(".macrometa.io")[0])
    let ql;
    if (quotecurr){
        //Filter earliest n docs for quotecurr and delete them
        console.log("DELETE: Filter oldest docs for fiat currency: "+quotecurr)
         ql = "FOR doc IN " + TRADES_COLLECTION + " FILTER doc.symbol == \"BTC/" + quotecurr + "\" SORT doc._key ASC LIMIT " + delint.toString() + " REMOVE { _key: doc._key } IN " + TRADES_COLLECTION + " RETURN doc"
     }
   
    else{
        //Fallback - delete earliest n docs without first filtering for quotecurr
        console.log("DELETE: WARNING : Could not determine fiat currency for region. Fallback to deleting non-filtered oldest.")
        ql = "FOR doc IN " + TRADES_COLLECTION + " SORT doc._key ASC LIMIT " + delint.toString() + " REMOVE { _key: doc._key } IN " + TRADES_COLLECTION + " RETURN doc"
    }
   

    // Remove the first 'delint' documents from the collection.
    // We first sort by ascending order of key, then limit the
    // output to the first 'delint' records, then issue the remove.
    // The QL output will be the deleted docs, in case you want to
    // use them for something.
    console.log("Deleting first " + delint.toString() +" documents from collection '" + TRADES_COLLECTION + "' in the database: " + fabricname)
    let result = fabric.query(ql)
    return result
}

function init_exchange(quotecurr){
    if(quotecurr === undefined || quotecurr === null){
    console.log("ERROR: Quote Currency not passed in")
    }
    
    if (Object.keys(QUOTECURR_EXCHANGE_MAP).includes(quotecurr)){
    let eid = QUOTECURR_EXCHANGE_MAP[quotecurr]["exchange"]
    console.log("quote_currency: "+ JSON.stringify(quotecurr)+", exchange_id: "+ JSON.stringify(eid))
    let cmd = 'ccxt.'+ eid + '()'
    let exchange = eval('new ' + cmd)
    exchange.enableRateLimit = true
    exchange.rateLimit = 5000
    console.log("Loading markets for Cryptocurrency exchange: " + exchange.name)
    exchange.load_markets()
    delay = exchange.rateLimit / 1000 // the rateLimit is in milliseconds. divide it by a thousand to get seconds
    return exchange
    }
    }
    

    

async function get_ticker(exchange, base_currency, quote_currency, quoteregion="Unspecified"){
    if (exchange === null || exchange === undefined){
        console.log("ERROR : exchange is null or empty!")
    }
    if (base_currency === null || base_currency === undefined){
        console.log("ERROR: symbol is null or empty!")
    }
    let symbol = base_currency + "/" + quote_currency
    let ticker = await exchange.fetch_ticker(symbol)
    

    let close = ticker['close']
    let ts =  Math.floor(Date.now() / 1000);

    let quote_dict = {}
    quote_dict.region = quoteregion
    quote_dict.exchange = exchange.name
    quote_dict.symbol = symbol
    quote_dict.timestamp = ts
    quote_dict.close = close

    return JSON.stringify(quote_dict)
}

async function custom_producer(regionurl, streamhandle){
    let quote_currency = get_quotecurrency(regionurl.split(".macrometa.io")[0])
  
    console.log("C8 cluster: "+JSON.stringify(regionurl)+", quote_currency: "+ JSON.stringify(quote_currency))
    let quote_region = QUOTECURR_EXCHANGE_MAP[quote_currency]["region"]
    let exchange = init_exchange(quote_currency)
    console.log(
        "C8Cluster: "+ regionurl +", quote_currency: "+ JSON.stringify(quote_currency) +", region:"+ quote_region +", exchange:" + exchange.name)
    //Create a producer to publish the quotes

    let quote_topic = QUOTES_TOPIC_PREFIX + quote_currency

    let streams = await fabric.getStreams();
    streams = streams.result

    let stream ;
    let streams_list = [];
    let element;
    console.log(streams)
    for(element of streams){
        streams_list.push(element.topic)
    }

    console.log("===========STREAMS============", streams_list)

    console.log(quote_topic)
    if(streams_list.includes(quote_topic)){
        console.log("Producer Stream exists");
    } 

    else{
        console.log("Creating Producer")
        stream = fabric.stream(quote_topic, true);
        await stream.createStream();
        streamhandle = stream
    }
   
    console.log("Start publishing quote data...")

    window.setInterval(async function(){
        try{
            console.log("In try")
            let ticker = await get_ticker(exchange, base_currency, quote_currency, quote_region)
            //let encode_ticker = (encodeURIComponent(ticker))
            await streamhandle.producer(ticker,regionurl)
            console.log("Quote data: "+JSON.stringify(ticker))
        }
        catch (err){
            console.log("ERROR: " + err)
    
            }

    }, delay*500);
  

}

    


export async function custom_consumer(regionurl, tenantname, username, password, fabricname){
    
    console.log("region : "+regionurl+" tenant: "+tenantname+" user: "+ username+" pass: "+ password+" fabric: "+fabricname)
    if(regionurl === undefined || regionurl == null){
        console.log("Regionurl not found");
    }
    let quotecurr = get_quotecurrency(regionurl.split(".macrometa.io")[0])

    console.log("C8cluster :"+ regionurl +", quote_currency:"+ JSON.stringify(quotecurr))

    var ma_len = 10
    let close_history = []
    let ma_history = []
    var trade_doc_count_max = 50
    var trade_doc_count_delete = 20  
    
    await login(regionurl, tenantname, username, password, fabricname)

    //Create a producer to publish the SMA of the quotes
    
    var ma_topic = AVGQUOTES_TOPIC_PREFIX + quotecurr
    let stream1 = fabric.stream(ma_topic, false);
    
    await stream1.createStream();
    

    // Subscribe to the quotes topic
    let quote_topic = QUOTES_TOPIC_PREFIX + quotecurr
    console.log("Subscribing to quotes topic to receive messages from the producer process: " + quote_topic)
    const stream_colltwo = fabric.stream(quote_topic, false);
    await stream_colltwo.createStream();
    var tradectr = 1
    stream_colltwo.consumer(quote_topic, {
    onopen: () => custom_producer(regionurl, stream_colltwo),
    onmessage: (msg)=>{
    console.log(msg)
    console.log("Raw message : " + msg)
    //let decode_msg = decodeURIComponent((msg));
    let decode_msg_obj = JSON.parse(msg)
    let buff = new Buffer(decode_msg_obj.payload,'base64')
    let dec = buff.toString('ascii')
    dec = JSON.parse(dec)
    //console.log("Quote from c8 stream: "+decode_msg)
    
    // Parse message to extract buy and sell prices
    var close = dec.close
    var timestamp = dec.timestamp
    var symbol = dec.symbol
    var exchange = dec.exchange
    var quoteregion = dec.region



    if(close && timestamp){
        close_history.push(close)
    }

    console.log("Length : ", close_history.length)
    //Compute & Publish SMA
    if(close_history.length >= ma_len){
        console.log("Publishing mean")
        ma_history.push(nj.mean(close_history))

        let sma_dict = {}
        sma_dict['region'] = quoteregion
        sma_dict['exchange'] = exchange
        sma_dict['symbol'] = symbol
        sma_dict['ma'] = ma_history[ma_history.length-1]
        sma_dict['close'] = close
        sma_dict['timestamp'] = timestamp.toString()

        let sma_dic_str = JSON.stringify(sma_dict)
        //let sma_str_enc = (encodeURIComponent(sma_dic_str))
        console.log("Publishing SMA Data : " + sma_dic_str)
        stream1.producer(sma_dic_str, regionurl)

    }

    //Do we need to BUY?
    if (ma_history.length > 3 &&
    close_history[close_history.length -1] > ma_history[ma_history.length -1] &&
    close_history[close_history.length -2] < ma_history[ma_history.length-2]){
    let tradeobj = {}
    tradeobj["_key"] = "BUY-" + (timestamp).toString()
    tradeobj["exchange"] = exchange
    tradeobj["symbol"] = symbol
    tradeobj["quote_region"] = quoteregion
    tradeobj["trade_strategy"] = "MA Trading"
    tradeobj["timestamp"] = timestamp
    tradeobj["trade_type"] = "BUY"
    tradeobj["trade_price"] = close

    insert_trade_into_c8db(regionurl, tradeobj)
    tradectr += 1  // Increment the number of trades we put into the DB
    console.log("Buy Trade: " + JSON.stringify(tradeobj))
    }


    // Check if we need to clean out old trades in the DB.
    // We will remove the first 'trade_doc_count_delete' records from the DB.
    if (tradectr >= trade_doc_count_max){
        try{
            delete_first_n_trades_from_c8db(regionurl, trade_doc_count_delete, fabricname)
            // After the first set of deletes, we set max to the number of docs we
            // deleted the firs time, to keep the number of docs in the DB constant.
            trade_doc_count_max = trade_doc_count_delete
            tradectr = 0  // Reset tradectr back to 0
        }
        catch(err){
            console.log("Error in deletion:" + err)
        }
    }
    
    }}, regionurl)
    console.log("Processing received quotes in continuous loop...\n\n")



}   