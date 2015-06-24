/*eslint-disable */
import React, { Component } from 'react'
import Alt from '../'
import { Column, Table } from 'fixed-data-table'
import makeFinalStore from './makeFinalStore'
import connectToStores from './connectToStores'
import DispatcherRecorder from './DispatcherRecorder'
import { DragSource, DragDropContext } from 'react-dnd'
import HTML5Backend from 'react-dnd/modules/backends/HTML5'

import assign from 'object-assign'

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
        hasRecorded: state.recorder && state.recorder.events.length > 0,
        isRecording: state.isRecording,
        logDispatches: state.logDispatches,
        mtime: state.mtime,
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

    // due to the aggressive nature of FixedDataTable's shouldComponentUpdate
    // and JS objects being references not values we need an mtime applied
    // to each dispatch so we know when data has changed
    this.mtime = Date.now()

    this.on('beforeEach', () => {
      this.mtime = Date.now()
    })

    this.bindActions(actions)
  }

  addDispatch(payload) {
    if (!this.logDispatches) return false

    payload.recorded = this.isRecording

    const dispatchedStores = this.stores
      .filter((x) => x.boundListeners.indexOf(payload.details.id) > -1)
      .map((x) => x.name)
      .join(', ')

    payload.dispatchedStores = dispatchedStores

    this.dispatches.unshift(payload)

    if (this.alt) this.snapshots[payload.id] = this.alt.takeSnapshot()
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

    if (dispatchId === null) return false

    const dispatch = this.dispatches[dispatchId]

    if (dispatch.recorded) {
      // remove from the recorder
      const spliceId = this.recorder.events.reduce((splice, event, i) => {
        return event.id === id ? i : splice
      }, null)

      if (spliceId) this.recorder.events.splice(spliceId, 1)
    } else {
      // find the correct splice index so we can add it in proper replay order
      let prevId = null
      for (let i = dispatchId; i < this.dispatches.length; i += 1) {
        if (this.dispatches[i].recorded) {
          prevId = this.dispatches[i].id
          break
        }
      }

      const spliceId = this.recorder.events.reduce((splice, event, i) => {
        return event.id === prevId ? i : splice
      }, 0)

      this.recorder.events.splice(spliceId, 0, dispatch)
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

    this.getDispatch = this.getDispatch.bind(this)
    this.renderIcon = this.renderIcon.bind(this)
    this.renderRevert = this.renderRevert.bind(this)
    this.renderView = this.renderView.bind(this)
  }

  doLogDispatch(ev) {
    const data = ev.target.dataset
    actions.toggleRecordDispatch(data.payloadId)
  }

  getDispatch(idx) {
    const dispatch = this.props.dispatches[idx]
    return {
      id: dispatch.id,
      action: dispatch.action,
      data: dispatch.data,
      details: dispatch.details,
      recorded: dispatch.recorded,
      dispatchedStores: dispatch.dispatchedStores,
      mtime: this.props.mtime,
    }
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
    if (this.props.inspector) {
      actions.selectDispatch(dispatch)
    } else {
      console.log(dispatch)
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
        Revert
        <span dangerouslySetInnerHTML={{
          __html: this.props.currentStateId === dispatch.id ? '&middot;' : ''
        }} />
      </span>
    )
  }

  renderView(a, b, dispatch) {
    return (
      <span
        onClick={() => this.view(dispatch)}
        style={{ cursor: 'pointer' }}
      >
        View
        <span dangerouslySetInnerHTML={{
          __html: this.props.selectedDispatch.id === dispatch.id ? '&middot;' : ''
        }} />
      </span>
    )
  }

  render() {
    // XXX maybe all dispatches should be recorded...
    // and maybe not because we may have unwanted things?
    //
    // is there a scenario where you don't want to replay ALL the dispatches only certain ones?
    // makes sense...
    // Stop recording should just stop logging all the dispatches...
    //
    // TODO make clear dispatches, make replay dispatches which will recycle state and replay
    // make save + load
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
          <span onClick={this.saveRecording}>
            {this.props.hasRecorded && 'Save for Replay'}
          </span>
          <span onClick={this.loadRecording}>
            Load
          </span>
        </div>
        <Table
          headerHeight={30}
          height={480}
          rowGetter={this.getDispatch}
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
