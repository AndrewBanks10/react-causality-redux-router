import CausalityRedux from 'causality-redux';
import createBrowserHistory from 'history/createBrowserHistory';

if ( typeof CausalityRedux === 'undefined')
    throw new Error('CausalityRedux not found.');

if ( typeof createBrowserHistory === 'undefined')
    throw new Error('createBrowserHistory not found from history/createBrowserHistory.');

const historyCache = {};
let activeURL = '';
export let history = null;

const transitionFromCurrentState = (pathname) => {
    historyCache[activeURL] = CausalityRedux.store.getState();
    activeURL = pathname;
};

const handleListen = (location, action) => {
    switch (action) {
        case 'PUSH':
            transitionFromCurrentState(location.pathname);
            break;
        case 'POP':
            transitionFromCurrentState(location.pathname);
            if (historyCache[activeURL])
                CausalityRedux.copyState(historyCache[activeURL]);
            break;
        case 'REPLACE':
            activeURL = location.pathname;
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
    activeURL = history.location.pathname;
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
        h.push({url: e, storeVersion: historyCache[e][CausalityRedux.storeVersionKey] });
    });

    h.sort((a, b) => {
        if (a.storeVersion < b.storeVersion)
            return -1;
        if (a.storeVersion > b.storeVersion)
            return 1;
        return 0;
    });

    for (let i = h.length - 1; i >= 0 && storeVersion < h[i].storeVersion; --i)
        historyCache[h[i].url] = state;
};






