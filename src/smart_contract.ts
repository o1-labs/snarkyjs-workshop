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
} from '@o1labs/snarkyjs';

class SimpleApp extends SmartContract {
  @state(Field) value: State<Field>;

  constructor(initialBalance: UInt64, address: PublicKey, x: Field) {
    super(address);
    this.balance.addInPlace(initialBalance);
    this.value = State.init(x);
  }

  // Maybe don't return a promise here, it's a bit confusing
  @method async update(y: Field) {
    const x = await this.value.get();
    x.square().mul(x).assertEquals(y);
    this.value.set(y);
  }
}

async function runSimpleApp() {
  const Local = Mina.LocalBlockchain();
  Mina.setActiveInstance(Local);
  const largeValue = 30000000000;

  // Maybe just return deterministically 10 accounts with a bunch of money in them
  // Initialize an account so we can send some transactions
  const account1 = PrivateKey.random();
  Local.addAccount(account1.toPublicKey(), largeValue);
  const account2 = PrivateKey.random();
  Local.addAccount(account2.toPublicKey(), largeValue);

  const snappPrivkey = PrivateKey.random();
  const snappPubkey = snappPrivkey.toPublicKey();

  let snappInstance: SimpleApp;
  const initSnappState = new Field(2);

  // Deploys the snapp
  await Mina.transaction(account1, async () => {
    // account2 sends 1000000000 to the new snapp account
    const amount = UInt64.fromNumber(1000000000);
    const p = await Party.createSigned(account2);
    p.balance.subInPlace(amount);

    snappInstance = new SimpleApp(amount, snappPubkey, initSnappState);
  })
    .send()
    .wait();

  // Update the snapp
  await Mina.transaction(account1, async () => {
    await snappInstance.update(new Field(8));
  })
    .send()
    .wait();

  await Mina.transaction(account1, async () => {
    // Fails, because the provided value is wrong.
    await snappInstance.update(new Field(109));
  })
    .send()
    .wait();

  // .catch(e => console.log('error', e));
  const a = await Mina.getAccount(snappPubkey);

  console.log('final state value', a.snapp.appState[0].toString());
}

class SimpleAppWithPrize extends SmartContract {
  @state(Field) value: State<Field>;

  constructor(initialBalance: UInt64, address: PublicKey, x: Field) {
    super(address);
    this.balance.addInPlace(initialBalance);
    this.value = State.init(x);
  }

  static prizeAmount: UInt64 = UInt64.fromNumber(10);

  @method async update(y: Field) {
    this.balance.subInPlace(SimpleAppWithPrize.prizeAmount);

    const x = await this.value.get();
    x.square().mul(x).assertEquals(y);
    this.value.set(y);
  }
}

async function runSimpleAppWithPrize() {
  const Local = Mina.LocalBlockchain();
  Mina.setActiveInstance(Local);
  const largeValue = 30000000000;

  // Maybe just return deterministically 10 accounts with a bunch of money in them
  // Initialize an account so we can send some transactions
  const account1 = PrivateKey.random();
  Local.addAccount(account1.toPublicKey(), largeValue);
  const account2 = PrivateKey.random();
  Local.addAccount(account2.toPublicKey(), largeValue);

  const snappPrivkey = PrivateKey.random();
  const snappPubkey = snappPrivkey.toPublicKey();

  let snappInstance: SimpleAppWithPrize;
  const initSnappState = new Field(2);

  // Deploys the snapp
  await Mina.transaction(account1, async () => {
    // account2 sends 1000000000 to the new snapp account
    const amount = UInt64.fromNumber(1000000000);
    const p = await Party.createSigned(account2);
    p.balance.subInPlace(amount);

    snappInstance = new SimpleAppWithPrize(amount, snappPubkey, initSnappState);
  })
    .send()
    .wait();

  // Update the snapp
  await Mina.transaction(account1, async () => {
    await snappInstance.update(new Field(8));
    const winner = await Party.createSigned(account2);
    winner.balance.addInPlace(SimpleAppWithPrize.prizeAmount);
  })
    .send()
    .wait();

  // .catch(e => console.log('error', e));
  const a = await Mina.getAccount(snappPubkey);

  console.log('final state value', a.snapp.appState[0].toString());
  console.log('final state value', a.snapp.appState[0].toString());
}
/*
class SudokuRow {
  @arrayProp(Field, 9) row: Field[]

  constructor(row: Field[]) {
    this.row = row;
  }
} */

const x0 = new Field('37');
//x0.assertEquals(37);

// exercise about manipulating Field -> lame
// exercise about creating a CircuitValue -> lame no :/ ??

class Pair extends CircuitValue {
  @prop first: Field;
  @prop second: Field;
  @prop thing: Bool;

  constructor(first: Field, second: Field, thing: Bool) {
    super();
    this.first = first;
    this.second = second;
    this.thing = thing;
  }
}

const pair = new Pair(new Field(1), new Field(2), new Bool(true));

//const digest = Poseidon.hash(pair.toFieldElements());

// exercise about signature
// and hashing

const message = 'Juicero stocks will go up';

// keyedAccumulator (key->value interface)
// SetAccumulator -> add/check membership (set interface)
// StackMerkle ->

function stringToFields(s: string): Field[] {
  // prepend length
  const res = [new Field(s.length)];

  // convert
  for (const c of s) {
    const cc = c.charCodeAt(0);
    res.push(new Field(cc));
  }
  return res;
}

const digest = Poseidon.hash(stringToFields(message));

// create signature
const privkey = PrivateKey.random();
const pubkey = privkey.toPublicKey();
const signature = Signature.create(privkey, [digest]);

// verify just to check
const b = signature.verify(pubkey, [digest]);
console.assert(b.toBoolean());

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
