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
} from "@o1labs/snarkyjs";

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

/*
class SudokuRow {
  @arrayProp(Field, 9) row: Field[]

  constructor(row: Field[]) {
    this.row = row;
  }
} */

const x0 = new Field("37");
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

const message = "Juicero stocks will go up";

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

shutdown();
