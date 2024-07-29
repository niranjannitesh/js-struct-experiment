# Binary Struct Builder Benchmark

This project compares the performance of different methods for reading and writing binary data structures in JavaScript.

## Inspiration

This experiment is inspired by [Tsoding's video "C is Dead. JavaScript will replace it."](https://www.youtube.com/watch?v=2l6Rl09NyTw).

## Overview

The project implements two versions of a binary struct builder:

1. Using `new Function()`
2. Using regular functions

It then benchmarks these implementations against JSON serialization/deserialization.

## Running the Benchmark

To run the benchmark:

```bash
bun run index.ts
```

## Resources

- [MDN: Function constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/Function)
- [benny: Benchmark library](https://github.com/caderek/benny)
