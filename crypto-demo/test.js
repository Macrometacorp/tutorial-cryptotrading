const log4js = require('log4js');

function producer(){
const logger = log4js.getLogger('producer');
logger.trace('Entering cheese testing');

  log4js.configure({
        appenders: { 
            producer: { type: 'file', filename: 'crypto-trader-producer.log', maxLogSize: 20 }
        },
        categories: { default: { appenders: ['producer'], level: 'info' } }
        });
}

function consumer(){
  log4js.configure({
        appenders: {
            consumer: { type: 'file', filename: 'crypto-trader-consumer.log', maxLogSize: 20 }
        },
        categories: { default: { appenders: ['consumer'], level: 'info' } }
        });
	logger = log4js.getLogger('consumer');
	logger.info("Consumer");
}

producer();
consumer();
