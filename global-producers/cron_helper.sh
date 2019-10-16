#!/bin/bash

echo "Cron job for 6 hours should be: 0 */6 * * *"
echo "Starting crypto cron job"
echo "This will start the node server"
echo "And keep closing and opening it after every 6 hours"

node_id=$(pidof node)
path="/root/tutorial-cryptotrading/global-producers"

echo "pid of node is:" ${node_id}

echo "Current path is:" ${path}

startNode () {
    echo "Starting node service"
    node ${path}/index.js >> ${path}/publisher.log 2>&1 &
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