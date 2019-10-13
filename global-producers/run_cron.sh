#!/bin/bash

echo "Cron job: */5 * * * * /home/ubuntu/tutorial-cryptotrading/global-producers/run_cron.sh"
echo "Starting crypto cron job"
echo "This will start the node server"
echo "And keep closing and opening it after every 3 hours"

node_id=$(pidof node)

echo "pid of node is:" ${node_id}

startNode () {
    echo "Starting node service"
    node /home/ubuntu/tutorial-cryptotrading/global-producers/index.js >> /home/ubuntu/tutorial-cryptotrading/global-producers/publisher.log 2>&1 &
}

# Check if there is any node process
if [[ -z "${node_id}" ]]
then
    # no node process exists -> start the node service
    startNode
else
    # close the running node process -> start the node service
    echo "Killing node service"
    kill ${node_id}
    startNode
fi