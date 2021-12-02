import {
  Field,
  State,
  PublicKey,
  SmartContract,
  state,
  method,
  PrivateKey,
  UInt64,
  Int64,
  Bool,
  Circuit,
  Mina,
  Party,
  shutdown,
  CircuitValue,
  matrixProp,
} from "@o1labs/snarkyjs";

const debug = true;
const offset = 3 * 3;
/*
class Board extends CircuitValue {
  @prop board: Bool[];

  constructor(board: Field) {
    super();
    this.board = board.toBits(9 * 2);
  }

  print_state() {
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        for (let i = 0; i < 3; i++) {
          let row = "| ";
          for (let j = 0; j < 3; j++) {
            const is_played = to_played(i, j);
            const who_played = to_player(i, j);
            let token = "_";
            if (state[is_played].toBoolean()) {
              token = state[who_played].toBoolean() ? "X" : "O";
            }

            row += token + " | ";
          }
          console.log(row);
        }
        console.log("---\n");
      }
    }
  }
}
*/

function to_player(x: number, y: number) {
  return x * 3 + y;
}

function to_played(x: number, y: number) {
  return x * 3 + y + 9;
}

class TicTacToe extends SmartContract {
  // The board is serialized as a single field element
  @state(Field) board: State<Field>;
  // player 1's public key
  @state(PublicKey) player1: State<PublicKey>;
  // player 2's public key
  @state(PublicKey) player2: State<PublicKey>;
  // 1 -> player 1 | 2 -> player 2
  @state(Field) nextPlayer: State<Field>;
  // defaults to false, set to true when a player wins
  @state(Bool) won: State<Bool>;

  constructor(
    initialBalance: UInt64,
    address: PublicKey,
    player1: PublicKey,
    player2: PublicKey
  ) {
    super(address);
    this.balance.addInPlace(initialBalance);
    this.board = State.init(Field.zero);
    this.nextPlayer = State.init(Field.one); // player 1 starts
    this.won = State.init(new Bool(false));

    // set the public key of the players
    this.player1 = State.init(player1);
    this.player2 = State.init(player2);
  }

  // board:
  //  x  0  1  2
  // y +----------
  // 0 | x  x  x
  // 1 | x  x  x
  // 2 | x  x  x
  @method async play(pubkey: PublicKey, x: Field, y: Field) {
    // TODO: ensure player controls that publickey

    // if someone already won, abort
    {
      const won = await this.won.get();
      won.assertEquals(false);
    }

    // ensure player is valid
    const player1 = await this.player1.get();
    const player2 = await this.player2.get();
    const two = new Field(2);
    const player = Circuit.witness(Field, () => {
      console.log("pubkey:", pubkey.toJSON());
      console.log("player1 pubkey:", player1.toJSON());
      console.log("player2 pubkey:", player2.toJSON());
      if (pubkey.equals(player1).toBoolean()) {
        return Field.one;
      } else if (pubkey.equals(player2).toBoolean()) {
        return two;
      } else {
        throw "invalid player";
      }
    });
    console.log("player", player.toString());
    player.equals(Field.one).or(player.equals(two)).assertEquals(true);

    const expected_pubkey = Circuit.if(
      player.equals(Field.one),
      player1,
      player2
    );
    if (debug) {
      console.log("expected pubkey:", expected_pubkey.toJSON());
      console.log("given pubkey:", pubkey.toJSON());
    }
    pubkey.assertEquals(expected_pubkey);

    // ensure its their turn
    const nextPlayer = await this.nextPlayer.get();
    nextPlayer.assertEquals(player);

    // set the next player
    const np = Circuit.if(nextPlayer.equals(Field.one), two, Field.one);
    this.nextPlayer.set(np);

    // get board
    const board_field = await this.board.get();

    // deserialize the board:
    // the first 9 bits represent the board (0 or 1 for empty or played)
    // the next 9 bits represent the player token (0 or 1 for player 1 or 2)
    let board_bits = board_field.toBits(9 * 2);
    console.log("board_bits:", board_bits);

    // update the board
    const player_token = Circuit.if(
      player.equals(Field.one),
      new Bool(false),
      new Bool(true)
    );
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const is_played = to_played(i, j);
        const who_played = to_player(i, j);

        // is this the cell the player wants to play?
        const to_update = Circuit.if(
          x.equals(new Field(i)).and(y.equals(new Field(j))),
          new Bool(true),
          new Bool(false)
        );

        // make sure we can play there
        Circuit.if(
          to_update,
          board_bits[is_played],
          new Bool(false)
        ).assertEquals(new Bool(false));

        // copy the board (or update if this is the cell the player wants to play)
        board_bits[is_played] = Circuit.if(
          to_update,
          new Bool(true),
          board_bits[is_played]
        );
        board_bits[who_played] = Circuit.if(
          to_update,
          player_token,
          board_bits[who_played]
        );
      }
    }

    // debug
    if (debug) {
      console.log("updated board:");
      print_state(board_bits);
    }

    // check if someone won
    let won = new Bool(false);
    {
      // check rows
      for (let i = 0; i < 3; i++) {
        const played = board_bits[to_played(i, 0)].equals(new Bool(true)).and(board_bits[to_played(i, 1)].equals(new Bool(true))).and(board_bits[to_played(i, 2)].equals(new Bool(true)));

        const row = board_bits[to_player(i, 0)]
          .equals(board_bits[to_player(i, 1)])
          .and(board_bits[to_player(i, 1)].equals(board_bits[to_player(i, 2)]));

        won = Circuit.if(row.and(played), new Bool(true), won);

        console.log("player:", board_bits[to_player(i, 0)].toBoolean(),  board_bits[to_player(i, 1)].toBoolean(),  board_bits[to_player(i, 2)].toBoolean());
      }

      // check cols
      for (let i = 0; i < 3; i++) {
        const played = board_bits[to_played(0, i)].equals(new Bool(true)).and(board_bits[to_played(1, i)].equals(new Bool(true))).and(board_bits[to_played(2, i)].equals(new Bool(true)));

        const row = board_bits[to_player(0, i)]
          .equals(board_bits[to_player(1, i)])
          .and(board_bits[to_player(1, i)].equals(board_bits[to_player(2, i)]));

        won = Circuit.if(row.and(played), new Bool(true), won);
      }

      // check diagonals
      const played1 = board_bits[to_played(0, 0)].equals(new Bool(true)).and(board_bits[to_played(1, 1)].equals(new Bool(true))).and(board_bits[to_played(2, 2)].equals(new Bool(true)));

      const diag1 = board_bits[to_player(0, 0)]
        .equals(board_bits[to_player(1, 1)])
        .and(board_bits[to_player(1, 1)].equals(board_bits[to_player(2, 2)]));
      won = Circuit.if(diag1.and(played1), new Bool(true), won);

      const played2 = board_bits[to_played(0, 2)].equals(new Bool(true)).and(board_bits[to_played(1, 1)].equals(new Bool(true))).and(board_bits[to_played(2, 2)].equals(new Bool(true)));
      const diag2 = board_bits[to_player(0, 2)]
        .equals(board_bits[to_player(1, 1)])
        .and(board_bits[to_player(1, 1)].equals(board_bits[to_player(2, 0)]));
      won = Circuit.if(diag2.and(played2), new Bool(true), won);

    }

    // debug
    if (debug) {
      console.log("did someone won?", won.toBoolean());
    }

    // update the winner
    this.won.set(won);

    // update the state
    const serialized_board = Field.ofBits(board_bits);
    this.board.set(serialized_board);
  }
}

function print_state(state: Bool[]) {
  console.log("---");
  //  console.log("raw state:", state);
  console.log("state:");

  for (let i = 0; i < 3; i++) {
    let row = "| ";
    for (let j = 0; j < 3; j++) {
      const is_played = to_played(i, j);
      const who_played = to_player(i, j);
      let token = "_";
      if (state[is_played].toBoolean()) {
        token = state[who_played].toBoolean() ? "X" : "O";
      }

      row += token + " | ";
    }
    console.log(row);
  }
  console.log("---\n");
}

export async function main() {
  console.log("main");
  const Local = Mina.LocalBlockchain();
  Mina.setActiveInstance(Local);

  const player1 = Local.testAccounts[0].privateKey;
  const player2 = Local.testAccounts[1].privateKey;
  console.log("got testing account");

  const snappPrivkey = PrivateKey.random();
  const snappPubkey = snappPrivkey.toPublicKey();

  // Create a new instance of the contract
  console.log("\n\n====== DEPLOYING ======\n\n");
  let snappInstance: TicTacToe;
  await Mina.transaction(player1, async () => {
    // player2 sends 1000000000 to the new snapp account
    const amount = UInt64.fromNumber(1000000000);
    const p = await Party.createSigned(player2);
    p.body.delta = Int64.fromUnsigned(amount).neg();

    snappInstance = new TicTacToe(
      amount,
      snappPubkey,
      player1.toPublicKey(),
      player2.toPublicKey()
    );
  })
    .send()
    .wait();

  // debug
  let b = await Mina.getAccount(snappPubkey);
  console.log("init state");
  for (const i in [0, 1, 2, 3, 4, 5, 6, 7]) {
    console.log("state", i, ":", b.snapp.appState[i].toString());
  }

  print_state(b.snapp.appState[0].toBits(9 * 2));

  // play
  console.log("\n\n====== FIRST MOVE ======\n\n");
  await Mina.transaction(player1, async () => {
    snappInstance.play(player1.toPublicKey(), Field.zero, Field.zero);
  })
    .send()
    .wait();

  // debug
  b = await Mina.getAccount(snappPubkey);
  console.log("after first move");
  print_state(b.snapp.appState[0].toBits(9 * 2));
  console.log("did someone win?", b.snapp.appState[6].toString());

  // play
  console.log("\n\n====== SECOND MOVE ======\n\n");
  const two = new Field(2);
  await Mina.transaction(player1, async () => {
    snappInstance
      .play(player2.toPublicKey(), Field.one, Field.zero)
      .catch((e) => console.log(e));
  })
    .send()
    .wait();

  // debug
  b = await Mina.getAccount(snappPubkey);
  console.log("after second move");
  print_state(b.snapp.appState[0].toBits(9 * 2));
  console.log("did someone win?", b.snapp.appState[6].toString());

  // play
  console.log("\n\n====== THIRD MOVE ======\n\n");
  await Mina.transaction(player1, async () => {
    snappInstance
      .play(player1.toPublicKey(), Field.one, Field.one)
      .catch((e) => console.log(e));
  })
    .send()
    .wait();

  // debug
  b = await Mina.getAccount(snappPubkey);
  console.log("after third move");
  print_state(b.snapp.appState[0].toBits(9 * 2));
  console.log("did someone win?", b.snapp.appState[6].toString());

  // play
  console.log("\n\n====== FOURTH MOVE ======\n\n");
  await Mina.transaction(player2, async () => {
    snappInstance
      .play(player2.toPublicKey(), two, Field.one)
      .catch((e) => console.log(e));
  })
    .send()
    .wait();

  // debug
  b = await Mina.getAccount(snappPubkey);
  console.log("after fourth move");
  print_state(b.snapp.appState[0].toBits(9 * 2));
  console.log("did someone win?", b.snapp.appState[6].toString());

  // play
  console.log("\n\n====== FIFTH MOVE ======\n\n");
  await Mina.transaction(player1, async () => {
    snappInstance
      .play(player1.toPublicKey(), two, two)
      .catch((e) => console.log(e));
  })
    .send()
    .wait();

  // debug
  b = await Mina.getAccount(snappPubkey);
  console.log("after fifth move");
  print_state(b.snapp.appState[0].toBits(9 * 2));
  console.log("did someone win?", b.snapp.appState[6].toString());

  //
  shutdown();
}

main();
