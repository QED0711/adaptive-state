/************************************* IMPORTS **************************************/
import {
    formatAccessor,
    getNestedRoutes,
    nestedSetterFactory,
    sanitizeState,
    restoreState,
    WindowManager,
    _localStorage,
    getUpdatedPaths,
    createStateProxy,
} from './utils/helpers'

import {
    StateObject,
    StateUpdateCallback,
    InitializationOptions,
    StorageOptions,
    EventPayload,
    managerID,
    StateSchema
} from './types/index'
import { ProtectedNamespaceError } from './errors';

/************************************* DEFAULTS **************************************/
const DEFAULT_INIT_OPTIONS: InitializationOptions = {
    id: "",
    dynamicGetters: true,
    dynamicSetters: true,
    nestedGetters: true,
    nestedSetters: true,
    debug: false
}

const DEFAULT_STORAGE_OPTIONS: StorageOptions = {
    persistKey: "",
    initializeFromLocalStorage: false,
    subscriberIDs: [],
    clearStorageOnUnload: true,
    removeChildrenOnUnload: true,
    privateState: [],

}

let IS_BROWSER: boolean;
export let WINDOW: { [key: string]: any };
try {
    WINDOW = window;
    IS_BROWSER = true;
} catch (err) {
    WINDOW = global;
    IS_BROWSER = false;
}
if (!("localStorage" in WINDOW)) WINDOW.localStorage = new _localStorage

const PROTECTED_NAMESPACES: {[key: string]: any} = {
    state: true, 
    setters: true, 
    getters: true, 
    methods: true,
    initOptions: true,
    _schema: true,
    _state: true,
    _bindToLocalStorage: true,
    windowManager: true,
    eventListeners: true
}


/* SPICCATO */
export class Spiccato {
    /* Class Properties */
    private static managers: { [key: string]: Spiccato } = {};

    private static registerManager(instance: Spiccato) {
        if (instance.initOptions.id in this.managers) {
            console.warn(`State Manager with id: '${instance.initOptions.id}' already exists. It has been overwritten`)
        }
        this.managers[instance.initOptions.id] = instance;
    }

    static getManagerById(id: managerID) {
        return this.managers[id];
    }

    static clear() {
        this.managers = {};
    }

    /* Instance Properties */
    private initOptions: InitializationOptions;
    private _schema: StateSchema
    private _state: StateObject;
    getters: { [key: string]: Function };
    setters: { [key: string]: Function };
    methods: { [key: string]: Function };
    private _bindToLocalStorage: boolean;
    windowManager: (WindowManager | null);
    private _eventListeners: { [key: string]: Function[] }
    [key: string]: any; /* for runtime added properties */

    constructor(state: StateObject = {}, options: InitializationOptions) {
        this.initOptions = { ...DEFAULT_INIT_OPTIONS, ...options };
        this._schema = Object.freeze({...state})
        this._state = state;

        this.getters = {}
        this.setters = {}
        this.methods = {}

        this._bindToLocalStorage = false
        this.windowManager = IS_BROWSER ? new WindowManager(WINDOW) : null;

        this._eventListeners = {};

        if (IS_BROWSER) {
            WINDOW?.addEventListener("beforeunload", this.handleUnload.bind(this))
            WINDOW?.addEventListener("onunload", this.handleUnload.bind(this))
        }

        (this.constructor as typeof Spiccato).registerManager(this)
    }

    public get state(): StateObject {
        return createStateProxy(this._state, this._schema);
    }

    init() {
        this._applyState();
    }

    private _applyState() {

        if (this._bindToLocalStorage) {
            this._persistToLocalStorage(this._state)
        }

        for (let k in this._state) {
            if (this.initOptions.dynamicGetters) {
                this.getters[formatAccessor(k, "get")] = () => {
                    // this accesses `this.state` and NOT `this._state`. If the getter returns a higher level object, that object should be immutable
                    return this.state[k];
                }
            }

            if (this.initOptions.dynamicSetters) {
                this.setters[formatAccessor(k, "set")] = (v: any, callback: StateUpdateCallback | null) => {
                    return new Promise(async resolve => {
                        resolve(await this.setState({ [k]: v }, callback));
                        this.emitEvent("on_" + k + "_update", { path: k, value: v })
                    })
                }
            }
        }

        // nested interactions
        const createNestedGetters = this.initOptions.dynamicGetters && this.initOptions.nestedGetters;
        const createNestedSetters = this.initOptions.dynamicSetters && this.initOptions.nestedSetters;
        if (createNestedGetters || createNestedSetters) {
            const nestedPaths: (string[])[] = getNestedRoutes(this._state);
            for (let path of nestedPaths) {

                if (createNestedGetters) {
                    this.getters[formatAccessor(path, "get")] = () => {
                        let value = this._state[path[0]];
                        for (let i = 1; i < path.length; i++) {
                            value = value[path[i]];
                        }
                        return value;
                    }
                }

                if (createNestedSetters) {
                    this.setters[formatAccessor(path, "set")] = (v: any, callback: StateUpdateCallback | null): Promise<StateObject> => {
                        const updatedState = nestedSetterFactory(this._state, path)(v);
                        return new Promise(async resolve => {
                            resolve(await this.setState(updatedState, callback));
                        })
                    }
                }
            }
        }
    }

    private _persistToLocalStorage(state: StateObject) {
        if (this._bindToLocalStorage && !!this.storageOptions.persistKey) {
            const [sanitized, removed] = sanitizeState(state, this.storageOptions.privateState || [])
            WINDOW?.localStorage?.setItem(this.storageOptions.persistKey, JSON.stringify(sanitized))
            this._state = restoreState(state, removed);
        }
    }

    setState(updater: StateObject | Function, callback: StateUpdateCallback | null = null): Promise<StateObject> {
        return new Promise(resolve => {
            let updatedPaths: string[][] = [];
            if (typeof updater === 'object') {
                updatedPaths = getUpdatedPaths(updater, this._state)
                this._state = { ...this._state, ...updater };
            } else if (typeof updater === 'function') {
                const updaterValue: StateObject = updater(this.state);
                updatedPaths = getUpdatedPaths(updaterValue, this._state)
                this._state = { ...this._state, ...updaterValue };
            }
            // const updated = Object.freeze({ ...this._state })
            const updated = createStateProxy(this._state, this._schema)
            resolve(updated);
            callback?.(updated);
            this.emitEvent("update", {state: updated})
            for (let path of updatedPaths) {
                this.emitUpdateEventFromPath(path)
            }
            if (this._bindToLocalStorage && this.storageOptions.persistKey) {
                this._persistToLocalStorage(this._state)
            }
        })
    }

    addCustomGetters(getters: { [key: string]: Function }) {
        for (let [key, callback] of Object.entries(getters)) {
            getters[key] = callback.bind(this);
        }
        this.getters = { ...this.getters, ...getters }
    }

    addCustomSetters(setters: { [key: string]: Function }) {
        for (let [key, callback] of Object.entries(setters)) {
            setters[key] = callback.bind(this);
        }
        this.setters = { ...this.setters, ...setters };
    }

    addCustomMethods(methods: { [key: string]: Function }) {
        for (let [key, callback] of Object.entries(methods)) {
            methods[key] = callback.bind(this);
        }
        this.methods = { ...this.methods, ...methods };
    }

    addNamespacedMethods(namespaces: { [key: string]: { [key: string]: Function } }) {
        for (let ns in namespaces) {
            if(PROTECTED_NAMESPACES[ns]) {
                throw new ProtectedNamespaceError(`The namespace '${ns}' is protected. Please choose a different namespace for you methods.`)
            } 
            this[ns] = {}
            for (let [key, callback] of Object.entries(namespaces[ns])) {
                this[ns][key] = callback.bind(this);
            }
        }
    }

    /********** EVENTS **********/

    addEventListener(eventType: string | string[], callback: Function) {
        if(Array.isArray(eventType)) {
            eventType = "on_" + eventType.join("_") + "_update"
        }
        if (eventType in this._eventListeners) {
            this._eventListeners[eventType].push(callback);
        } else {
            this._eventListeners[eventType] = [callback];
        }
    }

    removeEventListener(eventType: string, callback: Function) {
        this._eventListeners[eventType] = this._eventListeners[eventType]?.filter(cb => cb !== callback);
    }

    private emitEvent(eventType: string, payload: EventPayload) {
        this._eventListeners[eventType]?.forEach(callback => {
            callback(payload);
        })
    }

    private emitUpdateEventFromPath(path: string[]) {
        let p: string[], v: any;
        for (let i = 0; i < path.length; i++) {
            p = path.slice(0, i + 1)
            v = this._state
            for (let key of p) {
                v = v[key]
            }
            this.emitEvent("on_" + p.join("_") + "_update", { path: p, value: v })
        }
    }

    /********** LOCAL STORAGE **********/
    connectToLocalStorage(storageOptions: StorageOptions) {
        this._bindToLocalStorage = true;
        this.storageOptions = { ...DEFAULT_STORAGE_OPTIONS, ...storageOptions };

        // if window does not have a "name" peroperty, default to the provider window id
        if (!WINDOW.name && this.storageOptions.providerID) {
            WINDOW.name = this.storageOptions.providerID;
        }

        if (!WINDOW.name) {
            console.error("If connecting to localStorage, providerID must be defined in sotrageOptions passed to 'connectoToLocalStorage'");
            return;
        }

        this.initOptions.debug && console.log("DEBUG: window.name", WINDOW.name)
        this.initOptions.debug && console.assert(!!WINDOW.name)

        if (this.storageOptions.initializeFromLocalStorage) {

            if (!!WINDOW.localStorage.getItem(this.storageOptions.persistKey)) {
                if (WINDOW.name === this.storageOptions.providerID) {
                    this._state = {
                        ...this._state,
                        ...JSON.parse(WINDOW.localStorage.getItem(this.storageOptions.persistKey)),
                    }
                } else if ((this.storageOptions.subscriberIDs ?? []).includes(WINDOW.name)) {
                    this._state = JSON.parse(WINDOW.localStorage.getItem(this.storageOptions.persistKey))
                } else {
                    IS_BROWSER && console.warn("window is not a provider and has not been identified as a subscriber. State will not be loaded. See docs on provider and subscriber roles");
                    this._state = {}
                }
            }
        }
        if ("addEventListener" in WINDOW) {
            WINDOW.addEventListener("storage", () => {
                this._updateFromLocalStorage()
            })
        }
    }

    private _updateFromLocalStorage() {
        this.setState({ ...this._state, ...JSON.parse(WINDOW.localStorage.getItem(this.storageOptions.persistKey)) })
    }

    private handleUnload(event: { [key: string]: any }) {
        // clear local storage only if specified by user AND the window being closed is the provider window
        if (this.storageOptions.clearStorageOnUnload && this.storageOptions.providerID === WINDOW?.name) {
            WINDOW?.localStorage.removeItem(this.storageOptions.persistKey)
        }

        // close all children (and grand children) windows if this functionality has been specified by the user   
        if (this.storageOptions.removeChildrenOnUnload) {
            this.windowManager?.removeSubscribers();
        }
    }

}



