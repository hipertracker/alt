/*eslint-disable */
import React, { Component } from 'react'
import Alt from '../'
import { Column, Table } from 'fixed-data-table'
import makeFinalStore from './makeFinalStore'
import connectToStores from './connectToStores'
import Inspector from './Inspector'

const alt = new Alt()

const actions = alt.generateActions(
  'addDispatch',
  'selectDispatch',
  'setAlt',
  'revert'
)

const DispatcherStore = alt.createStore(class {
//  static displayName = 'DispatcherStore'

  constructor() {
    this.dispatches = []
    this.selectedDispatch = {}
    this.snapshots = {}
    this.alt = null
    this.stores = []

    this.bindActions(actions)
    this.exportPublicMethods({
      getDispatches: () => this.dispatches,
      getSelected: () => this.selectedDispatch,
    })
  }

  addDispatch(payload) {
    const id = Math.random().toString(16).substr(2, 7)
    payload.id = id

    const dispatchedStores = this.stores
      .filter((x) => x.boundListeners.indexOf(payload.details.id) > -1)
      .map((x) => x.name)
      .join(', ')

    payload.dispatchedStores = dispatchedStores

    this.dispatches.unshift(payload)

    if (this.alt) this.snapshots[id] = this.alt.takeSnapshot()
  }

  selectDispatch(dispatch) {
    this.selectedDispatch = dispatch
  }

  setAlt(alt) {
    this.alt = alt
    this.stores = Object.keys(this.alt.stores).map((name) => {
      return this.alt.stores[name]
    })
  }

  revert(id) {
    const snapshot = this.snapshots[id]
    if (snapshot) this.alt.bootstrap(snapshot)
  }
})

//const DispatcherStore = alt.createStore({
//  displayName: 'DispatcherStore',
//
//  config: {
//    getState: state => state
//  },
//
//  state: [],
//
//  reduce(state, payload) {
//    if (payload.actions === actions.addDispatch.id) {
//    }
//    const { data } = payload
//    const id = Math.random().toString(16).substr(2, 7)
//    data.id = id
//    return [data].concat(state)
//  }
//})

class FixedDataTableCSS extends Component {
  componentShouldUpdate() {
    return false
  }

  render() {
    return (
      <link
        rel="stylesheet"
        type="text/css"
        href="node_modules/fixed-data-table/dist/fixed-data-table.min.css"
      />
    )
  }
}

// XXX this can be the DispatcherDebugger
// we can also have a StoreDebugger
// we can also have a DebuggingTools which has flush, bootstrap, etc
// and a main Debugger which gives us access to everything
//
//
//  XXX add ability to turn off snapshots/history/revert
//  add ability to record dispatches
//  add ability to turn off dispatch logging
class Debugger extends Component {
  constructor(props) {
    super(props)

    this.renderActions = this.renderActions.bind(this)
  }

  componentDidMount() {
    const finalStore = makeFinalStore(this.props.alt)
    finalStore.listen((state) => {
      actions.addDispatch(state.payload)
    })

    actions.setAlt(this.props.alt)
  }

  revert(dispatch) {
    actions.revert(dispatch.id)
  }

  view(dispatch) {
    const payload = {
      action: dispatch.action,
      data: dispatch.data,
      details: dispatch.details,
      stores: dispatch.dispatchedStores,
    }

    if (this.props.inspector) {
      actions.selectDispatch(payload)
    } else {
      console.log(payload)
    }
  }

  renderInspectorWindow() {
    return this.props.inspector
      ? <this.props.inspector data={this.props.selectedDispatch} />
      : null
  }

  renderName(action) {
    return <span>{action.name}</span>
  }

  renderActions(_, i, dispatch) {
    return (
      <div>
        <span
          onClick={() => this.view(dispatch)}
          style={{ cursor: 'pointer' }}
        >
          View Data
        </span>
        <span> | </span>
        <span
          onClick={() => this.revert(dispatch)}
          style={{ cursor: 'pointer' }}
        >
          Revert
        </span>
      </div>
    )
  }

  render() {
    // make sure each panel is draggable and resizable or whatever
    return (
      <div>
        <FixedDataTableCSS />
        <Table
          headerHeight={40}
          height={200}
          rowGetter={(idx) => this.props.dispatches[idx]}
          rowHeight={35}
          rowsCount={this.props.dispatches.length}
          width={300}
        >
          <Column
            cellRenderer={this.renderName}
            dataKey="details"
            label="Name"
            width={150}
          />
          <Column
            cellRenderer={this.renderActions}
            dataKey=""
            label="Tools"
            width={150}
          />
        </Table>
        {this.renderInspectorWindow()}
      </div>
    )
  }
}

export default connectToStores({
  getPropsFromStores() {
    return {
      dispatches: DispatcherStore.getDispatches(),
      selectedDispatch: DispatcherStore.getSelected(),
    }
  },

  getStores() {
    return [DispatcherStore]
  }
}, Debugger)
