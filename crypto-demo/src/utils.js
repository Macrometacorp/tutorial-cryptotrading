import React from 'react';
import _ from 'lodash';
import getSymbolFromCurrency from 'currency-symbol-map';
import './App.css';


export const CONSTANTS = {
    CHART1: 0,
    CHART2: 1,
    CHART3: 2,
    BLUE: '#3B9DE6',
    GREEN: '#A7CC55',
    BACKGROUND: '#262626'
};

const CHART_SIGNS = {
    CHART1_SIGN:
        getSymbolFromCurrency('USD'),
    CHART2_SIGN:
        getSymbolFromCurrency('EUR'),
    CHART3_SIGN:
        getSymbolFromCurrency('JPY')
}

export function getRandomInt() {

    return Math.floor(Math.random() * Math.floor(99999));

}

export const getQuoteStreamTopicName = name => `CryptoTraderQuotesAvg${name}New`;
export const getCollectionName = () => 'trades';

const convertTimestampToDate = (timestamp) => {
    let unixTime = (typeof timestamp === 'string') ? parseFloat(timestamp) : timestamp;
    const date = new Date(unixTime * 1000).toUTCString();
    const index = date.indexOf("GMT");
    const finalDate = date.substring(0, index).trim();
    return finalDate;
};

export const convertTimestampToProperTime = (timestamp) => {
    const date = convertTimestampToDate(timestamp);
    const index = date.lastIndexOf(' ');
    return date.substr(index).trim();
}

export const makeChartData = (response, oldData) => {
    const { close, ma, timestamp } = response;
    const newChart = _.cloneDeep(oldData);
    newChart.close.push(close);
    newChart.ma.push(ma);
    const time = convertTimestampToDate(timestamp);
    const index = time.lastIndexOf(' ');
    newChart.timestamp.push(time.substr(index).trim());
    return newChart;
}


export const getChartData = (X, Y1, Y2) => {
    //make traces
    const trace1 = {
        x: X,
        y: Y1,
        type: 'line',
        marker: { color: CONSTANTS.BLUE },
        name: 'ma'
    }

    const trace2 = {
        x: X,
        y: Y2,
        type: 'line',
        marker: { color: 'orange' },
        name: 'price'
    }

    return [trace1, trace2];
}

const convertToDecimal = (val) => {
    const num = typeof val === 'string' ? val : val.toString();
    const decimalRepresentation = num.includes('.') ? num : `${num}.00`;
    return decimalRepresentation;
}

export const getCurrentValue = (chartNum, currVal) => {

    const { CHART1, CHART2 } = CONSTANTS;

    let currentValue;
    const decimalValue = convertToDecimal(currVal);
    switch (chartNum) {
        case CHART1:
            currentValue = `${CHART_SIGNS.CHART1_SIGN}${decimalValue}`;
            break;
        case CHART2:
            currentValue = `${CHART_SIGNS.CHART2_SIGN}${decimalValue}`;
            break;
        default:
            currentValue = `${CHART_SIGNS.CHART3_SIGN}${decimalValue}`
            break;
    }

    return (
        <span key={chartNum} style={{ display: 'flex', justifyContent: 'space-around' }}>
            <span className="currentValue">Current Value</span>
            <span className="currentValueText">{currentValue}</span>
        </span>
    )
}

export const makeCollectionData = (data) => {
    let newData = { ...data };
    let trade_location;
    const { symbol } = newData;
    if (symbol) {
        if (symbol.includes("JPY")) {
            trade_location = "Tokyo";
        } else if (symbol.includes("USD")) {
            trade_location = "NYC";
        } else {
            trade_location = "Frankfurt";
        }
        newData.trade_location = trade_location;
        newData.trade_price = convertToDecimal(newData.trade_price);
        newData.timestamp = convertTimestampToProperTime(newData.timestamp);
    }
    else {
        newData = undefined;
    }
    return newData;
}

export const makeCollectionArray = (dataArr) => {
    const newDataArr = dataArr.map(makeCollectionData);
    return newDataArr;
}