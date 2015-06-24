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
  'clear',
  'loadRecording',
  'replay',
  'revert',
  'saveRecording',
  'selectDispatch',
  'setAlt',
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
    this.isRecording = true

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
    if (!this.isRecording) return false

    const dispatchedStores = this.stores
      .filter((x) => x.boundListeners.indexOf(payload.action) > -1)
      .map((x) => x.name)
      .join(', ')

    payload.dispatchedStores = dispatchedStores

    this.dispatches.unshift(payload)

    if (this.alt) this.snapshots[payload.id] = this.alt.takeSnapshot()
    this.currentStateId = payload.id
  }

  clear() {
    this.dispatches = []
    this.selectedDispatch = {}
    this.currentStateId = null
    this.snapshots = {}
    this.recorder.clear()
  }

  loadRecording(events) {
    this.clear()
    const wasRecording = this.isRecording
    this.isRecording = true
    const dispatches = this.recorder.loadEvents(events)
    dispatches.forEach((dispatch) => this.addDispatch(dispatch))
    this.isRecording = wasRecording
  }

  replay() {
    this.clear()

    // XXX I need to be able to pause and stop replay and shit...
    setTimeout(() => this.recorder.replay(5))
  }

  revert(id) {
    const snapshot = this.snapshots[id]
    if (snapshot) {
      this.currentStateId = id
      this.alt.bootstrap(snapshot)
    }
  }

  saveRecording() {
    console.log(this.recorder.serializeEvents())
  }

  selectDispatch(dispatch) {
    this.selectedDispatch = dispatch
  }

  setAlt(alt) {
    this.alt = alt
    this.recorder = new DispatcherRecorder(alt)
    this.recorder.record()
    this.stores = Object.keys(this.alt.stores).map((name) => {
      return this.alt.stores[name]
    })
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
    this.renderRevert = this.renderRevert.bind(this)
    this.view = this.view.bind(this)
  }

  clear() {
    actions.clear()
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

  loadRecording() {
    const json = prompt('Give me a serialized recording')
    if (json) actions.loadRecording(json)
  }

  revert(ev) {
    const data = ev.target.dataset
    actions.revert(data.dispatchId)
  }

  saveRecording() {
    actions.saveRecording()
  }

  toggleLogDispatches() {
    actions.toggleLogDispatches()
  }

  toggleRecording() {
    actions.toggleRecording()
  }

  view(ev) {
    const data = ev.target.dataset
    const dispatch = this.props.dispatches[data.dispatchId]
    if (this.props.inspector) {
      actions.selectDispatch(dispatch)
    } else {
      console.log(dispatch)
    }
  }

  renderName(name, _, dispatch) {
    return (
      <span
        data-dispatch-id={dispatch.id}
        onClick={this.view}
        style={{ cursor: 'pointer' }}
      >
        {name}
      </span>
    )
  }

  renderRevert(a, b, dispatch) {
    return (
      <span
        data-dispatch-id={dispatch.id}
        onClick={this.revert}
        style={{ cursor: 'pointer' }}
      >
        Revert
        <span dangerouslySetInnerHTML={{
          __html: this.props.currentStateId === dispatch.id ? '&#10003;' : ''
        }} />
      </span>
    )
  }

  render() {
    return (
      <div>
        <div>
          <span onClick={this.toggleRecording}>
            {this.props.isRecording ? 'Stop' : 'Record'}
          </span>
          {' | '}
          <span onClick={this.saveRecording}>
            {this.props.dispatches.length ? 'Save' : ''}
          </span>
          {' | '}
          <span onClick={this.clear}>
            Clear
          </span>
          {' | '}
          <span onClick={this.loadRecording}>
            Load
          </span>
          {' | '}
          <span onClick={this.replay}>
            Replay Events
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
            cellRenderer={this.renderName}
            dataKey="action"
            label="Name"
            width={250}
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
