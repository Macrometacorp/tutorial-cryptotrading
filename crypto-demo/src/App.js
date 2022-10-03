import React, { Component } from 'react';
import './App.css';
import Plot from 'react-plotly.js';
import _ from 'lodash';
import Fabric from 'jsc8';

import TradesTable from "./components/TradesTable"
import Logomark from "./logomark.svg"
import {
  convertToDecimal,
  makeChartData,
  getChartData,
  makeCollectionArray,
  makeCollectionData,
  CONSTANTS,
  getQuoteStreamTopicName,
  getCollectionName,
  getRandomInt
} from './utils';

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

const { CHART1, CHART2, CHART3, BACKGROUND } = CONSTANTS;

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
      federationUrl: "gdn.paas.macrometa.io",
      fabric: 'xxxx',
      email: "xxxx@macrometa.io",
      password: 'xxxx',
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
      // const tempAvailableRegions = availableRegions.filter(
      //   (availableRegion) => availableRegion.name !== "gdn1-sfo2"
      // );

      this.setState({
        availableRegions,
        regionModal: true,
      });
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
    const { timestamp, ma, close } = this.state[chartNum];

    const price = close[close.length - 1] || 0;
    const priceInDecimal = convertToDecimal(price);
    
    let heading, subheading, priceLabel;
    switch (chartNum) {
      case CHART1:
        heading = 'BTC-USD'
        subheading = 'Coinbase Pro'
        priceLabel = `$${priceInDecimal}`;
        break;
      case CHART2:
        heading = 'BTC-EUR'
        subheading = 'BitStamp'
        priceLabel = `€${priceInDecimal}`;
        break;
      default:
        heading = 'BTC-JPY'
        subheading = 'Bitflyer'
        priceLabel = `¥${priceInDecimal}`
        break;
    }

    const chartLayout = {
      margin: {
        t: 10,
      },
      showlegend: false,
      title: undefined,
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      xaxis: {
        tickfont: {
          color: 'white'
        },
        showgrid: true,
        gridcolor: "#535968", // mm-gray-600
        fixedrange: false,
        zerolinecolor: "#535968", // mm-gray-600
      },
      yaxis: {
        tickfont: {
          color: 'white'
        },
        showgrid: true,
        gridcolor: "#535968",
        fixedrange: false,
        zerolinecolor: "#535968" // mm-gray-600
      }
    };

    const chartData = getChartData(timestamp, ma, close);

    return (
      <div key={chartNum} className="h-full flex flex-col text-white pb-[20px] 8xl:pb-[30px]">
        {/* Title */}
        <div className="grow bg-mm-gray-800 border border-mm-gray-600 font-extrabold leading-[32px] 8xl:leading-[48px] pl-[16px] 8xl:pl-[24px] pt-[12px] 8xl:pt-[18px] rounded-t-lg text-[21px] 8xl:text-[32px]">
          {heading}
          <span className="font-medium leading-[32px] 8xl:leading-[48px] text-[18px] 8xl:text-[27px]">
            &nbsp;{subheading}
          </span>

          <div className="3xl:mt-[12px] 3xl:w-[500px] 3xl:h-[260px] 4xl:mt-[16px] 4xl:w-[700px] 4xl:h-[460px] 8xl:mt-[24px] 8xl:w-[1000px] 8xl:h-[700px]">
            {/* Chart */}
            <Plot
              key={chartNum.toString()}
              data={chartData}
              layout={chartLayout}
              useResizeHandler={true}
              style={{ width: "100%", height: "100%" }}
            />
          </div>

        </div>

        {/* Price */}
        <div className="bg-mm-gray-800/60 border border-mm-gray-600 font-semibold font-source-code-pro py-[32px] 8xl:py-[48px] rounded-b-lg text-[48px] 8xl:text-[72px] text-center">
          {priceLabel}
        </div>
      </div>
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
      <div>
        <div className="bg-mm-gray-900 grid xl:grid-cols-12">
          <div className="xl:col-start-2 xl:col-end-12">
            <div className="lg:h-screen">
              {/* Header */}
              <div className="bg-transparent flex flex-row justify-between items-center h-[52px] lg:h-[64px] 8xl:h-[96px] text-white">
                <img className="w-[150px] 8xl:w-[225px] h-[40px] 8xl:h-[60px]" src={Logomark} alt="Macrometa Logo"/>
                <button className="border border-mm-gray-600 font-medium inline-flex items-center justify-center leading-[24px] 8xl:leading-[36px] my-[12px] 8xl:my-[18px] rounded-lg text-[16px] 8xl:text-[24px] w-[150px] 8xl:w-[225px] h-[40px] 8xl:h-[60px] text-center">
                  {/* map-pin svg icon  */}
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-[20px] 8xl:w-[30px] h-[20px] 8xl:h-[30px] text-mm-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  <span>&nbsp;{this.state.selectedRegionName || "Region"}</span>
                </button>
              </div>

              <div className="grid lg:grid-rows-2 lg:h-[calc(100vh-64px)] 8xl:h-[calc(100vh-96px)] ">
                {/* Charts */}
                <div className="grid lg:grid-cols-3 gap-4">
                  {[CHART1, CHART2, CHART3].map((i) => this.renderCharts(i))}
                </div>

                {/* Trades Table */}
                <TradesTable trades={collection} onChangeFilter={this.handleSearchTextChange}/>
              </div>
            </div>
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
