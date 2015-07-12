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
			if (not qs['GC_NODE'][0] in lexicon):
				node = 0;
			else:
				node = lexicon[qs['GC_NODE'][0]];
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



