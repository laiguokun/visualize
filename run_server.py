# This runs a really simple key-value server at the specified 'port'
# The key-value pairs are stored in a level-db database specified using 'leveldb_loc'.
import SimpleHTTPServer
import SocketServer
import leveldb
import ConfigParser;
from urlparse import parse_qs;
from urlparse import urlparse;
import string;
import StringIO
import gzip
import json
import random;
import math;
import heapq;
# Valid requests are GC?GC_REQ=[content|hierarchy|children]
#											&GC_DATASET=dataset
#											&[GC_NODE=node]

# Valid Keys for e.g. are , 
# rcv1_hierarchy , rcv1_content_3453 , rcv1_children_3443

# Get timeLine info;
cfg = ConfigParser.ConfigParser();
cfg.read('config.cfg');


min_year_dataset = cfg.get('main','min_year_dataset');
max_year_dataset = cfg.get('main','max_year_dataset');

PORT = int( cfg.get('main','port') );
PORT += random.randint(0,20);
META_LEVELDB = leveldb.LevelDB( cfg.get('main','meta_leveldb_loc') );
CONTENT_LEVELDB = leveldb.LevelDB( cfg.get('main','content_leveldb_loc') );
PUBMED_CONTENT_LEVELDB = leveldb.LevelDB( cfg.get('main','pubmed_content_leveldb_loc') );
timeLinedb = leveldb.LevelDB( cfg.get('main','timeLine_leveldb_loc'));
wsdb = leveldb.LevelDB( cfg.get('main','wordSeries_leveldb_loc'));
descdb = leveldb.LevelDB(cfg.get('main', 'desc_leveldb_loc'));
relatedb = leveldb.LevelDB(cfg.get('main', 'relate_leveldb_loc'));
relatewtdb = leveldb.LevelDB(cfg.get('main', 'relate-word-topic_leveldb_loc'))
authordb = leveldb.LevelDB(cfg.get('main', 'author_leveldb_loc'));
referencedb = leveldb.LevelDB(cfg.get('main', 'reference_leveldb_loc'));

def searchNode(query, dataset):
	words = query.split();
	candid = {}
	max_hit_time = 0;
	topic = 0;
	for topic in dataset.keys():
		hit_time = 0;
		tmp = 0;
		for word in words:
			if (topic != '0' and (word in dataset[topic]["desc"])):
				hit_time += 1;
				tmp += 1.0/(dataset[topic]["desc"].index(word) + 1);
		if (dataset[topic]["isleaf"] == 1):
			tmp -= 1;
		if (hit_time == max_hit_time):
			candid[topic] = tmp;
		if (hit_time > max_hit_time):
			max_hit_time = hit_time;
			candid = {};
			candid[topic] = tmp;
	res = sorted(candid.items(), key=lambda x:x[1], reverse = True);
	if (len(res)>0):
		candid = {}
		min_value = res[0][1];
		for item in res:
			if (item[1] == min_value):
				candid[item[0]] = dataset[item[0]]["depth"];
		res = sorted(candid.items(), key=lambda x:x[1]);
		topic = res[0][0];
	return topic;

def searchNodeYear(query, year, dataset):
	words = query.split();
	candid = {}
	max_hit_time = 0;
	topic = 0;
	for topic in dataset.keys():
		try:
			value = json.loads(wsdb.Get(topic + "_" + year))
		except KeyError:
			continue;
		hit_time = 0;
		tmp = 0;
		for word in words:
			if (topic != '0' and (word in value["desc"])):
				hit_time += 1;
				tmp += 1.0/(value["desc"].index(word) + 1);
		if (dataset[topic]["isleaf"] == 1):
			tmp -= 1;
		if (hit_time == max_hit_time):
			candid[topic] = tmp;
		if (hit_time > max_hit_time):
			max_hit_time = hit_time;
			candid = {};
			candid[topic] = tmp;
	res = sorted(candid.items(), key=lambda x:x[1], reverse = True);
	if (len(res)>0):
		candid = {}
		min_value = res[0][1];
		for item in res:
			if (item[1] == min_value):
				candid[item[0]] = dataset[item[0]]["depth"];
		res = sorted(candid.items(), key=lambda x:x[1]);
		topic = res[0][0];
	return topic;

hierarchy = {}

def build_hierarchy(dataset, node):
	if (node == "0"):
		hierarchy[node] = {}
	hierarchy[node]["children"] = [];
	for son in dataset[node]["children"]:
		hierarchy[str(node)]["children"].append(str(son));
		hierarchy[str(son)] = {};
		hierarchy[str(son)]["parent"] = str(node);
		build_hierarchy(dataset, str(son));

def subtree_AandB(nodeA, nodeB):
	result_tree = {};
	depthA = dataset[nodeA]["depth"];
	depthB = dataset[nodeB]["depth"];
	pathA = [];pathB = [];
	pathA.append(nodeA);pathB.append(nodeB);
	while (depthA > depthB):
		pathA.append(hierarchy[pathA[len(pathA) - 1]]["parent"]);
		depthA -= 1;
	while (depthB > depthA):
		pathB.append(hierarchy[pathB[len(pathB) - 1]]["parent"]);
		depthB -= 1;
	while (pathA[len(pathA) - 1] != pathB[len(pathB) - 1]):
		pathA.append(hierarchy[pathA[len(pathA) - 1]]["parent"]);
		pathB.append(hierarchy[pathB[len(pathB) - 1]]["parent"]);
	result_tree["root"] = pathA[len(pathA) - 1];
	for i in range(len(pathA) - 1, -1, -1):
		if (not pathA[i] in result_tree):
			result_tree[pathA[i]] = {}
		if (not "children" in result_tree[pathA[i]].keys()):
			result_tree[pathA[i]]["children"] = [];
		if (i != 0):
			result_tree[pathA[i]]["children"].append(pathA[i-1]);
	for i in range(len(pathB) - 1, -1, -1):
		if (not pathB[i] in result_tree):
			result_tree[pathB[i]] = {}
		if (not "children" in result_tree[pathB[i]].keys()):
			result_tree[pathB[i]]["children"] = [];
		if (i != 0):
			result_tree[pathB[i]]["children"].append(pathB[i-1]);	
	return result_tree;

def subtree_set(L):
	result_tree = {};
	node = L[0];
	for i in range(1,len(L)):
		x = L[i];
		tmp = subtree_AandB(node, x);
		node = tmp["root"];
		for topic in tmp.keys():
			if (topic != "root"):
				if (not topic in result_tree):
					result_tree[topic] = {};
					result_tree[topic]["children"] = [];
				for son in tmp[topic]["children"]:
					if (not son in result_tree[topic]["children"]):
						result_tree[topic]["children"].append(son);
	result_tree["root"] = node;
	return result_tree;

def buildtree(tree, node, L1, L2, mark):
	tmp = {};
	if (node in mark):
		tmp["mark"] = 1;
	else:
		tmp["mark"] = 0;
#	print(L1);
	if (node in L1):
		tmp["set"] = 1;
		if (node in L2):
			tmp["set"] = 4;
	else:
		if (node in L2):
			tmp["set"] = 2;
		else:
			tmp["set"] = 3;
	tmp["nodeId"] = node;
	if (not "desc" in dataset[node]):
		tmp["desc"] = ["root"];
	else:
		tmp["desc"] = dataset[node]["desc"];
	if (len(tree[node]["children"]) != 0):
		tmp["children"] = [];
		for son in tree[node]["children"]:
			tmp["children"].append(buildtree(tree, son, L1, L2, mark));
			tmp["children"][len(tmp["children"]) - 1]["parent"] = node;
	return tmp;

def searchWord(query,dataset):
	words = query.split();
	candid = {}
	max_hit_time = 1;
	topic = 0;
	for topic in dataset.keys():
		hit_time = 0;
		tmp = 0;
		for word in words:
			if (topic != '0' and (word in dataset[topic]["desc"])):
				hit_time += 1;
				tmp += 1.0/(dataset[topic]["desc"].index(word) + 1);
		if (dataset[topic]["isleaf"] == 1):
			tmp -= 1;
		if (hit_time == max_hit_time):
			candid[topic] = tmp;
		if (hit_time > max_hit_time):
			max_hit_time = hit_time;
			candid = {};
			candid[topic] = tmp;
	res = sorted(candid.items(), key=lambda x:x[1], reverse = True);
	out = [];
	if (len(res)>0):
		candid = {}
		min_value = res[0][1];
		for item in res:
			if (item[1] == min_value):
				candid[item[0]] = dataset[item[0]]["depth"];
			else:
				res2 = sorted(candid.items(), key=lambda x:x[1]);
				i = 0;
				while (len(out) < 5 and i < len(res2)):
					out.append(res2[i][0]);
					i += 1;
				if (len(out) == 5):
					break;
				candid = {};
				min_value = item[1];
				candid[item[0]] = dataset[item[0]]["depth"]
	if (len(out) == 0):
		out.append("0");
	return out;

def convert_tree(tree, L1, L2, mark):
	result = buildtree(tree, tree["root"], L1, L2, mark);
	result["parent"] = "null";
	return result;

def build_time_series(node,year,relatedb, addition_edge):
	result = {}
	now_year = int(year);
	result[year] = {};
	result[year][node] = {}
	result[year][node]["rank"] = 1;
	result[year][node]["parent"] = 0;
	while (now_year <= 2003):
		next_year = now_year + 1;
		candid = {}
		for last_node in result[str(now_year)].keys():
			value = relatedb.Get(last_node + "_" + str(now_year));
			data = json.loads(value);
			for item in data["next"]:
				topic = item[0];
				rank = item[1];
				if (not topic in candid.keys()):
					candid[topic] = {}
					candid[topic]["rank"] = rank;
					candid[topic]["parent"] = last_node;
				else:
					if (rank > candid[topic]["rank"]):
						candid[topic]["rank"] = rank;
						candid[topic]["parent"] = last_node;

		sort_list = [];
		for topic in candid:
			sort_list.append([topic, candid[topic]["rank"], candid[topic]["parent"]]);
		res = sorted(sort_list, key = lambda x:x[1], reverse = True);
		limit = 3;
		if (str(now_year) == year):
			limit = 3;
		result[str(next_year)] = {}
		for i in range(limit):
			result[str(next_year)][res[i][0]] = {};
			result[str(next_year)][res[i][0]]["rank"] = res[i][1];
			result[str(next_year)][res[i][0]]["parent"] = res[i][2];

		min_value = res[limit/5 * 5][1];
		for last_node in result[str(now_year)].keys():
			value = relatedb.Get(last_node + "_" + str(now_year));
			data = json.loads(value);
			for item in data["next"]:
				topic = item[0];
				rank = item[1];
				if (rank > min_value and (result[str(next_year)][topic]["parent"] != last_node)):
					addition_edge.append([last_node + "_" + str(now_year)
						, topic + "_" + str(next_year)
						,rank]);


		now_year = next_year;
	now_year = int(year);
	while (now_year >=int(min_year_dataset) + 1):
		pre_year = now_year - 1;
		candid = {}
		for last_node in result[str(now_year)].keys():
			value = relatedb.Get(last_node + "_" + str(now_year));
			data = json.loads(value);
			for item in data["pre"]:
				topic = item[0];
				rank = item[1];
				if (not topic in candid.keys()):
					candid[topic] = {}
					candid[topic]["rank"] = rank;
					candid[topic]["parent"] = last_node;
				else:
					if (rank > candid[topic]["rank"]):
						candid[topic]["rank"] = rank;
						candid[topic]["parent"] = last_node;

		sort_list = [];
		for topic in candid:
			sort_list.append([topic, candid[topic]["rank"], candid[topic]["parent"]]);
		res = sorted(sort_list, key = lambda x:x[1], reverse = True);
		limit = 3;
		if (str(now_year) == year):
			limit = 3;
		result[str(pre_year)] = {}
		for i in range(limit):
			result[str(pre_year)][res[i][0]] = {}
			result[str(pre_year)][res[i][0]]["rank"] = res[i][1];
			result[str(pre_year)][res[i][0]]["parent"] = res[i][2];

		min_value = res[limit/5 * 5][1];
		for last_node in result[str(now_year)].keys():
			value = relatedb.Get(last_node + "_" + str(now_year));
			data = json.loads(value);
			for item in data["pre"]:
				topic = item[0];
				rank = item[1];
				if (rank > min_value and (result[str(pre_year)][topic]["parent"] != last_node)):
					addition_edge.append([last_node + "_" + str(now_year)
						, topic + "_" + str(pre_year)
						,rank]);
				

		now_year = pre_year;
	return result;

def relate_set(data, year):
	result = []
	for node in data:
		tmp = {};
		tmp["topic"] = node;
		tmp["node"] = node;
		tmp["year"] = year;
		value = timeLinedb.Get(tmp["topic"] + "_rp");
		ratedata = json.loads(value);
#		print(node+ "_" + year);
		try:
			value = json.loads(wsdb.Get(node + "_" + year));
		except KeyError:
			continue;
		if (len(value["desc"]) < 3):
			continue;
		if (not "desc" in dataset[tmp["topic"]]):
			tmp["desc"] = ["root"];
		else:
			tmp["desc"] = value["desc"];
		tmp["keyw"] = []
		for i in range(3):
			tmp["keyw"].append(value["keyw"][i][0]);
		diff = 0;
		if (tmp["year"] != min_year_dataset):
			diff = float(ratedata[tmp["year"]]) - float(ratedata[str(int(tmp["year"]) -1 )]);
		diff *= 10;
		tmp["diff"] = math.exp(diff)/(1+ math.exp(diff));
		result.append(tmp);
	return result;	

author_name = []
reference_name = []

def getSimilarity(nodeA, nodeB):
	nodeIdA = nodeA.split('_')[0];
	nodeIdB = nodeB.split('_')[0];
	yearA = nodeA.split('_')[1];
	yearB = nodeB.split('_')[1];
	res = 0.0;
	setA = json.loads(wsdb.Get(nodeA))["desc"];
	setB = json.loads(wsdb.Get(nodeB))["desc"];
	for word in setA:
		if (word in setB):
			res += 1.0;
	l = len(setA) + len(setB);
	return res / (l - res);

def connected(nodeA, nodeB, edge):
	head = 0;
	tail = 0;
	q = [];
	q.append(nodeA);
	mark = {}
	while (head < tail):
		node = q[head];
		if (node in edge):
			for node_next in edge[node]:
				if (not node_next in mark):
					mark[node_next] = True;
				q.append(node_next)
				tail += 1;
		head += 1;
	if (nodeB in q):
		return True;
	else:
		return False;


def getAuthorTree(author, condition,db):
	result = {};
	result["tree"] = [];
	result["edge"] = []
	max_value = 0;
	target = 0;
	start = condition["start"];
	end = condition["end"];
	node_limit = condition["node_limit"];
	edge_limit = condition["edge_limit"];
	for name in author_name:
		if (author.lower() in name.lower()):
			value = db.Get(name);
#			print(value);
			value = json.loads(value);
			if (len(value)) > max_value:
				max_value = len(value);
				target = name;
	print(target);
	result["name"] = target
	if (target == 0):
		return result;
	value = json.loads(db.Get(target));
	candid = {}
	for node in value.keys():
		year = node.split('_')[1];
		if (int(year) < int(start) or int(year) > int(end)):
			continue;
		candid[node] = value[node];
	res = sorted(candid.items(), key = lambda x:x[1]);
	for i in range(min(node_limit, len(res))):
		tmp = {}
		tmp["nodeId"] = res[i][0].split('_')[0];
		tmp["rank"] = res[i][1];
		tmp["year"] = res[i][0].split('_')[1];
		tmp["node"] = res[i][0];
		value = json.loads(wsdb.Get(res[i][0]));
		tmp["desc"] = value["desc"];
		tmp["author"] = value["author"];
		tmp["links"] = value["links"];
		tmp["keyw"] = []
		for i in range(3):
			tmp["keyw"].append(value["keyw"][i][0]);
		value = timeLinedb.Get(tmp["nodeId"]+"_rp");
		ratedata = json.loads(value);
		diff = 0;
		if (tmp["year"] != min_year_dataset):
			diff = float(ratedata[tmp["year"]]) - float(ratedata[str(int(tmp["year"]) -1 )]);
		diff *= 10;
		tmp["diff"] = 1 / (1+ math.exp(-diff));
		result["tree"].append(tmp);
	node_num = len(result["tree"]);
	candid = {};
	for i in range(node_num):
		for j in range(i+1, node_num):
			nodeA = result["tree"][i]["node"];
			nodeB = result["tree"][j]["node"];
			if (int(result["tree"][i]["year"]) == int(result["tree"][j]["year"])):
				continue;
			index = nodeA + '-' + nodeB;
			candid[index] = getSimilarity(nodeA, nodeB);
	res = sorted(candid.items(), key = lambda x:x[1], reverse = True);
	i = 0;
	edge = {};
	while (len(result["edge"]) < edge_limit and i < len(res)):
		index = res[i][0];
		nodeA = index.split("-")[0];
		nodeB = index.split("-")[1];
		if (not connected(nodeA, nodeB, edge)):
			tmp = {}
			tmp["source"] = nodeA;
			tmp["target"] = nodeB;
			tmp["rank"] = res[i][1];
			result["edge"].append(tmp);
			if (not nodeA in edge):
				edge[nodeA] = [];
			edge[nodeA].append(nodeB);
		i += 1;
	print(len(result["edge"]));
	print(edge_limit);
	return result;




def getReferenceTree(author, condition,db):
	result = {};
	result["tree"] = [];
	result["edge"] = []
	max_value = 0;
	target = 0;
	start = condition["start"];
	end = condition["end"];
	node_limit = condition["node_limit"];
	edge_limit = condition["edge_limit"];
	for name in reference_name:
		if (author.lower()==name.lower()):
			value = db.Get(name);
#			print(value);
			value = json.loads(value);
			if (len(value)) > max_value:
				max_value = len(value);
				target = name;
	print(target);
	if (target == 0):
		return result;
	value = json.loads(db.Get(target));
	candid = {}
	for node in value.keys():
		year = node.split('_')[1];
		if (int(year) < int(start) or int(year) > int(end)):
			continue;
		candid[node] = value[node];
	res = sorted(candid.items(), key = lambda x:x[1]);
	for i in range(min(node_limit, len(res))):
		tmp = {}
		tmp["nodeId"] = res[i][0].split('_')[0];
		tmp["rank"] = res[i][1];
		tmp["year"] = res[i][0].split('_')[1];
		tmp["node"] = res[i][0];
		value = json.loads(wsdb.Get(res[i][0]));
		tmp["desc"] = value["desc"];
		tmp["author"] = value["author"];
		tmp["links"] = value["links"];
		tmp["keyw"] = []
		for i in range(3):
			tmp["keyw"].append(value["keyw"][i][0]);
		value = timeLinedb.Get(tmp["nodeId"] + "_rp");
		ratedata = json.loads(value);
		diff = 0;
		if (tmp["year"] != min_year_dataset):
			diff = float(ratedata[tmp["year"]]) - float(ratedata[str(int(tmp["year"]) -1 )]);
		diff *= 10;
		tmp["diff"] = 1 / (1+ math.exp(-diff));
		result["tree"].append(tmp);
	node_num = len(result["tree"]);
	candid = {};
	for i in range(node_num):
		for j in range(i+1, node_num):
			nodeA = result["tree"][i]["node"];
			nodeB = result["tree"][j]["node"];
			if (int(result["tree"][i]["year"]) == int(result["tree"][j]["year"])):
				continue;
			index = nodeA + '-' + nodeB;
			candid[index] = getSimilarity(nodeA, nodeB);
	res = sorted(candid.items(), key = lambda x:x[1], reverse = True);
	i = 0;
	edge = {};
	while (len(result["edge"]) < edge_limit and i < len(res)):
		index = res[i][0];
		nodeA = index.split("-")[0];
		nodeB = index.split("-")[1];
		if (not connected(nodeA, nodeB, edge)):
			tmp = {}
			tmp["source"] = nodeA;
			tmp["target"] = nodeB;
			tmp["rank"] = res[i][1];
			result["edge"].append(tmp);
			if (not nodeA in edge):
				edge[nodeA] = [];
			edge[nodeA].append(nodeB);
		i += 1;
	print(len(result["edge"]));
	print(edge_limit);
	return result;

def getTopicTree(node, year, condition):
	fw_year = condition["forward_year"];
	bk_year = condition["backward_year"];
	right = str(min(int(max_year_dataset), int(year) + int(fw_year)));
	left = str(max(int(min_year_dataset), int(year) - int(bk_year)));
	number = condition["node_number"];
	heap = []
	target = {}
	nodes1 = {}
	edges1 = []
	nodes2 = {}
	edges2 = []
	value = json.loads(relatedb.Get(node + "_" + year))
	if ("next" in value):
		for item in value["next"]:
			index = node + "_" + year + "-" + item[0] + "_" + str(int(year) + 1);
			heapq.heappush(heap, (1-float(item[1]), index));
	while (len(target) < number and year != max_year_dataset):
		item = heapq.heappop(heap);
		nodeA = item[1].split('-')[0];
		nodeB = item[1].split('-')[1];
		nodes1[nodeB] = True;
		edges1.append(item);
		yearB = nodeB.split('_')[1];
		topic = nodeB.split('_')[0];
		if (not topic in target):
			target[topic] = True;
		if (yearB == right):
			continue;
		value = json.loads(relatedb.Get(nodeB))
		for item in value["next"]:
			index = nodeB  + "-" + item[0] + "_" + str(int(yearB) + 1);
			heapq.heappush(heap, (1 - float(item[1]), index));

	heap = [];
	target = {};
	value = json.loads(relatedb.Get(node + "_" + year))
	if ("pre" in value):
		for item in value["pre"]:
			index = node + "_" + year + "-" + item[0] + "_" + str(int(year) - 1);
			heapq.heappush(heap, (1-float(item[1]), index));
	while (len(target) < number and year != min_year_dataset):
		item = heapq.heappop(heap);
		nodeA = item[1].split('-')[0];
		nodeB = item[1].split('-')[1];
		nodes2[nodeB] = True;
		edges2.append(item);
		yearB = nodeB.split('_')[1];
		topic = nodeB.split('_')[0];
		if (not topic in target):
			target[topic] = True;
		if (yearB == left):
			continue;
		value = json.loads(relatedb.Get(nodeB))
		for item in value["pre"]:
			index = nodeB  + "-" + item[0] + "_" + str(int(yearB) - 1);
			heapq.heappush(heap, (1 - float(item[1]), index));
	nodes = []
	nodes.append(node + "_" + year);
	nodes.extend(nodes1.keys())
	nodes.extend(nodes2.keys());
	edges = edges1;
	edges.extend(edges2);
	result = {};
	result["tree"] = [];
	result["edge"] = [];
	for item in nodes:
		tmp = {}
		tmp["nodeId"] = item.split('_')[0];
		tmp["year"] = item.split('_')[1];
		tmp["node"] = item;
		value = json.loads(wsdb.Get(item));
		tmp["desc"] = value["desc"];
		tmp["author"] = value["author"];
		tmp["links"] = value["links"];
		tmp["keyw"] = []
		for i in range(3):
			tmp["keyw"].append(value["keyw"][i][0]);
		value = timeLinedb.Get(tmp["nodeId"] + "_rp")
		ratedata = json.loads(value);
		diff = 0;
		if (tmp["year"] != min_year_dataset):
			diff = float(ratedata[tmp["year"]]) - float(ratedata[str(int(tmp["year"]) -1 )]);
		diff *= 10;
		tmp["diff"] = math.exp(diff)/(1+ math.exp(diff));
		result["tree"].append(tmp);
	for item in edges:
		index = item[1];
		nodeA = index.split("-")[0];
		nodeB = index.split("-")[1];
		tmp = {}
		tmp["source"] = nodeA;
		tmp["target"] = nodeB;
		tmp["rank"] = 1 - item[0];
		result["edge"].append(tmp);
	return result;

relate_word = {}
relate_topic = {}
for k in relatewtdb.RangeIter():
	words = k[0].split('_');
	if (words[0] == 'word'):
		relate_word[words[1]] = json.loads(k[1]);
	else:
		relate_topic[words[1]] = json.loads(k[1]);


# Get configuration from config.cfg

fcontent = {};
dataset = {}
default_year = {};
relateset = {};

for k in descdb.RangeIter():
	dataset[k[0]] = json.loads(k[1]);
	relateset[k[0]] = {}

for k in authordb.RangeIter():
	author_name.append(k[0]);

for k in referencedb.RangeIter():
	reference_name.append(k[0]);

for topic in dataset.keys():
	value = timeLinedb.Get(topic + "_r0");
	data = json.loads(value);
	max_value = 0;
	max_year = min_year_dataset;
	for year in data.keys():
		if (year == "min" or year == "max"):
			continue;
		if (int(year) < int(min_year_dataset) or int(year) > max_year_dataset):
			continue;
		if (float(data[year]) > max_value):
			max_value = float(data[year]);
			max_year = year;
	default_year[topic] = max_year;


root = "0";
hierarchy["root"] = 0;
build_hierarchy(dataset,root);
#result = subtree_AandB("0", "0");
#print(result);

#print(result);
L1 = []
L2 = []
nodeA = "0";
nodeB = "0";
resultree = {};

globalyear = min_year_dataset;

#addition_edge = []
#ts = build_time_series("11286", "2000",relatedb, addition_edge);
#print(addition_edge);
'''
reference = "TCP-traffic-is-multifractal:-a-numerical-study.";
condition = {}
condition["start"] = "1994";
condition["end"] = "2004";
condition["node_limit"] = 7;
condition["edge_limit"] = 7;
result = getReferenceTree(reference, condition, referencedb);
print(result);
'''

class ServerHandler(SimpleHTTPServer.SimpleHTTPRequestHandler):
	def __init__(self, request, client_address, server):
		SimpleHTTPServer.SimpleHTTPRequestHandler.__init__(self, request, client_address, server);
	def gzipencode ( self , content ):
		out = StringIO.StringIO();
		f = gzip.GzipFile(fileobj=out, mode='w', compresslevel=5);
		f.write(content);
		f.close();
		return out.getvalue();

	def do_GET ( self ):
		up = urlparse ( self.path ); 
		qs = parse_qs ( up[4] );
		req = "";
		
		webreq = (str(up[2]).split('&')[0])
		# serve gc.html , every other request should be to GC
		if webreq == '/gc.html' or webreq == '/css/gc.css' or webreq == '/js/gc.js' or webreq == '/js/d3.v3.min.js':
			self.send_response(200, 'OK' );
			if webreq == '/css/gc.css' :
				self.send_header('Content-type', 'text/css');
			else :
				if webreq == '/gc.html' :
					self.send_header('Content-type', 'text/html');
				else:
					self.send_header('Content-type', 'text/javascript');
			self.end_headers();
			fname = './html' + webreq;
			print " serving " + fname;
			s = "";
			if fname not in fcontent:
				f = open(fname,'r');
				s = f.read();
				f.close();
			else:
				s = fcontent[fname];				
			self.wfile.write(bytes(s));
			return;

		# the request-type must only be of form http://[..]/GC?GC_REQ=..&GC_DATASET=..&[GC_NODE=..]"
		if webreq == '/compare.html' or webreq == '/css/compare.css' or webreq == '/js/compare.js' or webreq == '/js/d3.v3.min.js':
			self.send_response(200, 'OK' );
			if webreq == '/css/compare.css' :
				self.send_header('Content-type', 'text/css');
			else :
				if webreq == '/compare.html' :
					self.send_header('Content-type', 'text/html');
				else:
					self.send_header('Content-type', 'text/javascript');
			self.end_headers();
			fname = './html' + webreq;
			print " serving " + fname;
			s = "";
			if fname not in fcontent:
				f = open(fname,'r');
				s = f.read();
				f.close();
			else:
				s = fcontent[fname];				
			self.wfile.write(bytes(s));
			return;

		if webreq == '/ts.html' or webreq == '/css/ts.css' or webreq == '/js/ts.js' or webreq == '/js/d3.v3.min.js':
			self.send_response(200, 'OK' );
			if webreq == '/css/ts.css' :
				self.send_header('Content-type', 'text/css');
			else :
				if webreq == '/ts.html' :
					self.send_header('Content-type', 'text/html');
				else:
					self.send_header('Content-type', 'text/javascript');
			self.end_headers();
			fname = './html' + webreq;
			print " serving " + fname;
			s = "";
			if fname not in fcontent:
				f = open(fname,'r');
				s = f.read();
				f.close();
			else:
				s = fcontent[fname];				
			self.wfile.write(bytes(s));
			return;

		if webreq == '/tss.html' or webreq == '/css/tss.css' or webreq == '/js/tss.js' or webreq == '/js/d3.v3.min.js':
			self.send_response(200, 'OK' );
			if webreq == '/css/tss.css' :
				self.send_header('Content-type', 'text/css');
			else :
				if webreq == '/tss.html' :
					self.send_header('Content-type', 'text/html');
				else:
					self.send_header('Content-type', 'text/javascript');
			self.end_headers();
			fname = './html' + webreq;
			print " serving " + fname;
			s = "";
			if fname not in fcontent:
				f = open(fname,'r');
				s = f.read();
				f.close();
			else:
				s = fcontent[fname];				
			self.wfile.write(bytes(s));
			return;

		if up[2] != '/GC':
			self.serve_empty ( " Cannot find the page " + up[3] );
			return;

		# Request-type is needed to serve any request
		if 'GC_REQ' not in qs:
			self.serve_empty ( "REQ variable not found" );
			return;

		req = qs['GC_REQ'][0];

		# DATASET variable is required for all requests 
		if 'GC_DATASET' not in qs:
			self.serve_empty ( "DATASET variable not found" );
			return;

		# Serve hierarchy request
		if req == 'hierarchy':
			key = qs['GC_DATASET'][0] + "_hierarchy";
			self.serve_key ( META_LEVELDB , key );
			return;

		# NODE variable is required for request-types 'children'/'content'
#		if 'GC_NODE' not in qs:
#			self.serve_empty ( "NODE variable not found" );
#			return;

		# Serve key-value request
		if req == 'children':
			key = qs['GC_DATASET'][0] + "_" + req + "_" + qs['GC_NODE'][0];
			try:
				value = META_LEVELDB.Get(key);
			except:
				value = json.dumps({});
			data = {}
			data[0] = value;
			tmp = {}
			desc = {}
			desc["desc"] = {};
			datanode = json.loads(value);
			if (datanode["isleaf"] == 0):
				for child in datanode["children"]:
					node = child["node"];
					try:
						valuenode = timeLinedb.Get(str(node)+"_rp");
					except:
						valuenode = json.dumps({});
					tmp[node] = valuenode;
			try:
				valuedesc = descdb.Get(str(qs['GC_NODE'][0]));
				if (qs['GC_NODE'][0] == '0'):
					valuedesc = json.dumps(desc);
			except:
				valuedesc = json.dumps(desc);
			data[1] = json.dumps(tmp);
			data[2] = valuedesc;
			self.send_response(200, 'OK' );
			self.send_header('Content-type', 'application/json')
			self.end_headers()	
			print " Serving key " + key;
			self.wfile.write(bytes(json.dumps(data)))
			return;

		# Serve key-value request
		if req == 'content':
			key = qs['GC_DATASET'][0] + "_" + req + "_" + qs['GC_NODE'][0];
			if qs['GC_DATASET'][0] == 'pubmed':
				self.serve_key ( PUBMED_CONTENT_LEVELDB , key );
			else:
				self.serve_key ( CONTENT_LEVELDB , key );
			return;
		if req == 'timeLine':
			global globalyear;
			node = qs['GC_NODE'][0];
			try:
				valuesum = timeLinedb.Get(node+"_sum");
			except KeyError:
				valuesum = json.dumps({});
			try:
				valuer0 = timeLinedb.Get(node+"_r0");
			except KeyError:
				valuer0 = json.dumps({});
			try:
				valuerp = timeLinedb.Get(node+"_rp");
			except KeyError:
				valuerp = json.dumps({});
			try:
				valuews = wsdb.Get(node);
			except KeyError:
				valuews = json.dumps({});
			data = {};
			data[0] = valuesum;
			data[1] = valuer0;
			data[2] = valuerp;
			if (not node in relate_topic):
				data[3] = json.dumps({});
			else:
				data[3] = json.dumps(relate_topic[node]);
			data[4] = valuews;
			self.send_response(200, 'OK');
			self.send_header('Content-type', 'application/json');
			self.end_headers();
			self.wfile.write(bytes(json.dumps(data)));
			self.wfile.flush();
		if req == 'searchNode':
			global globalyear;
			if (qs['GC_NODE'][0].isdigit()):
				node = qs['GC_NODE'][0];
			else:
				node = searchNode(qs['GC_NODE'][0], dataset);
			relate = {}
			if (qs['GC_NODE'][0] in relate_word):
				relate = relate_word[qs['GC_NODE'][0]];
			self.send_response(200, 'OK');
			self.send_header('Content-type', 'application/json');
			self.end_headers();
			data = {}
			data["result"] = node;
			data["relate"] = relate;
			data["year"] = default_year[node];
			globalyear = default_year[node];
			self.wfile.write(bytes(json.dumps(data)));
			self.wfile.flush();

		if req == 'searchNodeYear':
			global globalyear;
			if (qs['GC_NODE'][0].isdigit()):
				node = qs['GC_NODE'][0];
			else:
				year = qs['YEAR'][0];
				if (year == "null"):
					node = searchNode(qs['GC_NODE'][0], dataset);
				else:
					node = searchNodeYear(qs['GC_NODE'][0], year, dataset);
			relate = {}
			if (qs['GC_NODE'][0] in relate_word):
				relate = relate_word[qs['GC_NODE'][0]];
			self.send_response(200, 'OK');
			self.send_header('Content-type', 'application/json');
			self.end_headers();
			data = {}
			data["result"] = node;
			data["relate"] = relate;
			data["year"] = default_year[node];
			globalyear = default_year[node];
			self.wfile.write(bytes(json.dumps(data)));
			self.wfile.flush();

		if req == 'buildsubtree':
			print(qs);
			nodeA = qs['GC_NODE'][0].split(' ')[0];
			nodeB = qs['GC_NODE'][0].split(' ')[1];
			resultree = subtree_AandB(nodeA, nodeB);
			mark = {};
			result = convert_tree(resultree);
			self.send_response(200, 'OK');
			self.send_header('Content-tpye', 'application/json');
			self.end_headers();
			self.wfile.write(bytes(json.dumps(result)));
			self.wfile.flush();
		print req;
		global L1,L2,nodeA,nodeB,resultree;
		if req == 'buildsubtreeoftwoword':
			wordA = qs['GC_NODEA'][0];
			wordB = qs['GC_NODEB'][0];
			if (wordA.isdigit()):
				L1 = [wordA];
				for i in range(0,4):
					L1.append(relate_topic[wordA][i]);
			else:
				L1 = searchWord(wordA, dataset);
			if (wordB.isdigit()):
				L2 = [wordB];
				for i in range(0,4):
					L2.append(relate_topic[wordB][i]);
			else:
				L2 = searchWord(wordB, dataset);
			LL = list(L1);
			LL.extend(L2);
			resultree = subtree_set(LL);
			if (wordA.isdigit()):
				nodeA = wordA;
			else:
				nodeA = searchNode(wordA,dataset);
			if (wordB.isdigit()):
				nodeB = wordB;
			else:
				nodeB = searchNode(wordB,dataset);
			mark = subtree_AandB(nodeA, nodeB)
			result = convert_tree(resultree, L1, L2, mark);
			result["nodeA"] = nodeA;
			result["nodeB"] = nodeB;
#			print(L1);
#			print(L2);
#			print(resultree);
#			print(result);
			self.send_response(200, 'OK');
			self.send_header('Content-tpye', 'application/json');
			self.end_headers();
			self.wfile.write(bytes(json.dumps(result)));
			self.wfile.flush();
		if req == 'changeTreeNode':
			print(nodeA);
			s = qs['GC_NODE'][0];
			word = s[1:];
			s = s[0:1];
			if (s == "A"):
				nodeA = word;
			else:
				nodeB = word;
			mark = subtree_AandB(nodeA,nodeB);
			result = convert_tree(resultree, L1, L2, mark);
#			print(mark);
			self.send_response(200, 'OK');
			self.send_header('Content-tpye', 'application/json');
			self.end_headers();
			self.wfile.write(bytes(json.dumps(result)));
			self.wfile.flush();

		if req == 'TimeSeriesTree':
			global globalyear;
			node = qs['GC_NODE'][0].split('_')[0];
			year = qs['GC_NODE'][0].split('_')[1];
			print(node);
			print(year);
			globalyear = year;
			condition = {}
			condition["forward_year"] = qs["FY"][0];
			condition["backward_year"] = qs["BY"][0];
			condition["node_number"] = int(qs["NN"][0]);
			result = getTopicTree(node, year, condition);	
			out = {}
			out["tree"] = json.dumps(result["tree"]);
			out["relate"] = json.dumps(relate_set(relate_topic[node], year));
#			out["relate"] = json.dumps([]);
			out["addition_edge"] = json.dumps(result["edge"]);
			self.send_response(200, 'OK');
			self.send_header('Content-tpye', 'application/json');
			self.end_headers();
			self.wfile.write(bytes(json.dumps(out)));
			self.wfile.flush();		

		if req == 'AuthorTree':
			author = qs['GC_NODE'][0];
			condition = {}
			condition["start"] = qs['SY'][0];
			condition["end"] = qs['EY'][0];
			condition["node_limit"] = int(qs['NL'][0]);
			condition["edge_limit"] = int(qs['EL'][0]);
			result = getAuthorTree(author, condition, authordb);
			out = {}
			out["tree"] = json.dumps(result["tree"]);
			out["relate"] = json.dumps([]);
			out["addition_edge"] = json.dumps(result["edge"]);
			out["name"] = result["name"];
			self.send_response(200, 'OK');
			self.send_header('Content-tpye', 'application/json');
			self.end_headers();
			self.wfile.write(bytes(json.dumps(out)));
			self.wfile.flush();			

		if req == 'ReferenceTree':
			reference = qs['GC_NODE'][0];
			condition = {}
			condition["start"] = qs['SY'][0];
			condition["end"] = qs['EY'][0];
			condition["node_limit"] = int(qs['NL'][0]);
			condition["edge_limit"] = int(qs['EL'][0]);
			result = getReferenceTree(reference, condition, referencedb);
			out = {}
			out["tree"] = json.dumps(result["tree"]);
			out["relate"] = json.dumps([]);
			out["addition_edge"] = json.dumps(result["edge"]);
			self.send_response(200, 'OK');
			self.send_header('Content-tpye', 'application/json');
			self.end_headers();
			self.wfile.write(bytes(json.dumps(out)));
			self.wfile.flush();		

		if req == 'yearinfo':
			out = {}
			out["min_year_dataset"] =min_year_dataset;
			out["max_year_dataset"] = max_year_dataset;
			self.send_response(200, 'OK');
			self.send_header('Content-tpye', 'application/json');
			self.end_headers();
			self.wfile.write(bytes(json.dumps(out)));
			self.wfile.flush();				


	# Serves the value of the key
	def serve_key ( self , L , key ):
		try:
			value = L.Get(key);
		except KeyError:
			value = "";

		if string.find(self.headers['Accept-Encoding'],"gzip") == 1 and length(value)>150:
			self.send_response(200, 'OK' );
			gz_content = self.gzipencode ( value );
			len_gz = len(str(gz_content));
			self.send_header("Content-length", str(len_gz));
			self.send_header('Content-type', 'gzip')
			self.end_headers()	
			print " Serving key [gzipped] " + key;
			self.wfile.write(gz_content);
		else:
			self.send_response(200, 'OK' );
			self.send_header('Content-type', 'application/json')
			self.end_headers()	
			print " Serving key " + key;
			self.wfile.write(bytes(value))

		self.wfile.flush();
		return;


	# Serves an empty-page with appropriate response 
	def serve_empty ( self , response ):
		self.send_response(400, 'OK' );
		self.send_header('Content-type', 'html')
		self.end_headers()	
		self.wfile.write(bytes(response))
		return;


Handler = ServerHandler

# Initialize server object
httpd = SocketServer.TCPServer(("", PORT), Handler)

print "serving at port", PORT
httpd.serve_forever()



