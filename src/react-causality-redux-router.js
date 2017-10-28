/* eslint no-console:0 */
/* eslint no-var: 0 */
import CausalityRedux from 'causality-redux';
import createBrowserHistory from 'history/createBrowserHistory';

const AsyncWait = (function () {
    const _defaultTimeout = 250;
    const _defaultMili = 15;
    let _startTime;
    let _intervalId;
    let _success;
    let _fail;
    let _testfunction;

    function checkFunction() {
        if (_testfunction()) {
            clearInterval(_intervalId);
            _success();
        } else if (new Date() - _startTime > this.defaultTimeout) {
            clearInterval(_intervalId);
            _fail();
        }
    }

    function AsyncWait(defaultTimeout = _defaultTimeout, defaultMili = _defaultMili) {
        this.defaultTimeout = defaultTimeout;
        this.defaultMili = defaultMili;
    }

    AsyncWait.prototype = {
        constructor: AsyncWait,
        wait: function (testfunction, success, fail) {
            _startTime = new Date();
            _intervalId = setInterval(checkFunction, this.defaultMili);
            _success = success;
            _fail = fail;
            _testfunction = testfunction;
        }
    };

    return AsyncWait;
})();

const startKey = '@@@CR@@@';
const shallowCopy = CausalityRedux.shallowCopy;
const sessionKey = 'historyItem';
const asyncWait = new AsyncWait();
let historyCache = {};
let activeKey = startKey;
let historyStore = null;
export let history = null;
let isMonitor = false;
let unlisten;
let historyStackIndex;
let newKeys = [];
let historyItem = { index: -1, stack: []};

const hasSessionStorage = () =>
    typeof sessionStorage !== 'undefined';

    const readSessionItem = (key) => {
    if (!hasSessionStorage())
        return '';
    return sessionStorage.getItem(key);
};

const writeSessionItem = (key, data) => {
    if (!hasSessionStorage())
        return;
    sessionStorage.setItem(key, data);
};

const writeHistory = () => {
    writeSessionItem(sessionKey, JSON.stringify(historyItem));
    if (process.env.NODE_ENV !== 'production') {
        if (isMonitor) {
            const h = {};
            h.activeKey = activeKey;
            h.stack = [...historyItem.stack];
            h.index = historyItem.index;
            h.historyCache = shallowCopy(historyCache);
            historyStore.setState(h);
        }
    }    
};

const readHistory = function() {
    const item = readSessionItem(sessionKey);
    if (item)
        historyItem = JSON.parse(item);
};

const isCausalityReduxPartition = key =>
    key !== CausalityRedux.storeVersionKey;

const handleHotReloadedComponents = state => {
    //
    // If any new component(s) have been added to the store as a result of hot-reloading
    // then copy the new component(s) everywhere in the history cache.
    // Since hot reloading does not happen in production then this is for development only.
    //
    if (process.env.NODE_ENV !== 'production') {
        CausalityRedux.getKeys(state).forEach(topLevelKey => {
            if (isCausalityReduxPartition(topLevelKey)) {
                const partition = state[topLevelKey];
                CausalityRedux.getKeys(partition).forEach(partitionKey => {
                    if (CausalityRedux.isCausalityReduxComponent(partition[partitionKey])) {
                        CausalityRedux.getKeys(historyCache).forEach(historyKey => {
                            if (typeof historyCache[historyKey][topLevelKey][partitionKey] !== 'undefined')
                                historyCache[historyKey][topLevelKey][partitionKey] = partition[partitionKey];
                        });
                    }
                });
            }
        });
    }
};

const validKey = key =>
    typeof key === 'undefined' ? startKey : key;

const transitionFromCurrentState = (key, action) => {
    const currentState = CausalityRedux.shallowCopyStorePartitions();
    handleHotReloadedComponents(currentState);
    if (action === 'REPLACE')
        delete historyCache[activeKey];
    else
        historyCache[activeKey] = currentState;
    activeKey = key;
};

const handleListen = (location, action) => {
    let i;
    const key = validKey(location.key);
    const stack = [...historyItem.stack];
    transitionFromCurrentState(key, action);
    switch (action) {
        case 'PUSH':
            // Push can cause history entries to be deleted. So delete their cache entries
            // if the history is deleting them.
            for (i = historyItem.index + 1; i < historyItem.stack.length; ++i)
                delete historyCache[stack[i].key];
            stack.length = historyItem.index + 1;
            stack.push({ key, url: location.pathname });
            historyItem.index++;
            break;
        case 'POP':
            for (i = 0; stack[i].key !== key; ++i);
            historyItem.index = i; 
            // If this previous history entry has a saved redux store then copy it back to the redux store.
            if (historyCache[activeKey])
                CausalityRedux.copyState(historyCache[activeKey]);
            break;
        case 'REPLACE':
            stack[historyItem.index] = { key, url: location.pathname };
        break;
    }
    historyItem.stack = stack;
    writeHistory();
};

const activateHistoryListener = () => {
    unlisten = history.listen((location, action) => {
        handleListen(location, action);
    });
};   

var setHistoryStatePhase1 = null;
if (process.env.NODE_ENV !== 'production') {
    const timeoutError = () =>
        console.log('Something went wrong restoring the history.'); 

    const finishSetHistoryState = (state, historyPartition, stack) => {
        // Finally, go to the correct route associated with the input state.
        const index = historyPartition.index;
        if (stack.length - 1 !== index)
            history.go(index - stack.length + 1);
    
        // Set up everything for the chosen state.
        historyCache = historyPartition.historyCache;
        historyItem.index = historyPartition.index;
        historyItem.stack = historyPartition.stack;

        // New keys for the history now exist.
        // Must change out the old keys for the correct ones.
        for (let i = 0; i < historyItem.stack.length; ++i) {
            const oldKey = historyItem.stack[i].key;
            const newKey = newKeys[i];
            historyItem.stack[i].key = newKey;
            if (typeof historyCache[oldKey] !== 'undefined') {
                historyCache[newKey] = historyCache[oldKey];
                delete historyCache[oldKey];
            }
            if (historyPartition.activeKey === oldKey)
                activeKey = newKey;
        }
        // Copy the selected state into the redux store.
        CausalityRedux.copyState(state);
        // Turn the listener back on
        setTimeout(activateHistoryListener, 1);
    };

    //
    // Push an entry into the history.
    // Wait to continue until the async history records the change.
    // If all entries are pushed move on.
    //
    const executePhase4 = (state, historyPartition, stack) => {
        newKeys.push(history.location.key);
        history.push(stack[historyStackIndex].url);
        ++historyStackIndex;
        asyncWait.wait(
            () => history.length === historyStackIndex,
            () => setHistoryStatePhase4(state, historyPartition, stack),
            timeoutError
        );
    };

    const setHistoryStatePhase4 = (state, historyPartition, stack, isFirstCall) => {
        if (!isFirstCall && stack.length === history.length) {
            newKeys.push(history.location.key);
            finishSetHistoryState(state, historyPartition, stack);
        } else
            executePhase4(state, historyPartition, stack);
    };

    //
    // Set up to execute all the pushed necessary to restore the history to where it was.
    // Only valid for at least 2 history entries.
    //
    const setHistoryStatePhase3 = (state, historyPartition, stack) => {
        historyStackIndex = 1;
        newKeys = [];
        if (stack.length === 1 && history.length === 1) {
            newKeys.push(history.location.key);
            finishSetHistoryState(state, historyPartition, stack);
        } else
            setHistoryStatePhase4(state, historyPartition, stack, true);
    };

    //
    // Replace the history entry at position 0 with the one in the state.
    // Wait to continue until the async history records the change.
    //
    const setHistoryStatePhase2 = state => {
        // Get the history partition.
        const historyPartition = state[CausalityRedux.storeHistoryKey];
        const stack = historyPartition.stack;
        // Replace history position 0 with the state history 0.
        history.replace(stack[0].url);
        asyncWait.wait(
            () => history.action === 'REPLACE',
            () => setHistoryStatePhase3(state, historyPartition, stack),
            timeoutError
        );
    };

    //
    // Go to the beginning of the history for this website.
    // Wait to continue until the async history records the change.
    //
    setHistoryStatePhase1 = state => {
        // Turn off the history listener.
        unlisten();
        history.action = '';
        // Go to the beginning of the current history.
        if (historyItem.index !== 0)
            history.go(-historyItem.index);
        else
            history.action = 'POP';
        asyncWait.wait(
            () => history.action === 'POP',
            () => setHistoryStatePhase2(state),
            timeoutError
        );
    };
}    

export default function cBH(paramObj) {
    if (!history) {
        let homeURL = '/';
        if (typeof paramObj !== 'undefined' && typeof paramObj.homeURL === 'string')
            homeURL = paramObj.homeURL; 
        history = createBrowserHistory(paramObj);
        activateHistoryListener();
                
        readHistory();
        if (historyItem.index === -1)
            historyItem = { index: 0, stack: [{ key: startKey, url: homeURL }] };
        
        //
        // This requires asynchrouous tests because history operations cause asynchronous results.
        //
        if (process.env.NODE_ENV !== 'production') {
            history.setHistoryState = state => {
                if (typeof state === 'undefined' || typeof state[CausalityRedux.storeVersionKey] === 'undefined')
                    throw new Error('Invalid 1st argument.');
                setHistoryStatePhase1(state);
            };

            history.setMonitorOn = () => {
                isMonitor = true;
                const d = shallowCopy(historyItem);
                d.historyCache = {};
                CausalityRedux.addPartitions({ partitionName: CausalityRedux.storeHistoryKey, defaultState: d });
                historyStore = CausalityRedux.store[CausalityRedux.storeHistoryKey];
            };
        }    
    }
    return history;
}