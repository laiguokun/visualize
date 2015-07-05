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
fin = open("search_candid.dat","r");
lexicon = {}
for line in fin:
	words = line[0:-1].split('\t');
	lexicon[words[0]] = int(words[1]);
fin = open("timeLine-sum.dat","r");
timeLine = {}
timeLine_0 = {}
timeLine_parent = {}

for line in fin:
	words = line[0:-1].split('\t');
	timeLine[words[0]] = {}
	minnum = 2004;
	maxnum = 1990;
	for i in range(1,len(words)):
		year = words[i].split(':')[0];
		if (int(year) < 1990):
			continue;
		if (int(year) > 2004):
			continue;
		num = words[i].split(':')[1];
		timeLine[words[0]][year] = num;
	maxnum = 2004;
	minnum = 1990;
	timeLine[words[0]]["max"] = maxnum;
	timeLine[words[0]]["min"] = minnum;
	for year in range(minnum, maxnum + 1):
		if (not year in timeLine[words[0]]):
			timeLine[words[0]][year] = 0;

fin = open("timeLine-rateto0.dat","r");
for line in fin:
	words = line[0:-1].split('\t');
	timeLine_0[words[0]] = {}
	minnum = 2004;
	maxnum = 1990;
	for i in range(1,len(words)):
		year = words[i].split(':')[0];
		if (int(year) < 1990):
			continue;
		if (int(year) > 2004):
			continue;
		num = words[i].split(':')[1];
		timeLine_0[words[0]][year] = num;
	maxnum = 2004;
	minnum = 1990;
	timeLine_0[words[0]]["max"] = maxnum;
	timeLine_0[words[0]]["min"] = minnum;
	for year in range(minnum, maxnum + 1):
		if (not year in timeLine_0[words[0]]):
			timeLine_0[words[0]][year] = 0;

fin = open("timeLine-ratetoparent.dat","r");
for line in fin:
	words = line[0:-1].split('\t');
	timeLine_parent[words[0]] = {}
	minnum = 2004;
	maxnum = 1990;
	for i in range(1,len(words)):
		year = words[i].split(':')[0];
		if (int(year) < 1990):
			continue;
		if (int(year) > 2004):
			continue;
		num = words[i].split(':')[1];
		timeLine_parent[words[0]][year] = num;
	maxnum = 2004;
	minnum = 1990;
	timeLine_parent[words[0]]["max"] = maxnum;
	timeLine_parent[words[0]]["min"] = minnum;
	for year in range(minnum, maxnum + 1):
		if (not year in timeLine_parent[words[0]]):
			timeLine_parent[words[0]][year] = 0;
# Get configuration from config.cfg
cfg = ConfigParser.ConfigParser();
cfg.read('config.cfg');


PORT = int( cfg.get('main','port') );
PORT += random.randint(0,20);
META_LEVELDB = leveldb.LevelDB( cfg.get('main','meta_leveldb_loc') );
CONTENT_LEVELDB = leveldb.LevelDB( cfg.get('main','content_leveldb_loc') );
PUBMED_CONTENT_LEVELDB = leveldb.LevelDB( cfg.get('main','pubmed_content_leveldb_loc') );

fcontent = {};

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
		if 'GC_NODE' not in qs:
			self.serve_empty ( "NODE variable not found" );
			return;

		# Serve key-value request
		if req == 'children':
			key = qs['GC_DATASET'][0] + "_" + req + "_" + qs['GC_NODE'][0];
			self.serve_key ( META_LEVELDB , key );
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
			self.send_response(200, 'OK');
			self.send_header('Content-type', 'application/json');
			self.end_headers();
			data = {};
			data[0] = json.dumps(timeLine[node]);
			data[1] = json.dumps(timeLine_0[node]);
			data[2] = json.dumps(timeLine_parent[node]);
			self.wfile.write(bytes(json.dumps(data)));
			self.wfile.flush();
		if req == 'searchNode':
			if (not qs['GC_NODE'][0] in lexicon):
				node = 0;
			else:
				node = lexicon[qs['GC_NODE'][0]];
			self.send_response(200, 'OK');
			self.send_header('Content-type', 'application/json');
			self.end_headers();
			data = {}
			data["result"] = node;
			print(qs);
			print(node);
			self.wfile.write(bytes(json.dumps(data)));
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



