import CausalityRedux from 'causality-redux';
import createBrowserHistory from 'history/createBrowserHistory';

if ( typeof CausalityRedux === 'undefined')
    throw new Error('CausalityRedux not found.');

if ( typeof createBrowserHistory === 'undefined')
    throw new Error('createBrowserHistory not found from history/createBrowserHistory.');

const startKey = '@@@CR@@@'; 
const historyCache = {};
let activeKey = startKey;
export let history = null;

const isCausalityReduxComponent = val =>
    typeof val === 'function' && val.prototype !== 'undefined' && typeof val.prototype.isCausalityReduxComponent !== 'undefined';  

const isCausalityReduxPartition = (key) =>
    key !== CausalityRedux.storeVersionKey;

const shallowCopyReduxStore = (store) => {
    const storeCopy = CausalityRedux.shallowCopy(store);
    CausalityRedux.getKeys(storeCopy).forEach(key => {
        storeCopy[key] = CausalityRedux.shallowCopy(store[key]);
    });
    return storeCopy;
};

const transitionFromCurrentState = (key) => {
    key = typeof key === 'undefined' ? startKey : key;
    const currentState = shallowCopyReduxStore(CausalityRedux.store.getState());
    //
    // If any new conponents have been added to the store as a result of hot-reloading
    // then copy the new component everywhere in the history cache.
    // Since hot reloading does not happen in production then this is for development only.
    //
    if (process.env.NODE_ENV !== 'production') {
        CausalityRedux.getKeys(currentState).forEach(topLevelKey => {
            if (isCausalityReduxPartition(topLevelKey)) {
                const partition = currentState[topLevelKey];
                CausalityRedux.getKeys(partition).forEach(partitionKey => {
                    if (isCausalityReduxComponent(partition[partitionKey])) {
                        CausalityRedux.getKeys(historyCache).forEach(historyKey => {
                            if (typeof historyCache[historyKey][topLevelKey][partitionKey] !== 'undefined')
                                historyCache[historyKey][topLevelKey][partitionKey] = partition[partitionKey];
                        });
                    }
                });
            }
        });
    }
    historyCache[activeKey] = currentState;
    activeKey = key;
};

const handleListen = (location, action) => {
    switch (action) {
        case 'PUSH':
            transitionFromCurrentState(location.key);
            break;
        case 'POP':
            transitionFromCurrentState(location.key);
            if (historyCache[activeKey])
                CausalityRedux.copyState(historyCache[activeKey]);
            break;
        case 'REPLACE':
            activeKey = location.key;
            break;
    }
};

export default function cBH(paramObj) {
    if (!history) {
        history = createBrowserHistory(paramObj);
        history.listen((location, action) => {
            handleListen(location, action);
        });
    }
    return history;
}

export const setHistoryState = (state) => {
    if (!history)
        return;    
    if (typeof state === 'undefined' || typeof state[CausalityRedux.storeVersionKey] === 'undefined')
        throw new Error('Invalid 1st argument.');  

    const storeVersion = state[CausalityRedux.storeVersionKey];
    const arrHC = Object.keys(historyCache);
    const h = [];
    arrHC.forEach(e => {
        h.push({key: e, storeVersion: historyCache[e][CausalityRedux.storeVersionKey] });
    });

    h.sort((a, b) => {
        if (a.storeVersion < b.storeVersion)
            return -1;
        if (a.storeVersion > b.storeVersion)
            return 1;
        return 0;
    });

    for (let i = h.length - 1; i >= 0 && storeVersion < h[i].storeVersion; --i)
        historyCache[h[i].key] = shallowCopyReduxStore(state);
};