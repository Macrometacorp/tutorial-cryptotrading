# 1. Overview

Demo to show a real-time trading dashboard for three different exchanges.

The complete crypto-trading demo has two components:

1. A stream application.
2. A UI application written in Reactjs


The UI then makes use of all the streams and the `trades` collection to show the charts and suggestions at one place.

For each of the three exchanges `USD`, `EUR` and `JPY`, this demo makes use of the following streams:

1. `CrytoTraderQuotes{USD/EUR/JPY}`
2. `CryptoTraderQuotesAvg{USD/EUR/JPY}`

The below steps will describe on how to deploy the node and UI application.

# 2. Prerequisites

Clone tutorial-cryptotrading.

`nodejs` and `npm` must be installed on your system.

`trades` collection should be present.

# 3. How to run app(UI) locally

> NOTE: This step is just for running the UI locally. The actual app is deployed on an AWS S3 Bucket. For the steps on S3 goto the `How to deploy app on S3` section.

Go to crypto-demo and run the following
If `node_modules` is not there, execute `npm install`.

Once all the node modules have been installed execute `npm start` to start the development server. This will start a local development server on `localhost:<some_port>`.

# 4. How to deploy app(UI) on S3

If `node_modules` is not there, execute `npm install`.

Do to crypto-demo and run `npm run build`.
This will create a folder build.

The contents of this `build` folder need to be copied to the S3 bucket.

If using aws cli run `aws s3 cp build s3://<your-s3-bucket-name> --recursive` to recursively copy all files and folders inside the `build` folder to the S3 bucket.

The bucket needs to be public in order for the website to be visible.

A sample `bucket policy` is:

```js
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::<your-s3-bucket-name>/*"
        }
    ]
}
```

Now goto the `Properties` tab in the aws console for this bucket and open `Static website hosting` option. Then select the option `Use this bucket to host a website` and provide `index.html` for both `Index document` and `Error document` text fields. Click on save and the website is now live!

# 5. How to deploy the stream application.

Deploy the stream application on your federation and activate the app. Stream app definition can be found [here](./streamapps/Crypto-Trading-App.md)

Activate the app and you will be able to see the data in the UI.

# 6. Already deployed demo

Go to `http://crypto.gdn1.s3-website-us-east-1.amazonaws.com/`

Login using your own credentials or the default ones.

Start the Node server locally to see the data on the Graphs.
