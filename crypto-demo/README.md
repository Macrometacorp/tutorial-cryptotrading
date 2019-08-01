This section is just for development purposes. **Don't use these steps to deploy the actual application.**

# 1. Overview
Demo to show a real-time trading dashboard for three different exchanges.

# 2. Prerequisites
Create a Collection using the tenant and fabric you wish to use.
```js
collection: trades
```
The federation url has to be provided in `Config.js` file. The user is asked to select one of these regions in the GUI.
```js
const Config = {
    ashburn: "qa1-us-east-1.ops.aws.macrometa.io",
    dublin: "qa1-eu-west-1.ops.aws.macrometa.io",
    incheon: "qa1-ap-northeast-2.ops.aws.macrometa.io"
}
```


# 3. How to run app locally
If `node_modules` is not there, execute `npm install`.

Once all the node modules have been installed execute `npm start` to start the development server. This will start a local development server on `localhost:<some_port>`. 

#4. Already deployed demo

Go to `http://qa1.crypto.demo.s3-website.us-east-2.amazonaws.com/` 
Login using demo, root, demo and fabric _system.

The graph will start loading data in a minutes time, after calculating SMA.
