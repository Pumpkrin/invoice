function zip(...iterables) {
  let iterators = iterables.map( iterable => iterable[Symbol.iterator]() );
  return {
    next() {
      let results = iterators.map( iterator => iterator.next() );
      if( results.some( result => result.done ) ){ return {done: true}; }
      return {value: results.map( result => result.value ), done: false};
    },
    [Symbol.iterator] () {
      return this;
    }
  };
}
module.exports.zip =  zip;
