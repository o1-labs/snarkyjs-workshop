import {
  Field,
  PrivateKey,
  PublicKey,
  SmartContract,
  state,
  State,
  method,
  UInt32,
  UInt64,
  Mina,
  Party,
  Poseidon,
  CircuitValue,
  prop,
} from '@o1labs/snarkyjs';

// This exercise involves a user defined data type.

class PersonalInfo extends CircuitValue {
  @prop age: UInt32;
  @prop favoriteNumber: UInt32;

  constructor(age: UInt32, favoriteNumber: UInt32) {
    super();
    this.age = age;
    this.favoriteNumber = favoriteNumber;
  }
}

class Exercise5 extends SmartContract {
  @state(Field) value: State<Field>;
  @state(PersonalInfo) personalInfo: State<PersonalInfo>;

  constructor(
    initialBalance: UInt64,
    address: PublicKey,
    x: Field,
    info: PersonalInfo
  ) {
    super(address);
    this.balance.addInPlace(initialBalance);
    this.value = State.init(x);
    this.personalInfo = State.init(info);
  }

  // If you call update, you're allowed to set your favorite number.
  @method async update(newFavoriteNumber: UInt32) {
    const x = await this.value.get();
    const info = await this.personalInfo.get();
    info.favoriteNumber = newFavoriteNumber;
    this.personalInfo.set(info);
    // apply the hash function 10 times
    this.value.set(Poseidon.hash([x]));
  }
}

export async function run() {
  const Local = Mina.LocalBlockchain();
  Mina.setActiveInstance(Local);
  const account1 = Local.testAccounts[0].privateKey;
  const account2 = Local.testAccounts[1].privateKey;

  const snappPrivkey = PrivateKey.random();
  const snappPubkey = snappPrivkey.toPublicKey();

  let snappInstance: Exercise5;
  const initSnappState = new Field(3);

  // Deploys the snapp
  await Mina.transaction(account1, async () => {
    // account2 sends 1000000000 to the new snapp account
    const amount = UInt64.fromNumber(1000000000);
    const p = await Party.createSigned(account2);
    p.balance.subInPlace(amount);

    const info = new PersonalInfo(
      UInt64.fromNumber(28),
      UInt64.fromNumber(123456)
    );
    snappInstance = new Exercise5(amount, snappPubkey, initSnappState, info);
  })
    .send()
    .wait();

  // Update the snapp, send the reward to account2
  await Mina.transaction(account1, async () => {
    let newFavoriteNumber = UInt64.fromNumber(1337);
    await snappInstance.update(newFavoriteNumber);
  })
    .send()
    .wait();

  const a = await Mina.getAccount(snappPubkey);

  console.log('');
  console.log('Exercise 5');
  console.log('final state value', a.snapp.appState[0].toString());
}
