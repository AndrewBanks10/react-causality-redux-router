
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
    console.log('history');
    if (!history) {
        history = createBrowserHistory(paramObj);
        history.listen((location, action) => {
            handleListen(location, action);
        });
    }
    activeURL = history.location.pathname;
    return history;
}

export const internalHistory = () => {
    return {
        activeURL,
        historyCache
    };
};





