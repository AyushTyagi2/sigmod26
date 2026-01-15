// Type definitions for the Poligras visualization system.

// ============================================
// Backend Output Types (Enhanced Format)
// ============================================

export interface Meta {
    dataset: string;
    algorithm: string;
    run_id: string;
    parameters: {
        counts: number;
        group_size: number;
        hidden_size1: number;
        hidden_size2: number;
        lr: number;
        dropout: number;
    };
}

export interface CorrectionBreakdown {
    positive: number;  // C+ count (edges in G, missing in summary)
    negative: number;  // C- count (edges in summary, missing in G)
}

export interface Stats {
    initial: {
        nodes: number;
        edges: number;
    };
    summary: {
        supernodes: number;
        superedges: number;
        correction_edges: number;
    };
    compression_ratio: number;
    total_reward: number;
    avg_supernode_size?: number;  // Average nodes per supernode
    correction_breakdown?: CorrectionBreakdown;
}

export interface InitialNode {
    id: number;
    degree: number;
    label?: string;  // Optional semantic label
}

export interface SummaryNode {
    id: string;
    size: number;
    label?: string;  // Optional label for display
}

export interface InitialEdge {
    source: number;
    target: number;
    weight: number;
}

export interface SummaryEdge {
    source: string;
    target: string;
    weight: number;
    density?: number;  // weight / (size_source * size_target), for edge thickness
}

export interface InitialGraph {
    directed: boolean;
    sampled: boolean;
    node_count: number;
    edge_count: number;
    nodes: InitialNode[];
    edges: InitialEdge[];
}

export interface SummaryGraph {
    directed: boolean;
    sampled: boolean;
    node_count: number;
    edge_count: number;
    correction_edge_count: number;
    nodes: SummaryNode[];
    edges: SummaryEdge[];
}

export interface PoligrasOutput {
    meta?: Meta;
    stats: Stats;
    graphs: {
        initial: InitialGraph;
        summary: SummaryGraph;
    };
    timeline?: MergeAction[];  // Timeline of merge operations
}

// ============================================
// Action Timeline Types (for step-by-step visualization)
// ============================================

export interface ActionStats {
    step_index: number;
    reward: number;
    summarisation_ratio: number;
    node_count: number;
    // Number of edges at this step. After backend changes, this represents
    // the number of "superedges" (compressed edges) at the snapshot.
    edge_count: number;
    supernode_count: number;
    avg_degree: number;
}

export interface MergeAction {
    n1: string;  // First node being merged
    n2: string;  // Second node being merged
    stats: ActionStats;
}

// ============================================
// Frontend/UI Types
// ============================================

export interface DatasetManifest {
    id: string;
    name: string;
    nodeCount: number;
    edgeCount: number;
    filePath: string;
}

// Legacy step-based types (for animation mode)
export interface GraphNode {
    id: string;
    label: string;
    vertex_count: number;
    is_new_merge: boolean;
}

export interface GraphEdge {
    source: string;
    target: string;
    weight: number;
    density: number;
}

export interface Corrections {
    positive: [string, string][];
    negative: [string, string][];
}

export interface ActionMetadata {
    merged_pair: [string, string];
    reward: number;
}

export interface GraphStep {
    step_id: number;
    nodes: GraphNode[];
    edges: GraphEdge[];
    corrections: Corrections;
    action_metadata: ActionMetadata;
}
