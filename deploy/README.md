# Deploy Crypto-Trading Demo

All commmands in the README are assumed to be run at root dir of `C8Demos`

## Install crypto-trading demo with helm chart

Helm chart for the demo is stored in [here](https://github.com/Macrometacorp/SampleApps/tree/master/Global_Crypto_Trading/deploy/crypto-trading).

- To install the demo helm chart to a demo cluster, first download the `kubeconfig` file of the cluster from S3 and save them into `~/.kube/` directory

- Change the `~/.bash_profile` or `~/.profile` to add the following line; note each `demo-xx-xxxx-x` file corresponds to the `kubeconfig` file downloaded; and the `config` just an empty file, i.e. `touch ~/.kube/config`

    ```bash
    export KUBECONFIGPATH=$HOME/.kube
    export KUBECONFIG=$KUBECONFIGPATH/config:$KUBECONFIGPATH/demo1-ap-northeast-1:$KUBECONFIGPATH/demo1-eu-west-1:$KUBECONFIGPATH/demo1-us-east-1:$KUBECONFIGPATH
    ```

- After done modification of the `~/.profile` file, load it to current shell by `source ~/.profile` or just open another terminal window

- Verify that the context of each of the cluster is set using `kubectl config get-contexts`

    ```bash
    $ kubectl config get-contexts
        CURRENT   NAME                                              CLUSTER                                           AUTHINFO                                          NAMESPACE
          demo1-ap-northeast-1.demo.aws.macrometa.io   demo-356-ap-northeast-1.demo.aws.macrometa.io   demo-356-ap-northeast-1.demo.aws.macrometa.io   
          demo1-us-east-1.demo.aws.macrometa.io        demo-db4-us-east-1.demo.aws.macrometa.io        demo-db4-us-east-1.demo.aws.macrometa.io        
          demo1-eu-west-1.demo.aws.macrometa.io        demo-e22-eu-west-1.demo.aws.macrometa.io        demo-e22-eu-west-1.demo.aws.macrometa.io 
    ```
- Switch to the context where you want to install the demo. For example if intended to install the demo on `us-east-1`, then run the command

```bash
$ kubectl config use-context demo1-us-east-1.demo.aws.macrometa.io
```

- After switching to the context of the region which the demo is to be installed, check the helm chart installed by running `helm ls --all` command, make sure no  demo chart had been installed

```bash
$ helm ls --all
NAME        REVISION    UPDATED                     STATUS      CHART               NAMESPACE  
c8db         1          Tue Aug 21 13:41:20 2018    DEPLOYED    c8db-0.10.1          c8
c8fn         1          Tue Aug 21 13:42:10 2018    DEPLOYED    c8fn-0.10.1          c8
c8streams    1          Tue Aug 21 13:38:16 2018    DEPLOYED    c8streams-0.10.1     c8
....
....

```

- Use `helm install` command to install the crypto-trading demo chart. 

**NOTE:** be sure to change the `cluster.name` field and `cryptotrading.ingress.host` field to the corresponding cluster dns name whenever installing on a different cluster

    ```bash
    $ helm --timeout 1800 install --name crypto-trading --namespace c8 --set cluster.name=demo1-us-west-1.demo.aws.macrometa.io --set cryptotrading.image.tag=0.10.1 --set cryptotrading.uiImage.tag=0.10.1 --set cryptotrading.ingress.host=demo1-us-west-1.demo.aws.macrometa.io --set cryptotrading.ingress.path=/c8demo/crypto c8demo-cryptotrading-v2/deploy/crypto-trading --wait --debug
    ```

- Upon the completion of demo installation, the crypto-trading REST API server swagger URL should be accessible:

    ```bash
    https://demo1-us-east-1.demo.aws.macrometa.io/c8demo/crypto/
    ```

## Delete crypto-trading helm release

- To delete the `crypto-trading` demo release, use `helm delete` command, and supply the chart release name; use the `--purge` option to remove the release from the store so its name can be used again.

```bash
$ helm delete --purge crypto-trading
```

## Upgrade crypto-trading

- To upgrade the release, use `helm upgrade` command; be sure to supply the upgraded chart and upgraded `values.yaml` file

```bash
$ helm upgrade -f myvalues.yaml crypto-trading Global_Crypto_Trading/deploy/crypto-trading
```
