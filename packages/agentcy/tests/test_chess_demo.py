import chess


def test_scholars_mate_line_ends_in_checkmate():
    moves_san = [
        "e4",
        "e5",
        "Qh5",
        "Nc6",
        "Bc4",
        "Nf6",
        "Qxf7#",
    ]
    board = chess.Board()
    for san in moves_san:
        board.push(board.parse_san(san))
    assert board.is_checkmate()
