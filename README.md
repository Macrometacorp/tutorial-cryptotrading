This section is just for development purposes. **Don't use these steps to deploy the actual application.**

# 1. Overview
Demo to show a real-time trading dashboard for three different exchanges.

# 2. Prerequisites
Create a Collection using the tenant and fabric you wish to use.
```js
collection: trades
```
The federation url has to be provided in `Config.js` file in crypto-demo/src/. The user is asked to select one of these regions in the GUI.
```js
const Config = {
    ashburn: "qa1-us-east-1.ops.aws.macrometa.io",
    dublin: "qa1-eu-west-1.ops.aws.macrometa.io",
    incheon: "qa1-ap-northeast-2.ops.aws.macrometa.io"
}
```


# 3. How to run app locally

Go to crypto-demo and run the following
If `node_modules` is not there, execute `npm install`.

Once all the node modules have been installed execute `npm start` to start the development server. This will start a local development server on `localhost:<some_port>`. 

#4. How to deploy app on s3

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

#5. Already deployed demo

Go to `http://qa1.crypto.demo.s3-website.us-east-2.amazonaws.com/` 
Login using demo, root, demo and fabric _system.

The graph will start loading data in a minutes time, after calculating SMA.
