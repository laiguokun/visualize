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

# Valid requests are GC?GC_REQ=[content|hierarchy|children]
#											&GC_DATASET=dataset
#											&[GC_NODE=node]

# Valid Keys for e.g. are , 
# rcv1_hierarchy , rcv1_content_3453 , rcv1_children_3443

# Get timeLine info;
def searchNode(query, dataset):
	words = query.split();
	print(words);
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
	else:
		if (node in L2):
			tmp["set"] = 2;
		else:
			tmp["set"] = 3;
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
		res = sorted(candid.items(), key=lambda x:x[1]);
		for i in range(min(5,len(res))):
			out.append(res[i][0]);
	if (len(out) == 0):
		out.append("0");
	return out;

def convert_tree(tree, L1, L2, mark):
	result = buildtree(tree, tree["root"], L1, L2, mark);
	result["parent"] = "null";
	return result;

fin = open("relate_word.dat", "r");
relate_word = {}
for line in fin:
	words = line[0:-1].split('\t');
	relate_word[words[0]] = words[1:];

fin = open("relate_topic.dat" , "r");
relate_topic = {}
for line in fin:
	words = line[0:-1].split('\t');
	relate_topic[words[0]] = words[1:];


# Get configuration from config.cfg
cfg = ConfigParser.ConfigParser();
cfg.read('config.cfg');


PORT = int( cfg.get('main','port') );
PORT += random.randint(0,20);
META_LEVELDB = leveldb.LevelDB( cfg.get('main','meta_leveldb_loc') );
CONTENT_LEVELDB = leveldb.LevelDB( cfg.get('main','content_leveldb_loc') );
PUBMED_CONTENT_LEVELDB = leveldb.LevelDB( cfg.get('main','pubmed_content_leveldb_loc') );
sumdb = leveldb.LevelDB( cfg.get('main','timeLine-sum_leveldb_loc'));
r0db = leveldb.LevelDB( cfg.get('main','timeLine-rateto0_leveldb_loc'));
rpdb = leveldb.LevelDB( cfg.get('main','timeLine-ratetop_leveldb_loc'));
wsdb = leveldb.LevelDB( cfg.get('main','wordSeries_leveldb_loc'));
descdb = leveldb.LevelDB(cfg.get('main', 'desc_leveldb_loc'));
fcontent = {};
dataset = {}

for k in descdb.RangeIter():
	dataset[k[0]] = json.loads(k[1]);

root = "0";
hierarchy["root"] = 0;
build_hierarchy(dataset,root);
#result = subtree_AandB("0", "0");
#print(result);

#print(result);

class ServerHandler(SimpleHTTPServer.SimpleHTTPRequestHandler):

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

		# serve gc.html , every other request should be to GC
		if up[2] == '/gc.html' or up[2] == '/css/gc.css' or up[2] == '/js/gc.js' or up[2] == '/js/d3.v3.min.js':
			self.send_response(200, 'OK' );
			if up[2] == '/css/gc.css' :
				self.send_header('Content-type', 'text/css');
			else :
				if up[2] == '/gc.html' :
					self.send_header('Content-type', 'text/html');
				else:
					self.send_header('Content-type', 'text/javascript');
			self.end_headers();
			fname = './html' + up[2];
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
		if up[2] == '/compare.html' or up[2] == '/css/compare.css' or up[2] == '/js/compare.js' or up[2] == '/js/d3.v3.min.js':
			self.send_response(200, 'OK' );
			if up[2] == '/css/compare.css' :
				self.send_header('Content-type', 'text/css');
			else :
				if up[2] == '/compare.html' :
					self.send_header('Content-type', 'text/html');
				else:
					self.send_header('Content-type', 'text/javascript');
			self.end_headers();
			fname = './html' + up[2];
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
						valuenode = rpdb.Get(str(node));
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
			node = qs['GC_NODE'][0];
			try:
				valuesum = sumdb.Get(node);
			except KeyError:
				valuesum = json.dumps({});
			try:
				valuer0 = r0db.Get(node);
			except KeyError:
				valuer0 = json.dumps({});
			try:
				valuerp = rpdb.Get(node);
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
		if req == 'buildsubtreeoftwoword':
			wordA = qs['GC_NODEA'][0];
			wordB = qs['GC_NODEB'][0];
			L1 = searchWord(wordA, dataset);
			L2 = searchWord(wordB, dataset);
			LL = list(L1);
			LL.extend(L2);
			resultree = subtree_set(LL);
			nodeA = searchNode(wordA,dataset);
			nodeB = searchNode(wordB,dataset);
			mark = subtree_AandB(nodeA, nodeB)
			result = convert_tree(resultree, L1, L2, mark);
			print(L1);
			print(L2);
			print(resultree);
#			print(result);
			self.send_response(200, 'OK');
			self.send_header('Content-tpye', 'application/json');
			self.end_headers();
			self.wfile.write(bytes(json.dumps(result)));
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



