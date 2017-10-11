/* eslint-disable react/no-multi-comp */
/* eslint-disable react/jsx-sort-prop-types */


import assert from 'assert';
import CausalityRedux from 'causality-redux';

const store = CausalityRedux.createStore();

describe('CausalityRedux createStore', function(){
  it('CausalityRedux.store should exist', function(){
    assert(typeof store !== 'undefined' );
  });

});
