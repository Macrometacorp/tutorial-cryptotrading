# 1. Overview

Demo to show a real-time trading dashboard for three different exchanges.

![crypto-app-ui](https://user-images.githubusercontent.com/1088136/198411981-2afbdd21-d145-4ad6-aea1-ee933ed482a5.png)

The complete crypto-trading demo has two components:

1. A backend built with Macrometa a Document Collection, multiple Streams, and a Stream Worker.

If you haven't already configure the backend, refer to the [Crypto Trading App](https://macrometa.com/docs/apps/crypto-trading).

2. A headless frontend written in ReactJS.

The UI then makes use of all the streams and the `trades` collection to show the charts and suggestions at one place.

For each of the three exchanges `USD`, `EUR` and `JPY`, this demo makes use of the following streams:

- `CrytoTraderQuotes{USD/EUR/JPY}`
- `CryptoTraderQuotesAvg{USD/EUR/JPY}`

The below steps will describe on how to set up the frontend.

# 1. Prerequisites

Clone or Fork this repo.

`nodejs` and `npm` must be installed on your system.

# 2. How to run app(UI) locally

> NOTE: This step is just for running the UI locally.

Go to crypto-demo and run the following
If `node_modules` is not there, execute `npm install`.

Once all the node modules have been installed execute `npm start` to start the development server. This will start a local development server on `localhost:<some_port>`. You can log in with your Macrometa credentials, but make sure you've followed the configuration steps in the [Quick Start Guide](https://macrometa.com/docs/apps/crypto-trading) first.

We also have a frontend [already deployed](https://macrometacorp.github.io/tutorial-cryptotrading/). You can login with the credentials we provide to see the app working, or use your own Macrometa account credentials after you have configured the Crypto App backend.
