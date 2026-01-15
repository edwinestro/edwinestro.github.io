"""Chess demo: print the board for every move in the final 3 moves before checkmate.

This uses a classic miniature (Scholar's Mate) because it is:
- deterministic
- short
- ends in a clear checkmate

Run:
  ./.venv/bin/python examples/chess_last3_to_checkmate.py

Output:
- Prints move list
- Prints the board after each ply for the final 3 full moves leading to mate
"""

from __future__ import annotations

import chess


# Scholar's mate (SAN). White delivers checkmate on 4th move.
# 1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7#
MOVES_SAN = [
    "e4",
    "e5",
    "Qh5",
    "Nc6",
    "Bc4",
    "Nf6",
    "Qxf7#",
]


def print_board(board: chess.Board) -> None:
    # Human-friendly ASCII board, White at bottom.
    print(board)
    print(f"Turn: {'White' if board.turn else 'Black'}")
    if board.is_check():
        print("CHECK")
    if board.is_checkmate():
        print("CHECKMATE")


def main(last_n_full_moves: int = 3) -> None:
    board = chess.Board()

    played = []
    for san in MOVES_SAN:
        move = board.parse_san(san)
        board.push(move)
        played.append(san)

    if not board.is_checkmate():
        raise SystemExit("Demo line did not end in checkmate (unexpected).")

    # Re-play and print only the final N full moves leading to mate.
    # If mate happens on fullmove M, start printing from fullmove max(1, M-(N-1)).
    mate_fullmove = chess.Board().fullmove_number
    # compute mate fullmove by replaying to mate
    tmp = chess.Board()
    for san in MOVES_SAN:
        tmp.push(tmp.parse_san(san))
    mate_fullmove = tmp.fullmove_number

    start_fullmove = max(1, mate_fullmove - (last_n_full_moves - 1))

    print("Moves (SAN):")
    print(" ".join(f"{i+1}. {m}" if i % 2 == 0 else m for i, m in enumerate(MOVES_SAN)))
    print()
    print(f"Printing boards from full move {start_fullmove} through checkmate (last {last_n_full_moves} full moves):")
    print()

    board = chess.Board()
    ply_index = 0

    for san in MOVES_SAN:
        current_fullmove = board.fullmove_number
        side = "White" if board.turn else "Black"

        move = board.parse_san(san)
        board.push(move)
        ply_index += 1

        # After pushing, we label by the side who just moved (side variable above)
        if current_fullmove >= start_fullmove:
            prefix = f"{current_fullmove}." if side == "White" else f"{current_fullmove}..."
            print(f"{prefix} {side} plays {san}")
            print_board(board)
            print("-" * 40)


if __name__ == "__main__":
    main()
