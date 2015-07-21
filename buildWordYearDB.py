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

cfg = ConfigParser.ConfigParser();
cfg.read('config.cfg');
descdb = leveldb.LevelDB(cfg.get('main', 'desc_leveldb_loc'));
relatedb = leveldb.LevelDB(cfg.get('main','relate_leveldb_loc'));
hierarchy = {};
dataset = {}

def build_hierarchy(dataset, node):
	if (node == "0"):
		hierarchy[node] = {}
	hierarchy[node]["children"] = [];
	for son in dataset[node]["children"]:
		hierarchy[str(node)]["children"].append(str(son));
		hierarchy[str(son)] = {};
		hierarchy[str(son)]["parent"] = str(node);
		build_hierarchy(dataset, str(son));
def tree_distance(nodeA,nodeB):
	res = 0.0;
	depthA = dataset[nodeA]["depth"];
	depthB = dataset[nodeB]["depth"];
	pathA = [];pathB = [];
	pathA.append(nodeA);pathB.append(nodeB);
	while (depthA > depthB):
		pathA.append(hierarchy[pathA[len(pathA) - 1]]["parent"]);
		depthA -= 1;
		res += 1;
	while (depthB > depthA):
		pathB.append(hierarchy[pathB[len(pathB) - 1]]["parent"]);
		depthB -= 1;
		res += 1;
	while (pathA[len(pathA) - 1] != pathB[len(pathB) - 1]):
		pathA.append(hierarchy[pathA[len(pathA) - 1]]["parent"]);
		pathB.append(hierarchy[pathB[len(pathB) - 1]]["parent"]);
		res += 2;
	return 1.0/(res + 1);

for k in descdb.RangeIter():
	dataset[k[0]] = json.loads(k[1]);
root = "0";
hierarchy["root"] = 0;
build_hierarchy(dataset,root);

fin = open("wordSeries.dat")
desc = {};
inverse_list = {}
for line in fin:
	words = line[0:-1].split('\t');
	topic = words[0];
	word = words[1];
	if (not topic in desc):
		desc[topic] = {}
	for i in range(2, len(words)):
		year = words[i].split(':')[0];
		if (not year in desc[topic]):
			desc[topic][year] = [];
		desc[topic][year].append(word);
		if (not word in inverse_list):
			inverse_list[word] = {}
		if (not year in inverse_list[word]):
			inverse_list[word][year] = [];
		inverse_list[word][year].append(topic);

for topic in desc:
	if (int(topic) % 100 == 0):
		print(topic);
	for year in desc[topic]:
#		if (year != "2000"):
#			continue;
		out = {}
		if (int(year)>1994):
			time = str(int(year) + 1);
			candid = {}
			for word in desc[topic][year]:
				if (time in inverse_list[word]):
					for candid_topic in inverse_list[word][time]:
						if (not candid_topic in candid):
							candid[candid_topic] = 0.0;
						candid[candid_topic] += 1;
			for candid_topic in candid:
				candid[candid_topic] = candid[candid_topic] / (20.0 - candid[candid_topic]) + tree_distance(topic, candid_topic) / 20.0;
			res = sorted(candid.items(), key = lambda x:x[1], reverse = True);
			out["next"] = []
			for i in range(min(20, len(candid))):
				out["next"].append(res[i]);
		if (int(year)<2004):
			time = str(int(year) - 1);
			candid = {}
			for word in desc[topic][year]:
				if (time in inverse_list[word]):
					for candid_topic in inverse_list[word][time]:
						if (not candid_topic in candid):
							candid[candid_topic] = 0.0;
						candid[candid_topic] += 1;
			for candid_topic in candid:
				candid[candid_topic] = candid[candid_topic] / (20.0 - candid[candid_topic]) + tree_distance(topic, candid_topic) / 20.0;
			res = sorted(candid.items(), key = lambda x:x[1], reverse = True);
			out["pre"] = []
			for i in range(min(20, len(candid))):
				out["pre"].append(res[i]);
		s = topic + "_" + year;
		relatedb.Put(s, json.dumps(out));

