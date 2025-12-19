// Mock data for development/demo purposes - Extended version
import {
    PoligrasOutput,
    DatasetManifest,
    GraphStep,
} from "@/types";

export const MOCK_DATASETS: DatasetManifest[] = [
    {
        id: "astro-ph",
        name: "Astrophysics Collaboration",
        nodeCount: 18772,
        edgeCount: 198110,
        filePath: "/data/astro-ph/output.json",
    },
    {
        id: "cnr-2000",
        name: "CNR-2000 Web Graph",
        nodeCount: 325557,
        edgeCount: 2738969,
        filePath: "/data/cnr-2000/output.json",
    },
];

// Mock PoligrasOutput matching the enhanced backend format
export const MOCK_POLIGRAS_OUTPUT: PoligrasOutput = {
    meta: {
        dataset: "astro-ph",
        algorithm: "Poligras",
        run_id: "2025-01-12T10:32:41Z",
        parameters: {
            counts: 100,
            group_size: 200,
            hidden_size1: 64,
            hidden_size2: 32,
            lr: 0.001,
            dropout: 0.0,
        },
    },
    stats: {
        initial: {
            nodes: 18772,
            edges: 198110,
        },
        summary: {
            supernodes: 421,
            superedges: 119535,
            correction_edges: 31817,
        },
        compression_ratio: 0.62,
        total_reward: 46698,
        avg_supernode_size: 44.6,
        correction_breakdown: {
            positive: 12000,
            negative: 19817,
        },
    },
    graphs: {
        initial: {
            directed: false,
            sampled: true,
            node_count: 20,
            edge_count: 35,
            nodes: [
                { id: 0, degree: 5, label: "Author_0" },
                { id: 1, degree: 4, label: "Author_1" },
                { id: 2, degree: 6, label: "Author_2" },
                { id: 3, degree: 3 },
                { id: 4, degree: 4 },
                { id: 5, degree: 5 },
                { id: 6, degree: 3 },
                { id: 7, degree: 4 },
                { id: 8, degree: 2 },
                { id: 9, degree: 4 },
                { id: 10, degree: 3 },
                { id: 11, degree: 5 },
                { id: 12, degree: 2 },
                { id: 13, degree: 4 },
                { id: 14, degree: 3 },
                { id: 15, degree: 4 },
                { id: 16, degree: 2 },
                { id: 17, degree: 3 },
                { id: 18, degree: 4 },
                { id: 19, degree: 3 },
            ],
            edges: [
                { source: 0, target: 1, weight: 1 },
                { source: 0, target: 2, weight: 1 },
                { source: 0, target: 5, weight: 1 },
                { source: 0, target: 9, weight: 1 },
                { source: 0, target: 11, weight: 1 },
                { source: 1, target: 2, weight: 1 },
                { source: 1, target: 3, weight: 1 },
                { source: 1, target: 4, weight: 1 },
                { source: 2, target: 3, weight: 1 },
                { source: 2, target: 5, weight: 1 },
                { source: 2, target: 6, weight: 1 },
                { source: 2, target: 7, weight: 1 },
                { source: 3, target: 4, weight: 1 },
                { source: 4, target: 5, weight: 1 },
                { source: 4, target: 7, weight: 1 },
                { source: 5, target: 6, weight: 1 },
                { source: 5, target: 8, weight: 1 },
                { source: 6, target: 7, weight: 1 },
                { source: 7, target: 8, weight: 1 },
                { source: 9, target: 10, weight: 1 },
                { source: 9, target: 11, weight: 1 },
                { source: 9, target: 13, weight: 1 },
                { source: 10, target: 11, weight: 1 },
                { source: 10, target: 12, weight: 1 },
                { source: 11, target: 12, weight: 1 },
                { source: 11, target: 13, weight: 1 },
                { source: 13, target: 14, weight: 1 },
                { source: 13, target: 15, weight: 1 },
                { source: 14, target: 15, weight: 1 },
                { source: 14, target: 16, weight: 1 },
                { source: 15, target: 17, weight: 1 },
                { source: 15, target: 18, weight: 1 },
                { source: 17, target: 18, weight: 1 },
                { source: 17, target: 19, weight: 1 },
                { source: 18, target: 19, weight: 1 },
            ],
        },
        summary: {
            directed: false,
            sampled: false,
            node_count: 5,
            edge_count: 7,
            nodes: [
                { id: "S0", size: 4 },
                { id: "S1", size: 5 },
                { id: "S2", size: 3 },
                { id: "S3", size: 4 },
                { id: "S4", size: 4 },
            ],
            edges: [
                { source: "S0", target: "S1", weight: 8, density: 0.4 },
                { source: "S0", target: "S2", weight: 3, density: 0.25 },
                { source: "S1", target: "S2", weight: 5, density: 0.33 },
                { source: "S2", target: "S3", weight: 4, density: 0.33 },
                { source: "S3", target: "S4", weight: 6, density: 0.375 },
                { source: "S0", target: "S3", weight: 2, density: 0.125 },
                { source: "S1", target: "S4", weight: 3, density: 0.15 },
            ],
        },
    },
};

// Extended step-based mock data for longer demo playback
function generateExtendedMockSteps(): GraphStep[] {
    const steps: GraphStep[] = [];

    // Initial nodes (16 nodes for a good demo)
    const initialNodes = [
        { id: "n0", label: "0", vertex_count: 1, is_new_merge: false },
        { id: "n1", label: "1", vertex_count: 1, is_new_merge: false },
        { id: "n2", label: "2", vertex_count: 1, is_new_merge: false },
        { id: "n3", label: "3", vertex_count: 1, is_new_merge: false },
        { id: "n4", label: "4", vertex_count: 1, is_new_merge: false },
        { id: "n5", label: "5", vertex_count: 1, is_new_merge: false },
        { id: "n6", label: "6", vertex_count: 1, is_new_merge: false },
        { id: "n7", label: "7", vertex_count: 1, is_new_merge: false },
        { id: "n8", label: "8", vertex_count: 1, is_new_merge: false },
        { id: "n9", label: "9", vertex_count: 1, is_new_merge: false },
        { id: "n10", label: "10", vertex_count: 1, is_new_merge: false },
        { id: "n11", label: "11", vertex_count: 1, is_new_merge: false },
        { id: "n12", label: "12", vertex_count: 1, is_new_merge: false },
        { id: "n13", label: "13", vertex_count: 1, is_new_merge: false },
        { id: "n14", label: "14", vertex_count: 1, is_new_merge: false },
        { id: "n15", label: "15", vertex_count: 1, is_new_merge: false },
    ];

    const initialEdges = [
        // Cluster 1: n0-n3
        { source: "n0", target: "n1", weight: 1, density: 1.0 },
        { source: "n0", target: "n2", weight: 1, density: 1.0 },
        { source: "n1", target: "n2", weight: 1, density: 1.0 },
        { source: "n1", target: "n3", weight: 1, density: 1.0 },
        { source: "n2", target: "n3", weight: 1, density: 1.0 },
        // Cluster 2: n4-n7
        { source: "n4", target: "n5", weight: 1, density: 1.0 },
        { source: "n4", target: "n6", weight: 1, density: 1.0 },
        { source: "n5", target: "n6", weight: 1, density: 1.0 },
        { source: "n5", target: "n7", weight: 1, density: 1.0 },
        { source: "n6", target: "n7", weight: 1, density: 1.0 },
        // Cluster 3: n8-n11
        { source: "n8", target: "n9", weight: 1, density: 1.0 },
        { source: "n8", target: "n10", weight: 1, density: 1.0 },
        { source: "n9", target: "n10", weight: 1, density: 1.0 },
        { source: "n9", target: "n11", weight: 1, density: 1.0 },
        { source: "n10", target: "n11", weight: 1, density: 1.0 },
        // Cluster 4: n12-n15
        { source: "n12", target: "n13", weight: 1, density: 1.0 },
        { source: "n12", target: "n14", weight: 1, density: 1.0 },
        { source: "n13", target: "n14", weight: 1, density: 1.0 },
        { source: "n13", target: "n15", weight: 1, density: 1.0 },
        { source: "n14", target: "n15", weight: 1, density: 1.0 },
        // Inter-cluster edges
        { source: "n3", target: "n4", weight: 1, density: 1.0 },
        { source: "n7", target: "n8", weight: 1, density: 1.0 },
        { source: "n11", target: "n12", weight: 1, density: 1.0 },
        { source: "n0", target: "n15", weight: 1, density: 1.0 },
    ];

    // Step 0: Initial state
    steps.push({
        step_id: 0,
        nodes: [...initialNodes],
        edges: [...initialEdges],
        corrections: { positive: [], negative: [] },
        action_metadata: { merged_pair: ["", ""], reward: 0 },
    });

    // Step 1: Merge n0 and n1 -> S0
    steps.push({
        step_id: 1,
        nodes: [
            { id: "S0", label: "S0", vertex_count: 2, is_new_merge: true },
            { id: "n2", label: "2", vertex_count: 1, is_new_merge: false },
            { id: "n3", label: "3", vertex_count: 1, is_new_merge: false },
            { id: "n4", label: "4", vertex_count: 1, is_new_merge: false },
            { id: "n5", label: "5", vertex_count: 1, is_new_merge: false },
            { id: "n6", label: "6", vertex_count: 1, is_new_merge: false },
            { id: "n7", label: "7", vertex_count: 1, is_new_merge: false },
            { id: "n8", label: "8", vertex_count: 1, is_new_merge: false },
            { id: "n9", label: "9", vertex_count: 1, is_new_merge: false },
            { id: "n10", label: "10", vertex_count: 1, is_new_merge: false },
            { id: "n11", label: "11", vertex_count: 1, is_new_merge: false },
            { id: "n12", label: "12", vertex_count: 1, is_new_merge: false },
            { id: "n13", label: "13", vertex_count: 1, is_new_merge: false },
            { id: "n14", label: "14", vertex_count: 1, is_new_merge: false },
            { id: "n15", label: "15", vertex_count: 1, is_new_merge: false },
        ],
        edges: [
            { source: "S0", target: "n2", weight: 2, density: 1.0 },
            { source: "n2", target: "n3", weight: 1, density: 1.0 },
            { source: "S0", target: "n15", weight: 1, density: 0.5 },
            { source: "n4", target: "n5", weight: 1, density: 1.0 },
            { source: "n4", target: "n6", weight: 1, density: 1.0 },
            { source: "n5", target: "n6", weight: 1, density: 1.0 },
            { source: "n5", target: "n7", weight: 1, density: 1.0 },
            { source: "n6", target: "n7", weight: 1, density: 1.0 },
            { source: "n8", target: "n9", weight: 1, density: 1.0 },
            { source: "n8", target: "n10", weight: 1, density: 1.0 },
            { source: "n9", target: "n10", weight: 1, density: 1.0 },
            { source: "n9", target: "n11", weight: 1, density: 1.0 },
            { source: "n10", target: "n11", weight: 1, density: 1.0 },
            { source: "n12", target: "n13", weight: 1, density: 1.0 },
            { source: "n12", target: "n14", weight: 1, density: 1.0 },
            { source: "n13", target: "n14", weight: 1, density: 1.0 },
            { source: "n13", target: "n15", weight: 1, density: 1.0 },
            { source: "n14", target: "n15", weight: 1, density: 1.0 },
            { source: "n3", target: "n4", weight: 1, density: 1.0 },
            { source: "n7", target: "n8", weight: 1, density: 1.0 },
            { source: "n11", target: "n12", weight: 1, density: 1.0 },
        ],
        corrections: { positive: [["S0", "n3"]], negative: [] },
        action_metadata: { merged_pair: ["n0", "n1"], reward: 3 },
    });

    // Step 2: Merge S0 and n2 -> S0 (grows to 3)
    steps.push({
        step_id: 2,
        nodes: [
            { id: "S0", label: "S0", vertex_count: 3, is_new_merge: true },
            { id: "n3", label: "3", vertex_count: 1, is_new_merge: false },
            { id: "n4", label: "4", vertex_count: 1, is_new_merge: false },
            { id: "n5", label: "5", vertex_count: 1, is_new_merge: false },
            { id: "n6", label: "6", vertex_count: 1, is_new_merge: false },
            { id: "n7", label: "7", vertex_count: 1, is_new_merge: false },
            { id: "n8", label: "8", vertex_count: 1, is_new_merge: false },
            { id: "n9", label: "9", vertex_count: 1, is_new_merge: false },
            { id: "n10", label: "10", vertex_count: 1, is_new_merge: false },
            { id: "n11", label: "11", vertex_count: 1, is_new_merge: false },
            { id: "n12", label: "12", vertex_count: 1, is_new_merge: false },
            { id: "n13", label: "13", vertex_count: 1, is_new_merge: false },
            { id: "n14", label: "14", vertex_count: 1, is_new_merge: false },
            { id: "n15", label: "15", vertex_count: 1, is_new_merge: false },
        ],
        edges: [
            { source: "S0", target: "n3", weight: 2, density: 0.67 },
            { source: "S0", target: "n15", weight: 1, density: 0.33 },
            { source: "n4", target: "n5", weight: 1, density: 1.0 },
            { source: "n4", target: "n6", weight: 1, density: 1.0 },
            { source: "n5", target: "n6", weight: 1, density: 1.0 },
            { source: "n5", target: "n7", weight: 1, density: 1.0 },
            { source: "n6", target: "n7", weight: 1, density: 1.0 },
            { source: "n8", target: "n9", weight: 1, density: 1.0 },
            { source: "n8", target: "n10", weight: 1, density: 1.0 },
            { source: "n9", target: "n10", weight: 1, density: 1.0 },
            { source: "n9", target: "n11", weight: 1, density: 1.0 },
            { source: "n10", target: "n11", weight: 1, density: 1.0 },
            { source: "n12", target: "n13", weight: 1, density: 1.0 },
            { source: "n12", target: "n14", weight: 1, density: 1.0 },
            { source: "n13", target: "n14", weight: 1, density: 1.0 },
            { source: "n13", target: "n15", weight: 1, density: 1.0 },
            { source: "n14", target: "n15", weight: 1, density: 1.0 },
            { source: "n3", target: "n4", weight: 1, density: 1.0 },
            { source: "n7", target: "n8", weight: 1, density: 1.0 },
            { source: "n11", target: "n12", weight: 1, density: 1.0 },
        ],
        corrections: { positive: [["S0", "n4"]], negative: [["S0", "n3"]] },
        action_metadata: { merged_pair: ["S0", "n2"], reward: 4 },
    });

    // Step 3: Merge n4 and n5 -> S1
    steps.push({
        step_id: 3,
        nodes: [
            { id: "S0", label: "S0", vertex_count: 3, is_new_merge: false },
            { id: "n3", label: "3", vertex_count: 1, is_new_merge: false },
            { id: "S1", label: "S1", vertex_count: 2, is_new_merge: true },
            { id: "n6", label: "6", vertex_count: 1, is_new_merge: false },
            { id: "n7", label: "7", vertex_count: 1, is_new_merge: false },
            { id: "n8", label: "8", vertex_count: 1, is_new_merge: false },
            { id: "n9", label: "9", vertex_count: 1, is_new_merge: false },
            { id: "n10", label: "10", vertex_count: 1, is_new_merge: false },
            { id: "n11", label: "11", vertex_count: 1, is_new_merge: false },
            { id: "n12", label: "12", vertex_count: 1, is_new_merge: false },
            { id: "n13", label: "13", vertex_count: 1, is_new_merge: false },
            { id: "n14", label: "14", vertex_count: 1, is_new_merge: false },
            { id: "n15", label: "15", vertex_count: 1, is_new_merge: false },
        ],
        edges: [
            { source: "S0", target: "n3", weight: 2, density: 0.67 },
            { source: "S0", target: "n15", weight: 1, density: 0.33 },
            { source: "S1", target: "n6", weight: 2, density: 1.0 },
            { source: "S1", target: "n7", weight: 1, density: 0.5 },
            { source: "n6", target: "n7", weight: 1, density: 1.0 },
            { source: "n8", target: "n9", weight: 1, density: 1.0 },
            { source: "n8", target: "n10", weight: 1, density: 1.0 },
            { source: "n9", target: "n10", weight: 1, density: 1.0 },
            { source: "n9", target: "n11", weight: 1, density: 1.0 },
            { source: "n10", target: "n11", weight: 1, density: 1.0 },
            { source: "n12", target: "n13", weight: 1, density: 1.0 },
            { source: "n12", target: "n14", weight: 1, density: 1.0 },
            { source: "n13", target: "n14", weight: 1, density: 1.0 },
            { source: "n13", target: "n15", weight: 1, density: 1.0 },
            { source: "n14", target: "n15", weight: 1, density: 1.0 },
            { source: "n3", target: "S1", weight: 1, density: 0.5 },
            { source: "n7", target: "n8", weight: 1, density: 1.0 },
            { source: "n11", target: "n12", weight: 1, density: 1.0 },
        ],
        corrections: { positive: [["S0", "n6"]], negative: [["S1", "n3"]] },
        action_metadata: { merged_pair: ["n4", "n5"], reward: 3 },
    });

    // Step 4: Merge S0 and n3 -> S0 (grows to 4)
    steps.push({
        step_id: 4,
        nodes: [
            { id: "S0", label: "S0", vertex_count: 4, is_new_merge: true },
            { id: "S1", label: "S1", vertex_count: 2, is_new_merge: false },
            { id: "n6", label: "6", vertex_count: 1, is_new_merge: false },
            { id: "n7", label: "7", vertex_count: 1, is_new_merge: false },
            { id: "n8", label: "8", vertex_count: 1, is_new_merge: false },
            { id: "n9", label: "9", vertex_count: 1, is_new_merge: false },
            { id: "n10", label: "10", vertex_count: 1, is_new_merge: false },
            { id: "n11", label: "11", vertex_count: 1, is_new_merge: false },
            { id: "n12", label: "12", vertex_count: 1, is_new_merge: false },
            { id: "n13", label: "13", vertex_count: 1, is_new_merge: false },
            { id: "n14", label: "14", vertex_count: 1, is_new_merge: false },
            { id: "n15", label: "15", vertex_count: 1, is_new_merge: false },
        ],
        edges: [
            { source: "S0", target: "S1", weight: 1, density: 0.125 },
            { source: "S0", target: "n15", weight: 1, density: 0.25 },
            { source: "S1", target: "n6", weight: 2, density: 1.0 },
            { source: "S1", target: "n7", weight: 1, density: 0.5 },
            { source: "n6", target: "n7", weight: 1, density: 1.0 },
            { source: "n8", target: "n9", weight: 1, density: 1.0 },
            { source: "n8", target: "n10", weight: 1, density: 1.0 },
            { source: "n9", target: "n10", weight: 1, density: 1.0 },
            { source: "n9", target: "n11", weight: 1, density: 1.0 },
            { source: "n10", target: "n11", weight: 1, density: 1.0 },
            { source: "n12", target: "n13", weight: 1, density: 1.0 },
            { source: "n12", target: "n14", weight: 1, density: 1.0 },
            { source: "n13", target: "n14", weight: 1, density: 1.0 },
            { source: "n13", target: "n15", weight: 1, density: 1.0 },
            { source: "n14", target: "n15", weight: 1, density: 1.0 },
            { source: "n7", target: "n8", weight: 1, density: 1.0 },
            { source: "n11", target: "n12", weight: 1, density: 1.0 },
        ],
        corrections: { positive: [["S0", "n8"]], negative: [["S0", "S1"], ["S1", "n6"]] },
        action_metadata: { merged_pair: ["S0", "n3"], reward: 5 },
    });

    // Step 5: Merge S1 and n6 -> S1 (grows to 3)
    steps.push({
        step_id: 5,
        nodes: [
            { id: "S0", label: "S0", vertex_count: 4, is_new_merge: false },
            { id: "S1", label: "S1", vertex_count: 3, is_new_merge: true },
            { id: "n7", label: "7", vertex_count: 1, is_new_merge: false },
            { id: "n8", label: "8", vertex_count: 1, is_new_merge: false },
            { id: "n9", label: "9", vertex_count: 1, is_new_merge: false },
            { id: "n10", label: "10", vertex_count: 1, is_new_merge: false },
            { id: "n11", label: "11", vertex_count: 1, is_new_merge: false },
            { id: "n12", label: "12", vertex_count: 1, is_new_merge: false },
            { id: "n13", label: "13", vertex_count: 1, is_new_merge: false },
            { id: "n14", label: "14", vertex_count: 1, is_new_merge: false },
            { id: "n15", label: "15", vertex_count: 1, is_new_merge: false },
        ],
        edges: [
            { source: "S0", target: "S1", weight: 1, density: 0.083 },
            { source: "S0", target: "n15", weight: 1, density: 0.25 },
            { source: "S1", target: "n7", weight: 2, density: 0.67 },
            { source: "n8", target: "n9", weight: 1, density: 1.0 },
            { source: "n8", target: "n10", weight: 1, density: 1.0 },
            { source: "n9", target: "n10", weight: 1, density: 1.0 },
            { source: "n9", target: "n11", weight: 1, density: 1.0 },
            { source: "n10", target: "n11", weight: 1, density: 1.0 },
            { source: "n12", target: "n13", weight: 1, density: 1.0 },
            { source: "n12", target: "n14", weight: 1, density: 1.0 },
            { source: "n13", target: "n14", weight: 1, density: 1.0 },
            { source: "n13", target: "n15", weight: 1, density: 1.0 },
            { source: "n14", target: "n15", weight: 1, density: 1.0 },
            { source: "n7", target: "n8", weight: 1, density: 1.0 },
            { source: "n11", target: "n12", weight: 1, density: 1.0 },
        ],
        corrections: { positive: [["S0", "n9"]], negative: [["S0", "S1"], ["S1", "n7"]] },
        action_metadata: { merged_pair: ["S1", "n6"], reward: 4 },
    });

    // Step 6: Merge n8 and n9 -> S2
    steps.push({
        step_id: 6,
        nodes: [
            { id: "S0", label: "S0", vertex_count: 4, is_new_merge: false },
            { id: "S1", label: "S1", vertex_count: 3, is_new_merge: false },
            { id: "n7", label: "7", vertex_count: 1, is_new_merge: false },
            { id: "S2", label: "S2", vertex_count: 2, is_new_merge: true },
            { id: "n10", label: "10", vertex_count: 1, is_new_merge: false },
            { id: "n11", label: "11", vertex_count: 1, is_new_merge: false },
            { id: "n12", label: "12", vertex_count: 1, is_new_merge: false },
            { id: "n13", label: "13", vertex_count: 1, is_new_merge: false },
            { id: "n14", label: "14", vertex_count: 1, is_new_merge: false },
            { id: "n15", label: "15", vertex_count: 1, is_new_merge: false },
        ],
        edges: [
            { source: "S0", target: "S1", weight: 1, density: 0.083 },
            { source: "S0", target: "n15", weight: 1, density: 0.25 },
            { source: "S1", target: "n7", weight: 2, density: 0.67 },
            { source: "S2", target: "n10", weight: 2, density: 1.0 },
            { source: "S2", target: "n11", weight: 1, density: 0.5 },
            { source: "n10", target: "n11", weight: 1, density: 1.0 },
            { source: "n12", target: "n13", weight: 1, density: 1.0 },
            { source: "n12", target: "n14", weight: 1, density: 1.0 },
            { source: "n13", target: "n14", weight: 1, density: 1.0 },
            { source: "n13", target: "n15", weight: 1, density: 1.0 },
            { source: "n14", target: "n15", weight: 1, density: 1.0 },
            { source: "n7", target: "S2", weight: 1, density: 0.5 },
            { source: "n11", target: "n12", weight: 1, density: 1.0 },
        ],
        corrections: { positive: [["S0", "S2"]], negative: [["S1", "S2"], ["S0", "n10"]] },
        action_metadata: { merged_pair: ["n8", "n9"], reward: 3 },
    });

    // Step 7: Merge S1 and n7 -> S1 (grows to 4)
    steps.push({
        step_id: 7,
        nodes: [
            { id: "S0", label: "S0", vertex_count: 4, is_new_merge: false },
            { id: "S1", label: "S1", vertex_count: 4, is_new_merge: true },
            { id: "S2", label: "S2", vertex_count: 2, is_new_merge: false },
            { id: "n10", label: "10", vertex_count: 1, is_new_merge: false },
            { id: "n11", label: "11", vertex_count: 1, is_new_merge: false },
            { id: "n12", label: "12", vertex_count: 1, is_new_merge: false },
            { id: "n13", label: "13", vertex_count: 1, is_new_merge: false },
            { id: "n14", label: "14", vertex_count: 1, is_new_merge: false },
            { id: "n15", label: "15", vertex_count: 1, is_new_merge: false },
        ],
        edges: [
            { source: "S0", target: "S1", weight: 1, density: 0.0625 },
            { source: "S0", target: "n15", weight: 1, density: 0.25 },
            { source: "S1", target: "S2", weight: 1, density: 0.125 },
            { source: "S2", target: "n10", weight: 2, density: 1.0 },
            { source: "S2", target: "n11", weight: 1, density: 0.5 },
            { source: "n10", target: "n11", weight: 1, density: 1.0 },
            { source: "n12", target: "n13", weight: 1, density: 1.0 },
            { source: "n12", target: "n14", weight: 1, density: 1.0 },
            { source: "n13", target: "n14", weight: 1, density: 1.0 },
            { source: "n13", target: "n15", weight: 1, density: 1.0 },
            { source: "n14", target: "n15", weight: 1, density: 1.0 },
            { source: "n11", target: "n12", weight: 1, density: 1.0 },
        ],
        corrections: { positive: [["S0", "S2"], ["S1", "n10"]], negative: [["S0", "n10"]] },
        action_metadata: { merged_pair: ["S1", "n7"], reward: 4 },
    });

    // Step 8: Merge n12 and n13 -> S3
    steps.push({
        step_id: 8,
        nodes: [
            { id: "S0", label: "S0", vertex_count: 4, is_new_merge: false },
            { id: "S1", label: "S1", vertex_count: 4, is_new_merge: false },
            { id: "S2", label: "S2", vertex_count: 2, is_new_merge: false },
            { id: "n10", label: "10", vertex_count: 1, is_new_merge: false },
            { id: "n11", label: "11", vertex_count: 1, is_new_merge: false },
            { id: "S3", label: "S3", vertex_count: 2, is_new_merge: true },
            { id: "n14", label: "14", vertex_count: 1, is_new_merge: false },
            { id: "n15", label: "15", vertex_count: 1, is_new_merge: false },
        ],
        edges: [
            { source: "S0", target: "S1", weight: 1, density: 0.0625 },
            { source: "S0", target: "n15", weight: 1, density: 0.25 },
            { source: "S1", target: "S2", weight: 1, density: 0.125 },
            { source: "S2", target: "n10", weight: 2, density: 1.0 },
            { source: "S2", target: "n11", weight: 1, density: 0.5 },
            { source: "n10", target: "n11", weight: 1, density: 1.0 },
            { source: "S3", target: "n14", weight: 2, density: 1.0 },
            { source: "S3", target: "n15", weight: 1, density: 0.5 },
            { source: "n14", target: "n15", weight: 1, density: 1.0 },
            { source: "n11", target: "S3", weight: 1, density: 0.5 },
        ],
        corrections: { positive: [["S0", "S3"]], negative: [["S2", "n14"], ["S0", "n11"]] },
        action_metadata: { merged_pair: ["n12", "n13"], reward: 3 },
    });

    // Step 9: Merge S2 and n10 -> S2 (grows to 3)
    steps.push({
        step_id: 9,
        nodes: [
            { id: "S0", label: "S0", vertex_count: 4, is_new_merge: false },
            { id: "S1", label: "S1", vertex_count: 4, is_new_merge: false },
            { id: "S2", label: "S2", vertex_count: 3, is_new_merge: true },
            { id: "n11", label: "11", vertex_count: 1, is_new_merge: false },
            { id: "S3", label: "S3", vertex_count: 2, is_new_merge: false },
            { id: "n14", label: "14", vertex_count: 1, is_new_merge: false },
            { id: "n15", label: "15", vertex_count: 1, is_new_merge: false },
        ],
        edges: [
            { source: "S0", target: "S1", weight: 1, density: 0.0625 },
            { source: "S0", target: "n15", weight: 1, density: 0.25 },
            { source: "S1", target: "S2", weight: 1, density: 0.083 },
            { source: "S2", target: "n11", weight: 2, density: 0.67 },
            { source: "S3", target: "n14", weight: 2, density: 1.0 },
            { source: "S3", target: "n15", weight: 1, density: 0.5 },
            { source: "n14", target: "n15", weight: 1, density: 1.0 },
            { source: "n11", target: "S3", weight: 1, density: 0.5 },
        ],
        corrections: { positive: [["S0", "S3"], ["S1", "S3"]], negative: [["S2", "n15"]] },
        action_metadata: { merged_pair: ["S2", "n10"], reward: 4 },
    });

    // Step 10: Merge S2 and n11 -> S2 (grows to 4)
    steps.push({
        step_id: 10,
        nodes: [
            { id: "S0", label: "S0", vertex_count: 4, is_new_merge: false },
            { id: "S1", label: "S1", vertex_count: 4, is_new_merge: false },
            { id: "S2", label: "S2", vertex_count: 4, is_new_merge: true },
            { id: "S3", label: "S3", vertex_count: 2, is_new_merge: false },
            { id: "n14", label: "14", vertex_count: 1, is_new_merge: false },
            { id: "n15", label: "15", vertex_count: 1, is_new_merge: false },
        ],
        edges: [
            { source: "S0", target: "S1", weight: 1, density: 0.0625 },
            { source: "S0", target: "n15", weight: 1, density: 0.25 },
            { source: "S1", target: "S2", weight: 1, density: 0.0625 },
            { source: "S2", target: "S3", weight: 1, density: 0.125 },
            { source: "S3", target: "n14", weight: 2, density: 1.0 },
            { source: "S3", target: "n15", weight: 1, density: 0.5 },
            { source: "n14", target: "n15", weight: 1, density: 1.0 },
        ],
        corrections: { positive: [["S0", "S2"]], negative: [["S1", "S3"], ["S2", "n15"]] },
        action_metadata: { merged_pair: ["S2", "n11"], reward: 5 },
    });

    // Step 11: Final state - leave n14 and n15 as regular nodes
    steps.push({
        step_id: 11,
        nodes: [
            { id: "S0", label: "S0", vertex_count: 4, is_new_merge: false },
            { id: "S1", label: "S1", vertex_count: 4, is_new_merge: false },
            { id: "S2", label: "S2", vertex_count: 4, is_new_merge: false },
            { id: "S3", label: "S3", vertex_count: 2, is_new_merge: true },
            { id: "n14", label: "14", vertex_count: 1, is_new_merge: false },
            { id: "n15", label: "15", vertex_count: 1, is_new_merge: false },
        ],
        edges: [
            { source: "S0", target: "S1", weight: 1, density: 0.0625 },
            { source: "S0", target: "n15", weight: 1, density: 0.25 },
            { source: "S1", target: "S2", weight: 1, density: 0.0625 },
            { source: "S2", target: "S3", weight: 1, density: 0.125 },
            { source: "S3", target: "n14", weight: 2, density: 1.0 },
            { source: "S3", target: "n15", weight: 1, density: 0.5 },
            { source: "n14", target: "n15", weight: 1, density: 1.0 },
        ],
        corrections: {
            positive: [["S0", "S2"], ["S1", "S3"]],
            negative: [["S2", "n15"], ["S0", "n14"]]
        },
        action_metadata: { merged_pair: ["n12", "n13"], reward: 4 },
    });

    return steps;
}

// Second dataset: CNR-2000 - Star/Hub topology (different structure)
function generateCNRMockSteps(): GraphStep[] {
    const steps: GraphStep[] = [];

    // Hub-and-spoke topology: central nodes with peripheral connections
    const initialNodes = [
        { id: "h0", label: "Hub0", vertex_count: 1, is_new_merge: false },
        { id: "h1", label: "Hub1", vertex_count: 1, is_new_merge: false },
        { id: "p0", label: "P0", vertex_count: 1, is_new_merge: false },
        { id: "p1", label: "P1", vertex_count: 1, is_new_merge: false },
        { id: "p2", label: "P2", vertex_count: 1, is_new_merge: false },
        { id: "p3", label: "P3", vertex_count: 1, is_new_merge: false },
        { id: "p4", label: "P4", vertex_count: 1, is_new_merge: false },
        { id: "p5", label: "P5", vertex_count: 1, is_new_merge: false },
        { id: "p6", label: "P6", vertex_count: 1, is_new_merge: false },
        { id: "p7", label: "P7", vertex_count: 1, is_new_merge: false },
        { id: "p8", label: "P8", vertex_count: 1, is_new_merge: false },
        { id: "p9", label: "P9", vertex_count: 1, is_new_merge: false },
    ];

    const initialEdges = [
        // Hub0 connects to first 5 peripheral nodes
        { source: "h0", target: "p0", weight: 1, density: 1.0 },
        { source: "h0", target: "p1", weight: 1, density: 1.0 },
        { source: "h0", target: "p2", weight: 1, density: 1.0 },
        { source: "h0", target: "p3", weight: 1, density: 1.0 },
        { source: "h0", target: "p4", weight: 1, density: 1.0 },
        // Hub1 connects to last 5 peripheral nodes
        { source: "h1", target: "p5", weight: 1, density: 1.0 },
        { source: "h1", target: "p6", weight: 1, density: 1.0 },
        { source: "h1", target: "p7", weight: 1, density: 1.0 },
        { source: "h1", target: "p8", weight: 1, density: 1.0 },
        { source: "h1", target: "p9", weight: 1, density: 1.0 },
        // Hub-to-hub connection
        { source: "h0", target: "h1", weight: 1, density: 1.0 },
        // Some peripheral connections
        { source: "p0", target: "p1", weight: 1, density: 1.0 },
        { source: "p2", target: "p3", weight: 1, density: 1.0 },
        { source: "p5", target: "p6", weight: 1, density: 1.0 },
        { source: "p7", target: "p8", weight: 1, density: 1.0 },
    ];

    // Step 0: Initial
    steps.push({
        step_id: 0,
        nodes: [...initialNodes],
        edges: [...initialEdges],
        corrections: { positive: [], negative: [] },
        action_metadata: { merged_pair: ["", ""], reward: 0 },
    });

    // Step 1: Merge p0 and p1
    steps.push({
        step_id: 1,
        nodes: [
            { id: "h0", label: "Hub0", vertex_count: 1, is_new_merge: false },
            { id: "h1", label: "Hub1", vertex_count: 1, is_new_merge: false },
            { id: "S0", label: "S0", vertex_count: 2, is_new_merge: true },
            { id: "p2", label: "P2", vertex_count: 1, is_new_merge: false },
            { id: "p3", label: "P3", vertex_count: 1, is_new_merge: false },
            { id: "p4", label: "P4", vertex_count: 1, is_new_merge: false },
            { id: "p5", label: "P5", vertex_count: 1, is_new_merge: false },
            { id: "p6", label: "P6", vertex_count: 1, is_new_merge: false },
            { id: "p7", label: "P7", vertex_count: 1, is_new_merge: false },
            { id: "p8", label: "P8", vertex_count: 1, is_new_merge: false },
            { id: "p9", label: "P9", vertex_count: 1, is_new_merge: false },
        ],
        edges: [
            { source: "h0", target: "S0", weight: 2, density: 1.0 },
            { source: "h0", target: "p2", weight: 1, density: 1.0 },
            { source: "h0", target: "p3", weight: 1, density: 1.0 },
            { source: "h0", target: "p4", weight: 1, density: 1.0 },
            { source: "h1", target: "p5", weight: 1, density: 1.0 },
            { source: "h1", target: "p6", weight: 1, density: 1.0 },
            { source: "h1", target: "p7", weight: 1, density: 1.0 },
            { source: "h1", target: "p8", weight: 1, density: 1.0 },
            { source: "h1", target: "p9", weight: 1, density: 1.0 },
            { source: "h0", target: "h1", weight: 1, density: 1.0 },
            { source: "p2", target: "p3", weight: 1, density: 1.0 },
            { source: "p5", target: "p6", weight: 1, density: 1.0 },
            { source: "p7", target: "p8", weight: 1, density: 1.0 },
        ],
        corrections: { positive: [], negative: [] },
        action_metadata: { merged_pair: ["p0", "p1"], reward: 3 },
    });

    // Step 2: Merge p2 and p3
    steps.push({
        step_id: 2,
        nodes: [
            { id: "h0", label: "Hub0", vertex_count: 1, is_new_merge: false },
            { id: "h1", label: "Hub1", vertex_count: 1, is_new_merge: false },
            { id: "S0", label: "S0", vertex_count: 2, is_new_merge: false },
            { id: "S1", label: "S1", vertex_count: 2, is_new_merge: true },
            { id: "p4", label: "P4", vertex_count: 1, is_new_merge: false },
            { id: "p5", label: "P5", vertex_count: 1, is_new_merge: false },
            { id: "p6", label: "P6", vertex_count: 1, is_new_merge: false },
            { id: "p7", label: "P7", vertex_count: 1, is_new_merge: false },
            { id: "p8", label: "P8", vertex_count: 1, is_new_merge: false },
            { id: "p9", label: "P9", vertex_count: 1, is_new_merge: false },
        ],
        edges: [
            { source: "h0", target: "S0", weight: 2, density: 1.0 },
            { source: "h0", target: "S1", weight: 2, density: 1.0 },
            { source: "h0", target: "p4", weight: 1, density: 1.0 },
            { source: "h1", target: "p5", weight: 1, density: 1.0 },
            { source: "h1", target: "p6", weight: 1, density: 1.0 },
            { source: "h1", target: "p7", weight: 1, density: 1.0 },
            { source: "h1", target: "p8", weight: 1, density: 1.0 },
            { source: "h1", target: "p9", weight: 1, density: 1.0 },
            { source: "h0", target: "h1", weight: 1, density: 1.0 },
            { source: "p5", target: "p6", weight: 1, density: 1.0 },
            { source: "p7", target: "p8", weight: 1, density: 1.0 },
        ],
        corrections: { positive: [], negative: [[" S1", "p4"]] },
        action_metadata: { merged_pair: ["p2", "p3"], reward: 4 },
    });

    // Step 3: Merge p5 and p6
    steps.push({
        step_id: 3,
        nodes: [
            { id: "h0", label: "Hub0", vertex_count: 1, is_new_merge: false },
            { id: "h1", label: "Hub1", vertex_count: 1, is_new_merge: false },
            { id: "S0", label: "S0", vertex_count: 2, is_new_merge: false },
            { id: "S1", label: "S1", vertex_count: 2, is_new_merge: false },
            { id: "p4", label: "P4", vertex_count: 1, is_new_merge: false },
            { id: "S2", label: "S2", vertex_count: 2, is_new_merge: true },
            { id: "p7", label: "P7", vertex_count: 1, is_new_merge: false },
            { id: "p8", label: "P8", vertex_count: 1, is_new_merge: false },
            { id: "p9", label: "P9", vertex_count: 1, is_new_merge: false },
        ],
        edges: [
            { source: "h0", target: "S0", weight: 2, density: 1.0 },
            { source: "h0", target: "S1", weight: 2, density: 1.0 },
            { source: "h0", target: "p4", weight: 1, density: 1.0 },
            { source: "h1", target: "S2", weight: 2, density: 1.0 },
            { source: "h1", target: "p7", weight: 1, density: 1.0 },
            { source: "h1", target: "p8", weight: 1, density: 1.0 },
            { source: "h1", target: "p9", weight: 1, density: 1.0 },
            { source: "h0", target: "h1", weight: 1, density: 1.0 },
            { source: "p7", target: "p8", weight: 1, density: 1.0 },
        ],
        corrections: { positive: [[" S0", "S1"]], negative: [[" S1", "p4"]] },
        action_metadata: { merged_pair: ["p5", "p6"], reward: 3 },
    });

    // Step 4: Merge p7 and p8
    steps.push({
        step_id: 4,
        nodes: [
            { id: "h0", label: "Hub0", vertex_count: 1, is_new_merge: false },
            { id: "h1", label: "Hub1", vertex_count: 1, is_new_merge: false },
            { id: "S0", label: "S0", vertex_count: 2, is_new_merge: false },
            { id: "S1", label: "S1", vertex_count: 2, is_new_merge: false },
            { id: "p4", label: "P4", vertex_count: 1, is_new_merge: false },
            { id: "S2", label: "S2", vertex_count: 2, is_new_merge: false },
            { id: "S3", label: "S3", vertex_count: 2, is_new_merge: true },
            { id: "p9", label: "P9", vertex_count: 1, is_new_merge: false },
        ],
        edges: [
            { source: "h0", target: "S0", weight: 2, density: 1.0 },
            { source: "h0", target: "S1", weight: 2, density: 1.0 },
            { source: "h0", target: "p4", weight: 1, density: 1.0 },
            { source: "h1", target: "S2", weight: 2, density: 1.0 },
            { source: "h1", target: "S3", weight: 2, density: 1.0 },
            { source: "h1", target: "p9", weight: 1, density: 1.0 },
            { source: "h0", target: "h1", weight: 1, density: 1.0 },
        ],
        corrections: { positive: [[" S0", "S1"]], negative: [[" S1", "p4"], ["S2", "S3"]] },
        action_metadata: { merged_pair: ["p7", "p8"], reward: 4 },
    });

    // Step 5: Merge S0 and S1
    steps.push({
        step_id: 5,
        nodes: [
            { id: "h0", label: "Hub0", vertex_count: 1, is_new_merge: false },
            { id: "h1", label: "Hub1", vertex_count: 1, is_new_merge: false },
            { id: "S4", label: "S4", vertex_count: 4, is_new_merge: true },
            { id: "p4", label: "P4", vertex_count: 1, is_new_merge: false },
            { id: "S2", label: "S2", vertex_count: 2, is_new_merge: false },
            { id: "S3", label: "S3", vertex_count: 2, is_new_merge: false },
            { id: "p9", label: "P9", vertex_count: 1, is_new_merge: false },
        ],
        edges: [
            { source: "h0", target: "S4", weight: 4, density: 1.0 },
            { source: "h0", target: "p4", weight: 1, density: 1.0 },
            { source: "h1", target: "S2", weight: 2, density: 1.0 },
            { source: "h1", target: "S3", weight: 2, density: 1.0 },
            { source: "h1", target: "p9", weight: 1, density: 1.0 },
            { source: "h0", target: "h1", weight: 1, density: 1.0 },
        ],
        corrections: { positive: [[" S4", "p4"]], negative: [[" S4", "h1"], ["S2", "S3"]] },
        action_metadata: { merged_pair: ["S0", "S1"], reward: 5 },
    });

    // Step 6: Merge S2 and S3
    steps.push({
        step_id: 6,
        nodes: [
            { id: "h0", label: "Hub0", vertex_count: 1, is_new_merge: false },
            { id: "h1", label: "Hub1", vertex_count: 1, is_new_merge: false },
            { id: "S4", label: "S4", vertex_count: 4, is_new_merge: false },
            { id: "p4", label: "P4", vertex_count: 1, is_new_merge: false },
            { id: "S5", label: "S5", vertex_count: 4, is_new_merge: true },
            { id: "p9", label: "P9", vertex_count: 1, is_new_merge: false },
        ],
        edges: [
            { source: "h0", target: "S4", weight: 4, density: 1.0 },
            { source: "h0", target: "p4", weight: 1, density: 1.0 },
            { source: "h1", target: "S5", weight: 4, density: 1.0 },
            { source: "h1", target: "p9", weight: 1, density: 1.0 },
            { source: "h0", target: "h1", weight: 1, density: 1.0 },
        ],
        corrections: { positive: [[" S4", "p4"], ["S5", "p9"]], negative: [[" S4", "S5"]] },
        action_metadata: { merged_pair: ["S2", "S3"], reward: 5 },
    });

    // Step 7: Final - Merge h0 into S4
    steps.push({
        step_id: 7,
        nodes: [
            { id: "S6", label: "S6", vertex_count: 5, is_new_merge: true },
            { id: "h1", label: "Hub1", vertex_count: 1, is_new_merge: false },
            { id: "p4", label: "P4", vertex_count: 1, is_new_merge: false },
            { id: "S5", label: "S5", vertex_count: 4, is_new_merge: false },
            { id: "p9", label: "P9", vertex_count: 1, is_new_merge: false },
        ],
        edges: [
            { source: "S6", target: "p4", weight: 1, density: 0.2 },
            { source: "S6", target: "h1", weight: 1, density: 0.2 },
            { source: "h1", target: "S5", weight: 4, density: 1.0 },
            { source: "h1", target: "p9", weight: 1, density: 1.0 },
        ],
        corrections: { positive: [[" S6", "p4"]], negative: [[" S6", "S5"]] },
        action_metadata: { merged_pair: ["h0", "S4"], reward: 6 },
    });

    return steps;
}

// Export steps as a map keyed by dataset ID
export const MOCK_STEPS_MAP: Record<string, GraphStep[]> = {
    "astro-ph": generateExtendedMockSteps(),
    "cnr-2000": generateCNRMockSteps(),
};

// Default export for backward compatibility
export const MOCK_STEPS = MOCK_STEPS_MAP["astro-ph"];

