/*eslint-disable */
import React, { Component } from 'react'
import Alt from '../'
import { Column, Table } from 'fixed-data-table'
import makeFinalStore from './makeFinalStore'
import connectToStores from './connectToStores'
import DispatcherRecorder from './DispatcherRecorder'

const alt = new Alt()

const actions = alt.generateActions(
  'addDispatch',
  'revert',
  'selectDispatch',
  'setAlt',
  'toggleLogDispatches',
  'toggleRecording',
  'toggleRecordDispatch'
)

const DispatcherStore = alt.createStore(class {
  static displayName = 'DispatcherStore'

  static config = {
    getState(state) {
      return {
        dispatches: state.dispatches,
        selectedDispatch: state.selectedDispatch,
        isRecording: state.isRecording,
        logDispatches: state.logDispatches,
      }
    }
  }

  constructor() {
    this.dispatches = []
    this.selectedDispatch = {}
    this.snapshots = {}
    this.alt = null
    this.recorder = null
    this.stores = []
    this.isRecording = false
    this.logDispatches = true

    this.bindActions(actions)
  }

  addDispatch(payload) {
    if (!this.logDispatches) return false

    const id = Math.random().toString(16).substr(2, 7)
    payload.id = id

    if (this.isRecording) payload.recorded = true

    const dispatchedStores = this.stores
      .filter((x) => x.boundListeners.indexOf(payload.details.id) > -1)
      .map((x) => x.name)
      .join(', ')

    payload.dispatchedStores = dispatchedStores

    this.dispatches.unshift(payload)

    if (this.alt) this.snapshots[id] = this.alt.takeSnapshot()
  }

  revert(id) {
    const snapshot = this.snapshots[id]
    if (snapshot) this.alt.bootstrap(snapshot)
  }

  selectDispatch(dispatch) {
    this.selectedDispatch = dispatch
  }

  setAlt(alt) {
    this.alt = alt
    this.recorder = new DispatcherRecorder(alt)
    this.stores = Object.keys(this.alt.stores).map((name) => {
      return this.alt.stores[name]
    })
  }

  toggleLogDispatches() {
    this.logDispatches = !this.logDispatches
  }

  toggleRecording() {
    if (this.isRecording) {
      this.recorder.stop()
    } else {
      this.recorder.record()
    }

    this.isRecording = !this.isRecording
  }

  toggleRecordDispatch(id) {
    // XXX make sure to remove .recorded from the payload in this store.
    // and make sure to remove it from DispatcherRecorder, or add it!
    //
    // how do I remove it from DispatcherRecorder since I don't have the id?
    // maybe data equality and if action is the same?

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
    this.renderIcon = this.renderIcon.bind(this)
  }

  componentDidMount() {
    const finalStore = makeFinalStore(this.props.alt)
    finalStore.listen((state) => {
      actions.addDispatch(state.payload)
    })

    actions.setAlt(this.props.alt)
  }

  doLogDispatch(ev) {
    const data = ev.target.dataset
    actions.toggleRecordDispatch(data.payloadId)
  }

  revert(dispatch) {
    actions.revert(dispatch.id)
  }

  toggleLogDispatches() {
    actions.toggleLogDispatches()
  }

  toggleRecording() {
    actions.toggleRecording()
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

  renderActions(_, i, dispatch) {
    return (
      <div>
        <span
          onClick={() => this.view(dispatch)}
          style={{ cursor: 'pointer' }}
        >
          View
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

  renderIcon(isRecorded, _, dispatch) {
    return (
      <input
        checked={isRecorded}
        data-payload-id={dispatch.id}
        onChange={this.doLogDispatch}
        type="checkbox"
      />
    )
  }

  renderInspectorWindow() {
    return this.props.inspector
      ? <this.props.inspector data={this.props.selectedDispatch} />
      : null
  }

  renderName(action) {
    return <span>{action.name}</span>
  }

  render() {
    // make sure each panel is draggable and resizable or whatever
    return (
      <div>
        <label>
          <input
            checked={this.props.logDispatches}
            onChange={this.toggleLogDispatches}
            type="checkbox"
          />
          <span>Log Dispatches</span>
        </label>
        <div>
          <span onClick={this.toggleRecording}>
            {this.props.isRecording ? 'Stop' : 'Record'}
          </span>
        </div>
        <FixedDataTableCSS />
        <Table
          headerHeight={30}
          height={480}
          rowGetter={(idx) => this.props.dispatches[idx]}
          rowHeight={30}
          rowsCount={this.props.dispatches.length}
          width={320}
        >
          <Column
            cellRenderer={this.renderIcon}
            dataKey="recorded"
            label="*"
            width={25}
          />
          <Column
            cellRenderer={this.renderName}
            dataKey="details"
            label="Name"
            width={147.5}
          />
          <Column
            cellRenderer={this.renderActions}
            dataKey=""
            label="Tools"
            width={147.5}
          />
        </Table>
        {this.renderInspectorWindow()}
      </div>
    )
  }
}

export default connectToStores({
  getPropsFromStores() {
    return DispatcherStore.getState()
  },

  getStores() {
    return [DispatcherStore]
  }
}, Debugger)
