A crypto trading app demo to show a real-time trading dashboard for three different exchanges.

![crypto-app-ui](https://user-images.githubusercontent.com/1088136/198411981-2afbdd21-d145-4ad6-aea1-ee933ed482a5.png)

The complete crypto-trading demo has two components:

- A backend built with Macrometa using a Document Collection, multiple Streams, and a Stream Worker.
- A headless frontend written in ReactJS.

Prerequisite: 

- Configure the backend, refer to the [getting started guide](https://macrometa.com/docs/apps/crypto-trading).
- `nodejs` and `npm` must be installed on your system.

The below steps will describe on how to set up the frontend.

## 1. Clone or Fork the Repo

`git clone git@github.com:Macrometacorp/tutorial-cryptotrading.git` or click on the `Fork` button in the upper right hand corner of this repo.

## 2. Run the App Locally

In your terminal, navigate to the crypto-demo folder and run `npm install`

Once all the node modules have been installed, run `npm start` to start the development server.

This starts a local development server on `localhost:<some_port>`. You can log into the app with your Macrometa credentials. You will need to [configure the Crypto App backend](https://macrometa.com/docs/apps/crypto-trading) for the app to work.

We also have a [Crypto Trading App frontend](https://macrometacorp.github.io/tutorial-cryptotrading/) already deployed. You can log in with the pre-filled email and password to see the app working, or use your own Macrometa account email and password after you have [configured](https://macrometa.com/docs/apps/crypto-trading) the Crypto App backend.
