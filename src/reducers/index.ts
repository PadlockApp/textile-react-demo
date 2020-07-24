import { combineReducers } from 'redux';
import spaceReducer from './spaceReducer';
import dbReducer from './dbReducer';
import secretReducer from './secretReducer';
import threadReducer from './threadReducer';
import ffsReducer from './ffsReducer';
import errorReducer from './errorReducer';
import { Reducer } from 'react';
import { State } from './types';
import { Action } from '../actions/types';

const rootReducer: Reducer<State, Action> = combineReducers({
    space: spaceReducer,
    db: dbReducer,
    secretPair: secretReducer,
    thread: threadReducer,
    ffs: ffsReducer,
    error: errorReducer,
});

export default rootReducer;
