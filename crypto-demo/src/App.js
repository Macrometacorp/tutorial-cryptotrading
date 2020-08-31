import React, { Component } from 'react';
import logo from './logo.svg';
import './App.css';
import Plot from 'react-plotly.js';
import _ from 'lodash';
import Fabric from 'jsc8';

import {
  makeChartData,
  getChartData,
  getCurrentValue,
  makeCollectionArray,
  makeCollectionData,
  CONSTANTS,
  getQuoteStreamTopicName,
  getCollectionName,
  getRandomInt
} from './utils';

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
        stream: undefined
      },
      [CHART2]: {
        name: 'EUR',
        close: [],
        ma: [],
        timestamp: [],
        stream: undefined
      },
      [CHART3]: {
        name: 'JPY',
        close: [],
        ma: [],
        timestamp: [],
        stream: undefined
      },
      collectionData: [],
      filteredData: [],
      showSnackbar: false,
      snackbarText: '',
      showFiltered: false,
      regionModal: false,
      availableRegions: null,
      selectedRegionUrl: null,
      loginModal: true,
      federationUrl: "gdn1.macrometa.io",
      fabric: '_system',
      email: "demo@macrometa.io",
      password: 'demo',
      selectedRegionName: null
    };
    this.updateWindowDimensions = this.updateWindowDimensions.bind(this);
    this.establishConnection = this.establishConnection.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.openSnackBar = this.openSnackBar.bind(this);
    this.handleSearchTextChange = this.handleSearchTextChange.bind(this);
    this.jwtToken = undefined;
    this.fabric = undefined;
    this.collection = undefined;
  }


  componentDidMount() {
    this.updateWindowDimensions();
    window.addEventListener('resize', this.updateWindowDimensions)

  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.updateWindowDimensions);

    [CHART1, CHART2, CHART3].forEach(chartNum => {
      this.state[chartNum].stream.closeConnections();
    });

    this.collection.closeOnChangeConnection();

  }

  async initData() {
    let charts = [CHART1, CHART2, CHART3];
    for (let i = 0; i < charts.length; i++) {
      charts[i] = await this.establishConnection(i);
    }

    this.setState({
      [CHART1]: charts[CHART1],
      [CHART2]: charts[CHART2],
      [CHART3]: charts[CHART3]
    });
    this.getDocumentData();
    this.establishDocumentConnection();
  }

  async selectedRegionLogin() {
    this.fabric.close();
    const { selectedRegionUrl, email, password } = this.state;
    const fabricName = this.state.fabric;
    this.fabric = new Fabric(`https://${selectedRegionUrl}`);
    try {
      await this.fabric.login(email, password);
      this.fabric.useFabric(fabricName);
      // start streams and get collection data
      await this.initData();
    } catch (e) {
      this.openSnackBar('Failed to login with selected region.');
      console.log(e);
    }
  }

  async login() {
    const { federationUrl, email, password } = this.state;
    const fabricName = this.state.fabric;
    this.fabric = new Fabric(`https://${federationUrl}`);
    try {
      const res = await this.fabric.login(email, password);
      this.fabric.useFabric(fabricName);
      const deployedRegions = await this.fabric.get();
      const regions = deployedRegions.options.dcList.split(",");
      const tenantHandler = this.fabric.tenant("", res.tenant);
      const locations = await tenantHandler.getTenantEdgeLocations();
      const { dcInfo } = locations[0];
      const availableRegions = dcInfo.filter((dcObject) => {
        return regions.indexOf(dcObject.name > -1);
      })
      this.setState({ availableRegions: availableRegions, regionModal: true });
    } catch (e) {
      this.openSnackBar('Auth failed.');
      console.log(e);
    }
  }

  async getDocumentData() {
    try {
      const cursor = await this.fabric.query("FOR trade IN trades SORT trade.timestamp DESC LIMIT 20 RETURN trade");
      const result = await cursor.all();
      this.setState({ collectionData: makeCollectionArray(result) });
    } catch (e) {
      e.status !== 404 && this.openSnackBar('Could not get document data');
    }

  }

  async establishDocumentConnection() {

    const collectionName = getCollectionName();
    this.collection = this.fabric.collection(collectionName);
    const consumer = await this.collection.onChange(
      this.state.selectedRegionUrl,
      `${collectionName}-sub${getRandomInt()}`
    );

    consumer.on("error", () => {
      this.openSnackBar('Failed to establish WS connection for trades');
      console.log('Failed to establish WS connection for trades');
    });

    consumer.on("message", (msg) => {
      const receiveMsg = JSON.parse(msg);
        const { payload } = receiveMsg;
        if (receiveMsg && payload) {
          const decodedMsg = atob(payload);
          const response = decodedMsg && JSON.parse(decodedMsg);
          let collectionData = [...this.state.collectionData];
          const newElem = makeCollectionData(response);
          if (newElem) {
            collectionData = [newElem, ...collectionData];
          }
          if (collectionData.length > 20) {
            //remove more than 20 data points
            collectionData = collectionData.slice(0, 20);
          }
          this.setState({ collectionData });
        }
    });

    consumer.on("close", () => {
      console.log('Closing WS connection for trades');
    });

    consumer.on("open", () => {
      console.log("WebSocket is open for trades");
    });

    // this.collection.onChange({
    //   onopen: () => console.log("WebSocket is open for trades"),
    //   onclose: () => console.log('Closing WS connection for trades'),
    //   onerror: () => {
    //     this.openSnackBar('Failed to establish WS connection for trades');
    //     console.log('Failed to establish WS connection for trades');
    //   },
    //   onmessage: message => {
    //     const receiveMsg = JSON.parse(message);
    //     const { payload } = receiveMsg;
    //     if (receiveMsg && payload) {
    //       const decodedMsg = atob(payload);
    //       const response = decodedMsg && JSON.parse(decodedMsg);
    //       let collectionData = [...this.state.collectionData];
    //       const newElem = makeCollectionData(response);
    //       if (newElem) {
    //         collectionData = [newElem, ...collectionData];
    //       }
    //       if (collectionData.length > 20) {
    //         //remove more than 20 data points
    //         collectionData = collectionData.slice(0, 20);
    //       }
    //       this.setState({ collectionData });
    //     }


    //   }
    // }, this.state.selectedRegionUrl, `${collectionName}-sub${getRandomInt()}`);
  }

  async establishConnection(chartNum) {
    const newChart = _.cloneDeep(this.state[chartNum]);
    const { name } = this.state[chartNum];
    const streamTopic = getQuoteStreamTopicName(name);
    const stream = this.fabric.stream(streamTopic, false);
    const consumerOTP = await stream.getOtp();
    const consumer = stream.consumer(`${name}-sub${getRandomInt()}`,
      this.state.selectedRegionUrl, {
        otp: consumerOTP,
      });

    consumer.on("error", () => {
      this.openSnackBar('Failed to establish WS connection');
      console.log(`Failed to establish WS connection for ${streamTopic}`);
    });

    consumer.on("message", (msg) => {
      const receiveMsg = JSON.parse(msg);
      const { payload } = receiveMsg;
      if (receiveMsg && payload) {
        const decodedMsg = atob(payload);
        const response = decodedMsg && JSON.parse(decodedMsg);
        console.log("CHART CONSUMER MSG:", response);
        this.setState({ [chartNum]: makeChartData(response, this.state[chartNum]) });
      }
    });

    consumer.on("close", () => {
      console.log(`Closing WS connection for ${streamTopic}`)
    });

    consumer.on("open", () => {
      console.log(`Connection open for ${streamTopic}`)
    });

    /*
    stream.consumer(`${name}-sub${getRandomInt()}`,this.state.selectedRegionUrl, {
      onerror: () => {
        this.openSnackBar('Failed to establish WS connection');
        console.log(`Failed to establish WS connection for ${streamTopic}`);
      },
      onclose: () => console.log(`Closing WS connection for ${streamTopic}`),
      onopen: () => console.log(`Connection open for ${streamTopic}`),
      onmessage: (message) => {
        const receiveMsg = JSON.parse(message);
        const { payload } = receiveMsg;
        if (receiveMsg && payload) {
          const decodedMsg = atob(payload);
          const response = decodedMsg && JSON.parse(decodedMsg);
          console.log("CHART CONSUMER MSG:", response);
          this.setState({ [chartNum]: makeChartData(response, this.state[chartNum]) });
        }
      }
    })*/;

    newChart.stream = stream;

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
            onChange={event => {
              const { target: { value, labels } } = event;
              this.setState({ selectedRegionUrl: value, selectedRegionName: labels[0].outerText });
            }}
            value={selectedRegionUrl}
          >
            {
              availableRegions.map(region => {
                const { locationInfo: { city, countrycode }, tags: { url } } = region;
                const label = `${city}, ${countrycode}`;
                return <FormControlLabel key={label} value={url} control={<Radio />} label={label} />
              })
            }
          </RadioGroup>
        </DialogContent>
        <DialogActions>
          <Button
            disabled={!selectedRegionUrl}
            onClick={() => this.setState({ regionModal: false }, () => { this.selectedRegionLogin() })}
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
        <DialogTitle id="form-dialog-title"> Please login with defaults or use your own account:</DialogTitle>
        <DialogContent style={{ display: 'flex', flexDirection: 'column', maxWidth: '300px' }}>

          <TextField
            InputProps={{
              className: classes.input
            }}
            label="Federation URL"
            defaultValue={this.state.federationUrl}

            onChange={(event) => {
              const federationUrl = event.target.value;
              this.setState({ federationUrl });
            }}
            margin="normal"
          />

          <TextField
            InputProps={{
              className: classes.input
            }}
            label="Email"
            defaultValue={this.state.email}

            onChange={(event) => {
              const email = event.target.value;
              this.setState({ email });
            }}
            margin="normal"
          />

          <TextField
            InputProps={{
              className: classes.input
            }}
            label="Fabric"
            defaultValue={this.state.fabric}

            onChange={(event) => {
              const fabric = event.target.value;
              this.setState({ fabric });
            }}
            margin="normal"
          />

          <TextField type='password'
            id="pass"
            label="Password"
            defaultValue={this.state.password}
            InputProps={{
              className: classes.input
            }}
            onChange={(event) => {
              const password = event.target.value;
              this.setState({ password });

            }}
            margin="normal"
          />
        </DialogContent>

        <DialogActions>
          <Button
            onClick={() => this.setState({
              loginModal: false,
            }, () => { this.login() })}
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
        <div className="Region" style={{ backgroundColor: 'black', marginTop: '10px', display: 'flex', justifyContent: "center" }} >
          <span style={{ color: 'grey', fontSize: '18px' }}>Selected Region :  {this.state.selectedRegionName}   </span>
        </div>

        <div className="row" style={{ backgroundColor: 'black', marginTop: '10px' }}>
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

        {this.state.regionModal && this.renderRegionModal()}

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
    backgroundColor: '#404040',
    paddingLeft: '5px'
  },

});

export default withStyles(styles)(App);
