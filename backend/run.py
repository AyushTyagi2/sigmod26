import argparse
from model import PoligrasRunner


def run_poligras(args):
    """
    Core execution logic (CLI + API safe)
    """
    executer = PoligrasRunner(args)
    executer.fit()
    executer.encode()

    # We will extract artifacts AFTER encode()
    return executer


def parse_args():
    parser = argparse.ArgumentParser(description="Run Poligras.")
    parser.add_argument("--dataset", nargs="?", default="in-2004", help="Dataset name")
    parser.add_argument("--counts", type=int, default=100)
    parser.add_argument("--group_size", type=int, default=200)
    parser.add_argument("--hidden_size1", type=int, default=64)
    parser.add_argument("--hidden_size2", type=int, default=32)
    parser.add_argument("--lr", type=float, default=0.001)
    parser.add_argument("--dropout", type=float, default=0.0)
    parser.add_argument("--weight-decay", type=float, default=0.0)
    parser.add_argument("--bad_counter", type=int, default=0)
    return parser.parse_args()


def main():
    args = parse_args()
    run_poligras(args)


if __name__ == "__main__":
    main()
