/*eslint-disable */
import React, { Component } from 'react'
import Alt from '../'
import { Column, Table } from 'fixed-data-table'
import makeFinalStore from './makeFinalStore'
import connectToStores from './connectToStores'
import DispatcherRecorder from './DispatcherRecorder'
import { DragSource, DragDropContext } from 'react-dnd'
import HTML5Backend from 'react-dnd/modules/backends/HTML5'

//import DispatcherDebugger from './DispatcherDebugger'

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
        currentStateId: state.currentStateId,
        dispatches: state.dispatches,
        isRecording: state.isRecording,
        logDispatches: state.logDispatches,
        selectedDispatch: state.selectedDispatch,
      }
    }
  }

  constructor() {
    this.dispatches = []
    this.selectedDispatch = {}
    this.currentStateId = null
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
    if (snapshot) {
      this.currentStateId = id
      this.alt.bootstrap(snapshot)
    }
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
    const dispatchId = this.dispatches.reduce((x, dispatch, i) => {
      return dispatch.id === id ? i : x
    }, null)

    if (!dispatchId) return false

    const dispatch = this.dispatches[dispatchId]

    this.dispatches[dispatchId].recorded = false
    return true

    // XXX this is kinda shitty. I should not rely on `id` instead use action
    // and data equality...
    if (dispatch.recorded) {
      // remove from the recorder
      const spliceId = this.recorder.events.reduce((splice, event, i) => {
        return event.id === id ? i : splice
      }, null)

      if (spliceId) this.recorder.events.splice(spliceId, 1)
    } else {
      // add to the recorder, in the right order too
      // TODO
      this.recorder.events.push(dispatch)
    }

    dispatch.recorded = !dispatch.recorded
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

const DispatcherDebugger = DragSource('DispatcherDebugger', {
  beginDrag(props) {
    return props
  }
}, (connect, monitor) => {
  return {
    connect: connect.dragSource()
  }
})(class extends Component {
  constructor() {
    super()

    this.renderIcon = this.renderIcon.bind(this)
    this.renderRevert = this.renderRevert.bind(this)
    this.renderView = this.renderView.bind(this)
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

  renderName(action) {
    return <span>{action.name}</span>
  }

  renderRevert(a, b, dispatch) {
    return (
      <span
        onClick={() => this.revert(dispatch)}
        style={{ cursor: 'pointer' }}
      >
        Revert {this.props.currentStateId === dispatch.id ? '√' : ''}
      </span>
    )
  }

  renderView(a, b, dispatch) {
    // XXX this is not going to work because selectedDispatch doesn't have an id
    return (
      <span
        onClick={() => this.view(dispatch)}
        style={{ cursor: 'pointer' }}
      >
        View {this.props.selectedDispatch.id === dispatch.id ? '√' : ''}
      </span>
    )
  }

  render() {
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
            width={155}
          />
          <Column
            cellRenderer={this.renderView}
            dataKey="id"
            label="View"
            width={70}
          />
          <Column
            cellRenderer={this.renderRevert}
            dataKey=""
            label="Revert"
            width={70}
          />
        </Table>
      </div>
    )
  }
})

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
  componentDidMount() {
    const finalStore = makeFinalStore(this.props.alt)
    finalStore.listen((state) => {
      actions.addDispatch(state.payload)
    })

    actions.setAlt(this.props.alt)
  }

  renderInspectorWindow() {
    return this.props.inspector
      ? <this.props.inspector data={this.props.selectedDispatch} />
      : null
  }

  render() {
    // XXX I think I should connect the inspector window otherwise make it
    // console.log
    //
    // this way we connect DispatcherDebugger to the AltStore so that is the
    // only thing that re-renders
    return (
      <div>
        <FixedDataTableCSS />
        <DispatcherDebugger {...this.props} />
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
}, DragDropContext(HTML5Backend)(Debugger))
