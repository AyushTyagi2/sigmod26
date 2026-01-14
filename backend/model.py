import glob
import os
import torch
import random
import copy
import pickle
import numpy as np
import networkx as nx
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple

from backend.output_types import (
    Meta,
    PoligrasOutput,
    Stats,
    InitialGraph,
    SummaryGraph,
    SummaryEdge,
    SummaryNode,
    SummaryArtifacts,
    SupernodeMembership,
    CorrectionSets,
)


MAX_INITIAL_SNAPSHOT_NODES = None  # Set to None for full graph, or a number to limit


class Poligras(torch.nn.Module):

    def __init__(self, args):

        super(Poligras, self).__init__()
        self.args = args

        ## set up the MLP structure and learnable parameters in the policy function
        self.interLayer_first = torch.nn.Linear(self.args.feat_dim, self.args.hidden_size1)
        self.fully_connected_second = torch.nn.Linear(self.args.hidden_size1, self.args.hidden_size2)
        self.dropout = torch.nn.Dropout(p=self.args.dropout)

        self.saved_log_probs = []
        self.rewards = []


    def forward(self, x):
        ## policy function computation steps
        
        temp_feat = torch.nn.functional.relu(self.interLayer_first(x))
        temp_feat =  self.fully_connected_second(temp_feat)
        temp_feat = torch.mm(temp_feat, torch.t(temp_feat))

        temp_feat = self.dropout(temp_feat)
        mask_temp_feat = torch.FloatTensor(np.diag([float('-inf')] * temp_feat.size()[0]))
        temp_feat = temp_feat + mask_temp_feat
        temp_feat = torch.nn.functional.softmax(temp_feat.view(1, -1), dim=1).view(temp_feat.size()[0], -1)
        assert(temp_feat.size()[0] == temp_feat.size()[1])

        return temp_feat



class PoligrasRunner(object):

    def __init__(self, args):
        print("\n-------Model initializing---------.\n")

        self.args = args

        backend_root = Path(__file__).resolve().parent
        self.dataset_dir = backend_root / 'dataset' / self.args.dataset
        if not self.dataset_dir.exists():
            raise FileNotFoundError(
                f"Dataset assets for '{self.args.dataset}' not found at {self.dataset_dir.resolve()}"
            )

        ## load graph structure
        graph_path = self.dataset_dir / f"{self.args.dataset}_graph"
        with graph_path.open('rb') as g_file:
            loaded_graph = pickle.load(g_file)
        self.init_graph = loaded_graph['G']

        # cache initial counts and initialize per-merge timeline container
        self.initial_node_count = self.init_graph.number_of_nodes()
        self.initial_edge_count = self.init_graph.number_of_edges()
        self.timeline: List[Dict] = []

        ## load node features
        feat_path = self.dataset_dir / f"{self.args.dataset}_feat"
        with feat_path.open('rb') as g_file:
            loaded_data = pickle.load(g_file)
        self.node_feat = loaded_data['feat']
        self.args.feat_dim = self.node_feat.size()[1]
        # print('feat size: ', self.args.feat_dim)
        self.model = Poligras(self.args)

        init_superNodes_dict = {} ## each initial node belongs to the supernode of its own
        self.node_belonging = {} ## to record which supernode one specific initial node belongs to
        for node in self.init_graph.nodes():
            init_superNodes_dict[node] = [node] ## initially each supernode only has one initial node
            self.node_belonging[node] = node


        ij = 0
        self.init_nd_idx = {} ## to record the index of initial nodes
        for nd in self.init_graph.nodes():
            self.init_nd_idx[nd] = ij
            ij += 1

        ## compute the initial group partitioning(index)
        self.num_partitions = self.init_graph.number_of_nodes()//self.args.group_size

        h_function = list(range(self.init_graph.number_of_nodes()))
        random.shuffle(h_function)


        F_A_dict = {}
        for A in init_superNodes_dict:
            F_A = self.init_graph.number_of_nodes()
            for v in init_superNodes_dict[A]:
                f_v = self.init_graph.number_of_nodes()
                for u in list(self.init_graph[v]) + [v]:
                    if(h_function[self.init_nd_idx[int(u)]] < f_v):
                        f_v = h_function[self.init_nd_idx[int(u)]]

                if(f_v < F_A):
                    F_A = f_v

            F_A_dict[A] = F_A
        F_A_list = sorted(F_A_dict.items(), key=lambda item:item[1])

        init_groupIndex = [] ## to store the initial nodes indices contained in each group
        for i in range(self.num_partitions):
            curr_idx = []
            for j in F_A_list[int(i*len(F_A_list)/self.num_partitions): int((i+1)*len(F_A_list)/self.num_partitions)]:
                curr_idx.append(j[0])
            
            init_groupIndex.append(np.array(curr_idx))

        # print('index size: ', len(init_groupIndex))
        self.best_superNodes_dict = init_superNodes_dict
        
        ## store the data for the following use
        f = open('./{}_{}_.best_temp'.format(self.args.dataset, 0), 'wb')
        pickle.dump({'g':self.init_graph, 'group_index':init_groupIndex, 'superNodes_dict':init_superNodes_dict}, f)
        f.close()
 
 
    def select_action(self, curr_feat):
        ## to select node pair according to computed selection probability matrix

        curr_probs = self.model(curr_feat) ## compute selection probability matrix 

        curr_action = curr_probs.argmax() ## select node pair with the highest probability
        curr_action_row, curr_action_col = curr_action.item() // curr_probs.size()[0], curr_action.item() % curr_probs.size()[0]

        if(curr_action_row == curr_action_col):
            curr_action_row, curr_action_col = random.sample(range(curr_probs.size()[0]), 2)
        self.model.saved_log_probs.append(torch.log(curr_probs[curr_action_row][curr_action_col]))#

        return curr_action_row, curr_action_col


    def update_graph(self, n1, n2, curr_graph):
        ## to compute the summarization reward for the given node pair, also update the intermediate supergraph if the node pair is truly merged

        curr_reward, graph_modify_dict = 0, {'weight':{}, 'if_true':{}, 'add_edge':{}}## "curr_reward" records the sr of merging n1 & n2; "graph_modify_dict" temporarily stores the modifications of graph when merging two (super)nodes, which will be truly conducted if curr_reward > 0;
        nei_n1, nei_n2 = set(self.curr_graph[n1]), set(self.curr_graph[n2])


        ## consider the cases of n1, n2's neighboring nodes
        for sd in nei_n1 & nei_n2 - set([n1]) - set([n2]):
            if(self.curr_graph[n1][sd]['if_true']):
                if(self.curr_graph[n2][sd]['if_true']):
                    curr_reward += 1
                else:
                    if((self.curr_graph[n1][sd]['weight']+self.curr_graph[n2][sd]['weight']) > ((len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2]))*len(self.superNodes_dict[sd])/2)):
                        curr_reward += (2*self.curr_graph[n2][sd]['weight'] - len(self.superNodes_dict[n2])*len(self.superNodes_dict[sd]))
                    else:
                        curr_reward += (1+ len(self.superNodes_dict[n1])*len(self.superNodes_dict[sd]) - 2*self.curr_graph[n1][sd]['weight'])
                        graph_modify_dict['if_true'][(n1,sd)] = False
            else:
                if(curr_graph[n2][sd]['if_true']):
                    if((self.curr_graph[n1][sd]['weight']+self.curr_graph[n2][sd]['weight']) > ((len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2]))*len(self.superNodes_dict[sd])/2)):
                        curr_reward += (2*self.curr_graph[n1][sd]['weight'] - len(self.superNodes_dict[n1])*len(self.superNodes_dict[sd]))
                        graph_modify_dict['if_true'][(n1,sd)] = True
                    else:
                        curr_reward += (1+ len(self.superNodes_dict[n2])*len(self.superNodes_dict[sd]) - 2*self.curr_graph[n2][sd]['weight'])

            graph_modify_dict['weight'][(n1,sd)] = self.curr_graph[n1][sd]['weight'] + self.curr_graph[n2][sd]['weight']
        

        for sd in nei_n1 - nei_n2 - set([n1]) - set([n2]):
            if(self.curr_graph[n1][sd]['if_true']):
                if(self.curr_graph[n1][sd]['weight'] > ((len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2]))*(len(self.superNodes_dict[sd]))/2)):
                    curr_reward += -len(self.superNodes_dict[n2])*len(self.superNodes_dict[sd])
                else:
                    curr_reward += (1 + len(self.superNodes_dict[n1])*len(self.superNodes_dict[sd]) - 2*self.curr_graph[n1][sd]['weight'])
                    graph_modify_dict['if_true'][(n1,sd)] = False


        for sd in nei_n2 - nei_n1 - set([n1]) - set([n2]):
            if(self.curr_graph[n2][sd]['if_true']):
                if(curr_graph[n2][sd]['weight'] > ((len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2]))*(len(self.superNodes_dict[sd]))/2)):
                    curr_reward += -len(self.superNodes_dict[n1])*len(self.superNodes_dict[sd])
                    graph_modify_dict['add_edge'][(n1, sd)] = {'toAddWei':self.curr_graph[n2][sd]['weight'], 'ifTrue':True}
                else:
                    curr_reward += (1 + len(self.superNodes_dict[n2])*len(self.superNodes_dict[sd]) - 2*self.curr_graph[n2][sd]['weight'])
                    graph_modify_dict['add_edge'][(n1, sd)] = {'toAddWei':self.curr_graph[n2][sd]['weight'], 'ifTrue':False}
            else:
                graph_modify_dict['add_edge'][(n1, sd)] = {'toAddWei':self.curr_graph[n2][sd]['weight'], 'ifTrue':False}


        if(n1 in nei_n2):
            if(self.curr_graph[n1][n2]['if_true']):
                if(n1 in nei_n1):
                    if(self.curr_graph[n1][n1]['if_true']):
                        if(n2 in nei_n2):
                            if(self.curr_graph[n2][n2]['if_true']):
                                curr_reward += 2
                            else:
                                if((self.curr_graph[n2][n2]['weight'] + self.curr_graph[n1][n2]['weight'] + self.curr_graph[n1][n1]['weight']) > ((len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2]))*(len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2])-1)/4)):
                                    curr_reward += (1 + 2*self.curr_graph[n2][n2]['weight'] - len(self.superNodes_dict[n2])*(len(self.superNodes_dict[n2])-1)/2)
                                else:
                                    curr_reward += (1 + len(self.superNodes_dict[n1])*(len(self.superNodes_dict[n1])-1)/2 - 2*self.curr_graph[n1][n1]['weight']) 
                                    curr_reward += (1 + len(self.superNodes_dict[n1])*len(self.superNodes_dict[n2]) - 2*self.curr_graph[n1][n2]['weight'])
                                    graph_modify_dict['if_true'][(n1,n1)] = False

                            graph_modify_dict['weight'][(n1,n1)] = self.curr_graph[n1][n1]['weight'] + self.curr_graph[n1][n2]['weight'] + self.curr_graph[n2][n2]['weight']

                        else:# n2 not in self loop
                            if((self.curr_graph[n1][n1]['weight'] + self.curr_graph[n1][n2]['weight']) > ((len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2]))*(len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2])-1)/4)):
                                curr_reward += (1 - len(self.superNodes_dict[n2])*(len(self.superNodes_dict[n2])-1)/2)
                            else:
                                curr_reward += (1 + len(self.superNodes_dict[n1])*(len(self.superNodes_dict[n1])-1)/2 - 2*self.curr_graph[n1][n1]['weight'])
                                curr_reward += (1 + len(self.superNodes_dict[n1])*len(self.superNodes_dict[n2]) - 2*self.curr_graph[n1][n2]['weight'])
                                graph_modify_dict['if_true'][(n1,n1)] = False
                                
                            graph_modify_dict['weight'][(n1,n1)] = self.curr_graph[n1][n1]['weight'] + self.curr_graph[n1][n2]['weight']

                    else:## self.curr_graph[n1][n1]['if_true'] = False
                        if(n2 in nei_n2): 
                            if(self.curr_graph[n2][n2]['if_true']):
                                if((self.curr_graph[n1][n1]['weight'] + self.curr_graph[n1][n2]['weight'] + self.curr_graph[n2][n2]['weight']) > ((len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2]))*(len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2])-1)/4)):
                                    graph_modify_dict['if_true'][(n1,n1)] = True
                                    curr_reward += (1 + 2*self.curr_graph[n1][n1]['weight'] - len(self.superNodes_dict[n1])*(len(self.superNodes_dict[n1])-1)/2)
                                    
                                else:
                                    curr_reward += (1 + len(self.superNodes_dict[n1])*len(self.superNodes_dict[n2]) - 2*self.curr_graph[n1][n2]['weight'])
                                    curr_reward += (1 + len(self.superNodes_dict[n2])*(len(self.superNodes_dict[n2])-1)/2 - 2*self.curr_graph[n2][n2]['weight'])
                            else:
                                if((self.curr_graph[n1][n1]['weight'] + self.curr_graph[n1][n2]['weight'] + self.curr_graph[n2][n2]['weight']) > ((len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2]))*(len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2])-1)/4)):
                                    graph_modify_dict['if_true'][(n1,n1)] = True
                                    curr_reward += (2*self.curr_graph[n1][n1]['weight'] - len(self.superNodes_dict[n1])*(len(self.superNodes_dict[n1])-1)/2)
                                    curr_reward += (2*self.curr_graph[n2][n2]['weight'] - len(self.superNodes_dict[n2])*(len(self.superNodes_dict[n2])-1)/2)

                                else:
                                    curr_reward += (1 + len(self.superNodes_dict[n1])*len(self.superNodes_dict[n2]) - 2*self.curr_graph[n1][n2]['weight'])

                            graph_modify_dict['weight'][(n1,n1)] = self.curr_graph[n1][n1]['weight'] + self.curr_graph[n1][n2]['weight'] + self.curr_graph[n2][n2]['weight']

                        else:## n2 not in self loop
                            if((self.curr_graph[n1][n1]['weight'] + self.curr_graph[n1][n2]['weight']) > ((len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2]))*(len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2])-1)/4)):
                                graph_modify_dict['if_true'][(n1,n1)] = True
                                curr_reward += (2*self.curr_graph[n1][n1]['weight'] - len(self.superNodes_dict[n1])*(len(self.superNodes_dict[n1])-1)/2)
                                curr_reward += -len(self.superNodes_dict[n2])*(len(self.superNodes_dict[n2])-1)/2
                            else:
                                curr_reward += (1 + len(self.superNodes_dict[n1])*len(self.superNodes_dict[n2]) - 2*self.curr_graph[n1][n2]['weight'])

                            graph_modify_dict['weight'][(n1,n1)] = self.curr_graph[n1][n1]['weight'] + self.curr_graph[n1][n2]['weight']

                else:## n1 not in self loop
                    if(n2 in nei_n2):
                        if(self.curr_graph[n2][n2]['if_true']):
                            if((self.curr_graph[n1][n2]['weight'] + self.curr_graph[n2][n2]['weight']) > ((len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2]))*(len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2])-1)/4)):
                                curr_reward += (1 - len(self.superNodes_dict[n1])*(len(self.superNodes_dict[n1])-1)/2)
                                graph_modify_dict['add_edge'][(n1, n1)] = {'toAddWei':self.curr_graph[n1][n2]['weight'] + self.curr_graph[n2][n2]['weight'], 'ifTrue':True}
                            else:
                                curr_reward += (1 + len(self.superNodes_dict[n1])*len(self.superNodes_dict[n2]) - 2*self.curr_graph[n1][n2]['weight'])
                                curr_reward += (1 + len(self.superNodes_dict[n2])*(len(self.superNodes_dict[n2])-1)/2 - 2*self.curr_graph[n2][n2]['weight'])
                                graph_modify_dict['add_edge'][(n1, n1)] = {'toAddWei':self.curr_graph[n1][n2]['weight'] + self.curr_graph[n2][n2]['weight'], 'ifTrue':False}

                        else:## curr_graph[n2][n2]['if_true'] = False
                            if((self.curr_graph[n1][n2]['weight'] + self.curr_graph[n2][n2]['weight']) > ((len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2]))*(len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2])-1)/4)):
                                curr_reward += (2*self.curr_graph[n2][n2]['weight'] - len(self.superNodes_dict[n2])*(len(self.superNodes_dict[n2])-1)/2)
                                curr_reward += -len(self.superNodes_dict[n1])*(len(self.superNodes_dict[n1])-1)/2
                                graph_modify_dict['add_edge'][(n1, n1)] = {'toAddWei':self.curr_graph[n1][n2]['weight'] + self.curr_graph[n2][n2]['weight'], 'ifTrue':True}

                            else:
                                curr_reward += (1 + len(self.superNodes_dict[n1])*len(self.superNodes_dict[n2]) - 2*self.curr_graph[n1][n2]['weight'])
                                graph_modify_dict['add_edge'][(n1, n1)] = {'toAddWei':self.curr_graph[n1][n2]['weight'] + self.curr_graph[n2][n2]['weight'], 'ifTrue':False}
                    
                    else:## n2 not in self loop
                        if(self.curr_graph[n1][n2]['weight'] > ((len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2]))*(len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2])-1)/4)):
                            curr_reward += -len(self.superNodes_dict[n1])*(len(self.superNodes_dict[n1])-1)/2
                            curr_reward += -len(self.superNodes_dict[n2])*(len(self.superNodes_dict[n2])-1)/2
                            graph_modify_dict['add_edge'][(n1, n1)] = {'toAddWei':self.curr_graph[n1][n2]['weight'], 'ifTrue':True}

                        else:
                            curr_reward += (1 + len(self.superNodes_dict[n1])*len(self.superNodes_dict[n2]) - 2*self.curr_graph[n1][n2]['weight'])
                            graph_modify_dict['add_edge'][(n1, n1)] = {'toAddWei':self.curr_graph[n1][n2]['weight'], 'ifTrue':False}

            else:## self.curr_graph[n1][n2]['if_true'] = False
                if(n1 in nei_n1):
                    if(self.curr_graph[n1][n1]['if_true']):
                        if(n2 in nei_n2):
                            if(self.curr_graph[n2][n2]['if_true']):
                                if((self.curr_graph[n1][n1]['weight'] + self.curr_graph[n1][n2]['weight'] + self.curr_graph[n2][n2]['weight']) > ((len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2]))*(len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2])-1)/4)):
                                    curr_reward += (1 + 2*self.curr_graph[n1][n2]['weight'] - len(self.superNodes_dict[n1])*len(self.superNodes_dict[n2]))
                                else:
                                    curr_reward += (1 + len(self.superNodes_dict[n1])*(len(self.superNodes_dict[n1])-1)/2 - 2*self.curr_graph[n1][n1]['weight'])
                                    curr_reward += (1 + len(self.superNodes_dict[n2])*(len(self.superNodes_dict[n2])-1)/2 - 2*self.curr_graph[n2][n2]['weight'])
                                    graph_modify_dict['if_true'][(n1,n1)] = False

                            else:
                                if((self.curr_graph[n1][n1]['weight'] + self.curr_graph[n1][n2]['weight'] + self.curr_graph[n2][n2]['weight']) > ((len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2]))*(len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2])-1)/4)):
                                    curr_reward += (2*self.curr_graph[n1][n2]['weight'] - len(self.superNodes_dict[n1])*len(self.superNodes_dict[n2]))
                                    curr_reward += (2*self.curr_graph[n2][n2]['weight'] - len(self.superNodes_dict[n2])*(len(self.superNodes_dict[n2])-1)/2)
                                else:
                                    curr_reward += (1 + len(self.superNodes_dict[n1])*(len(self.superNodes_dict[n1])-1)/2 - 2*self.curr_graph[n1][n1]['weight'])
                                    graph_modify_dict['if_true'][(n1,n1)] = False

                            graph_modify_dict['weight'][(n1,n1)] = self.curr_graph[n1][n1]['weight'] + self.curr_graph[n1][n2]['weight'] + self.curr_graph[n2][n2]['weight']

                        
                        else:## n2 not in self loop
                            if((self.curr_graph[n1][n1]['weight'] + self.curr_graph[n1][n2]['weight']) > ((len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2]))*(len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2])-1)/4)):
                                curr_reward += (2*self.curr_graph[n1][n2]['weight'] - len(self.superNodes_dict[n1])*len(self.superNodes_dict[n2]))
                                curr_reward += -len(self.superNodes_dict[n2])*(len(self.superNodes_dict[n2])-1)/2

                            else:
                                curr_reward += (1 + len(self.superNodes_dict[n1])*(len(self.superNodes_dict[n1])-1)/2 - 2*self.curr_graph[n1][n1]['weight'])
                                graph_modify_dict['if_true'][(n1,n1)] = False

                            graph_modify_dict['weight'][(n1,n1)] = self.curr_graph[n1][n1]['weight'] + self.curr_graph[n1][n2]['weight']

                    else:## self.curr_graph[n1][n1]['if_true'] = False
                        if(n2 in nei_n2):
                            if(self.curr_graph[n2][n2]['if_true']):
                                if((self.curr_graph[n1][n1]['weight'] + self.curr_graph[n1][n2]['weight'] + self.curr_graph[n2][n2]['weight']) > ((len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2]))*(len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2])-1)/4)):
                                    curr_reward += (2*self.curr_graph[n1][n1]['weight'] - len(self.superNodes_dict[n1])*(len(self.superNodes_dict[n1])-1)/2)
                                    curr_reward += (2*self.curr_graph[n1][n2]['weight'] - len(self.superNodes_dict[n1])*len(self.superNodes_dict[n2]))
                                    graph_modify_dict['if_true'][(n1,n1)] = True
                                else:
                                    curr_reward += (1 + len(self.superNodes_dict[n2])*(len(self.superNodes_dict[n2])-1)/2 - 2*self.curr_graph[n2][n2]['weight'])

                            graph_modify_dict['weight'][(n1,n1)] = self.curr_graph[n1][n1]['weight'] + self.curr_graph[n1][n2]['weight'] + self.curr_graph[n2][n2]['weight']

                        else:## n2 not in self loop
                            graph_modify_dict['weight'][(n1,n1)] = self.curr_graph[n1][n1]['weight'] + self.curr_graph[n1][n2]['weight']

                else:## n1 not in self loop
                    if(n2 in nei_n2):
                        if(self.curr_graph[n2][n2]['if_true']):
                            if((self.curr_graph[n1][n2]['weight'] + self.curr_graph[n2][n2]['weight']) > ((len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2]))*(len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2])-1)/4)):
                                curr_reward += -len(self.superNodes_dict[n1])*(len(self.superNodes_dict[n1])-1)/2
                                curr_reward += (2*self.curr_graph[n1][n2]['weight'] - len(self.superNodes_dict[n1])*len(self.superNodes_dict[n2]))
                                graph_modify_dict['add_edge'][(n1, n1)] = {'toAddWei':self.curr_graph[n1][n2]['weight'] + self.curr_graph[n2][n2]['weight'], 'ifTrue':True}

                            else:
                                curr_reward += (1 + len(self.superNodes_dict[n2])*(len(self.superNodes_dict[n2])-1)/2 - 2*self.curr_graph[n2][n2]['weight'])
                                graph_modify_dict['add_edge'][(n1, n1)] = {'toAddWei':self.curr_graph[n1][n2]['weight'] + self.curr_graph[n2][n2]['weight'], 'ifTrue':False}

                        else:
                            graph_modify_dict['add_edge'][(n1, n1)] = {'toAddWei':self.curr_graph[n1][n2]['weight'] + self.curr_graph[n2][n2]['weight'], 'ifTrue':False}
                            
                    else:
                        graph_modify_dict['add_edge'][(n1, n1)] = {'toAddWei':self.curr_graph[n1][n2]['weight'], 'ifTrue':False}

        else:## n1 n2 not connected
            if(n1 in nei_n1):
                if(self.curr_graph[n1][n1]['if_true']):
                    if(n2 in nei_n2):
                        if(self.curr_graph[n2][n2]['if_true']):
                            if((self.curr_graph[n1][n1]['weight'] + self.curr_graph[n2][n2]['weight']) > ((len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2]))*(len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2])-1)/4)):
                                curr_reward += 1
                                curr_reward += -len(self.superNodes_dict[n1])*len(self.superNodes_dict[n2])

                            else:
                                curr_reward += (1 + len(self.superNodes_dict[n1])*(len(self.superNodes_dict[n1])-1)/2 - 2*self.curr_graph[n1][n1]['weight'])
                                curr_reward += (1 + len(self.superNodes_dict[n2])*(len(self.superNodes_dict[n2])-1)/2 - 2*self.curr_graph[n2][n2]['weight'])
                                graph_modify_dict['if_true'][(n1,n1)] = False
                        else:
                            if((self.curr_graph[n1][n1]['weight'] + self.curr_graph[n2][n2]['weight']) > ((len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2]))*(len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2])-1)/4)):
                                curr_reward += -len(self.superNodes_dict[n1])*len(self.superNodes_dict[n2])
                                curr_reward += (2*self.curr_graph[n2][n2]['weight'] - len(self.superNodes_dict[n2])*(len(self.superNodes_dict[n2])-1)/2)
                            
                            else:
                                curr_reward += (1 + len(self.superNodes_dict[n1])*(len(self.superNodes_dict[n1])-1)/2 - 2*self.curr_graph[n1][n1]['weight'])
                                graph_modify_dict['if_true'][(n1,n1)] = False
                        
                        graph_modify_dict['weight'][(n1,n1)] = self.curr_graph[n1][n1]['weight'] + self.curr_graph[n2][n2]['weight']


                    else:## n2 not in self loop 
                        if(self.curr_graph[n1][n1]['weight'] > ((len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2]))*(len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2])-1)/4)):
                            curr_reward += -len(self.superNodes_dict[n1])*len(self.superNodes_dict[n2])
                            curr_reward += -len(self.superNodes_dict[n2])*(len(self.superNodes_dict[n2])-1)/2
                        else:
                            curr_reward += (1 + len(self.superNodes_dict[n1])*(len(self.superNodes_dict[n1])-1)/2 - 2*self.curr_graph[n1][n1]['weight'])
                            graph_modify_dict['if_true'][(n1,n1)] = False

                else:## self.curr_graph[n1][n1]['if_true'] = False
                    if(n2 in nei_n2):
                        if(self.curr_graph[n2][n2]['if_true']):
                            if((self.curr_graph[n1][n1]['weight'] + self.curr_graph[n2][n2]['weight']) > ((len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2]))*(len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2])-1)/4)):
                                curr_reward += (2*self.curr_graph[n1][n1]['weight'] - len(self.superNodes_dict[n1])*(len(self.superNodes_dict[n1])-1)/2)
                                curr_reward += -len(self.superNodes_dict[n1])*len(self.superNodes_dict[n2])
                                graph_modify_dict['if_true'][(n1,n1)] = True

                            else:
                                curr_reward += (1 + len(self.superNodes_dict[n2])*(len(self.superNodes_dict[n2])-1)/2 - 2*curr_graph[n2][n2]['weight'])

                        graph_modify_dict['weight'][(n1,n1)] = self.curr_graph[n1][n1]['weight'] + self.curr_graph[n2][n2]['weight']


            else:## n1 not in self loop
                if(n2 in nei_n2):
                    if(self.curr_graph[n2][n2]['if_true']):
                        if(self.curr_graph[n2][n2]['weight'] > ((len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2]))*(len(self.superNodes_dict[n1])+len(self.superNodes_dict[n2])-1)/4)):
                            curr_reward += -len(self.superNodes_dict[n1])*(len(self.superNodes_dict[n1])-1)/2
                            curr_reward += -len(self.superNodes_dict[n1])*len(self.superNodes_dict[n2])
                            graph_modify_dict['add_edge'][(n1, n1)] = {'toAddWei':self.curr_graph[n2][n2]['weight'], 'ifTrue':True}
                        else:
                            graph_modify_dict['add_edge'][(n1, n1)] = {'toAddWei':self.curr_graph[n2][n2]['weight'], 'ifTrue':False}

                    else:
                        graph_modify_dict['add_edge'][(n1, n1)] = {'toAddWei':self.curr_graph[n2][n2]['weight'], 'ifTrue':False}
                    


        self.model.rewards.append(curr_reward)
        if(curr_reward > 0):
            ## modify current intermediate supergraph
            for pair in graph_modify_dict['weight']:
                self.curr_graph[pair[0]][pair[1]]['weight'] = graph_modify_dict['weight'][pair]
            for pair in graph_modify_dict['if_true']:
                self.curr_graph[pair[0]][pair[1]]['if_true'] = graph_modify_dict['if_true'][pair]
            for pair in graph_modify_dict['add_edge']:
                self.curr_graph.add_edge(pair[0], pair[1], weight=graph_modify_dict['add_edge'][pair]['toAddWei'], if_true=graph_modify_dict['add_edge'][pair]['ifTrue'])

            self.curr_graph.remove_node(n2)
            
            ## update supernode features
            self.curr_feat[self.init_nd_idx[n1]] += self.curr_feat[self.init_nd_idx[n2]]
            for init_n in self.superNodes_dict[n2]:
                self.node_belonging[init_n] = n1
            self.superNodes_dict[n1] += self.superNodes_dict[n2]
            self.superNodes_dict.pop(n2)

            # record per-merge stats snapshot for frontend timeline
            step_index = len(self.timeline)
            supernode_count = len(self.superNodes_dict)
            edge_count = self.curr_graph.number_of_edges()
            node_count = self.initial_node_count

            denom = float(self.initial_node_count + self.initial_edge_count)
            summarisation_ratio = 0.0
            if denom:
                summarisation_ratio = (supernode_count + edge_count) / denom

            avg_degree = 0.0
            if supernode_count > 0:
                if self.init_graph.is_directed():
                    avg_degree = edge_count / float(supernode_count)
                else:
                    avg_degree = 2.0 * edge_count / float(supernode_count)

            self.timeline.append({
                'n1': str(self._coerce_node_id(n1)),
                'n2': str(self._coerce_node_id(n2)),
                'stats': {
                    'step_index': step_index,
                    'reward': float(curr_reward),
                    'summarisation_ratio': float(summarisation_ratio),
                    'node_count': int(node_count),
                    'edge_count': int(edge_count),
                    'supernode_count': int(supernode_count),
                    'avg_degree': float(avg_degree),
                },
            })

        return curr_reward

#---------------------------------------------------------------------------------------------------------------------------------
    def fit(self):
        print("\n-------Model running---------.\n")

        # total_rewards = 0 
        self.optimizer = torch.optim.Adam(self.model.parameters(), lr=self.args.lr, weight_decay=self.args.weight_decay)

        # reset timeline for this run
        self.timeline = []

        self.max_reward_by_inner_iter = 0## "max_reward_by_inner_iter" is to help judge and execute the group re-partitioning
        self.model.train()
        # init_time = time.time()
        for count in range(self.args.counts):
            best, bad_counter = -1000000, 0

            while(True):
                # start_time = time.time()
                g_file = open('./{}_{}_.best_temp'.format(self.args.dataset, count), 'rb')
                loaded_compre = pickle.load(g_file)
                g_file.close()

                self.curr_graph = loaded_compre['g']
                self.group_index =  loaded_compre['group_index']
                self.superNodes_dict = loaded_compre['superNodes_dict']
                self.curr_feat = copy.deepcopy(self.node_feat)

                count_reward, batch_id = 0, 0
                traverse_time = 0
                for idx in range(len(self.group_index)):
                    if(len(self.group_index[idx]) < 3):
                        continue
                    curr_row, curr_col = self.select_action(self.curr_feat[[self.init_nd_idx[i] for i in self.group_index[idx]]])

                    curr_reward = self.update_graph(self.group_index[idx][curr_row], self.group_index[idx][curr_col], self.curr_graph) 

                    if(curr_reward > 0):
                        count_reward += curr_reward
                        self.group_index[idx] = np.delete(self.group_index[idx], curr_col)


                policy_loss=0
                # len_loss = len(self.model.saved_log_probs)
                returns = torch.FloatTensor(self.model.rewards)
                returns = (returns - max(returns.mean(), 0)) / (returns.std())# + eps)

                for log_prob, R in zip(self.model.saved_log_probs, returns):
                    policy_loss += - log_prob * R

                self.optimizer.zero_grad()
                policy_loss.backward()
                self.optimizer.step()

                print('Count {}; Positive Count Reward: {};\n'.format(count, count_reward))

                del self.model.rewards[:]
                del self.model.saved_log_probs[:]


                if(count < 5):
                    ratio = 0.001
                else:
                    ratio = 0.01
                if(count_reward > (1 + ratio)*best):
                    best, bad_counter = count_reward, 0

                    self.best_graph, self.best_currFeat, self.best_groupIndex = self.curr_graph, self.curr_feat, self.group_index
                    self.best_superNodes_dict = self.superNodes_dict
                else:
                    bad_counter += 1

                if(bad_counter == self.args.bad_counter):
                    # total_rewards += best
                    break

            ## to determine if needs to execute group partitioning for another time
            if(best > self.max_reward_by_inner_iter):
                self.max_reward_by_inner_iter = best
            elif(best < (self.max_reward_by_inner_iter/3)):
                ## regrouping (group partitioning)
                self.max_reward_by_inner_iter = 0
                assert(self.best_graph.number_of_nodes() == len(self.best_superNodes_dict))

                self.num_partitions = self.best_graph.number_of_nodes()//self.args.group_size

                h_function = list(range(self.init_graph.number_of_nodes()))
                random.shuffle(h_function)

                F_A_dict = {}
                for A in self.best_superNodes_dict:
                    F_A = self.init_graph.number_of_nodes()
                    for v in self.best_superNodes_dict[A]:
                        f_v = self.init_graph.number_of_nodes()
                        for u in list(self.init_graph[v]) + [v]:
                            if(h_function[self.init_nd_idx[int(u)]] < f_v):
                                f_v = h_function[self.init_nd_idx[int(u)]]

                        if(f_v < F_A):
                            F_A = f_v

                    F_A_dict[A] = F_A
                F_A_list = sorted(F_A_dict.items(), key=lambda item:item[1])

                self.best_groupIndex = []
                for i in range(self.num_partitions):
                    curr_idx = []
                    for j in F_A_list[int(i*len(F_A_list)/self.num_partitions): int((i+1)*len(F_A_list)/self.num_partitions)]:
                        curr_idx.append(j[0])
                    
                    self.best_groupIndex.append(np.array(curr_idx))


            self.node_feat = self.best_currFeat
            f = open('./{}_{}_.best_temp'.format(self.args.dataset, count+1), 'wb')
            pickle.dump({'g':self.best_graph, 'group_index':self.best_groupIndex, 'superNodes_dict':self.best_superNodes_dict}, f)
            f.close()

            files = glob.glob('./{}_{}_.best_temp'.format(self.args.dataset, count))
            for fil in files:
                os.remove(fil)
            print('------\n')
                


        files = glob.glob('./{}_*_.best_temp'.format(self.args.dataset))
        for fil in files:
            os.remove(fil)


#---------------------------------------------------------------------------------------------------------------------------------
    def encode(self) -> PoligrasOutput:
        ## encode superedges after finishing the graph summarization iterations
        print("\n-------Model encoding---------.\n")

        self.superEdges, self_edge = [], []  ## to store the superedges and the initial self-loop edges on initial nodes
        self.correctionSet_plus, self.correctionSet_minus = [], [] ## to store the correction set edges to add and to delete from the supergraph when restoring the initial graph
        summary_edge_payload: Dict[Tuple[int, int], SummaryEdge] = {}

        finished_pair, i_dx = {}, 0
        self.superNodes_dict = self.best_superNodes_dict
        for A in self.superNodes_dict:
            iterative_superNode = []
            # print('{}th supernode'.format(i_dx))
            for init_n in self.superNodes_dict[A]:
                for nei_n in self.init_graph[init_n]:
                    iterative_superNode.append(self.node_belonging[nei_n])

            for B in set(iterative_superNode):
                if(A == B):
                    continue
                if((A, B) in finished_pair):
                    continue
                else:
                    finished_pair[(A,B)] = 0
                    finished_pair[(B,A)] = 0
            

                Edge_AB = [] # 0
                Pi_E_AB = []
                for n1 in self.superNodes_dict[A]:
                    for n2 in self.superNodes_dict[B]:
                        if((n1, n2) in self.init_graph.edges()):
                            Edge_AB.append((n1, n2))
                        else:
                            Pi_E_AB.append((n1, n2))

                if(len(Edge_AB) <= (len(self.superNodes_dict[A])*len(self.superNodes_dict[B])/2)):
                    self.correctionSet_plus += Edge_AB
                else:
                    edge_weight = len(Edge_AB)
                    possible_edges = len(self.superNodes_dict[A]) * len(self.superNodes_dict[B])
                    density = (edge_weight / possible_edges) if possible_edges else 0.0
                    self.superEdges.append((A, B))# += 1#
                    self.correctionSet_minus += Pi_E_AB
                    summary_edge_payload[(A, B)] = {
                        'source': str(A),
                        'target': str(B),
                        'weight': float(edge_weight),
                        'density': float(density),
                    }


            Edge_AA = []
            Pi_E_AA = []
            for n1 in self.superNodes_dict[A]:
                for n2 in self.superNodes_dict[A]:
                    if(n1<n2):
                        if((n1, n2) in self.init_graph.edges()):
                            Edge_AA.append((n1, n2))# += 1
                        else:
                            Pi_E_AA.append((n1, n2))
                ## to store the initial nodes having the self-loop edge 
                if((n1, n1) in self.init_graph.edges()): 
                    self_edge.append(n1)



            if(len(Edge_AA) <= (len(self.superNodes_dict[A])*(len(self.superNodes_dict[A])-1)/4)):
                self.correctionSet_plus += Edge_AA
            else:
                edge_weight = len(Edge_AA)
                possible_edges = len(self.superNodes_dict[A]) * (len(self.superNodes_dict[A]) - 1) / 2
                density = (edge_weight / possible_edges) if possible_edges else 0.0
                self.superEdges.append((A, A))
                self.correctionSet_minus += Pi_E_AA
                summary_edge_payload[(A, A)] = {
                    'source': str(A),
                    'target': str(A),
                    'weight': float(edge_weight),
                    'density': float(density),
                }

            i_dx += 1


        print('==============================\n')

        print('#super edge: ', len(self.superEdges))
        print('correction set size: ', len(self.correctionSet_plus) + len(self.correctionSet_minus))
        print("\n-------SuperNode encoding ended, total reward is {}---------.\n".format(self.init_graph.number_of_edges() - len(self_edge) - len(self.superEdges) - len(self.correctionSet_plus) - len(self.correctionSet_minus)))


        summary_path = self.dataset_dir / f"{self.args.dataset}_graph_summary"
        with summary_path.open('wb') as f:
            pickle.dump(
                {
                    'superNodes_dict': self.superNodes_dict,
                    'superEdge_list': self.superEdges,
                    'self_edge_list': self_edge,
                    'correctionSet_plus_list': self.correctionSet_plus,
                    'correctionSet_minus_list': self.correctionSet_minus,
                },
                f,
            )

        summary_nodes = self._build_summary_nodes()
        positive_corrections = len(self.correctionSet_plus)
        negative_corrections = len(self.correctionSet_minus)
        correction_edge_count = positive_corrections + negative_corrections
        summary_graph_payload = self._build_summary_graph(
            summary_nodes,
            summary_edge_payload,
            correction_edge_count,
        )
        initial_graph_payload = self._build_initial_snapshot()
        stats_payload = self._build_stats(
            summary_graph_payload,
            len(self_edge),
            correction_edge_count,
            positive_corrections,
            negative_corrections,
        )
        meta_payload = self._build_meta()
        artifacts_payload = self._build_artifacts(len(self_edge))

        result: PoligrasOutput = {
            'meta': meta_payload,
            'stats': stats_payload,
            'graphs': {
                'initial': initial_graph_payload,
                'summary': summary_graph_payload,
            },
            'timeline': self.timeline,
            'artifacts': artifacts_payload,
        }

        return result


    def _build_summary_nodes(self) -> List[SummaryNode]:
        summary_nodes: List[SummaryNode] = []
        for supernode_id, members in self.superNodes_dict.items():
            summary_nodes.append({
                'id': str(supernode_id),
                'size': len(members),
            })
        return summary_nodes


    def _build_summary_graph(
        self,
        summary_nodes: List[SummaryNode],
        summary_edge_payload: Dict[Tuple[int, int], SummaryEdge],
        correction_edge_count: int,
    ) -> SummaryGraph:
        return {
            'directed': self.init_graph.is_directed(),
            'sampled': False,
            'node_count': len(summary_nodes),
            'edge_count': len(summary_edge_payload),
            'correction_edge_count': int(correction_edge_count),
            'nodes': summary_nodes,
            'edges': list(summary_edge_payload.values()),
        }


    def _build_artifacts(self, self_loop_edges: int) -> SummaryArtifacts:
        membership_payload = self._build_membership_payload()
        corrections_payload = self._build_corrections_payload()
        return {
            'supernodes': membership_payload,
            'corrections': corrections_payload,
            'self_loops': int(self_loop_edges),
        }


    def _build_membership_payload(self) -> SupernodeMembership:
        members: Dict[str, List[str]] = {}
        node_to_supernode: Dict[str, str] = {}
        for supernode_id, initial_nodes in self.superNodes_dict.items():
            exported_supernode = str(supernode_id)
            exported_members = [str(self._coerce_node_id(node)) for node in initial_nodes]
            members[exported_supernode] = exported_members
            for member in exported_members:
                node_to_supernode[member] = exported_supernode

        return {
            'members': members,
            'node_to_supernode': node_to_supernode,
        }


    def _build_corrections_payload(self) -> CorrectionSets:
        def convert(edge: Tuple[int, int]) -> Dict[str, str]:
            source, target = edge
            return {
                'source': str(self._coerce_node_id(source)),
                'target': str(self._coerce_node_id(target)),
            }

        return {
            'positive': [convert(edge) for edge in self.correctionSet_plus],
            'negative': [convert(edge) for edge in self.correctionSet_minus],
        }


    def _build_initial_snapshot(self, max_nodes: int = MAX_INITIAL_SNAPSHOT_NODES) -> InitialGraph:
        ordered_nodes = list(self.init_graph.nodes())
        
        # If max_nodes is None or >= total nodes, use all nodes (no sampling)
        if max_nodes is None or max_nodes >= len(ordered_nodes):
            sampled_nodes = ordered_nodes
            sampled = False
        else:
            sampled_nodes = ordered_nodes[:max_nodes]
            sampled = True
        
        induced_subgraph = self.init_graph.subgraph(sampled_nodes).copy()

        nodes_payload = [
            {
                'id': self._coerce_node_id(node),
                'degree': int(self.init_graph.degree(node)),
            }
            for node in induced_subgraph.nodes()
        ]

        edges_payload = []
        for source, target, data in induced_subgraph.edges(data=True):
            weight = float(data.get('weight', 1.0))
            edges_payload.append({
                'source': self._coerce_node_id(source),
                'target': self._coerce_node_id(target),
                'weight': weight,
            })

        return {
            'directed': self.init_graph.is_directed(),
            'sampled': sampled,
            'node_count': induced_subgraph.number_of_nodes(),
            'edge_count': induced_subgraph.number_of_edges(),
            'nodes': nodes_payload,
            'edges': edges_payload,
        }


    def _build_stats(
        self,
        summary_graph: SummaryGraph,
        self_loop_edges: int,
        correction_edge_count: int,
        positive_corrections: int,
        negative_corrections: int,
    ) -> Stats:
        initial_nodes = self.init_graph.number_of_nodes()
        initial_edges = self.init_graph.number_of_edges()
        summary_supernodes = summary_graph['node_count']
        summary_superedges = summary_graph['edge_count']
        numerator = summary_supernodes + summary_superedges
        denominator = initial_nodes + initial_edges
        compression_ratio = (numerator / denominator) if denominator else 0.0
        total_reward = self.init_graph.number_of_edges() - self_loop_edges - len(self.superEdges) - correction_edge_count

        stats: Stats = {
            'initial': {
                'nodes': initial_nodes,
                'edges': initial_edges,
            },
            'summary': {
                'supernodes': summary_supernodes,
                'superedges': summary_superedges,
                'correction_edges': correction_edge_count,
            },
            'compression_ratio': compression_ratio,
            'total_reward': total_reward,
        }

        if summary_supernodes:
            stats['avg_supernode_size'] = initial_nodes / summary_supernodes

        stats['correction_breakdown'] = {
            'positive': positive_corrections,
            'negative': negative_corrections,
        }

        return stats


    def _build_meta(self) -> Meta:
        timestamp = datetime.utcnow().replace(microsecond=0).isoformat() + 'Z'
        return {
            'dataset': self.args.dataset,
            'algorithm': 'Poligras',
            'run_id': timestamp,
            'parameters': {
                'counts': self.args.counts,
                'group_size': self.args.group_size,
                'hidden_size1': self.args.hidden_size1,
                'hidden_size2': self.args.hidden_size2,
                'lr': self.args.lr,
                'dropout': self.args.dropout,
            },
        }


    def _coerce_node_id(self, node) -> int:
        if node in self.init_nd_idx:
            return int(self.init_nd_idx[node])
        try:
            return int(node)
        except (TypeError, ValueError):
            return int(hash(node))

