A crypto trading app demo to show a real-time trading dashboard for three different exchanges.

![crypto-app-ui](https://user-images.githubusercontent.com/1088136/198411981-2afbdd21-d145-4ad6-aea1-ee933ed482a5.png)

The complete crypto-trading demo has two components:

1. A backend built with Macrometa a Document Collection, multiple Streams, and a Stream Worker.

If you haven't already configure the backend, refer to the [Crypto Trading App](https://macrometa.com/docs/apps/crypto-trading).

2. A headless frontend written in ReactJS.

The below steps will describe on how to set up the frontend.

Prerequisite: `nodejs` and `npm` must be installed on your system.

## 1. Clone or Fork the Repo

`git clone git@github.com:Macrometacorp/tutorial-cryptotrading.git` or click on the `Fork` button in the upper right hand corner of this repo.

## 2. Run the App Locally

Go to the crypto-demo folder in a terminal and run the following: `npm install`

Once all the node modules have been installed, execute `npm start` to start the development server. This starts a local development server on `localhost:<some_port>`. You can log into the app with your Macrometa credentials. You will need to configure the Crypto App backend for the app to work.

We also have a [Crypto Trading App frontend](https://macrometacorp.github.io/tutorial-cryptotrading/) already deployed. You can log in with the credentials we provide to see the app working, or use your own Macrometa account credentials after you have configured the Crypto App backend.
