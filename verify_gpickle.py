"""Utility script to parse and verify NetworkX gpickle graph files."""

import networkx as nx
import pickle
import sys
from pathlib import Path


def verify_gpickle(file_path: str) -> None:
    """Load a gpickle file and print graph statistics.
    
    Args:
        file_path: Path to the .gpickle file
        
    Raises:
        FileNotFoundError: If the file doesn't exist
        Exception: If the file is not a valid NetworkX graph
    """
    gpickle_path = Path(file_path)
    
    if not gpickle_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")
    
    if not gpickle_path.suffix in ['.gpickle', '.pickle', '']:
        print(f"Warning: File extension is '{gpickle_path.suffix}', expected '.gpickle'")
    
    try:
        # Load the graph from gpickle using pickle
        with open(file_path, 'rb') as f:
            data = pickle.load(f)
        
        # Handle different formats
        graph = None
        format_type = "NetworkX Graph"
        
        if isinstance(data, dict) and 'G' in data:
            # Poligras input format: {'G': NetworkX graph}
            graph = data['G']
            format_type = "Poligras Input ({{G: graph}})"
            print(f"\nDetected format: {format_type}")
            print(f"Dictionary keys: {list(data.keys())}")
        elif isinstance(data, dict) and 'superNodes_dict' in data:
            # This is a Poligras summary dictionary, not a graph
            print(f"\n{'='*60}")
            print(f"Poligras Summary: {gpickle_path.name}")
            print(f"{'='*60}")
            print(f"Detected format: Poligras Summary Output")
            print(f"Dictionary keys: {list(data.keys())}")
            print(f"\nSuperNodes: {len(data.get('superNodes_dict', {}))}")
            print(f"SuperEdges: {len(data.get('superEdge_list', []))}")
            print(f"Self-loop edges: {len(data.get('self_edge_list', []))}")
            print(f"Corrections (+): {len(data.get('correctionSet_plus_list', []))}")
            print(f"Corrections (-): {len(data.get('correctionSet_minus_list', []))}")
            
            # Show sample supernode info
            superNodes_dict = data.get('superNodes_dict', {})
            if superNodes_dict:
                sample_keys = list(superNodes_dict.keys())[:5]
                print(f"\nSample supernodes (first 5):")
                for key in sample_keys:
                    members = superNodes_dict[key]
                    print(f"  {key}: {len(members)} members")
            
            print(f"{'='*60}\n")
            return True
        elif isinstance(data, dict):
            print(f"Dictionary keys: {list(data.keys())}")
            print("Unknown dictionary format - expected 'G' or 'superNodes_dict' key")
            return False
        else:
            graph = data
            format_type = "Raw NetworkX Graph"
        
        # Extract statistics for NetworkX graph
        num_nodes = graph.number_of_nodes()
        num_edges = graph.number_of_edges()
        is_directed = nx.is_directed(graph)
        density = nx.density(graph)
        
        print(f"\n{'='*60}")
        print(f"Graph Statistics: {gpickle_path.name}")
        print(f"{'='*60}")
        print(f"Number of Nodes:    {num_nodes}")
        print(f"Number of Edges:    {num_edges}")
        print(f"Directed:           {is_directed}")
        print(f"Density:            {density:.6f}")
        
        # Additional info
        if num_nodes > 0:
            avg_degree = 2 * num_edges / num_nodes if not is_directed else num_edges / num_nodes
            print(f"Average Degree:     {avg_degree:.2f}")
        
        if nx.is_connected(graph) if not is_directed else nx.is_strongly_connected(graph):
            print(f"Connected:          Yes")
        else:
            num_components = nx.number_connected_components(graph) if not is_directed else nx.number_strongly_connected_components(graph)
            print(f"Connected:          No ({num_components} components)")
        
        print(f"{'='*60}\n")
        
        return True
        
    except Exception as e:
        print(f"Error reading gpickle file: {type(e).__name__}: {e}")
        raise


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python verify_gpickle.py <path_to_gpickle_file>")
        print("\nExample:")
        print("  python verify_gpickle.py graph.gpickle")
        sys.exit(1)
    
    file_path = sys.argv[1]
    verify_gpickle(file_path)
