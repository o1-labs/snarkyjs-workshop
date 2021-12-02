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
} from "@o1labs/snarkyjs";

const debug = true;

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
    this.player1 = State.init(player1);
    this.player2 = State.init(player2);
    this.nextPlayer = State.init(Field.one);
    this.won = State.init(new Bool(false));
  }

  // pass your pubkey
  // player -> 1 or 2
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

    // get player to provide deserialization of current board
    // a board is serialized as x0 + 3 * x1 + 3^2 * x2 + 3^3 * x3 + ...
    // where x0 is the first position on the board, x1 is the second, etc.
    // and the value of x_i is either 0 (empty), 1 (player 1), or 2 (player 2).
    const board = Circuit.witness(
      Circuit.array(Circuit.array(Field, 3), 3),
      () => {
        let board_bigint = BigInt(board_field.toString());
        let res = [];
        let power_of_3 = 1n;
        for (let i = 0; i < 3; i++) {
          let row = [];
          for (let j = 0; j < 3; j++) {
            const cell = (board_bigint / power_of_3) % 3n;
            power_of_3 *= 3n;
            row.push(new Field(cell.toString()));
          }
          res.push(row);
        }
        return res;
      }
    );

    // debug
    if (debug) {
      console.log("provided deserialization:");
      print_state(board);
    }

    // check that the user provided deserialization matches the state
    {
      let serialized = Field.zero;
      let power_of_3 = Field.one;
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const entry = power_of_3.mul(board[i][j]);
          power_of_3 = power_of_3.mul(3);
          serialized = serialized.add(entry);

          if (debug) {
            console.log(
              `entry ${i}, ${j}:`,
              entry.toString(),
              "and  serialized so far:",
              serialized.toString()
            );
          }
        }
      }

      serialized.assertEquals(board_field);
    }

    // update the board
    let updated_board = [
      [Field.zero, Field.zero, Field.zero],
      [Field.zero, Field.zero, Field.zero],
      [Field.zero, Field.zero, Field.zero],
    ]; // TODO: is it dangerous to do a copy of board here?
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        // is this the cell the player wants to play?
        const to_update = Circuit.if(
          x.equals(new Field(i)).and(y.equals(new Field(j))),
          new Bool(true),
          new Bool(false)
        );

        // make sure we can play there
        Circuit.if(to_update, board[i][j], Field.zero).assertEquals(Field.zero);

        // copy the board (or update if this is the cell the player wants to play)
        updated_board[i][j] = Circuit.if(to_update, player, board[i][j]);
      }
    }

    // debug
    if (debug) {
      console.log("updated board:");
      print_state(updated_board);
    }

    // check if someone won
    let won = new Bool(false);
    {
      // check rows
      for (let i = 0; i < 3; i++) {
        const played = updated_board[i][0]
          .equals(Field.one)
          .or(updated_board[i][0].equals(two));
        const row = updated_board[i][0]
          .equals(updated_board[i][1])
          .and(updated_board[i][1].equals(updated_board[i][2]));

        won = Circuit.if(row.and(played), new Bool(true), won);
      }

      // check cols
      for (let i = 0; i < 3; i++) {
        const played = updated_board[0][i]
          .equals(Field.one)
          .or(updated_board[0][i].equals(two));
        const col = updated_board[0][i]
          .equals(updated_board[1][i])
          .and(updated_board[1][i].equals(updated_board[2][i]));
        won = Circuit.if(col.and(played), new Bool(true), won);
      }

      // check diagonals
      const played = updated_board[1][1]
        .equals(Field.one)
        .or(updated_board[1][1].equals(two));
      const diag1 = updated_board[0][0]
        .equals(updated_board[1][1])
        .and(updated_board[1][1].equals(updated_board[2][2]));
      won = Circuit.if(diag1.and(played), new Bool(true), won);

      const diag2 = updated_board[0][2]
        .equals(updated_board[1][1])
        .and(updated_board[1][1].equals(updated_board[2][0]));
      won = Circuit.if(diag2.and(played), new Bool(true), won);
    }

    // debug
    if (debug) {
      console.log("did someone won?", won.toBoolean());
    }

    // update the winner
    this.won.set(won);

    // serialize the updated board
    let serialized_updated_board = Field.zero;
    let power_of_3 = Field.one;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const entry = power_of_3.mul(updated_board[i][j]);
        power_of_3 = power_of_3.mul(3);
        serialized_updated_board = serialized_updated_board.add(entry);

        if (debug) {
          console.log(
            `entry ${i}, ${j}:`,
            entry.toString(),
            "and  serialized_updated_board so far:",
            serialized_updated_board.toString()
          );
        }
      }
    }

    // update the state
    this.board.set(serialized_updated_board);
  }
}

function print_state(state: Field[][]) {
  console.log("---");
  console.log("raw state:", state.toString());
  console.log("state:");
  for (let i = 0; i < 3; i++) {
    let row = "";
    for (let j = 0; j < 3; j++) {
      row += state[i][j].toString() + " | ";
    }
    console.log(row);
  }
  console.log("---\n");
}

function print_serialized_state(state: Field) {
  console.log("---");
  console.log("raw state:", state.toString());
  console.log("state:");

  let power_of_3 = 1n;
  const board_bigint = BigInt(state.toString());

  for (let i = 0; i < 3; i++) {
    let row = "";
    for (let j = 0; j < 3; j++) {
      const cell = (board_bigint / power_of_3) % 3n;
      power_of_3 *= 3n;
      row += cell.toString() + " | ";
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
  print_serialized_state(b.snapp.appState[0]);

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
  print_serialized_state(b.snapp.appState[0]);
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
  print_serialized_state(b.snapp.appState[0]);
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
  print_serialized_state(b.snapp.appState[0]);
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
  print_serialized_state(b.snapp.appState[0]);
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
  print_serialized_state(b.snapp.appState[0]);
  console.log("did someone win?", b.snapp.appState[6].toString());

  //
  shutdown();
}

main();
