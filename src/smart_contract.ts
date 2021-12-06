import {
  Field,
  Bool,
  Group,
  Circuit,
  Scalar,
  PrivateKey,
  prop,
  PublicKey,
  CircuitValue,
  Signature,
  Poseidon,
  shutdown,
  SmartContract,
  state,
  State,
  method,
  UInt64,
  Mina,
  Party,
  UInt32,
  Int64,
  isReady,
} from '@o1labs/snarkyjs';

await isReady;

const x0 = new Field('37');

import * as Exercise1 from './exercise_1.js';
import * as Exercise2 from './exercise_2.js';
import * as Exercise3 from './exercise_3.js';
import * as Exercise4 from './exercise_4.js';
import * as Exercise5 from './exercise_5.js';

await Exercise1.run();
await Exercise2.run();
await Exercise3.run();
await Exercise4.run();
await Exercise5.run();

shutdown();
