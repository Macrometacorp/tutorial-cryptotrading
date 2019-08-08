# Overview
Demo to show a real-time trading dashboard for three different exchanges.

The complete crypto-trading demo has two components:
1. A node application
2. A UI application written in Reactjs

The node application is has three main files:
1. `index.js` - initialisation work for jsc8 and C8 streams
2. `producer.js` - gets the latest values from different exchanges and publishes them to their respective C8 streams
3. `consumer.js` - Listens for the data published on the streams by `producer.js`. Based on that that data it calculates the `moving average` pushes it to a stream and caclulates if it is the right time to `BUY` or `SELL` and writes these suggestions to the `trades` collection.

The UI then makes use of all the streams and the `trades` collection to show the charts and suggestions at one place.

The below steps will describe on how to deploy the node and UI application.

# Prerequisites
`nodejs` and `npm` must be installed on your system.

# Running the node application locally

The code for the node application lives inside the `global-producers` folder.

The login details to be used by the node application are present at `global-producers/Config.js`.

There you can edit the file in order to connect to different tenants and users.
```
module.exports = {
    regionUrl: "qa1-europe-west4.eng1.macrometa.io",
    tenantName: "demo",
    userName: "root",
    password: "demo",
    fabricName: "_system"
}
```

Now to start the server locally just navigate to `global-producers` in your terminal. If `node_modules` folder is not there, execute `npm install`. Once it is done execute `node index.js`. This will start the server on your local machine.

Once the server starts you should be able to see the charts in the UI deployed at `http://qa1.crypto.demo.s3-website.us-east-2.amazonaws.com`.


# Running the UI

The code for the UI lives in the `crypto-demo` folder.

To change the federation that the UI connects to change the `Config.js` file, which exists in `crypto-demo/src/Config.js`
```
const Config = {
    "Mumbai, IND": "qa1-asia-south1.eng1.macrometa.io",
    "Eemshaven, NLD": "qa1-europe-west4.eng1.macrometa.io",
    "The Dalles,US": "qa1-us-west1.eng1.macrometa.io"
}
export default Config;
```

The tenant, user name and password to connect to the provided federation URL will be asked by the UI directly.

# How to run app locally
> NOTE: This step is just for running the UI locally. The actual app is deployed on an AWS S3 Bucket. For the steps on S3 goto the `How to deploy app on S3` section.

Go to crypto-demo and run the following
If `node_modules` is not there, execute `npm install`.

Once all the node modules have been installed execute `npm start` to start the development server. This will start a local development server on `localhost:<some_port>`. 

# How to deploy app on S3

Do to crypto-demo and run `npm run build`.
This will create a folder build.

The contents of this `build`  folder need to be copied to the S3 bucket.

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

# Already deployed demo

Go to `http://qa1.crypto.demo.s3-website.us-east-2.amazonaws.com` 

Login using demo, root, demo and fabric _system.

The graph will start loading data in a minutes time, after calculating SMA.