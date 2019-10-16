#!/bin/bash

path="/root/tutorial-cryptotrading/global-producers"

# start the node application initially before the cron job
bash ${path}/cron_helper.sh

crontab -l > mycron
echo "0 */6 * * * bash ${path}/cron_helper.sh" >> mycron
crontab mycron
rm mycron