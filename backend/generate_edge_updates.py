"""
Generate sample edge updates from output.json for testing the edge update pipeline.
"""

import json
import random
from pathlib import Path

def generate_edge_updates(output_path: str, num_updates: int = 20, insert_only: bool = False) -> dict:
    """
    Read output.json and generate a sample edge update file.
    
    Args:
        output_path: Path to output.json
        num_updates: Number of edge updates to generate
    
    Returns:
        Dictionary with updates array
    """
    with open(output_path, 'r') as f:
        output = json.load(f)
    
    # Get initial graph info
    initial_graph = output['graphs']['initial']
    nodes = [n['id'] for n in initial_graph['nodes']]
    existing_edges = set()
    
    # Build set of existing edges
    for edge in initial_graph['edges']:
        u, v = edge['source'], edge['target']
        # Store as sorted tuple for undirected graph
        existing_edges.add((min(u, v), max(u, v)))
    
    print(f"Graph has {len(nodes)} nodes and {len(existing_edges)} edges")
    
    updates = []
    
    # Generate a mix of insertions and deletions (or insert-only when requested)
    if insert_only:
        num_inserts = num_updates
        num_deletes = 0
    else:
        num_inserts = num_updates // 2
        num_deletes = num_updates - num_inserts
    
    # Generate INSERT updates (edges that don't exist)
    insert_count = 0
    attempts = 0
    while insert_count < num_inserts and attempts < 1000:
        u = random.choice(nodes)
        v = random.choice(nodes)
        if u != v:
            edge_key = (min(u, v), max(u, v))
            if edge_key not in existing_edges:
                updates.append({
                    "type": "insert",
                    "u": u,
                    "v": v
                })
                insert_count += 1
        attempts += 1
    
    # Generate DELETE updates (edges that exist)
    edge_list = list(existing_edges)
    random.shuffle(edge_list)
    for i in range(min(num_deletes, len(edge_list))):
        u, v = edge_list[i]
        updates.append({
            "type": "delete",
            "u": u,
            "v": v
        })
    
    # Shuffle to interleave inserts and deletes
    random.shuffle(updates)
    
    print(f"Generated {len(updates)} updates:")
    print(f"  - Insertions: {sum(1 for u in updates if u['type'] == 'insert')}")
    print(f"  - Deletions: {sum(1 for u in updates if u['type'] == 'delete')}")
    
    return {"updates": updates}


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Generate sample edge updates from output.json")
    parser.add_argument("input_path", type=str, help="Path to output.json file")
    parser.add_argument("--num-updates", "-n", type=int, default=100, help="Number of edge updates to generate (default: 100)")
    parser.add_argument("--insert-only", "-i", action="store_true", help="Generate only insert updates (no deletions)")
    parser.add_argument("--output", "-o", type=str, default=None, help="Output path for generated updates (default: same directory as input)")
    
    args = parser.parse_args()
    
    input_path = Path(args.input_path)
    if not input_path.exists():
        print(f"Error: Input file not found: {input_path}")
        exit(1)
    
    # Generate updates
    updates = generate_edge_updates(str(input_path), num_updates=args.num_updates, insert_only=args.insert_only)
    
    # Determine output path
    if args.output:
        output_file = Path(args.output)
    else:
        output_file = input_path.parent / "sample_edge_updates.json"
    
    # Save to file
    with open(output_file, 'w') as f:
        json.dump(updates, f, indent=2)
    
    print(f"\nSaved to: {output_file}")
    print("\nFirst 10 updates:")
    print(json.dumps({"updates": updates["updates"][:10]}, indent=2))

