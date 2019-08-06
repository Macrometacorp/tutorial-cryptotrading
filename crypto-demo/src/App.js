import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import Plot from 'react-plotly.js';
import _ from 'lodash';
import Config from './Config';
import {
  makeChartData,
  getWsUrls,
  getDocumentWsUrls,
  getChartData,
  getCurrentValue,
  makeCollectionArray,
  makeCollectionData,
  CONSTANTS,
  makeRegionData,
  region
} from './utils';

import{
  custom_consumer
}from './c8utils'



import $ from 'jquery';

import Table from '@material-ui/core/Table';

import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Snackbar from '@material-ui/core/Snackbar';
import TextField from '@material-ui/core/TextField';
import { withStyles } from '@material-ui/core/styles';


import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';

import Radio from '@material-ui/core/Radio';
import RadioGroup from '@material-ui/core/RadioGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';



const { CHART1, CHART2, CHART3, BLUE, GREEN, BACKGROUND } = CONSTANTS;

class App extends Component {

  constructor(props) {
    super(props);
    this.state = {
      width: 0,
      height: 0,
      [CHART1]: {
        name: 'USD',
        close: [],
        ma: [],
        timestamp: [],
        wsUrls: '',
        consumer: undefined,
        producer: undefined
      },
      [CHART2]: {
        name: 'EUR',
        close: [],
        ma: [],
        timestamp: [],
        wsUrls: '',
        consumer: undefined,
        producer: undefined
      },
      [CHART3]: {
        name: 'JPY',
        close: [],
        ma: [],
        timestamp: [],
        wsUrls: '',
        consumer: undefined,
        producer: undefined
      },
      collectionData: [],
      filteredData: [],
      showSnackbar: false,
      snackbarText: '',
      showFiltered: false,
      documentWs: {
        wsUrls: '',
        producer: undefined,
        consumer: undefined
      },
      selectedRegion: {
        label: null,
        value: null
      },
      regionModal: false,
      availableRegions: makeRegionData(Config),
      selectedRegionUrl: '',
      loginModal: true,
      tenant: '',
      fabric: '_system',
      username: '',
      password: '',
      regionname: ''
    };
    this.updateWindowDimensions = this.updateWindowDimensions.bind(this);
    this.establishConnection = this.establishConnection.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.openSnackBar = this.openSnackBar.bind(this);
    this.handleSearchTextChange = this.handleSearchTextChange.bind(this);
    this.jwtToken = undefined;
  }


  componentDidMount() {
    this.updateWindowDimensions();
    window.addEventListener('resize', this.updateWindowDimensions)
    
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.updateWindowDimensions);

    [CHART1, CHART2, CHART3].forEach(chartNum => {
      this.state[chartNum].consumer.close();
      this.state[chartNum].producer.close();
    });

    this.state.documentWs.producer.close();
    this.state.documentWs.consumer.close();
  }

  init() {
    const charts = [CHART1, CHART2, CHART3].map(this.establishConnection);
    this.setState({
      [CHART1]: charts[CHART1],
      [CHART2]: charts[CHART2],
      [CHART3]: charts[CHART3]
    });
    this.getDocumentData();
    this.establishDocumentConnection();
  }

  login() {
    const data = {
      tenant: this.state.tenant,
      username: this.state.username,
      password: this.state.password

    }
   
    const url = `https://${this.state.selectedRegionUrl}/_tenant/${this.state.tenant}/_fabric/${this.state.fabric}/_open/auth`;
    $.ajax({
      url,
      method: 'POST',
      data: JSON.stringify(data),
      dataType: 'json',
      success: (data) => {
        this.jwtToken = data.jwt;
        this.ajaxSetup();
        this.init();
      },
      error: () => this.openSnackBar('Auth failed.')
    })
  }

  ajaxSetup() {
    $.ajaxSetup({
      headers: {
        Authorization: `bearer ${this.jwtToken}`
      }
    });
  }

  getDocumentData() {
    $.ajax({
      url: `https://${this.state.selectedRegionUrl}/_tenant/${this.state.tenant}/_fabric/${this.state.fabric}/cursor`,
      type: 'POST',
      contentType: 'text/plain',
      processData: false,
      success: (data) => {
        const { result } = data;
        this.setState({ collectionData: makeCollectionArray(result) });
      },
      error: (err) => {
        this.openSnackBar('Failed to get document data');
        console.log("Failed to get document data ", err);
      },
      cache: false,
      data: JSON.stringify({
        "query": "FOR trade IN trades SORT trade.timestamp DESC LIMIT 20 RETURN trade"
      })
    });
  }

  establishDocumentConnection() {
    const newDocumentWs = _.cloneDeep(this.state.documentWs);
    const { producer, consumer } = newDocumentWs.wsUrls;

    //consumer
    newDocumentWs.consumer = new WebSocket(consumer);

    newDocumentWs.consumer.onopen = () => {
      console.log("WebSocket is open for trades");
    }

    newDocumentWs.consumer.onerror = () => {
      this.openSnackBar('Failed to establish WS connection for trades');
      console.log('Failed to establish WS connection for trades');
    }

    newDocumentWs.consumer.onclose = (event) => {
      console.log('Closing WS connection for trades');
    }

    newDocumentWs.consumer.onmessage = (message) => {
      const receiveMsg = message.data && JSON.parse(message.data);
      const ackMsg = { "messageId": receiveMsg.messageId };
      newDocumentWs.consumer.send(JSON.stringify(ackMsg));
      const { payload } = receiveMsg;
      if (payload !== 'noop') {
        const decodedMsg = atob(payload);
        const response = decodedMsg && JSON.parse(decodedMsg);
        const collectionData = [...this.state.collectionData];
        collectionData.pop();
        const newElem = makeCollectionData(response);
        newElem && this.setState({ collectionData: [newElem, ...collectionData] });
      }
    };

    //producer
    newDocumentWs.producer = new WebSocket(producer);
    newDocumentWs.producer.onclose = (event) => console.log("Document producer closed", event);
    newDocumentWs.producer.onopen = () => {
      //publish meaningless data every 30000ms to keep the connection alive
      setInterval(() => {
        newDocumentWs.producer.send(JSON.stringify({ 'payload': 'noop' }))
      }, 30000);
    }
  }

  establishConnection(chartNum) {
    const newChart = _.cloneDeep(this.state[chartNum]);

    //consumer
    newChart.consumer = new WebSocket(newChart.wsUrls.consumer);

    newChart.consumer.onopen = () => {
      console.log("WebSocket is open for ", newChart.name);
    }

    newChart.consumer.onerror = () => {
      this.openSnackBar('Failed to establish WS connection');
      console.log('Failed to establish WS connection');
    }

    newChart.consumer.onclose = () => {
      console.log('Closing WS connection for ', this.state[chartNum].name);
    }

    newChart.consumer.onmessage = (message) => {
      const receiveMsg = message.data && JSON.parse(message.data);
      const ackMsg = { "messageId": receiveMsg.messageId };
      newChart.consumer.send(JSON.stringify(ackMsg));
      const { payload } = receiveMsg;
      if (payload !== 'noop') {
        const decodedMsg = atob(payload);
        const response = decodedMsg && JSON.parse(decodedMsg);
        console.log("CHART CONSUMER MSG:" , response);
        this.setState({ [chartNum]: makeChartData(response, this.state[chartNum]) });
      }
    };

    //producer
    newChart.producer = new WebSocket(newChart.wsUrls.producer);
    newChart.producer.onclose = (event) => console.error("Producer WS connection closed", event);
    newChart.producer.onopen = () => {
      //publish meaningless data every 30000ms to keep the connection alive
      setInterval(() => {
        newChart.producer.send(JSON.stringify({ 'payload': 'noop' }))
      }, 30000);
    }

    return newChart;
  }

  updateWindowDimensions() {
    this.setState({ width: window.innerWidth, height: window.innerHeight });
  }

  handleClose() {
    this.setState({ showSnackbar: false, snackbarText: '' });
  }

  openSnackBar(message) {
    this.setState({ showSnackbar: true, snackbarText: message }, () => {
      setTimeout(this.handleClose, 2000);
    });
  }

  handleSearchTextChange(event) {
    const text = event.target.value;
    this.filterResults(text);
  }

  filterResults(text) {
    this.setState({ showFiltered: !!text.trim() }, () => {
      const filteredData = this.state.collectionData.filter((collection) => {
        const upperCaseText = text.toUpperCase();
        return (
          collection.symbol.toUpperCase().includes(upperCaseText) ||
          collection.trade_price.toUpperCase().includes(upperCaseText) ||
          collection.trade_location.toUpperCase().includes(upperCaseText) ||
          collection.quote_region.toUpperCase().includes(upperCaseText) ||
          collection.timestamp.toUpperCase().includes(upperCaseText) ||
          collection.trade_strategy.toUpperCase().includes(upperCaseText) ||
          collection.trade_type.toUpperCase().includes(upperCaseText)
        )
      });
      this.setState({ filteredData: filteredData });
    });
  }

  renderCharts(chartNum) {
    const screenWidth = this.state.width;
    const { timestamp, ma, close } = this.state[chartNum];
    let chartData;
    const layout = {
      showlegend: false,
      title: undefined,
      paper_bgcolor: BACKGROUND,
      plot_bgcolor: BACKGROUND,
      width: screenWidth / 3,
      height: 350,
      xaxis: {
        tickfont: {
          color: 'white'
        },
        showgrid: true,
        gridcolor: '#6b6a6a',
        fixedrange: false,
        zerolinecolor: '#6b6a6a'
      },
      yaxis: {
        tickfont: {
          color: 'white'
        },
        showgrid: true,
        gridcolor: '#6b6a6a',
        fixedrange: false,
        zerolinecolor: '#6b6a6a'
      }
    };
    switch (chartNum) {
      case CHART1:
        chartData = getChartData(timestamp, ma, close);
        layout.title = '<b style="color:white">BTC-USD @ Coinbase Pro</b>';
        break;
      case CHART2:
        chartData = getChartData(timestamp, ma, close);
        layout.title = '<b style="color:white">BTC-EUR @ BitStamp</b>';
        break;
      default:
        chartData = getChartData(timestamp, ma, close);
        layout.title = '<b style="color:white">BTC-JPY @ Bitflyer</b>';
        break;
    }

    return (
      <Plot
        key={chartNum.toString()}
        data={chartData}
        layout={layout}
        useResizeHandler={true}
        style={{ height: '350px' }}
      />
    );
  }

  handleModalClose() {
    const { selectedRegionUrl } = this.state;
    const newState = _.cloneDeep(this.state);
    newState[CHART1].wsUrls = getWsUrls("USD", selectedRegionUrl, this.state.tenant, this.state.fabric);
    newState[CHART2].wsUrls = getWsUrls("EUR", selectedRegionUrl, this.state.tenant, this.state.fabric);
    newState[CHART3].wsUrls = getWsUrls("JPY", selectedRegionUrl, this.state.tenant, this.state.fabric);
    newState.documentWs.wsUrls = getDocumentWsUrls(selectedRegionUrl, this.state.tenant, this.state.fabric);
    newState.regionModal = false;
    this.setState(newState, () => {
      this.state.regionname = region(selectedRegionUrl, Config  )

      // ABHISHEK
      // custom_consumer(selectedRegionUrl, this.state.tenant, this.state.username, this.state.password, this.state.fabric);
      this.login();


    });
  }

  renderRegionModal() {
    const { regionModal, availableRegions, selectedRegionUrl } = this.state;
    return (
      <Dialog
        fullWidth
        open={regionModal}
      >
        <DialogTitle id="form-dialog-title">Select Region:</DialogTitle>
        <DialogContent>
          <RadioGroup
            onChange={event => this.setState({ selectedRegionUrl: event.target.value })}
            value={selectedRegionUrl}
          >
            {
              availableRegions.map(region => <FormControlLabel key={region.label} value={region.value} control={<Radio />} label={region.label} />)
            }
          </RadioGroup>
        </DialogContent>
        <DialogActions>
          <Button
            disabled={!selectedRegionUrl}
            onClick={() => this.handleModalClose()}
            size="small" variant="text" color="primary">
            <span className="actions">CONFIRM</span>
          </Button>
        </DialogActions>
      </Dialog>
    )
  }

  

  renderLoginModal() {
   
    let { loginModal } = this.state;
    const { classes } = this.props;

    return (
      <Dialog
        fullWidth
        open={loginModal}
      >
        <DialogTitle id="form-dialog-title"> Enter Tenant and Credentials:</DialogTitle>
        <DialogContent>
        
          <TextField
            InputProps={{
              className: classes.input
            }}            
            label = "Tenant"
            defaultValue="Enter Tenant Name"

            onChange={(event) => {
              const newtenant = event.target.value;
              this.setState({ tenant: newtenant });
            }}
            margin="normal"
          /><br></br>

          <TextField
            label="User"
            InputProps={{
              className: classes.input
            }}            
            
            defaultValue="Enter User Name"
            onChange={(event) => {
              const user = event.target.value;
              this.setState({ username: user });

            }}
            margin="normal"
          /><br></br>

          <TextField type='password'
            id = "pass"
            label="Password "
            InputProps={{
              className: classes.input
            }}            
            
            defaultValue="Password"
            onChange={(event) => {
              const pass = event.target.value;
              this.setState({ password: pass });

            }}
            margin="normal"
          />
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() => this.setState({
              loginModal: false,
              regionModal: true
            })}
            size="small" variant="text" color="primary">
            <span className="actions">CONFIRM</span>
          </Button>
        </DialogActions>
      </Dialog>
    )
  }


  render() {
    const { showFiltered, collectionData, filteredData, showSnackbar, snackbarText } = this.state;
    const { classes } = this.props;
    const collection = showFiltered ? filteredData : collectionData;
    return (
      <div className="App">
        <div className="Region" style={{ backgroundColor: 'black', marginTop: '10px' , marginLeft: '240px'}} >
        <span className="currentValue">Selected Region :  {this.state.regionname}   </span><br></br>
        <span className="currentValue">Url : {this.state.selectedRegionUrl}</span>

        </div>

        <div className="row" style={{ backgroundColor: 'black', marginTop: '62px' }}>
          {
            [CHART1, CHART2, CHART3].map(
              (chartNum) => {
                return this.renderCharts(chartNum);
              }
            )
          }
        </div>
        <div className="row" style={{ justifyContent: ' space-around', padding: '30px 0 30px 0 ', backgroundColor: 'black' }}>
          {
            [CHART1, CHART2, CHART3].map(
              (chartNum) => {
                const { close } = this.state[chartNum];
                const currentValue = close[close.length - 1] || 0;
                return getCurrentValue(chartNum, currentValue);
              }
            )
          }
        </div>
        <div className="row" style={{ flex: 1 }}>
          <div className="leftPane">
            <img alt="Macrometa" style={{ height: '64px', marginTop: '15px' }} src={logo} />
            <div className="textField" >
              <TextField
                label="Filter"
                placeholder="Enter here"
                onChange={this.handleSearchTextChange}
                classes={{
                  root: classes.root
                }}
                margin="normal"
                variant="outlined"
              />

            </div>
          </div>
          <div className="tableContainer">
            <Table>
              <TableHead
                className={classes.tableHead}>
                <TableRow>
                  <TableCell component="th" className={classes.headCell}>Symbol</TableCell>
                  <TableCell component="th" className={classes.headCell}>Price</TableCell>
                  <TableCell component="th" className={classes.headCell}>Location</TableCell>
                  <TableCell component="th" className={classes.headCell}>Region</TableCell>
                  <TableCell component="th" className={classes.headCell}>Timestamp</TableCell>
                  <TableCell component="th" className={classes.headCell}>Strategy</TableCell>
                  <TableCell component="th" className={classes.headCell}>Type</TableCell>
                </TableRow>
              </TableHead>
              <TableBody
                className={classes.tableBody}>
                {
                  collection.map((n) => {
                    const shouldBuy = n.trade_type.includes("BUY");
                    const cellColor = shouldBuy ? BLUE : GREEN;
                    return (
                      <TableRow key={Math.random()}>
                        <TableCell className={classes.tableCell} style={{ color: cellColor }}>{n.symbol}</TableCell>
                        <TableCell className={classes.tableCell} style={{ color: cellColor }}>{n.trade_price}</TableCell>
                        <TableCell className={classes.tableCell} style={{ color: cellColor }}>{n.trade_location}</TableCell>
                        <TableCell className={classes.tableCell} style={{ color: cellColor }}>{n.quote_region}</TableCell>
                        <TableCell className={classes.tableCell} style={{ color: cellColor }}>{n.timestamp}</TableCell>
                        <TableCell className={classes.tableCell} style={{ color: cellColor }}>{n.trade_strategy}</TableCell>
                        <TableCell className={classes.tableCell} style={{ color: cellColor }}>{n.trade_type}</TableCell>
                      </TableRow>
                    );
                  })
                }
              </TableBody>
            </Table>
          </div>
        </div>
        <Snackbar
          open={showSnackbar}
          onClose={this.handleClose}
          message={<span id="message-id">{snackbarText}</span>}
        />
        
        {this.renderLoginModal()}
        
        {this.renderRegionModal()}
      
      </div>
    );
  }
}


const styles = theme => ({
  root: {
    backgroundColor: '#404040',
    marginLeft: theme.spacing.unit,
    marginRight: theme.spacing.unit,
    width: '100%'
  },
  tableHead: {
    backgroundColor: BACKGROUND,
    color: 'white'
  },
  tableBody: {
    backgroundColor: BACKGROUND
  },
  headCell: {
    color: 'white',
    fontSize: '0.75em',
    textAlign: 'center',
    borderBottom: 'none'
  },
  tableCell: {
    fontWeight: 700,
    textAlign: 'center',
    borderBottom: 'none',
    fontSize: '16px'
  },
  input: {
    backgroundColor:'#404040'
    },
    
});

export default withStyles(styles)(App);
