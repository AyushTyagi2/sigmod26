# 🌐 Fully Dynamic Graph Summarization
> A powerful, user-friendly tool for summarizing massive dynamic graphs without starting from scratch on every update.

## 🚀 What is This?

Imagine trying to store and analyze Facebook's friend network or Twitter's follow graph—billions of nodes and edges that change every second. Traditional approaches either can't handle the scale or need to rebuild everything when a single edge changes. **That's where we come in.**

This tool provides **fully dynamic graph summarization**, meaning you can:
- Compress massive graphs into compact, meaningful summaries
- Handle edge additions and deletions in near-constant time
- Preserve essential structural properties while dramatically reducing size
- Visualize and interact with your graphs through an intuitive interface

## ✨ Key Features

- **🔄 Dynamic Updates**: Efficiently handles edge insertions and deletions without recomputing the entire summary
- **🧠 Hybrid Intelligence**: Combines lightweight numerical techniques with neural networks for optimal performance
- **📊 Interactive Visualization**: User-friendly interface to explore, update, and analyze large-scale graphs
- **⚡ High Performance**: Processes updates in near-constant time, making it suitable for real-world streaming graphs
- **💾 Space Efficient**: Dramatically reduces storage requirements while maintaining graph properties
- **🎯 No Setup Hassle**: Pre-configured environment eliminates dependency headaches

## 🎯 Use Cases

This tool is perfect for:

- **Social Network Analysis**: Compress billion-scale friendship or follower networks
- **Citation Networks**: Analyze academic paper relationships efficiently
- **Biological Networks**: Study protein interactions and metabolic pathways
- **Infrastructure Monitoring**: Track evolving network topologies
- **Knowledge Graphs**: Maintain compact representations of interconnected data

## 🏗️ How It Works

Our approach extends the PoliGraSS methodology with a three-step iterative process:

### 1️⃣ Group Partitioning
Uses **min-hashing** to group structurally similar nodes based on their neighborhoods.

### 2️⃣ Supernode Selection
Deploys a **shallow neural network** to intelligently merge nodes while preserving graph properties.

### 3️⃣ Edge Encoding
Efficiently updates superedges and maintains correction edges for perfect reconstruction.

### Dynamic Updates
When edges are added or removed, the algorithm updates only the affected parts of the summary—**no full recomputation needed!**

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/AyushTyagi2/sigmod26.git
cd sigmod26

# Install dependencies
pip install -r requirements.txt
```

## 🎮 Quick Start

### Basic Usage

```python
import networkx as nx
from graph_summarizer import DynamicGraphSummarizer

# Load your graph
G = nx.read_edgelist("your_graph.txt")

# Initialize summarizer
summarizer = DynamicGraphSummarizer(
    counts=100,           # Max iterations
    group_size=50,        # Max group size
    hidden_size=64,       # Neural network hidden dimensions
    lr=0.01,             # Learning rate
    dropout=0.1,         # Dropout rate
    weight_decay=0.0001  # Weight decay
)

# Create initial summary
summary, corrections = summarizer.summarize(G)

# Dynamic updates
summarizer.add_edge(u, v)      # Add edge
summarizer.remove_edge(u, v)   # Remove edge

# Export results
summary.save("summary_graph.nx")
corrections.save("correction_edges.nx")
```

### Using the Interactive Tool

1. **Upload Your Dataset**: Load your graph in NetworkX format
2. **Configure Parameters**: Set hyperparameters for your specific use case
3. **Visualize**: Watch the summarization process in real-time
4. **Update Dynamically**: Add/remove edges and see instant updates
5. **Export**: Download your summary and correction edges

## 🎛️ Hyperparameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `counts` | Maximum iterations for summarization | 100 |
| `group_size` | Maximum size of each node group | 50 |
| `hidden_size` | Neural network hidden dimensions | 64 |
| `lr` | Learning rate | 0.01 |
| `dropout` | Dropout rate for regularization | 0.1 |
| `weight_decay` | Weight decay for optimizer | 0.0001 |
| `bad_counter` | Early stopping tolerance | 10 |

## 📊 Performance

Our method achieves:
- **Near-constant time** edge updates
- **Up to 90%** reduction in graph size
- **Preserved structural properties** for downstream tasks
- **Real-time processing** for streaming graphs

## 🔬 Research

This work is based on research presented at SIGMOD 2026. For technical details, please refer to our paper:

**Fully Dynamic Graph Summarization**  
Nitin Kumar, Ayush Tyagi, Harsh Rai, Parth Kulkarni, and Manish Kumar  
*Indian Institute of Technology, Ropar*

## 🤝 Contributing

We welcome contributions! Whether it's:
- 🐛 Bug reports
- 💡 Feature requests
- 📝 Documentation improvements
- 🔧 Code contributions

Please feel free to open an issue or submit a pull request.

## 📧 Contact

For questions, suggestions, or collaborations:

- **Ayush Tyagi**: 2023csb1108@iitrpr.ac.in
- **Nitin Kumar**: 2023csb1141@iitrpr.ac.in
- **Harsh Rai**: 2023csb1345@iitrpr.ac.in
- **Parth Kulkarni**: 2023csb1142@iitrpr.ac.in
- **Dr. Manish Kumar**: manishk@iitrpr.ac.in

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built upon the PoliGraSS methodology by Bai & Zhao (2024)
- Developed at the Indian Institute of Technology, Ropar
- Thanks to the graph mining and neural network communities

---

**⭐ If you find this tool useful, please star the repository!**

Made with ❤️ at IIT Ropar
