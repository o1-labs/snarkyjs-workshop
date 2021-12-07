import {
  Field,
  PrivateKey,
  PublicKey,
  SmartContract,
  state,
  State,
  method,
  UInt64,
  Mina,
  Party,
  Poseidon,
  isReady,
  shutdown,
} from 'snarkyjs';

class Exercise3 extends SmartContract {
  @state(Field) x: State<Field>;

  static get UpdateReward(): UInt64 {
    return UInt64.fromNumber(1337);
  }

  constructor(initialBalance: UInt64, address: PublicKey, x: Field) {
    super(address);
    this.balance.addInPlace(initialBalance);
    this.x = State.init(x);
  }

  @method async update() {
    const x = await this.x.get();
    this.x.set(Poseidon.hash([x]));
    this.balance.subInPlace(Exercise3.UpdateReward);
  }
}

export async function run() {
  await isReady;

  const Local = Mina.LocalBlockchain();
  Mina.setActiveInstance(Local);
  const account1 = Local.testAccounts[0].privateKey;
  const account2 = Local.testAccounts[1].privateKey;
  const account2Pubkey = account2.toPublicKey();

  const snappPrivkey = PrivateKey.random();
  const snappPubkey = snappPrivkey.toPublicKey();

  let snappInstance: Exercise3;
  const initSnappState = new Field(3);

  // Deploys the snapp
  await Mina.transaction(account1, async () => {
    // account2 sends 1000000000 to the new snapp account
    const amount = UInt64.fromNumber(1000000000);
    const p = await Party.createSigned(account2);
    p.balance.subInPlace(amount);

    snappInstance = new Exercise3(amount, snappPubkey, initSnappState);
  })
    .send()
    .wait();

  // Update the snapp, send the reward to account2
  await Mina.transaction(account1, async () => {
    // 27 = 3^3
    await snappInstance.update();
    const winner = Party.createUnsigned(account2Pubkey);
    winner.balance.addInPlace(Exercise3.UpdateReward);
  })
    .send()
    .wait();

  console.log('Exercise 3');

  const a = await Mina.getAccount(account2Pubkey);

  console.log('Winner balance', a.balance.toString());
}

run();
shutdown();
