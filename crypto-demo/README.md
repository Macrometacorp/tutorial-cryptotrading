# Crypto Trading Bot :robot:
[:link: Here](https://t6r8d2q9.stackpathcdn.com) is the link for the live demo!

## Overview
This demo has two main components:
- the stream worker `Crypto-Trading-App`, and
- the front-end app built with React.

### Stream Worker
You can think of stream worker as your back-end code.  
The `Crypto-Trading-App` stream worker tracks the price of three currency pairs:
- Bitcoin vs. the US dollar (BTC/USD),
- Bitcoin vs. the Euro (BTC/EUR), and
- Bitcoin vs. the Japanese Yen (BTC/JPY).

Each currency pair stream are sourced from different cryptocurrency exchanges. In other words, it has three different event sources, one for each currency pair.

For each stream, it calculates the price's moving average (MA). It means that the stream worker will keep the last *N* events and, for each new event coming, it will calculate a new average value. This is all done with a sliding length window function.  

Finally, based on those MA values, the stream worker will create trade suggestions (bid or ask) for the user.

### Front-end App
In your front-end app, you will see three line charts representing the price history of our three currency pairs and the bid/ask suggestions for the user. 

## Run it Locally
### Prerequisites
Make sure you have:
- `trades` document collection with the stream option enabled in **Edge Database**/**COLLECTIONS** section.
- `Crypto-Trading-App` stream worker in **Edge Database/STREAM WORKERS** section.
- an API key with the corresponding permissions.

Also, you would have to create a `.env.development.local` file in `/demos/crypto-trading` directory to store your environment variables. This file must have the following env. variables:

```
REACT_APP_GDN_URL="{GDN_URL}"
REACT_APP_FABRIC_NAME="{FABRIC_NAME}"
REACT_APP_API_KEY="{API_KEY}"
```
### Steps

First, clone the repository and `cd` to the Crypto Trading Bot demo directory.

```
git clone git@github.com:CoxEdge-Tools/demos.git
```

```
cd demos/crypto-trading
```

Then, install the project's dependencies with

```
npm install
```

and finally, run

```
npm start
```
This will start a local development server on `localhost:3000`.

## Build it for Production

First, you will have to create `.env.production.local` file to store your env. variables. This file must have the following env. variables:

```
REACT_APP_GDN_URL="https://coxedge.macrometa.io"
REACT_APP_FABRIC_NAME="db-demo-for-macrometa"
REACT_APP_API_KEY="{API_KEY}"
```

Then, run the command below to generate your `build` directory. You will then host this `build` directory in your server machine.

```
npm run build
```

## How to Deploy the Stream Worker
In the Cox Edge Portal, go to **Edge Database** section. Then select **STREAM WORKERS** and click on "New Stream Worker" button to create a new stream worker.  

Copy and paste the content of [`Crypto-Trading-App.md`]() file in your editor. Save it and then publish it.  
