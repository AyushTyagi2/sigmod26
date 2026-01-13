import os
import torch
import pickle

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def feature_generator(folder_name, interval_size=1000):
    graph_path = os.path.join(
        BASE_DIR,
        "dataset",
        folder_name,
        f"{folder_name}_graph"
    )

    if not os.path.exists(graph_path):
        raise FileNotFoundError(f"Graph file not found: {graph_path}")

    with open(graph_path, "rb") as g_file:
        loaded_graph = pickle.load(g_file)

    g = loaded_graph["G"]

    num_node = g.number_of_nodes()
    print("# nodes:", num_node)
    print("# edges:", g.number_of_edges())

    node_dict = {nd: idx for idx, nd in enumerate(g.nodes())}
    feat_size = num_node // interval_size + 1

    feat_list = []
    for nd in g.nodes():
        curr_feat = [0.0] * feat_size
        for nei in g[nd]:
            curr_feat[node_dict[nei] // interval_size] += 1.0
        feat_list.append(curr_feat)

    node_feat = torch.FloatTensor(feat_list)

    out_path = os.path.join(
        BASE_DIR,
        "dataset",
        folder_name,
        f"{folder_name}_feat"
    )

    with open(out_path, "wb") as f:
        pickle.dump({"feat": node_feat}, f)

    print("Saved features to:", out_path)
    return node_feat