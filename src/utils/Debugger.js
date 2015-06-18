/*eslint-disable */
import React, { Component } from 'react'
import Alt from '../'
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

    this.bindActions(actions)
    this.exportPublicMethods({
      getDispatches: () => this.dispatches,
      getSelected: () => this.selectedDispatch,
    })
  }

  addDispatch(payload) {
    const id = Math.random().toString(16).substr(2, 7)
    payload.id = id
    this.dispatches.unshift(payload)

    // XXX TODO don't take a snapshot on every dispatch but rather
    // send the state in yourself by capturing it from each store
    // and reducing it
    if (this.alt) this.snapshots[id] = this.alt.takeSnapshot()
  }

  selectDispatch(dispatch) {
    this.selectedDispatch = dispatch
  }

  setAlt(alt) {
    this.alt = alt
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

// XXX this can be the DispatcherDebugger
// we can also have a StoreDebugger
// we can also have a DebuggingTools which has flush, bootstrap, etc
// and a main Debugger which gives us access to everything
class Debugger extends Component {
  constructor(props) {
    super(props)
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

  render() {
    // make sure each panel is draggable and resizable or whatever
    return (
      <div>
        <ul>
          {this.props.dispatches.map((dispatch) => {
            return (
              <li key={dispatch.id}>
                <div>
                  action: {dispatch.action.toString()}
                </div>
                <div>
                  <a href="#" onClick={() => this.view(dispatch)}>View Data</a>
                </div>
                <div>
                  <a href="#" onClick={() => this.revert(dispatch)}>Revert</a>
                </div>
              </li>
            )
          })}
        </ul>
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
