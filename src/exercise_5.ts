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
  Circuit,
  prop,
  Signature,
  Bool,
} from '@o1labs/snarkyjs';

// This exercise involves a user defined data type.
class SignatureWithSigner extends CircuitValue {
  @prop signature: Signature;
  @prop signer: PublicKey;

  constructor(signature: Signature, signer: PublicKey) {
    super();
    this.signature = signature;
    this.signer = signer;
  }

  static create(signer: PrivateKey, message: Field[]): SignatureWithSigner {
    return new SignatureWithSigner(
      Signature.create(signer, message),
      signer.toPublicKey()
    );
  }
}

function containsPublicKey(xs: Array<PublicKey>, x: PublicKey): Bool {
  return xs.map((y) => x.equals(y)).reduce(Bool.or);
}

/**
 * TypeScript's type system is very powerful, and can enable us to
 * write a generic version of the [containsPublicKey] function
 */
interface Eq {
  equals(y: this): Bool;
}

function containsGeneric<T extends Eq>(xs: Array<T>, x: T): Bool {
  return xs.map((y) => x.equals(y)).reduce(Bool.or);
}

// This implements a snapp account that can be used if a user has
// any of a list of public keys. The list of public keys is also
// secret.
class Exercise5 extends SmartContract {
  // This is not a state variable but a contract parameter
  owners: Array<PublicKey>;

  // No state this time

  constructor(
    initialBalance: UInt64,
    address: PublicKey,
    owners: Array<PublicKey>
  ) {
    super(address);
    this.owners = owners;
    this.balance.addInPlace(initialBalance);
  }

  // Spend requires a signature with one of the keys in the list
  @method async spend(amount: UInt64, s: SignatureWithSigner) {
    // Check that some owner is equal to the signer
    containsPublicKey(this.owners, s.signer).assertEquals(true);

    // Check that the signature verifies against the message which is
    // the current account nonce
    const nonce: UInt32 = await this.nonce;
    // Verify the signature
    s.signature.verify(s.signer, nonce.toFields()).assertEquals(true);

    // Allow the sender of this transaction to decrease the balance.
    this.balance.subInPlace(amount);
  }
}

export async function run() {
  // Set up some keypairs for the account
  const privateKeys: Array<PrivateKey> = [];
  const publicKeys: Array<PublicKey> = [];
  for (let i = 0; i < 10; ++i) {
    let k = PrivateKey.random();
    privateKeys.push(k);
    publicKeys.push(k.toPublicKey());
  }

  const Local = Mina.LocalBlockchain();
  Mina.setActiveInstance(Local);
  const account1 = Local.testAccounts[0].privateKey;
  const account2 = Local.testAccounts[1].privateKey;

  const snappPrivkey = PrivateKey.random();
  const snappPubkey = snappPrivkey.toPublicKey();

  let snappInstance: Exercise5;

  // Deploys the snapp
  await Mina.transaction(account1, async () => {
    // account2 sends 1000000000 to the new snapp account
    const amount = UInt64.fromNumber(1000000000);
    const p = await Party.createSigned(account2);
    p.balance.subInPlace(amount);

    snappInstance = new Exercise5(amount, snappPubkey, publicKeys);
  })
    .send()
    .wait();

  const { nonce: snappNonce } = await Mina.getAccount(snappPubkey);

  // Update the snapp, send to account 2
  await Mina.transaction(account1, async () => {
    const amount = UInt64.fromNumber(123);
    // Pick one of the valid senders to sign with
    const sender = privateKeys[5];

    await snappInstance.spend(
      amount,
      SignatureWithSigner.create(sender, snappNonce.toFields())
    );
    // Send it to account 2
    Party.createUnsigned(account2.toPublicKey()).balance.addInPlace(amount);
  })
    .send()
    .wait();

  const a = await Mina.getAccount(account2.toPublicKey());

  console.log('');
  console.log('Exercise 5');
  console.log('account2 balance', a.balance.toString());
}
