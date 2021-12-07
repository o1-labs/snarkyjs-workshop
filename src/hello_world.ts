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
  Group,
  shutdown,
  isReady,
} from 'snarkyjs';

class HelloWorld extends SmartContract {
  @state(Field) value: State<Field>;

  constructor(initialBalance: UInt64, address: PublicKey, x: Field) {
    super(address);
    this.balance.addInPlace(initialBalance);
    this.value = State.init(x);
  }

  @method async update(squared: Field) {
    const x = await this.value.get();
    x.square().assertEquals(squared);
    this.value.set(squared);
  }
}

function messingAround() {
  const x = new Field(10);
  console.log(x.add(x).toString());
  console.log(x.square().toString());

  const g = Group.generator;
  // (g + g) - g = g
  g.add(g).neg().add(g).assertEquals(g);
}

async function runSimpleApp() {
  await isReady;

  const Local = Mina.LocalBlockchain();
  Mina.setActiveInstance(Local);
  const account1 = Local.testAccounts[0].privateKey;
  const account2 = Local.testAccounts[1].privateKey;

  const snappPrivkey = PrivateKey.random();
  const snappPubkey = snappPrivkey.toPublicKey();

  let snappInstance: HelloWorld;
  const initSnappState = new Field(3);

  // Deploys the snapp
  await Mina.transaction(account1, async () => {
    // account2 sends 1000000000 to the new snapp account
    const amount = UInt64.fromNumber(1000000000);
    const p = await Party.createSigned(account2);
    p.balance.subInPlace(amount);

    snappInstance = new HelloWorld(amount, snappPubkey, initSnappState);
  })
    .send()
    .wait();

  // Update the snapp
  await Mina.transaction(account1, async () => {
    // 9 = 3^2
    await snappInstance.update(new Field(9));
  })
    .send()
    .wait();

  await Mina.transaction(account1, async () => {
    // Fails, because the provided value is wrong.
    await snappInstance.update(new Field(109));
  })
    .send()
    .wait()
    .catch((e) => console.log('second update attempt failed'));

  const a = await Mina.getAccount(snappPubkey);

  console.log('final state value', a.snapp.appState[0].toString());
}

runSimpleApp();

shutdown();
